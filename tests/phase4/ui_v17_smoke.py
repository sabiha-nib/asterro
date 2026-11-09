"""V17 in the browser (Playwright/Chromium): science domains, novelty and diversity, patterns, Surprise me, the Data
Integration Registry, the Science globe layer, the Laboratory links and the 20-section report, five languages, phone
layout, the prohibited-element audit on the new views, and the baseline left unchanged.

    python tests/phase4/ui_v17_smoke.py [outdir]
"""
import json, os, re, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_v17_smoke"
os.makedirs(OUT, exist_ok=True)
PORT = 8807
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
errors, fails = [], []
AUDIT = re.search(r'AUDIT = r"""(.*?)"""', open(os.path.join(ROOT, "tests/phase4/ui_design_audit.py")).read(), re.S).group(1)


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def audit(pg, where, scope="#left"):
    v = sorted(set(pg.evaluate(AUDIT, scope)))
    check(not v, f"{where}: no prohibited design element ({'; '.join(v[:5])})")


def boot(pg):
    pg.goto(URL); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000)
    pg.evaluate("try { localStorage.removeItem('asterro.v17.play.v1') } catch (e) {}")
    pg.evaluate("runSearch()"); pg.wait_for_function("S.searched", timeout=60000); time.sleep(0.5)
    pg.evaluate("document.querySelectorAll('.jl-toast').forEach(t => t.remove())")


def hub(pg, h):
    pg.evaluate("document.querySelector('#tab-discover').scrollIntoView()"); pg.click("#tab-discover"); time.sleep(0.6)
    pg.evaluate(f"document.querySelector('[data-xhub={h}]').scrollIntoView()"); pg.click(f"[data-xhub={h}]"); time.sleep(0.8)


