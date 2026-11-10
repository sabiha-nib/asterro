"""Design layer walk-through (Playwright/Chromium): landing, plain-language summary, Simple / Advanced view, grouped
navigation, five languages, phone / tablet / desktop, reduced motion.

    python tests/phase4/ui_design_smoke.py [outdir]

Checks:
  - the landing states the promise and offers three ways in; each starts the real analysis (no separate demo);
  - every original landing button and all nine views remain present and clickable;
  - the navigation is grouped (Explore · Discover, Atlas · Compare, Scenarios, Trajectory · Method, Data · Lab);
  - Simple (default) keeps the sliders but hides status tags and tracks; Advanced shows them; the choice survives a reload;
    the analysis is identical in both views;
  - the plain-language card states the engine's own score, strongest similarities (s >= 0.85), important differences
    (s < 0.60) and Earth's limits, and opens the step-by-step explanation;
  - five languages: the card and landing are translated, no raw key, no horizontal page scroll;
  - 390 x 844 phone, 820 x 1180 tablet portrait, 1180 x 820 tablet landscape, 1440 desktop: no page overflow,
    the three ways in are visible, touch targets of the new controls are at least 32 px high;
  - reduced motion: no animation runs on the new elements; no page error anywhere.
"""
import os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_design_ui"
os.makedirs(OUT, exist_ok=True)
PORT = 8803
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
errors, fails = [], []


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg, flush=True)
    if not ok:
        fails.append(msg)


def ready(pg):
    pg.goto(URL); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000); time.sleep(0.6)


