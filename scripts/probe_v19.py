"""V19 access diagnostics (network job; run on demand, never during a build).
    python3 scripts/probe_v19.py
Probes every official access route of every dataset (src/v19/catalogue.py) and every endpoint of the V17 registry:
one HEAD (or 1-byte ranged GET), 20 s timeout, through this environment's proxy settings. Nothing is downloaded.
Each attempt is classified so that a refusal by *this environment* is never recorded as a provider failure:
  env_policy      the egress proxy refused the tunnel (CONNECT 403/407): the host is not allowed for this environment
  env_dns         the name did not resolve here
  auth_required   the provider answered 401/403 (credentials or permissions needed)
  provider_error  the provider answered 5xx, or the connection timed out or was reset after the tunnel opened
  reachable       the provider answered 2xx/3xx (or 4xx other than 401/403, e.g. 404 for a template URL: host reachable)
Writes data/v19/probe.json."""
import datetime, json, os, re, socket, sys, time, urllib.error, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from src.v19 import catalogue as C  # noqa: E402


def classify_exc(e):
    s = str(getattr(e, "reason", e))
    if re.search(r"Tunnel connection failed: 40[37]", s):
        return "env_policy", s
    if isinstance(getattr(e, "reason", None), socket.gaierror) or "Name or service not known" in s or "Temporary failure in name resolution" in s:
        return "env_dns", s
    return "provider_error", s


def probe(url):
    url = re.sub(r"\{[a-z]+\}", "0", url)  # template parameters: a neutral value; a 4xx still proves the host answers
    t0 = time.time()
    for method, hdr in (("HEAD", {}), ("GET", {"Range": "bytes=0-0"})):
        try:
            req = urllib.request.Request(url, method=method, headers={"User-Agent": "ASTERRO-probe/1.0 (research; no download)", **hdr})
            with urllib.request.urlopen(req, timeout=20) as r:
                return {"class": "reachable", "http_status": r.status, "method": method, "seconds": round(time.time() - t0, 2)}
        except urllib.error.HTTPError as e:
            if method == "HEAD" and e.code in (403, 405, 501):
                continue
            k = "auth_required" if e.code in (401, 403) else "provider_error" if e.code >= 500 else "reachable"
            return {"class": k, "http_status": e.code, "method": method, "seconds": round(time.time() - t0, 2)}
        except Exception as e:
            k, s = classify_exc(e)
            return {"class": k, "method": method, "error": s, "seconds": round(time.time() - t0, 2)}
    return {"class": "provider_error", "error": "no response"}


def main():
    attempts = []
    for e in C.ENTRIES:
        for r in e["routes"]:
            attempts.append({"dataset": e["id"], "origin": "v19_catalogue", "route": r["kind"], "url": r["url"]})
    reg = json.load(open(os.path.join(ROOT, "public/data/v17/registry.json")))
    for s in reg["sources"]:
        url = s.get("endpoint") or (s.get("probe") or {}).get("url")  # inventory items keep their URL in the V17 probe record
        if url and not s["state"].startswith("integrated"):
            attempts.append({"dataset": s["id"], "origin": "v17_registry", "route": "endpoint", "url": url})
    for a in attempts:
        a["utc"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        a.update(probe(a["url"]))
    counts = {}
    for a in attempts:
        counts[a["class"]] = counts.get(a["class"], 0) + 1
    out = {"schema": "asterro.v19.probe/1", "environment": "cloud build sandbox; outbound HTTPS through an allow-listing egress proxy",
           "proxy_configured": bool(os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")),
           "note": "HEAD or 1-byte ranged GET per route; nothing downloaded. Classes separate this environment's refusals from provider answers.",
           "counts": counts, "attempts": attempts}
    os.makedirs(os.path.join(ROOT, "data/v19"), exist_ok=True)
    json.dump(out, open(os.path.join(ROOT, "data/v19/probe.json"), "w"), indent=1)
    print(counts, len(attempts), "attempts")


if __name__ == "__main__":
    main()
