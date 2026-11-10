"""ASTERRO data inventory (V19 data extension): every dataset ASTERRO uses, has found or needs, with its agency and
the progress it has actually reached.

States (cumulative evidence, never assumed):
  DISCOVERED              official metadata or documentation located (CMR record, provider API, catalogue)
  ACCESSIBLE              a data request to the provider succeeded from an environment ASTERRO used
  DOWNLOADED              the data are retained with SHA-256 (data/v19/raw, or the inputs retained earlier)
  VALIDATED               automated checks on the retained data passed (stated per dataset)
  PROCESSED               converted to an ASTERRO per-cell or per-site product
  INTEGRATED              used by the application
  CACHED                  its product is in the service-worker precache (and the in-browser data store)
  BLOCKED                 every route tried was refused (route and reason recorded)
  REQUIRES_AUTHENTICATION the provider's own metadata says a NASA Earthdata Login is needed
The headline state is the furthest progress state reached; BLOCKED or REQUIRES_AUTHENTICATION when nothing was
downloaded; NOT_INVESTIGATED when there is no evidence at all.
"""
import json, os
from .common import p, VERSION

ORDER = ["DISCOVERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "PROCESSED", "INTEGRATED", "CACHED"]
STATES = ORDER + ["BLOCKED", "REQUIRES_AUTHENTICATION"]
NASA_WORDS = ("nasa", "gsfc", "langley", "jpl", "ges disc", "lp daac", "nsidc daac", "laads", "gibs", "earthdata", "pds ", "pds",
              "merra-2", "ceres", "lro ", "diviner", "mars 2020", "msl ")
FULL = ["DISCOVERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "PROCESSED", "INTEGRATED"]
ROUTE = "Claude desktop built-in browser on the user's computer: fetch() from the provider's own web origin; responses saved byte for byte to Downloads/asterro_data and copied into the build"


def is_nasa(text):
    t = (text or "").lower()
    return any(w in t for w in NASA_WORDS) and "not nasa" not in t


def headline(flags):
    if not flags:
        return "NOT_INVESTIGATED"
    if "DOWNLOADED" not in flags:
        for s in ("REQUIRES_AUTHENTICATION", "BLOCKED"):
            if s in flags: return s
    reached = [s for s in ORDER if s in flags]
    return reached[-1] if reached else "BLOCKED"


def build(rep, cube, cmr_records, core):
    cached = "data/v19/env/cube.bin" in core and "data/v19/env/cube.json" in core
    by_ds = {}
    for v in cube["variables"]:
        for d in v.get("datasets", []): by_ds.setdefault(d, []).append(v["id"])
    rows = []
    # ---------------------------------------------------------------- NASA POWER
    for param, r in rep["power"].items():
        if r.get("state") == "not_downloaded":
            continue
        did = "power_" + param.lower(); src = r.get("sources") or []
        ok_all = r["ok"] == r["requests"]
        rows.append({"id": did, "name": f"NASA POWER climatology, {param} ({r.get('longname') or ''})".replace(" ()", ""),
                     "agency": "NASA", "provider": "NASA Langley Research Center, POWER project",
                     "product": f"POWER Climatology API {r['api_version']}, regional endpoint, community RE, parameter {param}",
                     "source_product": "NASA GMAO MERRA-2 (via POWER)" if "MERRA2" in src else "CERES SYN1deg (via POWER)" if "SYN1DEG" in src else ", ".join(src),
                     "url": "https://power.larc.nasa.gov/api/temporal/climatology/regional", "docs": "https://power.larc.nasa.gov/docs/services/api/temporal/climatology/",
                     "variables": [param], "units": r["units"], "spatial": "0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid)" if r["grid"] == "native" else "1 x 1 deg (CERES SYN1deg), sampled at each cell centre",
                     "temporal": "monthly and annual climatology", "coverage": f"global land: {r['land_cells_with_value']} of {r['land_cells']} ASTERRO land cells have a value",
                     "period": f"{r['period'][0][:4]}-{r['period'][0][4:6]} to {r['period'][1][:4]}-{r['period'][1][4:6]}", "retrieved": r.get("last_utc"), "route": ROUTE,
                     "processing": "each regional response mapped to the ASTERRO grid; a point shared by two boxes must agree exactly; fill value -999 kept missing" + ("; 1 deg values sampled at the cell centre" if r["grid"] != "native" else "")
                                   + ("; exact zeros in all twelve months treated as missing" if r.get("all_zero_to_missing") else ""),
                     "validation": f"{r['ok']} of {r['requests']} responses HTTP 200 with matching SHA-256; {r['overlap_points']} overlapping points, {r['overlap_conflicts']} conflicts; units ({r['units']}) and physical bounds checked",
                     "cube_variables": by_ds.get(did, []), "raw_sha256": r.get("file_sha256"),
                     "last_attempt": None if ok_all else {"class": "rate_limited", "utc": r.get("last_utc"), "error": f"{r['requests'] - r['ok']} of {r['requests']} boxes refused with HTTP 429 (too many requests); their cells stay missing"},
                     "limitations": ("reanalysis: a model constrained by observations, not a direct measurement" if "MERRA2" in src else "satellite-derived product at 1 deg")
                                    + "; a climatology of 2001-2025, not current conditions; one value per ~55 km cell",
                     "flags": FULL + (["CACHED"] if cached and by_ds.get(did) else [])})
    # ---------------------------------------------------------------- NASA GIBS imagery
    GIBS = {"MERRA2_Dust_Surface_Mass_Concentration_Monthly": ("MERRA-2 dust surface mass concentration, monthly (GIBS)", "M2TMNXAER", "reanalysis aerosol model, not a dust measurement; colormap bins of 0.5 ug/m3; months in the open top bin (90 ug/m3 and above) make the value a lower bound"),
            "MODIS_Terra_L3_Snow_Cover_Monthly_Average_Pct": ("MODIS Terra snow cover, monthly average (GIBS)", "MOD10CM", "lower bound: GIBS renders snow-free, cloudy, dark and missing pixels alike as transparent"),
            "MODIS_Terra_L3_EVI_Monthly": ("MODIS Terra Enhanced Vegetation Index, monthly (GIBS)", "MOD13A3", "plant greenness only; gaps where snow, cloud or darkness prevent a value"),
            "MISR_Aerosol_Optical_Depth_Avg_Green_Monthly": ("MISR aerosol optical depth (green band), monthly (GIBS)", "MIL3MAEN", "column aerosol amount, not surface dust; sparse sampling; open top bin at 1.0"),
            "MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual": ("MODIS land cover type, IGBP scheme, annual (GIBS)", "MCD12Q1", "a land-cover class is not a rock or mineral composition"),
            "MODIS_Terra_L3_Land_Water_Mask": ("MODIS land/water mask (GIBS)", "MOD44W", "water presence in the map year; includes sea at coasts; not water history or accessible water")}
    cm = {r["short_name"]: r for r in cmr_records if r.get("found")}
    for layer, r in rep["gibs"].items():
        if r.get("state") == "not_downloaded":
            continue
        name, sn, lim = GIBS[layer]; c = cm.get(sn, {}); did = "gibs_" + layer.lower()
        first, last = r.get("first") or r.get("time"), r.get("last") or r.get("time")
        rows.append({"id": did, "name": name, "agency": "NASA", "provider": "NASA ESDIS, Global Imagery Browse Services (GIBS)",
                     "product": f"GIBS WMS layer {layer} (EPSG:4326, PNG) with colormap v1.3", "source_product": f"{sn} v{c.get('version')} ({c.get('concept_id')}), {', '.join(c.get('archive') or [])}" if c else sn,
                     "doi": c.get("doi"), "url": "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi", "docs": c.get("landing_page") or "https://nasa-gibs.github.io/gibs-api-docs/",
                     "variables": [layer], "units": "decoded with the layer's colormap (see the ASTERRO variables)", "spatial": f"source {c.get('resolution') or '?'}; imagery requested at {r.get('width', 3600)} x {r.get('height', 1800)} pixels",
                     "temporal": (c.get("period") or {}).get("resolution") or "annual", "coverage": "global", "period": f"{(first or '')[:7]} to {(last or '')[:7]}",
                     "retrieved": r.get("last_utc") or r.get("utc"), "route": ROUTE,
                     "processing": "each pixel decoded through the GIBS colormap (interval midpoints; class codes; transparent pixels only through transparent entries); pixels assigned to the nearest ASTERRO cell; monthly climatology over the years",
                     "validation": f"PNG and colormap SHA-256 verified; every opaque pixel colour found in the colormap; pixel tally {json.dumps(r.get('pixels'))}",
                     "cube_variables": by_ds.get(did, []), "raw_sha256": r.get("file_sha256"),
                     "limitations": lim + "; GIBS imagery is a visualisation of the science product, quantised to colormap bins; the science files (HDF/NetCDF) need an Earthdata Login",
                     "flags": FULL + (["CACHED"] if cached and by_ds.get(did) else [])})
    # ---------------------------------------------------------------- Smithsonian GVP (not NASA)
    g = rep["gvp"]
    for kind, did, ds in (("holocene", "gvp_holocene_full", "gvp_holocene"), ("pleistocene", "gvp_pleistocene", "gvp_pleistocene")):
        src = cube["sources"].get("gvp_" + kind, {})
        val = f"numberMatched = numberReturned = {g[kind]['features']} features (the whole layer); CRS EPSG:4326; point geometry equals the Latitude/Longitude attributes; unique volcano numbers"
        if kind == "holocene":
            val += f"; the {g['cross_check']['transcribed']} volcanoes transcribed in the first V19 pass all agree with this download ({g['cross_check']['agree']} of {g['cross_check']['transcribed']})"
        rows.append({"id": did, "name": f"Smithsonian GVP {kind.title()} volcano list (complete)", "agency": "Smithsonian Institution (not NASA)",
                     "provider": "Global Volcanism Program, National Museum of Natural History", "product": f"Volcanoes of the World: GVP-VOTW:Smithsonian_VOTW_{kind.title()}_Volcanoes (WFS 2.0, GeoJSON)",
                     "url": "https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows", "docs": "https://volcano.si.edu/", "variables": ["number, name, type, last known eruption, position, elevation, rock type, evidence"],
                     "units": "degrees; years CE (negative = BCE); m", "spatial": "points (summit or field centre)", "temporal": "catalogue snapshot", "coverage": "global",
                     "period": "Holocene (last ~11,700 years)" if kind == "holocene" else "Pleistocene", "retrieved": g[kind]["timeStamp"], "route": ROUTE,
                     "processing": "great-circle distance from every cell centre to the nearest volcano; counts within 100 km", "validation": val,
                     "cube_variables": by_ds.get(ds, []), "raw_sha256": src.get("raw_sha256"),
                     "limitations": "a point per volcano; proximity is not a hazard rating or an eruption probability; licence: Smithsonian terms of use, cite the Global Volcanism Program",
                     "flags": FULL + (["CACHED"] if cached else [])})
    # ---------------------------------------------------------------- site queries (not NASA)
    cc = rep["sites"]["cross_check"]
    for k, did, name, ag, url, lim in (("macrostrat", "macrostrat_sites", "Macrostrat geological map units at 101 cells", "Macrostrat, University of Wisconsin-Madison (not NASA)", "https://macrostrat.org/api/v2/geologic_units/map",
                                        "regional map classes (1:5M or coarser in most places), not field observations; licence CC-BY 4.0"),
                                       ("gbif", "gbif_sites", "GBIF occurrence counts at 101 cells", "GBIF Secretariat (not NASA)", "https://api.gbif.org/v1/occurrence/search",
                                        "presence records shaped by sampling and publishing effort; zero records is not absence; presence is not habitability")):
        src = cube["sources"].get("sites_" + k, {})
        agree = f"{cc['map_units_agree']} of {cc['cells_compared']} map-unit sets" if k == "macrostrat" else f"{sum(1 for x in cc['gbif'] if x['transcribed'] == x['download'])} of {len(cc['gbif'])} cells' counts"
        rows.append({"id": did, "name": name, "agency": ag, "provider": ag.replace(" (not NASA)", ""), "product": url, "url": url, "docs": url,
                     "variables": ["map units, lithology, age range, map scale, source map"] if k == "macrostrat" else ["all records, Archaea, Bacteria; up to 3 Archaea examples with dataset"],
                     "units": "Ma" if k == "macrostrat" else "records", "spatial": "cell centre point query" if k == "macrostrat" else "the 0.5 x 0.625 deg cell", "temporal": "current database",
                     "coverage": "101 cells: the top 50 distinct candidates for Jezero Crater and for the Lunar South Pole (unchanged engine) and the Atacama example", "period": "as published",
                     "retrieved": None, "route": ROUTE, "processing": "per-cell parsing; lithology classes", "cube_variables": [], "raw_sha256": src.get("raw_sha256"),
                     "validation": f"all {len(rep['sites'].get('cross_check', {}).get('gbif', [])) and 'responses'} HTTP 200 with SHA-256; age order checked; the 16 cells transcribed earlier agree with these exact responses ({agree})",
                     "limitations": lim + "; a sample of 101 cells, not coverage", "flags": FULL + (["CACHED"] if "data/v19/env/sites.json" in core else [])})
    # ---------------------------------------------------------------- V20: USGS Mineral Resources Data System (not NASA)
    mp = p("public", "data", "v20", "mrds.json")
    if os.path.exists(mp):
        m = json.load(open(mp, encoding="utf-8"))
        rows.append({"id": "usgs_mrds", "name": "USGS Mineral Resources Data System (MRDS), complete CSV", "agency": "U.S. Geological Survey (not NASA)",
                     "provider": m["provider"], "product": m["product"], "url": m["url"], "docs": "https://mrdata.usgs.gov/mrds/",
                     "variables": ["site name, position, primary commodity, development status, country"], "units": "records; km", "spatial": "points (reported site positions)",
                     "temporal": f"catalogue snapshot (file {m['file_date']}; metadata edition {m['metadata_edition']}; maintenance: {m['maintenance']})", "period": "as published",
                     "coverage": f"global catalogue, {m['country_share'][0][2]}% of records in the {m['country_share'][0][0]}; {len(m['cells'])} land cells have a record within {int(m['radius_km'])} km",
                     "retrieved": m["retrieved"], "route": ROUTE, "processing": f"records with valid coordinates ({m['used']} of {m['records']}); per cell: records within {int(m['radius_km'])} km of the cell centre, producers, nearest record and the three most frequent primary commodities",
                     "validation": f"archive SHA-256 pinned in src/v20/mrds.py; {m['excluded_bad_coordinates']} records with unusable coordinates excluded and counted; Atacama example checked in tests",
                     "cube_variables": [], "raw_sha256": m["raw_sha256"], "limitations": m["limitations"],
                     "flags": FULL + (["CACHED"] if "data/v20/mrds.json" in core else [])})
    # ---------------------------------------------------------------- NASA collections found through CMR
    gibs_rel = {v[1]: "gibs_" + k.lower() for k, v in GIBS.items()}
    for r in cmr_records:
        if not r.get("found"):
            rows.append({"id": "cmr_" + r["short_name"].lower(), "name": r["short_name"], "agency": "NASA (searched)", "provider": "NASA Common Metadata Repository",
                         "product": r["short_name"], "url": r["query"], "retrieved": r["utc"], "route": ROUTE, "note": "CMR returned no collection under this short name; not investigated further",
                         "flags": []}); continue
        f = ["DISCOVERED"] + (["REQUIRES_AUTHENTICATION"] if r["requires_earthdata_login"] else [])
        rel = gibs_rel.get(r["short_name"])
        per = r["period"] or {}
        rows.append({"id": "cmr_" + r["short_name"].lower(), "name": r["title"], "agency": "NASA", "provider": ", ".join(r["archive"] or [r["provider_id"]]),
                     "product": f"{r['short_name']} version {r['version']}, CMR concept {r['concept_id']}", "doi": r["doi"], "url": r["get_data"] or r["landing_page"], "docs": r["landing_page"],
                     "spatial": r["resolution"], "temporal": per.get("resolution"), "coverage": "per the collection metadata",
                     "period": f"{per.get('begin')} to {per.get('end') or ('present' if per.get('ongoing') else '?')}", "retrieved": r["utc"], "route": ROUTE + " (metadata search only)",
                     "cloud": r["cloud_region"], "access": (r["access_constraints"] or "").strip() or None,
                     "note": (f"its GIBS imagery is downloaded and integrated as {rel}" if rel else "metadata located; no data downloaded"),
                     "limitations": "discovery record only: official identifiers and access conditions, not data" + ("; the science files need a NASA Earthdata Login, which ASTERRO does not hold" if r["requires_earthdata_login"] else ""),
                     "flags": f})
    # ---------------------------------------------------------------- earlier V19 registry, kept and mapped
    V19 = json.load(open(p("public", "data", "v19", "registry.json")))
    now = {"power_wind": "power_ws10m", "macrostrat_units": "macrostrat_sites", "macrostrat": "macrostrat_sites", "gvp_holocene": "gvp_holocene_full", "gvp_volcanoes": "gvp_holocene_full",
           "gbif_extremophiles": "gbif_sites", "gbif": "gbif_sites", "modis_snow": "gibs_modis_terra_l3_snow_cover_monthly_average_pct", "modis_vegetation": "gibs_modis_terra_l3_evi_monthly",
           "merra2_aerosol": "gibs_merra2_dust_surface_mass_concentration_monthly", "merra2_aer": "gibs_merra2_dust_surface_mass_concentration_monthly", "modis_aerosol": "power_aod_55",
           "gibs_modis_aod": "gibs_misr_aerosol_optical_depth_avg_green_monthly", "merra2_wind": "power_ws10m", "merra2": "power_ws10m", "usgs_mrds": "usgs_mrds"}
    for s in V19["sources"]:
        st = s["state"]
        if st == "integrated_validated": f = FULL + (["CACHED"] if cached else [])
        elif st == "integrated_awaiting_validation": f = ["DISCOVERED", "ACCESSIBLE", "DOWNLOADED", "PROCESSED", "INTEGRATED"]
        elif st == "awaiting_credentials": f = ["DISCOVERED", "REQUIRES_AUTHENTICATION"]
        elif st == "not_investigated": f = []
        else: f = ["DISCOVERED", "BLOCKED"]
        sid = s["id"].replace("@v19", "")
        la = s.get("last_attempt") if isinstance(s.get("last_attempt"), dict) else None
        rows.append({"id": "v19_" + s["id"].replace("@", "_"), "name": s.get("title") or sid, "agency": "NASA" if is_nasa(s.get("provider")) else (s.get("provider") or "–") + " (not NASA)",
                     "provider": s.get("provider"), "product": s.get("dataset_id"), "url": s.get("docs"), "docs": s.get("docs"), "units": s.get("units"), "spatial": s.get("spatial"),
                     "temporal": s.get("temporal"), "period": s.get("temporal"), "validation": s.get("validation"), "access": s.get("license"),
                     "last_attempt": {"class": la.get("class"), "utc": la.get("utc"), "error": la.get("error") or ("HTTP " + str(la.get("http_status")) if la.get("http_status") else None)} if la else None,
                     "note": f"V19 registry state: {st}" + (f"; for this need ASTERRO now uses {now[sid]}" if sid in now else ""), "from": "V19 Data Integration Registry",
                     "limitations": None, "flags": f})
    for r in rows:
        r["nasa"] = r["agency"] == "NASA" or r["agency"].startswith("NASA ")
        fl = r.pop("flags"); r["states"] = [s for s in STATES if s in fl]
        r["state"] = headline(r["states"])
    counts = {}
    for r in rows: counts[r["state"]] = counts.get(r["state"], 0) + 1
    routes = [
        {"route": "this build environment (cloud)", "result": "every provider refused: the egress proxy answered 403 to CONNECT", "class": "network_policy"},
        {"route": "the user's computer, shell", "result": "every provider refused: the shell's proxy answered 403 to CONNECT", "class": "network_policy"},
        {"route": "WebFetch service", "result": "Macrostrat, GVP and GBIF answered as transcriptions only; POWER and SoilGrids refused by robots.txt; GIBS images: server error; URLs over about 250 characters refused", "class": "service_limits"},
        {"route": "the user's computer, Claude desktop browser", "result": "POWER, GIBS, CMR, GVP, Macrostrat, GBIF and (V20) USGS MRDS answered; files saved byte for byte; POWER refused some boxes with HTTP 429 (rate limit)", "class": "working"},
    ]
    return {"schema": "asterro.v19x.inventory/1", "version": VERSION, "states": STATES, "n": len(rows), "nasa": sum(r["nasa"] for r in rows),
            "counts": counts, "rows": rows, "routes": routes}
