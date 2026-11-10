"""NASA POWER climatology (regional API) -> per-cell monthly and annual values on the ASTERRO grid.

Source   : NASA Langley Research Center, POWER project, Climatology API v2 (regional endpoint), community RE.
           POWER's meteorology comes from NASA GMAO MERRA-2 at its native 0.5 x 0.625 deg grid, which is the
           ASTERRO grid, so no resampling is done: each returned point is one ASTERRO cell.
Period   : the pre-computed climatology period stated in every response header (January 2001 - December 2025).
Raw      : data/v19/raw/power/asterro_power_<PARAM>.json.gz, one file per parameter, holding every regional
           response verbatim (URL, HTTP status, retrieval time, SHA-256 of the body, body).

Validation, per parameter (a failure stops the build):
  * every stored body matches its SHA-256;
  * every successful body is a POWER FeatureCollection whose header names the expected period and fill value;
  * every point lies exactly on the 0.5 x 0.625 grid;
  * a point returned by two neighbouring boxes carries identical values in both (overlap consistency);
  * units equal the units declared by POWER for the parameter, and values lie inside physical bounds;
  * the fill value (-999) becomes missing, never a number.
"""
import json
import numpy as np
from .common import NLAT, NLON, load_raw, sha256_text, cell_of, valid_cells

MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "ANN"]
# id: (expected units, physical lower bound, upper bound, meaning)
PARAMS = {
    "WS10M": ("m/s", 0, 40, "wind speed at 10 m"),
    "WS50M": ("m/s", 0, 50, "wind speed at 50 m"),
    "WS10M_MAX": ("m/s", 0, 60, "maximum wind speed at 10 m"),
    "U10M": ("m/s", -40, 40, "eastward wind at 10 m"),
    "V10M": ("m/s", -40, 40, "northward wind at 10 m"),
    "AOD_55": ("dimensionless", 0, 6, "aerosol optical depth at 550 nm (CERES SYN1deg, as served by POWER)"),
    "PS": ("kPa", 40, 110, "surface pressure"),
    "RH2M": ("%", 0, 100.001, "relative humidity at 2 m"),
    "CLOUD_AMT": ("%", 0, 100.001, "cloud amount"),
    "GWETTOP": ("1", 0, 1.0001, "surface soil wetness (0-5 cm)"),
    "GWETROOT": ("1", 0, 1.0001, "root-zone soil wetness"),
    "SNODP": ("cm", 0, 5000, "snow depth"),
    "FRSNO": ("1", 0, 1.0001, "fraction of land covered by snow"),
    "ALLSKY_SRF_ALB": ("1", 0, 1.0001, "all-sky surface albedo"),
    "ALLSKY_SFC_SW_DWN": ("kW-hr/m^2/day", 0, 15, "all-sky surface shortwave downward irradiance"),
}
FILL = -999.0
# Values that are exactly zero in all twelve months are treated as missing for these parameters: an aerosol optical
# depth of exactly 0.000 all year is not a plausible measurement (POWER returns this over the Antarctic ice sheet).
ALL_ZERO_IS_MISSING = {"AOD_55"}


class ValidationError(Exception):
    pass


def _on_native(lat, lon):
    r, c = (lat + 90) / 0.5, (lon + 180) / 0.625
    return abs(r - round(r)) < 1e-6 and abs(c - round(c)) < 1e-6


def _on_1deg(lat, lon):
    return abs((lat - 0.5) - round(lat - 0.5)) < 1e-6 and abs((lon - 0.5) - round(lon - 0.5)) < 1e-6


def _grid_of_response(features):
    """A response is on one grid: the ASTERRO (MERRA-2) grid if every point lies on it, else 1 deg box centres if every
    point lies on those (some 1 deg centres, e.g. 2.5 E, also fall on the 0.625 deg grid, so points alone are ambiguous)."""
    pts = [f["geometry"]["coordinates"][:2] for f in features]
    if all(_on_native(la, lo) for lo, la in pts): return "native"
    if all(_on_1deg(la, lo) for lo, la in pts): return "1deg"
    raise ValidationError("response points lie on neither the 0.5 x 0.625 grid nor 1 deg box centres")


