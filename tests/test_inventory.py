"""Data inventory tests: what the interface calls integrated, blocked or a limitation is what the project state shows.

    python3 -m pytest tests/test_inventory.py -q
"""
import hashlib, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding="utf8"))
INV = J("data/inventory/inventory.json")
REG = J("public/data/registry.json")
MAN = J("data/provenance/manifest.json")
PROBE = J("data/inventory/probe.json")
STATUSES = {"integrated", "verified_not_integrated", "downloaded_not_validated", "known_limitation", "not_investigated", "unavailable", "blocked"}


def test_statuses_are_the_defined_set():
    assert set(INV["statuses"]) == STATUSES
    for it in INV["items"]:
        assert it["status"] in STATUSES, it["id"]
    counts = {}
    for it in INV["items"]:
        counts[it["status"]] = counts.get(it["status"], 0) + 1
    assert counts == INV["counts"]


def test_integrated_means_a_registry_dataset_record():
    reg_ids = {d["id"] for d in REG["datasets"]}
    integ = {it["id"] for it in INV["items"] if it["status"] == "integrated"}
    assert integ == reg_ids, (integ ^ reg_ids)
    for it in INV["items"]:
        if it["id"] in reg_ids:
            assert it["status"] == "integrated"
        else:
            assert it["status"] != "integrated", f"{it['id']} is not in the registry, so it cannot be integrated"


def test_no_candidate_claims_a_download():
    for it in INV["items"]:
        if it["status"] in ("blocked", "unavailable", "not_investigated"):
            for k in ("sha256", "checksum", "file", "retrieved"):
                v = it.get(k)
                assert not v or "not" in str(v).lower() or "fail" in str(v).lower(), f"{it['id']}.{k} = {v!r} looks like a completed download"
    assert not any(it["status"] in ("verified_not_integrated", "downloaded_not_validated") for it in INV["items"]), \
        "no dataset was downloaded in this build; a status saying so would be false"


def test_blocked_matches_the_recorded_probe():
    res = PROBE["results"]
    for it in INV["items"]:
        if it["status"] == "blocked":
            r = res.get(it["id"]) or res.get(it.get("probe_id", ""))
            assert r is not None, f"{it['id']} is blocked but no probe result is recorded"
            assert r.get("reachable") is False, f"{it['id']} is marked blocked but the probe reached it"
    assert INV["probed_utc"] == PROBE["probed_utc"]


def test_raw_inputs_still_match_their_checksums():
    n = 0
    for rec in MAN["raw_inputs"]:
        want, path = rec.get("sha256"), rec["file"]
        p = next((q for q in (os.path.join(ROOT, "data/raw", path), os.path.join(ROOT, path)) if os.path.exists(q)), None)
        assert want and p, f"raw input {path} missing or without checksum"
        h = hashlib.sha256(open(p, "rb").read()).hexdigest()
        assert h == want, path
        n += 1
    assert n >= 5, f"only {n} raw inputs re-hashed"


def test_interface_copy_equals_the_inventory():
    src = open(os.path.join(ROOT, "app/frontend/phase4/data_inventory.js"), encoding="utf8").read()
    m = re.search(r"ASTERRO_INVENTORY\s*=\s*(\{.*\});?\s*$", src, re.S)
    assert m
    js = json.loads(m.group(1))
    assert [(x["id"], x["status"]) for x in js["items"]] == [(x["id"], x["status"]) for x in INV["items"]]


def test_inventory_rebuild_is_reproducible():
    before = open(os.path.join(ROOT, "data/inventory/inventory.json"), encoding="utf8").read()
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts/build_inventory.py")], check=True, capture_output=True)
    after = open(os.path.join(ROOT, "data/inventory/inventory.json"), encoding="utf8").read()
    strip = lambda s: re.sub(r'"(generated_utc|built_utc)": "[^"]*"', "", s)
    assert strip(before) == strip(after)


def test_scoring_is_still_six_dimensions():
    app = J("public/data/app.json")
    assert sorted(c["id"] for c in app["criteria"]) == sorted(["aridity", "annual_temperature_range", "elevation", "slope", "surface_roughness", "lst_diurnal_range"])
    assert app["algorithm_version"] == "tai-sim-1.0.0"
