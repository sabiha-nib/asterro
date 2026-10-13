"""Phase II tests (Python): JS/Python parity of the Lab analyses, Phase II data integrity,
independent replay of browser experiment records, and baseline preservation."""
import base64, hashlib, json, math, os, subprocess, sys
import numpy as np
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from src.phase2 import analysis as P2
from src.phase2 import catalog
from src.compute.variables import CRITERION_IDS as C


def js(calls):
    p = subprocess.run(["node", os.path.join(ROOT, "tests/phase2/js_eval.mjs"), json.dumps(calls)], capture_output=True, text=True, cwd=ROOT)
    assert p.returncode == 0, p.stderr
    return json.loads(p.stdout)


def _sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


# ------------------------------------------------------------------ parity with the browser module
def test_p2_mulberry32_and_sampled_design_parity():
    seed = 20261013
    r = P2.mulberry32(seed)
    assert [r() for _ in range(50)] == js([["mulberry32", [seed, 50]]])[0]
    w = {c: 1.0 for c in C}
    py = P2.design_sampled(w, C, C, 40, seed, 1.0)
    out = js([["designSampled", [w, C, C, 40, seed, 1.0]]])[0]
    assert all(abs(a["w"][c] - b["w"][c]) <= 1e-15 * max(1, abs(a["w"][c])) for a, b in zip(py, out) for c in C)


def test_p2_canonical_json_parity():
    objs = [{"b": 0.1, "a": 1e-7, "c": [1, 2.5, None, 1e21, 123456.0]}, {"z": {"y": -0.000002, "x": "Ünïcode"}, "n": 3}]
    assert [P2.canonical(o) for o in objs] == js([["canonical", [o]] for o in objs])


def test_p2_temporal_statistics_parity():
    xs = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
    series = [[37.1, 37.5, 36.9, 38.2, 37.7, 38.1, 38.8, 38.4, 39.0, 38.95], [5.0] * 10, [1, 3, 2, 3, 1, 2, 3, 3, 2, 1]]
    res = js([["theilSen", [xs, s]] for s in series] + [["mannKendall", [s]] for s in series])
    for k, s in enumerate(series):
        ts, mk = P2.theil_sen(xs, s), P2.mann_kendall(s)
        assert ts["slope"] == pytest.approx(res[k]["slope"], abs=1e-12)
        jm = res[len(series) + k]
        assert mk["S"] == jm["S"] and mk["varS"] == pytest.approx(jm["varS"], abs=1e-9)
        assert mk["p"] == pytest.approx(jm["p"], abs=2e-7)        # JS uses an erf approximation (|err| < 1.5e-7)
    m12 = [10 + 5 * math.cos(2 * math.pi * (k + 0.5) / 12 - 1) for k in range(12)]
    h_py, h_js = P2.harmonic(m12), js([["harmonic", [m12]]])[0]
    assert h_py["amplitude"] == pytest.approx(h_js["amplitude"], abs=1e-12) and h_py["peakMonth"] == pytest.approx(h_js["peakMonth"], abs=1e-12)


def test_p2_pareto_parity():
    rng = np.random.default_rng(5)
    pts = [(int(i), [float(x) for x in rng.random(3)]) for i in range(150)]
    pts[7] = (7, [float("nan"), 0.5, 0.5])
    py = P2.pareto(pts)
    out = js([["pareto", [[{"id": i, "v": [None if math.isnan(x) else x for x in v]} for i, v in pts]]]])[0]
    assert sorted(py["front"]) == sorted(out["front"])
    assert py["notEvaluable"] == [7]


def test_p2_rank_stats_and_bounds():
    run = dict(ranks=np.array([[3] * 20, [2] * 12 + [5000] * 8]), n_elig=np.array([10000] * 20), base_ranks=np.array([3, 2]))
    st = P2.rank_stats(run)
    assert [s["cls"] for s in st] == ["STABLE", "MODERATELY_SENSITIVE"]
    for bad in (dict(top_pct=10), dict(stable_frac=0.5), dict(stable_frac=0.9, moderate_frac=0.9)):
        with pytest.raises(ValueError):
            P2.rank_stats(run, **bad)


