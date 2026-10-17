"""ASTERRO data-readiness model v3 (Phase IV). Machine-readable, computed from explicit checks.

Four levels (cumulative: a record is at the highest level whose checks AND all lower levels' checks pass):
  1  CATALOGUED               verified basic metadata: source-backed name, valid coordinates, place in the
                              hierarchy. Says nothing about analysis; no similarity score is ever permitted.
  2  PARTIALLY CHARACTERIZED  in addition, a documented, retrievable dataset is associated and a complete,
                              checksummed measurement window was computed from it; the data do not yet
                              support a complete, compatible comparison.
  3  ANALYTICALLY COMPARABLE  a fingerprint in which every applicable criterion is DIRECT or PROXY (none
                              MISSING), with at least three DIRECT criteria, finite values, valid units,
                              provenance for every DIRECT value and an accepted compatibility verdict.
  4  REPRODUCIBLE             in addition: versioned fingerprint with a content hash, every producing script
                              recorded by checksum, and an OFFLINE regeneration of every DIRECT value from the
                              retained inputs that matched at build time.
A record that fails a level-1 check is invalid. Readiness says nothing about scientific validity, confidence,
habitability or mission safety; those are reported separately.
Model history: 2.0.0 used levels 0-4 (0 catalogue, 1 terrain, 2 +environmental measurement); 3.0.0 adopts the
four-level scale, merges the former L1/L2 into level 2, and keeps every L3/L4 check unchanged.
"""
import hashlib, json, math

MODEL_VERSION = "3.0.0"
LEVELS = {
    1: ("CATALOGUED", "Verified basic metadata and an authoritative reference. Environmental analysis is not implied; no similarity score is permitted."),
    2: ("PARTIALLY CHARACTERIZED", "A documented dataset is associated and a complete measurement window exists, but the data do not support a complete, compatible comparison."),
    3: ("ANALYTICALLY COMPARABLE", "Every applicable criterion is DIRECT or PROXY, at least three are DIRECT, with provenance and accepted compatibility."),
    4: ("REPRODUCIBLE", "Versioned fingerprint, recorded scripts and a passing offline regeneration of every DIRECT value."),
}
STATUSES = ("DIRECT", "PROXY", "N/A", "MISSING")
TERRAIN = ("slope", "surface_roughness")
DATASET_REQUIRED = ("id", "provider", "product_id", "version", "url", "license", "original_resolution", "processing", "retrieval_status")
VALID_UNITS = {"aridity": {"index"}, "annual_temperature_range": {"K"}, "elevation": {"m (Earth-equivalent proxy)", "m"},
               "slope": {"deg"}, "surface_roughness": {"m"}, "lst_diurnal_range": {"K"}}
ACCEPTED = {"COMPATIBLE", "COMPATIBLE_WITH_CAVEATS", "PROXY"}

CHECKS = [
    ("L1.name_source", 1, "The name or definition is backed by a cited source (gazetteer feature link, mission coordinate source or documented ASTERRO definition)."),
    ("L1.coordinates", 1, "Latitude in [-90, 90] and longitude in [-180, 180], both finite."),
    ("L1.hierarchy", 1, "Assigned to a body and a documented region."),
    ("L2.dataset_record", 2, "A dataset record with id, provider, product, version, URL, licence, resolution, processing and retrieval status for the measured window."),
    ("L2.measured_window", 2, "A complete measurement window (all 3600 bins of 926.6 m) with a recorded grid checksum; its criteria are DIRECT."),
    ("L3.no_missing_applicable", 3, "No applicable criterion is MISSING; every criterion has a valid status (DIRECT / PROXY / N/A)."),
    ("L3.three_direct", 3, "At least three DIRECT criteria."),
    ("L3.values_units_provenance", 3, "Every DIRECT and PROXY value is finite, has a valid unit, and every DIRECT value names its dataset(s)."),
    ("L3.compatibility", 3, "Every DIRECT criterion has an accepted compatibility verdict in the variable compatibility registry."),
    ("L4.versioned_fingerprint", 4, "The fingerprint carries a version and a content hash."),
    ("L4.processing_documented", 4, "Every script that produced a value is recorded with its checksum."),
    ("L4.offline_regeneration", 4, "Every DIRECT value was regenerated offline from retained inputs at build time and matched within tolerance."),
]


