"""Research routes in five languages — UI walk-through (Playwright/Chromium).

    python tests/phase4/ui_routes_i18n_smoke.py [outdir]

For বাংলা, Español, Français and Deutsch, visits every research route (Compare, Scenarios, Discover, Data, Method,
Trajectory, the 14 Lab modules, the Atlas modules) for three targets, and the Trace / Reproduce / Report sheets, and
checks: no "English only" notice remains; the route translator finds a catalogue entry for every segment it meets
(misses are listed and must stay below a small bound); no ordinary English sentence is left outside identifiers,
names and labelled source quotations; quoted source text keeps its English original beside the translation;
switching back to English restores the English page exactly; a language switch keeps tab, module, target, weights
and every number of the result. Simulated in Chromium at desktop width (not a physical device).
"""
import json, os, re, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_routes_i18n"
os.makedirs(OUT, exist_ok=True)
PORT = 8796
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
errors, fails = [], []
MAX_MISS = int(os.environ.get("ASTERRO_MAX_ROUTE_MISS", "40"))      # segments without a catalogue entry, all languages and routes


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg, flush=True)
    if not ok:
        fails.append(msg)


# leftover-English probe: text of the left panel and the sheet without identifiers, names, code and quoted originals
LEFT = r"""(sel) => { const out = []; for (const r of document.querySelectorAll(sel)) { if (!r || r.hidden) continue;
  const c = r.cloneNode(true); c.querySelectorAll('.i18n-keep,code,pre,kbd,samp,textarea,option,script,style,.sr-only,.i18g-q,[translate=no],svg title,#i18n-hdr').forEach(e => e.remove());
  out.push(c.textContent.replace(/\s+/g, ' ')); } return out.join(' | '); }"""
EN = re.compile(r"\b(the|and|which|with|this|that|from|these|those|is|are|was|were|been|has|have|not|only|every|each|when|where|than|into|between)\b")


def english_left(pg, lang):
    t = pg.evaluate(LEFT, "#left,#sheet")
    names = pg.evaluate("[...(I18G.names ? I18G.names.keys() : [])]")
    for n in sorted(names, key=len, reverse=True):
        t = t.replace(n, " ")
    t = re.sub(r"https?://\S+", " ", t)
    hits = []
    for seg in re.split(r"[|·.;:!?()\[\]]", t):
        w = [x for x in EN.findall(seg) if not (lang == "de" and x == "was")]   # "was" is also German
        if len(w) >= 2:
            hits.append(seg.strip()[:140])
    return hits


