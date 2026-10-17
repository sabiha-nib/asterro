"""Phase IV UI walk-through (Playwright/Chromium).

    python tests/phase4/ui_phase4_smoke.py [outdir]

Checks: the hierarchical atlas (tree keyboard navigation, alias search combobox, region/list/table modes,
filters, L1 (catalogued) quick actions disabled with reasons, favourites persisting across reloads), the Explore quick-switch
for readiness >= 3 registry targets (ranges, Python reproduction of an exported record, legacy targets unchanged
bit for bit, Phase II Lab notice), the Comparison Lab (aggregates, blocking, legacy regression), the Validation
workspace (refusals, withheld metrics), the Mismatch Explorer, the Readiness & Provenance export, collections
(export / import / conflict), offline start from the service-worker cache, an in-page accessibility audit
(accessible names, alt text, roles, duplicate ids, text contrast) and no horizontal overflow at 390 px.
"""
import json, os, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_p4_shots"
os.makedirs(OUT, exist_ok=True)
PORT = 8793
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
errors, res, fails = [], {}, []


def nav(pg, v):
    """Open module v through the two-level module bar (group first, then the module)."""
    if not pg.query_selector(f".p4-g2 [data-a3view={v}]"):
        g = pg.evaluate(f"(A4_GROUPS.find(g => g.items.some(i => i[0] === '{v}')) || A4_GROUPS[0]).items[0][0]")
        pg.click(f".p4-g1 [data-a3view={g}]"); time.sleep(0.3)
    pg.click(f".p4-g2 [data-a3view={v}]")


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


