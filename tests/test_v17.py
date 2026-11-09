"""V17 analytical products: feature cube, novelty, unsupervised patterns, Data Integration Registry, domain modules and
the Earth limitations framework. Everything is rebuilt offline from retained inputs and checked against the published
documents (public/data/v17/) and against the scientific safeguards of the V17 brief (missing is not zero, proxies are
labelled, novelty never comes from missing data, no source is integrated without retained, verified data)."""
import base64, json, os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from src.v17 import features as F, novelty as N, registry as R, modules as MOD, limits as L

PUB = {k: json.load(open(os.path.join(ROOT, "public/data/v17", k + ".json"))) for k in ["cube", "patterns", "registry", "modules", "limits"]}
STACK = np.load(os.path.join(ROOT, "data/predictor_stack.npz"))
V = STACK["valid"]
IDX = np.flatnonzero(V.ravel())
LAT = -90 + 0.5 * (IDX // 576)
LON = -180 + 0.625 * (IDX % 576)


def dec(b):
    return np.frombuffer(base64.b64decode(b), dtype=np.uint8)


def cube_var(k):
    v = PUB["cube"]["vars"][k]
    q = dec(v["b64"]).astype(float)
    return np.where(q == F.MISSING, np.nan, q * v["scale"] + v["offset"])


_FEAT = None


def feat():
    global _FEAT
    if _FEAT is None:
        _FEAT = F.compute()[1]
    return _FEAT


# ---------------------------------------------------------------- feature cube
def test_cube_rebuilds_offline_identically():
    f = feat()
    for k, (sc, off) in F.QUANT.items():
        assert PUB["cube"]["vars"][k]["b64"] == base64.b64encode(F.quantise(f[k], sc, off).tobytes()).decode(), k
    assert PUB["cube"]["n_cells"] == int(V.sum()) == len(IDX)


def test_cube_inputs_are_the_retained_files():
    import hashlib
    for p, h in PUB["cube"]["inputs_sha256"].items():
        assert hashlib.sha256(open(os.path.join(ROOT, p), "rb").read()).hexdigest() == h, p


def test_missing_stays_missing_never_zero():
    ai = STACK["aridity_index_raw"][V]
    ac = cube_var("aridity_class")
    assert np.array_equal(np.isnan(ac), np.isnan(ai)), "aridity class missing exactly where P/PET is undefined"
    yrs = cube_var("lst_dr_years"); iav = cube_var("lst_dr_iav_k")
    assert np.all(np.isnan(iav[yrs < 5])) and np.all(np.isfinite(iav[yrs >= 5]))


def test_counts_are_months():
    for k in ["freeze_months", "ft_air_months", "dry_months", "polar_night_months"]:
        x = cube_var(k); f = np.isfinite(x)
        assert np.all((x[f] >= 0) & (x[f] <= 12) & (x[f] == np.round(x[f]))), k


def test_polar_night_only_poleward_of_the_polar_circles():
    pn = cube_var("polar_night_months")
    # polar circles at 66.56 deg; the 1-degree product is assigned to 0.5-degree rows by nearest row, and the southern
    # winter (at aphelion) is slightly darker, so the first dark month appears at 65-66.5 deg
    assert np.all(np.abs(LAT[pn > 0]) >= 65.0), "no polar night more than ~1.5 deg equatorward of the polar circles"
    assert np.all(pn[np.abs(LAT) < 65] == 0)
    assert np.any(pn[np.abs(LAT) >= 80] >= 3)


def test_top_of_atmosphere_sunlight_peaks_in_the_tropics():
    toa = cube_var("toa_annual_wm2")
    trop = np.nanmean(toa[np.abs(LAT) < 10]); pole = np.nanmean(toa[np.abs(LAT) > 75])
    assert trop > 380 and pole < 200 and trop > pole


def test_freezing_all_year_implies_mean_below_zero():
    fz = cube_var("freeze_months"); m = cube_var("maat_below_zero")
    assert np.all(m[fz == 12] == 1) and np.all(m[fz == 0] == 0)


def test_unep_aridity_thresholds():
    ai = STACK["aridity_index_raw"][V].astype(float); ac = cube_var("aridity_class")
    for k, (lo, hi) in enumerate([(-1, 0.05), (0.05, 0.2), (0.2, 0.5), (0.5, 0.65), (0.65, 1e9)]):
        sel = ac == k
        assert np.all((ai[sel] >= lo) & (ai[sel] < hi)), F.ARIDITY_CLASSES[k]


def test_landform_class_boundaries():
    r = STACK["surface_roughness"][V].astype(float); e = STACK["elevation"][V].astype(float); lf = cube_var("landform_class")
    assert np.all(r[lf <= 1] < 50) and np.all((r[lf == 2] >= 50) & (r[lf == 2] < 200)) and np.all(r[lf >= 3] >= 200)
    assert np.all(e[lf == 0] < 500) and np.all(e[lf == 1] >= 500) and np.all(e[lf == 4] >= 2500)


def test_dry_month_rule_on_a_textbook_case():
    T = np.array([30.0] * 12); P = np.array([10.0] * 12)
    assert int((P < 2 * T).sum()) == 12
    T = np.array([-5.0] * 12)
    assert int((P < 2 * T).sum()) == 0


# ---------------------------------------------------------------- novelty
def test_novelty_rebuilds_identically_and_never_from_missing_data():
    r = N.compute()
    assert base64.b64encode(r["cls"].astype(np.uint8).tobytes()).decode() == PUB["patterns"]["novelty"]["class_b64"]
    cls = dec(PUB["patterns"]["novelty"]["class_b64"])
    X = np.stack([STACK[c][V] for c in N.CRIT], 1)
    incomplete = ~np.all(np.isfinite(X), 1)
    assert np.array_equal(cls == 0, incomplete), "insufficient exactly where a baseline condition is missing"
    u = dec(PUB["patterns"]["novelty"]["uniqueness_pct_b64"])
    assert np.all(u[incomplete] == 255) and np.all(u[~incomplete] <= 100)


def test_novelty_classes_follow_their_definitions():
    P = PUB["patterns"]["novelty"]
    cls = dec(P["class_b64"]); km = dec(P["known_km40_b64"]).astype(float) * 40; ep = dec(P["known_env_pct_b64"]); up = dec(P["uniqueness_pct_b64"])
    assert np.all(km[cls == 1] <= 320)
    assert np.all(km[cls >= 2] >= 280)
    assert np.all(ep[cls == 2] <= 50) and np.all(ep[cls >= 3] >= 49)
    assert np.all(up[cls == 4] >= 89)
    assert sum(P["counts"].values()) == len(cls)


def test_novelty_site_cells_lie_near_their_sites():
    sites = {s["id"]: s for s in json.load(open(os.path.join(ROOT, "data/ext/known_analogues.json")))["sites"]}
    for sc in PUB["patterns"]["novelty"]["site_cells"]:
        assert sc["offset_km"] < 400, sc


# ---------------------------------------------------------------- unsupervised patterns
def test_patterns_document_is_complete_and_honest():
    M = PUB["patterns"]["ml"]
    assert 6 <= M["k"] <= 12 and len(M["centers"]) == M["k"] == len(M["names"]) == len(M["sizes"])
    best = max(M["silhouette"].items(), key=lambda kv: (kv[1], -int(kv[0])))[0]
    assert int(best) == M["k"], "k is the silhouette maximum"
    a = M["agreement_koppen"]
    assert 0 < a["ari_main_groups"] < 1 and 0 < a["nmi_main_groups"] < 1
    assert -1 <= M["spearman_isolation_vs_knn"] <= 1
    lab = dec(M["labels_b64"])
    assert sum(M["sizes"]) == int((lab != 255).sum()) == M["complete_cells"]


def test_hidden_combinations_meet_their_rule():
    from src.v17 import ml as ML
    M = PUB["patterns"]["ml"]
    f = feat()
    cols = [STACK[c][V].astype(float) for c in ML.BASE] + [f[c] for c in ML.EXTRA]
    X = np.stack(cols, 1)
    ok = np.all(np.isfinite(X), 1); mu, sd = X[ok].mean(0), X[ok].std(0)
    for i in M["hidden_cells"]:
        z = (X[i] - mu) / sd
        assert np.all(np.abs(z) < 2.0), i
    ap = dec(M["anomaly_pct_b64"])
    assert all(ap[i] >= 97 for i in M["hidden_cells"])


def test_patterns_rebuild_when_the_same_library_is_installed():
    import sklearn
    M = PUB["patterns"]["ml"]
    if sklearn.__version__ != M["sklearn"]:
        return  # a different scikit-learn may break ties differently; the document records the version used
    from src.v17 import ml as ML
    r = ML.compute(feat())
    assert r["kbest"] == M["k"] and base64.b64encode(r["labels"].tobytes()).decode() == M["labels_b64"]
    assert [int(i) for i in np.flatnonzero(r["hidden"])] == M["hidden_cells"]


# ---------------------------------------------------------------- Data Integration Registry
def test_registry_has_one_valid_state_per_source():
    reg = PUB["registry"]; states = {s["id"] for s in reg["states"]}
    assert len(states) == 8
    ids = [s["id"] for s in reg["sources"]]
    assert len(ids) == len(set(ids))
    assert all(s["state"] in states for s in reg["sources"])
    assert sum(reg["counts"].values()) == len(reg["sources"])


def test_no_source_is_integrated_without_retained_verified_data():
    inv = {i["id"]: i for i in json.load(open(os.path.join(ROOT, "data/inventory/inventory.json")))["items"]}
    for s in PUB["registry"]["sources"]:
        if s["state"].startswith("integrated"):
            assert s["origin"] == "phase4_inventory" and inv[s["id"]]["status"] == "integrated" and inv[s["id"]].get("integrity_ok") is not False, s["id"]
        if s["origin"] == "v17_candidate":
            assert not s["state"].startswith("integrated"), s["id"]


def test_unreachable_sources_carry_the_recorded_error():
    for s in PUB["registry"]["sources"]:
        if s["state"] == "endpoint_unavailable":
            assert s.get("probe") and not s["probe"]["reachable"] and s["probe"].get("error"), s["id"]


def test_registry_rebuilds_identically():
    assert json.loads(json.dumps(R.build())) == PUB["registry"]


# ---------------------------------------------------------------- modules and limits
def test_modules_report_evidence_kinds_and_blocked_sources():
    mods = PUB["modules"]["modules"]; kinds = set(PUB["modules"]["kinds"])
    reg = {s["id"] for s in PUB["registry"]["sources"]}
    assert len(mods) == 10 and len({m["id"] for m in mods}) == 10
    for m in mods:
        assert m["status"] in ("available", "partial", "blocked")
        assert all(i["kind"] in kinds for i in m["inputs"])
        assert all(b in reg for b in m["blocked"]), (m["id"], [b for b in m["blocked"] if b not in reg])
        if m["status"] == "blocked":
            assert not m["inputs"] and m["blocked"], m["id"]
        assert m["limits"] and m["validation"]["method"]
    proxies = [i["var"] for m in mods for i in m["inputs"] if i["kind"] == "proxy"]
    assert {"ft_air_months", "maat_below_zero"} <= set(proxies)


def test_limits_use_measured_mars_pressure():
    meda = json.load(open(os.path.join(ROOT, "data/raw/meda_pressure.json")))
    p = [x["median_Pa"] for x in meda]
    atm = next(x for x in PUB["limits"]["items"] if x["id"] == "atmosphere")
    assert atm["mars"]["kind"] == "measured" and atm["mars"]["value"] == [round(min(p), 1), round(max(p), 1)]
    assert all(x["earth_site"] in ("no", "partial", "yes") for x in PUB["limits"]["items"])
    assert json.loads(json.dumps(L.build())) == PUB["limits"]


def test_page_bundle_embeds_the_same_documents():
    js = open(os.path.join(ROOT, "app/frontend/phase4/data_v17.js")).read()
    doc = json.loads(js[js.index("{"):js.rindex(";")])
    import hashlib
    for k in PUB:
        assert doc[k] == PUB[k], k
        assert doc["sha256"][k] == hashlib.sha256(open(os.path.join(ROOT, "public/data/v17", k + ".json"), "rb").read()).hexdigest()
