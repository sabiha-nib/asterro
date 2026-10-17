"""Offline regeneration of target fingerprints from retained inputs (readiness check L4.offline_regeneration).

Each function recomputes DIRECT values WITHOUT network access, from inputs retained in the repository:
  terrain   window statistics from the checksummed 926.6 m grids (data/raw/phase3/terrain/*.npz;
            legacy targets: data/raw/terrain_planets.npz) — the DEM-to-grid binning itself needs the network job;
  REMS      the unchanged baseline aggregate() over the 306 retained per-sol files (data/raw/phase3/rems);
  MEDA      the unchanged baseline aggregate() over data/raw/mars_meda.json (legacy Jezero);
  Diviner   polar: the window selection is recomputed from the retained grid coordinates and compared with the
            retained index set, then the seasonal means are recomputed from the retained source values;
            GCP: every retained HTTP range read is checked against its recorded SHA-256, re-parsed, and the
            per-bin and window means are recomputed.
A regeneration either matches within the stated tolerance or fails; it never patches a value.
"""
import glob, hashlib, json, math, os, sys, types
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
for p in ("src/phase3/pipeline", "src/data/ingestion", "src/phase3"):
    q = os.path.join(ROOT, p)
    if q not in sys.path:
        sys.path.insert(0, q)
sys.modules.setdefault("requests", types.ModuleType("requests"))
RAW3 = os.path.join(ROOT, "data/raw/phase3")
RAW4 = os.path.join(ROOT, "data/raw/phase4/support")
TOL = {"slope": 1e-5, "surface_roughness": 1e-3, "lst_diurnal_range": 1e-6, "annual_temperature_range": 1e-9}
LEGACY_TOL = {"slope": 5e-4, "surface_roughness": 5e-2, "lst_diurnal_range": 5e-4, "annual_temperature_range": 5e-4}   # targets.json rounding


def terrain_from_grid(z, slope):
    z = z.astype(np.float64); sl = slope.astype(np.float64)
    return {"slope": float(np.nanmean(sl)), "surface_roughness": float(np.nanstd(z))}


def regen_terrain(tid):
    if tid in ("mars_jezero", "moon_south_pole"):
        d = np.load(os.path.join(ROOT, "data/raw/terrain_planets.npz"))
        k = "mars" if tid == "mars_jezero" else "moon"
        return terrain_from_grid(d[k + "_z"], d[k + "_slope"]), "data/raw/terrain_planets.npz grids (baseline)"
    d = np.load(os.path.join(RAW3, f"terrain/{tid}.npz"))
    return terrain_from_grid(d["z"], d["slope"]), f"data/raw/phase3/terrain/{tid}.npz grids"


def regen_rems():
    import rems_gale, mars_meda
    sols = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(RAW3, "rems/sol_*.json")))]
    r = mars_meda.aggregate(rems_gale.variant(sols, "ground", "air"))
    return {"lst_diurnal_range": r["lst_diurnal_range_K"], "annual_temperature_range": r["annual_temperature_range_K"]}, f"{len(sols)} retained REMS per-sol files"


def regen_meda():
    import mars_meda
    m = json.load(open(os.path.join(ROOT, "data/raw/mars_meda.json")))
    r = mars_meda.aggregate(m["per_sol"])
    return {"lst_diurnal_range": r["lst_diurnal_range_K"], "annual_temperature_range": r["annual_temperature_range_K"]}, f"{len(m['per_sol'])} retained MEDA per-sol records"


def regen_polar(tid, lat0, lon0):
    import build_atlas as BA, terrain
    p = os.path.join(RAW4, f"polar_{tid}.npz")
    if not os.path.exists(p):
        return None, "retained Diviner polar values not present"
    d = np.load(p)
    hemi = str(d["hemi"]); half = terrain.WIN_M / 2
    X1, Y1 = np.meshgrid(d["x"], d["y"])
    if tid == "moon_south_pole":
        hh = half / 1000 / 1737.4
        sel = (np.abs(X1) <= hh) & (np.abs(Y1) <= hh)
    else:
        lat, lon = BA.polar_lonlat(X1, Y1, hemi)
        X, Y = BA.ae(lat0, lon0, lat, lon, 1737400.0)
        sel = (np.abs(X) <= half) & (np.abs(Y) <= half)
    idx = np.flatnonzero(sel.ravel())
    if not np.array_equal(idx, d["idx"]):
        return None, "window selection recomputed from the grid coordinates differs from the retained index set"
    means = []
    for s in ("summer", "winter"):
        a14, a02 = d[f"{s}_14"].astype(np.float64), d[f"{s}_02"].astype(np.float64)
        ok = np.isfinite(a14) & np.isfinite(a02)
        means.append(float((a14[ok] - a02[ok]).mean()))
    return {"lst_diurnal_range": float(np.mean(means))}, f"{idx.size} retained Diviner polar bins × 4 maps; selection re-derived"


