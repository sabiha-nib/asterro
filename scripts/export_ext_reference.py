"""Write tests/fixtures/ext_reference.json: the extended fingerprint (explore-ext-thermal-v1) computed by the Python
reference (src/ext/engine.py) for four targets, for the browser engine's parity test (tests/phase4/test_ext_engine.mjs).
    python3 scripts/export_ext_reference.py
"""
import json, os, sys
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from src.ext import engine as X

GEN = {"aridity": 1, "annual_temperature_range": 1, "elevation": 1, "slope": 1, "surface_roughness": 1, "lst_diurnal_range": 1}
CASES = [("mars_jezero", {**GEN, "surface_temp_day": 1, "surface_temp_night": 1, "mean_air_temperature": 1}),
         ("mars_gale_curiosity", {**GEN, "surface_temp_day": 2, "surface_temp_night": 2, "mean_air_temperature": 1}),
         ("moon_shackleton", {**GEN, "surface_temp_day": 1, "surface_temp_night": 1, "mean_air_temperature": 1}),
         ("moon_aristarchus", {**GEN, "surface_temp_day": 1, "surface_temp_night": 3, "mean_air_temperature": 0})]
st = X.load_stack()
out = {"config": X.CONFIG, "cases": []}
for tid, w in CASES:
    f = X.field(tid, w, st)
    sites = f["sites"]
    out["cases"].append(dict(tid=tid, weights=w, ranges=f["ranges"], tv=f["tv"], sites=[int(i) for i in sites],
                             eff_sites=[float(f["eff"][i]) for i in sites], order_top200=[int(i) for i in f["order"][:200]],
                             n_eligible=int((f["eff"] >= 0).sum()), eff_sum=float(np.sum(f["eff"][f["eff"] >= 0])),
                             active=f["res"]["active"]))
    print(tid, "top", sites[:3], [round(float(f["eff"][i]), 4) for i in sites[:3]], "eligible", out["cases"][-1]["n_eligible"])
# with the three new weights at 0 the extended field is the baseline field
f0 = X.field("mars_jezero", {**GEN, "surface_temp_day": 0, "surface_temp_night": 0, "mean_air_temperature": 0}, st)
from src.compute import similarity as SIM
tv, rg, _ = X.target("mars_jezero")
b = SIM.effective_scores(SIM.similarity({c: st[0][c] for c in X.BASE}, {c: tv[c] for c in X.BASE}, GEN, {c: rg[c] for c in X.BASE}))
out["zero_ext_equals_baseline"] = bool(np.array_equal(f0["eff"], b))
print("zero ext weights == baseline:", out["zero_ext_equals_baseline"])
json.dump(out, open(os.path.join(ROOT, "tests/fixtures/ext_reference.json"), "w"), indent=0)
