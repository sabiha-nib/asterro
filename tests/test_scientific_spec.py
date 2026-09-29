"""The 15 scientific test cases required by the ASTERRO audit specification, plus a Zarr round trip.

Synthetic arrays below are TEST INPUTS for the scoring code only; they are never shipped as data.
Cases 11, 12 and 15 run against the real repository data (predictor stack + targets.json).
"""
import json, math, os, subprocess, sys
import numpy as np
import pytest
from src.compute.similarity import similarity, effective_scores, cross_planet, MIN_COVERAGE
from src.compute.ranking import cell_ranks, distinct_sites, haversine_km, order
from src.compute.normalization import compute_ranges
from src.compute.variables import CRITERION_IDS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = ["a", "b", "c", "d", "e"]
RANGES = {"a": [0.0, 10.0], "b": [-5.0, 5.0], "c": [100.0, 300.0], "d": [0.0, 1.0], "e": [0.0, 50.0]}
TARGET = {"a": 2.0, "b": 1.0, "c": 250.0, "d": 0.0, "e": 20.0}
W = {"a": 1.0, "b": 1.0, "c": 1.0, "d": 1.0, "e": 1.0}   # equal weights -> coverage steps of 0.2


def stack(rows):
    rows = np.asarray(rows, dtype=float)
    return {c: rows[:, i] for i, c in enumerate(C)}


EXACT = [2.0, 1.0, 250.0, 0.0, 20.0]


# 1 ---------------------------------------------------------------------------------------------
def test_01_exact_match_scores_exactly_one():
    r = similarity(stack([EXACT]), TARGET, W, RANGES)
    assert r["final"][0] == 1.0
    assert all(r["criterion_similarity"][c][0] == 1.0 for c in C)
    assert all(r["normalized_difference"][c][0] == 0.0 for c in C)


# 2 ---------------------------------------------------------------------------------------------
def test_02_similarity_is_clipped_to_unit_interval():
    far = [1e6, -1e6, 1e9, 50.0, -1e4]          # every |d| >> 1
    r = similarity(stack([far, EXACT]), TARGET, W, RANGES)
    for c in C:
        assert r["normalized_difference"][c][0] > 1          # d itself is NOT clipped
        assert r["criterion_similarity"][c][0] == 0.0        # s = clip(1 - d, 0, 1)
    assert r["final"][0] == 0.0 and r["final"][1] == 1.0
    assert np.all((r["final"] >= 0) & (r["final"] <= 1))


# 3 ---------------------------------------------------------------------------------------------
def test_03_zero_weight_has_no_influence():
    a = list(EXACT); b = list(EXACT); b[2] = 100.0            # differ only in criterion c
    r = similarity(stack([a, b]), TARGET, {**W, "c": 0.0}, RANGES)
    assert "c" not in r["active"]
    assert r["final"][0] == r["final"][1] == 1.0
    assert r["weight_sum"] == 4.0


# 4 ---------------------------------------------------------------------------------------------
def test_04_missing_earth_value_is_excluded_not_filled():
    row = list(EXACT); row[0] = np.nan; row[1] = 5.0          # a missing; b imperfect
    r = similarity(stack([row]), TARGET, W, RANGES)
    s_b = 1 - abs(5.0 - 1.0) / 10.0
    assert r["final"][0] == pytest.approx((s_b + 3) / 4, rel=0, abs=1e-15)   # renormalised over 4
    assert math.isnan(r["criterion_similarity"]["a"][0])                    # never imputed
    assert math.isnan(r["weighted_contribution"]["a"][0])
    assert r["coverage"][0] == pytest.approx(0.8, rel=0, abs=1e-15)


# 5 ---------------------------------------------------------------------------------------------
def test_05_null_target_value_excludes_criterion_everywhere():
    row = list(EXACT); row[4] = -999.0
    r = similarity(stack([row]), {**TARGET, "e": None}, W, RANGES)
    assert r["active"] == ["a", "b", "c", "d"]
    assert "e" not in r["criterion_similarity"]
    assert r["final"][0] == 1.0 and r["coverage"][0] == 1.0   # N/A does not reduce coverage


# 6 ---------------------------------------------------------------------------------------------
def test_06_coverage_below_threshold_is_ineligible():
    row = list(EXACT); row[0] = row[1] = np.nan               # 3 of 5 equal weights -> 0.6
    r = similarity(stack([row]), TARGET, W, RANGES)
    assert r["coverage"][0] == pytest.approx(0.6, rel=0, abs=1e-15) and 0.6 < MIN_COVERAGE
    assert not r["eligible"][0]
    assert effective_scores(r)[0] == -1.0                     # ranked below every eligible cell
    assert r["final"][0] == 1.0                               # the score exists but is not ranked


