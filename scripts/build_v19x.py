"""Build the V19 data-extension products from the retained raw files (data/v19/raw/).

  python3 scripts/build_v19x.py          build public/data/v19/env/* and data/v19/x/build_report.json
Every step validates its input (see the module docstrings in src/v19x/); any failure stops the build.
"""
import json, os, sys, warnings
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
warnings.filterwarnings("ignore", category=RuntimeWarning)
from src.v19x import power, gibs, gvp, sites, cmr, common
from src.v19x.cube import Cube

OUT = common.p("public", "data", "v19", "env")
POWER_URL = "https://power.larc.nasa.gov/api/temporal/climatology/regional"
GIBS_URL = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"


def main():
    rep = {"version": common.VERSION, "power": {}, "gibs": {}, "gvp": {}, "sites": {}, "cmr": {}}
    C = Cube(); src = {}
    # ---------------------------------------------------------------- NASA POWER (MERRA-2 / CERES SYN1deg)
    def P(param):
        f = common.os.path.join(common.RAW, "power", f"asterro_power_{param}.json.gz")
        if not os.path.exists(f): rep["power"][param] = {"state": "not_downloaded"}; return None
        v, r = power.parse(param); r["file_sha256"] = common.sha256_file(f); r["failed_n"] = len(r["failed"]); rep["power"][param] = r
        src["power_" + param] = {"dataset": "power_" + param.lower(), "agency": "NASA", "provider": "NASA Langley Research Center, POWER project",
                                 "product": f"POWER Climatology API {r['api_version']} regional, parameter {param} ({r.get('longname')})",
                                 "source_model": "+".join(r["sources"] or []), "units": r["units"], "grid": r["grid"],
                                 "period": f"{r['period'][0][:4]}-{r['period'][1][:4]}", "retrieved": r["last_utc"], "raw_sha256": r["file_sha256"]}
        return v
    kind_of = lambda r: "satellite-derived (CERES SYN1deg)" if r.get("grid") == "1deg" else "reanalysis (MERRA-2)"
    def meta(param, label, units, extra=None):
        r = rep["power"][param]
        m = {"label": label, "units": units, "datasets": ["power_" + param.lower()], "agency": "NASA", "kind": kind_of(r),
             "resolution": "1 deg x 1 deg (sampled at the cell centre)" if r["grid"] == "1deg" else "0.5 x 0.625 deg (native)",
             "period": f"{r['period'][0][:4]}-{r['period'][1][:4]} climatology"}
        m.update(extra or {}); return m
    v = P("WS10M")
    if v is not None:
        C.add("wind_ws10m", v[:, 12], 0.01, meta("WS10M", "Wind speed at 10 m, annual mean", "m/s"))
        C.add("wind_ws10m_maxmonth", np.nanmax(v[:, :12], 1), 0.01, meta("WS10M", "Wind speed at 10 m, windiest calendar month", "m/s"))
    ws = v
    v = P("WS50M")
    if v is not None: C.add("wind_ws50m", v[:, 12], 0.01, meta("WS50M", "Wind speed at 50 m, annual mean", "m/s"))
    v = P("WS10M_MAX")
    if v is not None: C.add("wind_ws10m_max", v[:, 12], 0.01, meta("WS10M_MAX", "Maximum wind speed at 10 m (POWER climatology, annual)", "m/s"))
    u, vv = P("U10M"), P("V10M")
    if u is not None and vv is not None and ws is not None:
        with np.errstate(invalid="ignore", divide="ignore"):
            res = np.hypot(u[:, 12], vv[:, 12]); steady = np.clip(res / ws[:, 12], 0, 1)
            direc = (np.degrees(np.arctan2(-u[:, 12], -vv[:, 12])) + 360) % 360   # direction the wind blows FROM
        m = meta("U10M", "", "")
        C.add("wind_dir_from", np.where(res > 0.1, direc, np.nan), 0.1, {**m, "label": "Prevailing wind direction (from), resultant of annual-mean U and V", "units": "deg", "datasets": ["power_u10m", "power_v10m"], "kind": "derived from reanalysis (MERRA-2)"})
        C.add("wind_steadiness", steady, 0.001, {**m, "label": "Wind steadiness: resultant / mean speed (1 = always the same direction)", "units": "ratio", "datasets": ["power_u10m", "power_v10m", "power_ws10m"], "kind": "derived from reanalysis (MERRA-2)", "note": "uses annual means of monthly means; an approximation of the true directional constancy"})
    v = P("AOD_55")
    if v is not None:
        C.add("aod550_ceres", v[:, 12], 0.001, meta("AOD_55", "Aerosol optical depth at 550 nm, annual mean", "1", {"note": "column aerosol, not surface dust; exact zeros in every month (Antarctic ice sheet) are treated as missing"}))
    for param, vid, label, units, sc in [("PS", "ps_kpa", "Surface pressure, annual mean", "kPa", 0.01), ("RH2M", "rh2m", "Relative humidity at 2 m, annual mean", "%", 0.1),
                                         ("CLOUD_AMT", "cloud_amt", "Cloud amount, annual mean", "%", 0.1), ("GWETTOP", "gwettop", "Surface soil wetness (0-5 cm), annual mean", "fraction of saturation", 0.001),
                                         ("GWETROOT", "gwetroot", "Root-zone soil wetness, annual mean", "fraction of saturation", 0.001), ("ALLSKY_SRF_ALB", "albedo", "All-sky surface albedo, annual mean", "1", 0.001),
                                         ("ALLSKY_SFC_SW_DWN", "sw_dwn", "Surface shortwave irradiance, annual mean", "kWh/m2/day", 0.01)]:
        v = P(param)
        if v is not None: C.add(vid, v[:, 12], sc, meta(param, label, units))
    v = P("SNODP")
    if v is not None:
        C.add("snodp_cm", v[:, 12], 0.1, meta("SNODP", "Snow depth, annual mean", "cm", {"kind": "reanalysis model (MERRA-2)"}))
        C.add("snodp_maxmonth", np.nanmax(v[:, :12], 1), 0.1, meta("SNODP", "Snow depth, deepest calendar month", "cm", {"kind": "reanalysis model (MERRA-2)"}))
    v = P("FRSNO")
    if v is not None:
        C.add("frsno", v[:, 12], 0.001, meta("FRSNO", "Fraction of land covered by snow, annual mean", "1", {"kind": "reanalysis model (MERRA-2)"}))
        C.add("frsno_months50", (v[:, :12] >= 0.5).sum(1).astype(float) + np.where(np.isfinite(v[:, 12]), 0, np.nan), 1, meta("FRSNO", "Months with at least half of the land snow covered (model)", "months", {"kind": "reanalysis model (MERRA-2)"}))
    # ---------------------------------------------------------------- NASA GIBS imagery (decoded)
    def gmeta(layer, label, units, kind, datasets, period, res, extra=None):
        m = {"label": label, "units": units, "datasets": datasets, "agency": "NASA", "kind": kind, "resolution": res, "period": period,
             "decoded_from": f"NASA GIBS WMS layer {layer} with its colormap (quantised to the colormap bins)"}
        m.update(extra or {}); return m
    def G(layer):
        f = os.path.join(common.RAW, "gibs", f"asterro_gibs_{layer}.json.gz")
        if not os.path.exists(f): rep["gibs"][layer] = {"state": "not_downloaded"}; return False
        rep["gibs"][layer] = {"file_sha256": common.sha256_file(f)}
        src["gibs_" + layer] = {"dataset": "gibs_" + layer.lower(), "agency": "NASA", "provider": "NASA ESDIS, Global Imagery Browse Services (GIBS)",
                                "product": layer, "raw_sha256": rep["gibs"][layer]["file_sha256"]}
        return True
    L = "MERRA2_Dust_Surface_Mass_Concentration_Monthly"
    if G(L):
        d, s, r, top = gibs.monthly_series(L, 1e9); cl, ny = gibs.climatology(d, s)
        r.pop("image_sha256"); rep["gibs"][L].update(r)
        topm = np.zeros(cl.shape[1]); months = np.array([int(t[5:7]) for t in d])
        for m in range(1, 13): topm += top[months == m].any(0)
        mm = gibs_meta = gmeta(L, "", "ug/m3", "reanalysis model (MERRA-2 aerosol assimilation)", ["gibs_merra2_dust_surface_mass_concentration_monthly", "m2tmnxaer"], f"{d[0][:4]}-{d[-1][:4]} monthly climatology", "0.5 x 0.625 deg model, imaged at 0.25 deg")
        C.add("dust_sfc_ugm3", np.nanmean(cl, 0), 0.1, {**mm, "label": "Dust surface mass concentration, annual mean of the monthly climatology", "lower_bound_where": "dust_top_bin_months > 0"})
        C.add("dust_sfc_maxmonth", np.nanmax(cl, 0), 0.1, {**mm, "label": "Dust surface mass concentration, dustiest calendar month", "lower_bound_where": "dust_top_bin_months > 0"})
        C.add("dust_top_bin_months", np.where(np.isfinite(cl).any(0), topm, np.nan), 1, {**mm, "label": "Calendar months in which part of the cell exceeded the colormap's top bin (90 ug/m3); values are then lower bounds", "units": "months"})
    L = "MODIS_Terra_L3_Snow_Cover_Monthly_Average_Pct"
    if G(L):
        d, s, r = gibs.snow_lower_bound(L); cl, ny = gibs.climatology(d, s)
        r.pop("image_sha256"); rep["gibs"][L].update(r)
        mm = gmeta(L, "", "%", "satellite observation (MODIS Terra), lower bound", ["gibs_modis_terra_l3_snow_cover_monthly_average_pct", "mod10cm"], f"{d[0][:4]}-{d[-1][:4]} monthly", "0.05 deg product, imaged at 0.1 deg",
                   {"lower_bound": True, "note": "GIBS renders 0 % snow, cloud and polar night alike as transparent; a value is the snow cover that was detected, and no detection is not evidence of no snow"})
        C.add("snow_detected_maxmonth", np.nanmax(cl, 0), 0.1, {**mm, "label": "Detected snow cover, snowiest calendar month (lower bound)"})
        C.add("snow_detected_months50", (cl >= 50).sum(0).astype(float), 1, {**mm, "label": "Calendar months with at least 50 % detected snow cover (lower bound)", "units": "months"})
    L = "MODIS_Terra_L3_EVI_Monthly"
    if G(L):
        d, s, r, top = gibs.monthly_series(L); cl, ny = gibs.climatology(d, s)
        r.pop("image_sha256"); rep["gibs"][L].update(r)
        mm = gmeta(L, "", "1", "satellite observation (MODIS Terra)", ["gibs_modis_terra_l3_evi_monthly", "mod13a3"], f"{d[0][:4]}-{d[-1][:4]} monthly", "1 km product, imaged at 0.25 deg")
        nm = np.isfinite(cl).sum(0).astype(float)
        C.add("evi_mean", np.nanmean(cl, 0), 0.001, {**mm, "label": "Enhanced Vegetation Index, mean of the observed calendar months"})
        C.add("evi_max", np.nanmax(cl, 0), 0.001, {**mm, "label": "Enhanced Vegetation Index, greenest calendar month"})
        C.add("evi_months", np.where(nm > 0, nm, np.nan), 1, {**mm, "label": "Calendar months with an EVI value (snow, cloud and darkness leave gaps)", "units": "months"})
    L = "MISR_Aerosol_Optical_Depth_Avg_Green_Monthly"
    if G(L):
        d, s, r, top = gibs.monthly_series(L); cl, ny = gibs.climatology(d, s)
        r.pop("image_sha256"); rep["gibs"][L].update(r)
        mm = gmeta(L, "", "1", "satellite observation (MISR, Terra)", ["gibs_misr_aerosol_optical_depth_avg_green_monthly", "mil3maen"], f"{d[0][:4]}-{d[-1][:4]} monthly", "0.5 deg product, imaged at 0.25 deg",
                   {"note": "column aerosol optical depth at 558 nm; not surface dust; observed months only"})
        nm = np.isfinite(cl).sum(0).astype(float)
        C.add("aod_misr_mean", np.where(nm >= 6, np.nanmean(cl, 0), np.nan), 0.001, {**mm, "label": "MISR aerosol optical depth (green), mean of observed calendar months (at least 6)"})
        C.add("aod_misr_months", np.where(nm > 0, nm, np.nan), 1, {**mm, "label": "Calendar months with a MISR aerosol value", "units": "months"})
    L = "MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual"
    if G(L):
        dd, items = gibs.load_bundle(L); lut = gibs.parse_colormap(dd["colormap_xml"])
        v, st, _ = gibs.decode(items[0]["png"], lut, dd["width"], dd["height"], "class"); cells = gibs.pixel_cells(dd["width"], dd["height"])
        rep["gibs"][L].update({"pixels": st, "time": items[0]["time"], "colormap_sha256": dd["colormap_sha256"]})
        fr = gibs.class_fractions(v, cells, list(range(0, 18)))
        mm = gmeta(L, "", "fraction", "satellite classification (MODIS Terra+Aqua, IGBP scheme)", ["gibs_modis_combined_l3_igbp_land_cover_type_annual", "mcd12q1"], items[0]["time"][:4], "500 m product, imaged at 0.1 deg")
        stack = np.array([fr[k] for k in range(0, 18)]); dom = np.argmax(stack, 0).astype(float)
        C.add("lc_dominant", dom, 1, {**mm, "label": "Dominant IGBP land-cover class (code)", "units": "class", "classes": {str(k): n for k, n in enumerate(["Water Bodies", "Evergreen Needleleaf Forests", "Evergreen Broadleaf Forests", "Deciduous Needleleaf Forests", "Deciduous Broadleaf Forests", "Mixed Forests", "Closed Shrublands", "Open Shrublands", "Woody Savannas", "Savannas", "Grasslands", "Permanent Wetlands", "Croplands", "Urban and Built-up Lands", "Cropland/Natural Vegetation Mosaics", "Permanent Snow and Ice", "Barren", "Water Bodies"])}})
        C.add("lc_barren", fr[16], 0.001, {**mm, "label": "Share of the cell classed Barren"})
        C.add("lc_snowice", fr[15], 0.001, {**mm, "label": "Share of the cell classed Permanent Snow and Ice"})
        C.add("lc_water", fr[0] + fr[17], 0.001, {**mm, "label": "Share of the cell classed Water Bodies"})
        C.add("lc_vegetated", sum(fr[k] for k in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14)), 0.001, {**mm, "label": "Share of the cell in vegetated classes (forests, shrublands, savannas, grasslands, wetlands, croplands, mosaics)"})
        C.add("lc_urban", fr[13], 0.001, {**mm, "label": "Share of the cell classed Urban and Built-up"})
    L = "MODIS_Terra_L3_Land_Water_Mask"
    if G(L):
        dd, items = gibs.load_bundle(L); lut = gibs.parse_colormap(dd["colormap_xml"])
        v, st, _ = gibs.decode(items[0]["png"], lut, dd["width"], dd["height"], "class"); cells = gibs.pixel_cells(dd["width"], dd["height"])
        rep["gibs"][L].update({"pixels": st, "time": items[0]["time"]})
        fr = gibs.class_fractions(v, cells, [1])
        C.add("water_mask_frac", fr[1], 0.001, gmeta(L, "Share of the cell that is water (MODIS land/water mask, includes ocean at coasts)", "fraction", "satellite classification (MODIS Terra)", ["gibs_modis_terra_l3_land_water_mask", "mod44w"], items[0]["time"][:4], "250 m product, imaged at 0.1 deg"))
    # ---------------------------------------------------------------- Smithsonian GVP (non-NASA)
    holo, rh = gvp.load("holocene"); pleis, rp = gvp.load("pleistocene"); cc = gvp.cross_check_samples(holo)
    if cc["differ"]: raise SystemExit("GVP: transcriptions disagree with the full download: " + json.dumps(cc["differ"])[:500])
    P_ = gvp.proximity(holo, pleis); rep["gvp"] = {"holocene": rh, "pleistocene": rp, "cross_check": cc}
    for k in ("holocene", "pleistocene"):
        f = os.path.join(common.RAW, "gvp", f"asterro_gvp_{k}.geojson")
        src["gvp_" + k] = {"dataset": "gvp_" + k, "agency": "Smithsonian Institution (not NASA)", "provider": "Global Volcanism Program, National Museum of Natural History",
                           "product": f"Volcanoes of the World, {k.title()} volcano list (GVP-VOTW WFS)", "retrieved": (rh if k == "holocene" else rp)["timeStamp"], "raw_sha256": common.sha256_file(f)}
    gm = {"agency": "Smithsonian Institution (not NASA)", "kind": "catalogue", "resolution": "volcano summit or field-centre points; distance from the cell centre", "period": "Holocene (last ~11,700 years) / Pleistocene"}
    C.add("volc_nearest_km", P_["nearest_holocene_km"], 1, {**gm, "label": "Distance from the cell centre to the nearest Holocene volcano", "units": "km", "datasets": ["gvp_holocene"]}, on_cells=True)
    C.add("volc_nearest_idx", P_["nearest_holocene_idx"].astype(float), 1, {**gm, "label": "Nearest Holocene volcano (index into volcanoes.json)", "units": "index", "datasets": ["gvp_holocene"]}, on_cells=True)
    C.add("volc_holo_100km", P_["holocene_within_100km"].astype(float), 1, {**gm, "label": "Holocene volcanoes within 100 km of the cell centre", "units": "count", "datasets": ["gvp_holocene"]}, on_cells=True)
    C.add("volc_pleis_100km", P_["pleistocene_within_100km"].astype(float), 1, {**gm, "label": "Pleistocene volcanoes within 100 km of the cell centre", "units": "count", "datasets": ["gvp_pleistocene"]}, on_cells=True)
    man = C.write(OUT, src)
    vol = {"schema": "asterro.v19x.volcanoes/1", "source": "Smithsonian Institution, Global Volcanism Program, Volcanoes of the World (Holocene list), retrieved " + rh["timeStamp"][:10],
           "agency": "Smithsonian Institution (not NASA)", "fields": ["number", "name", "type", "last_eruption_year", "country", "lat", "lon", "elevation_m", "rock", "evidence"],
           "volcanoes": [[v["Volcano_Number"], v["Volcano_Name"], v["Primary_Volcano_Type"], v["Last_Eruption_Year"], v["Country"], v["Latitude"], v["Longitude"], v["Elevation"], v["Major_Rock_Type"], v["Evidence_Category"]] for v in holo]}
    open(os.path.join(OUT, "volcanoes.json"), "w").write(json.dumps(vol, ensure_ascii=False, separators=(",", ":")))
    # ---------------------------------------------------------------- site queries (non-NASA)
    S = sites.build(); rep["sites"] = {"cells": len(S["cells"]), "cross_check": S["cross_check"]}
    if S["cross_check"]["map_units_differ"]: raise SystemExit("sites: transcribed map units disagree with the download")
    for k in ("macrostrat", "gbif"):
        f = os.path.join(common.RAW, "sites", f"asterro_{k}_cells.json")
        src["sites_" + k] = {"dataset": k + "_sites", "agency": "Macrostrat, University of Wisconsin-Madison (not NASA)" if k == "macrostrat" else "GBIF Secretariat (not NASA)",
                             "product": "geologic_units/map at 101 cell centres" if k == "macrostrat" else "occurrence search counts in 101 cells", "raw_sha256": common.sha256_file(f)}
    open(os.path.join(OUT, "sites.json"), "w").write(json.dumps({"schema": "asterro.v19x.sites/1", **S}, ensure_ascii=False, separators=(",", ":")))
    # ---------------------------------------------------------------- CMR discovery
    R = cmr.records(); rep["cmr"] = {"queried": len(R), "found": sum(r["found"] for r in R), "requires_earthdata_login": sum(bool(r.get("requires_earthdata_login")) for r in R)}
    open(os.path.join(OUT, "cmr.json"), "w").write(json.dumps({"schema": "asterro.v19x.cmr/1", "records": R}, ensure_ascii=False, separators=(",", ":")))
    rep["cube"] = {"variables": len(man["variables"]), "bytes": man["bytes"], "sha256": man["sha256"]}
    os.makedirs(common.p("data", "v19", "x"), exist_ok=True)
    open(common.p("data", "v19", "x", "build_report.json"), "w").write(json.dumps(rep, indent=1, default=str))
    print(json.dumps(rep["cube"]), {k: v.get("land_cells_with_value", v.get("state")) for k, v in rep["power"].items()})




def inventory():
    """Write public/data/v19/env/inventory.json (run after build_web has listed the service-worker core files)."""
    from src.v19x import inventory as inv
    rep = json.load(open(common.p("data", "v19", "x", "build_report.json")))
    cube = json.load(open(os.path.join(OUT, "cube.json"))); R = json.load(open(os.path.join(OUT, "cmr.json")))["records"]
    sw = open(common.p("public", "sw.js")).read(); core = json.loads(sw[sw.index("const CORE = ") + 13: sw.index(";\n", sw.index("const CORE = "))])
    core = core + ["data/v19/env/inventory.json"]
    doc = inv.build(rep, cube, R, set(core))
    open(os.path.join(OUT, "inventory.json"), "w").write(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
    print("inventory", doc["n"], "rows,", doc["nasa"], "NASA,", doc["counts"])


if __name__ == "__main__":
    (inventory if sys.argv[1:] == ["inventory"] else main)()
