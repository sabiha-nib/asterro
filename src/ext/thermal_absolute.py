"""Thermal-extremes extension (tai-ext-thermal-1.0.0): absolute surface temperatures by day and by night, and the
mean near-surface air temperature, for Earth cells and planetary targets — computed offline from inputs already
retained in this repository. Nothing here is downloaded, estimated or filled in.

Why these three quantities. The baseline thermal criterion is the day-minus-night difference (lst_diurnal_range).
A difference hides the level: a 70 K swing between 290 K and 220 K is a different environment from a 70 K swing
between 190 K and 120 K. The extension keeps the baseline and adds the two levels behind it, at the same local
times, plus the air temperature where an atmosphere exists.

Definitions (each identical in construction to the baseline difference it decomposes):
  surface_temp_day    [K]  surface (ground / skin / bolometric) temperature at ~13:30 local solar time
      Earth : MODIS Aqua monthly daytime LST climatology 2016-2025 (overpass ~13:30)   -> stack auxiliary lst_day_k
      Mars  : Mars 2020 MEDA TIRS (Jezero) / MSL REMS GTS (Gale) ground temperature, 13-14 LTST hour bin
              per sol -> mean per 30-deg Ls bin -> mean over Ls bins; only sols that also have the 01-02 bin,
              exactly the sols behind the baseline difference
      Moon  : LRO Diviner bolometric temperature, hour 14 (polar level-4 maps: mean of the summer and winter window
              means; GCP: window mean of per-bin 13-14 h means), over the bins that also have hour 02
  surface_temp_night  [K]  the same at ~01:30 (MODIS Aqua night; MEDA/REMS 01-02 LTST; Diviner hour 02)
      By construction day - night reproduces each target's published lst_diurnal_range (tested).
  mean_air_temperature [K] mean near-surface air temperature
      Earth : NASA POWER T2M (2 m), mean of the 12 monthly climatology values 2001-2020 -> stack t2m_mean_c + 273.15
      Mars  : MEDA ATS (~1.45 m) / REMS ATS boom, mean of the 12 Ls-bin diurnal means (the baseline's own bins)
      Moon  : NOT APPLICABLE — no atmosphere, no air temperature (never 0, never estimated)

Limits recorded with the values: MODIS LST is clear-sky only and an emissivity-corrected skin temperature; MEDA/REMS
are point measurements by one rover in one Mars year; Diviner values are window means of bolometric brightness
temperature; the Earth air temperature is a reanalysis at 2 m, the Mars air temperature an in-situ sensor at
~1.5 m. Local time, not season, is matched; seasonal sampling differs between bodies.
"""
import glob, hashlib, json, math, os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "src", "registry"))
sys.path.insert(0, ROOT)
from src.registry import verify as V          # reuses the offline readers and the window geometry, unchanged

VERSION = "tai-ext-thermal-1.0.0"
DIMS = ["surface_temp_day", "surface_temp_night", "mean_air_temperature"]


def _mars(per_sol):
    """per-sol hourly ground/air sums -> (day, night, air) with the baseline's binning (mars_meda.aggregate)."""
    import mars_meda
    bins = {b: dict(d=[], n=[]) for b in range(12)}
    for o in per_sol:
        if o.get("ls") is None or "ground_n" not in o:
            continue
        gs, gn = np.array(o["ground_sum"]), np.array(o["ground_n"])
        if gn[13] > 0 and gn[1] > 0:
            b = int(o["ls"] // 30) % 12
            bins[b]["d"].append(gs[13] / gn[13]); bins[b]["n"].append(gs[1] / gn[1])
    used = [b for b in range(12) if bins[b]["d"]]
    day = float(np.mean([np.mean(bins[b]["d"]) for b in used])) if used else None
    night = float(np.mean([np.mean(bins[b]["n"]) for b in used])) if used else None
    agg = mars_meda.aggregate(per_sol)
    air = [t["air_diurnal_mean_K"] for t in agg["bins"] if t["air_diurnal_mean_K"] is not None]
    return dict(surface_temp_day=day, surface_temp_night=night,
                mean_air_temperature=float(np.mean(air)) if len(air) == 12 else None,
                check_dr=agg["lst_diurnal_range_K"], ls_bins_ground=len(used), ls_bins_air=len(air))


def mars_jezero():
    m = json.load(open(os.path.join(ROOT, "data/raw/mars_meda.json")))
    r = _mars(m["per_sol"]); r["inputs"] = f"{len(m['per_sol'])} retained MEDA per-sol records (data/raw/mars_meda.json)"
    return r


def mars_gale():
    import rems_gale
    sols = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(V.RAW3, "rems/sol_*.json")))]
    r = _mars(rems_gale.variant(sols, "ground", "air")); r["inputs"] = f"{len(sols)} retained REMS per-sol files (data/raw/phase3/rems)"
    return r