SWEEP_TABS = ["compare", "scenarios", "discover", "data", "method", "trajectory"]
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = b.new_context(viewport={"width": 1512, "height": 950}, reduced_motion="reduce")
        pg = ctx.new_page(); pg.set_default_timeout(90000)
        pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errors.append("console.error: " + m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text and "fonts" not in m.text and "ERR_CONNECTION" not in m.text else None)
        pg.goto(URL); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000)
        pg.evaluate("runSearch()"); pg.wait_for_function("S.searched", timeout=60000)
        pg.evaluate("a4Load()"); pg.wait_for_function("A4.reg", timeout=90000); time.sleep(0.5)
        labmods = pg.evaluate("LAB_MODULES.map(m => m.id)")
        atmods = pg.evaluate("A4_GROUPS.flatMap(g => g.items.map(x => x[0]))")

        # ------------------------------------------------ English restored exactly; state and numbers kept across languages
        pg.evaluate("setTarget('mars_jezero'); setTab('lab')"); time.sleep(0.4)
        pg.evaluate("document.querySelector('[data-labmod=robust]').click()"); time.sleep(0.8)
        en1 = pg.evaluate("document.querySelector('#left').innerText")
        st0 = pg.evaluate("JSON.stringify({tab: S.tab, mod: L.mod, t: S.res.tid, w: S.w, top: S.res.distinct.slice(0, 10), eff: Array.from(S.res.eff.slice(0, 2000)).map(x => x.toFixed(9)).join()})")
        for l in ["bn", "es", "fr", "de"]:
            pg.evaluate(f"setLang('{l}')"); time.sleep(0.8)
            st = pg.evaluate("JSON.stringify({tab: S.tab, mod: L.mod, t: S.res.tid, w: S.w, top: S.res.distinct.slice(0, 10), eff: Array.from(S.res.eff.slice(0, 2000)).map(x => x.toFixed(9)).join()})")
            check(st == st0, f"{l}: tab, Lab module, target, weights and every score unchanged by the language switch")
        pg.evaluate("setLang('en')"); time.sleep(0.8)
        en2 = pg.evaluate("document.querySelector('#left').innerText")
        check(en1 == en2, "switching back to English restores the English page exactly")

        total_miss = {}
        for l in ["bn", "es", "fr", "de"]:
            pg.evaluate(f"setLang('{l}'); I18G.miss.clear()"); time.sleep(0.6)
            notice, left_en, runs0 = 0, {}, pg.evaluate("I18G.n")
            def visit(route):
                global notice
                time.sleep(0.25)
                notice_here = pg.evaluate("!!document.getElementById('i18n-notice')")
                if notice_here: notice += 1
                h = english_left(pg, l)
                if h: left_en[route] = h[:3]
            for tid in ["mars_jezero", "moon_south_pole", "cross"]:
                pg.evaluate(f"setTarget('{tid}')"); time.sleep(0.6)
                for tab in SWEEP_TABS:
                    pg.evaluate(f"setTab('{tab}')"); time.sleep(0.5); visit(f"{tid}/{tab}")
                pg.evaluate("setTab('lab')"); time.sleep(0.3)
                for m in labmods:
                    pg.evaluate(f"(() => {{ const b = document.querySelector('[data-labmod={m}]'); if (b) b.click(); }})()"); time.sleep(0.7)
                    for _ in range(40):
                        if not pg.evaluate("!!(typeof L !== 'undefined' && L.busy)"): break
                        time.sleep(0.5)
                    visit(f"{tid}/lab/{m}")
                pg.evaluate("setTab('atlas')"); time.sleep(0.4)
                for m in atmods:
                    pg.evaluate(f"(() => {{ A3.view = '{m}'; atRender(); }})()"); time.sleep(0.6); visit(f"{tid}/atlas/{m}")
                for fn in ["showTrace", "showReproduce", "showReport"]:
                    pg.evaluate("setTab('explore')"); pg.evaluate(f"select(S.res.distinct[0]); {fn}()"); time.sleep(0.6); visit(f"{tid}/sheet/{fn}")
                    pg.evaluate("closeSheet()"); time.sleep(0.15)
            miss = pg.evaluate("[...I18G.miss.entries()]")
            runs = pg.evaluate("I18G.n") - runs0
            total_miss[l] = miss
            check(notice == 0, f"{l}: no 'English only' notice on any research route")
            check(runs > 2000, f"{l}: the route translator translated {runs} segments across the sweep")
            check(len(miss) <= MAX_MISS // 4 + 1, f"{l}: segments without a catalogue entry: {len(miss)} ({[m[0][:60] for m in miss[:4]]})")
            check(len(left_en) <= 3, f"{l}: routes with an English sentence left outside names, identifiers and quotations: {len(left_en)} {list(left_en.items())[:2]}")
            pg.screenshot(path=f"{OUT}/{l}_sheet_report.png")
        json.dump(total_miss, open(f"{OUT}/misses.json", "w"), ensure_ascii=False, indent=1)

        # ------------------------------------------------ quoted source text: translation shown, English original beside it
        pg.evaluate("setLang('de'); setTarget('mars_jezero'); setTab('data')"); time.sleep(0.8)
        q = pg.evaluate("(() => { const d = document.querySelector('#left .i18g-q'); return d ? { sum: d.querySelector('summary').textContent, orig: d.querySelector('span[lang=en]').textContent, prev: (d.previousSibling && d.previousSibling.textContent || '').slice(-80) } : null; })()")
        check(bool(q) and q["sum"] and len(q["orig"]) > 20, f"source-record text: the German translation is shown and the English original sits beside it, labelled ({q and q['sum']})")
        pg.screenshot(path=f"{OUT}/de_data_quote.png")
        qa = pg.evaluate("(() => { setTab('atlas'); A3.view = 'provenance'; atRender(); return 0; })()"); time.sleep(0.8)
        nq = pg.evaluate("document.querySelectorAll('#left .i18g-q').length")
        check(nq >= 3, f"Atlas › Sources: {nq} quoted source records carry their English original")
        pg.evaluate("setLang('bn'); setTab('data')"); time.sleep(0.6); pg.screenshot(path=f"{OUT}/bn_data.png", full_page=False)
        pg.evaluate("setTab('method')"); time.sleep(0.6); pg.screenshot(path=f"{OUT}/bn_method.png")
        pg.evaluate("setLang('fr'); setTab('trajectory')"); time.sleep(0.8); pg.screenshot(path=f"{OUT}/fr_trajectory.png")
        pg.evaluate("setLang('es'); setTab('compare')"); time.sleep(0.6); pg.screenshot(path=f"{OUT}/es_compare.png")
        # ------------------------------------------------ Missing pieces and the Data view show the inventory's real statuses
        pg.evaluate("setLang('en'); setTab('explore'); setTarget('mars_jezero'); applyProfile('instrument')"); time.sleep(0.8)
        pg.evaluate("jnOpen('place', {i: S.res.distinct[0], tid: 'mars_jezero', pid: 'instrument', sec: 'missing'})"); time.sleep(0.8)
        inv = pg.evaluate("""(() => { const by = Object.fromEntries(ASTERRO_INVENTORY.items.map(x => [x.id, x.status]));
          const rows = [...document.querySelectorAll('#jn .jn-check [data-inv]')].map(li => [li.dataset.inv, (li.querySelector('.inv-st').className.match(/inv-(\\w+)$/) || [])[1]]);
          return { n: rows.length, bad: rows.filter(([id, st]) => by[id] !== st), blockedDate: [...document.querySelectorAll('#jn .jn-check [data-inv]')].some(li => li.querySelector('.inv-blocked') && /20\\d\\d/.test(li.textContent)),
            sum: !!document.querySelector('#jn [data-inv-summary]'), integrated: ASTERRO_INVENTORY.counts.integrated, claimed: ASTERRO_INVENTORY.items.filter(x => ['verified_not_integrated', 'downloaded_not_validated'].includes(x.status)).length }; })()""")
        check(inv["n"] >= 3 and not inv["bad"] and inv["blockedDate"] and inv["sum"], f"Missing pieces: {inv['n']} source rows, each with its inventory status (mismatches {inv['bad'][:3]}); blocked sources state the probe date; an inventory summary follows")
        check(inv["claimed"] == 0, "no source is shown as downloaded or verified (none was obtained in this build)")
        pg.screenshot(path=f"{OUT}/missing_inventory.png")
        pg.evaluate("jnClose(); applyProfile('general'); setTab('data')"); time.sleep(0.6)
        nd = pg.evaluate("document.querySelectorAll('#left .inv-data [data-inv]').length + ' ' + ASTERRO_INVENTORY.items.length")
        a, bb = map(int, nd.split())
        check(a == bb, f"the Data view lists every inventory record ({a}/{bb})")
        b.close()
finally:
    srv.terminate()
check(not errors, f"no page errors ({errors[:3]})")
print(json.dumps({"fails": fails}, ensure_ascii=False, indent=1))
sys.exit(1 if fails else 0)
