"""V19 data acquisition catalogue (asterro.v19.sources/1).

One entry per candidate dataset, with every field asked for by the V19 brief (purpose, provider, identifier, mission or
instrument, documentation, access routes, authentication, licence, resolution, coordinate system, units, coverage, format,
processing, validation, expected value, storage and compute). Each entry also lists *all* known official access routes,
because a refusal of one route (or of one provider host) says nothing about the others.

`doc_status` is honest about where each description comes from:
  "verified_retained"  the route and parameters are proven by data already retained in this repository
                       (metadata written at retrieval time);
  "verified_response"  the route, field names and licence were confirmed by the provider's own responses when the
                       data were acquired (V19 site samples, 2026-11-10);
  "unverified"         compiled from published product documentation as known to the author; to be checked against
                       the provider's own metadata (CMR, the provider page) before the dataset counts as acquired.
Nothing in this file is data. Integration states are decided by src/v19/registry.py from probes and acquisition
manifests, never from this catalogue.
"""

DOMAINS = ["terrain", "geology", "mineralogy", "surface_materials", "thermal", "illumination", "hydrology", "cryosphere",
           "atmosphere", "dust_aeolian", "biology", "subsurface", "processes", "robotic_ops", "human_ops", "resources"]


def R(kind, url, auth="none", note=None):
    r = {"kind": kind, "url": url, "auth": auth}
    if note:
        r["note"] = note
    return r


E = []  # entries


def add(**k):
    k.setdefault("body", "earth")
    k.setdefault("doc_status", "unverified")
    E.append(k)


# ---------------------------------------------------------------- Earth: atmosphere, wind, dust
add(id="power_wind", domains=["atmosphere", "dust_aeolian", "human_ops"], priority=1,
    purpose="Climatological near-surface wind speed (2 m, 10 m, 50 m) and humidity/pressure on ASTERRO's own grid, for wind exposure and aeolian-process context.",
    provider="NASA Langley Research Center, POWER project", dataset_id="POWER Climatology API v2 (source: MERRA-2)",
    instrument="MERRA-2 reanalysis (GMAO)", docs="https://power.larc.nasa.gov/docs/",
    routes=[R("api", "https://power.larc.nasa.gov/api/temporal/climatology/regional", note="the route used for the retained POWER climatology (API v2.10.0)"),
            R("api", "https://power.larc.nasa.gov/api/system/manager/parameters", note="parameter dictionary, to confirm WS2M, WS10M, WS50M, RH2M, PS")],
    auth="none", license="NASA open data; POWER citation requested",
    spatial="0.5° × 0.625° (MERRA-2 native)", temporal="monthly and annual climatology, 2001–2020", crs="EPSG:4326",
    units="m/s (wind), % (RH), kPa (pressure)", coverage="global", format="JSON (regional API, 10° × 10° tiles)",
    processing="Same tiling and cell alignment as the retained T2M/PRECTOTCORR climatology; fill value −999 kept as missing.",
    validation="Grid identity with power_climatology.npz; physical ranges; spot comparison with REMS/MEDA is not a validation (different planet).",
    value="Unlocks wind exposure (atmosphere, dust/aeolian, EVA/habitat operations). Reanalysis, not observation: labelled as such.",
    storage="≈ 2 MB per parameter (13 × 361 × 576 float32)", compute="≈ 140 API calls per parameter")
