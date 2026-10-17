"""Reproduce an Explore result exported for a Phase IV registry target (scoring config explore-target-v1).

    python -m scripts.reproduce_registry reproduce.json [--repo .]

Legacy records (Jezero, Lunar South Pole, cross-planet) are reproduced by the unchanged scripts/reproduce.py.
This script checks, before any scoring: the predictor-stack hash; that the target is a scoring-enabled registry
target; that the record's normalisation ranges equal the registry's explore-target-v1 ranges; and that the
recorded fingerprint SHA-256 equals the registry's. It then recomputes the field with the same Python reference
engine (src.compute) and checks the selected cell's score/rank and the top-3 distinct sites bit for bit.
"""
import argparse, hashlib, json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.compute.similarity import similarity, effective_scores
from src.compute.ranking import cell_ranks, distinct_sites
from src.compute.variables import CRITERION_IDS as C
from scripts.export_reference import load_bundle


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("config"); ap.add_argument("--repo", default=".")
    a = ap.parse_args()
    cfg = json.load(open(a.config))
    h = hashlib.sha256(open(os.path.join(a.repo, "public/data/stack.bin"), "rb").read()).hexdigest()
    ok = h == cfg["predictor_stack"]["sha256"]
    print(f"[{'OK' if ok else 'FAIL'}] predictor stack sha256 {h[:16]}...")
    reg = {t["id"]: t for t in json.load(open(os.path.join(a.repo, "public/data/registry.json")))["targets"]}
    rt = reg.get(cfg["target"])
    if rt is None or not rt["scoring"]["earth_analogue_enabled"] or cfg.get("scoring_config") != "explore-target-v1":
        print(f"[FAIL] {cfg['target']}: not a scoring-enabled registry target under explore-target-v1 "
              "(legacy records: python -m scripts.reproduce)")
        sys.exit(1)
    st = rt["fingerprint"]["criterion_status"]
    tv = {c: (rt["fingerprint"]["variables"][c] if st[c] in ("DIRECT", "PROXY") else None) for c in C}
    r_ok = all([float(x) for x in cfg["normalization_ranges"][c]] == rt["scoring"]["explore_ranges"][c] for c in C)
    f_ok = cfg.get("target_fingerprint_sha256") == rt["fingerprint"]["content_sha256"]
    print(f"[{'OK' if r_ok else 'FAIL'}] normalisation ranges = registry explore-target-v1 ranges")
    print(f"[{'OK' if f_ok else 'FAIL'}] target fingerprint sha256 matches the registry")
    allok = ok and r_ok and f_ok
    info, A = load_bundle(a.repo)
    E = {c: A[c].astype(np.float64) for c in C}
    R = {c: tuple(v) for c, v in cfg["normalization_ranges"].items()}
    eff = effective_scores(similarity(E, tv, cfg["weights"], R))
    cell = A["cell"].astype(np.int64)
    lat = -90 + 0.5 * (cell // 576); lon = -180 + 0.625 * (cell % 576)
    ranks = cell_ranks(eff, cell)
    sel = cfg.get("selected_cell")
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
