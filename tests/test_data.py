import json, os
import numpy as np
from src.data.validation.checks import check_stack, check_targets, PLAUSIBLE
from src.compute.variables import CRITERION_IDS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _stack():
    return np.load(os.path.join(ROOT, "data/predictor_stack.npz"))


def test_stack_values_plausible_and_masked():
    r = check_stack(_stack())
    assert r["n_valid"] > 50000
    for c in PLAUSIBLE:
        assert r[c]["in_bounds"], (c, r[c])
    for c in ("annual_temperature_range", "elevation", "slope", "surface_roughness", "lst_diurnal_range"):
        assert r[c]["finite"] == 1.0, c          # only aridity may be missing (Hargreaves undefined)


def test_valid_cell_coordinates():
    s = _stack(); ii, jj = np.nonzero(s["valid"])
    lat = -90 + 0.5 * ii; lon = -180 + 0.625 * jj
    assert lat.min() >= -90 and lat.max() <= 90 and lon.min() >= -180 and lon.max() < 180


def test_targets_schema_and_disclosure():
    t = json.load(open(os.path.join(ROOT, "data/targets.json")))["targets"]
    assert {x["id"] for x in t} == {"mars_jezero", "moon_south_pole"}
    assert check_targets(t, CRITERION_IDS)


def test_web_bundle_hash_matches_metadata():
    import hashlib
    info = json.load(open(os.path.join(ROOT, "data/metadata/stack_build.json")))
    h = hashlib.sha256(open(os.path.join(ROOT, "public/data/stack.bin"), "rb").read()).hexdigest()
    assert h == info["sha256"]


def test_normalization_ranges_cover_targets():
    app = json.load(open(os.path.join(ROOT, "public/data/app.json")))
    t = json.load(open(os.path.join(ROOT, "data/targets.json")))["targets"]
    for c, (lo, hi) in app["ranges"].items():
        for x in t:
            v = x["variables"][c]
            assert v is None or lo <= v <= hi
