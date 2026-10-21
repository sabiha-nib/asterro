"""Independent Python checks of the Discovery Journey (app/frontend/phase4/journey_engine.js).

tests/phase4/fixtures/journey_reference.json is written by the JS engine from the real predictor stack
(node tests/phase4/test_journey_engine.mjs --write-fixture). These tests recompute, with numpy and the unchanged
Python reference implementation (src.compute.similarity / ranking):
  * the Analogue Passport's score from the stack, and from the passport's own contents only;
  * every "What would change my mind?" alternative's cell rank and leading-site position from its stated weights.
Agreement checks the implementation, not the scientific validity of the analogue."""
import json, os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from src.compute.variables import CRITERION_IDS as C
from src.compute.similarity import similarity, effective_scores
from src.compute.ranking import distinct_sites

FX = json.load(open(os.path.join(ROOT, "tests/phase4/fixtures/journey_reference.json")))
APP = json.load(open(os.path.join(ROOT, "public/data/app.json")))
INFO = json.load(open(os.path.join(ROOT, "data/metadata/stack_build.json")))
_buf = open(os.path.join(ROOT, "public/data/stack.bin"), "rb").read()
A = {L["name"]: np.frombuffer(_buf, dtype=L["dtype"], count=L["length"], offset=L["offset"]) for L in INFO["layout"]}
CELL = A["cell"].astype(np.int64)
LAT = -90 + 0.5 * (CELL // 576); LON = -180 + 0.625 * (CELL % 576)
TV = {t["id"]: t["variables"] for t in json.load(open(os.path.join(ROOT, "data/targets.json")))["targets"]}
R = {c: tuple(APP["ranges"][c]) for c in C}


def field(w):
    return effective_scores(similarity({c: A[c].astype(np.float64) for c in C}, TV[FX["target"]], w, R))


def rank_of(eff, i):
    e = eff[i]
    return int(((eff > e) | ((eff == e) & (CELL < CELL[i]))).sum()) + 1


def test_fixture_is_for_this_stack():
    assert FX["stack_sha256"] == APP["stack"]["sha256"]
    assert FX["passport"]["reproducibility"]["predictor_stack_sha256"] == APP["stack"]["sha256"]


def test_passport_score_reproduced_from_stack_and_from_its_own_contents():
    p = FX["passport"]
    i = int(np.nonzero(CELL == p["place"]["cell_id"])[0][0])
    w = p["configuration"]["weights"]
    eff = field(w)
    assert abs(eff[i] - p["result"]["analogue_score"]) < 1e-12
    num = ws = tot = 0.0
    for r in p["criteria"]:
        if r["target"] is None or not r["weight"] > 0:
            continue
        tot += r["weight"]
        if r["earth"] is None:
            continue
        lo, hi = p["configuration"]["normalization_ranges"][r["id"]]
        s = min(1.0, max(0.0, 1 - abs(r["earth"] - r["target"]) / (hi - lo)))
        assert abs(s - r["similarity"]) < 1e-12, r["id"]
        assert abs(r["earth"] - float(A[r["id"]][i])) < 1e-9, r["id"]
        num += r["weight"] * s; ws += r["weight"]
    assert ws / tot >= 0.8 and abs(num / ws - p["result"]["analogue_score"]) < 1e-12
    assert rank_of(eff, i) == p["result"]["cell_rank"] == 1


def test_change_my_mind_alternatives_reproduced():
    p = FX["passport"]; w0 = p["configuration"]["weights"]
    i = int(np.nonzero(CELL == FX["cell_id"])[0][0])
    for a in FX["change"]:
        w = dict(w0)
        for ch in a["changes"]:
            assert w.get(ch["c"], 0) == ch["from"], (a["kind"], a["id"])
            w[ch["c"]] = ch["to"]
        eff = field(w)
        assert rank_of(eff, i) == a["rank"], (a["kind"], a["id"])
        ds = [int(x) for x in distinct_sites(eff, CELL, LAT, LON, n=10, min_sep_km=APP["thresholds"]["distinct_sep_km"])]
        lead = ds.index(i) + 1 if i in ds else None
        assert lead == a["lead"], (a["kind"], a["id"], lead, a["lead"])
