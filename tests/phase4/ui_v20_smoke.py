"""ASTERRO V20 interface in the browser (Playwright/Chromium).

    python tests/phase4/ui_v20_smoke.py [outdir]

1. Opening screen: the two-word title (Helvetica word + Playfair Display word), no tab bar until the person starts,
   Menu and Settings visible, the 3D globe is the default projection (also on phones).
2. Navigation: five groups, every destination opens the existing view it names; focus moves into the dialog, stays
   inside it (Tab), and returns to the opener on Escape. The logo returns Home by click and by keyboard.
3. Settings: Terms, Privacy and the Scientific Disclaimer open (also by address #disclaimer); language, motion, text
   size, detail and contrast work and persist; data and offline status with Verify; location privacy (forget saved
   places); About with versions.
4. Local Impact shows the USGS MRDS mineral-occurrence context at the Atacama example, labelled "not NASA".
5. Design: the prohibited-element audit (ui_design_audit.py) passes on the opening screen and with each dialog open;
   glass appears only on [data-glass] surfaces; only Helvetica-family and Playfair Display faces are used.
6. Every listed viewport (320 to 1920 px, portrait and landscape): no sideways scroll on the opening screen, after a
   search and with the menu open; the globe stays the default; screenshots are written to the output folder.
7. The six-dimensional result is unchanged and no page error occurs.
"""
import os, re, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_v20_smoke"
os.makedirs(OUT, exist_ok=True)
PORT = 8826
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
AUDIT = re.search(r'AUDIT = r"""(.*?)"""', open(os.path.join(ROOT, "tests/phase4/ui_design_audit.py")).read(), re.S).group(1)
ATACAMA = {"latitude": -23.65432, "longitude": -68.15678, "accuracy": 1200}
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
errors, fails = [], []
DEST = {"globe": ("explore", None), "discovery": ("discover", None), "targets": ("atlas", None), "atlas": ("atlas", None), "lab": ("lab", None),
        "local": ("local", None), "compare": ("compare", None), "lens": (None, "place/lens"), "character": ("discover", None), "robust": ("lab", None),
        "portfolio": (None, "portfolio"), "trajectory": ("trajectory", None), "profiles": (None, "missions"), "scenarios": ("scenarios", None),
        "passport": (None, "place/passport"), "trace": (None, "sheet"), "reproduce": (None, "sheet"), "reports": ("lab", None), "journal": (None, "journal"),
        "catalogue": ("data", None), "sources": ("data", None), "gaps": ("data", None), "trustc": (None, "place/trust"), "method": ("method", None), "home": (None, "hero")}
VIEWPORTS = [(320, 640), (360, 740), (375, 812), (390, 844), (414, 896), (430, 932), (768, 1024), (1024, 1366), (1280, 800), (1440, 900), (1920, 1080)]


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg, flush=True)
    if not ok:
        fails.append(msg)


def boot(pg):
    pg.goto(URL); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000); time.sleep(0.8)


def state(pg):
    return pg.evaluate("""() => ({tab: S.tab, hero: document.querySelector('#app').classList.contains('is-hero'),
      jn: typeof JN !== 'undefined' && JN.open ? (JN.view === 'place' ? 'place/' + JN.sec : JN.view) : null,
      sheet: !!document.querySelector('#sheet') && !document.querySelector('#sheet').hidden})""")


def overflow(pg):
    return pg.evaluate("Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth")


def audit(pg, where):
    v = sorted(set(pg.evaluate(AUDIT, None)))
    check(not v, f"{where}: no prohibited design element ({len(v)} found{': ' + '; '.join(v[:6]) if v else ''})")