add(id="gibs_modis_aod", domains=["atmosphere", "dust_aeolian"], priority=2,
    purpose="Column aerosol optical depth climatology as an atmospheric dust/aerosol indicator (never as surface dust deposition).",
    provider="NASA ESDIS, Global Imagery Browse Services", dataset_id="MODIS aerosol optical depth layers (GIBS)",
    instrument="Terra/Aqua MODIS", docs="https://nasa-gibs.github.io/gibs-api-docs/",
    routes=[R("wms", "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi", note="the route used for the retained MODIS LST"),
            R("wmts_capabilities", "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml", note="to find the exact AOD layer and its colormap")],
    auth="none", license="NASA open data", spatial="rendered imagery; native product resolution per layer", temporal="per layer (daily/monthly)",
    crs="EPSG:4326", units="dimensionless (AOD)", coverage="global, cloud-free retrievals only", format="PNG + colormap XML",
    processing="Decode rendered colours with the layer's colormap (as for LST), aggregate to cells, keep retrieval counts.",
    validation="Quantisation error from the colormap; comparison with MCD19A2 or MERRA-2 AOD if those become accessible.",
    value="First aerosol indicator. Decoded from imagery: labelled 'satellite-derived, decoded', proxy for dust.",
    storage="≈ 3 MB per month layer at 0.1°", compute="≈ 12–120 WMS calls")
add(id="merra2_aer", domains=["atmosphere", "dust_aeolian"], priority=4,
    purpose="Dust column mass and dust AOD (reanalysis) to separate dust from other aerosols.",
    provider="NASA GES DISC", dataset_id="M2TMNXAER (MERRA-2 tavgM_2d_aer_Nx)", instrument="MERRA-2 reanalysis",
    docs="https://disc.gsfc.nasa.gov/", routes=[R("daac", "https://goldsmr4.gesdisc.eosdis.nasa.gov/data/MERRA2_MONTHLY/", auth="earthdata_login")],
    auth="earthdata_login", license="NASA open data", spatial="0.5° × 0.625°", temporal="monthly, 1980–present", crs="EPSG:4326",
    units="kg/m² (column mass), dimensionless (AOD)", coverage="global", format="NetCDF4", processing="Monthly climatology over 2001–2020 to match POWER.",
    validation="AERONET comparisons published by GMAO (reference only).", value="Dust-specific aerosol; model output, labelled as such.",
    storage="≈ 1 GB for 20 years monthly", compute="moderate")
# ---------------------------------------------------------------- Earth: geology, volcanoes, soils
add(id="macrostrat_units", doc_status="verified_response", domains=["geology", "surface_materials", "processes", "resources"], priority=1,
    purpose="Geological map units at a point: lithology, age range, map scale and source map, for cell-level geological context.",
    provider="Macrostrat (University of Wisconsin–Madison)", dataset_id="Macrostrat API v2 geologic_units/map (harmonised maps)",
    instrument="compiled geological maps", docs="https://macrostrat.org/api/v2/",
    routes=[R("api", "https://macrostrat.org/api/v2/geologic_units/map?lat={lat}&lng={lon}&scale=small", note="one request per cell centre"),
            R("api", "https://macrostrat.org/api/v2/defs/lithologies", note="lithology vocabulary")],
    auth="none", license="CC BY 4.0 (Macrostrat); source maps cited per unit", spatial="map scale per source (small ≈ 1:5–20M globally)",
    temporal="static", crs="EPSG:4326", units="classes; ages in Ma", coverage="global at small scale, denser where large-scale maps exist",
    format="JSON", processing="Query each land cell centre (or a sample of points per cell); keep source map id and scale; never treat as a field survey.",
    validation="Spot checks against well-known units (e.g. Deccan basalts, Atacama evaporites); share of cells with a unit.",
    value="Unlocks geology, surface materials and part of resources; volcanic, sedimentary and evaporite context.",
    storage="≈ 20–60 MB JSON for all land cells", compute="≈ 77 000 requests: needs polite rate limiting and caching")
add(id="gvp_holocene", doc_status="verified_response", domains=["geology", "processes", "subsurface"], priority=1,
    purpose="Inventory of Holocene volcanoes (location, type, rock type, last eruption) for volcanic context and lava-tube connections.",
    provider="Smithsonian Institution, Global Volcanism Program", dataset_id="Volcanoes of the World (VOTW) Holocene list",
    instrument="catalogue", docs="https://volcano.si.edu/",
    routes=[R("wfs", "https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&request=GetCapabilities"),
            R("download", "https://volcano.si.edu/list_volcano_holocene.cfm", note="spreadsheet export")],
    auth="none", license="Smithsonian terms of use; cite VOTW version", spatial="point locations", temporal="catalogue version",
    crs="EPSG:4326", units="points; elevation m", coverage="global", format="GeoJSON/XLSX", processing="Points to cells; distances for Local Impact.",
    validation="Record count against the published VOTW version; spot checks.", value="Real nearby volcanoes in Local Impact; volcanic environments.",
    storage="< 2 MB", compute="trivial")
