"""Build the Earth predictor stack on the NASA POWER / MERRA-2 grid (0.5 deg x 0.625 deg).

Inputs (produced by src/data/ingestion/*):
  power_climatology.npz  NASA POWER climatology 2001-2020 (T2M, T2M_MAX_AVG, T2M_MIN_AVG, PRECTOTCORR, TOA_SW_DWN)
  terrain_earth.npz      GMTED2010 30" -> elevation, Horn slope, roughness, land fraction
  modis_lst.npz          MODIS Aqua monthly LST day/night 2016-2025 -> diurnal range
Outputs:
  data/predictor_stack.zarr   (when the `zarr` package is available)
  data/predictor_stack.npz    (always; identical float32 arrays)
  public/data/stack.bin + stack.json   compact valid-cell bundle for the web client

Derived variables
  aridity = P_ann / PET_ann, saturated at 1. PET = Hargreaves (1985):
      PET_m [mm/day] = 0.0023 * Ra_m * (T_m + 17.8) * sqrt(Tmax_m - Tmin_m), Ra in mm/day
      Ra = extraterrestrial radiation, FAO-56 (Allen et al. 1998) eqs. 21-25, evaluated on the 15th
      of each month at the cell-centre latitude, converted MJ m-2 day-1 -> mm/day by x 0.408.
      (POWER TOA_SW_DWN was also retrieved but lives on POWER's 1-degree CERES grid, so it is
      missing on ~69 % of MERRA-2 cell centres; it is not used.)
      Hargreaves is undefined when T_m < -17.8 C in every month (PET_ann == 0): aridity is then
      MISSING (NaN), never invented.
  annual_temperature_range = max_m T2M - min_m T2M   [K]
Valid cell = land in GMTED2010 (>= 50 % valid 30" pixels) AND finite MODIS LST diurnal range
             AND finite POWER T2M.
"""
import hashlib, json, os, sys
import numpy as np

NLAT, NLON = 361, 576
LAT = np.round(-90 + 0.5 * np.arange(NLAT), 4)
LON = np.round(-180 + 0.625 * np.arange(NLON), 4)
DAYS = np.array([31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])
CRIT = ["aridity", "annual_temperature_range", "elevation", "slope", "surface_roughness", "lst_diurnal_range"]


def fao56_ra(lat_deg):
    """Extraterrestrial radiation Ra [MJ m-2 day-1], shape (12, NLAT), FAO-56 eqs. 21-25, day 15 of month."""
    doy = np.array([15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349], float)
    phi = np.radians(lat_deg)[None, :]
    dr = 1 + 0.033 * np.cos(2 * np.pi * doy / 365)[:, None]
    dec = 0.409 * np.sin(2 * np.pi * doy / 365 - 1.39)[:, None]
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(dec), -1, 1))
    return 24 * 60 / np.pi * 0.0820 * dr * (ws * np.sin(phi) * np.sin(dec) + np.cos(phi) * np.cos(dec) * np.sin(ws))


def modis_pixels_per_cell():
    plat = 89.95 - 0.1 * np.arange(1800); plon = -179.95 + 0.1 * np.arange(3600)
    ci = np.clip(np.rint((plat + 90) / 0.5).astype(int), 0, NLAT - 1)
    cj = np.rint((plon + 180) / 0.625).astype(int) % NLON
    cell = (ci[:, None] * NLON + cj[None, :]).ravel()
    return np.bincount(cell, minlength=NLAT * NLON).reshape(NLAT, NLON)


def build(raw):
    P = np.load(os.path.join(raw, "power_climatology.npz"))
    T = np.load(os.path.join(raw, "terrain_earth.npz"))
    M = np.load(os.path.join(raw, "modis_lst.npz"))
    t2m, tmax, tmin = P["T2M"][:12].astype(np.float64), P["T2M_MAX_AVG"][:12].astype(np.float64), P["T2M_MIN_AVG"][:12].astype(np.float64)
    prec = P["PRECTOTCORR"][:12].astype(np.float64)
    ra = np.repeat(fao56_ra(LAT)[:, :, None], NLON, axis=2)
    pet_m = 0.0023 * (ra * 0.408) * np.maximum(t2m + 17.8, 0) * np.sqrt(np.maximum(tmax - tmin, 0))
    pet_ann = np.tensordot(DAYS, pet_m, axes=1)
    p_ann = np.tensordot(DAYS, prec, axes=1)
    with np.errstate(invalid="ignore", divide="ignore"):
        ai = np.where(pet_ann > 0, p_ann / pet_ann, np.nan)
    aridity = np.minimum(ai, 1.0)
    atr = t2m.max(0) - t2m.min(0)

    land = T["land_fraction"] >= 0.5
    dr = M["dr_clim"].astype(np.float64)
    valid = land & np.isfinite(dr) & np.isfinite(t2m).all(0)
    ppc = modis_pixels_per_cell()
    modis_cov = np.clip(M["n_clim"] / (ppc * 12 * len(M["years"])), 0, 1)

    grid = dict(aridity=aridity, annual_temperature_range=atr, elevation=T["elevation_m"].astype(np.float64),
                slope=T["slope_deg"].astype(np.float64), surface_roughness=T["surface_roughness_m"].astype(np.float64),
                lst_diurnal_range=dr)
    aux = dict(t2m_mean_c=t2m.mean(0), precip_mm_yr=p_ann, pet_mm_yr=pet_ann, aridity_index_raw=ai,
               lst_day_k=M["day_clim"].astype(np.float64), lst_night_k=M["night_clim"].astype(np.float64),
               modis_coverage=modis_cov, gmted_land_fraction=T["land_fraction"].astype(np.float64))
    out = {k: np.where(valid, v, np.nan).astype(np.float32) for k, v in {**grid, **aux}.items()}
    out["lst_diurnal_range_yearly"] = np.where(valid[None], M["dr_year"], np.nan).astype(np.float32)
    out["valid"] = valid
    meta = dict(power=json.loads(str(P["meta"])), terrain=json.loads(str(T["meta"])), modis=json.loads(str(M["meta"])),
                years=[int(y) for y in M["years"]])
    return out, meta


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def _zarr_arrays(out):
    arrs = [("latitude", LAT.astype(np.float32), (NLAT,), {"_ARRAY_DIMENSIONS": ["latitude"], "units": "degrees_north"}),
            ("longitude", LON.astype(np.float32), (NLON,), {"_ARRAY_DIMENSIONS": ["longitude"], "units": "degrees_east"})]
    for k, v in out.items():
        data = v.astype(np.uint8) if k == "valid" else v
        dims = ["year", "latitude", "longitude"] if data.ndim == 3 else ["latitude", "longitude"]
        arrs.append((k, data, (1, 181, 288) if data.ndim == 3 else (181, 288), {"_ARRAY_DIMENSIONS": dims}))
    return arrs


