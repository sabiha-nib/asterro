"""Globe-first workspace — UI walk-through (Playwright/Chromium).

    python tests/phase4/ui_global_smoke.py [outdir]

Checks: the language control is in the header (and not in the weight panel); all tabs stay visible at 1512 px in
English with the registry loaded; the landing globe is explorable (a click on land starts the search and opens that
place); the narrated reveal states the engine's own results; the Coverage and Dimension layers paint and count what
the engine computes; the six-dimension panel explains each slider with the engine's numbers; a language switch
keeps target, selection, weights, tab and layer and changes no number; the workspace has no English left outside
names, codes and quoted method notes in বাংলা, Español, Français and Deutsch; the Exploration Journal unlocks only on
real actions and its challenge answers are the data's; Same Earth / Different Mission and the portfolio agree with
the engine; phone width in every language; accessibility audit; no page errors.
"""
import json, os, re, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_global_shots"
os.makedirs(OUT, exist_ok=True)
PORT = 8794
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
errors, fails = [], []


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg, flush=True)
    if not ok:
        fails.append(msg)


WS = "header.bar,#left,#right,#console,#legend,#status,.vp-top,#rv"
TEXT = r"""(sel) => { const out = []; const meth = new Set(Object.values(S.T).flatMap(t => Object.values(t.methodology || {})));
  for (const r of document.querySelectorAll(sel)) { const c = r.cloneNode(true); c.querySelectorAll('.i18n-keep,option,script,style,.sr-only,.brand-txt,.dm-meth').forEach(e => e.remove()); out.push(c.textContent.replace(/\s+/g, ' '));
    for (const e of r.querySelectorAll('[title],[aria-label]')) { if (e.closest('.i18n-keep')) continue; for (const a of ['title', 'aria-label']) { const v = e.getAttribute(a); if (v && !meth.has(v)) out.push(v); } } }
  return out.join(' | '); }"""
