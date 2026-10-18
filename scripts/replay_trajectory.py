"""Replay a Discovery Trajectory (asterro.trajectory/1) exported from the Trajectory tab.

    python3 scripts/replay_trajectory.py trajectory.json [--repo .]

For every recorded configuration it checks, before scoring: the predictor-stack hash; that the target exists
(legacy target, cross-planet, or a scoring-enabled registry target); and that the recorded normalisation ranges
equal the ranges this build assigns to that configuration (legacy table, or the registry's explore-target-v1
ranges). It then recomputes the field with the Python reference engine (src.compute) and compares the ten
exported distinct sites (cell id and score to 1e-12). Exit 0 = every configuration REPRODUCED, 1 = at least one
differs, 2 = the file cannot be replayed (wrong schema, stack, or unknown target).
"""
import argparse, hashlib, json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.compute.similarity import similarity, effective_scores, cross_planet
from src.compute.ranking import distinct_sites
from src.compute.variables import CRITERION_IDS as C
from scripts.export_reference import load_bundle


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("trajectory"); ap.add_argument("--repo", default=".")
    a = ap.parse_args()
    doc = json.load(open(a.trajectory))
    if doc.get("schema") != "asterro.trajectory/1" or not doc.get("states"):
        print("[BLOCKED] not an asterro.trajectory/1 file"); sys.exit(2)
    h = hashlib.sha256(open(os.path.join(a.repo, "public/data/stack.bin"), "rb").read()).hexdigest()
    if h != doc.get("predictor_stack_sha256"):
        print(f"[BLOCKED] predictor stack {h[:16]}… ≠ recorded {str(doc.get('predictor_stack_sha256'))[:16]}…"); sys.exit(2)
    print(f"[OK] predictor stack sha256 {h[:16]}…")
    app = json.load(open(os.path.join(a.repo, "public/data/app.json")))
    legacy = {t["id"]: t for t in json.load(open(os.path.join(a.repo, "data/targets.json")))["targets"]}
    reg = {t["id"]: t for t in json.load(open(os.path.join(a.repo, "public/data/registry.json")))["targets"]}
    info, A = load_bundle(a.repo)
    E = {c: A[c].astype(np.float64) for c in C}
    cell = A["cell"].astype(np.int64)
    lat = -90 + 0.5 * (cell // 576); lon = -180 + 0.625 * (cell % 576)
    sep = app["thresholds"]["distinct_sep_km"]
    allok = True
    for k, s in enumerate(doc["states"], 1):
        tid, w = s["target"], s["weights"]
        if tid == "cross" or tid in legacy:
            want = app["ranges"]
        elif tid in reg and reg[tid]["scoring"]["earth_analogue_enabled"]:
            want = reg[tid]["scoring"]["explore_ranges"]
        else:
            print(f"[BLOCKED] state {k}: unknown or non-scoring target {tid}"); sys.exit(2)
        r_ok = all([float(x) for x in s["normalization_ranges"][c]] == [float(x) for x in want[c]] for c in C)
        R = {c: tuple(s["normalization_ranges"][c]) for c in C}
        if tid == "cross":
            eff = cross_planet(*[effective_scores(similarity(E, legacy[t]["variables"], w, R)) for t in ("mars_jezero", "moon_south_pole")])
        elif tid in legacy:
            eff = effective_scores(similarity(E, legacy[tid]["variables"], w, R))
        else:
            st = reg[tid]["fingerprint"]["criterion_status"]
            tv = {c: (reg[tid]["fingerprint"]["variables"][c] if st[c] in ("DIRECT", "PROXY") else None) for c in C}
            eff = effective_scores(similarity(E, tv, w, R))
        ds = distinct_sites(eff, cell, lat, lon, n=len(s["expected_sites"]), min_sep_km=sep)
        got = [dict(cell_id=int(cell[i]), score=round(float(eff[i]), 12)) for i in ds]
        ok = r_ok and got == s["expected_sites"]
        allok &= ok
        print(f"[{'REPRODUCED' if ok else 'DIFFERS'}] state {k} · {s.get('label')} · {tid}{'' if r_ok else ' · ranges differ from this build'}")
    print("REPRODUCED" if allok else "NOT REPRODUCED")
    sys.exit(0 if allok else 1)


if __name__ == "__main__":
    main()
