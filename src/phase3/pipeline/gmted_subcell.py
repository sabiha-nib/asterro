"""Earth sub-cell terrain distribution per ASTERRO cell (completes the Phase II sub-cell gap, terrain only).

Source : USGS/NGA GMTED2010 mean elevation 30 arc-second (mn30_grd), the SAME product, pixel-to-cell
         mapping and Horn slope (926.6 m baseline) as the baseline stack (src/data/ingestion/terrain.py::earth,
         imported unchanged for horn_slope and constants).
Output : per cell (361 x 576 grid; cell id = row*576 + col):
           n            valid 30" pixels with a defined slope
           mean_slope   mean Horn slope (check value: must equal the baseline slope_deg)
           frac_le_X    fraction of pixels with slope <= X deg, X in 2, 5, 10, 15, 20, 30
           p10/p50/p90  slope percentiles interpolated from a 0.25-deg histogram (resolution +-0.125 deg)
Not computed: connected flat areas inside a cell (would need per-pixel geometry); elevation percentiles.
"""
import hashlib, json, os, subprocess, sys, time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import terrain                       # unchanged baseline module

URL = "https://edcintl.cr.usgs.gov/downloads/sciweb1/shared/topo/downloads/GMTED/Grid_ZipFiles/mn30_grd.zip"
NB, BW = 360, 0.25                    # histogram: 0..90 deg in 0.25-deg bins
THR = (2, 5, 10, 15, 20, 30)


def main(out):
    import rasterio
    from rasterio.windows import Window
    os.makedirs(out, exist_ok=True)
    if not os.path.exists("mn30.zip"):
        subprocess.run(["curl", "-sSf", "-o", "mn30.zip", URL], check=True)
    zsha = hashlib.sha256(open("mn30.zip", "rb").read()).hexdigest()
    if not any(d == "mn30_grd" for _, ds_, _ in os.walk(".") for d in ds_):
        subprocess.run(["unzip", "-q", "-o", "mn30.zip"], check=True)
    grid = [os.path.join(r, d) for r, ds_, _ in os.walk(".") for d in ds_ if d == "mn30_grd"][0]
    ds = rasterio.open(grid)
    T = ds.transform; H, W = ds.height, ds.width; nod = ds.nodata
    NL, NO = terrain.NLAT, terrain.NLON
    lon_c = T.c + (np.arange(W) + 0.5) * T.a
    cj = np.rint((lon_c + 180) / 0.625).astype(int) % NO
    hist = np.zeros(NL * NO * NB, np.int32)
    ssum = np.zeros(NL * NO)
    step = 600
    t0 = time.time()
    for r0 in range(0, H, step):          # identical strip / halo logic to terrain.earth()
        r1 = min(H, r0 + step)
        a0, a1 = max(0, r0 - 1), min(H, r1 + 1)
        blk = ds.read(1, window=Window(0, a0, W, a1 - a0)).astype(np.float64)
        valid = blk != nod if nod is not None else np.ones_like(blk, bool)
        blk[~valid] = np.nan
        zz = np.concatenate([blk[:, -1:], blk, blk[:, :1]], axis=1)
        if a0 == r0:
            zz = np.concatenate([zz[:1], zz], 0)
        if a1 == r1:
            zz = np.concatenate([zz, zz[-1:]], 0)
        rows = np.arange(r0, r1)
        lat_c = T.f + (rows + 0.5) * T.e
        dx = terrain.BASE_M * np.cos(np.radians(lat_c))
        sl = terrain.horn_slope(zz, np.maximum(dx, 1.0), terrain.BASE_M)
        ci = np.clip(np.rint((lat_c + 90) / 0.5).astype(int), 0, NL - 1)
        cell = (ci[:, None] * NO + cj[None, :]).ravel()
        sf = sl.ravel(); ok = np.isfinite(sf)
        b = np.minimum((sf[ok] / BW).astype(np.int64), NB - 1)
        hist += np.bincount(cell[ok] * NB + b, minlength=NL * NO * NB).astype(np.int32)
        ssum += np.bincount(cell[ok], weights=sf[ok], minlength=NL * NO)
        print("rows", r1, H, round(time.time() - t0), flush=True)
    Hc = hist.reshape(NL * NO, NB).astype(np.float64)
    n = Hc.sum(1)
    cum = np.cumsum(Hc, 1)
    res = dict(n=n.astype(np.int32))
    with np.errstate(invalid="ignore", divide="ignore"):
        res["mean_slope"] = (ssum / n).astype(np.float32)
        for X in THR:
            res[f"frac_le_{X}"] = (cum[:, int(X / BW) - 1] / n).astype(np.float32)
        for q in (10, 50, 90):
            tgt = n * q / 100.0
            k = np.argmax(cum >= tgt[:, None], axis=1)
            prev = np.where(k > 0, cum[np.arange(len(k)), k - 1], 0.0)
            inbin = Hc[np.arange(len(k)), k]
            frac = np.where(inbin > 0, (tgt - prev) / np.maximum(inbin, 1), 0.0)
            v = (k + frac) * BW
            v[n == 0] = np.nan
            res[f"p{q}"] = v.astype(np.float32)
    meta = dict(source="GMTED2010 mn30 (USGS EROS)", url=URL, zip_sha256=zsha, crs=str(ds.crs), shape=[H, W],
                histogram_bin_deg=BW, thresholds_deg=list(THR), baseline_m=terrain.BASE_M,
                retrieved_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    np.savez_compressed(f"{out}/earth_subcell.npz", meta=json.dumps(meta), **res)
    print(json.dumps(meta))


if __name__ == "__main__":
    main(sys.argv[1])
