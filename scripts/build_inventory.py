"""Build the data inventory: what is integrated, present, referenced, a candidate, or unobtainable — from project state.

    python3 scripts/build_inventory.py

Inputs (never edited here): public/data/registry.json (dataset records), data/provenance/manifest.json (raw inputs,
checksums, verified / unverified statements), data/raw/** (the retained raw files, re-hashed now), docs and README
(mentions), data/inventory/probe.json (the reachability probe of candidate sources, scripts/probe_data_sources.py).
Outputs: data/inventory/inventory.json, app/frontend/phase4/data_inventory.js (the same, for the interface) and
docs/data/DATA_INVENTORY.md. A candidate is never marked integrated: integration is read from the registry's dataset
records and the raw-input checksums, not from this file's text.
"""
import glob, hashlib, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p)))
REG, MAN = J("public/data/registry.json"), J("data/provenance/manifest.json")
PROBE = J("data/inventory/probe.json") if os.path.exists(os.path.join(ROOT, "data/inventory/probe.json")) else {"results": {}, "probed_utc": None}
STATUSES = {
    "integrated": "Integrated: obtained, checksum-verified and used by the application",
    "verified_not_integrated": "Verified, not integrated: obtained and validated, not yet used",
    "downloaded_not_validated": "Downloaded, not validated: present locally, checks not done",
    "known_limitation": "Known limitation: a documented scientific or data limitation of what is integrated",
    "not_investigated": "Not investigated: identified as relevant, no access attempt yet",
    "unavailable": "Unavailable: investigated, but the source cannot be used (access, licence or no such product)",
    "blocked": "Blocked: an access attempt from this build environment failed (network policy); not a scientific judgement",
}


def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def corpus():
    s = ""
    for p in [os.path.join(ROOT, "README.md")] + glob.glob(os.path.join(ROOT, "docs/**/*.md"), recursive=True):
        if "DATA_INVENTORY" in p:
            continue
        s += open(p, encoding="utf-8", errors="ignore").read() + "\n"
    return s


DOCS = corpus()
raw_ok = {}
for r in MAN["raw_inputs"]:
    p = os.path.join(ROOT, "data/raw", r["file"])
    raw_ok[r["file"]] = {"present": os.path.exists(p), "sha_match": os.path.exists(p) and sha(p) == r["sha256"], "datasets": r.get("datasets", []), "bytes": r["bytes"]}
p4 = J("data/raw/phase4/MANIFEST.json")
for f in p4["files"]:
    p = os.path.join(ROOT, f["path"])
    raw_ok[f["path"]] = {"present": os.path.exists(p), "sha_match": os.path.exists(p) and sha(p) == f["sha256"], "datasets": [], "bytes": f["bytes"]}
man_ds = {d["id"]: d for d in MAN["datasets"]}

items = []
USE = {"Earth predictor": "scoring (Earth side)", "Mars target": "scoring (target side)", "Moon target": "scoring (target side)", "planetary target": "target records (registry)",
       "Earth sub-cell": "evidence layer (terrain distribution, not scored)", "Context only (basemap)": "context only (basemap, never scored)", "Context only (labels, coastline)": "context only (labels, never scored)"}
for d in REG["datasets"]:
    m = man_ds.get(d["id"], {})
    raws = [k for k, v in raw_ok.items() if d["id"] in v["datasets"]]
    checks = [raw_ok[k]["sha_match"] for k in raws]
    items.append({
        "id": d["id"], "class": "integrated", "status": "integrated", "name": d["product_id"], "provider": d["provider"],
        "version": m.get("version") or d.get("version"), "variables": m.get("dataset") or d["product_id"], "units": m.get("units") or d.get("units"),
        "resolution": m.get("resolution") or d.get("original_resolution"), "processing_resolution": d.get("processing_resolution"),
        "coverage": d.get("spatial_coverage"), "temporal": m.get("temporal") or d.get("temporal_coverage"), "license": d.get("license"), "url": d.get("url"),
        "use": USE.get(d["role"], d["role"]), "integrity": ("raw inputs re-hashed now: " + ", ".join(f"{k} {'OK' if raw_ok[k]['sha_match'] else 'MISMATCH'}" for k in raws)) if raws else d.get("checksums"),
        "integrity_ok": all(checks) if checks else None, "retrieval": d.get("retrieval_status"), "limitations": d.get("limitations"),
    })
# raw files present but not attributed to any dataset record → present, not integrated
for k, v in raw_ok.items():
    if v["present"] and not v["datasets"] and not k.endswith(".log") and "gazetteer" not in k and "support/" not in k:
        items.append({"id": "raw:" + k, "class": "local_not_integrated", "status": "downloaded_not_validated", "name": k, "use": "none", "integrity_ok": v["sha_match"]})