_GCP = None


def _gcp_reads():
    global _GCP
    if _GCP is None:
        p = os.path.join(RAW4, "gcp_raw.npz")
        if not os.path.exists(p):
            _GCP = {}
            return _GCP
        d = np.load(p); raw = d["raw"].tobytes(); out = {}
        for e in json.loads(str(d["index"])):
            b = raw[e["offset"]:e["offset"] + e["length"]]
            if hashlib.sha256(b).hexdigest() != e["sha256"]:
                raise ValueError("retained GCP read fails its recorded SHA-256: " + e["key"])
            out[e["key"]] = b
        _GCP = out
    return _GCP


def regen_gcp(lat0, lon0):
    import build_atlas as BA, terrain
    reads = _gcp_reads()
    if not reads:
        return None, "retained Diviner GCP reads not present"
    half = terrain.WIN_M / 2
    lats = np.arange(-89.75, 90, 0.5); lons = np.arange(-179.75, 180, 0.5)
    LA, LO = np.meshgrid(lats, lons, indexing="ij")
    near = np.abs(LA - lat0) < 2.5
    X, Y = BA.ae(lat0, lon0, LA[near], LO[near], 1737400.0)
    sel = (np.abs(X) <= half) & (np.abs(Y) <= half)
    dts = []
    for la, lo_ in zip(LA[near][sel], LO[near][sel]):
        lo = int(math.floor(la / 10) * 10)
        ilat = int(round((la - lo - 0.25) / 0.5)); ilon = int(round((lo_ + 179.75) / 0.5))
        key = f"{BA.GCP + BA.band_name(lo, lo + 10)}#{ilon},{ilat}"
        if key not in reads:
            return None, "a window bin has no retained read: " + key
        rows = [l.split(",") for l in reads[key].decode().split("\r\n") if l.strip()]
        A = np.array([[float(v) for v in row] for row in rows])
        tb = np.where(A[:, 10] <= -9998, np.nan, A[:, 10]); lt = A[:, 2]
        d14 = tb[(lt > 13) & (lt < 14)]; d02 = tb[(lt > 1) & (lt < 2)]
        if np.isfinite(d14).sum() >= 2 and np.isfinite(d02).sum() >= 2:
            dts.append(float(np.nanmean(d14)) - float(np.nanmean(d02)))
    return ({"lst_diurnal_range": float(np.mean(dts))} if dts else {"lst_diurnal_range": None}), f"{int(sel.sum())} bins from retained, checksum-verified GCP reads"


def regenerate(t, legacy=False):
    """t: atlas target (values, status, thermal source, anchor). Returns the regeneration record."""
    tid = t["id"]; direct = [c for c, s in t["status"].items() if s == "DIRECT"]
    vals, notes = {}, []
    v, n = regen_terrain(tid); vals.update(v); notes.append(n)
    src = (t.get("thermal") or {}).get("source")
    if tid == "mars_jezero":
        v, n = regen_meda(); vals.update(v); notes.append(n)
    elif tid == "mars_gale_curiosity":
        v, n = regen_rems(); vals.update(v); notes.append(n)
    elif tid == "moon_south_pole" or src == "diviner_polar":
        v, n = regen_polar(tid, t["anchor"]["lat"], t["anchor"]["lon"]); notes.append(n)
        if v: vals.update(v)
    elif src == "diviner_gcp":
        v, n = regen_gcp(t["anchor"]["lat"], t["anchor"]["lon"]); notes.append(n)
        if v: vals.update(v)
    tol = LEGACY_TOL if legacy else TOL
    crit = {}
    for c in direct:
        want = t["values"][c]
        got = vals.get(c)
        ok = got is not None and want is not None and abs(got - want) <= tol[c]
        crit[c] = dict(published=want, regenerated=got, abs_diff=None if got is None else abs(got - want), tolerance=tol[c], passed=bool(ok))
    passed = bool(crit) and all(x["passed"] for x in crit.values()) and set(direct) <= set(crit)
    fails = [c for c, x in crit.items() if not x["passed"]]
    return dict(passed=passed, criteria=crit, inputs=notes,
                summary=("all DIRECT values regenerated offline" if passed else "not regenerated: " + ", ".join(fails or ["no inputs"])))
