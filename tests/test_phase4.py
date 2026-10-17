"""Phase IV tests (Python): canonical registry schema and its rejection rules, source ↔ published parity,
readiness model v2 computed from explicit checks, offline regeneration, raw-data manifest checksums,
catalogue-only entries never scoreable, legacy targets unchanged, no copied fingerprints."""
import copy, hashlib, json, math, os, sys, types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.modules.setdefault("requests", types.ModuleType("requests"))
from src.registry import schema, readiness as RD, verify
from src.compute.variables import CRITERION_IDS as C

REG = json.load(open(os.path.join(ROOT, "public/data/registry.json")))
ATLAS = json.load(open(os.path.join(ROOT, "public/data/phase3/atlas.json")))
CAT = json.load(open(os.path.join(ROOT, "data/registry/catalog.json")))
GZ = json.load(open(os.path.join(ROOT, "data/raw/phase4/gazetteer_catalog.json")))
LEGACY = {t["id"]: t for t in json.load(open(os.path.join(ROOT, "data/targets.json")))["targets"]}
APP = json.load(open(os.path.join(ROOT, "public/data/app.json")))
TG = {t["id"]: t for t in REG["targets"]}
LOC = {l["id"]: l for l in REG["locations"]}


def _errs(mut):
    R = copy.deepcopy(REG); mut(R); return schema.validate(R)


def test_p4_registry_is_valid():
    assert schema.validate(REG) == []
    assert REG["schema"] == "asterro.registry/1" and REG["stack_sha256"] == APP["stack"]["sha256"]


def test_p4_schema_rejects_duplicate_ids():
    assert any("duplicate id" in e for e in _errs(lambda R: R["locations"].append(copy.deepcopy(R["locations"][0]))))


def test_p4_schema_rejects_bad_coordinates_and_non_finite():
    assert any("invalid coordinates" in e for e in _errs(lambda R: R["locations"][0].update(latitude=95.0)))
    assert any("invalid coordinates" in e for e in _errs(lambda R: R["locations"][0].update(longitude_east=float("nan"))))
    assert any("not finite" in e for e in _errs(lambda R: R["targets"][0]["fingerprint"]["variables"].update(slope=float("inf"))))


def test_p4_schema_rejects_bad_status_unit_provenance():
    assert any("unsupported criterion status" in e for e in _errs(lambda R: R["targets"][0]["fingerprint"]["criterion_status"].update(slope="ESTIMATED")))
    assert any("invalid unit" in e for e in _errs(lambda R: R["targets"][0]["fingerprint"]["units"].update(slope="rad")))
    assert any("without provenance" in e for e in _errs(lambda R: R["targets"][0]["fingerprint"]["provenance"].pop("slope")))
    assert any("unknown dataset" in e for e in _errs(lambda R: R["targets"][0]["fingerprint"]["provenance"].update(slope=["made_up"])))
    assert any("carries a value" in e for e in _errs(lambda R: R["targets"][1]["fingerprint"]["variables"].update(lst_diurnal_range=10.0)))


def test_p4_schema_rejects_bad_readiness_and_incomplete_analytical_target():
    assert any("invalid readiness level" in e for e in _errs(lambda R: R["targets"][0]["readiness"].update(level=7)))
    assert any("does not follow from its checks" in e for e in _errs(lambda R: R["targets"][1]["readiness"].update(level=4)))
    def enable_l1(R):
        t = next(t for t in R["targets"] if t["readiness"]["level"] == 2); t["scoring"]["earth_analogue_enabled"] = True
    assert any("enabled below readiness 3" in e for e in _errs(enable_l1))
    assert any("catalogue-only location must be readiness 1" in e for e in _errs(lambda R: next(l for l in R["locations"] if not l["target_ids"])["readiness"].update(level=2)))
    assert any("invalid readiness level" in e for e in _errs(lambda R: R["targets"][0]["readiness"].update(level=0)))
    assert any("dataset" in e and "missing license" in e for e in _errs(lambda R: R["datasets"][0].update(license="")))


def test_p4_schema_rejects_bad_comparison_experiment():
    assert any("invalid aggregate" in e for e in _errs(lambda R: R["comparison_experiments"][0].update(aggregate="sum")))
    def l1_pair(R):
        R["comparison_experiments"].append(dict(id="x", targets=["mars_jezero", "mars_elysium_planitia"], aggregate="minimum", scoring_config="atlas-direct-v1"))
    assert any("every target must be scoring-enabled" in e for e in _errs(l1_pair))


