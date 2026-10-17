"""Phase III tests (Python): catalogue and gazetteer anchoring, traceability of every atlas value to
the pipeline outputs, independent recomputation of the REMS aggregate and the atlas normalisation,
JS ≡ Python candidate parity (via the shipped reference), checksums, Mars24 validation, Diviner grid
conventions, record replay, secrets scan and baseline preservation."""
import base64, glob, hashlib, json, math, os, subprocess, sys, types
import numpy as np
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "src/phase3/pipeline"))
sys.path.insert(0, os.path.join(ROOT, "src/data/ingestion"))
sys.path.insert(0, os.path.join(ROOT, "src/phase3"))          # pipeline expects target_catalog beside it (as in the network job)
sys.modules.setdefault("requests", types.ModuleType("requests"))      # pipeline modules import it; no network here
from src.compute.variables import CRITERION_IDS as C
from src.phase3 import target_catalog as TC

RAW = os.path.join(ROOT, "data/raw/phase3")
PUB = os.path.join(ROOT, "public/data/phase3")
ATLAS = json.load(open(os.path.join(PUB, "atlas.json")))
T = {t["id"]: t for t in ATLAS["targets"]}
RES = {t["id"]: t for t in json.load(open(os.path.join(RAW, "resolved.json")))["targets"]}


def _sha(b):
    return hashlib.sha256(b).hexdigest()


def test_p3_catalogue_matches_specification():
    assert [t["id"] for t in ATLAS["targets"]] == [t["id"] for t in TC.TARGETS]
    assert {t["kind"] for t in ATLAS["targets"]} <= set(ATLAS["kinds"])
    assert sum(t["baseline"] for t in ATLAS["targets"]) == 2


def test_p3_anchors_equal_gazetteer_or_published_coordinates():
    # gazetteer centre points verified independently when the catalogue was compiled
    expect = {"mars_gale_aeolis_mons": (-5.0834, 137.8453), "mars_elysium_planitia": (2.979, 154.7372), "mars_gusev": (-14.5308, 175.5244),
              "mars_hellas_planitia": (-42.4301, 70.5025), "mars_valles_marineris": (-14.0059, 301.4123), "mars_olympus_mons_summit": (18.6528, 226.1975),
              "moon_shackleton": (-89.67, 129.78), "moon_cabeus": (-85.3303, 317.8673), "moon_aristarchus": (23.7299, 312.5099),
              "moon_orientale": (-19.8655, 265.3297), "moon_apollo17_taurus_littrow": (20.1911, 30.7723), "moon_apollo15_hadley": (26.13239, 3.6333)}
    for tid, (la, lo) in expect.items():
        a = T[tid]["anchor"]
        assert a["lat"] == pytest.approx(la, abs=1e-4) and (a["lon"] % 360) == pytest.approx(lo % 360, abs=1e-4), tid
    for t in ATLAS["targets"]:
        if t["anchor"]["type"] == "gazetteer":
            g = t["anchor"]["gazetteer"]
            assert g["approval"] == "Adopted by IAU" and g["link"].startswith("http")
    # offsets: great-circle distance from the Olympus Mons centre
    R = 3396.19
    c = T["mars_olympus_mons_summit"]["anchor"]
    for tid, d in (("mars_olympus_mons_flank", 150), ("mars_olympus_mons_plains", 450)):
        a = T[tid]["anchor"]
        p1, p2 = math.radians(c["lat"]), math.radians(a["lat"])
        dist = 2 * R * math.asin(math.sqrt(math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(a["lon"] - c["lon"]) / 2) ** 2))
        assert dist == pytest.approx(d, abs=1e-6)


def test_p3_every_value_traces_to_pipeline_outputs():
    polar = json.load(open(os.path.join(RAW, "thermal_polar.json")))["targets"]
    gcp = json.load(open(os.path.join(RAW, "thermal_gcp.json")))["targets"]
    rems = json.load(open(os.path.join(RAW, "rems_gale.json")))
    base = {t["id"]: t for t in json.load(open(os.path.join(ROOT, "data/targets.json")))["targets"]}
    for t in ATLAS["targets"]:
        tid, v, s = t["id"], t["values"], t["status"]
        if t["baseline"]:
            assert all(v[c] == base[tid]["variables"][c] for c in C)
            continue
        terr = json.load(open(os.path.join(RAW, f"terrain/{tid}.json")))["primary"]
        assert v["slope"] == terr["slope_deg"] and v["surface_roughness"] == terr["surface_roughness_m"] and terr["complete"]
        assert s["aridity"] == s["elevation"] == "PROXY"
        if t["body"] == "Moon":
            assert s["annual_temperature_range"] == "INCOMPATIBLE" and v["annual_temperature_range"] is None
            if tid in polar:
                assert v["lst_diurnal_range"] == polar[tid]["lst_diurnal_range_K"]
            elif gcp[tid]["primary"]["lst_diurnal_range_K"] is None:
                assert s["lst_diurnal_range"] == "MISSING" and v["lst_diurnal_range"] is None
            else:
                assert v["lst_diurnal_range"] == gcp[tid]["primary"]["lst_diurnal_range_K"]
        elif tid == "mars_gale_curiosity":
            assert v["lst_diurnal_range"] == rems["primary"]["lst_diurnal_range_K"]
            assert v["annual_temperature_range"] == rems["primary"]["annual_temperature_range_K"]
        else:
            assert v["lst_diurnal_range"] is None and v["annual_temperature_range"] is None
            assert s["lst_diurnal_range"] == s["annual_temperature_range"] == "MISSING"