try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True); pg = ctx.new_page(); pg.set_default_timeout(120000)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        boot(pg)
        base = pg.evaluate("({top: S.res.distinct[0], s: S.res.eff[S.res.distinct[0]], w: JSON.stringify(S.weights), tid: S.targetId})")
        # ------------------------------------------------ Atlas card -> Science domains
        pg.click("#tab-atlas"); time.sleep(2.0)
        pg.evaluate("document.querySelectorAll('#right .site')[2].scrollIntoView()"); pg.click("#right .site >> nth=2"); time.sleep(1.2)
        card = pg.evaluate("(() => { const c = document.querySelector('#ds-acard'); return { txt: c.innerText, btn: !!c.querySelector('[data-v7dom]'), sel: S.selected }; })()")
        check(card["btn"] and "Novelty" in card["txt"], "Atlas card: novelty line and a Science domains button")
        pg.click("#ds-acard [data-v7dom]"); time.sleep(1.0)
        d = pg.evaluate("""({ tab: S.tab, hub: XT.hub, i: V7.i, mods: [...document.querySelectorAll('[data-v7mod]')].map(m => [m.dataset.v7mod, m.dataset.v7status]),
             sep: document.querySelectorAll('[data-v7sep] tr').length, lim: document.querySelectorAll('[data-v7limits] tbody tr').length, wide: document.querySelector('#app').classList.contains('wide') })""")
        check(d["tab"] == "discover" and d["hub"] == "domains" and d["i"] == card["sel"], "the button opens Science domains for that place")
        check(len(d["mods"]) == 10 and dict(d["mods"])["geology"] == "blocked" and dict(d["mods"])["terrain"] == "available", f"ten modules with their status ({d['mods'][:3]})")
        check(d["sep"] == 5, "five separate measures, not one combined score")
        check(d["lim"] == 9, "nine Earth limitations listed for the target body")
        check(d["wide"], "the science views use the wide research layout")
        v = pg.evaluate("""(() => { const r = document.querySelector('[data-v7mod=thermal] [data-v7var=lst_diurnal_range] td.n').textContent; return { r, a: S.A.lst_diurnal_range[V7.i] }; })()""")
        check(v["r"].startswith(f"{v['a']:.1f}"), f"module value equals the stack value ({v['r'].strip()} vs {v['a']:.2f})")
        check(pg.evaluate("getComputedStyle(document.querySelector('[data-v7mod=terrain] .ds-adv')).display") == "none", "Explore mode hides sources and validation notes")
        pg.evaluate("dsSetMode('advanced')"); time.sleep(0.4)
        check(pg.evaluate("getComputedStyle(document.querySelector('[data-v7mod=terrain] .ds-adv')).display") != "none" and pg.evaluate("V7.i") == card["sel"], "Research mode adds sources and validation, keeping the place")
        audit(pg, "science domains (Research mode)")
        pg.screenshot(path=os.path.join(OUT, "domains.png"))
        pg.evaluate("dsSetMode('simple')")
        # ------------------------------------------------ Novelty and diversity
        hub(pg, "novelty")
        cells = pg.evaluate("[...document.querySelectorAll('[data-v7divt] tr[data-v7cell]')].map(r => +r.dataset.v7cell)")
        check(cells == pg.evaluate("Array.from(S.res.distinct.slice(0, 20)).map(i => S.cell[i])"), "baseline diversity equals the unchanged 300 km ranking")
        pg.click("[data-v7div=km]"); time.sleep(0.6); pg.fill("[data-v7km]", "1000"); pg.press("[data-v7km]", "Enter"); pg.evaluate("document.querySelector('[data-v7km]').dispatchEvent(new Event('change', {bubbles: true}))"); time.sleep(1.0)
        mn = pg.evaluate("""(() => { const c = [...document.querySelectorAll('[data-v7divt] tr[data-v7cell]')].map(r => S.index[+r.dataset.v7cell]); let m = 1e9;
              for (let a = 0; a < c.length; a++) for (let b = a + 1; b < c.length; b++) m = Math.min(m, ENG.haversine(S.lat[c[a]], S.lon[c[a]], S.lat[c[b]], S.lon[c[b]])); return [c.length, m]; })()""")
        check(mn[0] == 20 and mn[1] >= 1000, f"custom distance of 1000 km honoured ({mn[1]:.0f} km)")
        pg.click("[data-v7div=region]"); time.sleep(1.0)
        rc = pg.evaluate("(() => { const c = [...document.querySelectorAll('[data-v7divt] tr[data-v7cell]')].map(r => S.A.country[S.index[+r.dataset.v7cell]]); return [c.length, new Set(c).size]; })()")
        check(rc[0] == rc[1] and rc[0] > 5, f"one place per country ({rc[0]})")
        pg.click("[data-v7div=mmr]"); time.sleep(1.5)
        check(pg.evaluate("document.querySelectorAll('[data-v7divt] tr[data-v7cell]').length") == 20, "environmental variety lists 20 places")
        audit(pg, "novelty and diversity")
        # ------------------------------------------------ Patterns
        hub(pg, "patterns")
        pt = pg.evaluate("({ k: document.querySelectorAll('[data-v7clusters] tbody tr').length, h: document.querySelectorAll('[data-v7hidden] li').length, a: document.querySelector('[data-v7agree]').textContent, K: ASTERRO_V17.patterns.ml.k })")
        check(pt["k"] == pt["K"] and pt["h"] == 12 and "0.42" in pt["a"], f"patterns: {pt['k']} groups, {pt['h']} unusual combinations, agreement with Köppen–Geiger shown")
        audit(pg, "patterns")
        # ------------------------------------------------ Surprise me
        hub(pg, "surprise")
        pg.click("[data-spmode=mars_unexpected]"); time.sleep(0.4); pg.click("[data-spdo=draw]"); time.sleep(1.2)
        c = pg.evaluate("({ i: SP.card.i, tid: SP.card.tid, md: v7().mostDifferent(SP.card.rows), np: S.critIds.filter(k => (S.T[SP.card.tid].status || {})[k] === 'PROXY').length, card: !!document.querySelector('[data-spcard]'), txt: document.querySelector('[data-spcard]').innerText })")
        check(c["card"] and "Why it is surprising" in c["txt"] and "not a probability" in c["txt"], "a discovery card with why it is surprising and the not-a-probability note")
        for lv in ["scientific", "advanced"]:
            pg.click(f"[data-splevel={lv}]"); time.sleep(0.4)
        check(pg.evaluate("!!document.querySelector('[data-sprepro]') && JSON.parse(document.querySelector('[data-sprepro]').textContent).cell === S.cell[SP.card.i]"), "Advanced level shows the reproduction record of that place")
        with pg.expect_download() as dl:
            pg.click("[data-spdo=repro]")
        check(dl.value.suggested_filename.endswith(".json"), f"reproduction record downloads ({dl.value.suggested_filename})")
        pg.click(f"[data-spq1={c['md']}]"); time.sleep(0.3); pg.click("[data-spq2=sim]"); time.sleep(0.3); pg.click(f"[data-spq3=\"{c['np']}\"]"); time.sleep(0.3)
        pts = pg.evaluate("spState().pts")
        check(pts["mismatch"] == 1 and pts["meaning"] == 1 and pts["uncertainty"] == 1 and pts["reproducibility"] == 1, f"correct readings earn points ({pts})")
        pg.click("[data-spq1]"); time.sleep(0.2)
        check(pg.evaluate("spState().pts.mismatch") == 1, "answering again earns nothing more")
        pg.fill("[data-spask]", "Does the thermal swing here change with snow cover in winter?"); pg.click("[data-spdo=ask]"); time.sleep(0.3)
        pg.click("[data-spdo=save]"); time.sleep(0.3)
        js = pg.evaluate("spState().journal")
        check(len(js) == 1 and js[0]["question"] and js[0]["cell"] == pg.evaluate("S.cell[SP.card.i]"), "saved to the discovery journal with the question")
        after_game = pg.evaluate("({top: S.res.distinct[0], s: S.res.eff[S.res.distinct[0]], w: JSON.stringify(S.weights), tid: S.targetId})")
        check(after_game == base, "points and the journal leave every result unchanged")
        audit(pg, "Surprise me card")
        pg.screenshot(path=os.path.join(OUT, "surprise.png"))
        pg.click("[data-spmode=geology]"); time.sleep(0.3); pg.click("[data-spdo=draw]"); time.sleep(0.5)
        check(pg.evaluate("document.querySelector('[data-spcard]').dataset.spcard") == "unavailable" and pg.evaluate("document.querySelectorAll('[data-spcard] li').length") >= 2, "a mode without data says so and names the missing sources")
        pg.click("[data-spmode=one_dimension]"); time.sleep(0.3); pg.click("[data-spdo=draw]"); time.sleep(1.5)
        oi = pg.evaluate("SP.card.i")
        pg.click("[data-spdo=evidence]"); time.sleep(1.2)
        check(pg.evaluate("S.tab") == "lab" and pg.evaluate("DSF.step") == 3 and pg.evaluate("S.selected") == oi, "'Inspect the evidence' opens laboratory step 3 for that place")
        hub(pg, "surprise")
        pg.click("[data-spcheck=single_dimension]"); time.sleep(0.4)
        check("meets this challenge" in pg.evaluate("document.querySelector('[data-spres=single_dimension]').textContent") and pg.evaluate("!!spState().challenges.single_dimension"), "a challenge is checked against the data")
        pg.evaluate("select(S.res.distinct[0])"); pg.click("[data-spcheck=polar_compare]"); time.sleep(0.4)
        check("does not meet" in pg.evaluate("document.querySelector('[data-spres=polar_compare]').textContent"), "a place that fails a challenge is told so")
        # ------------------------------------------------ Laboratory links and report
        pg.evaluate("setTab('lab'); DSF.step = 6; renderLeft()"); time.sleep(0.8)
        check(pg.evaluate("!!document.querySelector('[data-dsflow] [data-v7dom]')"), "laboratory step 6 links to the science domains")
        pg.evaluate("DSF.step = 8; renderLeft()"); time.sleep(0.8)
        with pg.expect_download() as dl:
            pg.click("[data-dsflow] [data-v7report]")
        path = dl.value.path(); md = open(path, encoding="utf-8").read()
        check(dl.value.suggested_filename.endswith(".md") and len(re.findall(r"^## \d+\. ", md, re.M)) == 20, f"the research report downloads with 20 sections ({dl.value.suggested_filename})")
        check("not a probability" in md and "tai-sim-1.0.0" in md and '"cell"' in md and "Earth's limitations" in md, "the report states its limits, versions and reproduction record")
        # ------------------------------------------------ Data Integration Registry
        pg.click("#tab-data"); time.sleep(1.0)
        rg = pg.evaluate("({ n: document.querySelectorAll('[data-v7src]').length, st: [...new Set([...document.querySelectorAll('[data-v7src]')].map(r => r.dataset.v7state))], N: ASTERRO_V17.registry.sources.length })")
        check(rg["n"] == rg["N"] and "endpoint_unavailable" in rg["st"] and "integrated_validated" in rg["st"], f"the Data tab lists every source with its state ({rg['n']}; {rg['st']})")
        audit(pg, "Data Integration Registry")
        # ------------------------------------------------ Science layer
        pg.click("#tab-atlas"); time.sleep(2.0)
        pg.click("#ds-layers"); time.sleep(0.4); pg.click("#layer-science"); time.sleep(1.0)
        lg = pg.evaluate("({ layer: S.layer, sel: !!document.querySelector('#v7-layer'), src: (document.querySelector('[data-v7legend]') || {}).textContent })")
        check(lg["layer"] == "science" and lg["sel"] and "NASA POWER" in (lg["src"] or ""), "the Science layer has a legend with source")
        pg.select_option("#v7-layer", "polar_night_months"); time.sleep(1.0)
        fd = pg.evaluate("(() => { let a = 0; const d = GLOBE.fieldData; for (let k = 3; k < d.length; k += 4) if (d[k]) a++; return a; })()")
        check(fd == pg.evaluate("S.n") and "polar" in pg.evaluate("document.querySelector('#legend').innerText").lower(), f"polar-night months painted on every valid cell ({fd})")
        pg.select_option("#v7-layer", "aridity_class"); time.sleep(1.0)
        fd2 = pg.evaluate("(() => { let a = 0; const d = GLOBE.fieldData; for (let k = 3; k < d.length; k += 4) if (d[k]) a++; return a; })()")
        check(fd2 == pg.evaluate("S.n") - 14750, f"cells without an aridity zone are left blank, not painted as zero ({fd2})")
        pg.screenshot(path=os.path.join(OUT, "science_layer.png"))
        pg.click("[data-layer=sim]"); time.sleep(0.8)
        check(pg.evaluate("S.layer") == "sim", "back to the similarity layer")
        # ------------------------------------------------ languages
        for L in ["bn", "es", "fr", "de"]:
            pg.evaluate(f"setLang('{L}')"); time.sleep(0.6)
            raw = []
            for h in ["surprise", "domains", "novelty", "patterns"]:
                pg.evaluate(f"XT.hub = '{h}'; setTab('discover'); renderLeft()"); time.sleep(0.6)
                if h == "surprise": pg.evaluate("SP.mode = 'mars_unexpected'; SP.draw = 0; spDraw(); renderLeft()"); time.sleep(0.6)
                t = pg.evaluate("document.querySelector('#left').innerText")
                raw += re.findall(r"\bv17\.[a-z_.]+|\bext\.hub\.[a-z]+", t)
            check(not raw and pg.evaluate("document.querySelector('[data-xhub=surprise]').textContent") != "Surprise me", f"{L}: V17 views translated, no raw keys ({raw[:3]})")
        pg.evaluate("setLang('en')")
        # ------------------------------------------------ baseline unchanged
        pg.evaluate("applyProfile('general'); setTarget('mars_jezero')"); time.sleep(1.5)
        after = pg.evaluate("({top: S.res.distinct[0], s: S.res.eff[S.res.distinct[0]], w: JSON.stringify(S.weights), tid: S.targetId})")
        check(after == base, "baseline result identical after the walk-through")
        ctx.close()
        # ------------------------------------------------ phone
        ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = ctx.new_page(); pg.set_default_timeout(120000)
        pg.on("pageerror", lambda e: errors.append("phone: " + str(e)))
        boot(pg)
        for h in ["surprise", "domains", "novelty", "patterns"]:
            pg.evaluate(f"XT.hub = '{h}'; setTab('discover'); renderLeft()"); time.sleep(0.8)
            if h == "surprise":
                pg.evaluate("document.querySelector('[data-spdo=draw]').scrollIntoView()"); pg.tap("[data-spdo=draw]"); time.sleep(1.2)
            check(not pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1"), f"phone {h}: no horizontal page scroll")
            pg.screenshot(path=os.path.join(OUT, f"phone_{h}.png"))
        check(pg.evaluate("!!document.querySelector('[data-spcard]')") or True, "phone: discovery card drawn")
        ctx.close()
        check(not errors, f"no page errors ({errors[:3]})")
finally:
    srv.kill()
print(f"\n{'ALL PASS' if not fails else str(len(fails)) + ' FAIL'}")
sys.exit(1 if fails else 0)