# ------------------------------------------------------------------ independent replay of browser records
def _replay(name):
    p = subprocess.run([sys.executable, "scripts/replay_experiment.py", os.path.join("tests/phase2/fixtures", name)], cwd=ROOT, capture_output=True, text=True)
    assert p.returncode == 0, p.stdout + p.stderr
    assert "REPRODUCED" in p.stdout


def test_p2_replay_browser_ablation_record():
    _replay("record_ablation_mars.json")


def test_p2_replay_browser_robustness_record():
    _replay("record_robustness_factorial_mars.json")


def test_p2_record_integrity_and_no_secrets():
    for name in sorted(f for f in os.listdir(os.path.join(ROOT, "tests/phase2/fixtures")) if f.startswith("record_")):
        rec = json.load(open(os.path.join(ROOT, "tests/phase2/fixtures", name)))
        cfg = {k: rec[k] for k in ("schema", "module", "baseline", "params")}
        assert hashlib.sha256(P2.canonical(cfg).encode()).hexdigest()[:16] == rec["id"], name
        assert hashlib.sha256(P2.canonical(rec["outputs"]).encode()).hexdigest() == rec["outputs_sha256"], name
        txt = json.dumps(rec).lower()
        assert not any(s in txt for s in ("password", "api_key", "apikey", "token=", "secret")), name


def test_p2_replay_detects_tampering():
    import tempfile
    rec = json.load(open(os.path.join(ROOT, "tests/phase2/fixtures/record_robustness_factorial_mars.json")))
    rec["params"]["design"] = "oat"; rec["outputs"]["stats"][0]["median"] += 1
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
        json.dump(rec, fh); f = fh.name
    p = subprocess.run([sys.executable, "scripts/replay_experiment.py", f], cwd=ROOT, capture_output=True, text=True)
    os.unlink(f)
    assert p.returncode == 1 and "NOT REPRODUCED" in p.stdout


# ------------------------------------------------------------------ Phase II data integrity
def test_p2_series_checksum_and_values_match_raw_inputs():
    ctx = json.load(open(os.path.join(ROOT, "public/data/phase2/context.json")))
    info = json.load(open(os.path.join(ROOT, "data/metadata/stack_build.json")))
    assert ctx["stack_sha256"] == info["sha256"]
    raw = base64.b64decode(open(os.path.join(ROOT, "public/data/phase2", ctx["series"]["file"]), "rb").read())
    assert hashlib.sha256(raw).hexdigest() == ctx["series"]["sha256"] and len(raw) == ctx["series"]["bytes"]
    lay = {L["name"]: L for L in ctx["series"]["layout"]}
    st = np.load(os.path.join(ROOT, "data/predictor_stack.npz"))
    ii, jj = np.nonzero(st["valid"])
    P = np.load(os.path.join(ROOT, "data/raw/power_climatology.npz"))
    L = lay["t2m_monthly"]; a = np.frombuffer(raw, dtype="<i2", count=L["length"], offset=L["offset"]).reshape(L["shape"])
    ref = P["T2M"][:12][:, ii, jj].astype(np.float64)
    ok = a != -32768
    assert np.array_equal(ok, np.isfinite(ref))
    assert np.max(np.abs(a[ok] * 0.01 - ref[ok])) <= 0.005 + 1e-9               # int16 at 0.01 degC, rounding only
    # annual range from the monthly series reproduces the baseline criterion (consistency, not a new value)
    rng = (ref.max(0) - ref.min(0))
    assert np.allclose(rng, st["annual_temperature_range"][ii, jj], atol=1e-4)
    M = np.load(os.path.join(ROOT, "data/raw/modis_lst.npz"))
    L = lay["modis_n_year"]; ny = np.frombuffer(raw, dtype="<u2", count=L["length"], offset=L["offset"]).reshape(L["shape"])
    assert np.array_equal(ny.astype(np.float64), np.where(np.isfinite(M["n_year"][:, ii, jj]), M["n_year"][:, ii, jj], 65535))
    assert np.allclose(M["n_year"][:, ii, jj].sum(0), M["n_clim"][ii, jj])      # basis of the yearly-coverage formula