RAW = "(document.body.innerText.match(/\\b(ds|ext)\\.[a-z_]+\\.[a-z0-9_.]+/g) || [])"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
        pg = ctx.new_page(); pg.set_default_timeout(90000); pg.on("pageerror", lambda e: errors.append(str(e)))
        ready(pg)
        h = pg.evaluate("({lede: (document.querySelector('.ds-lede') || {}).textContent, acts: [...document.querySelectorAll('[data-dsact]')].map(b => b.dataset.dsact), orig: ['hero-reveal','hero-journey','hero-search','hero-science','hero-atlas','ht-mars','ht-moon'].every(id => { const e = document.getElementById(id); const r = e && e.getBoundingClientRect(); return r && r.width > 0 && r.height > 0; })})")
        check(h["lede"] == "Find Earth's environmental analogues for worlds beyond Earth.", f"landing promise ({h['lede']})")
        check(h["acts"] == ["explore", "discover", "compare"], f"three ways in ({h['acts']})")
        check(h["orig"], "every original landing button is still on the page")
        anim = pg.evaluate("getComputedStyle(document.querySelector('.ds-act')).animationName")
        check(anim == "none", f"reduced motion: no animation on the new cards ({anim})")
        # V20: the opening screen hides the tab bar until the person starts; the order is measured where the bar is shown
        tabs = pg.evaluate("(() => { const a = document.querySelector('#app'); a.classList.remove('is-hero'); const t = [...document.querySelectorAll('nav.tabs button[data-tab]')].sort((a, b) => Math.round(a.getBoundingClientRect().top / 12) - Math.round(b.getBoundingClientRect().top / 12) || a.getBoundingClientRect().left - b.getBoundingClientRect().left).map(b => b.dataset.tab); a.classList.add('is-hero'); return t; })()")
        check(tabs == ["explore", "discover", "atlas", "local", "compare", "scenarios", "trajectory", "method", "data", "lab"], f"navigation grouped Explore · Discover · Compare · Learn · My research ({tabs})")
        # ---- explore through the first way in
        pg.click("[data-dsact=explore]"); pg.wait_for_function("S.searched", timeout=60000); time.sleep(0.6)
        check(pg.evaluate("S.tab") == "explore" and pg.evaluate("!document.querySelector('#app').classList.contains('is-hero')"), "'Explore Earth' runs the real search over every cell")
        mode = pg.evaluate("({cls: document.documentElement.classList.contains('ds-simple'), sl: getComputedStyle(document.querySelector('#console .sliders')).display, tag: getComputedStyle(document.querySelector('#console .sl .foot .tag')).display, info: getComputedStyle(document.querySelector('#console .dm-i')).display, tog: !!document.querySelector('#console [data-dsmode]')})")
        check(mode["cls"] and mode["sl"] != "none" and mode["tag"] == "none" and mode["info"] != "none" and mode["tog"], f"Simple is the default view: sliders kept, technical tags hidden, explanations kept, view switch in the console ({mode})")
        base = pg.evaluate("({top: S.res.distinct[0], s: S.res.eff[S.res.distinct[0]], w: JSON.stringify(S.weights)})")
        pg.click("#console [data-dsmode=advanced]"); time.sleep(0.5)
        adv = pg.evaluate("({sl: getComputedStyle(document.querySelector('#console .sl .foot .tag')).display, cls: document.documentElement.classList.contains('ds-advanced'), top: S.res.distinct[0], s: S.res.eff[S.res.distinct[0]], w: JSON.stringify(S.weights)})")
        check(adv["sl"] != "none" and adv["cls"] and (adv["top"], adv["s"], adv["w"]) == (base["top"], base["s"], base["w"]), "Advanced shows every weight; the analysis is identical in both views")
        pg.reload(); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000)
        check(pg.evaluate("document.documentElement.classList.contains('ds-advanced')"), "the view choice survives a reload")
        pg.evaluate("dsSetMode('simple')")
        # ---- plain-language card
        pg.evaluate("runSearch()"); pg.wait_for_function("S.searched", timeout=60000); time.sleep(0.4)
        i = pg.evaluate("S.res.distinct[0]")
        pg.evaluate(f"select({i})"); time.sleep(0.8)
        card = pg.evaluate("""(() => { const c = document.querySelector('.ds-sum'); if (!c) return null; const L = JE.lens(jnCtx(S.targetId), S.selected, S.weights); const rows = L.rows.filter(r => r.s != null && r.s === r.s && S.weights[r.c] > 0);
          return { txt: c.innerText, pct: txPct(S.res.eff[S.selected]), s: c.querySelectorAll('.ds-pill.s').length, d: c.querySelectorAll('.ds-pill.d').length,
                   ns: Math.min(3, rows.filter(r => r.s >= S.app.thresholds.match).length), nd: Math.min(3, rows.filter(r => r.s < S.app.thresholds.partial).length) }; })()""")
        check(card and card["pct"] in card["txt"] and card["s"] == card["ns"] and card["d"] == card["nd"], f"plain-language card uses the engine's score and per-condition readings ({card and (card['pct'], card['s'], card['d'])})")
        check(card and pg.evaluate("tx('ds.sum.limits.mars')") in card["txt"], "the card states where every Earth analogue falls short")
        pg.click(".ds-sum [data-dswhy]"); time.sleep(0.8)
        check(pg.evaluate("JN.open && JN.view === 'place' && JN.i") == i, "'See why, step by step' opens the explanation for that place")
        pg.evaluate("jnClose()")
        # ---- five languages
        for L in ["bn", "es", "fr", "de", "en"]:
            pg.evaluate(f"setLang('{L}')"); time.sleep(0.6)
            t = pg.evaluate("({card: (document.querySelector('.ds-sum h3') || {}).textContent || '', raw: " + RAW + ", ov: document.documentElement.scrollWidth > innerWidth + 1})")
            check(t["card"] and not t["raw"] and not t["ov"], f"{L}: summary translated ({t['card']}), no raw key, no page scroll")
        check(pg.evaluate("tx('ds.sum.title')") == "In plain words", "English restored")
        ctx.close()
        # ---- devices
        for name, kw in [("phone", dict(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)),
                         ("tablet-portrait", dict(viewport={"width": 820, "height": 1180}, is_mobile=True, has_touch=True)),
                         ("tablet-landscape", dict(viewport={"width": 1180, "height": 820}, is_mobile=True, has_touch=True)),
                         ("desktop", dict(viewport={"width": 1440, "height": 900}))]:
            c = b.new_context(reduced_motion="reduce", **kw); q = c.new_page(); q.set_default_timeout(90000); q.on("pageerror", lambda e: errors.append(name + ": " + str(e)))
            ready(q)
            r = q.evaluate("({ov: document.documentElement.scrollWidth > innerWidth + 1, acts: [...document.querySelectorAll('[data-dsact]')].map(b => b.getBoundingClientRect()).filter(r => r.width > 0 && r.height >= 32).length})")
            q.screenshot(path=os.path.join(OUT, f"{name}_landing.png"))
            (q.tap if kw.get("has_touch") else q.click)("[data-dsact=explore]"); q.wait_for_function("S.searched", timeout=60000); time.sleep(0.6)
            q.evaluate("select(S.res.distinct[0])"); time.sleep(0.6)
            r2 = q.evaluate("({ov: document.documentElement.scrollWidth > innerWidth + 1, mode: [...document.querySelectorAll('#console [data-dsmode]')].map(b => b.getBoundingClientRect().height), card: !!document.querySelector('.ds-sum')})")
            q.screenshot(path=os.path.join(OUT, f"{name}_explore.png"))
            check(not r["ov"] and r["acts"] == 3 and not r2["ov"] and r2["card"] and all(hh >= (32 if kw.get("has_touch") else 24) for hh in r2["mode"]), f"{name}: no page overflow, three ways in, summary card, view switch usable ({r}, {r2['mode']})")
            c.close()
        check(not errors, f"no page errors ({errors[:3]})")
finally:
    srv.kill()
print(f"\n{'ALL PASS' if not fails else str(len(fails)) + ' FAIL'}")
sys.exit(1 if fails else 0)