CAND = [
    ("terraclimate", "TerraClimate (monthly climate and water balance, 1/24°)", "University of Idaho (Abatzoglou et al. 2018)", "PET, precipitation, aridity at 1/24°",
     "High: an independent aridity source; could fill the 14,750 cells where NASA POWER leaves P/PET undefined. Same variable (P/PET) → a versioned source option, not a new dimension.", "CC0"),
    ("era5", "ERA5 monthly single-level reanalysis", "ECMWF / Copernicus C3S", "2 m temperature, precipitation (0.25°)",
     "Medium: a second reanalysis for the seasons and aridity criteria (source-dependence tests). Needs a CDS account.", "Copernicus licence"),
    ("merra2", "MERRA-2 monthly files", "NASA GMAO / GES DISC", "T2M, PRECTOTCORR (native 0.5° × 0.625°)",
     "Medium: cross-check of the NASA POWER values (listed as unverified in the provenance manifest). Needs an Earthdata login.", "NASA open data"),
    ("modis_lst_hdf", "MYD11C3 v061 HDF science files", "NASA LP DAAC", "LST day / night (0.05°)",
     "High: replaces the LST decoded from GIBS imagery (listed as unverified) with the science values; same variable. Needs an Earthdata login.", "NASA open data"),
    ("nasadem", "NASADEM", "NASA JPL / LP DAAC", "elevation (1 arc-second)",
     "Medium: finer slope and roughness than GMTED2010 30″; would change terrain criteria → versioned extension only. 60°N–56°S.", "NASA open data"),
    ("srtm", "SRTM GL1 v003", "NASA / LP DAAC", "elevation (1 arc-second)", "Medium: as NASADEM (NASADEM supersedes it).", "NASA open data"),
    ("copernicus_dem", "Copernicus DEM GLO-30", "ESA / Airbus (AWS open data)", "elevation (30 m), global", "Medium: global fine DEM for roughness; terrain criteria → versioned extension only.", "Copernicus DEM licence"),
    ("ecostress", "ECOSTRESS LST", "NASA JPL / LP DAAC", "LST at varied times of day (70 m)", "Medium: evidence on diurnal sampling bias of the thermal criterion; evidence layer.", "NASA open data"),
    ("viirs", "VIIRS LST (VNP21)", "NASA LP DAAC", "LST day / night", "Medium: an independent LST source for the thermal criterion.", "NASA open data"),
    ("esa_worldcover", "ESA WorldCover 2021 v200", "ESA", "land cover (10 m)", "Low for scoring (no planetary counterpart); useful as an evidence layer (vegetation, built-up).", "CC BY 4.0"),
    ("soilgrids", "SoilGrids 2.0", "ISRIC", "soil properties (250 m)", "Low for scoring (no comparable target measurement); evidence layer only.", "CC BY 4.0"),
    ("jrc_gsw", "JRC Global Surface Water", "European Commission JRC", "surface-water occurrence (30 m)", "Low/medium: evidence for interpreting aridity; not a target variable.", "open (JRC)"),
    ("landsat", "Landsat Collection 2", "USGS", "multispectral imagery", "Low at this grid: imagery, not a gridded variable comparable with targets.", "public domain"),
    ("themis", "Mars Odyssey THEMIS thermal inertia", "ASU / NASA PDS", "thermal inertia (Mars)", "Medium: target-side thermal context; no Earth counterpart integrated → evidence layer.", "NASA PDS"),
    ("lroc", "LRO LROC mosaics", "ASU / NASA PDS", "imagery (Moon)", "Low: context imagery.", "NASA PDS"),
    ("hirise", "MRO HiRISE DTMs", "University of Arizona / NASA PDS", "metre-scale elevation (Mars, sparse)", "Medium for single sites; sparse coverage.", "NASA PDS"),
]
probed = PROBE.get("results", {})
DOC_TOKEN = {"terraclimate": "TerraClimate", "era5": "ERA5", "merra2": "MERRA-2", "modis_lst_hdf": "HDF", "nasadem": "NASADEM", "srtm": "SRTM",
             "copernicus_dem": "Copernicus DEM", "ecostress": "ECOSTRESS", "viirs": "VIIRS", "esa_worldcover": "WorldCover", "soilgrids": "SoilGrids",
             "jrc_gsw": "Global Surface Water", "landsat": "Landsat", "themis": "THEMIS", "lroc": "LROC", "hirise": "HiRISE"}
for cid, name, prov, var, value, lic in CAND:
    pr = probed.get(cid)
    mentioned = bool(re.search(r"\b" + re.escape(DOC_TOKEN[cid]) + r"\b", DOCS))
    st = "not_investigated" if not pr else ("blocked" if not pr.get("reachable") else "not_investigated")
    reason = None
    if pr and not pr.get("reachable"):
        reason = f"Access attempt from the build environment on {PROBE['probed_utc']} failed: {pr.get('error') or 'HTTP ' + str(pr.get('http'))} ({pr['url']})."
    if cid in ("era5", "merra2", "modis_lst_hdf", "nasadem", "srtm", "ecostress", "viirs"):
        reason = (reason + " " if reason else "") + "The provider also requires a registered account (Earthdata or CDS); no credentials are used by this project."
    items.append({"id": cid, "class": "referenced_only" if mentioned else "candidate", "status": st, "name": name, "provider": prov, "variables": var,
                  "value": value, "license": lic, "reason": reason, "use": "none"})

