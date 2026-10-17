"""Schema validation for the ASTERRO target registry (asterro.registry/1, schema_version 1.0.0).

Record types (never interchangeable):
  body                      a celestial body
  region                    a documented geographic grouping on one body
  catalog_location          a named feature / study site (source-backed name and coordinates);
                            a catalogue entry is NOT an analytical target
  reference_area            an ASTERRO-defined area (e.g. a polar window, an offset window) with a written definition
  analytical_target         a derived 55.6 km analysis window with a fingerprint (refers to one location)
  dataset                   a data product used by a fingerprint or by the Earth stack
  scoring_config            a versioned scoring configuration (criteria policy + normalisation strategy)
  earth_search_config       the Earth predictor stack and its integrity reference
  comparison_experiment     a defined multi-target comparison (e.g. the legacy cross-planet experiment)
validate(registry) returns a list of human-readable errors; an empty list means valid.
"""
import math, re
from .readiness import STATUSES, VALID_UNITS, LEVELS, evaluate

SCHEMA = "asterro.registry/1"
SCHEMA_VERSION = "1.0.0"
CRITERIA = ("aridity", "annual_temperature_range", "elevation", "slope", "surface_roughness", "lst_diurnal_range")
LOCATION_TYPES = ("catalog_location", "reference_area")
ID_RE = re.compile(r"^[a-z0-9][a-z0-9_:\-]*$")
AGGREGATES = ("minimum", "mean", "pareto", "per_criterion")