add(id="soilgrids", domains=["surface_materials", "biology"], priority=3,
    purpose="Soil texture, organic carbon and pH as surface-material context.", provider="ISRIC – World Soil Information",
    dataset_id="SoilGrids 2.0", instrument="digital soil mapping (model)", docs="https://www.isric.org/explore/soilgrids",
    routes=[R("api", "https://rest.isric.org/soilgrids/v2.0/properties/query?lat={lat}&lon={lon}", note="point queries; rate-limited"),
            R("files", "https://files.isric.org/soilgrids/latest/data/", note="global COG/VRT layers")],
    auth="none", license="CC BY 4.0", spatial="250 m", temporal="static", crs="Homolosine (files) / EPSG:4326 (API)",
    units="per property (e.g. g/kg, pH×10)", coverage="global land", format="GeoTIFF/JSON",
    processing="Aggregate the 0–5 cm layer to cells from the COGs (preferred over 77 000 point calls).",
    validation="Published SoilGrids accuracy statistics (reference).", value="Surface materials; model output, labelled as such.",
    storage="≈ 1–5 GB per property for the full global layer, or windowed reads", compute="needs rasterio/GDAL")
# ---------------------------------------------------------------- Earth: water, cryosphere, land cover, DEM
add(id="jrc_gsw", domains=["hydrology", "processes"], priority=2,
    purpose="Surface-water occurrence 1984–2021 (historical vs present water) for water-history context.",
    provider="European Commission JRC / Google", dataset_id="Global Surface Water v1.4", instrument="Landsat 5/7/8",
    docs="https://global-surface-water.appspot.com/", routes=[R("cloud", "https://storage.googleapis.com/global-surface-water/downloads2021/", note="10° × 10° tiles per layer")],
    auth="none", license="CC BY 4.0 (cite Pekel et al. 2016)", spatial="30 m", temporal="1984–2021", crs="EPSG:4326",
    units="% of valid observations with water", coverage="global (−56° to 78°)", format="GeoTIFF", processing="Per-cell share of pixels with occurrence > 0, mean occurrence, and 'lost water' (transitions layer).",
    validation="Published accuracy (omission/commission); compare with Natural Earth lakes.", value="Water history; dry-lake context.",
    storage="occurrence layer ≈ 6–10 GB if all tiles are read; windowed/streamed reading preferred", compute="needs rasterio")
add(id="esa_worldcover", domains=["surface_materials", "biology"], priority=3,
    purpose="Land cover classes (bare/sparse, snow/ice, water, vegetation) per cell.", provider="ESA / VITO",
    dataset_id="ESA WorldCover 10 m v200 (2021)", instrument="Sentinel-1/2", docs="https://esa-worldcover.org/",
    routes=[R("cloud", "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/", note="3° × 3° COG tiles")],
    auth="none", license="CC BY 4.0", spatial="10 m", temporal="2021", crs="EPSG:4326", units="class shares",
    coverage="global land", format="COG", processing="Class shares per cell from overviews (COG pyramids) instead of full resolution.",
    validation="Published accuracy ≈ 77 % overall (reference).", value="Bare-ground share, snow/ice, vegetation.",
    storage="≈ 100 GB at full resolution; overviews keep it to a few GB", compute="needs rasterio")