def moon_polar(tid, lat0, lon0):
    import build_atlas as BA, terrain
    p = os.path.join(V.RAW4, f"polar_{tid}.npz")
    d = np.load(p); hemi = str(d["hemi"]); half = terrain.WIN_M / 2
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
        raise ValueError(tid + ": window selection differs from the retained index set")
    day, night, dr = [], [], []
    for s in ("summer", "winter"):
        a14, a02 = d[f"{s}_14"].astype(np.float64), d[f"{s}_02"].astype(np.float64)
        ok = np.isfinite(a14) & np.isfinite(a02)
        day.append(float(a14[ok].mean())); night.append(float(a02[ok].mean())); dr.append(float((a14[ok] - a02[ok]).mean()))
    return dict(surface_temp_day=float(np.mean(day)), surface_temp_night=float(np.mean(night)), mean_air_temperature=None,
                check_dr=float(np.mean(dr)), inputs=f"{idx.size} retained Diviner polar bins x 4 maps ({os.path.relpath(p, ROOT)})")


def moon_gcp(lat0, lon0):
    import build_atlas as BA, terrain
    reads = V._gcp_reads()
    half = terrain.WIN_M / 2
    lats = np.arange(-89.75, 90, 0.5); lons = np.arange(-179.75, 180, 0.5)
    LA, LO = np.meshgrid(lats, lons, indexing="ij")
    near = np.abs(LA - lat0) < 2.5
    X, Y = BA.ae(lat0, lon0, LA[near], LO[near], 1737400.0)
    sel = (np.abs(X) <= half) & (np.abs(Y) <= half)
    d14s, d02s = [], []
    for la, lo_ in zip(LA[near][sel], LO[near][sel]):
        lo = int(math.floor(la / 10) * 10)
        ilat = int(round((la - lo - 0.25) / 0.5)); ilon = int(round((lo_ + 179.75) / 0.5))
        key = f"{BA.GCP + BA.band_name(lo, lo + 10)}#{ilon},{ilat}"
        rows = [l.split(",") for l in reads[key].decode().split("\r\n") if l.strip()]
        A = np.array([[float(v) for v in row] for row in rows])
        tb = np.where(A[:, 10] <= -9998, np.nan, A[:, 10]); lt = A[:, 2]
        d14 = tb[(lt > 13) & (lt < 14)]; d02 = tb[(lt > 1) & (lt < 2)]
        if np.isfinite(d14).sum() >= 2 and np.isfinite(d02).sum() >= 2:      # the baseline's own inclusion rule
            d14s.append(float(np.nanmean(d14))); d02s.append(float(np.nanmean(d02)))
    return dict(surface_temp_day=float(np.mean(d14s)), surface_temp_night=float(np.mean(d02s)), mean_air_temperature=None,
                check_dr=float(np.mean(np.array(d14s) - np.array(d02s))), inputs=f"{len(d14s)} Diviner GCP bins from retained, checksum-verified reads")


