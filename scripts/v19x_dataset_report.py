"""Write docs/v19x/DATASETS.md from public/data/v19/env/inventory.json and data/v19/x/build_report.json.

Every number in the report comes from those files, so the report cannot drift from the data.
    python3 scripts/v19x_dataset_report.py
"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
I = json.load(open(os.path.join(ROOT, "public/data/v19/env/inventory.json")))
R = json.load(open(os.path.join(ROOT, "data/v19/x/build_report.json")))
M = json.load(open(os.path.join(ROOT, "public/data/v19/env/cube.json")))
rows = I["rows"]
esc = lambda s: str(s if s is not None else "–").replace("|", "\\|").replace("\n", " ")
has = lambda r, s: s in r["states"]
out = ["# ASTERRO V19 data extension: dataset report", "",
       f"Generated from `public/data/v19/env/inventory.json` ({I['n']} datasets, {I['nasa']} NASA, {I['n'] - I['nasa']} from other providers) and "
       f"`data/v19/x/build_report.json`. Cube: {len(M['variables'])} variables x {M['n']} land cells, {M['bytes']:,} bytes, SHA-256 `{M['sha256'][:16]}…`.", "",
       "States are cumulative evidence: DISCOVERED → ACCESSIBLE → DOWNLOADED → VALIDATED → PROCESSED → INTEGRATED → CACHED; "
       "or BLOCKED / REQUIRES_AUTHENTICATION when nothing was downloaded.", "",
       "## Headline counts", "", "| State | Datasets |", "|---|---|"] + [f"| {k} | {v} |" for k, v in sorted(I["counts"].items(), key=lambda x: -x[1])] + [""]
sec = [("1. NASA datasets discovered (official metadata located)", lambda r: r["nasa"] and has(r, "DISCOVERED")),
       ("2. NASA datasets downloaded", lambda r: r["nasa"] and has(r, "DOWNLOADED") and not r["id"].startswith("v19_")),
       ("3. NASA datasets validated in this release", lambda r: r["nasa"] and has(r, "VALIDATED") and not r["id"].startswith("v19_")),
       ("4. NASA datasets integrated in this release", lambda r: r["nasa"] and has(r, "INTEGRATED") and not r["id"].startswith("v19_")),
       ("5. Non-NASA datasets acquired in this release", lambda r: not r["nasa"] and has(r, "DOWNLOADED") and not r["id"].startswith("v19_")),
       ("9a. Datasets that need authentication (provider metadata)", lambda r: has(r, "REQUIRES_AUTHENTICATION")),
       ("9b. Datasets blocked (every route refused)", lambda r: r["state"] == "BLOCKED")]
for title, f in sec:
    sel = [r for r in rows if f(r)]
    out += [f"## {title}: {len(sel)}", "", "| Dataset | Agency / provider | Product | Resolution | Period | State |", "|---|---|---|---|---|---|"]
    out += [f"| {esc(r.get('name'))} | {esc(r.get('agency'))}; {esc(r.get('provider'))} | {esc(r.get('product'))} | {esc(r.get('spatial'))} | {esc(r.get('period'))} | {r['state']} |" for r in sel]
    out.append("")
out += ["## Acquisition detail (this release)", ""]
for k, r in R["power"].items():
    if r.get("state") == "not_downloaded":
        out.append(f"- POWER {k}: not downloaded"); continue
    out.append(f"- POWER {k}: {r['ok']}/{r['requests']} boxes (gap-filled {r.get('gap_filled', 0)}), grid {r['grid']}, source {'+'.join(r['sources'] or [])}, units {r['units']}, "
               f"{r['land_cells_with_value']}/{r['land_cells']} land cells, {r['overlap_points']} overlap points / {r['overlap_conflicts']} conflicts, raw SHA-256 `{r['file_sha256'][:16]}…`")
for k, r in R["gibs"].items():
    out.append(f"- GIBS {k}: {r.get('images', 1)} image(s) {r.get('first', r.get('time', ''))[:7]}–{r.get('last', r.get('time', ''))[:7]}, raw SHA-256 `{(r.get('file_sha256') or '')[:16]}…`")
g = R["gvp"]; out.append(f"- GVP: {g['holocene']['features']} Holocene and {g['pleistocene']['features']} Pleistocene volcanoes; transcription cross-check {g['cross_check']['agree']}/{g['cross_check']['transcribed']}")
s = R["sites"]; out.append(f"- Sites: {s['cells']} cells; map units of the 16 earlier transcribed cells agree {s['cross_check']['map_units_agree']}/{s['cross_check']['cells_compared']}")
out.append(f"- CMR: {R['cmr']['queried']} short names queried, {R['cmr']['found']} found, {R['cmr']['requires_earthdata_login']} require an Earthdata Login")
out += ["", "## Access routes", "", "| Route | Result | Class |", "|---|---|---|"] + [f"| {esc(x['route'])} | {esc(x['result'])} | {x['class']} |" for x in I["routes"]]
out += ["", "## Cube variables", "", "| Variable | Units | Kind | Datasets | Resolution | Period | Cells with a value |", "|---|---|---|---|---|---|---|"]
for v in M["variables"]:
    out.append(f"| {v['id']} | {esc(v['units'])} | {esc(v['kind'])} | {', '.join(v['datasets'])} | {esc(v['resolution'])} | {esc(v['period'])} | {v['n_valid']} |")
os.makedirs(os.path.join(ROOT, "docs/v19x"), exist_ok=True)
open(os.path.join(ROOT, "docs/v19x/DATASETS.md"), "w").write("\n".join(out) + "\n")
print("docs/v19x/DATASETS.md", len(out), "lines")