LIM = [
    ("lim_aridity_nan", "aridity", "NASA POWER P/PET is undefined (NaN) in 14,750 cells; those cells are scored on the other criteria and their weight coverage is reported. Never imputed."),
    ("lim_modis_decoded", "lst_diurnal_range", MAN["unverified"][1]),
    ("lim_power_unverified", "aridity", MAN["unverified"][2]),
    ("lim_diviner_hour02", "lst_diurnal_range", MAN["unverified"][0]),
    ("lim_resolution", None, "Every Earth value is one 0.5° × 0.625° cell statistic (about 55 × 69 km at the equator); target values come from a 55.6 km terrain window."),
    ("lim_temporal", None, "Earth climatologies are long-term means (NASA POWER 2001–2020, MODIS 2016–2025); no year-to-year or seasonal-cycle comparison is scored."),
    ("lim_not_measured", None, "Geology, mineralogy, radiation, atmosphere, gravity and dust are not measured by any integrated dataset and are not compared."),
    ("lim_licences", None, MAN["unverified"][3]),
    ("lim_validation", None, MAN["unverified"][4]),
]
for lid, crit, text in LIM:
    items.append({"id": lid, "class": "limitation", "status": "known_limitation", "criterion": crit, "name": text, "use": "documented"})

inv = {"schema": "asterro.data-inventory/1", "generated_by": "scripts/build_inventory.py", "probed_utc": PROBE.get("probed_utc"), "statuses": STATUSES,
       "stack_sha256": REG["stack_sha256"], "counts": {}, "items": items,
       "environment": "Build sandbox: outbound HTTPS to data providers refused by the egress policy (see probe.json). The linked desktop VM had no network access when probed (curl returned no connection for every host)."}
for it in items:
    inv["counts"][it["status"]] = inv["counts"].get(it["status"], 0) + 1
os.makedirs(os.path.join(ROOT, "data/inventory"), exist_ok=True)
json.dump(inv, open(os.path.join(ROOT, "data/inventory/inventory.json"), "w"), indent=1, ensure_ascii=False)
with open(os.path.join(ROOT, "app/frontend/phase4/data_inventory.js"), "w") as f:
    f.write("/* ===== Data inventory (generated by scripts/build_inventory.py from the registry, the provenance manifest, the raw files\n"
            " * and the source probe; do not edit by hand) ===== */\nconst ASTERRO_INVENTORY = " + json.dumps(inv, ensure_ascii=False, separators=(",", ":")) + ";\n")
# markdown
L = ["# Data inventory", "", f"Generated by `scripts/build_inventory.py` (registry, provenance manifest, raw files re-hashed, source probe of {PROBE.get('probed_utc')}).", "",
     "| Status | Meaning |", "|---|---|"] + [f"| `{k}` | {v} |" for k, v in STATUSES.items()] + ["", "Counts: " + ", ".join(f"{k} {v}" for k, v in sorted(inv["counts"].items())), ""]
L += ["## 1. Integrated and used", "", "| Id | Product | Provider | Variables / units | Resolution | Period | Use | Integrity | Licence |", "|---|---|---|---|---|---|---|---|---|"]
for it in items:
    if it["class"] == "integrated":
        L.append(f"| `{it['id']}` | {it['name']} | {it['provider']} | {it.get('variables')} ({it.get('units')}) | {it.get('resolution')} | {it.get('temporal')} | {it['use']} | {it.get('integrity')} | {it.get('license')} |")
L += ["", "## 2. Present locally but not integrated", ""]
loc = [it for it in items if it["class"] == "local_not_integrated"]
L += [f"- `{it['name']}` — checksum {'matches' if it['integrity_ok'] else 'does not match'} the manifest" for it in loc] or ["None: every retained raw file is attributed to an integrated dataset record."]
L += ["", "## 3–5. Referenced, candidate and unobtainable sources", "", "| Id | Source | Variables | Value for ASTERRO | Licence | Status | Reason |", "|---|---|---|---|---|---|---|"]
for it in items:
    if it["class"] in ("referenced_only", "candidate"):
        L.append(f"| `{it['id']}` | {it['name']} — {it['provider']} | {it['variables']} | {it['value']} | {it['license']} | `{it['status']}` | {it.get('reason') or '—'} |")
L += ["", "No candidate was downloaded, so none is marked downloaded, validated or integrated. A reachable endpoint would still need retrieval, checksum, schema, unit, coverage and grid-compatibility checks before integration; a new scored variable would need a versioned scoring extension (see LIMITATIONS).", "",
      "## Known limitations of the integrated data", ""] + [f"- **{it['id']}**{' (' + it['criterion'] + ')' if it.get('criterion') else ''}: {it['name']}" for it in items if it["class"] == "limitation"]
L += ["", "## Environment", "", inv["environment"], ""]
os.makedirs(os.path.join(ROOT, "docs/data"), exist_ok=True)
open(os.path.join(ROOT, "docs/data/DATA_INVENTORY.md"), "w").write("\n".join(L))
print(json.dumps(inv["counts"]))
