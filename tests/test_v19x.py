"""V19 data extension: parsing, units, grid joins, missing data, provenance, failures, checksums, inventory.

Run with the project's Python test runner (tests/run_py_tests.py style: every test_* function is called).
Tests that need retained raw files skip themselves when data/v19/raw is absent (the raw files live in the user's
Downloads/asterro_data and in the build workspace; they are not committed).
"""
import copy, gzip, hashlib, io, json, os, sys
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from src.v19x import power, gibs, gvp, sites, cmr, common, inventory

ENV = os.path.join(ROOT, "public", "data", "v19", "env")
HAVE_RAW = os.path.isdir(common.RAW) and os.path.exists(os.path.join(common.RAW, "power", "asterro_power_WS10M.json.gz"))


def _body(points, param="WS10M", units="m/s", sources=("MERRA2", "POWER")):
    j = {"type": "FeatureCollection", "features": [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [lo, la, 0]},
         "properties": {"parameter": {param: dict(zip(power.MONTHS, vals))}}} for la, lo, vals in points],
         "header": {"fill_value": -999.0, "start": "20010101", "end": "20251231", "api": {"version": "v2.10.1"}, "sources": list(sources)},
         "parameters": {param: {"units": units, "longname": "x"}}}
    t = json.dumps(j); return {"url": "u", "status": 200, "utc": "2026-11-10T00:00:00Z", "sha256": hashlib.sha256(t.encode()).hexdigest(), "body": t}


def _raw(responses, param="WS10M"):
    return {"parameter": param, "responses": responses}


def test_power_fill_value_is_missing_never_zero():
    r = _raw([_body([(-23.5, -68.125, [-999.0] * 12 + [-999.0])])])
    v, rep = power.parse("WS10M", r)
    c = common.cell_of(-23.5, -68.125)
    assert np.all(np.isnan(v[c])) and rep["fill_values"] == 13


def test_power_overlap_must_agree():
    a = _body([(-23.5, -68.125, [1.0] * 13)]); b = _body([(-23.5, -68.125, [1.0] * 12 + [2.0])])
    try:
        power.parse("WS10M", _raw([a, b])); assert False, "conflicting overlap accepted"
    except power.ValidationError:
        pass
    v, rep = power.parse("WS10M", _raw([a, copy.deepcopy(a)]))
    assert rep["overlap_points"] == 1 and rep["overlap_conflicts"] == 0


def test_power_hash_mismatch_and_failures_are_not_data():
    a = _body([(-23.5, -68.125, [1.0] * 13)]); a["sha256"] = "0" * 64
    try:
        power.parse("WS10M", _raw([a])); assert False
    except power.ValidationError:
        pass
    fail = {"url": "u2", "status": 429, "utc": "t", "body": "{\"header\": \"too many requests\"}"}
    v, rep = power.parse("WS10M", _raw([_body([(-23.5, -68.125, [1.0] * 13)]), fail]))
    assert rep["ok"] == 1 and rep["failed"][0]["status"] == 429 and np.isfinite(v).any()


def test_power_units_and_bounds_checked():
    try:
        power.parse("WS10M", _raw([_body([(-23.5, -68.125, [1.0] * 13)], units="km/h")])); assert False
    except power.ValidationError:
        pass
    try:
        power.parse("WS10M", _raw([_body([(-23.5, -68.125, [99.0] * 13)])])); assert False
    except power.ValidationError:
        pass


def test_power_one_degree_grid_and_all_zero_aod():
    # 1 deg box centres, including 2.5 E which also lies on the 0.625 deg grid
    pts = [(-89.5, 2.5, [0.0] * 13), (-23.5, -68.5, [0.1] * 12 + [0.1])]
    v, rep = power.parse("AOD_55", _raw([_body(pts, "AOD_55", "dimensionless", ("SYN1DEG",))], "AOD_55"))
    assert rep["grid"] == "1deg" and rep.get("all_zero_to_missing") == 1
    c = common.cell_of(-23.5, -68.125)                      # inside the 1 deg box centred at -23.5, -68.5
    assert abs(v[c, 12] - 0.1) < 1e-9
    assert np.all(np.isnan(v[common.cell_of(-89.5, 2.5)]))


def test_grid_cell_join():
    assert common.cell_of(-90, -180) == 0 and common.cell_of(-23.5, -68.125) == 76787
    la, lo = common.cell_centres([76787]); assert la[0] == -23.5 and lo[0] == -68.125
    try:
        common.cell_of(-23.4, -68.125); assert False
    except ValueError:
        pass


