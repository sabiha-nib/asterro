"""Reproduce a result exported by the app's REPRODUCE THIS RESULT panel.

    python -m scripts.reproduce reproduce.json [--repo .]

Verifies the predictor-stack hash, recomputes the similarity field with the Python reference
engine, and checks the selected cell's score/rank and the top-3 distinct sites bit-for-bit.
"""
import argparse, hashlib, json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.compute.similarity import similarity, effective_scores, cross_planet
from src.compute.ranking import cell_ranks, order, distinct_sites
from src.compute.variables import CRITERION_IDS as C
from scripts.export_reference import load_bundle


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("config"); ap.add_argument("--repo", default=".")
    a = ap.parse_args()
    cfg = json.load(open(a.config))
    binp = os.path.join(a.repo, "public/data/stack.bin")
    h = hashlib.sha256(open(binp, "rb").read()).hexdigest()
    ok = h == cfg["predictor_stack"]["sha256"]
    print(f"[{'OK' if ok else 'FAIL'}] predictor stack sha256 {h[:16]}...")
    info, A = load_bundle(a.repo)
    T = {t["id"]: t for t in json.load(open(os.path.join(a.repo, "data/targets.json")))["targets"]}
    E = {c: A[c].astype(np.float64) for c in C}
    R = {c: tuple(v) for c, v in cfg["normalization_ranges"].items()}
    w = cfg["weights"]
    if cfg["target"] == "cross":
        effs = [effective_scores(similarity(E, T[t]["variables"], w, R)) for t in ("mars_jezero", "moon_south_pole")]
        eff = cross_planet(*effs)
    else:
        eff = effective_scores(similarity(E, T[cfg["target"]]["variables"], w, R))
    cell = A["cell"].astype(np.int64)
    lat = -90 + 0.5 * (cell // 576); lon = -180 + 0.625 * (cell % 576)
    ranks = cell_ranks(eff, cell)
    sel = cfg.get("selected_cell")
    allok = ok
    if sel:
        i = int(np.nonzero(cell == sel["cell_id"])[0][0])
        s_ok = round(float(eff[i]), 12) == sel["expected_score"] and int(ranks[i]) == sel["expected_rank"]
        allok &= s_ok
        print(f"[{'OK' if s_ok else 'FAIL'}] cell {sel['cell_id']}: score {eff[i]:.12f} rank {ranks[i]}")
    ds = distinct_sites(eff, cell, lat, lon, n=3, min_sep_km=cfg["rules"]["distinct_sep_km"])
    got = [dict(cell_id=int(cell[k]), score=round(float(eff[k]), 12)) for k in ds]
    t_ok = got == cfg["expected_top3"]
    allok &= t_ok
    print(f"[{'OK' if t_ok else 'FAIL'}] top-3 distinct sites {got}")
    sys.exit(0 if allok else 1)


if __name__ == "__main__":
    main()
