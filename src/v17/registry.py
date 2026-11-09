"""V17 Data Integration Registry (asterro.v17.registry/1): one explicit state per source.

Built from the Phase IV inventory (data/inventory/inventory.json), the V17 candidate list (data/v17/sources.json) and
the latest access probe (data/v17/probe.json). A source is never "integrated" because its name appears in a file:
states 1 and 2 require retained raw inputs whose SHA-256 is re-verified (the inventory's integrity check).
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STATES = [
    ("integrated_validated", "Integrated and validated: retained inputs checksum-verified, unit and range checks and reproduction tests pass. Not field validation."),
    ("integrated_validation_incomplete", "Integrated, validation incomplete: in use, with a documented open validation question."),
    ("acquired_awaiting_processing", "Acquired and awaiting processing."),
    ("processing", "Processing in progress."),
    ("access_restricted", "Access restricted or awaiting credentials."),
    ("endpoint_unavailable", "Endpoint unavailable from this environment: the access attempt failed (see the recorded error)."),
    ("unsuitable", "Investigated but unsuitable."),
    ("not_investigated", "Not yet investigated: relevant, no access attempt possible or made."),
]
# open validation questions of integrated sources (inventory limitations)
OPEN_VALIDATION = {
    "nasa_power": "lim_power_unverified",
    "modis_aqua_lst": "lim_modis_decoded",
    "diviner": "lim_diviner_hour02",
    "diviner_polar": "lim_diviner_hour02",
}
DOMAIN = {"blue_marble": "context", "natural_earth": "context", "gazetteer": "catalogue", "gmted2010": "terrain",
          "gmted_subcell": "terrain", "dem_mars": "terrain", "dem_moon": "terrain", "mola": "terrain", "lola": "terrain",
          "modis_aqua_lst": "thermal", "nasa_power": "climate", "diviner": "thermal", "diviner_gcp": "thermal",
          "diviner_polar": "thermal", "meda": "atmosphere", "rems": "atmosphere", "terraclimate": "climate",
          "era5": "climate", "merra2": "climate", "modis_lst_hdf": "thermal", "nasadem": "terrain", "srtm": "terrain",
          "copernicus_dem": "terrain", "ecostress": "thermal", "viirs": "thermal", "esa_worldcover": "surface",
          "soilgrids": "surface", "jrc_gsw": "hydrology", "landsat": "multispectral", "themis": "thermal",
          "lroc": "imaging", "hirise": "terrain", "ctx": "imaging", "crism": "mineralogy", "mcs": "atmosphere",
          "sentinel2": "multispectral"}
BODY = {"dem_mars": "mars", "mola": "mars", "meda": "mars", "rems": "mars", "themis": "mars", "hirise": "mars",
        "ctx": "mars", "crism": "mars", "mcs": "mars", "tes_thermal_inertia": "mars", "dem_moon": "moon", "lola": "moon",
        "diviner": "moon", "diviner_gcp": "moon", "diviner_polar": "moon", "lroc": "moon", "lola_illumination": "moon",
        "kaguya_sldem": "moon", "gazetteer": "moon+mars"}


def build():
    inv = json.load(open(os.path.join(ROOT, "data/inventory/inventory.json")))
    src = json.load(open(os.path.join(ROOT, "data/v17/sources.json")))["sources"]
    probe = json.load(open(os.path.join(ROOT, "data/v17/probe.json")))
    P = probe["results"]
    rows = []
    for it in inv["items"]:
        if it["class"] == "limitation":
            continue
        r = {"id": it["id"], "origin": "phase4_inventory", "domain": DOMAIN.get(it["id"], "other"),
             "body": BODY.get(it["id"], "earth"), "provider": it.get("provider"), "title": it.get("name"),
             "dataset_id": it.get("version"), "docs": it.get("url"), "endpoint": it.get("url"),
             "license": it.get("license"), "variables": it.get("variables"), "units": it.get("units"),
             "spatial": it.get("resolution"), "processing_resolution": it.get("processing_resolution"),
             "temporal": it.get("temporal"), "coverage": it.get("coverage"), "use": it.get("use")}
        if it["status"] == "integrated":
            ok = it.get("integrity_ok") is not False
            lim = OPEN_VALIDATION.get(it["id"])
            r["state"] = "integrated_validation_incomplete" if (lim or not ok) else "integrated_validated"
            r["validation"] = ("open question: " + next(x["name"] for x in inv["items"] if x["id"] == lim)) if lim else "checksum, unit, range and reproduction tests"
            r["integrity"] = it.get("integrity")
            r["last_retrieval"] = it.get("retrieval")
        else:
            pr = P.get(it["id"])
            r["state"] = "endpoint_unavailable"
            r["probe"] = pr
            r["access_note"] = it.get("reason")
            r["value_note"] = it.get("value")
            r["last_retrieval"] = None
        rows.append(r)
    for s in src:
        pr = P.get(s["id"])
        r = {"origin": "v17_candidate", "body": BODY.get(s["id"], "earth"), **s}
        if not s.get("endpoint"):
            r["state"] = "not_investigated"
        elif pr and not pr["reachable"]:
            r["state"] = "endpoint_unavailable"
        elif pr and pr["reachable"]:
            r["state"] = "access_restricted" if "Login" in (s.get("access") or "") else "acquired_awaiting_processing"
        else:
            r["state"] = "not_investigated"
        r["probe"] = pr
        r["last_retrieval"] = None
        rows.append(r)
    counts = {k: sum(1 for r in rows if r["state"] == k) for k, _ in STATES}
    return {"schema": "asterro.v17.registry/1", "states": [{"id": k, "label": v} for k, v in STATES],
            "probed_utc": probe["probed_utc"], "environment": probe["environment"], "counts": counts,
            "sources": rows}


if __name__ == "__main__":
    r = build(); print(r["counts"], len(r["sources"]))
