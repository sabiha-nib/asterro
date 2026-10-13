"""Independently replay a Phase II experiment record exported from the browser Lab (Vault → Export).

    python scripts/replay_experiment.py record.json [--repo .]

Supported modules: robustness, ablation. The replay uses the UNCHANGED Python baseline engine
(src/compute) and the Python reference implementation of the Lab analyses (src/phase2/analysis.py),
which is separate code from the browser module. It checks:
  1. the predictor stack on disk has the SHA-256 recorded in the experiment's baseline;
  2. the recomputed outputs equal the recorded outputs (integers exactly; real numbers to 1e-12).
Exit status 0 = reproduced, 1 = not reproduced, 2 = cannot replay (missing dependency / unsupported).
"""
import argparse, hashlib, json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.export_reference import load_bundle
from src.compute.variables import CRITERION_IDS as C
from src.phase2 import analysis as P2

TOL = 1e-12


def close(a, b):
    if a is None or b is None:
        return a is None and b is None or (isinstance(a, float) and math.isnan(a)) or (isinstance(b, float) and math.isnan(b))
    if isinstance(a, float) or isinstance(b, float):
        if math.isnan(float(a)) and math.isnan(float(b)):
            return True
        return abs(float(a) - float(b)) <= TOL
    return a == b


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("record"); ap.add_argument("--repo", default=".")
    a = ap.parse_args()
    rec = json.load(open(a.record))
    b = rec["baseline"]
    h = hashlib.sha256(open(os.path.join(a.repo, "public/data/stack.bin"), "rb").read()).hexdigest()
    if h != b["predictor_stack"]["sha256"]:
        print(f"[BLOCKED] predictor stack {h[:16]}… ≠ recorded {b['predictor_stack']['sha256'][:16]}…"); sys.exit(2)
    print(f"[OK] predictor stack sha256 {h[:16]}…")
    if rec["module"] not in ("robustness", "ablation"):
        print(f"[UNSUPPORTED] module {rec['module']} has no Python replay"); sys.exit(2)
    info, A = load_bundle(a.repo)
    E = {c: A[c].astype(np.float64) for c in C}
    T = {t["id"]: t for t in json.load(open(os.path.join(a.repo, "data/targets.json")))["targets"]}
    tids = ["mars_jezero", "moon_south_pole"] if b["target"] == "cross" else [b["target"]]
    targets = [T[t]["variables"] for t in tids]
    R = {c: tuple(v) for c, v in b["normalization_ranges"].items()}
    w = {c: float(b["weights"][c]) for c in C}
    cell = A["cell"].astype(np.int64)
    index = {int(c): k for k, c in enumerate(cell)}
    act = [c for c in C if w[c] > 0 and any(tv[c] is not None for tv in targets)]
    ok = True
    if rec["module"] == "robustness":
        p = rec["params"]
        cand = [index[c] for c in p["candidates"]]
        if p["design"] == "oat":
            design = P2.design_oat(w, act, C, (0.5, 2))
        elif p["design"] == "factorial":
            design = P2.design_factorial(w, act, C, (0.5, 1, 2))
        else:
            design = P2.design_sampled(w, act, C, p["samples"], p["seed"], p["logRange"])
        run = P2.run_design(E, targets, R, cell, cand, w, design)
        cov = []
        for i in cand:
            cs = []
            for tv in targets:
                a_ = [c for c in C if tv[c] is not None and w[c] > 0]
                tot = sum(w[c] for c in a_); okw = sum(w[c] for c in a_ if math.isfinite(E[c][i]))
                cs.append(okw / tot if tot else 0.0)
            cov.append(min(cs))
        st = P2.rank_stats(run, p["topPct"], p["topN"], p["stableFrac"], p["moderateFrac"], cov)
        oat = P2.design_oat(w, act, C, (0.5, 2))
        orun = P2.run_design(E, targets, R, cell, cand, w, oat)
        drivers, oat_lists = [], []
        for k in range(len(cand)):
            by = {}
            for q, d in enumerate(oat):
                e = by.setdefault(d["criterion"], dict(c=d["criterion"], r={}, m=0.0))
                e["r"][P2._num(d["factor"])] = int(orun["ranks"][k, q])
                e["m"] = max(e["m"], abs(math.log2(orun["ranks"][k, q] / orun["base_ranks"][k])))
            lst = sorted(by.values(), key=lambda e: (-e["m"], e["c"]))
            drivers.append(lst[0]["c"] if lst else None); oat_lists.append(lst)
        out = rec["outputs"]
        n_ok = 0
        for k, (s_py, s_js) in enumerate(zip(st, out["stats"])):
            same = all(close(s_py[f], s_js[f]) for f in ("baseline", "min", "max", "median", "p25", "p75", "fracTopPct", "fracTopN", "n", "cls"))
            same &= drivers[k] == out["drivers"][k]
            same &= all(x["c"] == y["c"] and all(int(x["r"][f]) == int(y["r"][f]) for f in x["r"]) and close(x["m"], y["m"]) for x, y in zip(oat_lists[k], out["oat"][k]))
            n_ok += same
            if not same:
                print(f"[FAIL] candidate cell {p['candidates'][k]}: python {s_py} / recorded {s_js}")
        ok = n_ok == len(cand) and out["nConfigs"] == len(design)
        print(f"[{'OK' if ok else 'FAIL'}] robustness ({p['design']}, {len(design)} configs): {n_ok}/{len(cand)} candidates identical "
              f"(ranks, IQR, frequencies, class, one-at-a-time drivers)")
    else:
        rows = P2.ablation(E, targets, R, cell, -90 + 0.5 * (cell // 576), -180 + 0.625 * (cell % 576), w, act, C,
                           n_distinct=rec["params"].get("nDistinct", 20), sep=b["distinct_sep_km"], compare_top=rec["params"]["compareTop"])
        out = rec["outputs"]
        for r_py, r_js in zip(rows, out):
            if "error" in r_py or "error" in r_js:
                same = ("error" in r_py) == ("error" in r_js)
            else:
                same = (r_py["removed"] == r_js["removed"] and int(cell[r_py["top"]]) == r_js["top"] and r_py["overlap"] == r_js["overlap"]
                        and close(r_py["rho"], r_js["rho"]) and r_py["baselineDistinctNewRanks"] == r_js["baselineDistinctNewRanks"]
                        and [int(cell[i]) for i in r_py["distinct"]] == r_js["distinct"])
            ok &= bool(same)
            print(f"[{'OK' if same else 'FAIL'}] ablation without {r_js['removed']}")
        ok &= len(rows) == len(out)
    print("REPRODUCED" if ok else "NOT REPRODUCED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
