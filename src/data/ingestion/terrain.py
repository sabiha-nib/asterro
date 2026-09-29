"""Terrain predictors with ONE algorithm applied to Earth, Mars and the Moon.

Earth : USGS/NGA GMTED2010 mean elevation, 30 arc-second (mn30_grd), EGM96 heights.
Mars  : USGS Astrogeology MGS MOLA DEM mosaic, 463 m (Mars_MGS_MOLA_DEM_mosaic_global_463m.tif).
Moon  : USGS Astrogeology LRO LOLA global LDEM 118 m (Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif).

Per-pixel slope uses Horn's (1981) 3x3 finite-difference method on a ~926.6 m baseline
(GMTED 30" N-S spacing). Planetary DEMs are block-binned onto a local azimuthal-equidistant
grid of 926.6 m around the target so the baseline matches Earth. Per cell / window:
  elevation_m         = mean elevation
  slope_deg           = mean Horn slope
  surface_roughness_m = standard deviation of 926.6 m-baseline elevations in the cell/window
Earth cells are the NASA POWER / MERRA-2 cells (0.5 deg lat x 0.625 deg lon).
Planetary windows are 55.6 km x 55.6 km squares (= the N-S size of an Earth cell).
"""
import json, os, subprocess, sys, time
import numpy as np

NLAT, NLON = 361, 576
BASE_M = 6371007.2 * np.pi / 180 / 120        # 926.6 m: GMTED 30" N-S spacing on authalic sphere
WIN_M = 0.5 * 6371007.2 * np.pi / 180          # 55.6 km window side


def horn_slope(z, dx, dy):
    """Horn (1981) slope in degrees. z: 2-D array with 1-px halo. dx: per-row x spacing (m)."""
    a, b, c = z[:-2, :-2], z[:-2, 1:-1], z[:-2, 2:]
    d, f = z[1:-1, :-2], z[1:-1, 2:]
    g, h, i = z[2:, :-2], z[2:, 1:-1], z[2:, 2:]
    dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * dx[:, None])
    dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * dy)
    return np.degrees(np.arctan(np.hypot(dzdx, dzdy)))


def earth(path_grid):
    import rasterio
    from rasterio.windows import Window
    ds = rasterio.open(path_grid)
    T = ds.transform; H, W = ds.height, ds.width
    nod = ds.nodata
    lon_c = T.c + (np.arange(W) + 0.5) * T.a
    cj = np.rint((lon_c + 180) / 0.625).astype(int) % NLON
    S = {k: np.zeros(NLAT * NLON) for k in ["n", "ntot", "z", "z2", "s"]}
    step = 600
    for r0 in range(0, H, step):
        r1 = min(H, r0 + step)
        a0, a1 = max(0, r0 - 1), min(H, r1 + 1)
        blk = ds.read(1, window=Window(0, a0, W, a1 - a0)).astype(np.float64)
        valid = blk != nod if nod is not None else np.ones_like(blk, bool)
        blk[~valid] = np.nan
        # wrap-around halo in longitude
        zz = np.concatenate([blk[:, -1:], blk, blk[:, :1]], axis=1)
        top = 1 if a0 < r0 else 0
        if a0 == r0:
            zz = np.concatenate([zz[:1], zz], 0)
        if a1 == r1:
            zz = np.concatenate([zz, zz[-1:]], 0)
        rows = np.arange(r0, r1)
        lat_c = T.f + (rows + 0.5) * T.e
        dx = BASE_M * np.cos(np.radians(lat_c))
        sl = horn_slope(zz, np.maximum(dx, 1.0), BASE_M)
        z = blk[top:top + (r1 - r0)]
        ci = np.clip(np.rint((lat_c + 90) / 0.5).astype(int), 0, NLAT - 1)
        cell = (ci[:, None] * NLON + cj[None, :]).ravel()
        zf = z.ravel(); ok = np.isfinite(zf); sf = sl.ravel(); oks = ok & np.isfinite(sf)
        S["ntot"] += np.bincount(cell, minlength=NLAT * NLON)
        S["n"] += np.bincount(cell[ok], minlength=NLAT * NLON)
        S["z"] += np.bincount(cell[ok], weights=zf[ok], minlength=NLAT * NLON)
        S["z2"] += np.bincount(cell[ok], weights=zf[ok] ** 2, minlength=NLAT * NLON)
        S["s"] += np.bincount(cell[oks], weights=sf[oks], minlength=NLAT * NLON)
        print("earth rows", r1, H, flush=True)
    with np.errstate(invalid="ignore", divide="ignore"):
        n = S["n"]; mz = S["z"] / n
        out = dict(elevation_m=mz, slope_deg=S["s"] / n,
                   surface_roughness_m=np.sqrt(np.maximum(S["z2"] / n - mz ** 2, 0)),
                   land_fraction=n / np.maximum(S["ntot"], 1), n_pixels=n)
    return {k: v.reshape(NLAT, NLON).astype(np.float32) for k, v in out.items()}, dict(
        crs=str(ds.crs), transform=list(T)[:6], shape=[H, W], nodata=nod)