add(id="copernicus_dem", domains=["terrain"], priority=4, purpose="Higher-resolution terrain for aspect and landform scale.",
    provider="ESA / Copernicus", dataset_id="Copernicus DEM GLO-90 / GLO-30", instrument="TanDEM-X", docs="https://spacedata.copernicus.eu/",
    routes=[R("cloud", "https://copernicus-dem-90m.s3.amazonaws.com/"), R("cloud", "https://copernicus-dem-30m.s3.amazonaws.com/")],
    auth="none", license="Copernicus DEM licence (free, attribution)", spatial="90 m / 30 m", temporal="2011–2015",
    crs="EPSG:4326", units="m", coverage="global", format="COG", processing="Aspect and sub-cell landform statistics.",
    validation="Compare with GMTED2010 cell means (already integrated).", value="Aspect; landform-scale analysis.",
    storage="GLO-90 ≈ 30–40 GB", compute="needs rasterio")
add(id="rgi7", domains=["cryosphere"], priority=3, purpose="Glacier outlines for ice context.",
    provider="GLIMS / NSIDC", dataset_id="Randolph Glacier Inventory v7.0 (NSIDC-0770)", instrument="compiled outlines",
    docs="https://nsidc.org/data/nsidc-0770/versions/7", routes=[R("files", "https://daacdata.apps.nsidc.org/pub/DATASETS/nsidc0770_rgi_v7/")],
    auth="none", license="CC BY 4.0", spatial="vector", temporal="≈ 2000 epoch", crs="EPSG:4326", units="km²",
    coverage="global glaciers outside ice sheets", format="Shapefile/CSV", processing="Glacier area share per cell.",
    validation="Area totals against the RGI documentation.", value="Cryosphere: glaciers.", storage="≈ 1 GB", compute="needs shapely or ogr")
# ---------------------------------------------------------------- Earth: biology, caves
add(id="gbif_extremophiles", doc_status="verified_response", domains=["biology"], priority=2,
    purpose="Documented occurrence records of selected extremophile taxa (halophiles, acidophiles, psychrophiles) with source, date and coordinate uncertainty.",
    provider="GBIF Secretariat", dataset_id="GBIF occurrence API v1", instrument="aggregated occurrence records",
    docs="https://techdocs.gbif.org/en/openapi/v1/occurrence", routes=[R("api", "https://api.gbif.org/v1/occurrence/search?taxonKey={key}&hasCoordinate=true")],
    auth="none", license="per record: CC0, CC BY or CC BY-NC; recorded per record", spatial="points with coordinateUncertaintyInMeters",
    temporal="per record", crs="EPSG:4326", units="records", coverage="uneven (sampling bias)", format="JSON",
    processing="Fixed, documented taxon list; keep dataset key, licence, basis of record, date, uncertainty; drop records without coordinates.",
    validation="Taxon-key resolution via the GBIF species API; counts per taxon; sampling-bias note.",
    value="Biological evidence: presence records, never inferred life or habitability.", storage="< 50 MB", compute="paged API calls")
add(id="wikidata_caves", domains=["subsurface"], priority=2,
    purpose="Documented caves and lava tubes with coordinates as a community-maintained inventory (not authoritative, not complete).",
    provider="Wikimedia Foundation, Wikidata", dataset_id="Wikidata SPARQL (instances of cave / lava tube)", instrument="community catalogue",
    docs="https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service", routes=[R("sparql", "https://query.wikidata.org/sparql")],
    auth="none", license="CC0", spatial="points (accuracy unknown per item)", temporal="query date", crs="EPSG:4326",
    units="points; length m where stated", coverage="uneven", format="JSON", processing="Keep item id, label, class, coordinates, stated length/depth with their references.",
    validation="Spot checks of known lava tubes; share of items with references.", value="Subsurface context in Local Impact, labelled as an incomplete inventory.",
    storage="< 20 MB", compute="few queries")
