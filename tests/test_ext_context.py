"""Site context (tai-ext-context-1.0.0): Koeppen-Geiger classes, environment types, illumination geometry, slope
shares, processes and operations tables. Everything is rebuilt offline from retained inputs; nothing enters a score."""
import base64, json, os, sys, tempfile
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from src.ext import context as CX

PUB = json.load(open(os.path.join(ROOT, "public/data/ext/context_ext.json")))


def test_context_document_rebuilds_offline_identically():
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "c.json")
        CX.build(p)
        assert json.load(open(p)) == PUB


def test_koppen_rules_on_textbook_cases():
    # hot desert: hot all year, almost no rain
    assert CX.koppen([20, 22, 25, 28, 32, 35, 36, 35, 32, 28, 24, 21], [1] * 12, 25) == "BWh"
    # ice cap: warmest month below 0 C
    assert CX.koppen([-30] * 6 + [-5] * 6, [10] * 12, -75) == "EF"
    # tundra: warmest month between 0 and 10 C, wet enough
    assert CX.koppen([-25, -24, -20, -12, -2, 4, 7, 6, 1, -8, -18, -23], [30] * 12, 70) == "ET"
    # tropical rainforest: every month >= 18 C and >= 60 mm
    assert CX.koppen([27] * 12, [200] * 12, 0) == "Af"
    # oceanic: mild winter, cool summer, rain all year
    assert CX.koppen([5, 5, 7, 9, 12, 15, 17, 17, 14, 11, 8, 6], [70] * 12, 50) == "Cfb"
    # missing input stays missing (never guessed)
    assert CX.koppen([float("nan")] * 12, [0] * 12, 0) is None


def test_koppen_per_cell_codes_are_complete_and_plausible():
    codes = np.frombuffer(base64.b64decode(PUB["koppen_b64"]), dtype=np.uint8)
    v = np.load(os.path.join(ROOT, "data/predictor_stack.npz"))["valid"]
    assert codes.size == int(v.sum()) == 76781
    K = PUB["koppen_classes"]
    known = codes[codes != PUB["koppen_missing"]]
    assert known.size / codes.size > 0.99
    cnt = {K[c]: int((codes == c).sum()) for c in range(len(K))}
    assert cnt["EF"] > 10000 and cnt["BWh"] > 2000 and cnt["ET"] > 1000   # Antarctica / Greenland, hot deserts, tundra
    assert sum(cnt.values()) == known.size == sum(PUB["koppen_counts"].values())


def test_environment_classes_are_the_natural_earth_labels():
    lab = json.load(open(os.path.join(ROOT, "data/raw/geo/labels.json")))
    assert PUB["region_featurecla"] == lab["region_featurecla"]
    assert {"Desert", "Plateau", "Range/mtn", "Basin", "Tundra", "Valley"} <= set(PUB["region_featurecla"])


def test_noon_elevation_geometry():
    assert CX.noon_elevation(0, "earth") == (90.0, 90.0 - 23.44)
    hi, lo = CX.noon_elevation(80, "earth")
    assert lo < 0 < hi                                   # polar night part of the year
    hi, lo = CX.noon_elevation(-89.9, "moon")
    assert abs(hi - (90 - (89.9 - 1.54))) < 1e-9 and hi < 2  # the lunar south pole: the sun stays near the horizon


def test_slope_shares_are_bounded_and_monotonic():
    for tid, s in PUB["target_slope"].items():
        f = s["frac_le"]
        assert all(0 <= a <= 1 for a in f) and all(a <= b + 1e-12 for a, b in zip(f, f[1:])), tid
    for k in ("earth_slope_le5_b64", "earth_slope_le15_b64"):
        a = np.frombuffer(base64.b64decode(PUB[k]), dtype=np.uint8)
        assert a.size == 76781 and ((a <= 250) | (a == 255)).all()
    a5 = np.frombuffer(base64.b64decode(PUB["earth_slope_le5_b64"]), dtype=np.uint8).astype(int)
    a15 = np.frombuffer(base64.b64decode(PUB["earth_slope_le15_b64"]), dtype=np.uint8).astype(int)
    ok = (a5 != 255) & (a15 != 255)
    assert (a5[ok] <= a15[ok]).all()


def test_processes_and_operations_tables_are_consistent():
    P = json.load(open(os.path.join(ROOT, "data/ext/processes.json")))
    D = {d["id"] for d in json.load(open(os.path.join(ROOT, "data/ext/dimensions.json")))["dimensions"]}
    ids = [p["id"] for p in P["processes"]]
    required = {"sedimentation", "dust_storms", "aeolian", "volcanic", "impact", "thermal_cycling", "water_alteration",
                "glacial", "permafrost", "evaporites", "fluvial", "surface_erosion"}   # the twelve processes the brief names
    assert required <= set(ids) and len(ids) == len(set(ids))
    for p in P["processes"]:
        assert p["status"] in ("data", "indirect", "no_data"), p["id"]
        if p["status"] == "no_data":
            assert not p.get("rule") and p.get("needs"), p["id"]
        else:
            assert p.get("rule"), p["id"]
        if p["status"] == "indirect":
            assert p.get("needs") and set(p["needs"]) <= D, p["id"]      # what would let the process itself be observed
    O = json.load(open(os.path.join(ROOT, "data/ext/operations.json")))["operations"]
    crit = {"aridity", "annual_temperature_range", "elevation", "slope", "surface_roughness", "lst_diurnal_range",
            "surface_temp_day", "surface_temp_night", "mean_air_temperature"}
    for o in O:
        assert set(o["conditions"]) <= crit and set(o["needs"]) <= D, o["id"]
        assert o["conditions"] or o["needs"], o["id"]


def test_context_never_enters_the_baseline():
    app = json.load(open(os.path.join(ROOT, "public/data/app.json")))
    assert app["algorithm_version"] == "tai-sim-1.0.0"
    assert sorted(c["id"] for c in app["criteria"]) == sorted(["aridity", "annual_temperature_range", "elevation", "slope", "surface_roughness", "lst_diurnal_range"])
