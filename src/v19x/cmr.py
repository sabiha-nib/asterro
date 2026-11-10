"""NASA Common Metadata Repository (CMR) collection records (UMM-C JSON) for the NASA products ASTERRO uses or
needs. These are DISCOVERY records: official identifiers, versions, archive centres, resolutions, periods and
access conditions, read from NASA's own metadata. A discovery record is not data.

Raw      : data/v19/raw/cmr/asterro_cmr_collections.json (every search response verbatim with its SHA-256).
Access   : a collection is marked as requiring authentication when its UMM AccessConstraints text, or its cloud
           distribution (an S3 credentials endpoint), says that a NASA Earthdata Login is needed. Nothing is
           assumed from the provider's name.
"""
import json
from .common import load_raw, sha256_text


class ValidationError(Exception):
    pass


def _res(u):
    try:
        g = u["SpatialExtent"]["HorizontalSpatialDomain"]["ResolutionAndCoordinateSystem"]["HorizontalDataResolution"]
    except (KeyError, TypeError):
        return None
    for k, v in g.items():
        if isinstance(v, list) and v:
            x = v[0]
            if "XDimension" in x:
                return f"{x['XDimension']} x {x.get('YDimension', x['XDimension'])} {x.get('Unit', '')}".strip()
        if k in ("VariesResolution", "PointResolution", "NonGriddedResolutions") and v:
            return k
    return None


def _period(u):
    t = (u.get("TemporalExtents") or [{}])[0]
    r = (t.get("RangeDateTimes") or [{}])[0]
    res = t.get("TemporalResolution") or {}
    return {"begin": (r.get("BeginningDateTime") or "")[:10] or None, "end": (r.get("EndingDateTime") or "")[:10] or None,
            "ongoing": bool(t.get("EndsAtPresentFlag")), "resolution": f"{res.get('Value', '')} {res.get('Unit', '')}".strip() or None}


def records():
    d = load_raw("cmr/asterro_cmr_collections.json")
    out = []
    for r in d["responses"]:
        if r["status"] != 200:
            raise ValidationError(f"CMR {r['short_name']}: HTTP {r['status']}")
        if sha256_text(r["body"]) != r["sha256"]:
            raise ValidationError(f"CMR {r['short_name']}: SHA-256 mismatch")
        items = json.loads(r["body"]).get("items") or []
        if not items:
            out.append({"short_name": r["short_name"], "found": False, "query": r["url"], "utc": r["utc"]}); continue
        items.sort(key=lambda it: str(it["umm"].get("Version")), reverse=True)    # newest version first
        it = items[0]; u, m = it["umm"], it["meta"]
        ac = json.dumps(u.get("AccessConstraints") or {})
        ddi = u.get("DirectDistributionInformation") or {}
        edl = "earthdata" in ac.lower() or bool(ddi.get("S3CredentialsAPIEndpoint"))
        plat = [(p.get("ShortName"), [i.get("ShortName") for i in p.get("Instruments", [])]) for p in u.get("Platforms", [])]
        urls = {x.get("Type"): x.get("URL") for x in u.get("RelatedUrls", []) if x.get("Type") in ("DATA SET LANDING PAGE", "GET DATA", "GET RELATED VISUALIZATION")}
        out.append({"short_name": u["ShortName"], "found": True, "version": u.get("Version"), "versions_listed": [x["umm"].get("Version") for x in items],
                    "concept_id": m["concept-id"], "provider_id": m["provider-id"], "title": u.get("EntryTitle"),
                    "doi": (u.get("DOI") or {}).get("DOI"), "archive": [c.get("ShortName") for c in u.get("DataCenters", []) if "ARCHIVER" in (c.get("Roles") or [])],
                    "processing_level": (u.get("ProcessingLevel") or {}).get("Id"), "resolution": _res(u), "period": _period(u),
                    "platforms": plat, "cloud_hosted": bool(ddi.get("Region")), "cloud_region": ddi.get("Region"),
                    "requires_earthdata_login": edl, "access_constraints": (u.get("AccessConstraints") or {}).get("Description"),
                    "landing_page": urls.get("DATA SET LANDING PAGE"), "get_data": urls.get("GET DATA"), "worldview": urls.get("GET RELATED VISUALIZATION"),
                    "query": r["url"], "utc": r["utc"], "sha256": r["sha256"]})
    return out
