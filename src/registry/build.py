"""Build the ASTERRO target registry (asterro.registry/1) from the canonical sources.

Canonical inputs (one source of truth per kind of fact):
  data/registry/catalog.json            bodies, regions, membership, aliases, missions   (hand-curated, no numbers)
  data/raw/phase4/gazetteer_catalog.json gazetteer records: names, coordinates, types, quadrangles (pipeline)
  src/phase3/target_catalog.py          analysis-window definitions                       (pipeline input)
  data/raw/phase3/, data/raw/phase4/    pipeline outputs: fingerprints, grids, retained raw values
  data/targets.json                     legacy baseline targets (unchanged)
  public/data/app.json                  Earth stack registry (unchanged)
The fingerprints themselves are produced by scripts/build_phase3_data.py; this module only maps them into
the registry schema, computes readiness from explicit checks, and runs the offline regeneration.
"""
import hashlib, json, os, re, time
import numpy as np

from . import readiness as RD, verify, schema

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REGISTRY_VERSION = "1.0.0"
UNITS = {"aridity": "index", "annual_temperature_range": "K", "elevation": "m (Earth-equivalent proxy)", "slope": "deg",
         "surface_roughness": "m", "lst_diurnal_range": "K"}
STATUS_MAP = {"DIRECT": "DIRECT", "PROXY": "PROXY", "INCOMPATIBLE": "N/A", "MISSING": "MISSING", "UNVALIDATED": "MISSING", "DERIVED": "DIRECT"}
SCRIPTS_NEW = ["src/data/ingestion/terrain.py", "src/phase3/target_catalog.py", "src/phase3/pipeline/build_atlas.py", "scripts/build_phase3_data.py"]
SCRIPTS_THERMAL = {"rems": ["src/phase3/pipeline/rems_gale.py", "src/data/ingestion/mars_meda.py"],
                   "diviner_polar": ["src/phase4/pipeline/extract_raw_support.py"], "diviner_gcp": ["src/phase4/pipeline/extract_raw_support.py"]}
SCRIPTS_LEGACY = ["src/data/ingestion/terrain.py", "src/data/ingestion/mars_meda.py", "src/data/ingestion/moon_diviner.py",
                  "src/data/preprocessing/build_targets.py", "src/phase4/pipeline/extract_raw_support.py"]


def slug(s):
    s = s.lower().replace("ö", "o").replace("'", "")
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")


def wrap(lon):
    return ((float(lon) + 180.0) % 360.0) - 180.0


def fsha(path):
    return hashlib.sha256(open(os.path.join(ROOT, path), "rb").read()).hexdigest()


def _datasets(app, atlas, stack_retrieved, terrain_time):
    out = {}
    for d in app["datasets"]:
        out[d["id"]] = dict(id=d["id"], provider=d["provider"], product_id=d["dataset"], version=d["version"], url=d["url"], doi=None,
                            retrieved=stack_retrieved.get(d["id"]), license=d["license"], original_resolution=d["resolution"],
                            processing_resolution="0.5° × 0.625° Earth cells" if d["role"].startswith("Earth") else "55.6 km target window",
                            spatial_coverage="global land" if d["role"].startswith("Earth") else d["role"], temporal_coverage=d["temporal"],
                            units=d["units"], nodata="-999 / NaN (see processing)", processing=d["processing"], checksums="via predictor stack SHA-256",
                            script_version="Phase I ingestion (src/data/ingestion)", limitations=None, role=d["role"],
                            retrieval_status="retrieved and verified in the Phase I build")
    for k, d in atlas["datasets"].items():
        ver = d.get("version")
        out[k] = dict(id=k, provider=d["provider"], product_id=d["product_id"], version=json.dumps(ver) if isinstance(ver, dict) else ver,
                      url=d["url"], doi=d.get("doi"), retrieved=d.get("retrieved") or (terrain_time if k.startswith("dem_") else None),
                      license=d["license"], original_resolution=d["resolution"], processing_resolution="926.6 m bins in a 55.6 km window"
                      if k.startswith("dem_") else ("0.5° × 0.625° Earth cells" if k == "gmted_subcell" else "55.6 km target window"),
                      spatial_coverage=d.get("crs"), temporal_coverage=d.get("period"), units=d.get("units"),
                      nodata="NaN / -9999 (Diviner GCP) / -32768 (DEM)", processing=d["processing"], checksums=d.get("checksum"),
                      script_version="see target provenance.scripts", limitations=d.get("limitations"), role="planetary target" if k != "gmted_subcell" else "Earth sub-cell",
                      retrieval_status="retrieved and checksum-verified by the Phase III/IV network jobs")
    return out


