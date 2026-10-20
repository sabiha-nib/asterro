"""Independent Python re-implementation of the Method Arena methods and the mismatch-signature partition.

The JavaScript engine (app/frontend/phase4/methods_engine.js) writes tests/phase4/fixtures/methods_reference.json
from the real predictor stack; these tests recompute the same quantities with numpy and the unchanged Python
reference ranking (src.compute.ranking.distinct_sites) and require the same leading sites, scores to 1e-12,
eligible counts, mismatch families and Earth ceiling. Agreement between two implementations of one method checks
the implementation, not the scientific validity of the method."""
import json, os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from src.compute.variables import CRITERION_IDS as C
from src.compute.similarity import similarity, effective_scores
from src.compute.ranking import distinct_sites

FX = json.load(open(os.path.join(ROOT, "tests/phase4/fixtures/methods_reference.json")))
APP = json.load(open(os.path.join(ROOT, "public/data/app.json")))
INFO = json.load(open(os.path.join(ROOT, "data/metadata/stack_build.json")))
_buf = open(os.path.join(ROOT, "public/data/stack.bin"), "rb").read()
A = {L["name"]: np.frombuffer(_buf, dtype=L["dtype"], count=L["length"], offset=L["offset"]) for L in INFO["layout"]}
CELL = A["cell"].astype(np.int64)
LAT = -90 + 0.5 * (CELL // 576); LON = -180 + 0.625 * (CELL % 576)
THR = APP["thresholds"]


def _active(tv, w):
    return [c for c in C if tv.get(c) is not None and (w.get(c) or 0) > 0]


def score(method, tv, w, R):
    act = _active(tv, w); n = CELL.size
    if method == "baseline":
        return effective_scores(similarity({c: A[c].astype(np.float64) for c in C}, tv, w, {c: tuple(R[c]) for c in C}))
    num = np.zeros(n); ws = np.zeros(n); mn = np.full(n, np.inf); tot = 0.0
    for c in act:
        tot += float(w[c])
    for c in act:
        e = A[c].astype(np.float64); fin = np.isfinite(e); t = float(tv[c]); wc = float(w[c])
        if method == "quantile":
            S = np.sort(e[fin]); N = S.size
            F = lambda x: (np.searchsorted(S, x, "left") + np.searchsorted(S, x, "right")) / (2 * N)
            s = 1 - np.abs(F(e[fin]) - F(t))
        else:
            span = R[c][1] - R[c][0]
            s = np.clip(1 - np.abs(e[fin] - t) / span, 0, 1)
            mn[fin] = np.minimum(mn[fin], s)
        num[fin] += wc * s; ws[fin] += wc
    cov = ws / tot
    ok = (cov >= 1 - 1e-12) if method == "strict" else (cov >= 0.8 - 1e-12)
    ok &= ws > 0
    val = mn if method == "minimum" else num / np.where(ws > 0, ws, 1)
    return np.where(ok, val, -1.0)


def test_methods_match_js_engine_on_real_targets():
    for tid, case in FX["cases"].items():
        tv, w, R = case["target"], case["weights"], case["ranges"]
        for m, ref in case["methods"].items():
            eff = score(m, tv, w, R)
            assert int((eff >= 0).sum()) == ref["n_eligible"], (tid, m)
            ds = distinct_sites(eff, CELL, LAT, LON, n=10, min_sep_km=APP["thresholds"]["distinct_sep_km"])
            got = [dict(cell_id=int(CELL[i]), score=round(float(eff[i]), 12)) for i in ds]
            assert got == ref["top"], (tid, m, got[:2], ref["top"][:2])


def test_minimum_never_exceeds_baseline_and_strict_is_subset():
    case = FX["cases"]["mars_jezero"]
    b, mn, st = (score(m, case["target"], case["weights"], case["ranges"]) for m in ("baseline", "minimum", "strict"))
    both = (b >= 0) & (mn >= 0)
    assert np.all(mn[both] <= b[both] + 1e-12)
    assert np.all(b[st >= 0] >= 0) and np.array_equal(st[st >= 0], b[st >= 0])


def _code(d):
    a = abs(d); m = 1 - THR["match"]; p = 1 - THR["partial"]
    return "≈" if a <= m + 1e-12 else ("+" if d > 0 else "−") if a <= p + 1e-12 else ("++" if d > 0 else "−−")


def test_mismatch_families_and_ceiling_match_js_engine():
    sig = FX["signature"]; case = FX["cases"]["mars_jezero"]; tv, w, R = case["target"], case["weights"], case["ranges"]
    eff = score("baseline", tv, w, R); el = np.nonzero(eff >= 0)[0]
    assert el.size == sig["n_eligible"] and sig["criteria"] == _active(tv, w)
    cols = []
    for c in sig["criteria"]:
        e = A[c].astype(np.float64)[el]; d = (e - float(tv[c])) / (R[c][1] - R[c][0])
        cols.append(np.array(["?" if not np.isfinite(x) else _code(x) for x in d], dtype=object))
    keys = np.array(["|".join(t) for t in zip(*cols)], dtype=object)
    uniq, inv = np.unique(keys, return_inverse=True)
    assert uniq.size == sig["n_families"]
    for f in sig["top"]:
        members = el[keys == f["key"]]
        assert members.size == f["size"], f["key"]
        best = members[np.lexsort((CELL[members], -eff[members]))[0]]
        assert int(CELL[best]) == f["best_cell"] and round(float(eff[best]), 12) == f["best"]
    for x in sig["ceiling"]:
        e = A[x["criterion"]].astype(np.float64); e = e[np.isfinite(e)]; t = float(tv[x["criterion"]]); span = R[x["criterion"]][1] - R[x["criterion"]][0]
        s = np.clip(1 - np.abs(e - t) / span, 0, 1)
        assert round(float(s.max()), 12) == x["best_s"] and int((s >= THR["match"]).sum()) == x["cells_match"]
        assert x["outside"] == ("above" if t > e.max() else "below" if t < e.min() else None)


def test_drop_source_matches_js_engine():
    case = FX["cases"]["mars_jezero"]; tv, w, R = case["target"], case["weights"], case["ranges"]
    src = {}
    for c in APP["criteria"]:
        for s in c["earth_source"]:
            src.setdefault(s, []).append(c["id"])
    for r in FX["drop_source"]["results"]:
        w2 = dict(w)
        for c in src[r["source"]]:
            w2[c] = 0
        eff = score("baseline", tv, w2, R)
        ds = distinct_sites(eff, CELL, LAT, LON, n=10, min_sep_km=APP["thresholds"]["distinct_sep_km"])
        assert [int(CELL[i]) for i in ds] == r["top"], r["source"]
