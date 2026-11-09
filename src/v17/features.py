"""Environmental feature cube, V17 derived variables (tai-v17-features-1.0.0).

Every value is recomputed from inputs already retained in the repository. Nothing is downloaded and nothing here
enters the baseline score (tai-sim-1.0.0).

Inputs
  data/raw/power_climatology.npz  NASA POWER Climatology API v2.10.0, 2001-2020 monthly means:
                                  T2M, T2M_MAX_AVG, T2M_MIN_AVG, PRECTOTCORR (MERRA-2, 0.5 x 0.625 deg),
                                  TOA_SW_DWN (1 deg native, MJ m-2 day-1)
  data/raw/modis_lst.npz          MODIS Aqua monthly LST day/night via GIBS, yearly diurnal range 2016-2025
  data/predictor_stack.npz        baseline stack (valid mask, elevation, surface roughness, aridity index P/PET)

Derived variables (all per valid 0.5 x 0.625 deg cell; missing stays missing, never zero)
  freeze_months        months with mean 2 m air temperature < 0 C (0-12). Air temperature, reanalysis.
  ft_air_months        months whose mean daily minimum is < 0 C and mean daily maximum is > 0 C: an air-temperature
                       proxy for frequent freeze-thaw crossings (0-12). Not a ground or surface observation.
  dry_months           months with P(mm) < 2 T(C), the Bagnouls-Gaussen dry-month criterion (0-12).
  precip_cv            coefficient of variation of the 12 monthly precipitation totals (seasonality; missing where
                       annual precipitation is 0).
  maat_below_zero      mean annual air temperature < 0 C: a climatic condition that favours permafrost. Necessary,
                       not sufficient; it is not an observation of ground ice.
  polar_night_months   months with mean top-of-atmosphere insolation < 0.25 MJ m-2 day-1 (about 3 W m-2): the Sun
                       stays at or below the horizon for (almost) the whole month. With this threshold the first such
                       month appears at 65-66.5 deg, next to the polar circles (66.56 deg).
  toa_annual_wm2       annual mean top-of-atmosphere insolation, W m-2 (MJ m-2 day-1 x 1e6 / 86400). TOA insolation
                       depends only on latitude and season, so the 1 deg product is assigned to each 0.5 deg row from
                       the nearest product row.
  lst_dr_iav_k         interannual standard deviation of the yearly MODIS LST diurnal range 2016-2025 (K), only
                       where at least 5 of the 10 years are valid; n years kept alongside.
  aridity_class        UNEP aridity zones from the aridity index P/PET: hyper-arid < 0.05, arid 0.05-0.2,
                       semi-arid 0.2-0.5, dry sub-humid 0.5-0.65, humid >= 0.65.
  landform_class       ASTERRO-defined, provisional relief class from cell-scale GMTED2010 relief (SD of 30-arc-second
                       elevations) and mean elevation: low relief (< 50 m) plain (< 500 m) or plateau (>= 500 m);
                       moderate relief (50-200 m) hills; high relief (>= 200 m) mountains (< 2500 m) or high mountains.
                       Thresholds separate cell-scale relief; they are not validated against a landform map.
"""
import json, os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VERSION = "tai-v17-features-1.0.0"
MISSING = 255
ARIDITY_CLASSES = ["hyper_arid", "arid", "semi_arid", "dry_subhumid", "humid"]
LANDFORM_CLASSES = ["plain", "plateau", "hills", "mountains", "high_mountains"]
DAYS = np.array([31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])


def _toa_fill(A):
    """TOA_SW_DWN is a 1-degree product placed on every other row; fill each row from the nearest row with data.
    TOA insolation has no longitude dependence, so a row is filled with its own row mean."""
    out = np.full(A.shape, np.nan, dtype=np.float64)
    for m in range(A.shape[0]):
        rows = np.where(np.isfinite(A[m]).any(axis=1))[0]
        means = np.array([np.nanmean(A[m, r]) for r in rows])
        for r in range(A.shape[1]):
            k = rows[np.argmin(np.abs(rows - r))]
            out[m, r, :] = means[np.where(rows == k)[0][0]]
    return out