def write_zarr(out, meta, path):
    """Zarr v2 store. Uses zarr-python when installed, otherwise the built-in spec writer (zarr_v2.py).
    Returns the writer used."""
    attrs = dict(title="ASTERRO Planetary Analogue Intelligence - Earth predictor stack",
                 grid="NASA POWER / MERRA-2 native, lat -90..90 step 0.5, lon -180..179.375 step 0.625",
                 crs="EPSG:4326 (cell centres)", conventions="NaN = invalid or missing", provenance=meta)
    try:
        import zarr
    except ImportError:
        from .zarr_v2 import write_group
        write_group(path, _zarr_arrays(out), json.loads(json.dumps(attrs)))
        return "builtin-zarr-v2"
    import shutil
    shutil.rmtree(path, ignore_errors=True)
    major = int(zarr.__version__.split(".")[0])
    root = zarr.open_group(path, mode="w", zarr_format=2) if major >= 3 else zarr.open_group(path, mode="w")
    root.attrs.update(json.loads(json.dumps(attrs)))
    for name, data, chunks, a in _zarr_arrays(out):
        arr = root.create_array(name, data=data, chunks=chunks) if major >= 3 else root.array(name, data, chunks=chunks)
        arr.attrs.update(a)
    zarr.consolidate_metadata(path)
    return f"zarr-python {zarr.__version__}"


def web_bundle(out, meta, outdir, labels=None):
    """Valid cells only. Criteria float32 (exact stack values); auxiliaries float32; yearly LST int16 (0.01 K)."""
    os.makedirs(outdir, exist_ok=True)
    ii, jj = np.nonzero(out["valid"])
    cell = (ii * NLON + jj).astype(np.uint32)
    blocks, layout, off = [], [], 0

    def add(name, arr, dtype, scale=None):
        nonlocal off
        a = np.ascontiguousarray(arr.astype(dtype))
        pad = (-off) % 4
        if pad:
            blocks.append(b"\0" * pad); off += pad
        blocks.append(a.tobytes())
        layout.append(dict(name=name, dtype=np.dtype(dtype).name, offset=off, length=int(a.size),
                           shape=list(a.shape), scale=scale))
        off += a.nbytes

    add("cell", cell, np.uint32)
    for k in CRIT + ["t2m_mean_c", "precip_mm_yr", "pet_mm_yr", "aridity_index_raw", "lst_day_k", "lst_night_k",
                     "modis_coverage", "gmted_land_fraction"]:
        add(k, out[k][ii, jj], np.float32)
    yr = out["lst_diurnal_range_yearly"][:, ii, jj]
    add("lst_diurnal_range_yearly", np.where(np.isfinite(yr), np.round(yr * 100), -32768), np.int16, scale=0.01)
    if labels is not None:
        add("country", labels["country_idx"][ii, jj], np.int16)
        add("region", labels["region_idx"][ii, jj], np.int16)
    binpath = os.path.join(outdir, "stack.bin")
    with open(binpath, "wb") as f:
        for b in blocks:
            f.write(b)
    return dict(n_cells=int(cell.size), layout=layout, bytes=off, sha256=sha(binpath),
                grid=dict(nlat=NLAT, nlon=NLON, lat0=-90.0, dlat=0.5, lon0=-180.0, dlon=0.625),
                years=meta["years"])


def main(raw="data/raw", repo="."):
    out, meta = build(raw)
    np.savez_compressed(os.path.join(repo, "data/predictor_stack.npz"), **out)
    z = write_zarr(out, meta, os.path.join(repo, "data/predictor_stack.zarr"))
    labels = None
    lp = os.path.join(raw, "labels.npz")
    if os.path.exists(lp):
        labels = np.load(lp)
    info = web_bundle(out, meta, os.path.join(repo, "public/data"), labels)
    info["zarr_written"] = z
    info["provenance"] = meta
    json.dump(info, open(os.path.join(repo, "data/metadata/stack_build.json"), "w"), indent=1)
    v = out["valid"]
    print("valid cells", int(v.sum()), "zarr", z, "bundle bytes", info["bytes"], info["sha256"])
    for k in CRIT:
        a = out[k][v]
        print(f"{k:26s} finite={np.isfinite(a).mean():.4f} min={np.nanmin(a):9.3f} p50={np.nanmedian(a):9.3f} max={np.nanmax(a):9.3f}")


if __name__ == "__main__":
    main(*sys.argv[1:])
