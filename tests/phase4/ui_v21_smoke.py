"""ASTERRO V20.1 visual shell in the browser (Playwright/Chromium).

    python tests/phase4/ui_v21_smoke.py [outdir]

1. Desktop: the navigation rail (Home, five groups, Settings) is shown and each group opens the navigation at that group;
   the context panel and the rail are deep navy; the globe viewport is the widest region (at least 55 % of the width)
   and the ranking floats over it without covering the floating globe controls.
2. Destinations: the picker lists the catalogued Mars (18) and Moon (15) targets from data/registry.json with their
   thumbnails; an explorable target opens on the globe with the existing target code; a readiness-2 target is Atlas
   only; "Open in the Atlas" opens that target in the Atlas; Escape closes and returns focus.
3. Text contrast: every text in the panels, console, dialogs and the picker meets WCAG AA on its navy background, across
   nineteen views.
4. Phone: no rail; the target switch, tabs and header fit without sideways scroll; panels are navy.
5. The six-dimensional result is unchanged and no page error occurs.
"""
import os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_v21_smoke"
os.makedirs(OUT, exist_ok=True)
PORT = 8827
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
errors, fails = [], []
CONTRAST = r"""() => {
 const lum = c => { const a = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; };
 const rgb = s => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(s); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; };
 const bgOf = e => { let c = [11,29,58]; const chain = []; for (let n = e; n; n = n.parentElement) chain.push(n); for (const n of chain.reverse()) { const b = rgb(getComputedStyle(n).backgroundColor); if (b && b[3] > 0) c = c.map((v, i) => v * (1 - b[3]) + b[i] * b[3]); } return c; };
 const out = [];
 for (const e of document.querySelectorAll('#left *, #right *, .console *, #jn *, #sheet *, #v21-dest *, #v20-set *, #ds-acard *')) {
   if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') continue;
   const own = [...e.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim()); if (!own) continue;
   const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity < .3) continue;
   if (e.closest('svg,canvas,[aria-hidden=true],button:disabled,[disabled]')) continue;
   const f = rgb(cs.color); if (!f) continue; const b = bgOf(e);
   const fc = f.slice(0,3).map((v,i) => v * f[3] + b[i] * (1 - f[3]));
   const L1 = lum(fc), L2 = lum(b), r = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
   const big = parseFloat(cs.fontSize) >= 18.5 || (parseFloat(cs.fontSize) >= 14 && +cs.fontWeight >= 600);
   if (r < (big ? 3 : 4.5)) out.push([e.tagName.toLowerCase() + '.' + String(e.className).split(' ').slice(0,2).join('.'), cs.color, 'bg ' + b.map(Math.round).join(','), r.toFixed(2), e.textContent.trim().slice(0, 30)]);
 }
 return out; }"""


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg, flush=True)
    if not ok: fails.append(msg)


def boot(pg):
    pg.goto(URL); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000); time.sleep(0.8)


