import numpy as np
import pytest
from src.compute.similarity import similarity, classify
from src.compute.ranking import cell_ranks, distinct_sites
from src.compute.clustering import constellations, kmeans
from src.compute.sensitivity import why_did_this_move
from src.compute.normalization import compute_ranges

C = ["a", "b", "c"]
RANGES = {"a": [0.0, 10.0], "b": [-5.0, 5.0], "c": [100.0, 300.0]}
TARGET = {"a": 2.0, "b": 1.0, "c": 250.0}
W = {"a": 1.0, "b": 2.0, "c": 1.0}


def stack(rows):
    rows = np.asarray(rows, dtype=float)
    return {c: rows[:, i] for i, c in enumerate(C)}


def test_exact_match_scores_one():
    r = similarity(stack([[2.0, 1.0, 250.0]]), TARGET, W, RANGES)
    assert r["final"][0] == pytest.approx(1.0, abs=0, rel=0)
    for c in C:
        assert r["criterion_similarity"][c][0] == 1.0


def test_extreme_mismatch_scores_zero():
    r = similarity(stack([[20.0, -40.0, -1000.0]]), TARGET, W, RANGES)
    assert r["final"][0] == 0.0


def test_zero_weight_removes_influence():
    s = stack([[2.0, 1.0, 250.0], [2.0, 1.0, 100.0]])
    r = similarity(s, TARGET, {**W, "c": 0.0}, RANGES)
    assert r["final"][0] == r["final"][1] == 1.0
    assert "c" not in r["active"]


def test_null_target_criterion_is_excluded():
    s = stack([[2.0, 1.0, 0.0]])
    r = similarity(s, {**TARGET, "c": None}, W, RANGES)
    assert r["final"][0] == 1.0 and r["active"] == ["a", "b"]


def test_contributions_reconstruct_final_score():
    rng = np.random.default_rng(0)
    rows = np.column_stack([rng.uniform(0, 10, 500), rng.uniform(-5, 5, 500), rng.uniform(100, 300, 500)])
    r = similarity(stack(rows), TARGET, W, RANGES)
    total = sum(r["weighted_contribution"][c] for c in C)
    np.testing.assert_allclose(total, r["final"], rtol=0, atol=1e-12)


def test_weight_change_can_change_ranking():
    s = stack([[2.0, 4.0, 250.0],     # perfect on a, c; poor on b
               [6.0, 1.0, 250.0]])    # perfect on b, c; poor on a
    ids = np.array([0, 1])
    r1 = cell_ranks(similarity(s, TARGET, {"a": 5, "b": 1, "c": 1}, RANGES)["final"], ids)
    r2 = cell_ranks(similarity(s, TARGET, {"a": 1, "b": 5, "c": 1}, RANGES)["final"], ids)
    assert list(r1) == [1, 2] and list(r2) == [2, 1]


def test_determinism():
    rng = np.random.default_rng(1)
    rows = np.column_stack([rng.uniform(0, 10, 300), rng.uniform(-5, 5, 300), rng.uniform(100, 300, 300)])
    a = similarity(stack(rows), TARGET, W, RANGES)["final"]
    b = similarity(stack(rows.copy()), dict(TARGET), dict(W), dict(RANGES))["final"]
    assert np.array_equal(a, b)


def test_missing_value_coverage():
    s = stack([[2.0, np.nan, 250.0]])
    r = similarity(s, TARGET, W, RANGES)
    assert r["final"][0] == 1.0
    assert r["coverage"][0] == pytest.approx(2 / 4)
    assert not r["eligible"][0]


def test_negative_weight_rejected():
    with pytest.raises(ValueError):
        similarity(stack([[1, 1, 1]]), TARGET, {"a": -1, "b": 1, "c": 1}, RANGES)


def test_classify_thresholds():
    assert classify(0.85) == "MATCH" and classify(0.8499) == "PARTIAL"
    assert classify(0.60) == "PARTIAL" and classify(0.5999) == "MISMATCH"


def test_tie_break_by_cell_id():
    r = cell_ranks(np.array([0.5, 0.9, 0.5]), np.array([10, 11, 3]))
    assert list(r) == [3, 1, 2]


def test_distinct_sites_separation():
    lat = np.array([0.0, 0.5, 10.0]); lon = np.array([0.0, 0.0, 0.0])
    keep = distinct_sites(np.array([0.9, 0.8, 0.7]), np.arange(3), lat, lon, n=3, min_sep_km=300)
    assert keep == [0, 2]


def test_clustering_is_deterministic():
    rng = np.random.default_rng(2)
    X = np.vstack([rng.normal(m, 0.05, (60, 3)) for m in (0.2, 0.5, 0.8)])
    scores = np.linspace(1, 0, len(X))
    a = constellations(scores, X, np.arange(len(X)))
    b = constellations(scores.copy(), X.copy(), np.arange(len(X)))
    assert a["k"] == b["k"] and np.array_equal(a["labels"], b["labels"])


def test_why_did_this_move_consistency():
    rng = np.random.default_rng(3)
    rows = np.column_stack([rng.uniform(0, 10, 200), rng.uniform(-5, 5, 200), rng.uniform(100, 300, 200)])
    s = stack(rows); ids = np.arange(200)
    w2 = {**W, "c": 3.0}
    m = why_did_this_move(s, TARGET, RANGES, ids, 17, W, w2)
    assert sum(m["contribution_delta_pts"].values()) == pytest.approx(m["overall_delta_pts"], abs=1e-9)


def test_ranges_include_targets():
    earth = {"x": np.array([0.0, 1.0])}
    r = compute_ranges(earth, [{"variables": {"x": 5.0}}, {"variables": {"x": None}}], ["x"])
    assert r["x"] == [0.0, 5.0]
