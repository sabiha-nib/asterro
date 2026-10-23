"""Probe whether candidate data sources are reachable from this build environment (no data is downloaded).

    python3 scripts/probe_data_sources.py [--out data/inventory/probe.json]

For each candidate, one HTTPS HEAD request (GET with a 0-byte range when HEAD is refused) to its authoritative
endpoint; the outcome is recorded as observed: HTTP status, or the connection error. A reachable endpoint is not a
verified dataset — retrieval, checksum, schema, units, coverage and grid compatibility still have to be done.
"""
import datetime, json, os, ssl, sys, urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else os.path.join(ROOT, "data/inventory/probe.json")
CANDIDATES = {
    "nasa_power": "https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M&community=AG&longitude=0&latitude=0&format=JSON",
    "merra2": "https://goldsmr4.gesdisc.eosdis.nasa.gov/data/MERRA2_MONTHLY/",
    "era5": "https://cds.climate.copernicus.eu/api/catalogue/v1/collections/reanalysis-era5-single-levels-monthly-means",
    "terraclimate": "https://climate.northwestknowledge.net/TERRACLIMATE-DATA/",
    "nasadem": "https://e4ftl01.cr.usgs.gov/MEASURES/NASADEM_HGT.001/",
    "srtm": "https://e4ftl01.cr.usgs.gov/MEASURES/SRTMGL1.003/",
    "copernicus_dem": "https://copernicus-dem-30m.s3.amazonaws.com/readme.html",
    "modis_lst_hdf": "https://e4ftl01.cr.usgs.gov/MOLA/MYD11C3.061/",
    "gibs": "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetCapabilities",
    "landsat": "https://landsatlook.usgs.gov/stac-server/",
    "ecostress": "https://e4ftl01.cr.usgs.gov/ECOB/ECOSTRESS/",
    "viirs": "https://e4ftl01.cr.usgs.gov/VIIRS/",
    "esa_worldcover": "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/",
    "soilgrids": "https://files.isric.org/soilgrids/latest/data/",
    "jrc_gsw": "https://global-surface-water.appspot.com/",
    "pds_geosciences": "https://pds-geosciences.wustl.edu/",
    "usgs_astro_mosaics": "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/",
    "themis": "https://www.mars.asu.edu/data/",
    "meda_pds": "https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/",
    "diviner": "https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/",
    "lroc": "https://wms.lroc.asu.edu/lroc/",
    "natural_earth": "https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip",
    "noto_sans_bengali": "https://fonts.gstatic.com/s/notosansbengali/",
    "google_fonts_css": "https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali",
}


def probe(url):
    ctx = ssl.create_default_context()
    for method in ("HEAD", "GET"):
        req = urllib.request.Request(url, method=method, headers={"User-Agent": "ASTERRO-probe/1.0", **({"Range": "bytes=0-0"} if method == "GET" else {})})
        try:
            with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
                return {"reachable": True, "http": r.status, "method": method}
        except urllib.error.HTTPError as e:
            if method == "HEAD" and e.code in (403, 405, 501):
                continue
            return {"reachable": e.code < 500 and e.code not in (401, 403), "http": e.code, "method": method}
        except Exception as e:
            msg = str(getattr(e, "reason", e))
            return {"reachable": False, "error": msg[:200], "method": method}
    return {"reachable": False, "error": "no response"}


if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    res = {"schema": "asterro.probe/1", "probed_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "environment": "build sandbox (egress through an allow-listing proxy)", "note": "HEAD/ranged GET only; nothing was downloaded.", "results": {}}
    for k, u in CANDIDATES.items():
        r = probe(u); r["url"] = u; res["results"][k] = r
        print(k, r, flush=True)
    json.dump(res, open(OUT, "w"), indent=1)
    print("wrote", OUT)
