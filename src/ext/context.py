"""Site context (tai-ext-context-1.0.0): characteristics derived from data already retained in the repository.

Nothing here is downloaded; every value is recomputed from retained inputs and is NOT part of any score.

1. Climate class: the Koeppen-Geiger classification in the form of Peel, Finlayson & McMahon (2007, Hydrol. Earth
   Syst. Sci. 11, 1633-1644), computed per Earth cell from the NASA POWER monthly climatology 2001-2020 (T2M,
   PRECTOTCORR; MERRA-2 source) in data/raw/power_climatology.npz. Summer = Apr-Sep in the northern hemisphere,
   Oct-Mar in the southern. The arid group B is tested first, then A, C, D and E by temperature, as in common
   implementations of Peel et al. (2007).
2. Environment type: the Natural Earth 1:50m geography-region feature class (Desert, Plateau, Range/mtn, Basin,
   Tundra, Valley, Delta ...) of the region polygon that labels the cell (data/raw/geo/labels.json, labels.npz).
3. Illumination geometry: noon solar elevation from latitude and axial tilt (Earth 23.44 deg, Mars 25.19 deg, Moon
   1.54 deg to the ecliptic). Geometry only: no atmosphere, no terrain shadowing, no measured irradiance.
4. Kilometre-scale slope distribution of each planetary target window: share of ~926 m pixels with Horn slope at or
   below 2, 5, 10, 15, 20, 30 deg, from the same retained target grids the baseline slope is computed from. The
   Earth counterpart (GMTED2010 30-arc-second pixels per cell) is the Phase III sub-cell product.
"""
import json, os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VERSION = "tai-ext-context-1.0.0"
KOPPEN = ["Af", "Am", "Aw", "BWh", "BWk", "BSh", "BSk", "Csa", "Csb", "Csc", "Cwa", "Cwb", "Cwc", "Cfa", "Cfb", "Cfc",
          "Dsa", "Dsb", "Dsc", "Dsd", "Dwa", "Dwb", "Dwc", "Dwd", "Dfa", "Dfb", "Dfc", "Dfd", "ET", "EF"]
TILT = {"earth": 23.44, "mars": 25.19, "moon": 1.54}
SLOPE_T = [2, 5, 10, 15, 20, 30]


def koppen(T, P, lat):
    """T, P: 12 monthly means (deg C, mm/month). Returns a Koeppen-Geiger code after Peel et al. (2007), or None."""
    T = np.asarray(T, dtype=np.float64); P = np.asarray(P, dtype=np.float64)
    if not (np.all(np.isfinite(T)) and np.all(np.isfinite(P))):
        return None
    MAT, MAP = T.mean(), P.sum()
    Thot, Tcold = T.max(), T.min()
    Tmon10 = int((T > 10).sum())
    summer = np.array([3, 4, 5, 6, 7, 8]) if lat >= 0 else np.array([9, 10, 11, 0, 1, 2])
    winter = np.array([m for m in range(12) if m not in set(summer.tolist())])
    Ps, Pw = P[summer], P[winter]
    Pdry = P.min()
    Psdry, Pwdry, Pswet, Pwwet = Ps.min(), Pw.min(), Ps.max(), Pw.max()
    if MAP > 0 and Pw.sum() >= 0.7 * MAP:
        Pth = 2 * MAT
    elif MAP > 0 and Ps.sum() >= 0.7 * MAP:
        Pth = 2 * MAT + 28
    else:
        Pth = 2 * MAT + 14
    if MAP < 10 * Pth:
        return ("BW" if MAP < 5 * Pth else "BS") + ("h" if MAT >= 18 else "k")
    if Tcold >= 18:
        if Pdry >= 60:
            return "Af"
        return "Am" if Pdry >= 100 - MAP / 25 else "Aw"
    if Thot < 10:
        return "ET" if Thot > 0 else "EF"
    if Psdry < 40 and Psdry < Pwwet / 3:
        s = "s"
    elif Pwdry < Pswet / 10:
        s = "w"
    else:
        s = "f"
    if Thot >= 22:
        t = "a"
    elif Tmon10 >= 4:
        t = "b"
    elif Tcold < -38:
        t = "d"
    else:
        t = "c"
    if Tcold > 0:
        if t == "d":
            t = "c"
        return "C" + s + t
    return "D" + s + t


def noon_elevation(lat, body):
    """Highest and lowest noon solar elevation over a year (deg) at latitude lat for a body; the lowest can be
    negative (the sun stays below the horizon on that day: polar night)."""
    e, a = TILT[body], abs(float(lat))
    hi = 90.0 - max(0.0, a - e)
    lo = 90.0 - (a + e)
    return hi, lo


