"""V19 Data Integration Registry (asterro.v19.registry/1): nine explicit states, per dataset.

Inputs: the V17 registry (public/data/v17/registry.json, preserved unchanged), the V19 acquisition catalogue
(src/v19/catalogue.py), the V19 access diagnostics (data/v19/probe.json) and acquisition manifests
(data/v19/acquired/<id>.json, written only by an acquisition script after data were actually retrieved and validated),
and the attempts on the WebFetch route (data/v19/fetch_attempts.json).

A state is never inferred from a name in a file:
  integrated_validated / integrated_awaiting_validation   carried over from V17 (retained inputs, checksums re-verified),
                                                           or a V19 manifest with validation results;
  acquired_awaiting_processing / processing                a V19 manifest exists, no product yet / product being built;
  awaiting_credentials                                     the provider answered 401/403, or every route needs a login;
  access_blocked                                           every attempt was refused by this environment (proxy policy
                                                           or DNS): says nothing about the provider;
  provider_unavailable                                     the provider itself failed (5xx, timeout after the tunnel);
  unsuitable                                               investigated and rejected, with the reason;
  not_investigated                                         no route known or no attempt made.
Each dataset is judged on its own routes, so one provider-level failure never marks other datasets as inaccessible.
"""
import json, os
from . import catalogue as C

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STATES = [
    ("integrated_validated", "Integrated and validated"),
    ("integrated_awaiting_validation", "Integrated, awaiting full validation"),
    ("acquired_awaiting_processing", "Acquired, awaiting processing"),
    ("processing", "Processing"),
    ("awaiting_credentials", "Awaiting credentials"),
    ("access_blocked", "Access blocked from this environment"),
    ("provider_unavailable", "Provider unavailable"),
    ("unsuitable", "Investigated but unsuitable"),
    ("not_investigated", "Not investigated"),
]
V17_MAP = {"integrated_validated": "integrated_validated", "integrated_validation_incomplete": "integrated_awaiting_validation",
           "acquired_awaiting_processing": "acquired_awaiting_processing", "processing": "processing",
           "access_restricted": "awaiting_credentials", "unsuitable": "unsuitable", "not_investigated": "not_investigated"}


ALIAS = {"macrostrat": "macrostrat_units", "gvp_volcanoes": "gvp_holocene", "gbif": "gbif_extremophiles"}  # V17 id -> V19 id


def _load(p, default=None):
    p = os.path.join(ROOT, p)
    return json.load(open(p)) if os.path.exists(p) else default


def state_from_attempts(att, auth):
    """Decide a dataset's access state from its own route attempts (most favourable route wins)."""
    if not att:
        return "not_investigated", None
    cls = {a["class"] for a in att}
    last = max(att, key=lambda a: a["utc"])
    if "reachable" in cls:
        return ("awaiting_credentials" if auth == "earthdata_login" else "not_investigated"), last  # reachable, nothing acquired yet
    if "auth_required" in cls:
        return "awaiting_credentials", last
    if "provider_error" in cls:
        return "provider_unavailable", last
    return "access_blocked", last  # only env_policy / env_dns


def manifest_state(m):
    if m.get("validation", {}).get("passed") is True:
        return "integrated_validated" if not m["validation"].get("open_questions") else "integrated_awaiting_validation"
    return "processing" if m.get("processing") else "acquired_awaiting_processing"


def build():
    v17 = _load("public/data/v17/registry.json")
    probe = _load("data/v19/probe.json", {"attempts": []})
    fetch = _load("data/v19/fetch_attempts.json", {"attempts": []})  # WebFetch route (second route, 2026-11-10)
    by = {}
    for a in probe["attempts"] + fetch["attempts"]:
        by.setdefault(a["dataset"], []).append(a)
    rows = []
    for s in v17["sources"]:
        r = {k: s.get(k) for k in ("id", "origin", "body", "domain", "provider", "title", "dataset_id", "docs", "license", "spatial", "temporal", "units", "validation")}
        r["v17_state"] = s["state"]
        alias = _load(f"data/v19/acquired/{ALIAS[s['id']]}.json") if s["id"] in ALIAS else None
        if alias:  # the same provider dataset was acquired under its V19 catalogue id
            r["state"], r["last_attempt"], r["see"] = manifest_state(alias), alias.get("retrieved_utc"), ALIAS[s["id"]]
        elif s["state"] in V17_MAP and s["state"] != "not_investigated":
            r["state"] = V17_MAP[s["state"]]
            r["last_attempt"] = None
        else:
            r["state"], last = state_from_attempts(by.get(s["id"]), "earthdata_login" if "Login" in str(s.get("access") or (s.get("probe") or {})) else None)
            r["last_attempt"] = last
        rows.append(r)
    have = {r["id"] for r in rows}
    for e in C.ENTRIES:
        m = _load(f"data/v19/acquired/{e['id']}.json")
        r = {"id": e["id"], "origin": "v19_catalogue", "body": e["body"], "domain": e["domains"][0], "domains": e["domains"],
             "provider": e["provider"], "title": e["dataset_id"], "dataset_id": e["dataset_id"], "docs": e["docs"],
             "license": e["license"], "spatial": e["spatial"], "temporal": e["temporal"], "units": e["units"],
             "priority": e["priority"], "doc_status": e["doc_status"], "auth": e["auth"], "routes": e["routes"],
             "value": e["value"]}
        if m:
            r["state"], r["manifest"] = manifest_state(m), m
            r["last_attempt"] = m.get("retrieved_utc")
        else:
            r["state"], r["last_attempt"] = state_from_attempts(by.get(e["id"]), e["auth"])
        if e["id"] in have:
            r["id"] = e["id"] + "@v19"
        rows.append(r)
    counts = {k: sum(1 for r in rows if r["state"] == k) for k, _ in STATES}
    assert sum(counts.values()) == len(rows), "a row has a state outside the nine"
    return {"schema": "asterro.v19.registry/1", "states": [{"id": k, "label": v} for k, v in STATES],
            "probe_environment": probe.get("environment"), "counts": counts, "sources": rows,
            "note": "The V17 registry is preserved unchanged; this registry maps its states onto the nine V19 states and adds the V19 catalogue."}


if __name__ == "__main__":
    r = build(); print(r["counts"], len(r["sources"]))
