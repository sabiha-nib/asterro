"""V19 products: baseline, Data Integration Registry (nine states), acquisition catalogue, access diagnostics and the
validation of the V17 patterns. Checks the published documents against a rebuild and against the V19 safeguards:
no dataset is integrated without retained, hashed files; a refusal by the build environment is never recorded as a
provider failure; the V17 registry and products are unchanged; missing data never receive a score."""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from src.v19 import registry as R, catalogue as C  # noqa: E402

PUB = {k: json.load(open(os.path.join(ROOT, "public/data/v19", k + ".json"))) for k in ["registry", "sources"]}
STATES = [s for s, _ in R.STATES]


def test_registry_rebuild_matches_published():
    assert json.loads(json.dumps(R.build(), sort_keys=True)) == json.loads(json.dumps(PUB["registry"], sort_keys=True))


def test_nine_states_and_every_row_in_one():
    reg = PUB["registry"]
    assert [s["id"] for s in reg["states"]] == STATES and len(STATES) == 9
    assert all(r["state"] in STATES for r in reg["sources"])
    assert sum(reg["counts"].values()) == len(reg["sources"])


def test_v17_registry_preserved_and_mapped():
    v17 = json.load(open(os.path.join(ROOT, "public/data/v17/registry.json")))
    base = json.load(open(os.path.join(ROOT, "data/v19/baseline.json")))["baseline"]["v17_products"]
    import hashlib
    assert hashlib.sha256(open(os.path.join(ROOT, "public/data/v17/registry.json"), "rb").read()).hexdigest() == base["public/data/v17/registry.json"]
    rows = {r["id"]: r for r in PUB["registry"]["sources"] if r.get("origin") != "v19_catalogue"}
    for s in v17["sources"]:
        r = rows[s["id"]]
        assert r["v17_state"] == s["state"]
        if s["state"].startswith("integrated"):
            assert r["state"] == R.V17_MAP[s["state"]]


def test_integration_needs_retained_hashed_files():
    for r in PUB["registry"]["sources"]:
        if not r["state"].startswith("integrated") and r["state"] not in ("acquired_awaiting_processing", "processing"):
            continue
        if r.get("origin") == "v19_catalogue":
            m = r.get("manifest")
            assert m and m["files"], r["id"]
            for p, h in m["files"].items():
                import hashlib
                assert hashlib.sha256(open(os.path.join(ROOT, p), "rb").read()).hexdigest() == h, p
        elif r.get("see"):  # a V17 row whose dataset was acquired under its V19 id: that row's manifest must hold hashed files
            m = next(x for x in PUB["registry"]["sources"] if x["id"] == r["see"]).get("manifest")
            assert m and m["files"], r["id"]
        else:
            assert r["v17_state"].startswith("integrated") or r["v17_state"] in ("acquired_awaiting_processing", "processing")


def test_environment_refusals_are_not_provider_failures():
    probe = json.load(open(os.path.join(ROOT, "data/v19/probe.json")))
    for a in probe["attempts"]:
        if a["class"] == "env_policy":
            assert re.search(r"Tunnel connection failed: 40[37]", a["error"])
    by = {}
    for a in probe["attempts"]:
        by.setdefault(a["dataset"], set()).add(a["class"])
    for r in PUB["registry"]["sources"]:
        cls = by.get(r["id"].replace("@v19", ""))
        if r["state"] == "access_blocked":
            assert cls and cls <= {"env_policy", "env_dns"}, r["id"]
        if r["state"] == "provider_unavailable":
            assert cls and "provider_error" in cls


def test_each_dataset_judged_on_its_own_routes():
    # same provider host, different datasets: states come from each dataset's own attempts
    st, last = R.state_from_attempts([{"class": "env_policy", "utc": "1"}], "none")
    assert st == "access_blocked"
    assert R.state_from_attempts([{"class": "env_policy", "utc": "1"}, {"class": "auth_required", "utc": "2"}], "none")[0] == "awaiting_credentials"
    assert R.state_from_attempts([{"class": "provider_error", "utc": "1"}], "none")[0] == "provider_unavailable"
    assert R.state_from_attempts([], "none")[0] == "not_investigated"


