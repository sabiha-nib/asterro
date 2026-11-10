"""Smithsonian Institution Global Volcanism Program (GVP), Volcanoes of the World: Holocene and Pleistocene
volcano lists (GeoServer WFS 2.0, GVP-VOTW layers), retrieved in full as GeoJSON -> volcano catalogue and
per-cell proximity on the ASTERRO grid.

NOT a NASA dataset. Provider: Smithsonian Institution, National Museum of Natural History.
Raw      : data/v19/raw/gvp/asterro_gvp_{holocene,pleistocene}.geojson (bodies exactly as served).
Product  : catalogue (number, name, type, last known eruption year, rock type, evidence, lat, lon) and, for every
           land cell, the great-circle distance from the cell centre to the nearest Holocene volcano and the number
           of Holocene and Pleistocene volcanoes within 100 km of the cell centre.
Validation:
  * numberMatched == numberReturned == number of features (the full layer, no paging truncation);
  * the CRS is EPSG:4326 and the GeoJSON point equals the Latitude/Longitude attributes;
  * volcano numbers are unique;
  * the 39 volcanoes transcribed for the 16 V19 site samples agree with the full download (name, position,
    last eruption year): an independent check of the earlier transcription route.
Limits   : a volcano is a point at its summit or field centre; volcanic fields cover larger areas. Proximity says
           nothing about hazard or eruption probability.
"""
import json
import numpy as np
from .common import RAW, load_raw, valid_cells, cell_centres, haversine_km, p
import os

FIELDS = ["Volcano_Number", "Volcano_Name", "Primary_Volcano_Type", "Last_Eruption_Year", "Country", "Latitude",
          "Longitude", "Elevation", "Major_Rock_Type", "Evidence_Category", "Tectonic_Setting"]


class ValidationError(Exception):
    pass


def load(kind):
    d = load_raw(f"gvp/asterro_gvp_{kind}.geojson")
    n = len(d["features"])
    if not (d.get("numberMatched") == d.get("numberReturned") == n):
        raise ValidationError(f"{kind}: numberMatched {d.get('numberMatched')} / numberReturned {d.get('numberReturned')} / features {n}")
    if "4326" not in json.dumps(d.get("crs")):
        raise ValidationError(f"{kind}: unexpected CRS {d.get('crs')}")
    out, nums = [], set()
    for f in d["features"]:
        a = f["properties"]
        lon, lat = f["geometry"]["coordinates"][:2]
        if abs(lat - a["Latitude"]) > 1e-6 or abs(lon - a["Longitude"]) > 1e-6:
            raise ValidationError(f"{kind}: geometry and attributes differ for {a['Volcano_Number']}")
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValidationError(f"{kind}: position out of range for {a['Volcano_Number']}")
        if a["Volcano_Number"] in nums:
            raise ValidationError(f"{kind}: duplicate volcano number {a['Volcano_Number']}")
        nums.add(a["Volcano_Number"])
        out.append({k: a.get(k) for k in FIELDS})
    return out, {"features": n, "timeStamp": d.get("timeStamp"), "crs": "EPSG:4326"}


def cross_check_samples(holo):
    """Compare the V19 site-sample transcriptions with the full download."""
    raw = json.load(open(p("data", "v19", "samples", "site_samples_raw.json")))
    by = {v["Volcano_Number"]: v for v in holo}
    agree, differ = 0, []
    for num, rec in raw["volcanoes"].items():
        name, typ, last, lat, lon = rec[0], rec[1], rec[2], rec[3], rec[4]
        v = by.get(int(num))
        if v is None:
            differ.append({"number": num, "issue": "not in the full Holocene list"}); continue
        ok = v["Volcano_Name"] == name and abs(v["Latitude"] - lat) < 1e-3 and abs(v["Longitude"] - lon) < 1e-3 and v["Last_Eruption_Year"] == last
        if ok: agree += 1
        else: differ.append({"number": num, "transcribed": [name, last, lat, lon], "download": [v["Volcano_Name"], v["Last_Eruption_Year"], v["Latitude"], v["Longitude"]]})
    return {"transcribed": len(raw["volcanoes"]), "agree": agree, "differ": differ}


def proximity(holo, pleis, radius_km=100.0):
    vc = valid_cells(); la, lo = cell_centres(vc)
    hl = np.array([[v["Latitude"], v["Longitude"]] for v in holo]); pl = np.array([[v["Latitude"], v["Longitude"]] for v in pleis])
    nearest = np.full(len(vc), np.nan); nearest_idx = np.full(len(vc), -1, np.int32)
    n_h = np.zeros(len(vc), np.int16); n_p = np.zeros(len(vc), np.int16)
    for s in range(0, len(vc), 4096):
        a, b = la[s:s + 4096, None], lo[s:s + 4096, None]
        dh = haversine_km(a, b, hl[None, :, 0], hl[None, :, 1]); dp = haversine_km(a, b, pl[None, :, 0], pl[None, :, 1])
        nearest[s:s + 4096] = dh.min(1); nearest_idx[s:s + 4096] = dh.argmin(1)
        n_h[s:s + 4096] = (dh <= radius_km).sum(1); n_p[s:s + 4096] = (dp <= radius_km).sum(1)
    return {"nearest_holocene_km": nearest, "nearest_holocene_idx": nearest_idx, "holocene_within_100km": n_h, "pleistocene_within_100km": n_p}
