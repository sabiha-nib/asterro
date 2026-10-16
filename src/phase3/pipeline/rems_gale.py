"""Gale Crater / Curiosity thermal fingerprint from NASA PDS MSL REMS MODRDR data.

Archive : PDS Atmospheres Node, MSL REMS volume mslrem_1001 (MODRDR, MODRDR6.FMT)
          https://pds-atmospheres.nmsu.edu/PDS/data/mslrem_1001/DATA/SOL_xxxxx_yyyyy/SOLnnnnn/RME_*RMD*.TAB
Columns : 3 LTST ("SSSSS HH:MM:SS"), 8 BRIGHTNESS_TEMP (GTS ground, K),
          9 BRIGHTNESS_TEMP_LONG_TERM_UNCERTAINTY (K), 11 GTS_CONFIDENCE_LEVEL (bytes 0-3:
          ASIC power in range, recalibration quality, rover still, no shadow in FOV),
          16 AMBIENT_TEMP (estimated ambient air temperature, K), 17 AMBIENT_TEMP_CONFIDENCE_LEVEL
          (bytes 0-8; byte 7 = error within 5 K operational range, byte 8 = reliable).
Ls      : not in the MODRDR label. Computed from the label START_TIME/STOP_TIME midpoint with the
          Mars24 algorithm (Allison & McEwen 2000, Planet. Space Sci. 48, 215; NASA GISS Mars24
          "Technical notes"). Unit test: 2000-01-06T00:00 UTC -> Ls = 277.18758 deg (published example).
Sampling: every second available sol of the first Mars year of the mission (sols 1-669).

Method  : IDENTICAL to the Jezero baseline (src/data/ingestion/mars_meda.py :: aggregate, imported
          unchanged): per sol, 24 LTST hour bins; lst_diurnal_range_K = mean over 12 Ls bins of
          [T_ground(13-14 LTST) - T_ground(01-02 LTST)]; annual_temperature_range_K = max - min over
          12 Ls bins of the diurnal-mean air temperature.
Filters : ground (primary, mirrors MEDA "not in shadow & rover still"): GTS bytes 2 and 3 == '1'.
          ground (strict sensitivity variant): GTS bytes 0-3 all '1'.
          air (primary): AMBIENT_TEMP valid and confidence bytes 7 and 8 == '1'.
          air (strict sensitivity variant): bytes 0,1,2,7,8 == '1'.
Differences from Jezero (recorded, not hidden): REMS GTS vs MEDA TIRS ground sensors; REMS boom
ambient estimate (~1.6 m) vs MEDA ATS median (~1.45 m); MSL Mars year 31-32 vs M2020 Mars year 36.
"""
import concurrent.futures as cf, json, math, os, re, sys, time
from datetime import datetime, timezone
import numpy as np, requests

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
BASE = "https://pds-atmospheres.nmsu.edu/PDS/data/mslrem_1001/DATA/"

# ------------------------------------------------------------------ Mars24 solar longitude
_PBS = [(0.0071, 2.2353, 49.409), (0.0057, 2.7543, 168.173), (0.0039, 1.1177, 191.837),
        (0.0037, 15.7866, 21.736), (0.0021, 2.1354, 15.704), (0.0020, 2.4694, 95.528),
        (0.0018, 32.8493, 49.095)]
_LEAP = [(datetime(1999, 1, 1, tzinfo=timezone.utc), 32), (datetime(2006, 1, 1, tzinfo=timezone.utc), 33),
         (datetime(2009, 1, 1, tzinfo=timezone.utc), 34), (datetime(2012, 7, 1, tzinfo=timezone.utc), 35),
         (datetime(2015, 7, 1, tzinfo=timezone.utc), 36), (datetime(2017, 1, 1, tzinfo=timezone.utc), 37)]