def planet_window(url, lat0, lon0, radius_m, rows_lat=None):
    """Read DEM pixels around (lat0, lon0) and bin to a 60x60 azimuthal-equidistant grid."""
    import rasterio
    from rasterio.windows import from_bounds
    ds = rasterio.open("/vsicurl/" + url)
    T = ds.transform
    deg_per_m = 180 / (np.pi * radius_m)
    half = WIN_M / 2
    if rows_lat is None:
        dlat = 1.6 * half * deg_per_m
        dlon = dlat / max(np.cos(np.radians(lat0)), 1e-3)
        win = from_bounds(np.radians(lon0 - dlon) * radius_m, np.radians(lat0 - dlat) * radius_m,
                          np.radians(lon0 + dlon) * radius_m, np.radians(lat0 + dlat) * radius_m, T)
    else:  # polar: full longitude span between rows_lat[0]..rows_lat[1]
        win = from_bounds(T.c, np.radians(rows_lat[0]) * radius_m, T.c + ds.width * T.a,
                          np.radians(rows_lat[1]) * radius_m, T)
    win = win.round_offsets().round_lengths()
    z = ds.read(1, window=win).astype(np.float64)
    nod = ds.nodata
    if nod is not None:
        z[z == nod] = np.nan
    scale, offset = float(ds.scales[0]), float(ds.offsets[0])   # LOLA LDEM: DN x 0.5 = m
    z = z * scale + offset
    wt = ds.window_transform(win)
    rr, cc = np.mgrid[0:z.shape[0], 0:z.shape[1]]
    x_m = wt.c + (cc + 0.5) * wt.a; y_m = wt.f + (rr + 0.5) * wt.e
    lon = np.degrees(x_m / radius_m); lat = np.degrees(y_m / radius_m)
    # azimuthal equidistant about (lat0, lon0)
    p0, l0 = np.radians(lat0), np.radians(lon0)
    p, l = np.radians(lat), np.radians(lon)
    cosc = np.clip(np.sin(p0) * np.sin(p) + np.cos(p0) * np.cos(p) * np.cos(l - l0), -1, 1)
    cang = np.arccos(cosc)
    k = np.where(cang > 1e-12, cang / np.maximum(np.sin(cang), 1e-12), 1.0)
    X = radius_m * k * np.cos(p) * np.sin(l - l0)
    Y = radius_m * k * (np.cos(p0) * np.sin(p) - np.sin(p0) * np.cos(p) * np.cos(l - l0))
    n = 60; halo = 1
    ix = np.floor((X + half) / BASE_M).astype(int) + halo
    iy = np.floor((half - Y) / BASE_M).astype(int) + halo
    m = (ix >= 0) & (ix < n + 2) & (iy >= 0) & (iy < n + 2) & np.isfinite(z)
    idx = iy[m] * (n + 2) + ix[m]
    cnt = np.bincount(idx, minlength=(n + 2) ** 2)
    sm = np.bincount(idx, weights=z[m], minlength=(n + 2) ** 2)
    with np.errstate(invalid="ignore", divide="ignore"):
        grid = (sm / cnt).reshape(n + 2, n + 2)
    sl = horn_slope(grid, np.full(n, BASE_M), BASE_M)
    core = grid[1:-1, 1:-1]
    res = dict(elevation_m=float(np.nanmean(core)), slope_deg=float(np.nanmean(sl)),
               surface_roughness_m=float(np.nanstd(core)),
               slope_p90_deg=float(np.nanpercentile(sl, 90)),
               elevation_min_m=float(np.nanmin(core)), elevation_max_m=float(np.nanmax(core)),
               bins_filled=int(np.isfinite(core).sum()), bins_total=n * n,
               source_pixels=int(m.sum()), window_km=WIN_M / 1000, baseline_m=BASE_M,
               dem_url=url, dem_crs=str(ds.crs), dem_pixel_m=abs(T.a), dem_scale=scale, dem_offset=offset,
               center_lat=lat0, center_lon=lon0)
    return res, core.astype(np.float32), sl.astype(np.float32)


def main(mode, out):
    if mode == "earth":
        url = "https://edcintl.cr.usgs.gov/downloads/sciweb1/shared/topo/downloads/GMTED/Grid_ZipFiles/mn30_grd.zip"
        subprocess.run(["curl", "-sSf", "-o", "mn30.zip", url], check=True)
        subprocess.run(["unzip", "-q", "-o", "mn30.zip"], check=True)
        grid = [os.path.join(r, d) for r, ds_, _ in os.walk(".") for d in ds_ if d == "mn30_grd"][0]
        arrs, meta = earth(grid)
        meta.update(source="GMTED2010 mn30 (USGS EROS)", url=url, baseline_m=BASE_M,
                    retrieved_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
        with open(out, "wb") as fh:
            np.savez_compressed(fh, meta=json.dumps(meta), **arrs)
    else:
        S3 = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/"
        res = {}
        mars, mz, ms = planet_window(S3 + "Mars_MGS_MOLA_DEM_mosaic_global_463m.tif",
                                     18.38, 77.58, 3396190.0)
        res["mars_jezero"] = mars
        moon, lz, ls = planet_window(S3 + "Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif",
                                     -90.0, 0.0, 1737400.0, rows_lat=(-90.0, -88.6))
        res["moon_south_pole"] = moon
        with open(out, "wb") as fh:
            np.savez_compressed(fh, meta=json.dumps(res), mars_z=mz, mars_slope=ms, moon_z=lz, moon_slope=ls)
        print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
