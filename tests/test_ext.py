"""Thermal-extremes extension (tai-ext-thermal-1.0.0) and the extended fingerprint (explore-ext-thermal-v1).

The published document is rebuilt offline from retained inputs and must match; day - night must reproduce the
baseline's own published day-night range; Moon air temperature is NOT APPLICABLE; with the three new weights at 0
the extended field is the baseline field; the baseline engine, criteria and algorithm version are untouched."""
import json, os, tempfile
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import sys
sys.path.insert(0, ROOT)
from src.ext import thermal_absolute as TA, engine as X
from src.compute import similarity as SIM

PUB = json.load(open(os.path.join(ROOT, "public/data/ext/thermal_ext.json")))


def test_ext_document_rebuilds_offline_identically():
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "t.json")
        TA.build(p)
        assert json.load(open(p)) == PUB


def test_ext_day_minus_night_is_the_published_baseline_range():
    reg = {t["id"]: t for t in json.load(open(os.path.join(ROOT, "public/data/registry.json")))["targets"]}
    for tid, t in PUB["targets"].items():
        pub = reg[tid]["fingerprint"]["variables"]["lst_diurnal_range"]
        assert abs((t["surface_temp_day"] - t["surface_temp_night"]) - pub) < 1e-3, tid
        assert abs(t["check_dr"] - t["published_lst_diurnal_range"]) < 1e-3, tid


def test_ext_moon_air_temperature_not_applicable_and_mars_measured():
    for tid, t in PUB["targets"].items():
        if tid.startswith("moon_"):
            assert t["mean_air_temperature"] is None and t["status"]["mean_air_temperature"] == "N/A" and "no atmosphere" in t["na_reason"]["mean_air_temperature"]
        else:
            assert t["status"]["mean_air_temperature"] == "DIRECT" and 150 < t["mean_air_temperature"] < 260
            assert t["ls_bins_air"] == 12


def test_ext_targets_are_exactly_those_with_a_direct_thermal_measurement():
    reg = json.load(open(os.path.join(ROOT, "public/data/registry.json")))["targets"]
    want = {t["id"] for t in reg if t["fingerprint"]["criterion_status"]["lst_diurnal_range"] == "DIRECT"}
    assert set(PUB["targets"]) == want


def test_ext_zero_new_weights_is_the_baseline_field():
    st = X.load_stack()
    w = {c: 1 for c in X.BASE}
    for tid in ("mars_jezero", "moon_shackleton"):
        f = X.field(tid, {**w, "surface_temp_day": 0, "surface_temp_night": 0, "mean_air_temperature": 0}, st)
        tv, rg, _ = X.target(tid)
        b = SIM.effective_scores(SIM.similarity({c: st[0][c] for c in X.BASE}, {c: tv[c] for c in X.BASE}, w, {c: rg[c] for c in X.BASE}))
        assert np.array_equal(f["eff"], b), tid


def test_ext_reference_fixture_is_current():
    ref = json.load(open(os.path.join(ROOT, "tests/fixtures/ext_reference.json")))
    st = X.load_stack()
    k = ref["cases"][0]
    f = X.field(k["tid"], k["weights"], st)
    assert f["sites"] == k["sites"] and ref["zero_ext_equals_baseline"]


def test_ext_baseline_engine_untouched():
    app = json.load(open(os.path.join(ROOT, "public/data/app.json")))
    assert app["algorithm_version"] == "tai-sim-1.0.0" and len(app["criteria"]) == 6
    assert SIM.MIN_COVERAGE == 0.80
