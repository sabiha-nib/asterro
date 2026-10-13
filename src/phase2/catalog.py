"""Phase II catalogues — the single source for editorial tables shared by Python and the browser
(written into public/data/phase2/context.json by scripts/build_phase2_data.py).

Everything here is DESCRIPTIVE METADATA about the existing data products, or an explicitly
labelled editorial mapping. No table in this file contains an engineering threshold, a
measurement, or a value that enters any score.
"""

# Variables that a user-defined requirement may test. `field` is the array name in the baseline
# web bundle (public/data/stack.bin); every value is the CELL-MEAN statistic of that bundle.
REQUIREMENT_VARIABLES = {
    "slope": dict(field="slope", label="Slope", statistic="Cell-mean Horn slope (926.6 m baseline)", unit="°", fmt=2,
                  dataset="USGS/NGA GMTED2010 mn30", resolution="0.5° × 0.625° cell mean of 926.6 m slopes",
                  temporal="static (2000-era source data)", years=None),
    "surface_roughness": dict(field="surface_roughness", label="Surface roughness", unit="m", fmt=1,
                  statistic="SD of 926.6 m elevations within the cell", dataset="USGS/NGA GMTED2010 mn30",
                  resolution="0.5° × 0.625° cell", temporal="static", years=None),
    "elevation": dict(field="elevation", label="Elevation", unit="m", fmt=0, statistic="Cell-mean elevation (EGM96)",
                  dataset="USGS/NGA GMTED2010 mn30", resolution="0.5° × 0.625° cell", temporal="static", years=None),
    "aridity_index_raw": dict(field="aridity_index_raw", label="Aridity index P/PET (unsaturated)", unit="", fmt=3,
                  statistic="Annual P / Hargreaves-FAO56 PET", dataset="NASA POWER (MERRA-2) PRECTOTCORR, T2M",
                  resolution="0.5° × 0.625° (MERRA-2 native)", temporal="2001–2020 climatology", years=20),
    "precip_mm_yr": dict(field="precip_mm_yr", label="Annual precipitation", unit="mm yr⁻¹", fmt=0,
                  statistic="Annual total of monthly climatology", dataset="NASA POWER (MERRA-2) PRECTOTCORR",
                  resolution="0.5° × 0.625°", temporal="2001–2020 climatology", years=20),
    "annual_temperature_range": dict(field="annual_temperature_range", label="Annual air-temperature range", unit="K", fmt=2,
                  statistic="Warmest minus coldest monthly mean T2M", dataset="NASA POWER (MERRA-2) T2M",
                  resolution="0.5° × 0.625°", temporal="2001–2020 climatology", years=20),
    "t2m_mean_c": dict(field="t2m_mean_c", label="Mean air temperature", unit="°C", fmt=1, statistic="Annual mean T2M",
                  dataset="NASA POWER (MERRA-2) T2M", resolution="0.5° × 0.625°", temporal="2001–2020 climatology", years=20),
    "lst_day_k": dict(field="lst_day_k", label="Daytime land-surface temperature", unit="K", fmt=1,
                  statistic="Mean MODIS Aqua day LST (~13:30)", dataset="MODIS Aqua MYD11C3 via NASA GIBS",
                  resolution="0.1° render aggregated to 0.5° × 0.625°", temporal="2016–2025 monthly", years=10),
    "lst_night_k": dict(field="lst_night_k", label="Night-time land-surface temperature", unit="K", fmt=1,
                  statistic="Mean MODIS Aqua night LST (~01:30)", dataset="MODIS Aqua MYD11C3 via NASA GIBS",
                  resolution="0.1° render aggregated to 0.5° × 0.625°", temporal="2016–2025 monthly", years=10),
    "lst_diurnal_range": dict(field="lst_diurnal_range", label="LST day − night", unit="K", fmt=2,
                  statistic="Mean of monthly day−night LST pairs", dataset="MODIS Aqua MYD11C3 via NASA GIBS",
                  resolution="0.1° render aggregated to 0.5° × 0.625°", temporal="2016–2025 monthly", years=10),
    "modis_coverage": dict(field="modis_coverage", label="MODIS data availability", unit="fraction", fmt=3,
                  statistic="Valid pixel-months / possible pixel-months", dataset="MODIS Aqua MYD11C3 via NASA GIBS",
                  resolution="cell", temporal="2016–2025", years=10),
    "gmted_land_fraction": dict(field="gmted_land_fraction", label="GMTED land fraction", unit="fraction", fmt=3,
                  statistic="Valid 30″ land pixels / pixels in cell", dataset="USGS/NGA GMTED2010 mn30",
                  resolution="cell", temporal="static", years=None),
}