def test_p4_readiness_counts_and_rule():
    lv = [t["readiness"]["level"] for t in REG["targets"]]
    assert lv.count(4) == 16 and lv.count(2) == 17 and len(lv) == 33 and RD.MODEL_VERSION == "3.0.0"
    for t in REG["targets"]:
        again = RD.evaluate(t, {d["id"]: d for d in REG["datasets"]}, REG["compatibility"])
        assert again["level"] == t["readiness"]["level"]
        L = t["readiness"]["level"]
        assert all(c["passed"] for c in t["readiness"]["checks"] if c["level"] <= L)
        if L < 4:
            assert not all(c["passed"] for c in t["readiness"]["checks"] if c["level"] == L + 1)
    l4 = {t["id"] for t in REG["targets"] if t["readiness"]["level"] == 4}
    assert {"mars_jezero", "mars_gale_curiosity", "moon_south_pole", "moon_shackleton"} <= l4
    assert TG["moon_reiner_gamma"]["readiness"]["level"] == 2          # no valid Diviner GCP bins → MISSING


def test_p4_catalogue_only_locations_never_scoreable():
    only = [l for l in REG["locations"] if not l["target_ids"]]
    assert len(only) >= 30 and all(l["readiness"]["level"] == 1 for l in only)
    for t in REG["targets"]:
        assert t["scoring"]["earth_analogue_enabled"] == (t["readiness"]["level"] >= 3)
        assert (t["scoring"]["explore_ranges"] is None) == (t["readiness"]["level"] < 3)


def test_p4_source_published_parity_catalogue_and_gazetteer():
    regs = {r["id"]: r for r in REG["regions"]}
    assert [r["id"] for r in CAT["regions"]] == [r["id"] for r in REG["regions"]]
    for R in CAT["regions"]:
        assert set(R["targets"]) == set(regs[R["id"]]["target_ids"])
        for nm in R["features"]:
            g = GZ["features"][f"{R['body'].upper()}:{nm}"]
            lid = [l for l in REG["locations"] if l["region"] == R["id"] and l["name"] == g["name"]]
            assert len(lid) == 1, nm
            l = lid[0]
            assert l["latitude"] == float(g["center_lat"])
            assert abs(((float(g["center_lon"]) + 180) % 360 - 180) - l["longitude_east"]) < 1e-9
            assert l["source"]["url"] == g["link"]
    for l in REG["locations"]:
        assert l["region"] in regs and l["id"] in regs[l["region"]]["location_ids"]


def test_p4_source_published_parity_fingerprints():
    smap = {"DIRECT": "DIRECT", "PROXY": "PROXY", "INCOMPATIBLE": "N/A", "MISSING": "MISSING", "UNVALIDATED": "MISSING", "DERIVED": "DIRECT"}
    for a in ATLAS["targets"]:
        t = TG[a["id"]]; fp = t["fingerprint"]
        for c in C:
            assert fp["criterion_status"][c] == smap[a["status"][c]]
            if fp["criterion_status"][c] in ("DIRECT", "PROXY"):
                assert fp["variables"][c] == a["values"][c]
            else:
                assert fp["variables"][c] is None
        assert fp["content_sha256"] == RD.fingerprint_hash(fp)
        assert a["readiness"]["level"] == t["readiness"]["level"]          # the atlas carries readiness v2
        assert a["readiness_v1"]["label"]                                  # Phase III rule kept


def test_p4_legacy_targets_unchanged():
    for tid, lg in LEGACY.items():
        t = TG[tid]
        assert t["legacy"] and t["scoring"]["default_explore"] == "legacy-baseline-v1"
        assert t["scoring"]["explore_ranges"] == APP["ranges"]
        for c in C:
            assert t["fingerprint"]["variables"][c] == lg["variables"][c]
    x = REG["comparison_experiments"][0]
    assert x["id"] == "legacy_cross_planet" and x["aggregate"] == "minimum" and x["targets"] == ["mars_jezero", "moon_south_pole"]