def test_gibs_transparent_pixels_never_take_opaque_meanings():
    from PIL import Image
    xml = '<ColorMap><ColorMapEntry rgb="0,0,0" transparent="false" sourceValue="[9501,9751)" value="[0.9501,0.9751)"/>' \
          '<ColorMapEntry rgb="10,20,30" transparent="false" sourceValue="[1,2)" value="[0.1,0.2)"/></ColorMap>'
    lut = gibs.parse_colormap(xml)
    a = np.zeros((2, 2, 4), np.uint8); a[0, 0] = (10, 20, 30, 255); a[0, 1] = (0, 0, 0, 255)   # bottom row: transparent black
    buf = io.BytesIO(); Image.fromarray(a, "RGBA").save(buf, "PNG")
    v, st, _ = gibs.decode(buf.getvalue(), lut, 2, 2)
    assert abs(v[0] - 0.15) < 1e-6 and abs(v[1] - 0.9626) < 1e-3 and np.isnan(v[2]) and np.isnan(v[3])


def test_gibs_unknown_opaque_colour_fails_and_open_bins_are_flagged():
    from PIL import Image
    xml = '<ColorMap><ColorMapEntry rgb="1,1,1" transparent="false" value="[0,5e-10)"/><ColorMapEntry rgb="2,2,2" transparent="false" value="[9.000e-08,+INF)"/></ColorMap>'
    lut = gibs.parse_colormap(xml)
    a = np.zeros((1, 2, 4), np.uint8); a[0, 0] = (2, 2, 2, 255); a[0, 1] = (9, 9, 9, 255)
    buf = io.BytesIO(); Image.fromarray(a, "RGBA").save(buf, "PNG")
    try:
        gibs.decode(buf.getvalue(), lut, 2, 1); assert False
    except gibs.ValidationError:
        pass
    a[0, 1] = (1, 1, 1, 255); buf = io.BytesIO(); Image.fromarray(a, "RGBA").save(buf, "PNG")
    v, st, top = gibs.decode(buf.getvalue(), lut, 2, 1)
    assert top[0] and not top[1] and abs(v[0] - 9e-8) < 1e-15 and st["at_least_top_bin"] == 1


def test_cube_manifest_hash_and_cell_order():
    man = json.load(open(os.path.join(ENV, "cube.json"))); b = open(os.path.join(ENV, "cube.bin"), "rb").read()
    assert len(b) == man["bytes"] and hashlib.sha256(b).hexdigest() == man["sha256"]
    assert man["cell_order_sha256"] == hashlib.sha256(common.valid_cells().astype("<i4").tobytes()).hexdigest()
    assert len(b) == man["n"] * 2 * len(man["variables"])
    ids = [v["id"] for v in man["variables"]]; assert len(ids) == len(set(ids))
    for v in man["variables"]:
        for k in ("label", "units", "datasets", "agency", "kind", "resolution", "period"):
            assert v.get(k) not in (None, ""), (v["id"], k)


def test_cube_missing_stays_missing():
    man = json.load(open(os.path.join(ENV, "cube.json"))); a = np.frombuffer(open(os.path.join(ENV, "cube.bin"), "rb").read(), "<i2").reshape(len(man["variables"]), man["n"])
    vid = {v["id"]: k for k, v in enumerate(man["variables"])}
    la, _ = common.cell_centres(common.valid_cells())
    if "evi_mean" in vid:       # no vegetation index over Antarctica
        assert np.all(a[vid["evi_mean"]][la < -70] == man["nodata"])
    if HAVE_RAW and "aod550_ceres" in vid:   # every value POWER leaves missing (fill, or zero in all 12 months) is missing in the cube
        v, rep = power.parse("AOD_55"); ann = v[common.valid_cells(), 12]; q = a[vid["aod550_ceres"]]
        assert rep.get("all_zero_to_missing", 0) > 0
        assert np.array_equal(np.isnan(ann), q == man["nodata"])
        ok = ~np.isnan(ann); assert np.all(np.abs(q[ok] * 0.001 - ann[ok]) <= 0.0005 + 1e-9)


def test_cube_atacama_values():
    man = json.load(open(os.path.join(ENV, "cube.json"))); a = np.frombuffer(open(os.path.join(ENV, "cube.bin"), "rb").read(), "<i2").reshape(len(man["variables"]), man["n"])
    vid = {v["id"]: k for k, v in enumerate(man["variables"])}; i = int(np.flatnonzero(common.valid_cells() == 76787)[0])
    val = lambda k: a[vid[k], i] * man["variables"][vid[k]]["scale"]
    assert val("volc_holo_100km") == 15 and 40 < val("volc_nearest_km") < 42
    assert val("lc_dominant") == 16 and val("lc_barren") > 0.9


