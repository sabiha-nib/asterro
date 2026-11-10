"""Acquire NASA POWER climatology parameters for V19 (network job; run on demand).
    python3 -m src.v19.acquire_power [PARAM ...]        default: WS2M WS10M WS50M RH2M PS
Uses the proven route and tiling of src/data/ingestion/power_climatology.py (API v2, MERRA-2 native grid, 10 x 10 deg
boxes, retries) through its own fetch(); that module is not modified. Steps:
  1. parameter check: each name is looked up in the POWER parameter dictionary; an unknown name is recorded and skipped
     (never guessed or substituted);
  2. acquisition of every box, then one more pass over failed boxes; an unrecoverable box aborts (no partial product);
  3. validation: grid identical to the retained climatology (lats/lons), physical ranges, missing share per parameter;
  4. data/raw/v19/power_<PARAM>.npz (float32, 13 x 361 x 576, NaN = fill) and a manifest
     data/v19/acquired/power_wind.json with SHA-256 of every file, the API header, the checks and their results.
The registry state of power_wind changes only through that manifest (src/v19/registry.py)."""
import hashlib, json, os, sys, time
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
from src.data.ingestion import power_climatology as PC  # noqa: E402

DICT = "https://power.larc.nasa.gov/api/system/manager/parameters"
DEFAULT = ["WS2M", "WS10M", "WS50M", "RH2M", "PS"]
RANGES = {"WS2M": (0, 40), "WS10M": (0, 45), "WS50M": (0, 50), "RH2M": (0, 100), "PS": (40, 110)}  # m/s, %, kPa


def known(param):
    import requests
    try:
        r = requests.get(DICT, params={"parameters": param, "community": "AG", "temporal": "climatology"}, timeout=60)
        return r.status_code == 200, {"status": r.status_code, "body": r.text[:400]}
    except Exception as e:
        return False, {"error": str(e)}


def acquire(param):
    arr = np.full((13, PC.LATS.size, PC.LONS.size), np.nan, np.float32)
    header, failed = None, []
    jobs = [(param, la, lo) for la in range(-90, 90, 10) for lo in range(-180, 180, 10)]

    def ingest(js):
        for f in js["features"]:
            lon, lat = f["geometry"]["coordinates"][:2]
            lon = -180.0 if lon >= 180 else lon
            i = int(round((lat + 90) / 0.5)); j = int(round((lon + 180) / 0.625))
            if 0 <= i < PC.LATS.size and 0 <= j < PC.LONS.size:
                v = f["properties"]["parameter"][param]
                arr[:, i, j] = [np.nan if v[m] == -999 else v[m] for m in PC.MONTHS]
    for job in jobs:
        _, js = PC.fetch(*job)
        if js is None:
            failed.append(job); continue
        header = header or js.get("header"); ingest(js)
    for job in list(failed):
        time.sleep(10)
        _, js = PC.fetch(*job)
        if js is not None:
            ingest(js); failed.remove(job)
    if failed:
        raise RuntimeError(f"{param}: unrecoverable boxes {failed}")
    return arr, header


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main(params):
    os.makedirs(os.path.join(ROOT, "data/raw/v19"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "data/v19/acquired"), exist_ok=True)
    ref = np.load(os.path.join(ROOT, "data/raw/power_climatology.npz"))
    man = {"dataset": "power_wind", "route": PC.API, "retrieved_utc": None, "params": {}, "skipped": {}, "files": {}}
    for p in params:
        ok, info = known(p)
        if not ok:
            man["skipped"][p] = info; continue
        arr, header = acquire(p)
        path = os.path.join(ROOT, f"data/raw/v19/power_{p}.npz")
        meta = {"source": "NASA POWER Climatology API", "endpoint": PC.API, "header": header, "param": p,
                "months": PC.MONTHS, "retrieved_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        with open(path, "wb") as fh:
            np.savez_compressed(fh, lats=PC.LATS, lons=PC.LONS, meta=json.dumps(meta), **{p: arr})
        ann = arr[12]; lo, hi = RANGES.get(p, (-np.inf, np.inf))
        fin = ann[np.isfinite(ann)]
        checks = {"grid_identical": bool(np.array_equal(ref["lats"], PC.LATS) and np.array_equal(ref["lons"], PC.LONS)),
                  "in_range": bool(fin.size and fin.min() >= lo and fin.max() <= hi), "min": float(fin.min()) if fin.size else None,
                  "max": float(fin.max()) if fin.size else None, "missing_share": float(np.isnan(ann).mean()),
                  "period": header and [header.get("start"), header.get("end")], "api_version": header and header.get("api", {}).get("version")}
        man["params"][p] = {"units": header and header.get("parameter_information", {}), "checks": checks, "dictionary": info["status"]}
        man["files"][os.path.relpath(path, ROOT)] = sha(path)
        man["retrieved_utc"] = meta["retrieved_utc"]
    passed = bool(man["params"]) and all(v["checks"]["grid_identical"] and v["checks"]["in_range"] for v in man["params"].values())
    man["validation"] = {"passed": passed, "method": "grid identity with the retained climatology; physical ranges; dictionary lookup",
                         "open_questions": ["reanalysis, not observation: no independent station comparison has been made"]}
    json.dump(man, open(os.path.join(ROOT, "data/v19/acquired/power_wind.json"), "w"), indent=1)
    print(json.dumps({k: man[k] for k in ("params", "skipped", "validation")}, indent=1)[:2000])


if __name__ == "__main__":
    main(sys.argv[1:] or DEFAULT)