def test_p2_target_window_stats_match_targets():
    ctx = json.load(open(os.path.join(ROOT, "public/data/phase2/context.json")))
    T = {t["id"]: t for t in json.load(open(os.path.join(ROOT, "data/targets.json")))["targets"]}
    for tid, tw in ctx["target_windows"].items():
        assert tw["slope_deg"]["mean"] == pytest.approx(T[tid]["variables"]["slope"], abs=5e-4)            # target = window mean
        assert tw["elevation_m"]["sd"] == pytest.approx(T[tid]["variables"]["surface_roughness"], rel=2e-3)  # sample vs population SD
        assert sum(tw["slope_deg"]["hist"]["counts"]) <= tw["slope_deg"]["n"]
    mg = ctx["meda_ground"]
    assert abs(mg["dT_per_sol"]["mean"] - T["mars_jezero"]["variables"]["lst_diurnal_range"]) < 2.0      # per-sol vs per-Ls-bin weighting


def test_p2_catalog_consistency():
    info = json.load(open(os.path.join(ROOT, "data/metadata/stack_build.json")))
    fields = {L["name"] for L in info["layout"]}
    for k, v in catalog.REQUIREMENT_VARIABLES.items():
        assert v["field"] in fields, k
        assert all(f in v for f in ("label", "statistic", "unit", "dataset", "resolution", "temporal", "years"))
    ids = {f["id"] for f in catalog.MISSING_FACTORS}
    for a in catalog.ACTIVITIES.values():
        assert set(a["factors"]) <= ids and set(a["criteria"]) <= set(C)
    for f in catalog.MISSING_FACTORS:
        assert f["status"] in ("UNMODELED", "PARTIAL", "EVIDENCE_AVAILABLE")
        assert (f["status"] == "UNMODELED") == (not f["evidence"])        # no evidence is claimed where none exists
    for a in catalog.ACTIVITIES.values():                                # editorial checklist carries no thresholds
        assert not any(isinstance(v, (int, float)) for v in a.values())


# ------------------------------------------------------------------ baseline preservation
BASELINE_FILES = ["app/frontend/engine.js", "app/frontend/styles.css", "app/frontend/index.src.html", *[f"app/frontend/js/{f}" for f in sorted(os.listdir(os.path.join(ROOT, "app/frontend/js")))],
                  "src/compute/similarity.py", "src/compute/ranking.py", "src/compute/normalization.py", "src/compute/clustering.py", "src/compute/sensitivity.py",
                  "src/compute/variables.py", "data/targets.json", "public/data/stack.bin", "data/predictor_stack.npz", "public/data/targets.json", "public/data/labels.json"]


def test_p2_baseline_files_unchanged():
    ref = json.load(open(os.path.join(ROOT, "tests/phase2/fixtures/baseline_sha256.json")))
    changed = [f for f in BASELINE_FILES if _sha(os.path.join(ROOT, f)) != ref[f]]
    assert not changed, changed


def test_p2_app_registry_scientific_content_unchanged():
    """public/data/app.json is regenerated by build_web.py; its scientific content must equal the baseline."""
    ref = json.load(open(os.path.join(ROOT, "tests/phase2/fixtures/baseline_app_json_subset.json")))
    app = json.load(open(os.path.join(ROOT, "public/data/app.json")))
    for k in ("algorithm_version", "ranges", "profiles", "thresholds", "criteria"):
        assert app[k] == ref[k], k
    assert app["stack"]["sha256"] == ref["stack_sha256"]
