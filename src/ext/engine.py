"""Reference implementation of the extended fingerprint (Python; the browser port is app/frontend/phase4/ext_engine.js).

Configuration explore-ext-thermal-v1:
  criteria  the six baseline criteria + surface_temp_day, surface_temp_night, mean_air_temperature (tai-ext-thermal-1.0.0)
  formula   the UNCHANGED baseline similarity (src/compute/similarity.py, algorithm tai-sim-1.0.0), 80 % coverage rule,
            ties by score then cell id, distinct sites >= 300 km apart
  ranges    six baseline criteria: exactly the ranges the baseline uses for that target (legacy table for Jezero and
            the Lunar South Pole, the registry's explore_ranges otherwise); three new criteria: [min, max] over valid
            Earth cells and this target's value
  targets   six baseline values exactly as scored by the baseline; three new values from public/data/ext/thermal_ext.json
With the three new weights at 0 the result is the baseline field, value for value (tested).
"""
import json, os
import numpy as np
from src.compute import similarity as SIM
from src.compute import ranking as RK

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = ["aridity", "annual_temperature_range", "elevation", "slope", "surface_roughness", "lst_diurnal_range"]
EXT = ["surface_temp_day", "surface_temp_night", "mean_air_temperature"]
CONFIG = "explore-ext-thermal-v1"


def load_stack():
    s = np.load(os.path.join(ROOT, "data/predictor_stack.npz"))
    v = s["valid"]
    ii, jj = np.nonzero(v)
    cell = (ii * 576 + jj).astype(np.int64)
    st = {c: s[c][v].astype(np.float32) for c in BASE}
    st["surface_temp_day"] = s["lst_day_k"][v].astype(np.float32)
    st["surface_temp_night"] = s["lst_night_k"][v].astype(np.float32)
    st["mean_air_temperature"] = s["t2m_mean_c"][v].astype(np.float32).astype(np.float64) + 273.15
    lat = -90 + 0.5 * ii.astype(np.float64); lon = -180 + 0.625 * jj.astype(np.float64)
    return st, cell, lat, lon


def target(tid):
    ext = json.load(open(os.path.join(ROOT, "public/data/ext/thermal_ext.json")))
    if tid in ("mars_jezero", "moon_south_pole"):
        T = {t["id"]: t for t in json.load(open(os.path.join(ROOT, "data/targets.json")))["targets"]}
        tv = dict(T[tid]["variables"])
        app = json.load(open(os.path.join(ROOT, "public/data/app.json")))
        ranges = {c: list(app["ranges"][c]) for c in BASE}
    else:
        R = {t["id"]: t for t in json.load(open(os.path.join(ROOT, "public/data/registry.json")))["targets"]}
        fp = R[tid]["fingerprint"]
        tv = {c: (fp["variables"][c] if fp["criterion_status"][c] in ("DIRECT", "PROXY") else None) for c in BASE}
        ranges = {c: list(R[tid]["scoring"]["explore_ranges"][c]) for c in BASE}
    x = ext["targets"].get(tid)
    for c in EXT:
        tv[c] = None if x is None else x[c]
    return tv, ranges, ext


def ranges_ext(stack, tv, ranges):
    r = dict(ranges)
    for c in EXT:
        a = np.asarray(stack[c], dtype=np.float64); a = a[np.isfinite(a)]
        lo, hi = float(a.min()), float(a.max())
        if tv.get(c) is not None:
            lo, hi = min(lo, tv[c]), max(hi, tv[c])
        r[c] = [lo, hi]
    return r


def field(tid, weights, stack=None, n_sites=20):
    st, cell, lat, lon = stack or load_stack()
    tv, ranges, _ = target(tid)
    rg = ranges_ext(st, tv, ranges)
    res = SIM.similarity(st, tv, weights, rg)
    eff = SIM.effective_scores(res)
    o = RK.order(eff, cell)
    sites = RK.distinct_sites(eff, cell, lat, lon, n=n_sites, min_sep_km=300.0)
    return dict(eff=eff, order=o, sites=sites, ranges=rg, tv=tv, res=res, cell=cell, lat=lat, lon=lon)
