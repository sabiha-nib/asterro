"""Jezero Crater thermal fingerprint from NASA PDS Mars 2020 MEDA calibrated data.

Archive : PDS Atmospheres Node, urn:nasa:pds:mars2020_meda
          https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/
Files   : data_calibrated_env/.../WE__<sol>___CAL_TIRS___*.CSV  (GROUND_TEMP, K)
          data_calibrated_env/.../WE__<sol>___CAL_ATS___*.CSV   (ATS_LOCAL_TEMP1..3, K;
                                                                 RSM mast units, ~1.45 m)
          Solar longitude Ls: PDS4 label fields mars2020:start_solar_longitude /
          stop_solar_longitude of the CAL_TIRS product (mean of the two, wrap-safe).
          NOTE: the ANCILLARY column SOLAR_LONGITUDE_ANGLE is a solar-position angle, NOT Ls.
Sampling: every 2nd sol from 8 to 676 (one Mars year, 335 sols).

Per sol, values are averaged into 24 Local-True-Solar-Time hour bins.
  Ground : TIRS GROUND_TEMP where TIRS_GROUND_FOOTPRINT_NOT_IN_SHADOW == 1 and ROVER_STILL == 1
  Air    : median of ATS_LOCAL_TEMP1..3 (the three RSM-mounted sensors) per record
Derived target quantities (computed in aggregate(), mirrored in data/targets.json):
  lst_diurnal_range_K : mean over 12 Ls bins (30 deg) of [T_ground(13-14 LTST) - T_ground(01-02 LTST)]
                        -> same local times as MODIS Aqua day/night overpasses (13:30 / 01:30)
  annual_temperature_range_K : max - min over 12 Ls bins of the diurnal-mean air temperature,
                        where each bin's diurnal mean = mean of its 24 hourly composite means
                        -> analogue of Earth's warmest-month minus coldest-month T2M
"""
import csv, io, json, re, sys, time, concurrent.futures as cf
import numpy as np, requests

BASE = "https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/"
SOLS = list(range(8, 677, 2))


def sol_dir(kind, sol):
    lo = [0, 90, 180, 300, 420, 540, 660, 780]
    hi = [89, 179, 299, 419, 539, 659, 779, 899]
    k = max(i for i, v in enumerate(lo) if v <= sol)
    return f"{BASE}{kind}/sol_{lo[k]:04d}_{hi[k]:04d}/sol_{sol:04d}/"


def get(url, **kw):
    for k in range(6):
        try:
            r = requests.get(url, timeout=120, **kw)
            if r.status_code in (200, 206):
                return r.text
            if r.status_code == 404:
                return None
        except Exception:
            pass
        time.sleep(2 + 3 * k)
    return None


def find(listing, key):
    m = re.findall(r'href="(WE__\d{4}_+' + key + r'_+P\d+\.CSV)"', listing or "")
    return sorted(m)[-1] if m else None


def ltst_hours(col):
    # "0089 23:53:41" -> integer LTST hour-of-sol (0..23)
    return col.str.slice(5, 7).astype(int) % 24


def hourly(df, values):
    ok = values.notna()
    h = ltst_hours(df.loc[ok, "LTST"])
    v = values[ok].to_numpy(float)
    s = np.bincount(h, weights=v, minlength=24)[:24]
    n = np.bincount(h, minlength=24)[:24].astype(float)
    return s, n


def process(sol):
    import pandas as pd
    cal = sol_dir("data_calibrated_env", sol)
    lc = get(cal)
    ft, fa = find(lc, "CAL_TIRS"), find(lc, "CAL_ATS")
    out = dict(sol=sol, tirs=ft, ats=fa)
    if ft:
        lab = get(cal + ft[:-4] + ".xml") or ""
        a = re.search(r"start_solar_longitude[^>]*>([-\d.]+)<", lab)
        b = re.search(r"stop_solar_longitude[^>]*>([-\d.]+)<", lab)
        if a and b:
            l0, l1 = float(a.group(1)), float(b.group(1))
            if l1 < l0:
                l1 += 360.0
            out["ls"] = ((l0 + l1) / 2) % 360.0
    if ft:
        txt = get(cal + ft)
        if txt:
            df = pd.read_csv(io.StringIO(txt), dtype={"LTST": str})
            good = (df["TIRS_GROUND_FOOTPRINT_NOT_IN_SHADOW"] == 1) & (df["ROVER_STILL"] == 1)
            s, n = hourly(df, df["GROUND_TEMP"].where(good))
            out["ground_sum"], out["ground_n"] = s.tolist(), n.tolist()
    if fa:
        txt = get(cal + fa)
        if txt:
            df = pd.read_csv(io.StringIO(txt), dtype={"LTST": str})
            m = df[["ATS_LOCAL_TEMP1", "ATS_LOCAL_TEMP2", "ATS_LOCAL_TEMP3"]]
            med = m.median(axis=1).where(m.notna().all(axis=1))   # all three RSM sensors required
            s, n = hourly(df, med)
            out["air_sum"], out["air_n"] = s.tolist(), n.tolist()
    return out