def compute():
    p = np.load(os.path.join(ROOT, "data/raw/power_climatology.npz"))
    s = np.load(os.path.join(ROOT, "data/predictor_stack.npz"))
    m = np.load(os.path.join(ROOT, "data/raw/modis_lst.npz"))
    v = s["valid"]
    T = p["T2M"][:12][:, v].astype(np.float64)
    Tx = p["T2M_MAX_AVG"][:12][:, v].astype(np.float64)
    Tn = p["T2M_MIN_AVG"][:12][:, v].astype(np.float64)
    Pd = p["PRECTOTCORR"][:12][:, v].astype(np.float64)          # mm/day
    Pm = Pd * DAYS[:, None]                                      # mm/month
    toa = _toa_fill(p["TOA_SW_DWN"][:12].astype(np.float64))[:, v]
    ok_T = np.all(np.isfinite(T), axis=0)
    ok_TT = np.all(np.isfinite(Tx), axis=0) & np.all(np.isfinite(Tn), axis=0)
    ok_P = np.all(np.isfinite(Pm), axis=0)
    out = {}
    out["freeze_months"] = np.where(ok_T, (T < 0).sum(0), np.nan)
    out["ft_air_months"] = np.where(ok_TT, ((Tn < 0) & (Tx > 0)).sum(0), np.nan)
    out["dry_months"] = np.where(ok_T & ok_P, (Pm < 2 * T).sum(0), np.nan)
    tot = Pm.sum(0)
    with np.errstate(invalid="ignore", divide="ignore"):
        out["precip_cv"] = np.where(ok_P & (tot > 0), Pm.std(0) / Pm.mean(0), np.nan)
    out["maat_below_zero"] = np.where(ok_T, (T.mean(0) < 0).astype(float), np.nan)
    out["polar_night_months"] = np.where(np.all(np.isfinite(toa), 0), (toa < 0.25).sum(0), np.nan)
    out["toa_annual_wm2"] = np.where(np.all(np.isfinite(toa), 0), toa.mean(0) * 1e6 / 86400, np.nan)
    dr = m["dr_year"][:, v].astype(np.float64)
    nyr = np.isfinite(dr).sum(0)
    with np.errstate(invalid="ignore"):
        iav = np.nanstd(np.where(np.isfinite(dr), dr, np.nan), axis=0, ddof=1)
    out["lst_dr_iav_k"] = np.where(nyr >= 5, iav, np.nan)
    out["lst_dr_years"] = nyr.astype(float)
    ai = s["aridity_index_raw"][v].astype(np.float64)
    ac = np.full(ai.shape, np.nan)
    for k, (lo, hi) in enumerate([(-np.inf, 0.05), (0.05, 0.2), (0.2, 0.5), (0.5, 0.65), (0.65, np.inf)]):
        ac[(ai >= lo) & (ai < hi)] = k
    out["aridity_class"] = ac
    r = s["surface_roughness"][v].astype(np.float64); e = s["elevation"][v].astype(np.float64)
    lf = np.full(r.shape, np.nan)
    ok = np.isfinite(r) & np.isfinite(e)
    lf[ok & (r < 50) & (e < 500)] = 0
    lf[ok & (r < 50) & (e >= 500)] = 1
    lf[ok & (r >= 50) & (r < 200)] = 2
    lf[ok & (r >= 200) & (e < 2500)] = 3
    lf[ok & (r >= 200) & (e >= 2500)] = 4
    out["landform_class"] = lf
    return v, out


# Quantisation of each variable to one byte (255 = missing). (scale, offset): stored = round((x - offset) / scale)
QUANT = {
    "freeze_months": (1, 0), "ft_air_months": (1, 0), "dry_months": (1, 0), "polar_night_months": (1, 0),
    "maat_below_zero": (1, 0), "aridity_class": (1, 0), "landform_class": (1, 0), "lst_dr_years": (1, 0),
    "precip_cv": (0.02, 0), "toa_annual_wm2": (2, 0), "lst_dr_iav_k": (0.1, 0),
}
UNITS = {
    "freeze_months": "months (0-12)", "ft_air_months": "months (0-12)", "dry_months": "months (0-12)",
    "polar_night_months": "months (0-12)", "maat_below_zero": "yes/no", "aridity_class": "class",
    "landform_class": "class", "lst_dr_years": "years", "precip_cv": "ratio", "toa_annual_wm2": "W m-2",
    "lst_dr_iav_k": "K",
}


def quantise(x, scale, offset):
    q = np.where(np.isfinite(x), np.round((x - offset) / scale), MISSING)
    if np.any((q > 254) & (q != MISSING)):
        raise ValueError("quantisation overflow")
    return q.astype(np.uint8)


def summary(out):
    res = {}
    for k, x in out.items():
        f = np.isfinite(x)
        res[k] = {"n_valid": int(f.sum()), "n_missing": int((~f).sum()),
                  "min": float(np.nanmin(x)) if f.any() else None, "max": float(np.nanmax(x)) if f.any() else None,
                  "median": float(np.nanmedian(x)) if f.any() else None}
    return res


if __name__ == "__main__":
    v, out = compute()
    print(json.dumps(summary(out), indent=1))