# 7 ---------------------------------------------------------------------------------------------
def test_07_coverage_exactly_at_threshold_is_eligible():
    assert MIN_COVERAGE == 0.80
    row = list(EXACT); row[0] = np.nan                        # 4/5 = 0.8 (floating point 0.8)
    r = similarity(stack([row]), TARGET, W, RANGES)
    assert r["coverage"][0] == pytest.approx(0.8, rel=0, abs=1e-15)
    assert r["eligible"][0]
    assert effective_scores(r)[0] == 1.0


# 8 ---------------------------------------------------------------------------------------------
def test_08_tie_break_is_score_desc_then_cell_id_asc():
    scores = np.array([0.7, 0.9, 0.7, 0.7, 0.9])
    ids = np.array([40, 12, 5, 33, 7])
    assert list(ids[order(scores, ids)]) == [7, 12, 5, 33, 40]
    assert list(cell_ranks(scores, ids)) == [5, 2, 3, 4, 1]
    perm = np.array([3, 0, 4, 2, 1])                          # input order must not matter
    assert list(ids[perm][order(scores[perm], ids[perm])]) == [7, 12, 5, 33, 40]


# 9 ---------------------------------------------------------------------------------------------
def test_09_distinct_sites_are_at_least_300_km_apart():
    rng = np.random.default_rng(9)
    lat = rng.uniform(-60, 70, 3000); lon = rng.uniform(-180, 180, 3000)
    scores = rng.uniform(0, 1, 3000); ids = np.arange(3000)
    keep = distinct_sites(scores, ids, lat, lon, n=25, min_sep_km=300.0)
    assert len(keep) == 25 and keep[0] == int(order(scores, ids)[0])
    for i in range(len(keep)):
        for j in range(i + 1, len(keep)):
            assert haversine_km(lat[keep[i]], lon[keep[i]], lat[keep[j]], lon[keep[j]]) >= 300.0
    # a 299 km neighbour is suppressed, a 301 km one is kept (1 deg lat = 111.195 km on R=6371.0088)
    k = distinct_sites(np.array([0.9, 0.8, 0.7]), np.arange(3), np.array([0.0, 299 / 111.1951, 0.0]),
                       np.array([0.0, 0.0, 301 / 111.1951]), n=3, min_sep_km=300.0)
    assert k == [0, 2]


# 10 --------------------------------------------------------------------------------------------
def test_10_cross_planet_score_is_the_minimum():
    a = np.array([0.9, 0.4, 0.8, -1.0, 0.7])
    b = np.array([0.5, 0.6, 0.8, 0.9, -1.0])
    assert list(cross_planet(a, b)) == [0.5, 0.4, 0.8, -1.0, -1.0]
    # a cell that is excellent for one target but poor for the other never outranks a balanced one
    c = cross_planet(np.array([1.0, 0.7]), np.array([0.3, 0.7]))
    assert c[1] > c[0]


# 11 --------------------------------------------------------------------------------------------
def _reproduce(cfg):
    p = subprocess.run([sys.executable, "-m", "scripts.reproduce", os.path.join("tests/fixtures", cfg)],
                       cwd=ROOT, capture_output=True, text=True)
    assert p.returncode == 0, p.stdout + p.stderr
    assert p.stdout.count("[OK]") == 3


def test_11_reproducibility_record_round_trips():
    for cfg in ("repro_moon.json", "repro_cross.json", "repro_mars_custom.json"):
        _reproduce(cfg)
    # the full-field reference exported from the Python engine is reproduced bit-for-bit
    from scripts.export_reference import load_bundle
    ref = json.load(open(os.path.join(ROOT, "tests/fixtures/reference.json")))
    _, A = load_bundle(ROOT)
    E = {c: A[c].astype(np.float64) for c in CRITERION_IDS}
    T = {t["id"]: t for t in json.load(open(os.path.join(ROOT, "data/targets.json")))["targets"]}
    R = {c: tuple(v) for c, v in ref["ranges"].items()}
    from src.compute.sensitivity import MISSION_PROFILES
    general = MISSION_PROFILES["general"]["weights"]
    for tid in ("mars_jezero", "moon_south_pole"):
        f = effective_scores(similarity(E, T[tid]["variables"], general, R))
        stored = np.fromfile(os.path.join(ROOT, f"tests/fixtures/ref_{tid}.f64"), dtype="<f8")
        assert np.array_equal(f, stored, equal_nan=True), tid


