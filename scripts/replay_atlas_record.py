"""Independently replay a Phase III experiment record (contract asterro.experiment/2) in Python.

    python scripts/replay_atlas_record.py record.json [--repo .]

Supported modules: atlas-candidates, atlas-stability. The replay uses the UNCHANGED Python baseline
engine (src/compute: similarity, effective_scores, distinct_sites) and the Phase II Python reference
(src/phase2/analysis: factorial designs, run_design, rank_stats) — separate code from the browser.
It checks:
  1. the predictor stack on disk has the SHA-256 recorded in context.predictor_stack;
  2. the target vectors recorded in the record equal the fingerprints in public/data/phase3/atlas.json;
  3. the recomputed outputs equal the recorded outputs (integers exactly; real numbers to 1e-12).
Exit status 0 = reproduced, 1 = not reproduced, 2 = cannot replay (missing dependency / unsupported).
"""
import argparse, hashlib, json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.export_reference import load_bundle
from src.compute.variables import CRITERION_IDS as C
from src.compute.similarity import similarity, effective_scores
from src.compute.ranking import distinct_sites
from src.phase2 import analysis as P2

TOL = 1e-12


def mode_of(t):
    lvl = t["readiness"]["level"]
    if lvl < 2:
        return False, "none"
    direct = [c for c in C if t["status"][c] in ("DIRECT", "DERIVED")]
    if lvl == 2:
        return True, "partial-terrain" if all(c in ("slope", "surface_roughness") for c in direct) else "partial"
    return True, "full"


def replay(rec, repo):
    ctx = rec["context"]
    h = hashlib.sha256(open(os.path.join(repo, "public/data/stack.bin"), "rb").read()).hexdigest()
    if h != ctx["predictor_stack"]["sha256"]:
        return 2, f"[BLOCKED] predictor stack {h[:16]}… ≠ recorded {ctx['predictor_stack']['sha256'][:16]}…"
    if rec["module"] not in ("atlas-candidates", "atlas-stability"):
        return 2, f"[UNSUPPORTED] module {rec['module']} has no Python replay"
    atlas = json.load(open(os.path.join(repo, "public/data/phase3/atlas.json")))
    T = {t["id"]: t for t in atlas["targets"]}
    msgs = [f"[OK] predictor stack sha256 {h[:16]}…"]
    for tid in ctx["targets"]:
        t = T.get(tid)
        if t is None:
            return 2, f"[BLOCKED] target {tid} not in this atlas build"
        incl = ctx["include_proxy"]
        tv = {c: (t["values"][c] if (t["status"][c] in ("DIRECT", "DERIVED") or (incl and t["status"][c] == "PROXY")) and t["values"][c] is not None else None) for c in C}
        if P2.canonical(tv) != P2.canonical(ctx["target_vectors"][tid]):
            return 1, f"[FAIL] target {tid}: fingerprint differs from atlas {atlas['version']}"
    msgs.append("[OK] target fingerprints match the atlas")
    info, A = load_bundle(repo)
    E = {c: A[c].astype(np.float64) for c in C}
    cell = A["cell"].astype(np.int64)
    lat, lon = -90 + 0.5 * (cell // 576), -180 + 0.625 * (cell % 576)
    w = {c: float(ctx["weights"][c]) for c in C}
    out = rec["outputs"]
    if rec["module"] == "atlas-candidates":
        ok = True
        for k, tid in enumerate(ctx["targets"]):
            eligible, mode = mode_of(T[tid])
            o = out["candidates"][k]
            if not eligible:
                same = o["eligible"] is False and o["cells"] == []
            else:
                R = {c: tuple(v) for c, v in ctx["normalisation"]["ranges"][tid].items()}
                eff = effective_scores(similarity(E, ctx["target_vectors"][tid], w, R))
                top = distinct_sites(eff, cell, lat, lon, n=rec["params"]["n"], min_sep_km=ctx["distinct_sep_km"])
                same = (o["eligible"] and o["mode"] == mode and [int(cell[i]) for i in top] == o["cells"]
                        and all(abs(float(eff[i]) - s) <= TOL for i, s in zip(top, o["scores"])))
            ok &= bool(same)
            msgs.append(f"[{'OK' if same else 'FAIL'}] {tid}: {len(o['cells'])} candidates")
        return (0 if ok else 1), "\n".join(msgs)
    # atlas-stability
    p = rec["params"]; tid = ctx["targets"][0]
    index = {int(c): k for k, c in enumerate(cell)}
    cand = [index[c] for c in p["candidates"]]
    R = {c: tuple(v) for c, v in ctx["normalisation"]["ranges"][tid].items()}
    design = P2.design_factorial(w, p["active"], C, tuple(p["factors"]))
    run = P2.run_design(E, [ctx["target_vectors"][tid]], R, cell, cand, w, design)
    st = P2.rank_stats(run, 1.0, 20)
    n_ok = sum(all(s[f] == r[f] for f in ("baseline", "min", "max", "median", "cls")) for s, r in zip(st, out["stats"]))
    ok = n_ok == len(cand) == len(out["stats"])
    msgs.append(f"[{'OK' if ok else 'FAIL'}] stability ({len(design)} configs): {n_ok}/{len(cand)} candidates identical")
    return (0 if ok else 1), "\n".join(msgs)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("record"); ap.add_argument("--repo", default=".")
    a = ap.parse_args()
    rec = json.load(open(a.record))
    if rec.get("schema") != "asterro.experiment/2":
        print("[UNSUPPORTED] not an asterro.experiment/2 record (Phase II records: scripts/replay_experiment.py)"); sys.exit(2)
    code, msg = replay(rec, a.repo)
    print(msg); print({0: "REPRODUCED", 1: "NOT REPRODUCED", 2: "CANNOT REPLAY"}[code])
    sys.exit(code)


if __name__ == "__main__":
    main()