AUDIT = r"""() => {
  const out = { unnamed: [], noalt: [], svgNoLabel: [], dupIds: [], posTab: [], lowContrast: [] };
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const name = e => (e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") && document.getElementById(e.getAttribute("aria-labelledby").split(" ")[0])?.textContent || e.textContent || e.getAttribute("title") || e.value || "").trim()
    || (e.id && document.querySelector(`label[for="${e.id}"]`)?.textContent.trim()) || (e.closest("label")?.textContent.trim()) || "";
  for (const e of document.querySelectorAll("#left button, #left a, #left input, #left select, #left textarea, #left [role=button], #left [role=treeitem], .tc-atlas select")) if (vis(e) && !name(e)) out.unnamed.push(e.outerHTML.slice(0, 90));
  for (const e of document.querySelectorAll("#left img")) if (!e.hasAttribute("alt")) out.noalt.push(e.outerHTML.slice(0, 90));
  for (const e of document.querySelectorAll("#left svg[role=img]")) if (!e.getAttribute("aria-label") && !e.getAttribute("aria-labelledby")) out.svgNoLabel.push(e.outerHTML.slice(0, 60));
  const ids = {}; for (const e of document.querySelectorAll("[id]")) ids[e.id] = (ids[e.id] || 0) + 1;
  out.dupIds = Object.entries(ids).filter(([, n]) => n > 1).map(([k]) => k);
  for (const e of document.querySelectorAll("#left [tabindex]")) if (+e.getAttribute("tabindex") > 0) out.posTab.push(e.outerHTML.slice(0, 60));
  const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = e => { for (let n = e; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c; } return [9, 11, 14]; };
  const seen = new Set();
  for (const e of document.querySelectorAll("#left [data-p4] *")) {
    if (!vis(e) || e.closest("svg") || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(e); if (e.closest("[disabled]") || e.closest(".p4-radio.off")) continue;
    const fg = rgb(s.color), bg = bgOf(e), L1 = lum(fg), L2 = lum(bg), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const big = parseFloat(s.fontSize) >= 18.66 || (parseFloat(s.fontSize) >= 14 && +s.fontWeight >= 700);
    if (cr < (big ? 3 : 4.5)) { const k = s.color + "|" + e.className; if (!seen.has(k)) { seen.add(k); out.lowContrast.push(`${cr.toFixed(2)} ${s.color} on rgb(${bg.slice(0, 3)}) <${e.tagName.toLowerCase()} class="${e.className}">${e.textContent.trim().slice(0, 30)}`); } }
  }
  return out;
}"""

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = b.new_context(viewport={"width": 1512, "height": 900}, accept_downloads=True)
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errors.append("console." + m.type + ": " + m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text and "fonts" not in m.text and "ERR_INTERNET_DISCONNECTED" not in m.text else None)
        pg.goto(URL)
        pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=90000)
        pg.wait_for_function("typeof A4X !== 'undefined' && A4X.ids.length > 0", timeout=60000)
        check(pg.evaluate("A4X.ids.length") == 14 and pg.evaluate("Object.keys(A4X.rejected).length") == 0, "Explore: 14 readiness >= 3 registry targets registered (registry ranges = browser recomputation)")
        check(pg.query_selector("#hero-atlas") is not None and pg.query_selector("#tc-atlas select") is not None, "landing CTA and target quick-switch present")
        pg.screenshot(path=f"{OUT}/p4_00_hero.png")
        # ---------------------------------------------------------------- baseline result (legacy) before anything else
        pg.click("#hero-search"); time.sleep(6.5)
        base = pg.evaluate("({t: S.targetId, eff: Array.from(S.res.eff), ranges: JSON.stringify(S.ranges), top: Array.from(S.res.distinct)})")
        check(base["ranges"] == pg.evaluate("JSON.stringify(S.app.ranges)"), "Jezero runs with the legacy normalisation table")
        # ---------------------------------------------------------------- Explore quick-switch to a registry target
        pg.select_option("#tc-atlas-sel", "moon_shackleton"); time.sleep(2.5)
        st = pg.evaluate("({t: S.targetId, r: JSON.stringify(S.ranges), want: JSON.stringify(A4.ix.targets.moon_shackleton.scoring.explore_ranges), top: placeStr(S.res.distinct[0]), body: document.querySelector('#app').dataset.body4})")
        check(st["t"] == "moon_shackleton" and st["r"] == st["want"] and st["body"] == "moon", f"Explore on Shackleton under explore-target-v1 ranges (#1 {st['top']})")
        pg.screenshot(path=f"{OUT}/p4_01_explore_shackleton.png")
        pg.evaluate("select(S.res.distinct[0], false)"); time.sleep(0.6)
        cfg = pg.evaluate("reproConfig(S.res.distinct[0])")
        check(cfg["scoring_config"] == "explore-target-v1" and cfg.get("target_fingerprint_sha256") and "reproduce_registry" in cfg["reproduce_with"], "reproduce record names its scoring configuration and fingerprint hash")
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(cfg, f); rp = f.name
        r = subprocess.run([sys.executable, "-m", "scripts.reproduce_registry", rp, "--repo", ROOT], cwd=ROOT, capture_output=True, text=True)
        check(r.returncode == 0, "Python reference engine reproduces the Shackleton Explore record: " + " | ".join(l for l in r.stdout.splitlines() if l.startswith("[")))
        pg.click("#tab-lab"); time.sleep(1.0)
        check("defined for the legacy targets" in pg.inner_text("#left"), "Phase II Lab shows a notice (not mismatched results) for a registry target")
        pg.click("#p4-lab-legacy"); time.sleep(2.5)
        back = pg.evaluate("({t: S.targetId, eff: Array.from(S.res.eff), ranges: JSON.stringify(S.ranges), top: Array.from(S.res.distinct)})")
        check(back["t"] == "mars_jezero" and back["ranges"] == base["ranges"] and back["eff"] == base["eff"] and back["top"] == base["top"], "back on Jezero: field, ranges and distinct sites bit-identical to before")
        pg.click("[data-target=cross]"); time.sleep(2.5)
        cross = pg.evaluate("({r: JSON.stringify(S.ranges), n: S.res.nElig, top: placeStr(S.res.distinct[0])})")
        check(cross["r"] == base["ranges"], f"cross-planet runs with the legacy table (#1 {cross['top']})")
        pg.click("[data-target=mars_jezero]"); time.sleep(1.5)
        # ---------------------------------------------------------------- atlas home
        pg.click("#tab-atlas"); pg.wait_for_selector(".p4-tree", timeout=30000); time.sleep(0.6)
        pg.screenshot(path=f"{OUT}/p4_02_atlas_home.png")
        pg.fill("#a4q", "Gale Crater"); time.sleep(0.4)
        hits = pg.eval_on_selector_all("#a4sr [role=option]", "x => x.map(o => o.textContent)")
        check(bool(hits) and hits[0].startswith("Gale"), "search: alias 'Gale Crater' → Gale first")
        pg.screenshot(path=f"{OUT}/p4_03_search.png")
        pg.fill("#a4q", "schrod"); time.sleep(0.3); pg.press("#a4q", "Enter"); time.sleep(0.8)
        check(pg.evaluate("A4.loc") == "moon:schrodinger" and pg.evaluate("A4.body") == "moon", "search: 'schrod' + Enter opens Schrödinger (Moon)")
        # keyboard tree
        pg.focus(".p4-tree [role=treeitem][tabindex='0']"); pg.keyboard.press("Home"); pg.keyboard.press("ArrowRight"); time.sleep(0.4)
        pg.keyboard.press("ArrowDown"); pg.keyboard.press("Enter"); time.sleep(0.6)
        sel = pg.evaluate("A4.loc")
        check(sel and sel.startswith("moon:") and pg.evaluate("document.activeElement.getAttribute('role')") == "treeitem", f"tree: Home → expand → down → Enter selects {sel}; focus stays in the tree")
        # L1 catalogued location: actions disabled with reasons
        l0 = pg.evaluate("A4.reg.locations.find(l => l.body === 'moon' && !l.target_ids.length).id")
        pg.evaluate(f"a4SyncFromLocation('{l0}'); atRender()"); time.sleep(0.5)
        dis = pg.eval_on_selector_all(".p4-qa button[disabled]", "x => x.length")
        why = pg.eval_on_selector_all("[id^=qa-]", "x => x.length")
        check(dis == 5 and why == 5, f"L1 catalogued location {l0}: 5 analytical actions disabled, 5 reasons shown")
        pg.screenshot(path=f"{OUT}/p4_04_l0_summary.png", full_page=False)
        pg.click("[data-a4=fav]"); time.sleep(0.3)
        for m in ("regions", "list", "table"):
            pg.click(f"[data-a4=mode][data-m={m}]"); time.sleep(0.6); pg.screenshot(path=f"{OUT}/p4_05_{m}.png")
        pg.select_option("[data-a4in=region]", ""); time.sleep(0.4)       # the selected location set a region filter; clear it
        pg.select_option("[data-a4in=level]", "4"); time.sleep(0.5)
        n4 = pg.eval_on_selector_all(".p4-tbl tbody tr", "x => x.length")
        check(n4 == 14, f"table: Moon readiness filter L4 → {n4} rows")
        pg.select_option("[data-a4in=level]", ""); time.sleep(0.3)
        pg.click("[data-a4=sort][data-k=latitude]"); time.sleep(0.3)
        lats = pg.eval_on_selector_all(".p4-tbl tbody tr td:nth-child(4)", "x => x.map(t => +t.textContent)")
        check(lats == sorted(lats, reverse=True), "table: sort by latitude (N→S)")
        # favourites persist across reload
        pg.reload(); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=90000)
        check(l0 in pg.evaluate("A4P.fav"), "favourite persisted across reload (browser storage)")
        pg.click("#hero-atlas"); pg.wait_for_selector(".p4-tree", timeout=60000); time.sleep(6.5)
        a1 = pg.evaluate(AUDIT)
        # ---------------------------------------------------------------- comparison lab
        nav(pg, 'lab4'); time.sleep(0.8)
        pg.click("[data-a4=aggrun]"); time.sleep(2.0)
        check(pg.evaluate("document.querySelector('[data-p4]').textContent.includes('Earth cell')") and pg.evaluate("A4.aggRes.ok && A4.aggRes.plan.criteria.length") == 3, "Comparison Lab: minimum over the 3 shared DIRECT criteria (Gale × Shackleton)")
        pg.screenshot(path=f"{OUT}/p4_06_lab_min.png", full_page=True)
        pg.check("input[name=a4agg][value=pareto]"); time.sleep(0.4); pg.click("[data-a4=aggrun]"); time.sleep(2.5)
        check(pg.evaluate("A4.aggRes.front.length") > 0, f"Pareto set computed ({pg.evaluate('A4.aggRes.front.length')} cells)")
        pg.click("[data-a4=legacy]"); time.sleep(3.0)
        check(pg.evaluate("A4.legacyCheck.diffs === 0 && A4.legacyCheck.sameTop"), "legacy cross-planet regression in the browser: IDENTICAL")
        pg.evaluate("A4.cmp = ['mars_elysium_planitia', 'moon_reiner_gamma']; A4.agg = 'mean'; atRender()"); time.sleep(0.4)
        check(pg.evaluate("RG.aggregatePlan(A4.ix, A4.cmp, 'mean', S.critIds).ok") and pg.is_enabled("[data-a4=aggrun]"), "terrain-only targets: mean allowed on shared DIRECT terrain criteria")
        a2 = pg.evaluate(AUDIT)
        # ---------------------------------------------------------------- validation
        nav(pg, 'validation'); time.sleep(0.6)
        pg.fill("[data-a4form=case] [name=name]", "test site"); pg.fill("[data-a4form=case] [name=lat]", "-22.5"); pg.fill("[data-a4form=case] [name=lon]", "-67.5")
        pg.fill("[data-a4form=case] [name=citation]", " "); pg.click("[data-a4form=case] button[type=submit]"); time.sleep(0.4)
        check(pg.evaluate("A4.val.msg && !A4.val.msg.ok"), "uncited case refused")
        pg.fill("[data-a4form=case] [name=name]", "ocean"); pg.fill("[data-a4form=case] [name=lat]", "0"); pg.fill("[data-a4form=case] [name=lon]", "-140"); pg.fill("[data-a4form=case] [name=citation]", "smoke test input")
        pg.click("[data-a4form=case] button[type=submit]"); time.sleep(0.4)
        check("not on a valid Earth land cell" in pg.evaluate("A4.val.msg.text"), "ocean coordinate refused")
        pg.fill("[data-a4form=case] [name=name]", "smoke-test input (not a reference case)"); pg.fill("[data-a4form=case] [name=lat]", "-22.5"); pg.fill("[data-a4form=case] [name=lon]", "-67.5"); pg.fill("[data-a4form=case] [name=citation]", "UI smoke test input — not a citation")
        pg.click("[data-a4form=case] button[type=submit]"); time.sleep(0.4)
        pg.click("[data-a4=valrun]"); time.sleep(1.5)
        txt = pg.inner_text("[data-p4]")
        check("withheld" in txt and "Recall@k needs" in txt and "Holdout" in txt, "1 case: rank shown; Recall/Precision withheld with the reason; holdout declared not meaningful")
        pg.screenshot(path=f"{OUT}/p4_07_validation.png", full_page=True)
        pg.click("[data-a4=caserm][data-k='0']"); time.sleep(0.3)
        # ---------------------------------------------------------------- mismatch explorer
        nav(pg, 'mmx'); time.sleep(1.5)
        cls = pg.eval_on_selector_all("[data-p4] table:first-of-type tbody tr td:nth-child(7)", "x => x.map(t => t.textContent.trim())")
        check(len(cls) == 6 and "proxy excluded" in cls, f"Mismatch Explorer: 6 classified criteria ({', '.join(cls)})")
        pg.screenshot(path=f"{OUT}/p4_08_mismatch.png", full_page=True)
        a3 = pg.evaluate(AUDIT)
        # ---------------------------------------------------------------- readiness & provenance
        nav(pg, 'readiness'); time.sleep(0.8)
        pg.select_option("[data-a4in=provl]", "2"); time.sleep(0.4)
        with pg.expect_download() as d:
            pg.click("[data-a4=provexp]")
        exp = json.load(open(d.value.path()))
        check(exp["schema"] == "asterro.provenance-export/1" and len(exp["targets"]) == 17 and all(t["readiness"]["level"] == 2 for t in exp["targets"]), "provenance export (L2): 17 targets, machine-readable")
        pg.screenshot(path=f"{OUT}/p4_09_readiness.png", full_page=True)
        a4 = pg.evaluate(AUDIT)
        # ---------------------------------------------------------------- collections
        nav(pg, 'home'); time.sleep(0.4)
        pg.evaluate("a4SyncFromLocation('moon:shackleton'); A4.mode='browse'; atRender()"); time.sleep(0.4)
        pg.click("[data-a4=qa][data-q=collection]"); time.sleep(0.5)
        pg.fill("[data-a4form=col] [name=name]", "Polar windows"); pg.click("[data-a4form=col] button[type=submit]"); time.sleep(0.4)
        with pg.expect_download() as d:
            pg.click("[data-a4=colexp]")
        doc = json.load(open(d.value.path()))
        check(doc["schema"] == "asterro.collections/1" and doc["collections"][0]["items"][0]["id"] == "moon:shackleton", "collection created with the pending location and exported")
        doc["collections"][0]["name"] = "Changed elsewhere"
        bad = dict(doc, collections=[dict(doc["collections"][0], id="x2", items=[{"kind": "target", "id": "no_such_target"}])])
        for nm, content in (("conflict.json", doc), ("bad.json", bad)):
            fp = os.path.join(OUT, nm); json.dump(content, open(fp, "w"))
        pg.set_input_files("[data-a4in=colimp]", os.path.join(OUT, "conflict.json")); time.sleep(0.8)
        check(pg.evaluate("A4.colConflicts.length") == 1 and pg.evaluate("a4Cols()[0].name") == "Polar windows", "import with the same id and different content → conflict reported, nothing overwritten")
        pg.set_input_files("[data-a4in=colimp]", os.path.join(OUT, "bad.json")); time.sleep(0.8)
        check("unknown target" in pg.evaluate("A4.colMsg.text"), "import referencing an unknown target refused")
        pg.screenshot(path=f"{OUT}/p4_10_collections.png", full_page=True)
        # ---------------------------------------------------------------- breadcrumbs, data panel, terrain filter, active targets
        nav(pg, 'home'); time.sleep(0.4)
        pg.evaluate("a4SyncFromLocation('mars:gale'); A4.mode='browse'; atRender()"); time.sleep(0.6)
        crumbs = pg.eval_on_selector_all(".p4-crumbs > *", "x => x.map(e => e.textContent.trim()).filter(t => t !== '›')")
        check(crumbs[:3] == ["Mars", "Gale / Aeolis region", "Gale"], f"breadcrumbs: {' › '.join(crumbs)}")
        check(pg.query_selector(".p4-data") is not None and "REMS" in pg.inner_text(".p4-data") or "rems" in pg.inner_text(".p4-data").lower(), "location data panel lists datasets, support and analysis availability")
        check(pg.query_selector("[data-a4=tgtsw]") is not None, "active-target quick switch present")
        pg.click("[data-a4=mode][data-m=list]"); time.sleep(0.4)
        pg.select_option("[data-a4in=ftype]", "Crater, craters"); time.sleep(0.5)
        nm = pg.evaluate("RG.filterLocations(A4.ix, {body: 'mars', region: A4.region, ftype: 'Crater, craters'}).length")
        check(pg.eval_on_selector_all(".p4-card", "x => x.length") == nm and nm > 0, f"terrain-category filter: {nm} Mars craters in the region")
        pg.select_option("[data-a4in=ftype]", ""); pg.click("[data-a4=mode][data-m=browse]"); time.sleep(0.3)
        # ---------------------------------------------------------------- scenario lab: compute, export, Python replay
        nav(pg, 'scen4'); time.sleep(0.6)
        pg.click("[data-a4=scnrun]"); time.sleep(4)
        check(pg.evaluate("A4.scn.res && A4.scn.res.runs.length") == 3 and pg.query_selector(".p4-rl") is not None, f"Scenario Lab: 3 scenarios, rank-change chart, {pg.evaluate('A4.scn.res.robust.length')} robust candidates")
        pg.screenshot(path=f"{OUT}/p4_13_scenarios.png", full_page=True)
        with pg.expect_download() as d:
            pg.click("[data-a4=scnexp]")
        r = subprocess.run([sys.executable, "scripts/replay_scenario.py", d.value.path(), "--repo", ROOT], cwd=ROOT, capture_output=True, text=True)
        check(r.returncode == 0 and "REPRODUCED" in r.stdout, "browser-exported scenario set reproduced by the Python reference engine")
        pg.set_input_files("[data-a4in=scnimp]", d.value.path()); time.sleep(4)
        check(pg.evaluate("A4.scn.msg && A4.scn.msg.ok"), "scenario set re-imported and replayed in the browser")
        a5 = pg.evaluate(AUDIT)
        pg.click("[data-a4=scnsave]"); time.sleep(0.5); pg.click("[data-a4=coladd] >> nth=0"); time.sleep(0.4)
        check(any(i["kind"] == "scenario_set" for i in pg.evaluate("a4Cols()[0].items")), "scenario set saved to a collection (with snapshot)")
        # comparison and Earth cell saved
        nav(pg, 'lab4'); time.sleep(0.4); pg.evaluate("A4.cmp=['mars_gale_curiosity','moon_shackleton']; A4.agg='minimum'; atRender()"); pg.click("[data-a4=aggrun]"); time.sleep(2)
        pg.click("[data-a4=aggsave]"); time.sleep(0.4); pg.click("[data-a4=coladd] >> nth=0"); time.sleep(0.4)
        nav(pg, 'mmx'); time.sleep(1.2)
        check(pg.query_selector("#mm-t") is not None, "Mismatch Explorer: per-criterion similarity chart with text alternative")
        pg.click("[data-a4=mmsave]"); time.sleep(0.4); pg.click("[data-a4=coladd] >> nth=0"); time.sleep(0.4)
        kinds = [i["kind"] for i in pg.evaluate("a4Cols()[0].items")]
        check({"comparison", "earth_cell", "scenario_set"} <= set(kinds), f"collection holds {sorted(set(kinds))}")
        with pg.expect_download() as d:
            pg.click("[data-a4=colexp]")
        check(pg.evaluate(f"RG.validateCollections({json.dumps(json.load(open(d.value.path())))}, A4.ix).length") == 0, "exported rich collection validates on re-import")
        # expedition objective
        nav(pg, 'expedition'); time.sleep(0.8); pg.check("input[name=a4obj][value=thermal]"); time.sleep(0.8)
        check(pg.evaluate("A3.profile") == "thermal" and "research questions" in pg.inner_text("[data-p4]").lower(), "expedition objective sets the profile and states criteria and research questions")
        # ---------------------------------------------------------------- accessibility audit
        for k, a in (("home", a1), ("lab", a2), ("mismatch", a3), ("readiness", a4), ("scenarios", a5)):
            for key in ("unnamed", "noalt", "svgNoLabel", "dupIds", "posTab"):
                check(not a[key], f"a11y {k}: no {key} ({a[key][:3]})")
            check(not a["lowContrast"], f"a11y {k}: text contrast ≥ 4.5:1 (3:1 large) ({a['lowContrast'][:4]})")
        # ---------------------------------------------------------------- offline start from the service-worker cache
        pg.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller", timeout=60000)
        pg.wait_for_function("A4O.status && A4O.status.coreCached === A4O.status.core", timeout=120000, polling=2000) if pg.evaluate("a4OfflineRefresh().then(() => true)") else None
        stt = pg.evaluate("A4O.status")
        check(stt and stt["coreCached"] == stt["core"], f"service worker: {stt and stt['coreCached']}/{stt and stt['core']} core files cached in {stt and stt['cache']}")
        ctx.set_offline(True)
        pg.reload(); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=90000)
        pg.click("#hero-atlas"); pg.wait_for_selector(".p4-tree", timeout=60000); time.sleep(6.5)
        check(pg.evaluate("!!A4.reg && !A4.err && S.hashOK === true"), "offline: app, verified stack and verified registry load from the cache")
        pg.screenshot(path=f"{OUT}/p4_11_offline_atlas.png")
        ctx.set_offline(False)
        # ---------------------------------------------------------------- mobile
        m = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        m.on("pageerror", lambda e: errors.append("mobile pageerror: " + str(e)))
        m.goto(URL); m.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=90000)
        m.click("#hero-atlas"); time.sleep(8)
        ov = m.evaluate("Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth")
        check(ov <= 0, f"mobile 390 px: no horizontal page overflow ({ov} px)")
        m.screenshot(path=f"{OUT}/p4_12_mobile.png", full_page=False)
        top = m.evaluate("document.querySelector('#left').getBoundingClientRect().top")
        check(top < 200, f"mobile: the atlas panel is scrolled into view after the hero button (top {top:.0f} px)")
        b.close()
finally:
    srv.terminate()
check(not errors, "no page errors (" + "; ".join(errors[:5]) + ")")
print(f"\n{'ALL PHASE IV UI CHECKS PASSED' if not fails else str(len(fails)) + ' FAILED'}")
sys.exit(1 if fails else 0)