def test_p3_rems_aggregate_recomputed_from_per_sol_files():
    import rems_gale, mars_meda
    sols = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(RAW, "rems/sol_*.json")))]
    rems = json.load(open(os.path.join(RAW, "rems_gale.json")))
    assert len(sols) == rems["sols_requested"] == 306
    for k, (g, a) in (("primary", ("ground", "air")), ("strict", ("ground_strict", "air_strict"))):
        r = mars_meda.aggregate(rems_gale.variant(sols, g, a))
        assert r["lst_diurnal_range_K"] == pytest.approx(rems[k]["lst_diurnal_range_K"], abs=1e-12)
        assert r["annual_temperature_range_K"] == pytest.approx(rems[k]["annual_temperature_range_K"], abs=1e-12)
        assert r["lst_bins_used"] == r["air_bins_used"] == 12
    for o in sols:     # per-sol Ls recomputed from the label times
        if o.get("start"):
            from datetime import datetime, timezone
            t0 = datetime.strptime(o["start"][:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
            t1 = datetime.strptime(o["stop"][:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
            assert rems_gale.mars_ls(t0 + (t1 - t0) / 2) == pytest.approx(o["ls"], abs=1e-9)


def test_p3_mars24_solar_longitude_validated():
    import rems_gale
    from datetime import datetime, timezone as tz
    assert rems_gale.mars_ls(datetime(2000, 1, 6, tzinfo=tz.utc)) == pytest.approx(277.18758, abs=2e-4)      # Mars24 worked example
    # Mars 2020 MEDA sol 100 PDS4 label: start/stop_solar_longitude 52.734 / 53.17 at 2021-05-31T22:23:00 / 2021-06-01T22:06:31
    assert rems_gale.mars_ls(datetime(2021, 5, 31, 22, 23, 0, tzinfo=tz.utc)) == pytest.approx(52.734, abs=2e-3)
    assert rems_gale.mars_ls(datetime(2021, 6, 1, 22, 6, 31, tzinfo=tz.utc)) == pytest.approx(53.17, abs=2e-3)


def test_p3_diviner_polar_grid_convention():
    import build_atlas
    # rows from the provider's .txt companions of polar_{south,north}_80_summer_tbol-hour14 (x, y, clon, clat)
    la, lo = build_atlas.polar_lonlat(np.array([-0.006770]), np.array([0.174908]), "south")
    assert la[0] == pytest.approx(-79.996484, abs=5e-4) and lo[0] == pytest.approx(-2.216503, abs=1e-3)
    la, lo = build_atlas.polar_lonlat(np.array([-0.005526]), np.array([0.174908]), "north")
    assert la[0] == pytest.approx(79.998967, abs=5e-4) and lo[0] == pytest.approx(-178.190309, abs=1e-3)


def test_p3_diviner_gcp_layout():
    import build_atlas
    assert build_atlas.band_name(-10, 0) == "global_cumul_avg_cyl_10s00s_002.tab"
    assert build_atlas.band_name(20, 30) == "global_cumul_avg_cyl_20n30n_002.tab"
    # verified records of the 20N-30N file: k = (ilon*20 + ilat)*96 + ilt
    for k, (clon, clat, lt) in {1: (-179.75, 20.25, 0.38), 96: (-179.75, 20.75, 0.12), 1920: (-179.25, 20.25, 0.12), 1382399: (179.75, 29.75, 23.88)}.items():
        ilon, rem = divmod(k, 20 * 96); ilat, ilt = divmod(rem, 96)
        assert -179.75 + 0.5 * ilon == pytest.approx(clon) and 20 + 0.25 + 0.5 * ilat == pytest.approx(clat) and 0.125 + 0.25 * ilt == pytest.approx(lt, abs=0.01)


def test_p3_grids_and_files_checksums():
    F = ATLAS["files"]["grids"]
    buf = base64.b64decode(open(os.path.join(PUB, F["file"]), "rb").read())
    assert _sha(buf) == F["sha256"] and len(buf) == F["bytes"]
    for L in F["layout"]:
        assert _sha(buf[L["offset"]:L["offset"] + 4 * L["length"]]) == L["sha256"]
    for t in ATLAS["targets"]:
        d = np.load(os.path.join(RAW, f"terrain/{t['id']}.npz"))
        assert _sha(d["z"].tobytes() + d["slope"].tobytes()) == t["terrain"]["grid_sha256"]
    S = ATLAS["files"]["subcell"]
    assert _sha(base64.b64decode(open(os.path.join(PUB, S["file"]), "rb").read())) == S["sha256"]
    for k in ("basemap_mars", "basemap_moon"):
        assert _sha(open(os.path.join(PUB, ATLAS["files"][k]["file"]), "rb").read()) == ATLAS["files"][k]["sha256"]


def test_p3_subcell_reproduces_baseline_slope():
    chk = ATLAS["files"]["subcell"]["check"]
    assert chk["cells_compared"] == 76781 and chk["max_abs_diff_mean_slope_vs_baseline"] == 0.0


def test_p3_atlas_normalisation_and_reference_recomputed():
    from scripts.export_reference import load_bundle
    from src.compute.normalization import compute_ranges
    from src.compute.similarity import similarity, effective_scores
    from src.compute.ranking import distinct_sites
    from src.compute.sensitivity import MISSION_PROFILES
    info, A = load_bundle(ROOT)
    E = {c: A[c].astype(np.float64) for c in C}
    sc = [dict(variables={c: (t["values"][c] if t["status"][c] in ("DIRECT", "PROXY") else None) for c in C}) for t in ATLAS["targets"]]
    assert compute_ranges(E, sc, C) == ATLAS["normalisation"]["ranges"]
    cell = A["cell"].astype(np.int64); lat, lon = -90 + 0.5 * (cell // 576), -180 + 0.625 * (cell % 576)
    for tid in ("mars_gale_curiosity", "mars_elysium_planitia", "moon_shackleton", "moon_apollo17_taurus_littrow"):
        t = T[tid]; tv = {c: (t["values"][c] if t["status"][c] == "DIRECT" else None) for c in C}
        tr = {c: [min([float(np.nanmin(E[c]))] + ([tv[c]] if tv[c] is not None else [])), max([float(np.nanmax(E[c]))] + ([tv[c]] if tv[c] is not None else []))] for c in C}
        assert tr == ATLAS["reference"][tid]["ranges"]
        eff = effective_scores(similarity(E, tv, MISSION_PROFILES["general"]["weights"], tr))
        top = distinct_sites(eff, cell, lat, lon, n=20, min_sep_km=300.0)
        assert [r["index"] for r in ATLAS["reference"][tid]["top"]] == top


def test_p3_no_secrets_or_signed_urls():
    pat = ("X-Amz-Signature", "X-Amz-Security-Token", "upload_url", "Authorization:", "api_key", "password", "BEGIN PRIVATE KEY")
    files = [os.path.join(PUB, "atlas.json")] + glob.glob(os.path.join(RAW, "*.json")) + glob.glob(os.path.join(RAW, "*.log"))
    for f in files:
        s = open(f, encoding="utf-8", errors="replace").read()
        assert not any(p in s for p in pat), f


def test_p3_readiness_rule_and_level1_exclusion():
    for t in ATLAS["targets"]:
        assert t["readiness_v1"]["level"] == TC.readiness(t["status"], all(t["status"][c] != "UNVALIDATED" for c in C))
    assert set(ATLAS["reference"]) == {t["id"] for t in ATLAS["targets"] if t["readiness_v1"]["level"] >= 2}
    # Phase IV readiness model 3: every rankable target is >= L2 with at least one DIRECT criterion; L1 (catalogued) never ranked
    assert set(ATLAS["reference"]) == {t["id"] for t in ATLAS["targets"] if t["readiness"]["level"] >= 2}


def test_p3_replay_browser_records():
    fx = sorted(glob.glob(os.path.join(ROOT, "tests/phase3/fixtures/record_*.json")))
    assert fx, "no browser-exported Phase III record fixtures"
    for f in fx:
        p = subprocess.run([sys.executable, os.path.join(ROOT, "scripts/replay_atlas_record.py"), f, "--repo", ROOT], capture_output=True, text=True)
        assert p.returncode == 0 and "REPRODUCED" in p.stdout, p.stdout + p.stderr


def test_p3_replay_detects_tampering():
    fx = sorted(glob.glob(os.path.join(ROOT, "tests/phase3/fixtures/record_*candidates*.json")))[0]
    r = json.load(open(fx)); r["outputs"]["candidates"][0]["cells"][0] += 1
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
        json.dump(r, fh); path = fh.name
    p = subprocess.run([sys.executable, os.path.join(ROOT, "scripts/replay_atlas_record.py"), path, "--repo", ROOT], capture_output=True, text=True)
    os.unlink(path)
    assert p.returncode == 1 and "NOT REPRODUCED" in p.stdout


def test_p3_baseline_and_phase2_files_unchanged():
    ref = json.load(open(os.path.join(ROOT, "tests/phase3/fixtures/protected_sha256.json")))
    for f, h in ref.items():
        assert _sha(open(os.path.join(ROOT, f), "rb").read()) == h, f