EN = re.compile(r"\b(the|and|of|is|are|with|this|that|from|for|by|under|place|weights?|target|conditions?|ranked|cells?|distinct|sites?|similarity|field|score|Earth|data|apart|valid|computed|browser|none|window|Select|Search|Trace|Report|Globe|Map|Change|Coverage|Custom|Analogue|Planetary|fingerprint|Proxy|Direct|Both|Constellations)\b")
SAME = {"fr": {"analogue", "sites", "site", "score", "conditions", "condition", "globe", "constellations", "direct", "distinct"}, "de": {"globe"}, "es": set(), "bn": set()}
AUDIT = r"""(sel) => { const out = { unnamed: [], dupIds: [] };
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const name = e => (e.getAttribute("aria-label") || e.textContent || e.getAttribute("title") || "").trim() || (e.closest("label")?.getAttribute("title") || "");
  for (const e of document.querySelectorAll(sel)) if (vis(e) && !name(e)) out.unnamed.push(e.outerHTML.slice(0, 90));
  const ids = {}; for (const e of document.querySelectorAll("[id]")) ids[e.id] = (ids[e.id] || 0) + 1;
  out.dupIds = Object.entries(ids).filter(([, n]) => n > 1).map(([k]) => k); return out; }"""

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = b.new_context(viewport={"width": 1512, "height": 950}, accept_downloads=True, reduced_motion="reduce")
        pg = ctx.new_page(); pg.set_default_timeout(60000)
        pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errors.append("console.error: " + m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text and "fonts" not in m.text else None)
        pg.goto(URL); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=90000)
        time.sleep(0.5)
        # ---------------------------------------------------------------- header language control
        h = pg.evaluate("({hdr: !!document.querySelector('header.bar #i18n-hdr select[data-i18n-lang]'), before: document.querySelector('#i18n-hdr') && document.querySelector('#i18n-hdr').nextElementSibling.id, console: document.querySelectorAll('#console select[data-i18n-lang], #console [data-i18n-set]').length, opts: [...document.querySelectorAll('#lang-sel option')].map(o => o.value), code: document.querySelector('.i18n-code').textContent})")
        check(h["hdr"] and h["before"] == "btn-search" and h["console"] == 0, "language control is in the header (before Search), and not in the weight panel")
        check(h["opts"] == ["en", "bn", "es", "fr", "de"] and h["code"] == "EN", f"header offers English, বাংলা, Español, Français, Deutsch ({h['opts']})")
        # ---------------------------------------------------------------- landing globe is explorable
        land = pg.evaluate("""(() => { const i = S.res.distinct[0], vp = document.querySelector('#viewport').getBoundingClientRect(); GLOBE.flyTo(S.lat[i], S.lon[i]); return { i }; })()""")
        time.sleep(2.5)
        pt = pg.evaluate("(() => { const i = %d, r = document.querySelector('#globe').getBoundingClientRect(), q = GLOBE.project(S.lat[i], S.lon[i]); return { x: r.left + q.x, y: r.top + q.y, front: q.front, hero: document.querySelector('#app').classList.contains('is-hero') }; })()" % land["i"])
        check(pt["hero"] and pt["front"], "landing: the globe behind the landing text is visible and turned to a real land cell")
        pg.mouse.click(pt["x"], pt["y"]); pg.wait_for_function("S.searched && S.picked != null", timeout=30000); time.sleep(1.5)
        pk = pg.evaluate("({picked: S.picked, top: S.res.distinct[0], hero: document.querySelector('#app').classList.contains('is-hero'), nb: ENG.haversine(S.lat[S.picked], S.lon[S.picked], S.lat[%d], S.lon[%d])})" % (land["i"], land["i"]))
        check(not pk["hero"] and pk["nb"] < 80, f"landing: clicking land on the globe starts the search and opens that place ({pk['nb']:.0f} km from the aimed cell)")
        pg.evaluate("a4Load()"); pg.wait_for_function("A4.reg && document.querySelector('#tc-atlas-sel')", timeout=60000); time.sleep(0.5)
        tabs = pg.evaluate("[...document.querySelectorAll('.tabs button')].map(b => { const r = b.getBoundingClientRect(), q = b.parentElement.getBoundingClientRect(); return r.left >= q.left - 1 && r.right <= q.right + 1; })")
        check(all(tabs) and len(tabs) == 9, f"English, 1512 px, registry loaded: all {len(tabs)} tabs fully visible next to the header language control")
        # ---------------------------------------------------------------- narrated reveal = engine results
        pg.evaluate("setTarget('mars_jezero'); applyProfile('general')"); time.sleep(0.5)
        pg.evaluate("rvStart('mars_jezero')"); pg.wait_for_function("RV.data && RV.step === 7", timeout=30000); time.sleep(0.3)
        rv = pg.evaluate("""(() => { const i = S.res.distinct[0], i2 = S.res.distinct[1], t = [...document.querySelectorAll('#rv .rv-steps li p')].map(p => p.textContent);
          return { n: t.length, t, place: placeStr(i), p: fmtPct(S.res.eff[i]), lost: (100 * (1 - S.res.eff[i])).toFixed(1), second: placeStr(i2), nElig: S.res.nElig.toLocaleString(), sel: S.selected === i }; })()""")
        check(rv["n"] == 8, "reveal: eight steps, all shown at once with reduced motion")
        check(rv["place"] in rv["t"][3] and rv["p"] in rv["t"][4] and rv["lost"] in rv["t"][7] and rv["second"] in rv["t"][7] and rv["nElig"] in rv["t"][2] and rv["sel"],
              f"reveal states the engine's own results: #1 {rv['place']} at {rv['p']}, {rv['lost']} points lost, next {rv['second']}; the globe selects it")
        pg.screenshot(path=f"{OUT}/01_reveal.png")
        pg.click("[data-rv=analyse]"); time.sleep(0.6)
        check(pg.evaluate("JN.open && JN.view === 'place' && JN.sec === 'lens' && JN.i === S.res.distinct[0]"), "reveal → 'Open the full analysis' opens the Lens for that place")
        pg.keyboard.press("Escape"); pg.evaluate("rvAct('close')")
        # ---------------------------------------------------------------- layers
        pg.click("#layer-coverage"); time.sleep(0.6)
        cv = pg.evaluate("""(() => { const c = S.res.r.coverage; let f = 0, p = 0, n = 0; for (let i = 0; i < S.n; i++) { if (c[i] >= 1 - 1e-12) f++; else if (c[i] >= 0.8 - 1e-12) p++; else n++; }
          const legend = document.querySelector('#legend').textContent.replace(/[\\s,]/g, ''); return { f, p, n, legend, layer: GLOBE.layer, pressed: document.querySelector('#layer-coverage').getAttribute('aria-pressed') }; })()""")
        check(str(cv["f"]) in cv["legend"] and str(cv["p"]) in cv["legend"] and cv["layer"] == 1 and cv["pressed"] == "true", f"Coverage layer (General): {cv['f']:,} fully measured, {cv['p']:,} partly, {cv['n']:,} not ranked — counts equal the engine's coverage")
        pg.evaluate("applyProfile('instrument')"); time.sleep(0.8)
        ci = pg.evaluate("""(() => { const c = S.res.r.coverage; let n = 0; for (let i = 0; i < S.n; i++) if (c[i] < 0.8 - 1e-12) n++; return { n, unranked: S.n - S.res.nElig, legend: document.querySelector('#legend').textContent.replace(/[\\s,]/g, ''), d: GLOBE.fieldData[S.cell[(() => { for (let i = 0; i < S.n; i++) if (c[i] < 0.8 - 1e-12) return i; })()] * 4 + 2] }; })()""")
        check(ci["n"] == ci["unranked"] and ci["n"] > 0 and str(ci["n"]) in ci["legend"] and ci["d"] == 4, f"Science instrument testing: {ci['n']:,} cells fall below the 80% rule — exactly the unranked cells, painted 'not ranked'")
        pg.screenshot(path=f"{OUT}/02_coverage.png")
        pg.evaluate("applyProfile('general')"); time.sleep(0.4)
        pg.click("#layer-dimension"); time.sleep(0.5); pg.select_option("#gl-dim", "slope"); time.sleep(0.5)
        dv = pg.evaluate("""(() => { const i = S.res.distinct[0], R = a4RangesFor('mars_jezero').slope, s = Math.max(0, Math.min(1, 1 - Math.abs(S.A.slope[i] - S.T.mars_jezero.variables.slope) / (R[1] - R[0])));
          return { want: Math.round(s * 255), got: GLOBE.fieldData[S.cell[i] * 4], dim: GL.dim, layer: S.layer }; })()""")
        check(dv["got"] == dv["want"] and dv["dim"] == "slope", f"Dimension layer paints the per-criterion similarity s (slope at #1: {dv['got']}/255)")
        pg.evaluate("setTarget('cross')"); time.sleep(0.5)
        check(pg.evaluate("S.layer") == "sim" and not errors, "cross-planet: the single-dimension layer falls back to the similarity field (no error)")
        pg.evaluate("setTarget('mars_jezero')"); time.sleep(0.4)
        pg.click("#layer-sim"); time.sleep(0.3)
        check(pg.evaluate("GLOBE.layer === 0 && GLOBE.fieldData[S.cell[S.res.distinct[0]] * 4] === Math.round(S.res.eff[S.res.distinct[0]] * 255)"), "back to Similarity: the baseline field texture is restored")
        # ---------------------------------------------------------------- dimension panel
        pg.evaluate("select(S.res.distinct[0], false)"); time.sleep(0.3)
        dm = pg.evaluate("({n: document.querySelectorAll('#console .sl .dm-plain').length, et: document.querySelectorAll('#console .sl .dm-et i.dm-e').length, info: document.querySelectorAll('#console .dm-i').length})")
        check(dm["n"] == 6 and dm["info"] == 6 and dm["et"] >= 5, "six-dimension panel: plain explanation, unit, Earth/target scale and an ⓘ button on every slider")
        pg.click("[data-dm-info=lst_diurnal_range]"); time.sleep(0.3)
        di = pg.evaluate("(() => { const d = detailFor('mars_jezero', S.res.distinct[0]).rows.find(r => r.c === 'lst_diurnal_range'); return { txt: document.querySelector('#dm-info').textContent, k: (100 * d.k).toFixed(1), s: d.s.toFixed(3), exp: document.querySelector('[data-dm-info=lst_diurnal_range]').getAttribute('aria-expanded') }; })()")
        check(di["k"] in di["txt"] and di["s"] in di["txt"] and di["exp"] == "true" and "not a measure of how scientifically important" in di["txt"], f"ⓘ explains the dimension with the engine's numbers (s = {di['s']}, {di['k']} points) and what a weight means")
        pg.evaluate("commitWeights({...S.weights, slope: 0}, 'test')"); time.sleep(0.4)
        check(pg.evaluate("document.querySelector('#w-slope').closest('.sl').classList.contains('dm-off') && !document.querySelector('#w-aridity').closest('.sl').classList.contains('dm-off')"), "a dimension with weight 0 is shown as not used in the score")
        pg.evaluate("applyProfile('general')"); time.sleep(0.4)
        a1 = pg.evaluate(AUDIT, "header.bar button, header.bar select, #console button, #console select, .vp-top button, #legend select")
        for key in ("unnamed", "dupIds"):
            check(not a1[key], f"a11y header / console / globe controls: no {key} ({a1[key][:3]})")
        # ---------------------------------------------------------------- language switch keeps the state and changes no number
        pg.evaluate("setTarget('moon_south_pole'); commitWeights({...S.weights, slope: 2.5}, 'test'); select(S.res.distinct[3], false); setLayer('clusters'); DM.open = 'slope'; renderConsole()"); time.sleep(0.8)
        st0 = pg.evaluate("({t: S.targetId, sel: S.selected, w: JSON.stringify(S.weights), tab: S.tab, layer: S.layer, sum: Array.from(S.res.eff).reduce((a, b) => a + b, 0), top: S.res.distinct.join()})")
        bad = []
        for L in ["de", "bn", "es", "fr"]:
            pg.evaluate(f"setLang('{L}')"); time.sleep(0.8)
            st = pg.evaluate("({t: S.targetId, sel: S.selected, w: JSON.stringify(S.weights), tab: S.tab, layer: S.layer, sum: Array.from(S.res.eff).reduce((a, b) => a + b, 0), top: S.res.distinct.join(), lang: document.documentElement.lang, focus: document.activeElement && document.activeElement.id})")
            if any(st[k] != st0[k] for k in ("t", "sel", "w", "tab", "layer", "sum", "top")) or st["lang"] != L: bad.append(L)
        check(not bad, f"switching through Deutsch, বাংলা, Español, Français keeps target, selection, weights, tab and layer, and changes no score ({bad})")
        pg.evaluate("setLang('en'); setTarget('mars_jezero'); applyProfile('general'); setLayer('sim')"); time.sleep(0.6)
        # ---------------------------------------------------------------- no English left in the workspace
        for L in ["de", "bn", "es", "fr"]:
            pg.evaluate(f"setLang('{L}'); select(S.res.distinct[0], false)"); time.sleep(0.6)
            words = set(); ctxs = []
            for setup in ["", "S.fpMode='bars'; renderLeft()", "S.fpMode='matrix'; renderLeft()", "setLayer('clusters')", "setLayer('coverage')", "setLayer('dimension')", "setLayer('delta'); applyProfile('rover')", "setTarget('moon_south_pole')", "setTarget('cross')",
                          "setTarget('mars_jezero'); applyProfile('general'); setLayer('sim'); S.fpMode='radial'; select(S.res.distinct[0], false); DM.open = 'aridity'; renderConsole()", "rvStart('mars_jezero')"]:
                if setup: pg.evaluate(setup); time.sleep(0.5)
                t = pg.evaluate(TEXT, WS)
                for m_ in EN.finditer(t):
                    if m_.group(0).lower() not in SAME[L] and m_.group(0) not in words: words.add(m_.group(0)); ctxs.append(t[max(0, m_.start() - 50):m_.end() + 30])
            pg.evaluate("rvAct('close'); DM.open = null; renderConsole()")
            check(not words, f"{L}: no English words left in the workspace (header, panels, console, legend, status, reveal) outside names and quoted method notes ({sorted(words)[:8]} {ctxs[:3]})")
            if L == "de": pg.screenshot(path=f"{OUT}/03_de_workspace.png")
        pg.evaluate("setLang('en')"); time.sleep(0.4)
        # ---------------------------------------------------------------- journal: real actions only; challenges answered from data
        c2 = b.new_context(viewport={"width": 1512, "height": 950}, reduced_motion="reduce")
        q = c2.new_page(); q.set_default_timeout(60000)
        q.on("pageerror", lambda e: errors.append("journal pageerror: " + str(e)))
        q.goto(URL); q.wait_for_function("S.res && S.res.distinct", timeout=90000); time.sleep(0.5)
        check(q.evaluate("Object.keys(JL.unlocked).length") == 0, "a new visitor starts with no achievements")
        q.evaluate("jnOpen('journal')"); time.sleep(0.4); q.evaluate("jnClose()")
        check(q.evaluate("Object.keys(JL.unlocked).length") == 0, "opening the journal unlocks nothing")
        q.click("#hero-search"); q.wait_for_function("S.searched && JL.unlocked.first_contact", timeout=30000)
        check(q.evaluate("!!JL.unlocked.first_contact && !JL.unlocked.evidence"), "First Contact unlocks only when the search has completed")
        q.evaluate("jnOpen('place', {i: S.res.distinct[0], tid: 'mars_jezero', pid: 'general', sec: 'trust'})"); time.sleep(0.4)
        q.evaluate("document.querySelector('[data-trust=sources]').open = true"); time.sleep(0.3)
        check(q.evaluate("!JL.unlocked.evidence"), "Evidence First needs both the Sources row and Missing pieces (Sources alone is not enough)")
        q.evaluate("JN.sec = 'missing'; jnRender()"); time.sleep(0.3)
        check(q.evaluate("!!JL.unlocked.evidence"), "… and unlocks once Missing pieces has been opened too")
        q.evaluate("JN.sec = 'passport'; jnRender()"); time.sleep(0.3)
        check(q.evaluate("!JL.unlocked.repro && !JL.unlocked.storyteller"), "viewing a passport does not unlock Reproducibility Pioneer or Storyteller")
        with q.expect_download():
            q.click("[data-jn=pjson]")
        check(q.evaluate("!!JL.unlocked.repro && !!JL.unlocked.storyteller"), "downloading a passport whose re-score matched unlocks both")
        q.evaluate("JN.view = 'journal'; jnRender()"); time.sleep(0.3)
        ans = q.evaluate("(() => { const C = jlChallenges(); return { costs: C.costsMost, stronger: C.stronger, all: C.leaders.slice(1, 12), excl: !!C.excluded }; })()")
        wrong = next(c for c in ["aridity", "slope", "elevation"] if c != ans["costs"])
        q.click(f"[data-chal=costs] [data-c={wrong}]"); time.sleep(0.2)
        r1 = q.evaluate("JL.ch.costs.correct")
        q.click(f"[data-chal=costs] [data-c={ans['costs']}]"); time.sleep(0.2)
        r2 = q.evaluate("JL.ch.costs.correct")
        check(r1 is False and r2 is True and ans["costs"] == "lst_diurnal_range", "challenge 'which dimension costs the #1 site most': a wrong answer is marked wrong, the data's answer (thermal) right")
        pick = ans["stronger"][0] if ans["stronger"] else None
        if pick is not None and pick in ans["all"]:
            q.click(f"[data-chal=stronger] [data-i='{pick}']"); time.sleep(0.2)
        check(pick is not None and q.evaluate("JL.ch.stronger && JL.ch.stronger.correct === true"), "challenge 'closer thermal match than #1': a site with a higher s is accepted")
        q.click("[data-chal=excluded] [data-o=low]"); time.sleep(0.2); e1 = q.evaluate("JL.ch.excluded.correct")
        q.click("[data-chal=excluded] [data-o=coverage]"); time.sleep(0.2); e2 = q.evaluate("JL.ch.excluded.correct")
        check(ans["excl"] and e1 is False and e2 is True, "challenge 'why is this place not ranked?': the 80% coverage rule, not low similarity")
        q.screenshot(path=f"{OUT}/04_journal.png")
        # missions and portfolio agree with the engine
        q.evaluate("JN.view = 'missions'; MS.a = 'general'; MS.b = 'rover'; MS.focus = null; jnRender()"); time.sleep(0.4)
        ms = q.evaluate("""(() => { const M = JE.missions(jnCtx('mars_jezero'), S.app.profiles.general.weights, S.app.profiles.rover.weights, 10);
          const v = document.querySelector('[data-both]'), f = document.querySelector('[data-sum]'); return { both: +v.dataset.both, want: M.both.length, sum: +f.dataset.sum, ds: M.focus.scoreB - M.focus.scoreA, rows: document.querySelectorAll('.ms-list li').length }; })()""")
        check(ms["both"] == ms["want"] and abs(ms["sum"] - ms["ds"]) < 1e-8 and ms["rows"] == 20, f"Same Earth, Different Mission: {ms['both']} of 10 leaders shared; Σ Δcontribution = ΔS for the focus site")
        q.evaluate("JN.view = 'portfolio'; PF.sel = []; jnRender()"); time.sleep(0.3)
        for k in range(3):
            q.click(f".pf-pick li:nth-child({k + 1}) .pf-c"); time.sleep(0.2)
        pf = q.evaluate("({sel: PF.sel.length, cols: document.querySelectorAll('.pf-t thead th').length, rows: document.querySelectorAll('.pf-t tbody tr').length})")
        check(pf["sel"] == 3 and pf["cols"] == 5 and pf["rows"] == 8, "portfolio: three chosen places compared on six criteria, plus score and coverage rows")
        q.click("[data-pf=team]"); time.sleep(0.3)
        check(q.evaluate("PF.sel.length === JE.team(jnCtx('mars_jezero'), jnW()).members.length"), "portfolio: the suggested team is the engine's greedy cover")
        a2 = q.evaluate(AUDIT, "#jn button, #jn select")
        check(not a2["unnamed"] and not a2["dupIds"], f"a11y journal / missions / portfolio: named controls, unique ids ({a2})")
        c2.close()
        # ---------------------------------------------------------------- phone width, every language
        c3 = b.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
        m = c3.new_page(); m.set_default_timeout(60000)
        m.on("pageerror", lambda e: errors.append("mobile pageerror: " + str(e)))
        m.goto(URL); m.wait_for_function("S.res && S.res.distinct", timeout=90000)
        m.click("#hero-search"); m.wait_for_function("S.searched", timeout=30000); time.sleep(6)
        worst = {}
        for L in ["en", "bn", "es", "fr", "de"]:
            m.evaluate(f"setLang('{L}'); select(S.res.distinct[0], false); rvStart('mars_jezero'); DM.open = 'slope'; renderConsole()"); time.sleep(0.8)
            worst[L] = m.evaluate("Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth")
            m.evaluate("rvAct('close'); DM.open = null; renderConsole()")
        check(all(v <= 0 for v in worst.values()), f"phone 390 px: workspace with reveal card and dimension panel has no horizontal overflow in any language ({worst})")
        m.evaluate("setLang('de'); rvStart('mars_jezero')"); time.sleep(0.6); m.screenshot(path=f"{OUT}/05_phone_de.png")
        c3.close()
        b.close()
finally:
    srv.terminate()
check(not errors, "no page errors (" + "; ".join(errors[:4]) + ")")
print(f"\n{'ALL GLOBAL WORKSPACE CHECKS PASSED' if not fails else str(len(fails)) + ' FAILED'}")
sys.exit(1 if fails else 0)
