"""Phase II data products (additive; the baseline bundle public/data/stack.bin is not touched).

Writes public/data/phase2/:
  context.json        target-window terrain distributions (MOLA / LOLA 926.6 m bins), per-cell
                      MODIS yearly coverage summary layout, file checksums, scale ladder, and the
                      provenance manifest (copied from data/provenance/manifest.json).
  series.b64.txt      base64 of series.bin (valid cells only, same cell order as stack.bin):
                        t2m_monthly   int16  12 x n   0.01 degC   NASA POWER T2M monthly climatology 2001-2020
                        prec_monthly  int16  12 x n   0.01 mm/day NASA POWER PRECTOTCORR monthly climatology
                        modis_n_year  uint16 10 x n   count       valid MODIS pixel-months per year (coverage)
                        gmted_pixels  uint16  1 x n   count       GMTED2010 30" pixels inside the cell
Every value is copied from the checksummed raw inputs in data/raw/; nothing is interpolated,
resampled to a finer grid, or synthesised. Missing values are encoded as the documented fill
(-32768 for int16, 65535 for uint16).

    python scripts/build_phase2_data.py [repo]
"""
import base64, hashlib, json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.phase2 import catalog

NLAT, NLON = 361, 576


def sha(b):
    return hashlib.sha256(b).hexdigest()


def dist(a, bins):
    a = a[np.isfinite(a)]
    h, e = np.histogram(a, bins=bins)
    q = np.percentile(a, [10, 25, 50, 75, 90])
    return dict(n=int(a.size), mean=float(a.mean()), sd=float(a.std(ddof=1)), min=float(a.min()), max=float(a.max()),
                p10=float(q[0]), p25=float(q[1]), median=float(q[2]), p75=float(q[3]), p90=float(q[4]),
                hist=dict(edges=[float(x) for x in e], counts=[int(x) for x in h]))