def test_temporal_metadata():
    man = json.load(open(os.path.join(ENV, "cube.json")))
    for v in man["variables"]:
        if v["datasets"][0].startswith("power_"):
            assert "2001-2025" in v["period"], v
    s = man["sources"]
    for k, x in s.items():
        if k.startswith("power_"): assert x["period"] == "2001-2025"


def test_inventory_states_and_attribution():
    I = json.load(open(os.path.join(ENV, "inventory.json")))
    allowed = set(I["states"]) | {"NOT_INVESTIGATED"}
    assert I["n"] == len(I["rows"]) and sum(I["counts"].values()) == I["n"]
    rows = {r["id"]: r for r in I["rows"]}
    for r in I["rows"]:
        assert r["state"] in allowed
        if "DOWNLOADED" in r["states"] and not r["id"].startswith("v19_"):
            assert r.get("raw_sha256"), r["id"]
        if "CACHED" in r["states"]:
            assert "INTEGRATED" in r["states"], r["id"]
    assert rows["power_ws10m"]["nasa"] and rows["power_ws10m"]["state"] == "CACHED"
    assert not rows["gvp_holocene_full"]["nasa"] and "not NASA" in rows["gvp_holocene_full"]["agency"]
    assert not rows["macrostrat_sites"]["nasa"] and not rows["gbif_sites"]["nasa"]
    auth = [r for r in I["rows"] if r["id"].startswith("cmr_") and "REQUIRES_AUTHENTICATION" in r["states"]]
    assert auth and all("Earthdata" in (r.get("access") or "") or "Login" in (r.get("limitations") or "") for r in auth)


def test_raw_provenance_and_cross_checks():
    if not HAVE_RAW:
        return
    man = json.load(open(os.path.join(ENV, "cube.json")))
    for k, x in man["sources"].items():
        if not x.get("raw_sha256"): continue
        name = {"power_": f"power/asterro_power_{k[6:]}.json.gz", "gibs_": f"gibs/asterro_gibs_{k[5:]}.json.gz", "gvp_": f"gvp/asterro_gvp_{k[4:]}.geojson",
                "sites_": f"sites/asterro_{k[6:]}_cells.json"}[next(p for p in ("power_", "gibs_", "gvp_", "sites_") if k.startswith(p))]
        assert common.sha256_file(os.path.join(common.RAW, name)) == x["raw_sha256"], k
    holo, _ = gvp.load("holocene"); cc = gvp.cross_check_samples(holo)
    assert cc["agree"] == cc["transcribed"] == 39 and not cc["differ"]
    S = sites.build(); c = S["cross_check"]
    assert c["cells_compared"] == c["map_units_agree"] == 16 and all(x["transcribed"] == x["download"] for x in c["gbif"])


def test_reproduce_land_cover_from_raw():
    if not HAVE_RAW:
        return
    man = json.load(open(os.path.join(ENV, "cube.json"))); a = np.frombuffer(open(os.path.join(ENV, "cube.bin"), "rb").read(), "<i2").reshape(len(man["variables"]), man["n"])
    vid = {v["id"]: k for k, v in enumerate(man["variables"])}
    d, items = gibs.load_bundle("MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual"); lut = gibs.parse_colormap(d["colormap_xml"])
    v, st, _ = gibs.decode(items[0]["png"], lut, d["width"], d["height"], "class"); fr = gibs.class_fractions(v, gibs.pixel_cells(d["width"], d["height"]), [16])
    want = np.rint(fr[16][common.valid_cells()] / 0.001).astype(np.int16)
    assert np.array_equal(want, a[vid["lc_barren"]])


def test_cmr_records_and_access():
    if not HAVE_RAW:
        return
    R = cmr.records()
    assert len(R) >= 30 and sum(r["found"] for r in R) >= 30
    for r in R:
        if r["found"]:
            assert r["concept_id"] and r["version"] and r["provider_id"]
            if r["requires_earthdata_login"]:
                assert "earthdata" in json.dumps(r.get("access_constraints") or "").lower() or r.get("cloud_hosted")


if __name__ == "__main__":
    n = f = 0
    for k, fn in sorted(globals().items()):
        if k.startswith("test_") and callable(fn):
            n += 1
            try:
                fn(); print("PASS test_v19x::" + k)
            except Exception as e:
                f += 1; print("FAIL test_v19x::" + k, repr(e)[:300])
    print(f"{n - f}/{n} passed"); sys.exit(1 if f else 0)