def test_catalogue_complete_and_honest():
    req = ["purpose", "provider", "dataset_id", "instrument", "docs", "routes", "auth", "license", "spatial", "temporal",
           "crs", "units", "coverage", "format", "processing", "validation", "value", "storage", "compute", "doc_status"]
    assert PUB["sources"] == json.loads(json.dumps(C.build()))
    for e in C.ENTRIES:
        assert all(e.get(k) not in (None, "", []) for k in req), e["id"]
        assert e["doc_status"] in ("verified_retained", "verified_response", "unverified")
        assert set(e["domains"]) <= set(C.DOMAINS)
    assert len(C.DOMAINS) == 16


def test_ml_validation_and_missing_rule():
    m = json.load(open(os.path.join(ROOT, "data/v19/ml_validation.json")))
    assert m["validates"] == json.load(open(os.path.join(ROOT, "public/data/v17/patterns.json")))["ml"]["version"]
    assert len(m["kmeans_seed_ari"]) == 5 and len(m["iforest_seed"]) == 5 and len(m["ablation"]) == 12
    mc = m["missing_checks"]
    assert mc["anomaly_none_equals_incomplete"] and mc["label_none_equals_incomplete"] and mc["rarity_scored_with_missing_criteria"] == 0
    assert abs(sum(b["cells_share"] for b in m["latitude_bias"]) - 1) < 1e-9
    assert "accuracy" not in json.dumps({k: v for k, v in m.items() if k != "note"})


def test_baseline_has_no_differences():
    import subprocess
    out = subprocess.run([sys.executable, os.path.join(ROOT, "scripts/v19_baseline.py"), "cab7a0c", "--check"], capture_output=True, text=True, cwd=ROOT)
    assert out.returncode == 0 and "differences: none" in out.stdout, out.stdout + out.stderr


def test_accepted_differences_are_only_the_v20_3_navigation_change():
    # the approved V20.3 change: two protected UI tests gained a navigation step, and the view buttons moved into
    # per-section submenus; nothing else may be accepted, and the engine, data and other protected files stay exact
    acc = json.load(open(os.path.join(ROOT, "data/v22/accepted_differences.json")))["accepted"]
    assert sorted(acc) == ["protected", "rendered_tabs"]
    assert sorted(acc["protected"]) == ["tests/phase2/ui_lab_smoke.py", "tests/ui_smoke.py"]
    old, new = acc["rendered_tabs"]
    assert sorted(old) == sorted(new) and len(new) == len(set(new)) == 10  # same ten views, only reordered


def test_site_samples_rebuild_is_reproducible():
    from src.v19 import samples as SM
    doc = SM.build(write=False)
    pub = json.load(open(os.path.join(ROOT, "public/data/v19/site_samples.json")))
    assert json.loads(json.dumps(doc, ensure_ascii=False, sort_keys=True)) == pub
    assert doc["n_sites"] == 16 and all(doc["validation"]["checks"].values())


def test_site_samples_reject_a_bad_transcription():
    """A volcano placed outside the box that returned it, or a unit with top age > base age, stops the build."""
    import copy
    from src.v19 import samples as SM
    raw = json.load(open(os.path.join(ROOT, "data/v19/samples/site_samples_raw.json")))
    real_load = json.load
    for mutate in (lambda r: r["volcanoes"]["355100"].__setitem__(3, 10.0),
                   lambda r: r["sites"]["jez2"]["macrostrat"]["units"][0].__setitem__(6, 900)):
        bad = copy.deepcopy(raw); mutate(bad)
        SM.json.load = lambda f, _b=bad: _b if f.name.endswith("site_samples_raw.json") else real_load(f)
        try:
            raised = False
            try:
                SM.build(write=False)
            except SystemExit:
                raised = True
            assert raised
        finally:
            SM.json.load = real_load


def test_site_sample_manifests_hash_their_files():
    import hashlib
    for k in ("macrostrat_units", "gvp_holocene", "gbif_extremophiles"):
        m = json.load(open(os.path.join(ROOT, "data/v19/acquired", k + ".json")))
        assert m["validation"]["passed"] and m["validation"]["open_questions"], k
        for p, h in m["files"].items():
            assert hashlib.sha256(open(os.path.join(ROOT, p), "rb").read()).hexdigest() == h, p