def earth_climate():
    s = np.load(os.path.join(ROOT, "data/predictor_stack.npz"))
    v = s["valid"]
    p = np.load(os.path.join(ROOT, "data/raw/power_climatology.npz"))
    T, P = p["T2M"][:12], p["PRECTOTCORR"][:12]
    days = np.array([31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])
    ii, jj = np.nonzero(v)
    lat = p["lats"][ii]
    codes = np.full(ii.size, 255, dtype=np.uint8)
    for k in range(ii.size):
        Tm = T[:, ii[k], jj[k]].astype(np.float64)
        Pm = P[:, ii[k], jj[k]].astype(np.float64) * days          # PRECTOTCORR is mm/day
        c = koppen(Tm, Pm, lat[k])
        if c is not None:
            codes[k] = KOPPEN.index(c)
    return codes


def environment_classes():
    lab = json.load(open(os.path.join(ROOT, "data/raw/geo/labels.json")))
    return list(lab["region_featurecla"])


def target_slope_classes():
    from src.registry import verify as V   # same grids as the baseline / registry slope
    ids = sorted({f.split(".")[0] for f in os.listdir(os.path.join(ROOT, "data/raw/phase3/terrain")) if f.endswith(".npz")}
                 | {"mars_jezero", "moon_south_pole"})
    out = {}
    for tid in ids:
        if tid in ("mars_jezero", "moon_south_pole"):
            d = np.load(os.path.join(ROOT, "data/raw/terrain_planets.npz"))
            k = "mars" if tid == "mars_jezero" else "moon"
            sl = d[k + "_slope"].astype(np.float64)
        else:
            sl = np.load(os.path.join(ROOT, f"data/raw/phase3/terrain/{tid}.npz"))["slope"].astype(np.float64)
        sl = sl[np.isfinite(sl)]
        out[tid] = {"n": int(sl.size), "frac_le": [float((sl <= t).mean()) for t in SLOPE_T],
                    "p10": float(np.percentile(sl, 10)), "p50": float(np.percentile(sl, 50)), "p90": float(np.percentile(sl, 90))}
    del V
    return out


def earth_slope_classes():
    """Share of GMTED2010 30-arc-second pixels per valid cell with Horn slope <= 5 and <= 15 deg (Phase III sub-cell
    product, data/raw/phase3/earth_subcell.npz), as uint8 = round(share * 250); 255 = missing."""
    v = np.load(os.path.join(ROOT, "data/predictor_stack.npz"))["valid"].ravel()
    d = np.load(os.path.join(ROOT, "data/raw/phase3/earth_subcell.npz"))
    out = {}
    for t in (5, 15):
        a = d[f"frac_le_{t}"].astype(np.float64)[v]
        q = np.where(np.isfinite(a) & (d["n"][v] > 0), np.round(np.clip(a, 0, 1) * 250), 255).astype(np.uint8)
        out[t] = q
    return out


def build(out_path=None):
    import base64, hashlib
    codes = earth_climate()
    sc = earth_slope_classes()
    doc = {
        "schema": "asterro.ext.context/1", "version": VERSION,
        "koppen_classes": KOPPEN,
        "koppen_b64": base64.b64encode(codes.tobytes()).decode("ascii"),
        "koppen_missing": 255,
        "koppen_counts": {KOPPEN[c]: int((codes == c).sum()) for c in range(len(KOPPEN))},
        "region_featurecla": environment_classes(),
        "earth_slope_le5_b64": base64.b64encode(sc[5].tobytes()).decode("ascii"),
        "earth_slope_le15_b64": base64.b64encode(sc[15].tobytes()).decode("ascii"),
        "earth_slope_scale": 250, "earth_slope_missing": 255,
        "tilt_deg": TILT,
        "slope_thresholds_deg": SLOPE_T,
        "target_slope": target_slope_classes(),
        "inputs": {
            "climate": "data/raw/power_climatology.npz (NASA POWER Climatology API v2.10.0, MERRA-2, 2001-2020: T2M, PRECTOTCORR)",
            "regions": "data/raw/geo/labels.json (Natural Earth 1:50m geography regions, featurecla)",
            "earth_slope": "data/raw/phase3/earth_subcell.npz (GMTED2010 mn30, 30-arc-second Horn slope per pixel, per cell)",
            "target_slope": "data/raw/terrain_planets.npz and data/raw/phase3/terrain/*.npz (MOLA 463 m / LOLA 118 m resampled to ~926 m)",
            "power_sha256": hashlib.sha256(open(os.path.join(ROOT, "data/raw/power_climatology.npz"), "rb").read()).hexdigest(),
        },
        "method": "Koeppen-Geiger after Peel et al. (2007), B tested first; summer Apr-Sep (N) / Oct-Mar (S); PRECTOTCORR mm/day x days per month.",
        "limits": "Climate class from a ~50 km reanalysis climatology: valleys, slopes and microclimates inside a cell are not resolved. "
                  "Environment type is the label of a named Natural Earth region polygon, not a mapped landform. "
                  "Illumination is geometry only (no atmosphere, no terrain shadowing).",
    }
    out_path = out_path or os.path.join(ROOT, "public/data/ext/context_ext.json")
    json.dump(doc, open(out_path, "w"), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return doc


if __name__ == "__main__":
    d = build()
    print({k: v for k, v in d["koppen_counts"].items() if v})
