"""Assemble data/targets.json from the ingestion outputs. Every number here is COMPUTED from a
mission dataset by the scripts in src/data/ingestion, or is an explicitly flagged proxy whose
rule is written down below. Nothing is typed in by hand except citations and rule text.
"""
import json, os, sys
import numpy as np

S3 = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/"


def build(raw, earth_max_elevation_m):
    tp = json.loads(str(np.load(os.path.join(raw, "terrain_planets.npz"))["meta"]))
    meda = json.load(open(os.path.join(raw, "mars_meda.json")))["summary"]
    moon = json.load(open(os.path.join(raw, "moon_diviner.json")))
    pres = json.load(open(os.path.join(raw, "meda_pressure.json")))
    p_med = float(np.median([p["median_Pa"] for p in pres]))
    elev_rule = (f"Absolute elevations on different bodies are referenced to unrelated datums and are not "
                 f"physically comparable. The criterion is therefore re-interpreted as 'thin atmosphere': "
                 f"Earth pressure falls with altitude, and no Earth surface reaches Mars or Moon surface "
                 f"pressure, so the target is set to the highest mean elevation of any valid Earth cell "
                 f"({earth_max_elevation_m:.1f} m). Similarity on this criterion therefore rewards the "
                 f"lowest-pressure Earth terrain available.")
    J, M = tp["mars_jezero"], tp["moon_south_pole"]
    targets = [
        dict(id="mars_jezero", body="Mars", name="Jezero Crater",
             location=dict(lat=J["center_lat"], lon_east=J["center_lon"], window_km=round(J["window_km"], 2),
                           note="Window centred on the Mars 2020 landing site region, crater floor and delta."),
             variables=dict(aridity=0.0, annual_temperature_range=round(meda["annual_temperature_range_K"], 3),
                            elevation=round(earth_max_elevation_m, 1), slope=round(J["slope_deg"], 3),
                            surface_roughness=round(J["surface_roughness_m"], 1),
                            lst_diurnal_range=round(meda["lst_diurnal_range_K"], 3)),
             units=dict(aridity="index", annual_temperature_range="K", elevation="m (Earth-equivalent proxy)",
                        slope="deg", surface_roughness="m", lst_diurnal_range="K"),
             comparison=dict(aridity="proxy", annual_temperature_range="direct (cross-instrument)",
                             elevation="proxy", slope="direct (identical algorithm)",
                             surface_roughness="direct (identical algorithm)",
                             lst_diurnal_range="direct (cross-instrument)"),
             proxy_flags=dict(aridity=True, annual_temperature_range=False, elevation=True, slope=False,
                              surface_roughness=False, lst_diurnal_range=False),
             methodology=dict(
                 aridity="PROXY. P/PET -> 0: Mars has no liquid precipitation (P = 0) while evaporative demand is "
                         "non-zero, so the aridity index is 0 by construction (hyper-arid limit).",
                 annual_temperature_range=f"Max minus min over 12 Ls bins (30 deg) of the diurnal-mean air temperature "
                         f"from MEDA ATS (median of the three RSM sensors, ~1.45 m), 335 sols of one Mars year. "
                         f"Bin means {meda['air_bin_min_K']:.2f}..{meda['air_bin_max_K']:.2f} K. A Mars 'month' "
                         f"(30 deg Ls) lasts ~56 sols vs ~30 days on Earth.",
                 elevation="PROXY. " + elev_rule + f" MEDA median surface pressure at Jezero ~{p_med:.0f} Pa "
                         f"(Earth sea level ~101 325 Pa). Raw MOLA mean elevation of the window "
                         f"{J['elevation_m']:.0f} m (areoid) is reported, not used.",
                 slope="Horn (1981) slope on a 926.6 m grid binned from MGS MOLA 463 m DEM, mean over a "
                       "55.6 km x 55.6 km window -- the same code path as Earth.",
                 surface_roughness="Std. dev. of 926.6 m-binned MOLA elevations in the same window.",
                 lst_diurnal_range="MEDA TIRS ground temperature, mean over 12 Ls bins of T(13-14 LTST) - "
                                   "T(01-02 LTST): the MODIS Aqua overpass local times."),
             raw_reference=dict(mola_mean_elevation_m=J["elevation_m"], mola_slope_p90_deg=J["slope_p90_deg"],
                                meda_median_pressure_Pa=p_med, meda_bins=meda["bins"]),
             sources=["NASA PDS Atmospheres Node - Mars 2020 MEDA calibrated environment data (urn:nasa:pds:mars2020_meda)",
                      "USGS Astrogeology / NASA PDS - MGS MOLA DEM mosaic 463 m",
                      "Rodriguez-Manfredi et al. (2021) Space Sci. Rev. 217:48, MEDA instrument description"],
             source_urls=["https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/",
                          S3 + "Mars_MGS_MOLA_DEM_mosaic_global_463m.tif",
                          "https://doi.org/10.1007/s11214-021-00816-9"],
             limitations=["Rover-scale (metres) MEDA point measurements are compared with 55 km Earth cell means.",
                          "Mars gravity (0.38 g), CO2 atmosphere at ~0.6-0.9 kPa and radiation are not modelled.",
                          "Sol-sampling of MEDA is uneven across Ls; each Ls bin is weighted equally.",
                          "The MOLA 463 m DEM under-samples metre-scale rover hazards."]),
        dict(id="moon_south_pole", body="Moon", name="Lunar South Pole",
             location=dict(lat=M["center_lat"], lon_east=M["center_lon"], window_km=round(M["window_km"], 2),
                           note="55.6 km window centred on the pole; includes Shackleton crater and adjacent ridges "
                                "considered for Artemis landing regions."),
             variables=dict(aridity=0.0, annual_temperature_range=None, elevation=round(earth_max_elevation_m, 1),
                            slope=round(M["slope_deg"], 3), surface_roughness=round(M["surface_roughness_m"], 1),
                            lst_diurnal_range=round(moon["lst_diurnal_range_K"], 3)),
             units=dict(aridity="index", annual_temperature_range="K", elevation="m (Earth-equivalent proxy)",
                        slope="deg", surface_roughness="m", lst_diurnal_range="K"),
             comparison=dict(aridity="proxy", annual_temperature_range="not applicable", elevation="proxy",
                             slope="direct (identical algorithm)", surface_roughness="direct (identical algorithm)",
                             lst_diurnal_range="direct (cross-instrument)"),
             proxy_flags=dict(aridity=True, annual_temperature_range=False, elevation=True, slope=False,
                              surface_roughness=False, lst_diurnal_range=False),
             methodology=dict(
                 aridity="PROXY. No atmosphere and no precipitation: aridity index 0 by construction.",
                 annual_temperature_range="NOT APPLICABLE. The Moon has no near-surface air; this criterion is "
                                          "excluded from every lunar score (null, never filled).",
                 elevation="PROXY. " + elev_rule + " The Moon has an exosphere only (surface pressure ~0).",
                 slope="Horn (1981) slope on a 926.6 m grid binned from LRO LOLA 118 m LDEM, mean over a "
                       "55.6 km window centred on the pole -- same code path as Earth.",
                 surface_roughness="Std. dev. of 926.6 m-binned LOLA elevations in the same window.",
                 lst_diurnal_range="Diviner polar hourly bolometric temperature maps (Williams et al. 2019): "
                                   "window mean of T(13-14 h local time) - T(01-02 h), averaged over the summer "
                                   "and winter maps. Bin check: the summer hour14 map equals the mean of the PDS "
                                   "0.25-h products LTIM53-56 (13.00-14.00 h) to 7e-6 K rms (verified, "
                                   "docs/SCIENTIFIC_AUDIT.md); hour02 follows the same numbering (not separately checked). "
                                   "At the pole 'local time' is solar azimuth; slopes facing "
                                   f"away from the Sun give negative differences (p10 summer "
                                   f"{moon['summer']['p10_dT_K']:.1f} K, p90 {moon['summer']['p90_dT_K']:.1f} K)."),
             raw_reference=dict(lola_mean_elevation_m=M["elevation_m"], lola_slope_p90_deg=M["slope_p90_deg"],
                                diviner=dict(summer=moon["summer"], winter=moon["winter"])),
             sources=["NASA PDS / USGS Astrogeology - LRO LOLA global LDEM 118 m (Mar 2014)",
                      "LRO Diviner polar hourly temperature maps - Williams et al. (2019) JGR Planets 124:2505",
                      "UCLA Diviner level-4 polar products (PDS-archived counterparts)"],
             source_urls=[S3 + "Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif",
                          "https://doi.org/10.1029/2019JE006028",
                          "https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/"],
             limitations=["Vacuum, 0.17 g, 29.5-day lunation and extreme illumination geometry are not modelled.",
                          "Diviner bolometric brightness temperature vs MODIS split-window LST: related but not "
                          "identical retrievals.",
                          "Permanently shadowed and sunlit terrain are averaged together in one 55.6 km window."]),
    ]
    return targets


