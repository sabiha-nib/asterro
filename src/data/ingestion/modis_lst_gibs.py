"""Ingest MODIS Aqua monthly Land Surface Temperature (day 13:30 / night 01:30 local
overpass) from NASA GIBS and aggregate the diurnal range (day - night) onto the
NASA POWER / MERRA-2 grid (0.5 x 0.625 deg).

Layers   : MODIS_Aqua_L3_Land_Surface_Temp_Monthly_Day / _Night (GIBS, EPSG:4326)
Service  : https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi (GetMap, 0.1 deg)
Decoding : GIBS colormap MODIS_Land_Surface_Temp.xml (v1.3) maps every RGB value to a
           0.6 K interval between 200 and 350 K. WMS output is nearest-neighbour, so each
           pixel is decoded exactly to its interval midpoint (quantisation +/-0.3 K).
           The open-ended bins (<200 K, >350 K) are censored and treated as missing.
Output   : modis_lst.zip with yearly and climatological cell means of (day - night) [K].
"""
import io, json, re, sys, time, concurrent.futures as cf
import numpy as np, requests
from PIL import Image

WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
CMAP = "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_Land_Surface_Temp.xml"
LAYER = "MODIS_Aqua_L3_Land_Surface_Temp_Monthly_{}"
YEARS = list(range(2016, 2026))
NLAT, NLON = 361, 576


def build_lut():
    s = requests.get(CMAP, timeout=60).text
    lut = np.full(1 << 24, np.nan, np.float32)
    for r, g, b, lo, hi in re.findall(
            r'rgb="(\d+),(\d+),(\d+)" transparent="false" sourceValue="[^"]*" value="\[([\d.]+),([\d.]+)\)"', s):
        lo, hi = float(lo), float(hi)
        if lo < 200 or hi > 350.001:      # censored open-ended bins
            continue
        lut[int(r) * 65536 + int(g) * 256 + int(b)] = (lo + hi) / 2
    return lut


def get(layer, date, tries=6):
    q = dict(SERVICE="WMS", REQUEST="GetMap", VERSION="1.3.0", LAYERS=layer, CRS="EPSG:4326",
             BBOX="-90,-180,90,180", WIDTH=3600, HEIGHT=1800, FORMAT="image/png", TIME=date)
    for k in range(tries):
        try:
            r = requests.get(WMS, params=q, timeout=120)
            if r.status_code == 200 and r.headers.get("content-type", "").startswith("image"):
                return np.array(Image.open(io.BytesIO(r.content)).convert("RGBA"))
        except Exception:
            pass
        time.sleep(3 + 4 * k)
    raise RuntimeError(f"failed {layer} {date}")


def main(out="modis_lst.zip"):
    lut = build_lut()
    plat = 89.95 - 0.1 * np.arange(1800)             # row centres, north -> south
    plon = -179.95 + 0.1 * np.arange(3600)
    ci = np.clip(np.rint((plat + 90) / 0.5).astype(int), 0, NLAT - 1)
    cj = np.rint((plon + 180) / 0.625).astype(int) % NLON
    cell = (ci[:, None] * NLON + cj[None, :]).ravel()

    def decode(a):
        k = a[..., 0].astype(np.int64) * 65536 + a[..., 1].astype(np.int64) * 256 + a[..., 2]
        v = lut[k]
        v[a[..., 3] == 0] = np.nan
        return v.ravel()

    s_year = np.zeros((len(YEARS), NLAT * NLON)); n_year = np.zeros_like(s_year)
    s_day = np.zeros(NLAT * NLON); s_night = np.zeros(NLAT * NLON); n_dn = np.zeros(NLAT * NLON)
    tasks = [(y, m) for y in YEARS for m in range(1, 13)]

    def job(t):
        y, m = t
        d = f"{y}-{m:02d}-01"
        return t, decode(get(LAYER.format("Day"), d)), decode(get(LAYER.format("Night"), d))

    with cf.ThreadPoolExecutor(4) as ex:
        for n, ((y, m), day, night) in enumerate(ex.map(job, tasks)):
            ok = np.isfinite(day) & np.isfinite(night)
            dr = np.where(ok, day - night, 0.0)
            yi = YEARS.index(y)
            s_year[yi] += np.bincount(cell, weights=dr, minlength=NLAT * NLON)
            n_year[yi] += np.bincount(cell, weights=ok.astype(float), minlength=NLAT * NLON)
            s_day += np.bincount(cell, weights=np.where(ok, day, 0), minlength=NLAT * NLON)
            s_night += np.bincount(cell, weights=np.where(ok, night, 0), minlength=NLAT * NLON)
            n_dn += np.bincount(cell, weights=ok.astype(float), minlength=NLAT * NLON)
            if n % 12 == 0:
                print(n, len(tasks), flush=True)

    with np.errstate(invalid="ignore", divide="ignore"):
        dr_year = (s_year / n_year).reshape(len(YEARS), NLAT, NLON).astype(np.float32)
        dr_clim = (s_year.sum(0) / n_year.sum(0)).reshape(NLAT, NLON).astype(np.float32)
        day_c = (s_day / n_dn).reshape(NLAT, NLON).astype(np.float32)
        night_c = (s_night / n_dn).reshape(NLAT, NLON).astype(np.float32)
    meta = dict(source="NASA GIBS WMS, MODIS Aqua L3 LST Monthly Day/Night", wms=WMS, colormap=CMAP,
                years=YEARS, pixel_deg=0.1, quantisation_K=0.6,
                retrieved_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    with open(out, "wb") as fh:
        np.savez_compressed(fh, years=np.array(YEARS), dr_year=dr_year,
                            n_year=n_year.reshape(len(YEARS), NLAT, NLON).astype(np.float32),
                            dr_clim=dr_clim, day_clim=day_c, night_clim=night_c,
                            n_clim=n_dn.reshape(NLAT, NLON).astype(np.float32), meta=json.dumps(meta))
    print("valid cells", int(np.isfinite(dr_clim).sum()))


if __name__ == "__main__":
    main(*sys.argv[1:])