try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, geolocation=ATACAMA, permissions=["geolocation"])
        pg = ctx.new_page(); pg.set_default_timeout(120000); pg.on("pageerror", lambda e: errors.append(str(e)))
        boot(pg)
        # ------------------------------------------------------------------ 1 opening screen
        h = pg.evaluate("""() => { const h = document.querySelector('#hero h1'), s = h.querySelector('.v20-serif');
          const vis = e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.display !== 'none' && c.visibility !== 'hidden'; };
          return { text: h.innerText.replace(/\\s+/g, ' ').trim(), serif: s && getComputedStyle(s).fontFamily, sans: getComputedStyle(h).fontFamily,
            tabs: vis(document.querySelector('nav.tabs')), targets: vis(document.querySelector('.target-ctl')), menu: vis(document.querySelector('#v20-menu')),
            settings: vis(document.querySelector('#v20-settings')), proj: S.proj, tagline: document.querySelector('#hero').innerText.includes("Find Earth's environmental analogues for worlds beyond Earth."),
            brand: document.querySelector('.brand').getAttribute('role'), oldFonts: [...document.querySelectorAll('link[href*="fonts.googleapis.com"]')].map(l => l.href).filter(u => /Big\\+Shoulders|Instrument|JetBrains/.test(u)).length } }""")
        check(h["text"] == "Planetary Intelligence" and h["serif"].startswith('"Playfair Display"') and h["sans"].startswith("Helvetica"), f"the title is two words, Helvetica and Playfair Display ({h['text']}; {h['serif'][:30]}; {h['sans'][:20]})")
        check(not h["tabs"] and not h["targets"] and h["menu"] and h["settings"], "the opening screen has no tab bar; Menu and Settings are visible")
        check(h["tagline"] and h["brand"] == "link" and h["oldFonts"] == 0, "the ASTERRO tagline is kept, the logo is a link, and no other web font is requested")
        check(h["proj"] == 0, "the 3D globe is the default projection")
        fam = pg.evaluate("""() => [...new Set([...document.querySelectorAll('body *')].filter(e => e.offsetParent !== null && !e.closest('code,pre,kbd,samp,.mono,.hash,svg,canvas,[lang=bn]')).map(e => getComputedStyle(e).fontFamily.split(',')[0].replace(/"/g, '').trim()))]""")
        check(set(fam) <= {"Helvetica", "Playfair Display"}, f"only Helvetica and Playfair Display are used as primary faces; Bengali text adds a Bengali-script face ({fam})")
        audit(pg, "opening screen")
        pg.screenshot(path=os.path.join(OUT, "01_home_1440.png"))
        base = pg.evaluate("(async () => { await runSearch(); return S.res.distinct.slice(0, 10).map(i => [i, +S.res.eff[i].toFixed(6)]); })()")
        pg.evaluate("v20Home()"); time.sleep(0.4)
        # ------------------------------------------------------------------ 2 navigation
        pg.click("#v20-menu"); time.sleep(0.4)
        n = pg.evaluate("({open: !document.querySelector('#v20-nav').hidden, focus: document.activeElement.id, groups: [...document.querySelectorAll('#v20-nav [data-v20group]')].map(g => g.dataset.v20group), dest: document.querySelectorAll('#v20-nav [data-v20go]').length, glass: document.querySelector('#v20-nav .v20-sheet').hasAttribute('data-glass'), modal: document.querySelector('#v20-nav').getAttribute('aria-modal')})")
        check(n["open"] and n["focus"] == "v20-nav-title" and n["groups"] == ["discover", "analyze", "plan", "evidence", "trust"] and n["dest"] == 25 and n["modal"] == "true", f"the menu is a modal dialog with five groups and 25 destinations, focus inside ({n})")
        audit(pg, "navigation dialog")
        pg.screenshot(path=os.path.join(OUT, "02_navigation_1440.png"))
        for _ in range(40): pg.keyboard.press("Tab")
        check(pg.evaluate("!!document.activeElement.closest('#v20-nav')"), "Tab keeps focus inside the menu")
        pg.keyboard.press("Escape"); time.sleep(0.2)
        check(pg.evaluate("document.querySelector('#v20-nav').hidden && document.activeElement.id === 'v20-menu'"), "Escape closes the menu and returns focus to the Menu button")
        bad = []
        for k, (tab, other) in DEST.items():
            pg.evaluate("v20OpenSheet('nav')"); time.sleep(0.15)
            pg.click(f"#v20-nav [data-v20go={k}]"); time.sleep(1.2 if k in ("globe", "targets", "atlas", "local") else 0.6)
            s = state(pg)
            ok = (tab is None or s["tab"] == tab) and (other is None or (other == "hero" and s["hero"]) or (other == "sheet" and s["sheet"]) or s["jn"] == other)
            ok = ok and (k == "home" or not s["hero"])
            if not ok: bad.append((k, s))
            pg.evaluate("if (typeof jnClose === 'function') jnClose(); document.querySelectorAll('.sheet-close, [data-close], #sheet-close').forEach(b => b.offsetParent && b.click());")
            pg.keyboard.press("Escape"); time.sleep(0.1)
        check(not bad, f"every destination opens the view it names ({bad[:3]})")
        check(pg.evaluate("document.querySelector('#app').classList.contains('is-hero')"), "Home returns to the opening screen")
        pg.evaluate("setTab('method')"); time.sleep(0.3); pg.click(".brand"); time.sleep(0.3)
        check(pg.evaluate("document.querySelector('#app').classList.contains('is-hero')"), "the logo returns Home (click)")
        pg.evaluate("setTab('data')"); time.sleep(0.3); pg.focus(".brand"); pg.keyboard.press("Enter"); time.sleep(0.3)
        check(pg.evaluate("document.querySelector('#app').classList.contains('is-hero')"), "the logo returns Home (keyboard)")
        # ------------------------------------------------------------------ 3 settings
        pg.click("#v20-settings"); time.sleep(0.5)
        s = pg.evaluate("[...document.querySelectorAll('#v20-set [data-v20sec]')].map(x => x.dataset.v20sec)")
        check(s == ["legal", "lang", "access", "appear", "data", "loc", "about"], f"Settings: legal, language, accessibility, appearance, data and offline, location privacy, about ({s})")
        audit(pg, "settings dialog")
        pg.screenshot(path=os.path.join(OUT, "03_settings_1440.png"))
        ab = pg.evaluate("document.querySelector('#v20-set [data-v20sec=about]').innerText")
        check("asterro-v20-ui-1.0.0" in ab and "tai-sim-1.0.0" in ab, "About lists the interface and engine versions")
        for k, title in (("terms", "Terms of Service"), ("privacy", "Privacy Policy"), ("disclaimer", "Scientific Disclaimer")):
            pg.evaluate("v20OpenSheet('set')"); time.sleep(0.2); pg.click(f"[data-v20legal={k}]"); time.sleep(0.4)
            t = pg.evaluate("({t: document.querySelector('#ds-legal-title').textContent, open: !document.querySelector('#ds-legal-dlg').hidden, focus: document.activeElement.id})")
            check(t["open"] and t["t"] == title and t["focus"] == "ds-legal-title", f"Settings opens {title}")
            if k == "disclaimer":
                txt = pg.evaluate("document.querySelector('#ds-legal-dlg').innerText")
                check("does not establish geological equivalence" in txt and "NASA does not endorse" in txt, "the Scientific Disclaimer states what a score means and what ASTERRO does not do")
                pg.screenshot(path=os.path.join(OUT, "04_disclaimer_1440.png"))
            pg.keyboard.press("Escape"); time.sleep(0.2)
        pg.evaluate("location.hash = '#disclaimer'"); time.sleep(0.4)
        check(pg.evaluate("document.querySelector('#ds-legal-title').textContent") == "Scientific Disclaimer", "the disclaimer opens by address (#disclaimer)")
        pg.keyboard.press("Escape"); pg.evaluate("history.replaceState(null, '', location.pathname)")
        pg.click("#v20-settings"); time.sleep(0.3)
        pg.click("#v20-set [data-v20lang=de]"); time.sleep(0.4)
        de = pg.evaluate("({h: document.querySelector('#hero h1').innerText.replace(/\\s+/g, ' ').trim(), lang: document.documentElement.lang, set: document.querySelector('#v20-set-title').textContent})")
        pg.click("#v20-set [data-v20lang=en]"); time.sleep(0.4)
        check(de == {"h": "Planetare Intelligenz", "lang": "de", "set": "Einstellungen"} and pg.evaluate("document.documentElement.lang") == "en", f"Settings changes the language ({de})")
        pg.click("#v20-set [data-v20contrast='1']"); pg.click("#v20-set [data-v20large='1']"); pg.click("#v20-set [data-v20still='1']"); time.sleep(0.2)
        pr = pg.evaluate("({c: document.documentElement.classList.contains('v20-contrast'), l: document.documentElement.classList.contains('v20-large'), rot: GLOBE.autoRotate, saved: JSON.parse(localStorage.getItem('asterro.v20.prefs'))})")
        check(pr["c"] and pr["l"] and pr["rot"] is False and pr["saved"] == {"still": True, "large": True, "contrast": True}, f"contrast, text size and globe rotation work and are remembered ({pr})")
        pg.click("#v20-set [data-v20contrast='0']"); pg.click("#v20-set [data-v20large='0']"); pg.click("#v20-set [data-v20mode=advanced]"); time.sleep(0.2)
        check(pg.evaluate("DS.mode") == "advanced" and pg.evaluate("document.querySelector('#v20-set [data-v20mode=advanced]').getAttribute('aria-pressed')") == "true", "Detail switches to Research mode")
        pg.click("#v20-set [data-v20mode=simple]"); pg.evaluate("document.querySelector('#v20-settings').focus(); v20Close(true); v20OpenSheet('set')")
        pg.evaluate("v9xLoad()"); pg.wait_for_function("!!V9X.man", timeout=60000)
        pg.evaluate("v20Render()"); time.sleep(0.3)
        if pg.evaluate("!!document.querySelector('#v20-set [data-v20do=verify]')"):
            pg.click("#v20-set [data-v20do=verify]"); pg.wait_for_function("document.querySelector('#v20-set .v20-msg') && document.querySelector('#v20-set .v20-msg').textContent.length > 5", timeout=30000)
            check("matches its checksum" in pg.evaluate("document.querySelector('#v20-set .v20-msg').textContent"), "Verify stored data checks the stored copy against its checksum")
        else:
            check(False, "the data copy is loaded and can be verified from Settings")
        pg.evaluate("localStorage.setItem('asterro.local.v1', JSON.stringify([{i: 1, name: 'test'}])); v20Render()"); time.sleep(0.2)
        pg.click("#v20-set [data-v20do=forget]"); time.sleep(0.2)
        check(pg.evaluate("localStorage.getItem('asterro.local.v1') === null") and "0" in pg.evaluate("document.querySelector('#v20-set [data-v20sec=loc]').innerText"), "Forget saved places deletes them from this browser")
        pg.keyboard.press("Escape"); time.sleep(0.2)
        check(pg.evaluate("document.activeElement.id") == "v20-settings", "Escape closes Settings and returns focus")
        # ------------------------------------------------------------------ 4 Local Impact: USGS MRDS
        pg.evaluate("setTab('local')"); time.sleep(0.8); pg.click("#li-geo"); pg.wait_for_function("LI.i != null")
        pg.wait_for_function("document.querySelector('[data-v20mrds]') && document.querySelector('[data-v20mrds]').innerText.includes('Records within')", timeout=60000)
        t = pg.evaluate("document.querySelector('[data-v20mrds]').innerText")
        check("not NASA" in t and "68" in t and "Chepica" in t and "12.7 km" in t and "Copper" in t and "not a composition map" in t, "Local Impact shows the USGS MRDS context at the Atacama example, labelled not NASA, with its limits")
        pg.evaluate("(() => { const s = document.querySelector('[data-v20mrds]'), L = document.querySelector('#left'); L.scrollTop += s.getBoundingClientRect().top - L.getBoundingClientRect().top - 8; })()"); time.sleep(0.4)
        pg.screenshot(path=os.path.join(OUT, "05_local_impact_mrds_1440.png"))
        gl = pg.evaluate("[...document.querySelectorAll('*')].filter(e => { const c = getComputedStyle(e); return (c.backdropFilter && c.backdropFilter !== 'none') || (c.webkitBackdropFilter && c.webkitBackdropFilter !== 'none'); }).filter(e => !e.hasAttribute('data-glass')).length")
        check(gl == 0, f"glass appears only on [data-glass] surfaces ({gl} others)")
        after = pg.evaluate("(() => { setTab('explore'); return S.res.distinct.slice(0, 10).map(i => [i, +S.res.eff[i].toFixed(6)]); })()")
        check(after == base, "the six-dimensional result is unchanged after every V20 interaction")
        ctx.close()
        # ------------------------------------------------------------------ 6 viewports, portrait and landscape
        rows = []
        for w, hh in VIEWPORTS:
            for orient, (vw, vh) in (("portrait", (w, hh)), ("landscape", (hh, w))):
                if w >= 1024 and orient == "landscape": continue   # desktop sizes are already landscape
                mob = vw < 768
                c2 = b.new_context(viewport={"width": vw, "height": vh}, is_mobile=mob, has_touch=mob)
                q = c2.new_page(); q.set_default_timeout(120000); q.on("pageerror", lambda e: errors.append(str(e)))
                boot(q)
                o1, proj1 = overflow(q), q.evaluate("S.proj")
                tag = f"{vw}x{vh}"
                if vw in (320, 390, 768, 1024, 1440, 1920) or orient == "landscape" and vw == 844: q.screenshot(path=os.path.join(OUT, f"vp_{tag}_home.png"))
                q.evaluate("v20OpenSheet('nav')"); time.sleep(0.3); o2 = overflow(q)
                tgt = q.evaluate("Math.min(...[...document.querySelectorAll('#v20-nav button')].map(b => b.getBoundingClientRect().height))")
                if vw in (390, 1440): q.screenshot(path=os.path.join(OUT, f"vp_{tag}_menu.png"))
                q.evaluate("v20Close(true)"); q.evaluate("runSearch()"); q.wait_for_function("S.searched"); time.sleep(0.8)
                o3, proj3 = overflow(q), q.evaluate("S.proj")
                if vw in (320, 390, 768, 1024, 1440, 1920) or orient == "landscape" and vw == 844: q.screenshot(path=os.path.join(OUT, f"vp_{tag}_explore.png"))
                rows.append((tag, o1, o2, o3, proj1, proj3, tgt))
                c2.close()
        for tag, o1, o2, o3, p1, p3, tgt in rows:
            check(max(o1, o2, o3) <= 1 and p1 == 0 and p3 == 0 and tgt >= 36, f"{tag}: no sideways scroll (home {o1}, menu {o2}, results {o3}), globe default ({p1}, {p3}), menu targets >= 36 px ({tgt:.0f})")
        b.close()
    check(not errors, f"no page error ({errors[:3]})")
finally:
    srv.terminate()
print(f"{len(fails)} V20 interface checks failed" if fails else "all V20 interface checks passed")
sys.exit(1 if fails else 0)