def parse(param, raw=None):
    """Return (values[NLAT*NLON, 13] float64 with NaN for missing, report dict)."""
    d = raw if raw is not None else load_raw(f"power/asterro_power_{param}.json.gz")
    if d.get("parameter") != param:
        raise ValidationError(f"{param}: file holds parameter {d.get('parameter')}")
    grid = None                                   # "native" (0.5 x 0.625, the ASTERRO grid) or "1deg"
    vals = np.full((NLAT * NLON, 13), np.nan)
    seen = np.zeros(NLAT * NLON, bool)
    v1 = np.full((180 * 360, 13), np.nan); s1 = np.zeros(180 * 360, bool)
    rep = {"parameter": param, "requests": len(d["responses"]), "ok": 0, "failed": [], "points": 0,
           "overlap_points": 0, "overlap_conflicts": 0, "fill_values": 0, "units": None, "period": None,
           "api_version": None, "sources": None, "first_utc": None, "last_utc": None}
    utcs = []
    for r in d["responses"]:
        if r is None:
            rep["failed"].append({"url": None, "status": None, "error": "no response recorded"}); continue
        utcs.append(r.get("utc"))
        if r.get("status") != 200:
            rep["failed"].append({"url": r.get("url"), "status": r.get("status"), "error": (r.get("error") or r.get("body") or "")[:300]}); continue
        if sha256_text(r["body"]) != r["sha256"]:
            raise ValidationError(f"{param}: SHA-256 mismatch for {r['url']}")
        j = json.loads(r["body"])
        h = j.get("header") or {}
        if h.get("fill_value") != FILL:
            raise ValidationError(f"{param}: unexpected fill value {h.get('fill_value')}")
        period = (h.get("start"), h.get("end"))
        if rep["period"] is None:
            rep["period"], rep["api_version"], rep["sources"] = period, (h.get("api") or {}).get("version"), h.get("sources")
        elif period != rep["period"]:
            raise ValidationError(f"{param}: climatology period differs between responses {period} vs {rep['period']}")
        units = ((j.get("parameters") or {}).get(param) or {}).get("units")
        rep["longname"] = ((j.get("parameters") or {}).get(param) or {}).get("longname")
        if rep["units"] is None:
            rep["units"] = units
        elif units != rep["units"]:
            raise ValidationError(f"{param}: units differ between responses")
        rep["ok"] += 1
        g = _grid_of_response(j["features"])
        if grid is None: grid = g
        elif g != grid: raise ValidationError(f"{param}: responses on two different grids")
        for f in j["features"]:
            lon, lat = f["geometry"]["coordinates"][:2]
            if grid == "native": c, V, SEEN = cell_of(lat, lon), vals, seen
            else: c, V, SEEN = int(np.floor(lat + 90)) * 360 + int(np.floor(lon + 180)) % 360, v1, s1
            row = np.array([f["properties"]["parameter"][param].get(m, FILL) for m in MONTHS], float)
            rep["fill_values"] += int(np.sum(row == FILL))
            row[row == FILL] = np.nan
            if param in ALL_ZERO_IS_MISSING and np.all(row[:12] == 0):
                rep["all_zero_to_missing"] = rep.get("all_zero_to_missing", 0) + 1; row[:] = np.nan
            rep["points"] += 1
            if SEEN[c]:
                rep["overlap_points"] += 1
                a, b = V[c], row
                if not np.array_equal(np.isnan(a), np.isnan(b)) or np.nanmax(np.abs(np.nan_to_num(a) - np.nan_to_num(b))) > 1e-9:
                    rep["overlap_conflicts"] += 1
            else:
                V[c], SEEN[c] = row, True
    rep["grid"] = grid
    if grid == "1deg":                            # sample the 1 deg box that contains each ASTERRO cell centre
        cells = np.arange(NLAT * NLON); la = -90 + 0.5 * (cells // NLON); lo = -180 + 0.625 * (cells % NLON)
        k = np.clip(np.floor(la + 90).astype(int), 0, 179) * 360 + np.floor(lo + 180).astype(int) % 360
        vals = v1[k]; seen = s1[k]
    utcs = sorted(u for u in utcs if u)
    rep["first_utc"], rep["last_utc"] = (utcs[0], utcs[-1]) if utcs else (None, None)
    exp_units, lo, hi, _ = PARAMS[param]
    if rep["units"] is not None and rep["units"] != exp_units:
        raise ValidationError(f"{param}: POWER declares units {rep['units']}, expected {exp_units}")
    fin = vals[np.isfinite(vals)]
    if fin.size and (fin.min() < lo or fin.max() > hi):
        raise ValidationError(f"{param}: values outside physical bounds [{lo}, {hi}]: {fin.min()} .. {fin.max()}")
    if rep["overlap_conflicts"]:
        raise ValidationError(f"{param}: {rep['overlap_conflicts']} grid points disagree between neighbouring boxes")
    rep["grid_points"] = int(seen.sum())
    vc = valid_cells()
    rep["land_cells_with_value"] = int(np.isfinite(vals[vc, 12]).sum())
    rep["land_cells"] = int(len(vc))
    rep["range_ann"] = [float(np.nanmin(vals[vc, 12])), float(np.nanmax(vals[vc, 12]))] if rep["land_cells_with_value"] else None
    return vals, rep
