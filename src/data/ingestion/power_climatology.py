"""Ingest NASA POWER climatology (v2.x, MERRA-2 native 0.5 x 0.625 deg grid).

Endpoint : https://power.larc.nasa.gov/api/temporal/climatology/regional
Period   : POWER climatology 2001-01-01 .. 2020-12-31 (reported in response header)
Grid     : native MERRA-2 grid, lat -90..90 step 0.5 (361), lon -180..179.375 step 0.625 (576)

The API accepts one parameter per request and bounding boxes up to 10 x 10 deg,
so the globe is tiled into 18 x 36 boxes. Output: power_climatology.zip (np.savez)
with arrays [param] -> float32 (13, 361, 576) for JAN..DEC, ANN; NaN = fill (-999).
"""
import json, sys, time, concurrent.futures as cf
import numpy as np, requests

API = "https://power.larc.nasa.gov/api/temporal/climatology/regional"
PARAMS = ["T2M", "T2M_MAX_AVG", "T2M_MIN_AVG", "PRECTOTCORR", "TOA_SW_DWN"]
MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "ANN"]
LATS = np.round(np.arange(-90, 90.0001, 0.5), 4)
LONS = np.round(np.arange(-180, 180, 0.625), 4)


def fetch(param, la0, lo0, tries=10):
    q = dict(parameters=param, community="AG", format="JSON",
             **{"latitude-min": la0, "latitude-max": la0 + 10,
                "longitude-min": lo0, "longitude-max": lo0 + 10})
    for k in range(tries):
        try:
            r = requests.get(API, params=q, timeout=90)
            if r.status_code == 200:
                return param, r.json()
            time.sleep(3 + 5 * k)
        except Exception:
            time.sleep(3 + 5 * k)
    return param, None      # recorded as failed box; retried once more at the end


def main(out="power_climatology.zip"):
    arrs = {p: np.full((13, LATS.size, LONS.size), np.nan, np.float32) for p in PARAMS}
    header = None
    jobs = [(p, la, lo) for p in PARAMS for la in range(-90, 90, 10) for lo in range(-180, 180, 10)]
    failed = []

    def ingest(p, js):
        for f in js["features"]:
            lon, lat = f["geometry"]["coordinates"][:2]
            lon = -180.0 if lon >= 180 else lon
            i = int(round((lat + 90) / 0.5)); j = int(round((lon + 180) / 0.625))
            if not (0 <= i < LATS.size and 0 <= j < LONS.size):
                continue
            v = f["properties"]["parameter"][p]
            arrs[p][:, i, j] = [np.nan if v[m] == -999 else v[m] for m in MONTHS]

    with cf.ThreadPoolExecutor(3) as ex:
        for n, ((p, js), job) in enumerate(zip(ex.map(lambda a: fetch(*a), jobs), jobs)):
            if js is None:
                failed.append(job); continue
            header = header or js.get("header")
            ingest(p, js)
            if n % 200 == 0:
                print(n, len(jobs), flush=True)
    still = []
    for job in failed:
        time.sleep(10)
        p, js = fetch(*job)
        if js is None:
            still.append(job)
        else:
            ingest(p, js)
    if still:
        raise RuntimeError(f"unrecoverable boxes: {still}")
    meta = dict(source="NASA POWER Climatology API", endpoint=API, header=header,
                params=PARAMS, months=MONTHS, retrieved_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    meta["failed_then_recovered"] = [list(map(str, j)) for j in failed]
    with open(out, "wb") as fh:          # file handle: numpy must not append ".npz"
        np.savez_compressed(fh, lats=LATS, lons=LONS, meta=json.dumps(meta), **arrs)
    for p in PARAMS:
        print(p, "missing frac", float(np.isnan(arrs[p][12]).mean()))


if __name__ == "__main__":
    main(*sys.argv[1:])
