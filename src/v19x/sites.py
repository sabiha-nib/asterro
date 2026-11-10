"""Site queries at 101 analysed cells: Macrostrat geological map units and GBIF occurrence counts.

NOT NASA datasets.
  Macrostrat (University of Wisconsin-Madison), API v2 geologic_units/map at the cell centre; licence CC-BY 4.0.
  GBIF (Global Biodiversity Information Facility), occurrence search inside the cell (0.5 x 0.625 deg box):
  all records, kingdom Archaea (kingdomKey 2) with up to 3 example records, kingdom Bacteria (kingdomKey 3).
Cells    : the top 50 distinct candidates for Jezero Crater and for the Lunar South Pole (General analogue, equal
           weights, 300 km rule, unchanged engine; data/v19/x/candidate_cells.json) plus the V18 Atacama example.
Raw      : data/v19/raw/sites/asterro_{macrostrat,gbif}_cells.json, every response verbatim with its SHA-256.
Validation: hashes; HTTP 200; unit top age <= base age; counts are non-negative integers; example records lie
           inside their cell and never exceed the count; the 16 cells transcribed in the first V19 pass are compared
           with these exact responses (map unit ids; GBIF counts, which may grow as GBIF ingests new data).
Limits   : 101 cells are a sample, not coverage. Map units at 1:5M or coarser describe regions, not spots. GBIF
           counts reflect sampling and publishing effort; zero records is not absence; presence is not habitability.
"""
import json
from .common import load_raw, sha256_text, p

LITH = [("volcanic", r"volcan|basalt|andesit|rhyol|dacit|tuff|ignimbr"), ("evaporite", r"evapor|salt|gypsum|halite"),
        ("carbonate", r"carbonat|limestone|dolom|marl"), ("siliciclastic", r"siliciclast|sandst|conglom|shale|mudst|clastic|sediment"),
        ("plutonic", r"granit|plutonic|intrusive|gabbro|diorit"), ("metamorphic", r"metamorph|gneiss|schist|quartzite|slate"),
        ("unconsolidated", r"alluv|unconsolid|glacial|loess|dune|sand")]


class ValidationError(Exception):
    pass


def lith_class(lith):
    import re
    for k, rx in LITH:
        if re.search(rx, (lith or "").lower()):
            return k
    return "other"


def _responses(provider):
    d = load_raw(f"sites/asterro_{provider}_cells.json")
    for r in d["responses"]:
        if r is None or r.get("status") != 200:
            raise ValidationError(f"{provider}: a request failed: {r and r.get('url')}")
        if sha256_text(r["body"]) != r["sha256"]:
            raise ValidationError(f"{provider}: SHA-256 mismatch for {r['url']}")
    return d


def build():
    M, G = _responses("macrostrat"), _responses("gbif")
    cells = {c: {"cell": c, "lat": la, "lon": lo} for c, la, lo in M["cells"]}
    refs = {}
    for r in M["responses"]:
        j = json.loads(r["body"])["success"]
        units = []
        for u in j["data"]:
            if u["t_age"] is not None and u["b_age"] is not None and not (u["t_age"] <= u["b_age"]):
                raise ValidationError(f"macrostrat cell {r['cell']}: unit {u['map_id']} top age > base age")
            units.append({"map_id": u["map_id"], "source_id": u["source_id"], "name": u["name"], "lith": u["lith"],
                          "lith_class": lith_class(u["lith"]), "t_age_ma": u["t_age"], "b_age_ma": u["b_age"],
                          "best_int_name": u["best_int_name"], "scale": u["scale"]})
        units.sort(key=lambda u: {"large": 0, "medium": 1, "small": 2, "tiny": 3}.get(u["scale"], 9))
        refs.update({str(k): v.strip() for k, v in j.get("refs", {}).items()})
        cells[r["cell"]]["geology"] = {"units": units, "licence": json.loads(r["body"])["success"].get("license"), "url": r["url"], "utc": r["utc"], "sha256": r["sha256"]}
    datasets = {}
    for r in G["responses"]:
        j = json.loads(r["body"]); c = cells[r["cell"]]
        n = j["count"]
        if not (isinstance(n, int) and n >= 0):
            raise ValidationError(f"gbif cell {r['cell']}: count not a non-negative integer")
        b = c.setdefault("biology", {"urls": {}})
        b[r["kind"]] = n; b["urls"][r["kind"]] = {"url": r["url"], "utc": r["utc"], "sha256": r["sha256"]}
        if r["kind"] == "archaea":
            if len(j["results"]) > min(3, n):
                raise ValidationError(f"gbif cell {r['cell']}: more records than the count")
            ex = []
            for o in j["results"]:
                la, lo = o.get("decimalLatitude"), o.get("decimalLongitude")
                if la is None or not (c["lat"] - 0.25 <= la <= c["lat"] + 0.25 and c["lon"] - 0.3125 <= lo <= c["lon"] + 0.3125):
                    raise ValidationError(f"gbif cell {r['cell']}: record {o['key']} outside its cell")
                ex.append({"key": o["key"], "name": o.get("scientificName") or o.get("acceptedScientificName"), "lat": la, "lon": lo,
                           "uncertainty_m": o.get("coordinateUncertaintyInMeters"), "date": (o.get("eventDate") or "")[:10] or None,
                           "basis": o.get("basisOfRecord"), "dataset": o.get("datasetKey"), "dataset_title": o.get("datasetName"),
                           "licence": o.get("license"), "coords_whole_degrees": float(la).is_integer() and float(lo).is_integer()})
                if o.get("datasetKey"):
                    datasets[o["datasetKey"]] = {"title": o.get("datasetName"), "licence": o.get("license")}
            b["archaea_examples"] = ex
    out = sorted(cells.values(), key=lambda x: x["cell"])
    return {"cells": out, "map_sources": refs, "gbif_datasets": datasets, "cross_check": cross_check(out)}


def cross_check(cells):
    """Compare with the 16 cells transcribed by the fetch service in the first V19 pass."""
    raw = json.load(open(p("data", "v19", "samples", "site_samples_raw.json")))
    req = json.load(open(p("data", "v19", "samples", "requests.json")))
    by = {c["cell"]: c for c in cells}
    res = {"cells_compared": 0, "map_units_agree": 0, "map_units_differ": [], "gbif": []}
    for sid, s in raw["sites"].items():
        c = by.get(req[sid]["cell"])
        if not c: continue
        res["cells_compared"] += 1
        a = sorted(u[0] for u in s["macrostrat"]["units"]); b = sorted(u["map_id"] for u in c["geology"]["units"])
        if a == b: res["map_units_agree"] += 1
        else: res["map_units_differ"].append({"cell": c["cell"], "transcribed": a, "download": b})
        g = s["gbif"]
        res["gbif"].append({"cell": c["cell"], "transcribed": [g["all"], g["archaea"], g["bacteria"]],
                            "download": [c["biology"]["all"], c["biology"]["archaea"], c["biology"]["bacteria"]]})
    return res
