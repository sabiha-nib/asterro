"""Criterion registry: the single source of truth for the planetary fingerprint.

Adding a criterion = add one entry here + one array in the predictor stack. The similarity
engine iterates over whatever criteria are present; nothing else needs to change.
"""

CRITERIA = [
    dict(id="aridity", label="Aridity", short="ARID", unit="index (P/PET, saturated at 1)", group="climate",
         description="UNEP-style aridity index P/PET. PET by Hargreaves (1985) from NASA POWER "
                     "T2M, T2M_MAX_AVG, T2M_MIN_AVG with FAO-56 extraterrestrial radiation Ra "
                     "(computed from latitude); P = PRECTOTCORR. Values >= 1 (energy-limited, humid) "
                     "are saturated at 1. Missing where Hargreaves PET is undefined.",
         earth_source=["nasa_power"], fmt=3),
    dict(id="annual_temperature_range", label="Annual temperature range", short="T-RANGE", unit="K",
         group="climate",
         description="Warmest-month minus coldest-month mean 2 m air temperature (NASA POWER T2M "
                     "climatology 2001-2020).",
         earth_source=["nasa_power"], fmt=1),
    dict(id="elevation", label="Elevation", short="ELEV", unit="m", group="terrain",
         description="Mean GMTED2010 30-arc-second elevation in the cell (m above EGM96).",
         earth_source=["gmted2010"], fmt=0),
    dict(id="slope", label="Slope", short="SLOPE", unit="deg", group="terrain",
         description="Mean Horn (1981) slope on a 926.6 m baseline.",
         earth_source=["gmted2010"], fmt=2),
    dict(id="surface_roughness", label="Surface roughness", short="ROUGH", unit="m", group="terrain",
         description="Standard deviation of 926.6 m-baseline elevations inside the cell.",
         earth_source=["gmted2010"], fmt=0),
    dict(id="lst_diurnal_range", label="Thermal (LST diurnal range)", short="THERM", unit="K", group="thermal",
         description="MODIS Aqua land-surface temperature at ~13:30 minus ~01:30 local solar time, "
                     "mean of monthly composites 2016-2025.",
         earth_source=["modis_aqua_lst"], fmt=1),
]

CRITERION_IDS = [c["id"] for c in CRITERIA]

# Documented, deterministic classification thresholds (criterion similarity s in [0, 1]).
MATCH_THRESHOLD = 0.85
PARTIAL_THRESHOLD = 0.60

ALGORITHM_VERSION = "tai-sim-1.0.0"