# 12 --------------------------------------------------------------------------------------------
def test_12_normalization_ranges_are_fixed_and_target_independent():
    app = json.load(open(os.path.join(ROOT, "public/data/app.json")))
    ranges = app["ranges"]
    assert set(ranges) == set(CRITERION_IDS)
    # one shared range table: the app stores no per-target ranges
    assert all(isinstance(v, list) and len(v) == 2 and v[1] > v[0] for v in ranges.values())
    # recomputing from the data gives the same table
    from scripts.export_reference import load_bundle
    _, A = load_bundle(ROOT)
    T = json.load(open(os.path.join(ROOT, "data/targets.json")))["targets"]
    E = {c: A[c].astype(np.float64) for c in CRITERION_IDS}
    rec = compute_ranges(E, T, CRITERION_IDS)
    for c in CRITERION_IDS:
        assert rec[c][0] == ranges[c][0] and rec[c][1] == ranges[c][1], c
    # switching the selected target does not change a criterion's range: s depends on the
    # target only through t, never through (max - min)
    r_j = similarity({"x": np.array([3.0])}, {"x": 1.0}, {"x": 1.0}, {"x": [0.0, 10.0]})
    r_m = similarity({"x": np.array([3.0])}, {"x": 5.0}, {"x": 1.0}, {"x": [0.0, 10.0]})
    assert r_j["normalized_difference"]["x"][0] == r_m["normalized_difference"]["x"][0] == 0.2


# 13 --------------------------------------------------------------------------------------------
def test_13_invalid_weights_are_rejected():
    for bad in (-1.0, float("nan"), float("inf"), -float("inf")):
        with pytest.raises(ValueError):
            similarity(stack([EXACT]), TARGET, {**W, "b": bad}, RANGES)
    with pytest.raises(ValueError):                           # all zero -> nothing to score
        similarity(stack([EXACT]), TARGET, {c: 0.0 for c in C}, RANGES)
    for bad_range in ([1.0, 1.0], [2.0, 1.0], [0.0, float("nan")]):
        with pytest.raises(ValueError):
            similarity(stack([EXACT]), TARGET, W, {**RANGES, "a": bad_range})


# 14 --------------------------------------------------------------------------------------------
def test_14_out_of_range_and_non_finite_inputs():
    rows = [[-50.0, 1.0, 250.0, 0.0, 20.0],                   # below range min
            [60.0, 1.0, 250.0, 0.0, 20.0],                    # above range max
            [np.inf, 1.0, 250.0, 0.0, 20.0]]                  # infinite Earth value -> treated as missing
    r = similarity(stack(rows), TARGET, W, RANGES)
    assert r["criterion_similarity"]["a"][0] == 0.0 and r["criterion_similarity"]["a"][1] == 0.0
    assert r["final"][0] == r["final"][1] == pytest.approx(0.8, rel=0, abs=1e-15)
    assert not np.isfinite(r["criterion_similarity"]["a"][2])
    assert r["coverage"][2] == pytest.approx(0.8, rel=0, abs=1e-15)
    assert np.all(np.isfinite(r["final"])) and np.all((r["final"] >= 0) & (r["final"] <= 1))


# 15 --------------------------------------------------------------------------------------------
def test_15_proxy_metadata_is_explicit_and_consistent():
    t = json.load(open(os.path.join(ROOT, "data/targets.json")))["targets"]
    for x in t:
        assert set(x["status"]) == set(CRITERION_IDS)
        for c, st in x["status"].items():
            assert st in ("DIRECT", "PROXY", "N/A")
            assert (st == "PROXY") == bool(x["proxy_flags"][c])
            assert (st == "N/A") == (x["variables"][c] is None)
            if st == "PROXY":
                assert x["methodology"][c].startswith("PROXY.") and x["proxy_method"][c]
            if st == "N/A":
                assert x["methodology"][c].startswith("NOT APPLICABLE")
        assert "not physical" in x["interpretation"]
    T = {x["id"]: x for x in t}
    assert T["mars_jezero"]["status"]["aridity"] == T["moon_south_pole"]["status"]["aridity"] == "PROXY"
    assert T["mars_jezero"]["status"]["elevation"] == T["moon_south_pole"]["status"]["elevation"] == "PROXY"
    assert T["moon_south_pole"]["status"]["annual_temperature_range"] == "N/A"
    # the web client ships the same status table (no proxy silently presented as direct)
    web = json.load(open(os.path.join(ROOT, "public/data/targets.json")))["targets"]
    assert {w["id"]: w["status"] for w in web} == {x["id"]: x["status"] for x in t}


# Zarr ------------------------------------------------------------------------------------------
def test_zarr_store_matches_npz():
    from src.data.preprocessing.zarr_v2 import read_array
    z = os.path.join(ROOT, "data/predictor_stack.zarr")
    meta = json.load(open(os.path.join(z, ".zmetadata")))["metadata"]
    assert meta[".zgroup"]["zarr_format"] == 2
    n = np.load(os.path.join(ROOT, "data/predictor_stack.npz"))
    for k in n.files:
        ref = n[k].astype(np.uint8) if k == "valid" else n[k]
        assert np.array_equal(read_array(z, k), ref, equal_nan=True), k
        assert f"{k}/.zarray" in meta