def mars_ls(dt_utc):
    leap = max(v for d, v in _LEAP if d <= dt_utc)
    jd_tt = dt_utc.timestamp() / 86400.0 + 2440587.5 + (32.184 + leap) / 86400.0
    d = jd_tt - 2451545.0
    M = math.radians(19.3871 + 0.52402073 * d)
    alpha = 270.3871 + 0.524038496 * d
    pbs = sum(A * math.cos(math.radians(0.985626 * d / tau + phi)) for A, tau, phi in _PBS)
    nu_m = ((10.691 + 3.0e-7 * d) * math.sin(M) + 0.623 * math.sin(2 * M) + 0.050 * math.sin(3 * M)
            + 0.005 * math.sin(4 * M) + 0.0005 * math.sin(5 * M) + pbs)
    return (alpha + nu_m) % 360.0


def _t(s):
    return datetime.strptime(s[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)


def get(url, binary=False):
    for k in range(6):
        try:
            r = requests.get(url, timeout=180)
            if r.status_code == 200:
                return r.content if binary else r.text
            if r.status_code == 404:
                return None
        except Exception:
            pass
        time.sleep(2 + 3 * k)
    return None


def sol_index():
    top = get(BASE)
    groups = sorted(set(re.findall(r'href="(SOL_\d{5}_\d{5})/"', top)))
    idx = {}
    for g in groups:
        lo, hi = map(int, g[4:].split("_"))
        if lo > 700:
            break
        for s in re.findall(r'href="SOL(\d{5})/"', get(BASE + g + "/") or ""):
            idx[int(s)] = f"{BASE}{g}/SOL{s}/"
    return idx


def process(sol, url, cache):
    fn = f"{cache}/sol_{sol:05d}.json"
    if os.path.exists(fn):
        return json.load(open(fn))
    listing = get(url) or ""
    tabs = sorted(re.findall(r'href="(RME_\d+RMD\d+_+P\w+\.TAB)"', listing))
    out = dict(sol=sol, url=url, tab=tabs[-1] if tabs else None)
    if not tabs:
        json.dump(out, open(fn, "w")); return out
    lab = get(url + out["tab"][:-4] + ".LBL") or ""
    a = re.search(r"START_TIME\s*=\s*(\S+)", lab); b = re.search(r"STOP_TIME\s*=\s*(\S+)", lab)
    if a and b:
        t0, t1 = _t(a.group(1)), _t(b.group(1))
        mid = t0 + (t1 - t0) / 2
        out.update(start=a.group(1), stop=b.group(1), ls=mars_ls(mid), ls_start=mars_ls(t0), ls_stop=mars_ls(t1))
    raw = get(url + out["tab"], binary=True)
    if raw is None:
        json.dump(out, open(fn, "w")); return out
    import hashlib
    out["tab_sha256"] = hashlib.sha256(raw).hexdigest(); out["tab_bytes"] = len(raw)
    acc = {k: (np.zeros(24), np.zeros(24)) for k in ("ground", "ground_strict", "air", "air_strict", "unc")}
    rows = 0
    for line in raw.decode("ascii", "replace").splitlines():
        f = line.split(",")
        if len(f) < 17:
            continue
        rows += 1
        try:
            h = int(f[2].strip().strip('"')[6:8]) % 24
        except ValueError:
            continue
        bt = float(f[7]); gc = f[10].strip().strip('"').strip()
        if bt > -998 and len(gc) == 4:
            if gc[2] == "1" and gc[3] == "1":
                acc["ground"][0][h] += bt; acc["ground"][1][h] += 1
                u = float(f[8])
                if u > -998:
                    acc["unc"][0][h] += u; acc["unc"][1][h] += 1
            if gc == "1111":
                acc["ground_strict"][0][h] += bt; acc["ground_strict"][1][h] += 1
        at = float(f[15]); ac = f[16].strip().strip('"').strip()
        if at > -998 and len(ac) == 9:
            if ac[7] == "1" and ac[8] == "1":
                acc["air"][0][h] += at; acc["air"][1][h] += 1
            if all(ac[i] == "1" for i in (0, 1, 2, 7, 8)):
                acc["air_strict"][0][h] += at; acc["air_strict"][1][h] += 1
    out["rows"] = rows
    for k, (s, n) in acc.items():
        out[f"{k}_sum"], out[f"{k}_n"] = s.tolist(), n.tolist()
    json.dump(out, open(fn, "w"))
    return out


def variant(sols, g, a):
    """Map a filter variant onto the keys expected by the unchanged baseline aggregate()."""
    res = []
    for o in sols:
        if o.get("ls") is None or f"{g}_n" not in o:
            continue
        res.append(dict(sol=o["sol"], ls=o["ls"], ground_sum=o[f"{g}_sum"], ground_n=o[f"{g}_n"],
                        air_sum=o[f"{a}_sum"], air_n=o[f"{a}_n"]))
    return res


def main(out, budget_s="780"):
    cache = f"{out}/rems"; os.makedirs(cache, exist_ok=True)
    assert abs(mars_ls(datetime(2000, 1, 6, tzinfo=timezone.utc)) - 277.18758) < 0.01, mars_ls(datetime(2000, 1, 6, tzinfo=timezone.utc))
    ifn = f"{out}/rems_index.json"
    idx = {int(k): v for k, v in json.load(open(ifn)).items()} if os.path.exists(ifn) else sol_index()
    json.dump(idx, open(ifn, "w"))
    avail = sorted(s for s in idx if 1 <= s <= 669)
    chosen = avail[::2]
    t0 = time.time(); done = []
    with cf.ThreadPoolExecutor(6) as ex:
        futs = {}
        for s in chosen:
            futs[ex.submit(process, s, idx[s], cache)] = s
        for f in cf.as_completed(futs):
            try:
                done.append(f.result())
            except Exception as e:
                print("sol", futs[f], repr(e), flush=True)
            if time.time() - t0 > float(budget_s):
                print("budget reached; rerun to resume", flush=True)
                ex.shutdown(wait=False, cancel_futures=True)
                break
    sols = [json.load(open(f"{cache}/{f}")) for f in sorted(os.listdir(cache))]
    print("sols cached", len(sols), "of", len(chosen), flush=True)
    if len(sols) < len(chosen):
        return
    import mars_meda                 # unchanged baseline module (aggregate)
    result = dict(
        primary=mars_meda.aggregate(variant(sols, "ground", "air")),
        strict=mars_meda.aggregate(variant(sols, "ground_strict", "air_strict")),
        sols_requested=len(chosen), sols_with_data=sum(1 for o in sols if o.get("rows")),
        sols_available_in_year=len(avail), sol_range=[chosen[0], chosen[-1]],
        ls_check=dict(curiosity_landing=mars_ls(datetime(2012, 8, 6, 5, 17, 57, tzinfo=timezone.utc)),
                      published_landing_ls=150.6, mars24_example=mars_ls(datetime(2000, 1, 6, tzinfo=timezone.utc))),
        ground_uncertainty_K_mean_hours_13_and_1=None,
        source=BASE, retrieved_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    us = np.zeros(24); un = np.zeros(24)
    for o in sols:
        if "unc_n" in o:
            us += np.array(o["unc_sum"]); un += np.array(o["unc_n"])
    result["ground_uncertainty_K_mean_hours_13_and_1"] = [float(us[13] / un[13]) if un[13] else None,
                                                          float(us[1] / un[1]) if un[1] else None]
    result["tab_sha256"] = {str(o["sol"]): o.get("tab_sha256") for o in sols}
    json.dump(result, open(f"{out}/rems_gale.json", "w"), indent=1)
    print(json.dumps({k: result[k] for k in ("sols_requested", "sols_with_data", "ls_check")}, indent=1))
    for k in ("primary", "strict"):
        r = result[k]
        print(k, r["lst_diurnal_range_K"], r["lst_bins_used"], r["annual_temperature_range_K"], r["air_bins_used"])


if __name__ == "__main__":
    main(*sys.argv[1:])
