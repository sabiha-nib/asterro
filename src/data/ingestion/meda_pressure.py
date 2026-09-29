"""MEDA PS surface pressure context (calibrated data), 24 sols spread over one Mars year.
Per record the pressure of the active transducer (column TRANSDUCER -> BAROCAP<n>_PRESSURE) is used."""
import re, io, json, numpy as np, pandas as pd, importlib.util
spec = importlib.util.spec_from_file_location("m", "mars_meda_v2.py"); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
out = []
for sol in range(20, 677, 28):
    d = m.sol_dir("data_calibrated_env", sol); lst = m.get(d) or ""
    f = re.findall(r'href="(WE__\d{4}_+CAL_PS_+P\d+\.CSV)"', lst)
    if not f: continue
    df = pd.read_csv(io.StringIO(m.get(d + sorted(f)[-1])))
    t = df["TRANSDUCER"].astype("Int64")
    p = pd.Series(np.nan, index=df.index)
    for n in (1, 2, 3):
        p = p.where(t != n, df[f"BAROCAP{n}_PRESSURE"])
    out.append(dict(sol=sol, file=sorted(f)[-1], median_Pa=float(p.median()), n=int(p.notna().sum())))
json.dump(out, open("meda_pressure.json", "w"), indent=1)
v = [o["median_Pa"] for o in out]
print("PRESSURE_SUMMARY", json.dumps(dict(sols=len(v), min_Pa=min(v), max_Pa=max(v), median_Pa=float(np.median(v)))))