def _f(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def validate(R):
    E = []
    err = E.append
    if R.get("schema") != SCHEMA:
        err(f"schema must be {SCHEMA}")
    if R.get("schema_version") != SCHEMA_VERSION:
        err(f"schema_version must be {SCHEMA_VERSION}")
    ids = {}
    for kind in ("bodies", "regions", "locations", "targets", "datasets", "scoring_configs", "comparison_experiments", "missions"):
        for r in R.get(kind, []):
            i = r.get("id")
            if not isinstance(i, str) or not ID_RE.match(i):
                err(f"{kind}: invalid id {i!r}")
            elif i in ids:
                err(f"duplicate id {i!r} ({ids[i]} and {kind})")
            else:
                ids[i] = kind
    bodies = {b["id"] for b in R.get("bodies", [])}
    regions = {r["id"]: r for r in R.get("regions", [])}
    datasets = {d["id"]: d for d in R.get("datasets", [])}
    configs = {c["id"]: c for c in R.get("scoring_configs", [])}
    locations = {l["id"]: l for l in R.get("locations", [])}
    targets = {t["id"]: t for t in R.get("targets", [])}
    for r in regions.values():
        if r.get("body") not in bodies:
            err(f"region {r['id']}: unknown body {r.get('body')!r}")
    for l in locations.values():
        if l.get("record_type") not in LOCATION_TYPES:
            err(f"location {l['id']}: record_type must be one of {LOCATION_TYPES}")
        if l.get("body") not in bodies:
            err(f"location {l['id']}: unknown body")
        if l.get("region") not in regions or regions[l["region"]]["body"] != l.get("body"):
            err(f"location {l['id']}: region {l.get('region')!r} missing or on another body")
        lat, lon = l.get("latitude"), l.get("longitude_east")
        if not (_f(lat) and _f(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
            err(f"location {l['id']}: invalid coordinates {lat}, {lon}")
        if not (l.get("source") and (l["source"].get("url") or l["source"].get("reference"))):
            err(f"location {l['id']}: no source")
        for t in l.get("target_ids", []):
            if t not in targets:
                err(f"location {l['id']}: unknown target {t}")
    for c in configs.values():
        if c.get("criteria_policy") not in ("direct_and_proxy", "direct_only"):
            err(f"scoring_config {c['id']}: invalid criteria_policy")
        if c.get("normalisation") not in ("legacy_table", "earth_union_target", "catalogue_table"):
            err(f"scoring_config {c['id']}: invalid normalisation")
    for t in targets.values():
        tid = t["id"]
        if t.get("record_type") != "analytical_target":
            err(f"target {tid}: record_type must be analytical_target")
        if t.get("schema_version") != SCHEMA_VERSION:
            err(f"target {tid}: schema_version")
        if t.get("body", {}).get("id") not in bodies:
            err(f"target {tid}: unknown body")
        if t.get("region", {}).get("id") not in regions:
            err(f"target {tid}: unknown region")
        loc = t.get("location", {})
        if loc.get("id") not in locations:
            err(f"target {tid}: location {loc.get('id')!r} is not a catalogue location or reference area")
        if not (_f(loc.get("latitude")) and _f(loc.get("longitude_east")) and -90 <= loc["latitude"] <= 90 and -180 <= loc["longitude_east"] <= 180):
            err(f"target {tid}: invalid analysis-window coordinates")
        if not _f(loc.get("window_km")) or loc["window_km"] <= 0:
            err(f"target {tid}: invalid window_km")
        fp = t.get("fingerprint") or {}
        for k in ("version", "variables", "units", "criterion_status", "provenance", "missingness", "spatial_support", "temporal_support"):
            if k not in fp:
                err(f"target {tid}: fingerprint missing {k}")
        st, vals, units, prov = fp.get("criterion_status", {}), fp.get("variables", {}), fp.get("units", {}), fp.get("provenance", {})
        if set(st) != set(CRITERIA) or set(vals) != set(CRITERIA):
            err(f"target {tid}: fingerprint must list every criterion")
        for c in CRITERIA:
            s = st.get(c)
            if s not in STATUSES:
                err(f"target {tid}: unsupported criterion status {c}={s!r}")
            v = vals.get(c)
            if s in ("DIRECT", "PROXY"):
                if not _f(v):
                    err(f"target {tid}: {c} is {s} but its value is not finite")
                if units.get(c) not in VALID_UNITS[c]:
                    err(f"target {tid}: invalid unit for {c}: {units.get(c)!r}")
            elif v is not None:
                err(f"target {tid}: {c} is {s} but carries a value")
            if s == "DIRECT":
                if not prov.get(c):
                    err(f"target {tid}: DIRECT {c} without provenance")
                for d in prov.get(c, []):
                    if d not in datasets:
                        err(f"target {tid}: {c} cites unknown dataset {d!r}")
        rd = t.get("readiness") or {}
        if rd.get("level") not in LEVELS:
            err(f"target {tid}: invalid readiness level {rd.get('level')!r}")
        else:
            again = evaluate(t, datasets, R.get("compatibility", {}))
            if again["level"] != rd["level"]:
                err(f"target {tid}: readiness {rd['level']} does not follow from its checks ({again['level']})")
        sc = t.get("scoring") or {}
        for cid in sc.get("configs", []):
            if cid not in configs:
                err(f"target {tid}: unknown scoring config {cid}")
        if sc.get("earth_analogue_enabled") and (rd.get("level") or 0) < 3:
            err(f"target {tid}: Earth-analogue scoring enabled below readiness 3")
        if sc.get("earth_analogue_enabled"):
            req = fp.get("criterion_status", {})
            if sum(1 for s in req.values() if s == "DIRECT") < 3:
                err(f"target {tid}: analytical target lacks the required DIRECT variables")
            if not t.get("provenance", {}).get("scripts"):
                err(f"target {tid}: analytical target lacks processing metadata")
    for l in locations.values():
        rd = l.get("readiness") or {}
        if rd.get("level") not in LEVELS:
            err(f"location {l['id']}: invalid readiness")
        if not l.get("target_ids") and rd.get("level") != 1:
            err(f"location {l['id']}: catalogue-only location must be readiness 1 (catalogued)")
    for x in R.get("comparison_experiments", []):
        ts = x.get("targets", [])
        if len(ts) < 2 or any(t not in targets for t in ts):
            err(f"comparison {x.get('id')}: needs >= 2 known targets")
            continue
        if x.get("aggregate") not in AGGREGATES:
            err(f"comparison {x['id']}: invalid aggregate {x.get('aggregate')!r}")
        if x.get("scoring_config") not in configs:
            err(f"comparison {x['id']}: unknown scoring config")
        shared = [c for c in CRITERIA if all(targets[t]["fingerprint"]["criterion_status"][c] in ("DIRECT", "PROXY") for t in ts)]
        if not any(all(targets[t]["fingerprint"]["criterion_status"][c] == "DIRECT" for t in ts) for c in shared):
            err(f"comparison {x['id']}: targets share no DIRECT criterion")
        if any(not targets[t]["scoring"].get("earth_analogue_enabled") for t in ts):
            err(f"comparison {x['id']}: every target must be scoring-enabled")
    for d in datasets.values():
        for k in ("provider", "product_id", "url", "license"):
            if not d.get(k):
                err(f"dataset {d['id']}: missing {k}")
    return E