def main(repo="."):
    raw = os.path.join(repo, "data/raw")
    out_dir = os.path.join(repo, "public/data/phase2")
    os.makedirs(out_dir, exist_ok=True)
    stack = np.load(os.path.join(repo, "data/predictor_stack.npz"))
    valid = stack["valid"]
    ii, jj = np.nonzero(valid)
    cell = (ii * NLON + jj).astype(np.int64)
    info = json.load(open(os.path.join(repo, "data/metadata/stack_build.json")))
    lay = {L["name"]: L for L in info["layout"]}
    buf = open(os.path.join(repo, "public/data/stack.bin"), "rb").read()
    web_cell = np.frombuffer(buf, dtype="uint32", count=lay["cell"]["length"], offset=lay["cell"]["offset"]).astype(np.int64)
    assert np.array_equal(web_cell, cell), "valid-cell order differs from stack.bin"

    P = np.load(os.path.join(raw, "power_climatology.npz"))
    M = np.load(os.path.join(raw, "modis_lst.npz"))
    T = np.load(os.path.join(raw, "terrain_earth.npz"))
    TP = np.load(os.path.join(raw, "terrain_planets.npz"))
    tmeta = json.loads(str(TP["meta"]))

    def i16(a, scale):
        v = a[:, ii, jj] if a.ndim == 3 else a[ii, jj][None]
        return np.where(np.isfinite(v), np.round(v / scale), -32768).astype("<i2")

    def u16(a):
        v = a[:, ii, jj] if a.ndim == 3 else a[ii, jj][None]
        return np.where(np.isfinite(v), np.clip(np.round(v), 0, 65534), 65535).astype("<u2")

    blocks, layout, off = [], [], 0

    def add(name, arr, scale, unit, fill, source):
        nonlocal off
        b = np.ascontiguousarray(arr).tobytes()
        pad = (-off) % 4
        if pad:
            blocks.append(b"\0" * pad); off += pad
        layout.append(dict(name=name, dtype=str(arr.dtype.name), offset=off, length=int(arr.size), shape=list(arr.shape),
                           scale=scale, unit=unit, fill=fill, source=source))
        blocks.append(b); off += len(b)

    add("t2m_monthly", i16(P["T2M"][:12].astype(np.float64), 0.01), 0.01, "degC", -32768,
        "NASA POWER Climatology API v2.10.0 (MERRA-2) T2M, monthly climatology 2001-2020")
    add("prec_monthly", i16(P["PRECTOTCORR"][:12].astype(np.float64), 0.01), 0.01, "mm/day", -32768,
        "NASA POWER Climatology API v2.10.0 (MERRA-2) PRECTOTCORR, monthly climatology 2001-2020")
    add("modis_n_year", u16(M["n_year"].astype(np.float64)), 1, "pixel-months", 65535,
        "NASA GIBS MODIS Aqua monthly LST decode: valid 0.1-degree pixel-months per cell and year")
    add("gmted_pixels", u16(T["n_pixels"].astype(np.float64)), 1, "pixels", 65535,
        "GMTED2010 mn30 30-arc-second pixels aggregated into the cell")
    series = b"".join(blocks)
    b64 = base64.b64encode(series)
    open(os.path.join(out_dir, "series.b64.txt"), "wb").write(b64)

    bins_slope = np.arange(0, 42, 2.0)
    targets = {}
    for key, tid in (("mars", "mars_jezero"), ("moon", "moon_south_pole")):
        m = tmeta[tid]
        z = TP[key + "_z"].astype(np.float64); s = TP[key + "_slope"].astype(np.float64)
        targets[tid] = dict(
            window_km=m["window_km"], baseline_m=m["baseline_m"], bins=f"{z.shape[0]} x {z.shape[1]}",
            dem=m["dem_url"], dem_pixel_m=m["dem_pixel_m"], source_pixels=m["source_pixels"],
            slope_deg=dist(s, bins_slope),
            elevation_m=dist(z, 24),
            note="Distribution over the 926.6 m bins of the 55.6 km target window used to build the target "
                 "slope and roughness values (target slope = mean of these bins; roughness = SD of bin elevations).")

    # MEDA TIRS ground temperature at the MODIS-matched local times, per sol (equal sol weights)
    meda = json.load(open(os.path.join(raw, "mars_meda.json")))
    rows = []
    for p in meda["per_sol"]:
        if not p.get("tirs") or not p.get("ground_n"):
            continue
        g, n = p["ground_sum"], p["ground_n"]
        if n[13] > 0 and n[1] > 0:
            rows.append(dict(sol=p["sol"], ls=p.get("ls"), t13=g[13] / n[13], t01=g[1] / n[1]))
    t13 = np.array([r["t13"] for r in rows]); t01 = np.array([r["t01"] for r in rows]); dT = t13 - t01
    meda_abs = dict(sols=len(rows), t13_mean_K=float(t13.mean()), t01_mean_K=float(t01.mean()),
                    dT_per_sol=dict(mean=float(dT.mean()), sd=float(dT.std(ddof=1)), p10=float(np.percentile(dT, 10)),
                                    p90=float(np.percentile(dT, 90)), min=float(dT.min()), max=float(dT.max())),
                    per_sol=[dict(sol=r["sol"], ls=round(r["ls"], 3) if r["ls"] is not None else None,
                                  dT=round(r["t13"] - r["t01"], 3)) for r in rows],
                    method="Per sol: mean TIRS ground temperature in LTST hour 13 (13:00-14:00) minus hour 1 "
                           "(01:00-02:00), sols with both hours present; equal weight per sol (the target value "
                           "itself uses equal weight per Ls bin).",
                    source="data/raw/mars_meda.json (PDS Mars 2020 MEDA CAL_TIRS)")

    manifest_path = os.path.join(repo, "data/provenance/manifest.json")
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else None
    ctx = dict(
        product="ASTERRO Phase II context data", generated_by="scripts/build_phase2_data.py",
        stack_sha256=info["sha256"], n_cells=int(cell.size),
        series=dict(file="series.b64.txt", bytes=len(series), sha256=sha(series), layout=layout,
                    encoding="base64 of little-endian binary; valid cells in stack.bin order"),
        modis_years=[int(y) for y in M["years"]],
        modis_quantisation_K=float(json.loads(str(M["meta"]))["quantisation_K"]),
        modis_pixel_deg=float(json.loads(str(M["meta"]))["pixel_deg"]),
        target_windows=targets,
        meda_ground=meda_abs,
        catalog=dict(requirement_variables=catalog.REQUIREMENT_VARIABLES, missing_factors=catalog.MISSING_FACTORS,
                     activities=catalog.ACTIVITIES, uncertainty_sources=catalog.UNCERTAINTY_SOURCES, scales=catalog.SCALES),
        manifest=manifest,
        manifest_sha256=sha(open(manifest_path, "rb").read()) if manifest else None,
    )
    open(os.path.join(out_dir, "context.json"), "w").write(json.dumps(ctx, indent=1))
    print("series.bin", len(series), "bytes sha", sha(series)[:16], "| context.json written | b64", len(b64))


if __name__ == "__main__":
    main(*sys.argv[1:])