STATUS = {"proxy": "PROXY", "not applicable": "N/A", "direct": "DIRECT"}
PROXY_METHOD = {
    "aridity": "definition: P = 0 on a body without liquid precipitation => P/PET = 0 (hyper-arid limit)",
    "elevation": "thin-atmosphere reinterpretation: target = maximum mean elevation of valid Earth cells; "
                 "rewards the lowest-pressure Earth terrain. NOT a comparison of planetary elevations.",
}


def annotate(t):
    """Derive the machine-readable DIRECT / PROXY / N/A status from the documented comparison text."""
    t["status"] = {c: next(v for k, v in STATUS.items() if t["comparison"][c].startswith(k)) for c in t["variables"]}
    t["proxy_method"] = {c: PROXY_METHOD[c] for c, f in t["proxy_flags"].items() if f}
    for c, st in t["status"].items():
        assert (st == "PROXY") == bool(t["proxy_flags"][c]), (t["id"], c)
        assert (st == "N/A") == (t["variables"][c] is None), (t["id"], c)
    t["interpretation"] = ("Similarity to this target means similar values of the selected modelled variables "
                           "under the chosen weights. It is not physical, geological or engineering equivalence.")
    return t


def main(raw="data/raw", repo="."):
    stack = np.load(os.path.join(repo, "data/predictor_stack.npz"))
    emax = float(np.nanmax(stack["elevation"][stack["valid"]]))
    t = [annotate(x) for x in build(raw, emax)]
    json.dump(dict(version="1.0.0", targets=t), open(os.path.join(repo, "data/targets.json"), "w"), indent=1)
    for x in t:
        print(x["id"], x["variables"])


if __name__ == "__main__":
    main(*sys.argv[1:])