def test_p4_no_copied_fingerprints():
    seen = {}
    for t in REG["targets"]:
        key = json.dumps({c: t["fingerprint"]["variables"][c] for c in ("slope", "surface_roughness", "lst_diurnal_range", "annual_temperature_range")}, sort_keys=True)
        assert key not in seen, (t["id"], seen.get(key))
        seen[key] = t["id"]


def test_p4_explore_ranges_rule():
    import numpy as np
    info = json.load(open(os.path.join(ROOT, "data/metadata/stack_build.json")))
    buf = open(os.path.join(ROOT, "public/data/stack.bin"), "rb").read()
    A = {L["name"]: np.frombuffer(buf, dtype=L["dtype"], count=L["length"], offset=L["offset"]) for L in info["layout"] if L["name"] in C}
    for t in REG["targets"]:
        if t["legacy"] or t["readiness"]["level"] < 3:
            continue
        for c in C:
            lo, hi = float(np.nanmin(A[c])), float(np.nanmax(A[c]))
            v = t["fingerprint"]["variables"][c]
            if v is not None:
                lo, hi = min(lo, v), max(hi, v)
            assert t["scoring"]["explore_ranges"][c] == [lo, hi], (t["id"], c)


def test_p4_offline_regeneration_and_manifest():
    man = json.load(open(os.path.join(ROOT, "data/raw/phase4/MANIFEST.json")))
    for f in man["files"]:
        b = open(os.path.join(ROOT, f["path"]), "rb").read()
        assert len(b) == f["bytes"] and hashlib.sha256(b).hexdigest() == f["sha256"], f["path"]
    at = {t["id"]: t for t in ATLAS["targets"]}
    for tid in ("moon_shackleton", "moon_aristarchus", "mars_gale_curiosity", "mars_jezero", "moon_south_pole"):
        rg = verify.regenerate(at[tid], legacy=tid in LEGACY)
        assert rg["passed"], (tid, rg["summary"])
    for t in REG["targets"]:
        if t["readiness"]["level"] == 4:
            assert t["validation"]["regeneration"]["passed"]
        assert t["validation"]["scientific_validation"].startswith("Not performed")


def test_p4_regeneration_fails_explicitly_without_inputs():
    at = {t["id"]: t for t in ATLAS["targets"]}
    old = verify.RAW4
    try:
        verify.RAW4 = os.path.join(ROOT, "does-not-exist"); verify._GCP = None
        rg = verify.regenerate(at["moon_shackleton"])
        assert not rg["passed"] and "lst_diurnal_range" in rg["summary"]
        assert any("not present" in n for n in rg["inputs"])
    finally:
        verify.RAW4 = old; verify._GCP = None


def test_p4_scripts_recorded_by_checksum():
    for t in REG["targets"]:
        for p, h in t["provenance"]["scripts"].items():
            assert hashlib.sha256(open(os.path.join(ROOT, p), "rb").read()).hexdigest() == h, (t["id"], p)


def test_p4_thumbnails_are_real_files():
    for t in REG["targets"]:
        assert t["thumbnail"] and os.path.exists(os.path.join(ROOT, "public", t["thumbnail"])), t["id"]


def test_p4_no_secrets_in_registry():
    s = open(os.path.join(ROOT, "public/data/registry.json"), encoding="utf-8").read()
    for p in ("ghp_", "github_pat_", "AKIA", "Bearer ", "api_key", "password"):
        assert p not in s


def test_p4_scenario_set_replays_in_python():
    import subprocess
    fx = os.path.join(ROOT, "tests/phase4/fixtures/scenario_gale.json")
    p = subprocess.run([sys.executable, os.path.join(ROOT, "scripts/replay_scenario.py"), fx, "--repo", ROOT], capture_output=True, text=True)
    assert p.returncode == 0 and "REPRODUCED" in p.stdout, p.stdout + p.stderr
    cfg = json.load(open(fx)); cfg["scenarios"][0]["weights"]["slope"] = 2.5
    bad = os.path.join(ROOT, "tests/phase4/fixtures/_tampered.json")
    try:
        json.dump(cfg, open(bad, "w"))
        q = subprocess.run([sys.executable, os.path.join(ROOT, "scripts/replay_scenario.py"), bad, "--repo", ROOT], capture_output=True, text=True)
        assert q.returncode == 1 and "NOT REPRODUCED" in q.stdout
    finally:
        os.remove(bad)
