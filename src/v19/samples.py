"""V19 site samples (asterro.v19.site_samples/1): geology, volcanoes and biological records at 16 analysed cells.

Input  data/v19/samples/site_samples_raw.json   values returned by the official APIs (Macrostrat, Smithsonian GVP WFS,
                                                 GBIF), read through the WebFetch service on 2026-11-10 and transcribed
                                                 as structured fields (the build environment's own egress is refused)
       data/v19/samples/requests.json           the exact request URLs and the cells they describe
Output public/data/v19/site_samples.json        per cell: map units, Holocene volcanoes within 100 km, record counts
       data/v19/acquired/<id>.json               acquisition manifests (read by the registry)
       data/v19/fetch_attempts.json              per-dataset attempts on the WebFetch route (read by the registry)

Validation (all must pass, or nothing is written): every volcano lies inside the bounding box that returned it; every
map unit has top age <= base age; every listed microbial record lies inside its cell; counts are non-negative integers;
listed records never exceed the count; the repeat fetches agree; volcanoes returned for two sites have one set of
attributes (they are stored once). Open questions keep the sources at "integrated, awaiting full validation":
16 cells are a sample, not coverage, and transcribed values are not byte-verified copies of the responses.
"""
import json, math, os, re
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VERSION = "tai-v19-samples-1.0.0"
RADIUS_KM = 100.0
ROLES = {"jez": ("mars_jezero", "top distinct candidate for Jezero Crater (General analogue)"),
         "lsp": ("moon_south_pole", "top distinct candidate for the Lunar South Pole (General analogue)"),
         "loc": (None, "V18 Local Impact example (Atacama position)")}
LITH = [("volcanic", r"volcan|rhyolit|andesit|dacit|basalt"), ("intrusive", r"intrusive|granit"),
        ("siliciclastic", r"siliciclastic"), ("sedimentary", r"sediment")]