# ---------------------------------------------------------------- Planetary
add(id="usgs_mars_geology", body="mars", domains=["geology"], priority=2,
    purpose="Global geologic units of Mars for the planetary side of a geological comparison (map classes, not mineralogy).",
    provider="USGS Astrogeology", dataset_id="Geologic Map of Mars, SIM 3292 (Tanaka et al. 2014), 1:20M", instrument="MOLA, THEMIS, CTX, HRSC based mapping",
    docs="https://pubs.usgs.gov/sim/3292/", routes=[R("files", "https://astrogeology.usgs.gov/search/map/mars_geologic_map"), R("files", "https://planetarymaps.usgs.gov/")],
    auth="none", license="US public domain", spatial="1:20 000 000", temporal="static", crs="Mars 2000 (IAU)", units="units and ages",
    coverage="global Mars", format="Shapefile/GeoPackage", processing="Unit at each Mars target.", validation="Unit of Jezero/Gale against the map text.",
    value="Geological context of Mars targets.", storage="≈ 50 MB", compute="needs shapely")
add(id="usgs_moon_geology", body="moon", domains=["geology"], priority=2,
    purpose="Global geologic units of the Moon for lunar targets.", provider="USGS Astrogeology",
    dataset_id="Unified Geologic Map of the Moon, 1:5M (Fortezzo et al. 2020)", instrument="compiled Apollo-era and LRO mapping",
    docs="https://astrogeology.usgs.gov/search/map/unified_geologic_map_of_the_moon_1_5m_2020",
    routes=[R("files", "https://astrogeology.usgs.gov/search/map/unified_geologic_map_of_the_moon_1_5m_2020"), R("files", "https://planetarymaps.usgs.gov/")],
    auth="none", license="US public domain", spatial="1:5 000 000", temporal="static", crs="Moon 2000 (IAU)", units="units and ages",
    coverage="global Moon", format="Shapefile/GeoPackage", processing="Unit at each lunar target.", validation="Unit at the South Pole targets against the map text.",
    value="Geological context of lunar targets.", storage="≈ 100 MB", compute="needs shapely")
add(id="mcs_climatology", body="mars", domains=["atmosphere", "dust_aeolian"], priority=4,
    purpose="Mars atmospheric temperature and dust profiles for the Mars side of atmospheric comparisons.",
    provider="NASA PDS Atmospheres Node", dataset_id="MRO Mars Climate Sounder derived data", instrument="MRO MCS",
    docs="https://pds-atmospheres.nmsu.edu/", routes=[R("files", "https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/MARS/mcs.html")],
    auth="none", license="NASA PDS (open)", spatial="profiles", temporal="2006–present", crs="Mars", units="K; dust opacity per km",
    coverage="global Mars", format="PDS tables", processing="Seasonal column dust opacity near targets.", validation="Against published MCS climatologies.",
    value="Mars dust/atmosphere reference.", storage="large; subset only", compute="moderate")
add(id="crism_mtrdr", body="mars", domains=["mineralogy"], priority=5,
    purpose="Spectral summary parameters (e.g. olivine, clay, carbonate indices) at Mars targets.",
    provider="NASA PDS Geosciences Node", dataset_id="MRO CRISM MTRDR / summary products", instrument="MRO CRISM",
    docs="https://pds-geosciences.wustl.edu/missions/mro/crism.htm", routes=[R("files", "https://pds-geosciences.wustl.edu/"), R("search", "https://ode.rsl.wustl.edu/mars/")],
    auth="none", license="NASA PDS (open)", spatial="≈ 18 m/pixel (targeted)", temporal="2006–", crs="Mars", units="band-depth parameters",
    coverage="targeted footprints", format="PDS3 IMG", processing="Summary parameters over target footprints; spectral association only.",
    validation="Published Jezero/Gale mineralogy (reference).", value="Mars mineralogical indicators; associations, never identifications.",
    storage="hundreds of MB per footprint", compute="heavy")

ENTRIES = E


def build():
    ids = [e["id"] for e in E]
    assert len(ids) == len(set(ids)), "duplicate catalogue id"
    for e in E:
        assert set(e["domains"]) <= set(DOMAINS), e["id"]
    return {"schema": "asterro.v19.sources/1", "domains": DOMAINS,
            "note": "Candidates and their official access routes. Not data, and not an integration state.", "sources": E}
