"""Replay a Phase IV scenario set (asterro.scenario-set/1) exported by the Scenario Lab.

    python3 scripts/replay_scenario.py scenario.json [--repo .]

Checks the predictor-stack hash, the target fingerprint hash against public/data/registry.json, re-derives every
scenario's target vector and normalisation ranges by the recorded rule, recomputes the field with the Python
reference engine (src/compute: unchanged baseline formula, coverage rule and tie-break) and compares the distinct
sites (cell ids exact, scores to 1e-12). Exit 0 = reproduced, 1 = not reproduced, 2 = cannot replay.
"""
import argparse, hashlib, json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.export_reference import load_bundle
from src.compute.variables import CRITERION_IDS as C
from src.compute.similarity import similarity, effective_scores
from src.compute.ranking import distinct_sites

TOL = 1e-12


def vector(t, include_proxy):
    fp = t["fingerprint"]
    return {c: (float(fp["variables"][c]) if (fp["criterion_status"][c] == "DIRECT" or (include_proxy and fp["criterion_status"][c] == "PROXY"))
                and fp["variables"][c] is not None else None) for c in C}


def ranges(E, tv, rule):
    out = {}
    for c in C:
        lo, hi = float(np.nanmin(E[c])), float(np.nanmax(E[c]))
        if rule == "earth_union_target" and tv[c] is not None:
            lo, hi = min(lo, tv[c]), max(hi, tv[c])
        elif rule not in ("earth_union_target", "earth_only"):
            raise ValueError("unsupported normalisation " + rule)
        out[c] = [lo, hi]
    return out


def replay(cfg, repo):
    if cfg.get("schema") != "asterro.scenario-set/1":
        return 2, ["[UNSUPPORTED] not an asterro.scenario-set/1 configuration"]
    h = hashlib.sha256(open(os.path.join(repo, "public/data/stack.bin"), "rb").read()).hexdigest()
    if h != cfg["stack_sha256"]:
        return 2, [f"[BLOCKED] predictor stack {h[:16]}… ≠ recorded {cfg['stack_sha256'][:16]}…"]
    reg = {t["id"]: t for t in json.load(open(os.path.join(repo, "public/data/registry.json")))["targets"]}
    t = reg.get(cfg["target"])
    if t is None:
        return 2, [f"[BLOCKED] target {cfg['target']} not in this registry"]
    if t["fingerprint"]["content_sha256"] != cfg["fingerprint_sha256"]:
        return 1, ["[FAIL] target fingerprint differs from the registry"]
    msgs = [f"[OK] predictor stack sha256 {h[:16]}…", "[OK] target fingerprint matches the registry"]
    info, A = load_bundle(repo)
    E = {c: A[c].astype(np.float64) for c in C}
    Ef = {c: A[c] for c in C}
    cell = A["cell"].astype(np.int64)
    lat, lon = -90 + 0.5 * (cell // 576), -180 + 0.625 * (cell % 576)
    ok = True
    for s in cfg["scenarios"]:
        tv = vector(t, s["include_proxy"])
        R = ranges(Ef, tv, s["normalisation"])
        r_ok = all([float(x) for x in s["ranges"][c]] == R[c] for c in C) and all(tv[c] == s["target_vector"][c] for c in C)
        eff = effective_scores(similarity(E, tv, {c: float(s["weights"][c]) for c in C}, {c: tuple(R[c]) for c in C}))
        top = distinct_sites(eff, cell, lat, lon, n=cfg["n"], min_sep_km=cfg["distinct_sep_km"])
        exp = s["expected_top"]
        same = r_ok and len(top) == len(exp) and all(int(cell[i]) == e["cell"] and abs(float(eff[i]) - e["score"]) <= TOL for i, e in zip(top, exp))
        ok &= bool(same)
        msgs.append(f"[{'OK' if same else 'FAIL'}] {s['label']}: {len(top)} distinct sites{'' if r_ok else ' (vector or ranges differ)'}")
    return (0 if ok else 1), msgs


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("config"); ap.add_argument("--repo", default=".")
    a = ap.parse_args()
    code, msgs = replay(json.load(open(a.config)), a.repo)
    print("\n".join(msgs)); print({0: "REPRODUCED", 1: "NOT REPRODUCED", 2: "CANNOT REPLAY"}[code])
    sys.exit(code)


if __name__ == "__main__":
    main()
