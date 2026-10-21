"""Discovery Journey + interface languages — UI walk-through (Playwright/Chromium).

    python tests/phase4/ui_journey_smoke.py [outdir]

Checks: English is the unchanged default; the landing has the journey entry and a language row; the discovery
stories equal results recomputed in the page with the baseline functions; the dialog traps focus, Esc closes it
and returns focus; the 7-step reveal works with buttons, arrow keys and Skip; the Lens objective switch ranks the
cell exactly as the baseline does for that profile; every "Change my mind?" alternative re-scores to the shown
rank; missing pieces and the Trust View (no combined score); Other worlds; Through time; the Passport JSON is
re-scored by the independent Python implementation, the PNG is a 1200×675 image, Print and Save to My Research
work; in বাংলা, Español and Français every journey screen has no fallback key and no English left outside
preserved terms, html[lang] follows, numbers are formatted per locale and every result is identical to English;
phone width 390 px in every language; accessibility audit; reduced motion; the baseline is untouched.
"""
import json, os, re, struct, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_journey_shots"
os.makedirs(OUT, exist_ok=True)
PORT = 8793
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
errors, fails = [], []
SECS = ["reveal", "lens", "change", "missing", "trust", "worlds", "time", "passport"]


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg, flush=True)
    if not ok:
        fails.append(msg)


AUDIT = r"""() => {
  const out = { unnamed: [], dupIds: [], lowContrast: [] };
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const name = e => (e.getAttribute("aria-label") || e.textContent || e.getAttribute("title") || "").trim() || (e.closest("label")?.textContent.trim()) || "";
  for (const e of document.querySelectorAll("#jn button, #jn select, #jn a")) if (vis(e) && !name(e)) out.unnamed.push(e.outerHTML.slice(0, 80));
  const ids = {}; for (const e of document.querySelectorAll("[id]")) ids[e.id] = (ids[e.id] || 0) + 1;
  out.dupIds = Object.entries(ids).filter(([, n]) => n > 1).map(([k]) => k);
  const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = e => { for (let n = e; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c; } return [10, 13, 16]; };
  const seen = new Set();
  for (const e of document.querySelectorAll("#jn *")) {
    if (!vis(e) || e.closest("svg") || e.closest("[disabled]") || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(e), fg = rgb(s.color), bg = bgOf(e), L1 = lum(fg), L2 = lum(bg), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const big = parseFloat(s.fontSize) >= 18.66 || (parseFloat(s.fontSize) >= 14 && +s.fontWeight >= 700);
    if (cr < (big ? 3 : 4.5)) { const k = s.color + e.className; if (!seen.has(k)) { seen.add(k); out.lowContrast.push(`${cr.toFixed(2)} <${e.tagName.toLowerCase()} class="${e.className}">${e.textContent.trim().slice(0, 30)}`); } }
  }
  return out;
}"""
# visible text of the dialog outside preserved terms (dataset / place / unit names) and outside <option> (registry names)
TEXT = r"""() => { const c = document.querySelector('#jn').cloneNode(true);
  c.querySelectorAll('.i18n-keep, option, script, style, .sr-only:empty, select[data-i18n-lang]').forEach(e => e.remove());
  return c.textContent.replace(/\s+/g, ' '); }"""
EN_WORDS = re.compile(r"\b(the|and|of|is|are|with|this|that|from|for|by|without|which|under|place|places|weights?|target|objective|conditions?|matches?|compared|Earth|data|step|rank|leading|similar|different|unknown|summary|missing|trust|sources?|download|print|save|discoveries|close|back|next)\b", re.I)
SAME_WORD = {"es": {"similar"}, "fr": {"conditions", "condition", "sources", "source", "place"}}   # words spelled the same in that language
ALLOWED_LATIN = {"ASTERRO", "JSON", "SHA", "NASA", "USGS", "MODIS", "POWER", "GMTED2010", "MEDA", "MOLA", "LOLA", "Diviner", "explore", "target", "v1", "legacy", "baseline", "tai", "sim", "stack",
                 "P", "PET", "K", "s", "km", "m", "EVA", "Space", "Apps", "Claude", "Español", "Français", "English", "LST", "Aqua", "MYD11C3", "Analogue", "Passport", "schema", "passport"}


