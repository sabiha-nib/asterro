"""Access probe for the V17 Data Integration Registry (network job; run on demand, never during a build).
    python3 scripts/probe_v17.py
For every endpoint of the Phase IV inventory probe and of data/v17/sources.json: one HEAD request (GET with a
Range of 0-0 when HEAD is refused), 20 s timeout, through the environment's proxy settings. Nothing is downloaded.
Writes data/v17/probe.json with the exact error text per endpoint."""
import json, os, time, urllib.request, urllib.error, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def probe(url):
    t0 = time.time()
    for method, hdr in (("HEAD", {}), ("GET", {"Range": "bytes=0-0"})):
        try:
            req = urllib.request.Request(url, method=method, headers={"User-Agent": "ASTERRO-probe/1.0", **hdr})
            with urllib.request.urlopen(req, timeout=20) as r:
                return {"reachable": True, "http_status": r.status, "method": method, "seconds": round(time.time() - t0, 2)}
        except urllib.error.HTTPError as e:
            if method == "HEAD" and e.code in (403, 405, 501):
                continue
            return {"reachable": True, "http_status": e.code, "method": method, "error": str(e), "seconds": round(time.time() - t0, 2)}
        except Exception as e:
            err = str(getattr(e, "reason", e))
            return {"reachable": False, "method": method, "error": err, "seconds": round(time.time() - t0, 2)}
    return {"reachable": False, "error": "no response"}


def main():
    urls = {}
    old = json.load(open(os.path.join(ROOT, "data/inventory/probe.json")))["results"]
    for k, r in old.items():
        urls[k] = r["url"]
    for s in json.load(open(os.path.join(ROOT, "data/v17/sources.json")))["sources"]:
        if s.get("endpoint"):
            urls[s["id"]] = s["endpoint"]
    res = {k: {"url": u, **probe(u)} for k, u in sorted(urls.items())}
    out = {"schema": "asterro.v17.probe/1", "probed_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "environment": "cloud build sandbox; outbound HTTPS through an allow-listing egress proxy",
           "proxy_configured": bool(os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")),
           "note": "HEAD or 1-byte ranged GET only; nothing was downloaded.", "results": res,
           "reachable": sum(1 for r in res.values() if r["reachable"]), "total": len(res)}
    json.dump(out, open(os.path.join(ROOT, "data/v17/probe.json"), "w"), indent=1)
    print(out["reachable"], "of", out["total"], "reachable")


if __name__ == "__main__":
    main()