def targets():
    atlas = json.load(open(os.path.join(ROOT, "public/data/phase3/atlas.json")))
    reg = {t["id"]: t for t in json.load(open(os.path.join(ROOT, "public/data/registry.json")))["targets"]}
    out = {}
    for t in atlas["targets"]:
        tid = t["id"]; src = (t.get("thermal") or {}).get("source")
        if tid not in reg or reg[tid]["fingerprint"]["criterion_status"].get("lst_diurnal_range") != "DIRECT":
            continue
        if tid == "mars_jezero":
            r = mars_jezero()
        elif tid == "mars_gale_curiosity":
            r = mars_gale()
        elif tid == "moon_south_pole" or src == "diviner_polar":
            r = moon_polar(tid, t["anchor"]["lat"], t["anchor"]["lon"])
        elif src == "diviner_gcp":
            r = moon_gcp(t["anchor"]["lat"], t["anchor"]["lon"])
        else:
            continue
        pub = reg[tid]["fingerprint"]["variables"]["lst_diurnal_range"]
        r["published_lst_diurnal_range"] = pub
        r["body"] = reg[tid]["body"]["id"] if isinstance(reg[tid]["body"], dict) else reg[tid]["body"]
        r["status"] = {"surface_temp_day": "DIRECT", "surface_temp_night": "DIRECT",
                       "mean_air_temperature": "DIRECT" if r["mean_air_temperature"] is not None else "N/A"}
        if r["mean_air_temperature"] is None and str(r["body"]).startswith("moon"):
            r["na_reason"] = {"mean_air_temperature": "The Moon has no atmosphere: there is no air temperature to compare (not zero, not estimated)."}
        out[tid] = r
    return out


def earth(stack_npz=None):
    """Earth values on the valid cells, from the predictor stack auxiliaries (no new data)."""
    p = stack_npz or os.path.join(ROOT, "data/predictor_stack.npz")
    s = np.load(p)
    v = s["valid"]
    return dict(valid=v, surface_temp_day=s["lst_day_k"].astype(np.float64), surface_temp_night=s["lst_night_k"].astype(np.float64),
                mean_air_temperature=s["t2m_mean_c"].astype(np.float64) + 273.15)


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def build(out_path=None):
    T = targets()
    E = earth()
    v = E["valid"]
    er = {}
    for d in DIMS:
        a = E[d][v]; a = a[np.isfinite(a)]
        er[d] = dict(min=float(a.min()), max=float(a.max()), p01=float(np.percentile(a, 1)), p99=float(np.percentile(a, 99)),
                     n_finite=int(a.size), n_valid=int(v.sum()))
    doc = dict(schema="asterro.ext.thermal/1", version=VERSION,
               dims=DIMS, units={d: "K" for d in DIMS},
               earth_range=er,
               targets={k: {kk: vv for kk, vv in r.items()} for k, r in sorted(T.items())},
               normalisation="per target: [min, max] over valid Earth cells and this target's value (the explore-target-v1 rule)",
               inputs={"stack": "data/predictor_stack.npz (lst_day_k, lst_night_k, t2m_mean_c)", "stack_sha256": sha(os.path.join(ROOT, "data/predictor_stack.npz")),
                       "mars": "data/raw/mars_meda.json; data/raw/phase3/rems/*.json", "moon": "data/raw/phase4/support/polar_*.npz, gcp_raw.npz"},
               method=__doc__.split("Definitions")[1].split("Limits")[0].strip(),
               limits=__doc__.split("Limits recorded with the values:")[1].strip())
    out_path = out_path or os.path.join(ROOT, "public/data/ext/thermal_ext.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    json.dump(doc, open(out_path, "w"), indent=1, sort_keys=True)
    return doc


if __name__ == "__main__":
    d = build()
    for k, r in d["targets"].items():
        print(k, {x: (round(r[x], 2) if r[x] is not None else None) for x in DIMS}, "dr", round(r["surface_temp_day"] - r["surface_temp_night"], 4), "pub", round(r["published_lst_diurnal_range"], 4))
    print(json.dumps(d["earth_range"], indent=0))