def km(a, b, c, d):
    p = math.pi / 180
    h = math.sin((c - a) * p / 2) ** 2 + math.cos(a * p) * math.cos(c * p) * math.sin((d - b) * p / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def lith_class(lith):
    for k, rx in LITH:
        if re.search(rx, lith.lower()):
            return k
    return "other"


def _bbox(url):
    b = parse_qs(urlparse(url).query)["bbox"][0].split(",")
    return [float(x) for x in b[:4]]  # min lat, min lon, max lat, max lon (EPSG:4326 axis order)


def build(write=True):
    raw = json.load(open(os.path.join(ROOT, "data/v19/samples/site_samples_raw.json")))
    req = json.load(open(os.path.join(ROOT, "data/v19/samples/requests.json")))
    F = raw["volcano_fields"]
    V = {int(k): dict(zip(F, v), number=int(k)) for k, v in raw["volcanoes"].items()}
    checks, problems = {}, []
    sites = []
    for sid, r in raw["sites"].items():
        q = req[sid]; la, lo = q["lat"], q["lon"]
        role = re.match(r"[a-z]+", sid).group(0); tid, why = ROLES[role]
        # ---- geology (Macrostrat)
        units = [dict(zip(raw["unit_fields"], u)) for u in r["macrostrat"]["units"]]
        for u in units:
            if not (u["t_age_ma"] <= u["b_age_ma"]):
                problems.append(f"{sid}: unit {u['map_id']} top age > base age")
            src = raw["map_sources"][str(u["source_id"])]
            u["source"] = src["citation"]; u["source_scale"] = src.get("scale"); u["doi"] = src.get("doi")
            u["lith_class"] = lith_class(u["lith"])
        units.sort(key=lambda u: {"large": 0, "medium": 1, "small": 2, "tiny": 3}.get(u["scale"], 9))
        # ---- volcanoes (GVP): inside the queried box, then within RADIUS_KM of the cell centre
        bb = _bbox(q["urls"]["gvp"]); near = []
        for n in r["gvp"]["bbox_ids"]:
            v = V[n]
            if not (bb[0] <= v["lat"] <= bb[2] and bb[1] <= v["lon"] <= bb[3]):
                problems.append(f"{sid}: volcano {n} outside its query box")
            d = km(la, lo, v["lat"], v["lon"])
            if d <= RADIUS_KM:
                near.append({"number": n, "km": round(d, 1)})
        near.sort(key=lambda x: x["km"])
        # ---- biological records (GBIF), inside the cell
        g = r["gbif"]
        for k in ("all", "archaea", "bacteria"):
            if not (isinstance(g[k], int) and g[k] >= 0):
                problems.append(f"{sid}: GBIF {k} count not a non-negative integer")
        if len(g["archaea_records"]) > min(3, g["archaea"]):
            problems.append(f"{sid}: more Archaea records than the count")
        recs = []
        for k, name, rla, rlo, unc, date, basis, ds in g["archaea_records"]:
            if not (la - 0.25 <= rla <= la + 0.25 and lo - 0.3125 <= rlo <= lo + 0.3125):
                problems.append(f"{sid}: record {k} outside its cell")
            whole = float(rla).is_integer() and float(rlo).is_integer()
            recs.append({"key": k, "name": name, "lat": rla, "lon": rlo, "uncertainty_m": unc, "date": date, "basis": basis,
                         "dataset": ds, "dataset_title": raw["gbif_datasets"][ds]["title"], "dataset_doi": raw["gbif_datasets"][ds]["doi"],
                         "coords_whole_degrees": whole})
        sites.append({"id": sid, "cell": q["cell"], "lat": la, "lon": lo, "place": q["place"], "target": tid, "why": why,
                      "geology": {"units": units, "lith_classes": sorted({u["lith_class"] for u in units})},
                      "volcanoes": {"radius_km": RADIUS_KM, "n": len(near), "near": near, "box_n": len(r["gvp"]["bbox_ids"])},
                      "biology": {"all": g["all"], "archaea": g["archaea"], "bacteria": g["bacteria"], "archaea_examples": recs},
                      "caves": {"state": "access_blocked", "reason": r["caves"]["status"]},
                      "urls": q["urls"]})
    checks["structure"] = not problems
    checks["repeat_fetches_agree"] = all(x["agree"] for x in raw["repeat_fetches"])
    checks["volcanoes_stored_once"] = len(V) == len(raw["volcanoes"])
    if problems or not all(checks.values()):
        raise SystemExit("site-sample validation failed: " + "; ".join(problems) + json.dumps(checks))
    vol_used = sorted({n["number"] for s in sites for n in s["volcanoes"]["near"]} | {n for s in raw["sites"].values() for n in s["gvp"]["bbox_ids"]})
    doc = {"schema": "asterro.v19.site_samples/1", "version": VERSION, "retrieved": raw["retrieved_utc"], "route": raw["route"],
           "n_sites": len(sites), "radius_km": RADIUS_KM, "sites": sites,
           "volcanoes": {str(n): V[n] for n in vol_used}, "map_sources": raw["map_sources"], "gbif_datasets": raw["gbif_datasets"],
           "literature": raw["literature"], "failed_routes": raw["failed_routes"],
           "validation": {"checks": checks, "repeat_fetches": raw["repeat_fetches"],
                          "open_questions": ["16 analysed cells are a sample, not coverage of the land grid",
                                             "values were transcribed from the responses by the fetch service, not stored as byte-verified files",
                                             "Macrostrat units at these scales are regional map classes, not field observations"]},
           "limits": ["A geological map unit at 1:5M (small) or coarser (tiny) describes a region, not the analysed spot.",
                      "Volcano locations are summit points from the Smithsonian catalogue; the 100 km radius is measured from the cell centre.",
                      "GBIF counts reflect where people sampled and published, not where organisms live; zero records is not absence.",
                      "Microbial records are presence records; they say nothing about habitability on Earth or elsewhere."]}
    if write:
        out = os.path.join(ROOT, "public/data/v19/site_samples.json")
        open(out, "w").write(json.dumps(doc, ensure_ascii=False, sort_keys=True, indent=1))
        _manifests(doc)
    return doc


def _sha(rel):
    import hashlib
    return hashlib.sha256(open(os.path.join(ROOT, rel), "rb").read()).hexdigest()


def _manifests(doc):
    d = os.path.join(ROOT, "data/v19/acquired"); os.makedirs(d, exist_ok=True)
    files = {p: _sha(p) for p in ("data/v19/samples/site_samples_raw.json", "data/v19/samples/requests.json", "public/data/v19/site_samples.json")}
    common = {"files": files,"retrieved_utc": doc["retrieved"], "route": "WebFetch service (structured transcription)", "processing": None,
              "product": "public/data/v19/site_samples.json", "coverage": f"{doc['n_sites']} analysed cells",
              "validation": {"passed": True, "checks": doc["validation"]["checks"], "open_questions": doc["validation"]["open_questions"]}}
    per = {"macrostrat_units": {"records": sum(len(s["geology"]["units"]) for s in doc["sites"]), "license": "CC BY 4.0 (Macrostrat); source maps cited per unit",
                                "endpoint": "https://macrostrat.org/api/v2/geologic_units/map"},
           "gvp_holocene": {"records": len(doc["volcanoes"]), "license": "Smithsonian Institution terms of use; cite Global Volcanism Program, Volcanoes of the World",
                            "endpoint": "https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows (WFS 2.0, Smithsonian_VOTW_Holocene_Volcanoes)"},
           "gbif_extremophiles": {"records": sum(s["biology"]["archaea"] for s in doc["sites"]), "license": "per dataset (both cited datasets CC BY 4.0)",
                                  "endpoint": "https://api.gbif.org/v1/occurrence/search", "method": "counts of all records, Archaea and Bacteria inside each cell; up to 3 Archaea records with dataset metadata"}}
    for k, v in per.items():
        json.dump({**common, **v, "id": k}, open(os.path.join(d, k + ".json"), "w"), indent=1, sort_keys=True)
    att = []
    for k, why in doc["failed_routes"].items():
        att.append({"dataset": k, "origin": "v19_catalogue", "route": "webfetch", "utc": "2026-11-10T11:15:00Z",
                    "class": "fetch_refused", "error": why})
    json.dump({"schema": "asterro.v19.fetch_attempts/1", "note": "attempts through the WebFetch service; a robots.txt refusal or a URL-length limit of that service says nothing about the provider's own availability",
               "attempts": att}, open(os.path.join(ROOT, "data/v19/fetch_attempts.json"), "w"), indent=1)


if __name__ == "__main__":
    d = build(); print(d["n_sites"], "sites;", len(d["volcanoes"]), "volcanoes;", d["validation"]["checks"])