def fingerprint_hash(fp):
    body = {k: fp[k] for k in ("variables", "units", "criterion_status")}
    return hashlib.sha256(json.dumps(body, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _finite(v):
    return isinstance(v, (int, float)) and math.isfinite(v)


def evaluate(rec, datasets, compatibility):
    """rec: a registry record (catalog location or analytical target). Returns {level, label, checks}."""
    loc = rec.get("location", rec)
    lat, lon = loc.get("latitude"), loc.get("longitude_east")
    res = {}
    src = rec.get("source") or (rec.get("location") or {}).get("source")
    res["L1.name_source"] = (bool(src and (src.get("url") or src.get("reference"))), str(src.get("url") or src.get("reference") if src else "no source"))
    res["L1.coordinates"] = (_finite(lat) and _finite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180, f"{lat}, {lon}")
    body = rec["body"]["id"] if isinstance(rec.get("body"), dict) else rec.get("body")
    region = rec["region"]["id"] if isinstance(rec.get("region"), dict) else rec.get("region")
    res["L1.hierarchy"] = (bool(body and region), f"{body} / {region}")
    fp = rec.get("fingerprint")
    if rec.get("record_type") != "analytical_target" or not fp:
        for cid, lvl, _ in CHECKS:
            if lvl >= 2:
                res[cid] = (False, "no analytical record")
    else:
        st, vals, units, prov = fp["criterion_status"], fp["variables"], fp["units"], fp["provenance"]
        tds = [datasets.get(d) for d in prov.get("slope", [])]
        ok = bool(tds) and all(d is not None and all(d.get(k) not in (None, "") for k in DATASET_REQUIRED) for d in tds)
        res["L2.dataset_record"] = (ok, ", ".join(prov.get("slope", [])) or "none")
        tw = rec.get("terrain_window") or {}
        res["L2.measured_window"] = (bool(tw.get("complete")) and bool(tw.get("grid_sha256")) and all(st.get(c) == "DIRECT" for c in TERRAIN),
                                    f"{tw.get('bins_filled')}/{tw.get('bins_total')} bins")
        bad = [c for c, s in st.items() if s not in STATUSES]
        miss = [c for c, s in st.items() if s == "MISSING"]
        res["L3.no_missing_applicable"] = (not bad and not miss, "missing: " + (", ".join(miss) or "none") + ("; invalid: " + ", ".join(bad) if bad else ""))
        direct = [c for c, s in st.items() if s == "DIRECT"]
        res["L3.three_direct"] = (len(direct) >= 3, f"{len(direct)} DIRECT")
        probs = []
        for c, s in st.items():
            if s in ("DIRECT", "PROXY"):
                if not _finite(vals.get(c)):
                    probs.append(f"{c}: non-finite")
                if units.get(c) not in VALID_UNITS.get(c, set()):
                    probs.append(f"{c}: unit {units.get(c)!r}")
            if s == "DIRECT" and not prov.get(c):
                probs.append(f"{c}: no dataset")
            if s in ("N/A", "MISSING") and vals.get(c) is not None:
                probs.append(f"{c}: value present with status {s}")
        res["L3.values_units_provenance"] = (not probs, "; ".join(probs) or "ok")
        cbad = [c for c in direct if compatibility.get(c, {}).get("verdict") not in ACCEPTED]
        res["L3.compatibility"] = (not cbad, ", ".join(cbad) or "all accepted")
        res["L4.versioned_fingerprint"] = (bool(fp.get("version")) and fp.get("content_sha256") == fingerprint_hash(fp), fp.get("version") or "none")
        scr = rec.get("provenance", {}).get("scripts", {})
        res["L4.processing_documented"] = (bool(scr) and all(v for v in scr.values()), ", ".join(sorted(scr)) or "none")
        rg = rec.get("validation", {}).get("regeneration", {})
        covered = set(rg.get("criteria", {}))
        res["L4.offline_regeneration"] = (bool(rg.get("passed")) and set(direct) <= covered,
                                          rg.get("summary", "not performed"))
    checks = [dict(id=cid, level=lvl, passed=bool(res[cid][0]), detail=res[cid][1], requirement=txt) for cid, lvl, txt in CHECKS]
    level = None
    for L in range(1, 5):
        if all(c["passed"] for c in checks if c["level"] <= L):
            level = L
        else:
            break                            # level None: fails even the catalogue checks (invalid record)
    return dict(model=MODEL_VERSION, level=level, label=LEVELS[level][0] if level is not None else "INVALID",
                meaning=LEVELS[level][1] if level is not None else "Fails catalogue checks.", checks=checks)
