"""ASTERRO V20: USGS MRDS mineral-occurrence context, the inventory row, and the V20 interface files.

Tests that need the retained raw archive (data/v19/raw/mrds/, not committed) skip themselves when it is absent.
"""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from src.v20 import mrds
from src.v19x import common

PUB = os.path.join(ROOT, "public", "data", "v20", "mrds.json")
HAVE_RAW = os.path.exists(mrds.RAW_FILE)
ATACAMA = 76787


def _m():
    return json.load(open(PUB, encoding="utf-8"))


def test_mrds_product_metadata_and_honest_limits():
    m = _m()
    assert m["agency"].endswith("(not NASA)") and m["url"] == mrds.URL and m["raw_sha256"] == mrds.RAW_SHA256
    assert m["records"] == m["used"] + m["excluded_bad_coordinates"] and m["used"] > 300000
    assert m["country_share"][0][0] == "United States" and m["country_share"][0][2] > 80
    for w in ("not a composition map", "reporting density", "no record, never no minerals", "Not exploration or investment advice"):
        assert w in m["limitations"], w


def test_mrds_cells_are_valid_land_cells_and_fields_consistent():
    m = _m(); vc = set(int(c) for c in common.valid_cells())
    assert m["cell_fields"] == ["n_100km", "producers_100km", "nearest_km", "nearest", "top_commodities"]
    for k, (n, prod, near, idx, top) in m["cells"].items():
        assert int(k) in vc
        assert n >= 1 and 0 <= prod <= n and 0 <= near <= m["radius_km"] + 1e-6
        assert 0 <= idx < len(m["nearest_table"]) and len(top) <= 3 and all(0 <= t < len(m["commodities"]) for t in top)


def test_mrds_atacama_example():
    c = _m()["cells"][str(ATACAMA)]; t = _m()["nearest_table"][c[3]]
    assert c[0] == 68 and c[1] == 26 and abs(c[2] - 12.7) < 0.05
    assert t[1] == "Chepica" and t[2] == "Lithium" and t[4] == "Chile"


def test_mrds_nearest_distance_matches_haversine():
    m = _m(); c = m["cells"][str(ATACAMA)]; t = m["nearest_table"][c[3]]
    la, lo = common.cell_centres([ATACAMA])
    d = float(common.haversine_km(la[0], lo[0], t[5], t[6]))
    assert abs(d - c[2]) < 0.1


def test_mrds_rebuild_from_raw_is_identical():
    if not HAVE_RAW:
        print("SKIP raw MRDS archive not present"); return
    rows, rep = mrds.load()
    out = mrds.per_cell(rows); m = _m()
    assert rep["raw_sha256"] == m["raw_sha256"] and rep["used"] == m["used"]
    assert out["cells"] == {k: v for k, v in m["cells"].items()} and out["nearest_table"] == m["nearest_table"]


def test_mrds_rejects_a_different_archive():
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as f:
        f.write(b"not the archive")
    try:
        mrds.load(f.name); assert False, "a different archive was accepted"
    except ValueError as e:
        assert "hash mismatch" in str(e)
    finally:
        os.unlink(f.name)


def test_inventory_lists_mrds_as_cached_non_nasa():
    inv = json.load(open(os.path.join(ROOT, "public", "data", "v19", "env", "inventory.json"), encoding="utf-8"))
    r = [x for x in inv["rows"] if x["id"] == "usgs_mrds"]
    assert len(r) == 1 and not r[0]["nasa"] and r[0]["state"] == "CACHED" and r[0]["raw_sha256"] == mrds.RAW_SHA256
    assert inv["n"] == len(inv["rows"]) and sum(inv["counts"].values()) == inv["n"]
    old = [x for x in inv["rows"] if x["id"] == "v19_usgs_mrds"]
    assert old and "usgs_mrds" in (old[0].get("note") or "")


def test_v20_interface_keeps_every_view_reachable():
    js = open(os.path.join(ROOT, "app", "frontend", "phase4", "ui_34_v20.js"), encoding="utf-8").read()
    for tab in ("explore", "discover", "atlas", "lab", "local", "compare", "trajectory", "scenarios", "data", "method"):
        assert f'setTab("{tab}")' in js, tab
    nav = re.search(r"const V20_NAV = \[(.*?)\n\];", js, re.S).group(1)
    keys = re.findall(r'"([a-z]+)"', nav)
    groups = ["discover", "analyze", "plan", "evidence", "trust"]
    dests = [k for k in keys if k not in groups]
    assert [k for k in keys if k in groups][:5] == groups
    for k in ("home", "globe", "lab", "local", "lens", "character", "robust", "portfolio", "trajectory", "profiles", "passport", "trace", "reproduce", "reports", "journal", "catalogue", "sources", "gaps", "trustc", "method"):
        assert k in dests and re.search(r"\b" + k + r": \(\) =>", js), k


def test_v20_design_tokens_and_fonts():
    css = open(os.path.join(ROOT, "app", "frontend", "phase4", "v20_design.css"), encoding="utf-8").read()
    for c in ("#0B1D3A", "#102552", "#1E3A8A", "#3B82D8", "#93C5FD", "#DBEAFE", "#F8FAFC", "#334155", "#64748B", "#FD6E6E"):
        assert c in css, c
    assert '"Playfair Display"' in css and "--ds-font:Helvetica" in css
    for banned in ("Inter", "Geist", "Space Grotesk", "linear-gradient", "box-shadow:0", "animation:"):
        assert banned not in css, banned