NAVY = "rgb(11, 29, 58)"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, geolocation={"latitude": -23.65, "longitude": -68.16}, permissions=["geolocation"])
        pg = ctx.new_page(); pg.set_default_timeout(120000); pg.on("pageerror", lambda e: errors.append(str(e)))
        boot(pg)
        r = pg.evaluate("({rail: !!document.querySelector('#v21-rail') && document.querySelector('#v21-rail').offsetWidth, groups: [...document.querySelectorAll('#v21-rail [data-v21rail]')].map(b => b.dataset.v21rail), home: !!document.querySelector('#v21-rail [data-v20home]'), bg: getComputedStyle(document.querySelector('#v21-rail')).backgroundColor})")
        check(r["rail"] and r["rail"] <= 90 and r["groups"] == ["discover", "analyze", "plan", "evidence", "trust", "settings"] and r["home"] and r["bg"] == NAVY, f"desktop rail: Home, five groups, Settings, deep navy ({r})")
        base = pg.evaluate("(async () => { await runSearch(); return S.res.distinct.slice(0, 10).map(i => [i, +S.res.eff[i].toFixed(6)]); })()"); time.sleep(1.5)
        g = pg.evaluate("""(() => { const R = e => e.getBoundingClientRect(); const v = R(document.querySelector('#viewport')), l = R(document.querySelector('#left')), r = R(document.querySelector('#right'));
          const ctl = [...document.querySelectorAll('#viewport .vp-top, #viewport .jl-chip, #viewport .ds-paneltog')].map(R);
          return { vw: v.width, lw: l.width, iw: innerWidth, rightIn: r.left >= v.left && r.right <= v.right + 1, overlap: ctl.filter(c => c.right > r.left + 1 && c.bottom > r.top + 1 && c.top < r.bottom).length,
            lbg: getComputedStyle(document.querySelector('#left')).backgroundColor, rbg: getComputedStyle(document.querySelector('#right')).backgroundColor, proj: S.proj }; })()""")
        check(g["vw"] >= 0.55 * g["iw"] and g["vw"] > 2 * g["lw"] and g["proj"] == 0, f"the globe is the centre: viewport {g['vw']:.0f} of {g['iw']} px, context panel {g['lw']:.0f} px, 3D globe")
        check(g["rightIn"] and g["overlap"] == 0, f"the ranking floats over the globe without covering a globe control ({g['overlap']} overlaps)")
        check(g["lbg"] == NAVY and g["rbg"].startswith("rgba(11, 29, 58") , f"context panel and ranking are deep navy ({g['lbg']}, {g['rbg']})")
        pg.screenshot(path=os.path.join(OUT, "01_globe_1440.png"))
        bad = []
        for grp in ["discover", "analyze", "plan", "evidence", "trust"]:
            pg.click(f"#v21-rail [data-v21rail={grp}]"); time.sleep(0.3)
            s = pg.evaluate("({open: !document.querySelector('#v20-nav').hidden, grp: (document.activeElement.closest('[data-v20group]') || {}).dataset ? document.activeElement.closest('[data-v20group]').dataset.v20group : null})")
            if not (s["open"] and s["grp"] == grp): bad.append((grp, s))
            pg.keyboard.press("Escape"); time.sleep(0.2)
            if not pg.evaluate(f"document.activeElement.matches('#v21-rail [data-v21rail={grp}]')"): bad.append((grp, "focus"))
        check(not bad, f"each rail group opens the navigation at that group and Escape returns focus ({bad})")
        pg.click("#v21-rail [data-v21rail=settings]"); time.sleep(0.3)
        check(not pg.evaluate("document.querySelector('#v20-set').hidden"), "the rail opens Settings"); pg.keyboard.press("Escape")
        # ------------------------------------------------------------------ destinations
        pg.click("#v21-all"); pg.wait_for_function("document.querySelectorAll('#v21-dest .v21-d').length > 2", timeout=30000)
        d = pg.evaluate("({n: document.querySelectorAll('#v21-dest .v21-d').length, imgs: [...document.querySelectorAll('#v21-dest .v21-d img')].filter(i => i.complete && i.naturalWidth > 0).length, focus: document.activeElement.id, cur: (document.querySelector('#v21-dest [aria-current=true] h3') || {}).textContent})")
        check(d["n"] == 18 and d["focus"] == "v21-dest-title" and d["cur"] == "Jezero Crater", f"Mars destinations: 18 catalogued targets, current marked ({d})")
        pg.screenshot(path=os.path.join(OUT, "02_destinations_mars_1440.png"))
        dis = pg.evaluate("({dis: [...document.querySelectorAll('#v21-dest [data-v21go]')].filter(b => b.disabled).length, l2: document.querySelectorAll('#v21-dest .v21-lv').length})")
        check(dis["dis"] == 16, f"Mars targets below readiness 3 are Atlas only ({dis})")
        pg.click("[data-v21body=Moon]"); time.sleep(0.4)
        m = pg.evaluate("document.querySelectorAll('#v21-dest .v21-d').length")
        check(m == 15, f"Moon destinations: 15 catalogued targets ({m})")
        pg.screenshot(path=os.path.join(OUT, "03_destinations_moon_1440.png"))
        pg.click("[data-v21go=moon_shackleton]"); pg.wait_for_function("S.targetId === 'moon_shackleton'", timeout=60000); time.sleep(0.6)
        check(pg.evaluate("S.tab === 'explore' && document.querySelector('#v21-dest').hidden"), "choosing Shackleton opens it on the globe through the existing target code")
        pg.evaluate("setTarget('mars_jezero')"); time.sleep(0.6)
        pg.click("#v21-all"); pg.wait_for_function("document.querySelectorAll('#v21-dest .v21-d').length > 2")
        pg.click("[data-v21atlas=mars_gusev]"); time.sleep(2)
        check(pg.evaluate("S.tab === 'atlas' && A3.active === 'mars_gusev'"), "Open in the Atlas opens that target in the Atlas")
        pg.click("#v21-all"); time.sleep(0.4); pg.keyboard.press("Escape"); time.sleep(0.2)
        check(pg.evaluate("document.querySelector('#v21-dest').hidden && document.activeElement.id === 'v21-all'"), "Escape closes the picker and returns focus")
        # ------------------------------------------------------------------ contrast across views
        low = {}
        views = ["setTab('explore'); select(S.res.distinct[0])", "setTab('discover')", "setTab('atlas')", "setTab('lab')", "setTab('local'); document.querySelector('#li-geo').click()", "setTab('compare')", "setTab('scenarios')", "setTab('trajectory')", "setTab('method')", "setTab('data')",
                 "V20_GO.lens()", "V20_GO.portfolio()", "V20_GO.passport()", "V20_GO.trace()", "V20_GO.journal()", "V20_GO.profiles()", "V20_GO.robust()", "v20OpenSheet('set')", "v21OpenDest()"]
        for js in views:
            pg.evaluate(js); time.sleep(1.6)
            for row in pg.evaluate(CONTRAST): low.setdefault(row[0] + " " + row[1], row[2:])
            pg.evaluate("if (typeof jnClose === 'function') jnClose(); if (typeof closeSheet === 'function') closeSheet(); v20Close(true); v21CloseDest(true)")
        check(not low, f"every text meets WCAG AA on its background across {len(views)} views ({list(low.items())[:4]})")
        after = pg.evaluate("(() => { setTarget('mars_jezero'); setTab('explore'); return S.res.distinct.slice(0, 10).map(i => [i, +S.res.eff[i].toFixed(6)]); })()")
        check(after == base, "the six-dimensional result is unchanged")
        ctx.close()
        # ------------------------------------------------------------------ phone
        for vw, vh in [(320, 640), (390, 844), (700, 760), (844, 390)]:
            c2 = b.new_context(viewport={"width": vw, "height": vh}, is_mobile=vw < 768, has_touch=vw < 768); q = c2.new_page(); q.on("pageerror", lambda e: errors.append(str(e)))
            boot(q)
            hx = q.evaluate("(() => { const h = document.querySelector('#hero'); return h.scrollWidth - h.clientWidth; })()")
            check(hx <= 1, f"{vw}x{vh}: the opening screen has no hidden sideways overflow ({hx} px)")
            q.evaluate("runSearch()"); q.wait_for_function("S.searched"); time.sleep(1)
            ph = q.evaluate("""(() => ({ rail: document.querySelector('#v21-rail').offsetParent !== null, ov: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
              tgt: [...document.querySelectorAll('.target-ctl button')].map(b => { const r = b.getBoundingClientRect(); return r.width > 40 && r.right <= innerWidth + 1 && r.height >= 36; }),
              lbg: getComputedStyle(document.querySelector('#left')).backgroundColor, proj: S.proj, gh: document.querySelector('#viewport').getBoundingClientRect().height }))()""")
            check(not ph["rail"] and ph["ov"] <= 1 and all(ph["tgt"]) and ph["lbg"] == NAVY and ph["proj"] == 0, f"{vw}x{vh}: no rail, no sideways scroll, target switch fits, navy panels, globe ({ph})")
            q.screenshot(path=os.path.join(OUT, f"04_phone_{vw}x{vh}.png")); c2.close()
        b.close()
    check(not errors, f"no page error ({errors[:3]})")
finally:
    srv.terminate()
print(f"{len(fails)} V20.1 shell checks failed" if fails else "all V20.1 shell checks passed")
sys.exit(1 if fails else 0)
