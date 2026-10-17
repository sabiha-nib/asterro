"""Assemble the web application: public/data/app.json (registry, ranges, profiles, provenance),
copy context assets, and inline engine.js into public/index.html (single-file page + data files)."""
import hashlib, json, os, shutil, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.compute.variables import CRITERIA, CRITERION_IDS, MATCH_THRESHOLD, PARTIAL_THRESHOLD, ALGORITHM_VERSION
from src.compute.normalization import compute_ranges
from src.compute.sensitivity import MISSION_PROFILES
from src.compute.similarity import MIN_COVERAGE
from src.compute.clustering import N_CANDIDATES, K_CHOICES

S3 = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/"

DATASETS = [
    dict(id="nasa_power", provider="NASA Langley Research Center - POWER Project", role="Earth predictor",
         dataset="POWER Climatology API (regional), community AG; parameters T2M, T2M_MAX_AVG, T2M_MIN_AVG, PRECTOTCORR",
         version="API v2.10.0; source MERRA-2", url="https://power.larc.nasa.gov/api/temporal/climatology/regional",
         resolution="0.5 deg lat x 0.625 deg lon (MERRA-2 native)", units="deg C; mm/day",
         temporal="2001-01-01 to 2020-12-31 monthly climatology",
         processing="Tiled 10x10 deg requests (3,240); monthly values mapped to the MERRA-2 grid; -999 -> missing. "
                    "Derived: annual temperature range; Hargreaves PET with FAO-56 Ra; aridity index P/PET.",
         license="NASA open data; POWER asks users to acknowledge the NASA Langley Research Center POWER Project."),
    dict(id="modis_aqua_lst", provider="NASA LP DAAC / MODIS; delivered through NASA GIBS", role="Earth predictor",
         dataset="MYD11C3 MODIS/Aqua LST/Emissivity Monthly L3 Global 0.05 deg CMG (GIBS layers "
                 "MODIS_Aqua_L3_Land_Surface_Temp_Monthly_Day / _Night)",
         version="Collections 006 / 061 as served by GIBS", url="https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi",
         resolution="rendered at 0.1 deg, aggregated to 0.5 x 0.625 deg", units="K",
         temporal="2016-01 to 2025-12, 120 monthly day/night pairs",
         processing="GIBS RGB decoded exactly through the published colormap MODIS_Land_Surface_Temp.xml v1.3 "
                    "(0.6 K bins, open-ended <200 K / >350 K bins censored). Pixel pairs valid at both overpasses "
                    "-> day minus night; cell mean over all months; per-year means for Analogue Evolution.",
         license="NASA open data (EOSDIS data use policy); no restrictions."),
    dict(id="gmted2010", provider="USGS EROS / NGA", role="Earth predictor",
         dataset="GMTED2010 mean elevation, 30 arc-second (mn30_grd)", version="GMTED2010",
         url="https://edcintl.cr.usgs.gov/downloads/sciweb1/shared/topo/downloads/GMTED/Grid_ZipFiles/mn30_grd.zip",
         resolution="30 arc-second (~926 m)", units="m (EGM96)", temporal="Static (source data 2000-era)",
         processing="Horn (1981) slope on a 926.6 m baseline, cell mean elevation, slope, and elevation standard "
                    "deviation (roughness) per 0.5 x 0.625 deg cell; ocean = no data.",
         license="USGS public domain."),
    dict(id="mola", provider="NASA PDS / USGS Astrogeology", role="Mars target",
         dataset="MGS MOLA DEM mosaic global 463 m", version="Mars_MGS_MOLA_DEM_mosaic_global_463m",
         url=S3 + "Mars_MGS_MOLA_DEM_mosaic_global_463m.tif", resolution="463 m", units="m (areoid)",
         temporal="MGS mission 1997-2006", processing="55.6 km window at 18.38 N 77.58 E binned to 926.6 m; Horn slope; std-dev roughness.",
         license="NASA/USGS public domain."),
    dict(id="meda", provider="NASA PDS Atmospheres Node - Mars 2020 MEDA", role="Mars target",
         dataset="urn:nasa:pds:mars2020_meda, data_calibrated_env (CAL_TIRS GROUND_TEMP, CAL_ATS, CAL_PS)",
         version="Bundle 6.0, doi:10.17189/1522849", url="https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/",
         resolution="Rover point measurements (~1 Hz)", units="K; Pa", temporal="Sols 8-676 (every 2nd sol; one Mars year)",
         processing="Hourly LTST composites; Ls from PDS4 labels; 12 Ls bins weighted equally.",
         license="NASA PDS open data."),
    dict(id="lola", provider="NASA PDS / USGS Astrogeology", role="Moon target",
         dataset="LRO LOLA Global LDEM 118 m (Mar 2014)", version="Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014",
         url=S3 + "Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif", resolution="118 m", units="m (1737.4 km sphere)",
         temporal="LRO 2009-2013", processing="55.6 km window centred on the south pole binned to 926.6 m; Horn slope; std-dev roughness.",
         license="NASA/USGS public domain."),
    dict(id="diviner", provider="LRO Diviner team (UCLA) - Williams et al. 2019", role="Moon target",
         dataset="Diviner polar hourly bolometric temperature maps, south, summer & winter (hour02, hour14)",
         version="level4_polar hourly_maps (2009-07-05 to 2019-02-17)", url="https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/",
         resolution="240 m polar stereographic", units="K", temporal="2009-2019",
         processing="Window mean of T(13-14 h) - T(01-02 h), average of the two seasons.",
         license="NASA-funded open data; cite Williams et al. (2019) doi:10.1029/2019JE006028."),
    dict(id="natural_earth", provider="Natural Earth", role="Context only (labels, coastline)",
         dataset="1:50m admin-0 countries, 1:50m geography regions, 1:110m coastline", version="naciscdn.org current",
         url="https://www.naturalearthdata.com/", resolution="1:50m / 1:110m", units="-", temporal="-",
         processing="Point-in-polygon on cell centres. Never used in scoring.", license="Public domain."),
    dict(id="blue_marble", provider="NASA Earth Observatory via GIBS", role="Context only (basemap)",
         dataset="BlueMarble_ShadedRelief (August 2004)", version="GIBS layer", url="https://gibs.earthdata.nasa.gov/",
         resolution="2048 x 1024 px render", units="-", temporal="2004", processing="Dimmed basemap. Never used in scoring.",
         license="NASA imagery, no copyright."),
]


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def main(repo="."):
    info = json.load(open(os.path.join(repo, "data/metadata/stack_build.json")))
    targets = json.load(open(os.path.join(repo, "data/targets.json")))
    buf = open(os.path.join(repo, "public/data/stack.bin"), "rb").read()
    E = {}
    for L in info["layout"]:
        if L["name"] in CRITERION_IDS:
            E[L["name"]] = np.frombuffer(buf, dtype=L["dtype"], count=L["length"], offset=L["offset"]).astype(np.float64)
    ranges = compute_ranges(E, targets["targets"], CRITERION_IDS)
    labels = json.load(open(os.path.join(repo, "data/raw/geo/labels.json")))
    pub = os.path.join(repo, "public/data")
    json.dump(dict(country=labels["country_names"], region=labels["region_names"],
                   coast=labels["coastline_110m"]), open(os.path.join(pub, "labels.json"), "w"), separators=(",", ":"))
    for f in ["bluemarble_2048.jpg", "thumb_jezero_mola.png", "thumb_southpole_lola.png"]:
        shutil.copy(os.path.join(repo, "data/raw/geo", f), os.path.join(pub, f))
    shutil.copy(os.path.join(repo, "data/targets.json"), os.path.join(pub, "targets.json"))
    import base64   # static hosts serve only web types: ship the binary bundle as base64 text
    open(os.path.join(pub, "stack.b64.txt"), "wb").write(base64.b64encode(buf))
    app = dict(
        algorithm_version=ALGORITHM_VERSION, criteria=CRITERIA, ranges=ranges,
        thresholds=dict(match=MATCH_THRESHOLD, partial=PARTIAL_THRESHOLD, min_coverage=MIN_COVERAGE,
                        n_candidates=N_CANDIDATES, k_choices=list(K_CHOICES), distinct_sep_km=300, evolution_stable_pts=2.0),
        profiles=MISSION_PROFILES, datasets=DATASETS,
        stack=dict(n_cells=info["n_cells"], layout=info["layout"], bytes=info["bytes"], sha256=info["sha256"],
                   grid=info["grid"], years=info["years"],
                   power_header=info["provenance"]["power"]["header"],
                   retrieved=dict(power=info["provenance"]["power"]["retrieved_utc"],
                                  modis=info["provenance"]["modis"]["retrieved_utc"],
                                  gmted=info["provenance"]["terrain"]["retrieved_utc"])),
        file_hashes={f: sha(os.path.join(pub, f)) for f in ["stack.bin", "targets.json", "labels.json"]},
    )
    json.dump(app, open(os.path.join(pub, "app.json"), "w"), indent=1)
    src = open(os.path.join(repo, "app/frontend/index.src.html")).read()
    eng = open(os.path.join(repo, "app/frontend/engine.js")).read()
    jsdir = os.path.join(repo, "app/frontend/js")
    app_js = "\n".join(open(os.path.join(jsdir, f)).read() for f in sorted(os.listdir(jsdir)) if f.endswith(".js"))
    css = open(os.path.join(repo, "app/frontend/styles.css")).read()
    # Phase II (additive): app/frontend/phase2/*.js appended after the baseline modules, *.css after styles.css
    p2 = os.path.join(repo, "app/frontend/phase2")
    if os.path.isdir(p2):
        app_js += "\n" + "\n".join(open(os.path.join(p2, f)).read() for f in sorted(os.listdir(p2)) if f.endswith(".js"))
        css += "\n" + "\n".join(open(os.path.join(p2, f)).read() for f in sorted(os.listdir(p2)) if f.endswith(".css"))
    # Phase III (additive): app/frontend/phase3/*.js appended after Phase II, *.css after Phase II css
    p3 = os.path.join(repo, "app/frontend/phase3")
    if os.path.isdir(p3):
        app_js += "\n" + "\n".join(open(os.path.join(p3, f)).read() for f in sorted(os.listdir(p3)) if f.endswith(".js"))
        css += "\n" + "\n".join(open(os.path.join(p3, f)).read() for f in sorted(os.listdir(p3)) if f.endswith(".css"))
    # Phase IV (additive): app/frontend/phase4/*.js appended after Phase III, *.css after Phase III css
    p4 = os.path.join(repo, "app/frontend/phase4")
    if os.path.isdir(p4):
        app_js += "\n" + "\n".join(open(os.path.join(p4, f)).read() for f in sorted(os.listdir(p4)) if f.endswith(".js"))
        css += "\n" + "\n".join(open(os.path.join(p4, f)).read() for f in sorted(os.listdir(p4)) if f.endswith(".css"))
    html = src.replace("/*__CSS__*/", css).replace("/*__ENGINE__*/", eng).replace("/*__APP__*/", app_js)
    open(os.path.join(repo, "public/index.html"), "w").write(html)
    write_service_worker(repo)
    print("ranges", {k: [round(a, 3), round(b, 3)] for k, (a, b) in ranges.items()})
    print("index.html", len(html), "bytes")


# Phase IV: versioned offline cache. CORE = files needed to start and use every module offline; other
# published files (Phase II series, stack.bin) are cached on first use. VERSION = SHA-256 over all published files.
SW_LAZY = {"data/phase2/series.b64.txt", "data/stack.bin"}


def write_service_worker(repo):
    pub = os.path.join(repo, "public")
    src = os.path.join(repo, "app/frontend/sw.src.js")
    if not os.path.exists(src):
        return
    files = sorted(os.path.relpath(os.path.join(d, f), pub).replace(os.sep, "/") for d, _, fs in os.walk(pub) for f in fs if f != "sw.js")
    h = hashlib.sha256()
    for f in files:
        h.update(f.encode() + b"\0" + hashlib.sha256(open(os.path.join(pub, f), "rb").read()).digest())
    core = ["./"] + [f for f in files if f not in SW_LAZY]
    js = open(src).read().replace("__VERSION__", h.hexdigest()[:16]).replace("__CORE__", json.dumps(core))
    open(os.path.join(pub, "sw.js"), "w").write(js)
    print("sw.js", h.hexdigest()[:16], len(core), "core files")


if __name__ == "__main__":
    main(*sys.argv[1:])