# Planetary differences OUTSIDE the six-criterion model. `evidence` lists only data actually present
# in this repository; everything else is classified UNMODELED.
MISSING_FACTORS = [
    dict(id="gravity", label="Gravity", status="UNMODELED", evidence=[],
         note="No gravity variable exists in the predictor stack or targets; not evaluated."),
    dict(id="pressure", label="Atmospheric pressure", status="PARTIAL",
         evidence=["Mars: MEDA median surface pressure (data/targets.json raw_reference.meda_median_pressure_Pa)"],
         note="Represented only through the elevation PROXY ('thin atmosphere'). Earth surface pressure is not in "
              "the stack; no Earth surface approaches Mars pressure, so this difference is never closed."),
    dict(id="composition", label="Atmospheric composition", status="UNMODELED", evidence=[], note="Not evaluated."),
    dict(id="radiation", label="Radiation environment", status="UNMODELED", evidence=[], note="Not evaluated."),
    dict(id="geology", label="Geology and mineralogy", status="UNMODELED", evidence=[],
         note="Terrain criteria describe shape (slope, roughness), not material."),
    dict(id="day_length", label="Day length", status="UNMODELED", evidence=[],
         note="Thermal criterion compares day−night differences at matched local solar times; the length of the "
              "solar day and of the night are not compared."),
    dict(id="dust", label="Dust characteristics", status="UNMODELED", evidence=[], note="Not evaluated."),
    dict(id="absolute_temperature", label="Absolute temperature level", status="EVIDENCE_AVAILABLE",
         evidence=["Earth: MODIS day/night LST (lst_day_k, lst_night_k)", "Mars: MEDA TIRS ground temperature 13–14 and 01–02 LTST",
                   "Moon: Diviner mean T(13–14 h) and T(01–02 h), summer and winter"],
         note="The score uses only the day−night DIFFERENCE. Absolute temperatures are compared here as a "
              "failure-mode check, never added to the score."),
    dict(id="illumination", label="Illumination conditions", status="UNMODELED", evidence=[],
         note="Polar illumination geometry (Moon) is not modelled; the window mixes sunlit and shadowed terrain."),
    dict(id="subsurface", label="Subsurface conditions", status="UNMODELED", evidence=[], note="Not evaluated."),
]

# Editorial mapping: which differences a researcher should review for a given activity. This is a
# REVIEW CHECKLIST, not a suitability rule; it contains no thresholds.
ACTIVITIES = {
    "rover_mobility": dict(label="Rover mobility experiments", criteria=["slope", "surface_roughness"],
                           factors=["gravity", "geology", "dust"]),
    "terrain_navigation": dict(label="Terrain navigation research", criteria=["slope", "surface_roughness", "elevation"],
                               factors=["illumination", "geology"]),
    "eva_preparation": dict(label="Astronaut EVA preparation", criteria=["slope", "surface_roughness", "lst_diurnal_range"],
                            factors=["gravity", "pressure", "radiation", "absolute_temperature", "dust"]),
    "instrument_testing": dict(label="Surface instrument testing", criteria=["lst_diurnal_range", "aridity"],
                               factors=["absolute_temperature", "pressure", "dust", "radiation"]),
    "thermal_equipment": dict(label="Thermal equipment evaluation", criteria=["lst_diurnal_range", "annual_temperature_range"],
                              factors=["absolute_temperature", "pressure", "composition", "day_length"]),
    "habitat_operations": dict(label="Habitat operations research", criteria=["annual_temperature_range", "aridity", "slope"],
                               factors=["pressure", "radiation", "gravity", "absolute_temperature"]),
    "environmental_monitoring": dict(label="Environmental monitoring", criteria=["lst_diurnal_range", "aridity", "annual_temperature_range"],
                                     factors=["composition", "dust", "day_length"]),
    "geological_fieldwork": dict(label="Geological fieldwork", criteria=["slope", "surface_roughness", "elevation"],
                                 factors=["geology", "subsurface"]),
}

# Uncertainty sources and how (whether) this build can quantify them.
UNCERTAINTY_SOURCES = {
    "measurement": "Instrument / retrieval error of each source product. Not distributed with the data used here "
                   "except the MODIS GIBS colour-map quantisation (decoding bound).",
    "temporal": "Year-to-year variability (MODIS 2016–2025 yearly values) and target seasonal / Ls-bin variability.",
    "spatial": "Aggregation of finer source data to 0.5° × 0.625° cells; neighbourhood variability as context.",
    "missing": "Missing observations (MODIS pixel-month coverage; undefined aridity).",
    "target_reference": "Alternative statistics of the target data (Ls bins, sols, Diviner seasons).",
    "product": "Differences between data products / instruments (MEDA TIRS, Diviner vs MODIS).",
    "weights": "Weight sensitivity (see Robustness Laboratory).",
    "proxy": "Proxy-variable limitations (aridity, elevation).",
    "method": "Methodology differences (Hargreaves PET; GIBS decoding; window statistics).",
    "comparability": "Known limits of comparing planetary environments (gravity, atmosphere, radiation …).",
}

# Scale ladder: what each number summarises.
SCALES = [
    dict(item="Earth cell (scoring unit)", scale="0.5° × 0.625° ≈ 55 km × 69 km at the equator (latitude-dependent)"),
    dict(item="NASA POWER source", scale="MERRA-2 native 0.5° × 0.625° — no sub-cell information"),
    dict(item="MODIS LST source", scale="0.05° CMG rendered at 0.1° by GIBS, aggregated to the cell; sub-cell pixels not retained"),
    dict(item="GMTED2010 source", scale="30″ (~926 m) — slopes on a 926.6 m baseline; sub-cell pixels not retained"),
    dict(item="Mars terrain target", scale="MOLA 463 m DEM binned to 926.6 m, 55.6 km window (3,600 bins)"),
    dict(item="Moon terrain target", scale="LOLA 118 m DEM binned to 926.6 m, 55.6 km window (3,600 bins)"),
    dict(item="Mars thermal target", scale="MEDA rover point measurement (metres), 12 Ls bins over one Mars year"),
    dict(item="Moon thermal target", scale="Diviner 240 m polar maps, 55.6 km window mean, summer and winter"),
    dict(item="Globe display", scale="2048 × 1024 basemap; cells drawn at native grid — display adds no information"),
]