def aggregate(sols):
    bins = {b: dict(g=[], a_s=np.zeros(24), a_n=np.zeros(24), sols=0) for b in range(12)}
    for o in sols:
        if o.get("ls") is None:
            continue
        b = int(o["ls"] // 30) % 12
        bins[b]["sols"] += 1
        if "ground_n" in o:
            gs, gn = np.array(o["ground_sum"]), np.array(o["ground_n"])
            if gn[13] > 0 and gn[1] > 0:
                bins[b]["g"].append(gs[13] / gn[13] - gs[1] / gn[1])
        if "air_n" in o:
            asum, an = np.array(o["air_sum"]), np.array(o["air_n"])
            ok = an > 0
            bins[b]["a_s"][ok] += asum[ok] / an[ok]      # per-sol hourly mean, equal weight per sol
            bins[b]["a_n"][ok] += 1
    table = []
    for b in range(12):
        B = bins[b]
        hourly_air = np.where(B["a_n"] > 0, B["a_s"] / np.maximum(B["a_n"], 1), np.nan)
        table.append(dict(ls_bin=[30 * b, 30 * b + 30], sols=B["sols"],
                          ground_dr_sols=len(B["g"]),
                          ground_dr_K=float(np.mean(B["g"])) if B["g"] else None,
                          air_hours_covered=int(np.isfinite(hourly_air).sum()),
                          air_diurnal_mean_K=float(np.nanmean(hourly_air)) if np.isfinite(hourly_air).sum() == 24 else None))
    gdr = [t["ground_dr_K"] for t in table if t["ground_dr_K"] is not None]
    air = [t["air_diurnal_mean_K"] for t in table if t["air_diurnal_mean_K"] is not None]
    return dict(bins=table,
                lst_diurnal_range_K=float(np.mean(gdr)) if gdr else None, lst_bins_used=len(gdr),
                annual_temperature_range_K=float(max(air) - min(air)) if len(air) == 12 else None,
                air_bins_used=len(air), air_bin_min_K=min(air) if air else None, air_bin_max_K=max(air) if air else None)


def fix_ls(res):
    """Re-derive Ls from PDS4 labels for an existing per-sol result list (no data re-download)."""
    def one(o):
        if not o.get("tirs"):
            return o
        lab = get(sol_dir("data_calibrated_env", o["sol"]) + o["tirs"][:-4] + ".xml") or ""
        a = re.search(r"start_solar_longitude[^>]*>([-\d.]+)<", lab)
        b = re.search(r"stop_solar_longitude[^>]*>([-\d.]+)<", lab)
        o = dict(o); o.pop("anc", None); o.pop("ls", None)
        if a and b:
            l0, l1 = float(a.group(1)), float(b.group(1))
            if l1 < l0:
                l1 += 360.0
            o["ls"] = ((l0 + l1) / 2) % 360.0
        return o
    with cf.ThreadPoolExecutor(12) as ex:
        return list(ex.map(one, res))


def main(out="mars_meda.json", reaggregate_from=None):
    if reaggregate_from:
        d = json.load(open(reaggregate_from))
        res = fix_ls(d["per_sol"])
        summary = aggregate(res)
        json.dump(dict(source=BASE, sols=SOLS, per_sol=res, summary=summary,
                       retrieved_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())), open(out, "w"))
        print(json.dumps(summary, indent=1))
        return
    with cf.ThreadPoolExecutor(12) as ex:
        res = []
        for i, o in enumerate(ex.map(process, SOLS)):
            res.append(o)
            if i % 25 == 0:
                print(i, len(SOLS), o.get("ls"), flush=True)
    summary = aggregate(res)
    json.dump(dict(source=BASE, sols=SOLS, per_sol=res, summary=summary,
                   retrieved_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())), open(out, "w"))
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main(*sys.argv[1:])