def nav_all(pg, wait_change=True):
    for s in SECS:
        pg.evaluate(f"document.querySelector('#jn-tab-{s}').click()")
        if s == "change" and wait_change:
            pg.wait_for_function("JN.cm.has(jnCmKey())", timeout=60000)
        time.sleep(0.25)
        yield s


try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = b.new_context(viewport={"width": 1512, "height": 950}, accept_downloads=True)
        pg = ctx.new_page(); pg.set_default_timeout(60000)
        pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errors.append("console.error: " + m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text and "fonts" not in m.text else None)
        pg.goto(URL); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=90000)
        time.sleep(0.5)
        # ---------------------------------------------------------------- default interface unchanged
        d = pg.evaluate("({lang: document.documentElement.lang, tabs: [...document.querySelectorAll('.tabs button')].slice(0, 6).map(b => b.textContent), search: document.querySelector('#hero-search').textContent, h1: document.querySelector('#hero h1').innerText.replace(/\\s+/g, ' '), cta: [...document.querySelectorAll('.hero-cta button')].map(b => b.id), row: [...document.querySelectorAll('#hero-lang button')].map(b => [b.textContent, b.getAttribute('lang'), b.getAttribute('aria-pressed')])})")
        check(d["lang"] == "en" and d["tabs"] == ["Explore", "Compare", "Scenarios", "Discover", "Data", "Method"] and d["search"] == "Search Earth" and d["h1"].upper() == "FIND EARTH'S OTHER WORLDS.", "English is the default and the baseline labels are unchanged")
        check(d["cta"][:2] == ["hero-journey", "hero-search"] and "hero-science" in d["cta"] and "hero-atlas" in d["cta"], f"landing: 'Start with a discovery' added beside the existing actions ({d['cta']})")
        check([r[0] for r in d["row"]] == ["English", "বাংলা", "Español", "Français"] and d["row"][1][1] == "bn" and d["row"][0][2] == "true", "landing: language row with native names and lang attributes")
        base0 = pg.evaluate("({w: JSON.stringify(S.weights), tid: S.targetId, top: S.res.distinct[0], score: S.res.eff[S.res.distinct[0]]})")
        # ---------------------------------------------------------------- open, stories = recomputed results
        pg.click("#hero-journey"); pg.wait_for_selector("#jn:not([hidden]) .jn-story")
        pg.evaluate("a4Load()"); pg.wait_for_function("document.querySelector('[data-story=shackleton]')", timeout=60000)
        st = pg.evaluate("""(() => { const W = S.app.profiles.general.weights, top = tid => { const eff = effectiveFor(tid, W), o = ENG.order(eff, S.cell); return ENG.distinctSites(o, S.lat, S.lon, 1, 300)[0]; };
          const js = JN.stories, by = id => js.find(s => s.id === id);
          return { mars: [by('mars_top').i, top('mars_jezero')], moon: [by('moon_top').i, top('moon_south_pole')], shack: [by('shackleton').i, top('moon_shackleton')],
            marsTxt: document.querySelector('[data-story=mars_top]').textContent, marsPlace: placeStr(top('mars_jezero')), marsScore: fmtPct(effectiveFor('mars_jezero', W)[top('mars_jezero')]),
            thermal: by('thermal').C, lstMax: (() => { let m = -1e9; for (const v of S.A.lst_diurnal_range) if (v === v && v > m) m = v; return m; })(), team: by('team').team.unmatchable }; })()""")
        check(st["mars"][0] == st["mars"][1] and st["moon"][0] == st["moon"][1] and st["shack"][0] == st["shack"][1], "stories: the #1 places for Jezero, the Lunar South Pole and Shackleton equal the baseline ranking recomputed in the page")
        check(st["marsPlace"].split(",")[0] in st["marsTxt"] and st["marsScore"] in st["marsTxt"], f"Jezero story names {st['marsPlace']} at {st['marsScore']}")
        check(abs(st["thermal"]["earthMax"] - st["lstMax"]) < 1e-9 and st["thermal"]["structural"] and st["team"] == ["lst_diurnal_range"], f"thermal story: Earth's largest swing {st['lstMax']:.1f} K vs Jezero {st['thermal']['target']:.1f} K (structural); the team story says the same")
        pg.screenshot(path=f"{OUT}/01_discoveries.png")
        # ---------------------------------------------------------------- focus trap and Esc
        inside = pg.evaluate("document.querySelector('#jn').contains(document.activeElement)")
        trap = True
        for _ in range(45):
            pg.keyboard.press("Tab")
            if not pg.evaluate("document.querySelector('#jn').contains(document.activeElement)"): trap = False; break
        for _ in range(5):
            pg.keyboard.press("Shift+Tab")
            if not pg.evaluate("document.querySelector('#jn').contains(document.activeElement)"): trap = False; break
        check(inside and trap, "dialog: focus starts inside and Tab / Shift+Tab never leave it")
        pg.keyboard.press("Escape"); time.sleep(0.3)
        check(pg.evaluate("document.querySelector('#jn').hidden && document.activeElement.id") == "hero-journey", "Esc closes the dialog and returns focus to the button that opened it")
        # ---------------------------------------------------------------- reveal
        pg.click("#hero-journey"); pg.wait_for_selector("[data-story=mars_top] [data-jn=why]")
        pg.click("[data-story=mars_top] [data-jn=why]"); pg.wait_for_selector(".jn-stepcard")
        time.sleep(0.3)
        steps = [pg.evaluate("document.querySelector('.jn-stepcard').dataset.step")]
        for _ in range(6):
            pg.keyboard.press("ArrowRight"); time.sleep(0.15); steps.append(pg.evaluate("document.querySelector('.jn-stepcard').dataset.step"))
        check(steps == ["earth", "target", "agree", "differ", "evidence", "objective", "summary"], f"reveal: seven steps with the arrow keys ({steps})")
        pg.click("[data-jnstep='0']"); pg.click("[data-jn=next]"); pg.click("[data-jn=prev]"); pg.click("[data-jn=skip]")
        check(pg.evaluate("JN.step") == 6 and pg.evaluate("document.activeElement.id") == "jn-step-h", "reveal: Next / Back / Skip to summary, focus moves to the step heading")
        rv = pg.evaluate("(() => { JN.step = 2; jnRender(); const ag = [...document.querySelectorAll('.jn-stepcard .jn-sc')].length; const L = jnLens(); JN.step = 6; jnRender(); return { ag, sim: L.groups.similar.length, verdict: document.querySelector('.jn-verdict').textContent }; })()")
        check(rv["ag"] == rv["sim"] == 4 and "partial analogue" in rv["verdict"] and "4 of 6" in rv["verdict"], f"reveal is tied to the computed lens: {rv['sim']} agreeing conditions; calibrated summary ({rv['verdict'][:70]}…)")
        pg.screenshot(path=f"{OUT}/02_reveal_summary.png")
        # ---------------------------------------------------------------- lens objective switch = baseline rank for that profile
        pg.click("#jn-tab-lens"); pg.click("[data-jnpid=rover]"); time.sleep(0.3)
        lz = pg.evaluate("(() => { const eff = effectiveFor('mars_jezero', S.app.profiles.rover.weights); return { want: rankOf(eff, JN.i), txt: document.querySelector('.jn-verdict').textContent, pid: JN.pid, focus: document.activeElement.dataset.jnpid }; })()")
        check(lz["pid"] == "rover" and f"rank {lz['want']:,}" in lz["txt"] and lz["focus"] == "rover", f"Lens: switching to Rover mobility shows the baseline rank under that profile ({lz['want']})")
        check(pg.evaluate("JSON.stringify(S.weights)") == base0["w"], "switching the journey's objective never changes the workspace weights")
        pg.click("[data-jnpid=general]")
        # ---------------------------------------------------------------- change my mind
        pg.click("#jn-tab-change"); pg.wait_for_function("JN.cm.has(jnCmKey())", timeout=60000); time.sleep(0.3)
        cm = pg.evaluate("""(() => { const R = JN.cm.get(jnCmKey()); let bad = 0;
          for (const a of R.alternatives) { const w = { ...S.app.profiles.general.weights }; for (const x of a.changes) w[x.c] = x.to; const eff = effectiveFor('mars_jezero', w); if (rankOf(eff, JN.i) !== a.rank) bad++; }
          return { n: R.nAlternatives, h: R.nHold, bad, rows: document.querySelectorAll('.jn-alt').length, breaks: document.querySelectorAll('.jn-alt.breaks').length, gm: !!document.querySelector('[data-alt="drop_source:gmted2010"].breaks') }; })()""")
        check(cm["bad"] == 0 and cm["rows"] == cm["n"] and cm["breaks"] == cm["n"] - cm["h"], f"Change my mind: {cm['n']} alternatives, each re-scored in the page to the rank shown; {cm['h']} hold")
        check(cm["gm"], "without GMTED2010 the conclusion breaks (as in the Method Arena)")
        pg.screenshot(path=f"{OUT}/03_change.png")
        # ---------------------------------------------------------------- missing pieces, trust
        pg.click("#jn-tab-missing"); time.sleep(0.2)
        mi = pg.evaluate("[...document.querySelectorAll('[data-miss]')].map(e => e.dataset.miss)")
        check("structural:lst_diurnal_range" in mi and "source_dependence:gmted2010" in mi and "target_proxy:elevation" in mi and mi.index("structural:lst_diurnal_range") < mi.index("resolution"), "Missing pieces: thermal gap first, then proxy and source dependence; each item has a link")
        check(pg.evaluate("[...document.querySelectorAll('[data-miss]')].every(li => li.querySelector('.jn-links a, .jn-links button'))"), "every missing piece links to a dataset, a test, the target measurements or the scoring rule")
        pg.click("[data-miss='source_dependence:gmted2010'] [data-jnsec=change]"); time.sleep(0.3)
        check(pg.evaluate("JN.sec") == "change" and pg.evaluate("!!document.querySelector('[data-alt=\"drop_source:gmted2010\"].flash')"), "a dependence item opens the exact sensitivity result")
        pg.click("#jn-tab-trust"); time.sleep(0.2)
        tr = pg.evaluate("({rows: [...document.querySelectorAll('[data-trust]')].map(e => e.dataset.trust), txt: document.querySelector('#jn-panel').textContent})")
        check(len(tr["rows"]) == 7 and "does not combine these rows into a single trust score" in tr["txt"] and not re.search(r"trust score[^.]*\d", tr["txt"]), "Trust View: seven evidence rows, no combined trust score")
        # ---------------------------------------------------------------- other worlds, time
        pg.click("#jn-tab-worlds"); time.sleep(0.4)
        wd = pg.evaluate("""(() => { const rows = [...document.querySelectorAll('.jn-worlds li')]; const ids = jnTargets();
          const tid = 'moon_shackleton', eff = effectiveFor(tid, S.app.profiles.general.weights);
          const li = document.querySelector('[data-tid="moon_shackleton"]').textContent; return { n: rows.length, want: ids.length, r: rankOf(eff, JN.i), li }; })()""")
        check(wd["n"] == wd["want"] >= 16 and f"#{wd['r']:,}" in wd["li"], f"Other worlds: {wd['n']} targets; Shackleton rank equals the baseline ({wd['r']})")
        pg.click("#jn-tab-time"); time.sleep(0.3)
        tm = pg.evaluate("({pts: document.querySelectorAll('#jn-panel circle').length, years: S.app.stack.years.length})")
        check(tm["pts"] == tm["years"], f"Through time: one point per MODIS year ({tm['pts']})")
        # ---------------------------------------------------------------- passport
        pg.click("#jn-tab-passport"); time.sleep(0.3)
        with pg.expect_download() as dl:
            pg.click("[data-jn=pjson]")
        P = json.load(open(dl.value.path()))
        import tests.test_journey as TJ
        import numpy as np
        i = int(np.nonzero(TJ.CELL == P["place"]["cell_id"])[0][0])
        eff = TJ.field(P["configuration"]["weights"])
        check(P["schema"] == "asterro.passport/1" and abs(eff[i] - P["result"]["analogue_score"]) < 1e-12 and P["result"]["cell_rank"] == TJ.rank_of(eff, i), "Passport JSON re-scored by the independent Python implementation: same score and rank")
        check(P["reproducibility"]["predictor_stack_sha256"] == TJ.APP["stack"]["sha256"] and P["sensitivity"]["alternatives"] == cm["n"] and P["evidence_gaps"], "Passport carries the stack hash, the sensitivity result and the evidence gaps")
        with pg.expect_download() as dl:
            pg.click("[data-jn=ppng]")
        raw = open(dl.value.path(), "rb").read(32)
        w_, h_ = struct.unpack(">II", raw[16:24])
        check(raw[:8] == b"\x89PNG\r\n\x1a\n" and (w_, h_) == (1200, 675), f"Passport image: PNG {w_}×{h_}")
        pg.evaluate("window.__printed = 0; window.print = () => { window.__printed++; }; 0")   # (a string expression that ends in a function would be invoked by Playwright)
        pg.evaluate("document.querySelector('[data-jn=pprint]').click()"); time.sleep(0.2)
        pr = pg.evaluate("[window.__printed, document.body.classList.contains('jn-printing') || window.__printed > 0]")
        check(pr[0] == 1, f"Print calls the browser's print once, with a passport-only print style ({pr})")
        pg.screenshot(path=f"{OUT}/04_passport.png")
        a1 = pg.evaluate(AUDIT)
        pg.click("[data-jn=psave]"); pg.wait_for_function("A4.colPending", timeout=30000)
        sv = pg.evaluate("({kind: A4.colPending.kind, cell: A4.colPending.cell, snap: !!(A4.colPending.snapshot && A4.colPending.snapshot.stack_sha256 && A4.colPending.snapshot.registry_version), view: A3.view, closed: document.querySelector('#jn').hidden})")
        check(sv["kind"] == "earth_cell" and sv["cell"] == P["place"]["cell_id"] and sv["snap"] and sv["view"] == "collections" and sv["closed"], "Save to My Research: an earth_cell item with a provenance snapshot, handed to the Collections view")
        pg.evaluate("A4.colPending = null")
        # ---------------------------------------------------------------- right-panel entry and Discover door
        pg.evaluate("setTab('explore'); select(S.res.distinct[2], false)"); time.sleep(0.5)
        check(pg.locator("#left .jn-explain").count() == 1, "Explore: 'Explain this place' beside Trace / Report for a selected site")
        pg.click("#left .jn-explain"); time.sleep(0.5)
        check(pg.evaluate("JN.open && JN.view === 'place' && JN.i === S.res.distinct[2]"), "'Explain this place' opens the journey for that site")
        pg.keyboard.press("Escape")
        pg.evaluate("setTab('discover')"); time.sleep(0.4)
        check(pg.locator("#left .jn-door [data-jn-open=home]").count() == 1, "Discover tab: a door into the guided discoveries")
        # ---------------------------------------------------------------- languages
        ref = None
        for L in ["en", "bn", "es", "fr"]:
            pg.evaluate(f"setLang('{L}'); I18N.missing.clear(); jnOpen('home')"); time.sleep(0.3)
            texts = [pg.evaluate(TEXT)]
            pg.evaluate("jnOpen('place', {i: JN.stories[0].i, tid: 'mars_jezero', pid: 'general', sec: 'reveal', step: 0})")
            for k in range(7):
                pg.evaluate(f"JN.step = {k}; jnRender()"); texts.append(pg.evaluate(TEXT))
            for s in nav_all(pg):
                texts.append(pg.evaluate(TEXT))
            pg.evaluate("JN.view = 'team'; jnRender()"); texts.append(pg.evaluate(TEXT))
            res = pg.evaluate("(() => { JN.view = 'place'; JN.sec = 'passport'; jnRender(); const P = JN.passport; return { s: P.result, crit: P.criteria.map(c => [c.state, c.similarity]), cm: JN.cm.get(jnCmKey()).alternatives.map(a => a.rank), missing: [...I18N.missing], lang: document.documentElement.lang, big: document.querySelector('.jn-placehead .jn-score b').textContent, chrome: [document.querySelector('#tab-explore').textContent, document.querySelector('#hero-search').textContent] }; })()")
            if L == "en":
                ref = res
                continue
            allt = re.sub(r"\b[a-z]+(-[a-z0-9]+)+-v\d\b|\b[0-9a-f]{12,}\b", " ", " ".join(texts))   # configuration ids and hashes are preserved codes
            words = sorted(set(m.group(0) for m in EN_WORDS.finditer(allt) if m.group(0).lower() not in SAME_WORD.get(L, ())))
            latin = sorted(set(w for w in re.findall(r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9]+", allt) if w not in ALLOWED_LATIN)) if L == "bn" else []
            check(not res["missing"], f"{L}: every journey screen rendered without a fallback key ({res['missing'][:4]})")
            check(not words, f"{L}: no English words left on the journey screens outside preserved terms ({words[:8]})")
            if L == "bn":
                check(not latin, f"bn: no Latin-script words except preserved names, units and codes ({latin[:10]})")
            check(res["lang"] == L, f"{L}: html lang attribute follows the language")
            check(res["s"] == ref["s"] and res["crit"] == ref["crit"] and res["cm"] == ref["cm"], f"{L}: score, rank, per-criterion states and every sensitivity result identical to English")
            want_big = {"bn": "৮৫.০%", "es": "85,0 %", "fr": "85,0 %"}[L]
            check(res["big"] == want_big, f"{L}: locale number format on the score ({res['big']!r})")
            check(res["chrome"][0] != "Explore" and res["chrome"][1] != "Search Earth", f"{L}: header tabs and landing buttons translated ({res['chrome']})")
            if L == "bn":
                pg.screenshot(path=f"{OUT}/05_bn_passport.png")
        pg.evaluate("setLang('en'); jnClose()")
        check(pg.evaluate("document.querySelector('#tab-explore').textContent") == "Explore" and pg.evaluate("document.documentElement.lang") == "en", "switching back to English restores the original labels")
        pg.evaluate("setLang('fr'); setTab('compare')"); time.sleep(0.4)
        check(pg.locator("#i18n-notice").count() == 1 and "anglais" in pg.evaluate("document.querySelector('#i18n-notice').textContent"), "research views show a localised 'English only' notice")
        pg.evaluate("setLang('en')")
        check(pg.locator("#i18n-notice").count() == 0, "no notice in English")
        # ---------------------------------------------------------------- baseline untouched
        base1 = pg.evaluate("({w: JSON.stringify(S.weights), tid: S.targetId, top: S.res.distinct[0], score: S.res.eff[S.res.distinct[0]]})")
        check(base1 == base0, "after the whole journey in four languages the workspace target, weights and #1 result are unchanged")
        for key in ("unnamed", "dupIds", "lowContrast"):
            check(not a1[key], f"a11y journey: no {key} ({a1[key][:3]})")
        # ---------------------------------------------------------------- phone width, every language, reduced motion
        c2 = b.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
        m = c2.new_page(); m.set_default_timeout(60000)
        m.on("pageerror", lambda e: errors.append("mobile pageerror: " + str(e)))
        m.goto(URL); m.wait_for_function("S.res && S.res.distinct", timeout=90000)
        anim = None
        for L in ["en", "bn", "es", "fr"]:
            m.evaluate(f"setLang('{L}'); jnOpen('home')"); time.sleep(0.3)
            worst = m.evaluate("Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth")
            m.evaluate("jnOpen('place', {i: JN.stories[0].i, tid: 'mars_jezero', pid: 'general', sec: 'reveal', step: 3})")
            if anim is None:
                anim = m.evaluate("getComputedStyle(document.querySelector('.jn-stepcard')).animationName")
            for s in nav_all(m):
                worst = max(worst, m.evaluate("Math.max(Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth, document.querySelector('.jn-body').scrollWidth - document.querySelector('.jn-body').clientWidth)"))
            m.evaluate("JN.view = 'team'; jnRender()")
            worst = max(worst, m.evaluate("document.querySelector('.jn-body').scrollWidth - document.querySelector('.jn-body').clientWidth"))
            check(worst <= 0, f"phone 390 px, {L}: no horizontal overflow on any journey screen ({worst} px)")
            if L == "bn":
                m.evaluate("JN.view = 'place'; JN.sec = 'lens'; jnRender()"); m.screenshot(path=f"{OUT}/06_phone_bn_lens.png")
            m.evaluate("jnClose()")
        m.evaluate("setLang('es')"); time.sleep(0.2)
        hero_ov = m.evaluate("Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth")
        check(hero_ov <= 0, f"phone 390 px: landing in Spanish has no horizontal overflow ({hero_ov} px)")
        check(anim == "none", f"reduced motion: the reveal does not animate ({anim})")
        q = c2.new_page(); q.goto(URL + "?lang=fr"); q.wait_for_function("S.res && S.res.distinct", timeout=90000); time.sleep(0.3)
        check(q.evaluate("document.documentElement.lang") == "fr" and q.evaluate("document.querySelector('#hero-search').textContent") == "Explorer la Terre", "?lang=fr opens the interface in French")
        b.close()
finally:
    srv.terminate()
check(not errors, "no page errors (" + "; ".join(errors[:4]) + ")")
print(f"\n{'ALL JOURNEY UI CHECKS PASSED' if not fails else str(len(fails)) + ' FAILED'}")
sys.exit(1 if fails else 0)