def _thumb(tid, body):
    from PIL import Image
    p = os.path.join(ROOT, f"data/raw/phase3/terrain/{tid}.npz")
    if not os.path.exists(p):
        return None
    z = np.load(p)["z"].astype(np.float64)
    gy, gx = np.gradient(np.nan_to_num(z, nan=np.nanmean(z)) / 926.6)
    sl = np.pi / 2 - np.arctan(np.hypot(gx, gy)); asp = np.arctan2(-gx, gy)
    hs = np.clip(np.sin(np.radians(45)) * np.sin(sl) + np.cos(np.radians(45)) * np.cos(sl) * np.cos(np.radians(315) - asp), 0, 1)
    lo, hi = np.nanpercentile(z, [2, 98]); tint = np.clip((z - lo) / max(hi - lo, 1e-9), 0, 1)
    g = (np.nan_to_num(0.7 * hs + 0.3 * tint) * 255).astype(np.uint8)
    os.makedirs(os.path.join(ROOT, "public/data/registry/thumbs"), exist_ok=True)
    fn = f"data/registry/thumbs/{tid}.png"
    Image.fromarray(g, "L").resize((120, 120), Image.NEAREST).save(os.path.join(ROOT, "public", fn), optimize=True)
    return fn


def build(atlas, earth_ranges_fn):
    """atlas: the atlas dict assembled by build_phase3_data (Phase III fingerprints). Returns (registry, atlas-readiness map)."""
    cat = json.load(open(os.path.join(ROOT, "data/registry/catalog.json")))
    gz = json.load(open(os.path.join(ROOT, "data/raw/phase4/gazetteer_catalog.json")))
    app = json.load(open(os.path.join(ROOT, "public/data/app.json")))
    legacy = {t["id"]: t for t in json.load(open(os.path.join(ROOT, "data/targets.json")))["targets"]}
    info = json.load(open(os.path.join(ROOT, "data/metadata/stack_build.json")))
    stack_ret = {"nasa_power": app["stack"]["retrieved"]["power"], "modis_aqua_lst": app["stack"]["retrieved"]["modis"],
                 "gmted2010": app["stack"]["retrieved"]["gmted"]}
    res_t = json.load(open(os.path.join(ROOT, "data/raw/phase3/resolved.json")))
    off = os.path.getmtime(os.path.join(ROOT, "data/raw/phase3/resolved.json")) - time.mktime(time.strptime(res_t["retrieved_utc"], "%Y-%m-%dT%H:%M:%SZ"))
    t0 = os.path.getmtime(os.path.join(ROOT, "data/raw/phase3/terrain/mars_jezero.json")) - off
    t1 = os.path.getmtime(os.path.join(ROOT, "data/raw/phase3/terrain_provenance.json")) - off
    fmt = lambda s: time.strftime("%Y-%m-%dT%H:%MZ", time.localtime(s))
    terrain_time = f"{fmt(t0)} – {fmt(t1)} (pipeline output timestamps)"
    datasets = _datasets(app, atlas, stack_ret, terrain_time)
    compat = atlas["compatibility"]
    aliases = cat["aliases"]
    missions = {m["id"]: m for m in cat["missions"]}

    # ------------------------------------------------------------- locations from the gazetteer
    locations, feat_loc = {}, {}
    for R in cat["regions"]:
        B = R["body"].upper()
        for nm in R["features"]:
            g = gz["features"].get(f"{B}:{nm}")
            if g is None:
                raise SystemExit(f"catalogue feature {B}:{nm} is not in the gazetteer export")
            lid = f"{R['body']}:{slug(nm)}"
            locations[lid] = dict(id=lid, record_type="catalog_location", body=R["body"], region=R["id"], name=g["name"],
                                  aliases=aliases.get(nm, []), feature_type=g["type"], latitude=float(g["center_lat"]), longitude_east=wrap(g["center_lon"]),
                                  coordinate_reference="IAU/USGS gazetteer centre point, planetocentric, east-positive (wrapped to −180..180)",
                                  diameter_km=float(g["diameter"]) if g["diameter"] else None,
                                  extent=dict(min_lat=g["min_lat"], max_lat=g["max_lat"], min_lon=g["min_lon"], max_lon=g["max_lon"]),
                                  approval=g["approval"], quadrangle=f"{g['quad_name']} ({g['quad_code']})",
                                  source=dict(type="gazetteer", url=g["link"], reference=gz["gazetteer"][B]["url"]),
                                  missions=[], target_ids=[])
            feat_loc[f"{R['body']}:{nm}"] = lid
    # reference areas / mission sites (no gazetteer feature of that name)
    def extra(lid, rtype, body, region, name, lat, lon, ftype, source, note):
        locations[lid] = dict(id=lid, record_type=rtype, body=body, region=region, name=name, aliases=[], feature_type=ftype,
                              latitude=lat, longitude_east=wrap(lon), coordinate_reference=note, diameter_km=None, extent=None, approval=None,
                              quadrangle=None, source=source, missions=[], target_ids=[])
    TCdef = {t["id"]: t for t in res_t["targets"]}
    extra("moon:south_pole_window", "reference_area", "moon", "region:moon_south_polar", "Lunar South Pole (55.6 km polar window)", -90.0, 0.0,
          "ASTERRO-defined polar window", dict(type="definition", reference="ASTERRO baseline definition, data/targets.json (window centred on the pole)"), "pole")
    extra("moon:north_pole_window", "reference_area", "moon", "region:moon_north_polar", "Lunar North Polar Region (55.6 km polar window)", 90.0, 0.0,
          "ASTERRO-defined polar window", dict(type="definition", reference="Defined like the baseline south-pole window (src/phase3/target_catalog.py)"), "pole")
    extra("moon:marius_hills_pit", "catalog_location", "moon", "region:moon_procellarum", "Marius Hills Pit", TCdef["moon_marius_hills"]["lat"], TCdef["moon_marius_hills"]["lon"],
          "pit (informal name; LROC Pits Atlas)", dict(type="catalogue", url="https://lroc.im-ldi.com/atlases/pits/1", reference="LROC Pits Atlas"),
          "LROC Pits Atlas coordinate, planetocentric, east-positive")
    for n, tid in ((14, "moon_apollo14_fra_mauro"), (15, "moon_apollo15_hadley"), (16, "moon_apollo16_descartes"), (17, "moon_apollo17_taurus_littrow")):
        extra(f"moon:apollo{n}_site", "catalog_location", "moon", "region:moon_apollo", f"Apollo {n} landing site", TCdef[tid]["lat"], TCdef[tid]["lon"],
              "mission landing site (lunar module)", dict(type="mission", url="https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html",
                                                          reference="NASA NSSDCA Apollo landing site coordinates (from LRO images)"),
              "NSSDCA LM coordinate (from LRO images), planetocentric, east-positive")
        locations[f"moon:apollo{n}_site"]["missions"] = [f"apollo{n}"]
    loc_of = {"mars_jezero": "mars:jezero", "mars_gale_aeolis_mons": "mars:aeolis_mons", "mars_gale_curiosity": "mars:gale",
              "mars_olympus_mons_flank": "mars:olympus_mons", "mars_olympus_mons_plains": "mars:olympus_mons", "mars_olympus_mons_summit": "mars:olympus_mons",
              "moon_south_pole": "moon:south_pole_window", "moon_north_pole": "moon:north_pole_window", "moon_marius_hills": "moon:marius_hills_pit",
              "moon_apollo14_fra_mauro": "moon:apollo14_site", "moon_apollo15_hadley": "moon:apollo15_site", "moon_apollo16_descartes": "moon:apollo16_site",
              "moon_apollo17_taurus_littrow": "moon:apollo17_site", "moon_malapert_massif": "moon:mons_malapert", "moon_orientale": "moon:mare_orientale"}
    region_of = {t: R["id"] for R in cat["regions"] for t in R["targets"]}

    # ------------------------------------------------------------- analytical targets
    TC_by = {}
    import sys
    sys.path.insert(0, os.path.join(ROOT, "src/phase3"))
    from src.phase3 import target_catalog as TC
    TC_by = {t["id"]: t for t in TC.TARGETS}
    targets, regen = [], {}
    for t in atlas["targets"]:
        tid = t["id"]; body = t["body"].lower(); spec = TC_by[tid]; lg = legacy.get(tid)
        lid = loc_of.get(tid)
        if lid is None:
            a = spec["anchor"]
            lid = feat_loc[f"{body}:{a.get('feature') or a.get('gazetteer')}"]
        L = locations[lid]; L["target_ids"].append(tid)
        st = {c: STATUS_MAP[s] for c, s in t["status"].items()}
        vals = {c: (t["values"][c] if st[c] in ("DIRECT", "PROXY") else None) for c in st}
        prov = {}
        for c in st:
            if st[c] != "DIRECT":
                continue
            if lg:
                prov[c] = (["mola"] if body == "mars" else ["lola"]) if c in RD.TERRAIN else (["meda"] if body == "mars" else ["diviner"])
            else:
                prov[c] = t["provenance"][c]
        src = (t.get("thermal") or {}).get("source")
        tw = t["terrain"]
        spatial, temporal, missing = {}, {}, {}
        for c in st:
            if st[c] == "PROXY":
                spatial[c] = temporal[c] = "rule (not a measurement)"
            elif c in RD.TERRAIN:
                spatial[c] = f"55.6 km window, 926.6 m bins from {'MOLA 463 m' if body == 'mars' else 'LOLA 118 m'} ({tw['read_mode']})"
                temporal[c] = "static (MGS 1997–2006)" if body == "mars" else "static (LRO LOLA 2009–2013)"
            elif st[c] == "DIRECT":
                if tid == "mars_jezero":
                    spatial[c] = "rover point (Mars 2020 MEDA)"; temporal[c] = "sols 8–676, one Mars year (MY36)"
                elif src == "rems":
                    spatial[c] = "rover point (MSL REMS) in the Gale window"; temporal[c] = "sols 1–669 (every 2nd), one Mars year (MY31–32)"
                elif src == "diviner_polar" or tid == "moon_south_pole":
                    spatial[c] = "Diviner 240 m polar bins inside the 55.6 km window"; temporal[c] = "2009-07-05 – 2019-02-17, polar summer and winter"
                elif src == "diviner_gcp":
                    p = t["thermal"]["primary"]; spatial[c] = f"Diviner GCP 0.5° bins: {p['bins_used']} of {p['bins_in_window']} in the window"
                    temporal[c] = "2009-07-05 – 2015-04-01, cumulative (all seasons)"
            else:
                missing[c] = t["status_reason"][c]
        fp = dict(version=("legacy-" + json.load(open(os.path.join(ROOT, "data/targets.json")))["version"]) if lg else "1.0.0",
                  variables=vals, units=dict(UNITS), criterion_status=st, missingness=missing, spatial_support=spatial,
                  temporal_support=temporal, provenance=prov)
        fp["content_sha256"] = RD.fingerprint_hash(fp)
        scripts = SCRIPTS_LEGACY if lg else SCRIPTS_NEW + SCRIPTS_THERMAL.get(src, [])
        rg = verify.regenerate(t, legacy=bool(lg)); regen[tid] = rg
        rec = dict(schema_version=schema.SCHEMA_VERSION, id=tid, record_type="analytical_target", legacy=bool(lg), name=t["name"], kind=t["kind"],
                   body=dict(id=body, name=t["body"], body_type="planet" if body == "mars" else "natural satellite"),
                   region=dict(id=region_of[tid], name=next(R["name"] for R in cat["regions"] if R["id"] == region_of[tid])),
                   location=dict(id=lid, name=L["name"], latitude=float(t["anchor"]["lat"]), longitude_east=wrap(t["anchor"]["lon"]),
                                 coordinate_reference=f"analysis-window centre; anchor {t['anchor']['type']}", window_km=55.6,
                                 anchor_source=t["anchor"].get("source"), secondary_source=bool(t["anchor"].get("secondary_source")),
                                 source=L["source"], relation=("window centred on the feature" if t["anchor"]["type"] == "gazetteer" else
                                                              "window inside / beside the feature (see anchor)" if t["anchor"]["type"] in ("mission", "offset") else
                                                              "ASTERRO-defined window")),
                   context=t["context"], missions=cat["target_missions"].get(tid, cat["default_body_missions"][body]),
                   datasets=sorted({d for v in prov.values() for d in v}),
                   fingerprint=fp, terrain_window=dict(complete=tw["complete"], bins_filled=tw["bins_filled"], bins_total=tw["bins_total"], grid_sha256=tw["grid_sha256"]),
                   compatibility={c: compat[c]["verdict"] for c in st},
                   limitations=(lg["limitations"] if lg else []) + [f"{c}: {missing[c]}" for c in missing] +
                               ([t["heterogeneity_note"]] if t.get("heterogeneity_note") else []) +
                               (["Window coordinate from a secondary source (Wikipedia)."] if t["anchor"].get("secondary_source") else []),
                   sources=sorted({datasets[d]["url"] for d in prov_flat(prov)}),
                   provenance=dict(scripts={p: fsha(p) for p in scripts}, atlas_version=atlas["version"]),
                   validation=dict(regeneration=rg, reproduce_check=t.get("reproduce_check"),
                                   scientific_validation="Not performed. No field or expert-reference validation exists for this target."))
        rec["readiness"] = RD.evaluate(rec, datasets, compat)
        lvl = rec["readiness"]["level"]
        cfgs = (["legacy-baseline-v1", "atlas-direct-v1", "atlas-catalogue-v1"] if lg else
                (["explore-target-v1", "atlas-direct-v1", "atlas-catalogue-v1"] if lvl >= 3 else []))
        tv6 = {c: vals[c] for c in st}
        rec["scoring"] = dict(earth_analogue_enabled=lvl >= 3, target_comparison_enabled=lvl >= 3, configs=cfgs,
                              default_explore=("legacy-baseline-v1" if lg else "explore-target-v1") if lvl >= 3 else None,
                              exploratory_partial=(["atlas-direct-v1"] if lvl == 2 else []),
                              explore_ranges=(app["ranges"] if lg else earth_ranges_fn(tv6)) if lvl >= 3 else None,
                              reason=("Readiness ≥ 3: fingerprint complete for its applicable criteria." if lvl >= 3 else
                                      f"Readiness {lvl}: " + "; ".join(c["detail"] for c in rec["readiness"]["checks"] if not c["passed"])[:300]))
        if lg:   # legacy fingerprints are unchanged: guard
            assert all(lg["variables"][c] == vals[c] for c in st), tid
        targets.append(rec)
        if lvl >= 3 or lg:
            th = _thumb(tid, body)
            rec["thumbnail"] = {"mars_jezero": "data/thumb_jezero_mola.png", "moon_south_pole": "data/thumb_southpole_lola.png"}.get(tid, th)
        else:
            rec["thumbnail"] = _thumb(tid, body)
        rec["thumbnail_caption"] = ("Scientific data · " + ("MOLA 463 m" if body == "mars" else "LOLA 118 m") +
                                    " binned to 926.6 m · shaded relief of the 55.6 km window")
    # ------------------------------------------------------------- location readiness
    tby = {t["id"]: t for t in targets}
    for l in locations.values():
        if l["target_ids"]:
            best = max(tby[t]["readiness"]["level"] for t in l["target_ids"])
            l["readiness"] = dict(model=RD.MODEL_VERSION, level=best, label=RD.LEVELS[best][0], via_targets=l["target_ids"],
                                  checks=RD.evaluate(l, datasets, compat)["checks"][:3])
        else:
            r = RD.evaluate(l, datasets, compat)
            l["readiness"] = dict(model=RD.MODEL_VERSION, level=r["level"], label=r["label"], via_targets=[], checks=r["checks"][:3])
        if not l["missions"]:
            l["missions"] = sorted({m for t in l["target_ids"] for m in tby[t]["missions"]})
    regions = []
    for R in cat["regions"]:
        locs = [l for l in locations.values() if l["region"] == R["id"]]
        tl = [t for t in targets if t["region"]["id"] == R["id"]]
        lv = [t["readiness"]["level"] for t in tl]
        regions.append(dict(id=R["id"], body=R["body"], name=R["name"], description=R["description"], region_type="asterro_grouping",
                            quadrangles=sorted({l["quadrangle"] for l in locs if l.get("quadrangle")}),
                            location_ids=[l["id"] for l in locs], target_ids=[t["id"] for t in tl],
                            counts=dict(locations=len(locs), targets=len(tl), scoring_enabled=sum(1 for t in tl if t["scoring"]["earth_analogue_enabled"]),
                                        by_level={str(k): sum(1 for x in lv if x == k) for k in range(1, 5)}),
                            thumbnail=next((t["thumbnail"] for t in tl if t.get("thumbnail")), None)))
    configs = [
        dict(id="legacy-baseline-v1", label="Legacy baseline (unchanged)", criteria_policy="direct_and_proxy", normalisation="legacy_table",
             ranges=app["ranges"], algorithm=app["algorithm_version"], min_coverage=app["thresholds"]["min_coverage"],
             note="The Phase I scoring of Jezero, Lunar South Pole and cross-planet. Regression-tested bit for bit."),
        dict(id="explore-target-v1", label="Explore: six criteria, Earth ∪ target", criteria_policy="direct_and_proxy", normalisation="earth_union_target",
             algorithm=app["algorithm_version"], min_coverage=app["thresholds"]["min_coverage"],
             note="The baseline formula and proxy rules applied to a readiness ≥ 3 target, with ranges [min, max] over valid Earth cells and this target's values."),
        dict(id="atlas-direct-v1", label="Atlas: DIRECT criteria only, Earth ∪ target", criteria_policy="direct_only", normalisation="earth_union_target",
             algorithm=app["algorithm_version"], min_coverage=app["thresholds"]["min_coverage"], note="Phase III atlas default. Proxies excluded."),
        dict(id="atlas-catalogue-v1", label="Atlas: DIRECT only, catalogue table", criteria_policy="direct_only", normalisation="catalogue_table",
             ranges=atlas["normalisation"]["ranges"], algorithm=app["algorithm_version"], min_coverage=app["thresholds"]["min_coverage"],
             note="Counterfactual alternative: Earth ∪ all atlas targets (atlas-norm-1)."),
    ]
    reg = dict(schema=schema.SCHEMA, schema_version=schema.SCHEMA_VERSION, registry_version=REGISTRY_VERSION,
               built_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), stack_sha256=app["stack"]["sha256"],
               readiness_model=dict(version=RD.MODEL_VERSION, levels={str(k): dict(label=v[0], definition=v[1]) for k, v in RD.LEVELS.items()},
                                    checks=[dict(id=c, level=l, requirement=x) for c, l, x in RD.CHECKS], rule=RD.__doc__.strip()),
               criterion_statuses={"DIRECT": "Measured with the same or a documented compatible definition as the Earth criterion.",
                                   "PROXY": "Stand-in defined by rule; explicitly labelled; identical for every planetary target.",
                                   "N/A": "No physical counterpart at this target (e.g. air temperature on the airless Moon).",
                                   "MISSING": "A compatible product was not assembled for this target; never imputed."},
               compatibility=compat, bodies=cat["bodies"], regions=regions, locations=sorted(locations.values(), key=lambda l: (l["body"], l["region"], l["name"])),
               targets=targets, datasets=sorted(datasets.values(), key=lambda d: d["id"]), missions=cat["missions"], scoring_configs=configs,
               earth_search_configs=[dict(id="earth_stack_v1", n_cells=info["n_cells"], grid=info["grid"], sha256=app["stack"]["sha256"],
                                          datasets=["nasa_power", "modis_aqua_lst", "gmted2010"], file="data/stack.b64.txt",
                                          note="Published Earth predictor stack; integrity-checked in the browser before use.")],
               comparison_experiments=[dict(id="legacy_cross_planet", label="Cross-planet (legacy)", targets=["mars_jezero", "moon_south_pole"], aggregate="minimum",
                                            scoring_config="legacy-baseline-v1", regression=True,
                                            meaning="A cell scores high only if it is similar to BOTH targets (minimum of the two effective scores).")])
    errors = schema.validate(reg)
    if errors:
        raise SystemExit("registry invalid:\n  " + "\n  ".join(errors))
    return reg, regen


def prov_flat(prov):
    return sorted({d for v in prov.values() for d in v})
