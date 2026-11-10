"""Layout sweep of the Atlas and the Research Laboratory at the seven viewports of the Version 15 brief (Playwright/Chromium).

    python tests/phase4/ui_layout_sweep.py [outdir]

At 2048 x 1331, 1920 x 1080, 1440 x 900, 1280 x 800, 1024 x 768, 768 x 1024 and 390 x 844, for the Atlas (with a
selected candidate), the Atlas in Research mode and the Research Laboratory (comparison step, Research mode):
1. no horizontal page scroll;
2. no two visible controls on the globe overlap (buttons, links, selects, chips, the candidate card);
3. no control is clipped by the edge of the window;
4. no squeezed column: no paragraph, list item or table cell of the side panels narrower than 120 px while holding
   more than 24 characters;
5. the globe is the dominant region of the Atlas (widest region on wide screens; full width when the panels stack);
6. the side panels' text meets WCAG AA contrast against the panel colour it is painted on;
7. no page error.
Screenshots of every state are written to outdir.
"""
import os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_layout_sweep"
os.makedirs(OUT, exist_ok=True)
PORT = 8806
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
errors, fails = [], []
VIEWPORTS = [(2048, 1331), (1920, 1080), (1440, 900), (1280, 800), (1024, 768), (768, 1024), (390, 844)]


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


LAYOUT = r"""() => {
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); if (!(r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none')) return false; for (let n = e; n; n = n.parentElement) if (+getComputedStyle(n).opacity < 0.05) return false; return true; };
  const name = e => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '')) + ' "' + (e.textContent || '').trim().slice(0, 24) + '"';
  const out = { overlap: [], clipped: [], squeezed: [], contrast: [] };
  // controls on the globe
  const vp = document.querySelector('#viewport');
  const ctl = [...vp.querySelectorAll('button, a, select, input, .jl-chip, #ds-acard')].filter(vis).filter(e => !e.closest('#ds-acard') || e.id === 'ds-acard');
  for (let a = 0; a < ctl.length; a++) for (let b = a + 1; b < ctl.length; b++) {
    const A = ctl[a], B = ctl[b]; if (A.contains(B) || B.contains(A)) continue;
    const r = A.getBoundingClientRect(), q = B.getBoundingClientRect();
    const ix = Math.min(r.right, q.right) - Math.max(r.left, q.left), iy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
    if (ix > 2 && iy > 2) out.overlap.push(name(A) + ' / ' + name(B));
  }
  // controls clipped by the window
  for (const e of [...document.querySelectorAll('header.bar button, header.bar a, #viewport button, #viewport select, .ds-paneltog')].filter(vis)) {
    const r = e.getBoundingClientRect(); if (r.left < -1 || r.right > innerWidth + 1) out.clipped.push(name(e) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
  }
  // squeezed text in the side panels
  for (const e of document.querySelectorAll('#left p, #left li, #left td, #left dd, #right p, #right li, #ds-acard p, #ds-acard li')) {
    if (!vis(e) || e.closest('.tbl-wrap') && e.tagName === 'TD') continue;
    const r = e.getBoundingClientRect(), t = (e.textContent || '').trim();
    if (r.width < 120 && t.length > 24) out.squeezed.push(name(e) + ' ' + Math.round(r.width) + 'px');
  }
  // contrast of side-panel text against the colour it sits on
  const rgb = c => { const m = c.match(/[\d.]+/g); return m ? m.map(Number) : null; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const bgOf = e => { for (let n = e; n; n = n.parentElement) { const b = rgb(getComputedStyle(n).backgroundColor); if (b && (b.length < 4 || b[3] > 0.9)) return b; if (getComputedStyle(n).backgroundImage !== 'none') return null; } return [255, 255, 255]; };
  const seen = new Set();
  for (const e of document.querySelectorAll('#left *, #right *, #console *, #ds-acard *')) {
    if (!vis(e) || e.closest('canvas, svg, .tbl-wrap .bar, [aria-hidden="true"]')) continue;
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1); if (!own) continue;
    const s = getComputedStyle(e), fg = rgb(s.color), bg = bgOf(e); if (!fg || !bg) continue;
    const a = fg.length > 3 ? fg[3] : 1; const mix = fg.slice(0, 3).map((v, k) => v * a + bg[k] * (1 - a));
    const L1 = lum(mix), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const big = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && +s.fontWeight >= 700);
    if (ratio < (big ? 3 : 4.5)) { const k = name(e); if (!seen.has(k)) { seen.add(k); out.contrast.push(k + ' ' + ratio.toFixed(2)); } }
  }
  const v = vp.getBoundingClientRect(), l = document.querySelector('#left').getBoundingClientRect(), rr = document.querySelector('#right').getBoundingClientRect();
  out.geo = { vw: v.width, vh: v.height, lw: l.width, rw: rr.width, W: innerWidth, H: innerHeight, scroll: document.documentElement.scrollWidth > innerWidth + 1 };
  return out;
}"""


def sweep(pg, where, W, globe):
    o = pg.evaluate(LAYOUT)
    g = o["geo"]
    check(not g["scroll"], f"{where}: no horizontal page scroll")
    check(not o["overlap"], f"{where}: no overlapping controls on the globe ({'; '.join(o['overlap'][:4])})")
    check(not o["clipped"], f"{where}: no control clipped by the window ({'; '.join(o['clipped'][:4])})")
    check(not o["squeezed"], f"{where}: no squeezed text column ({'; '.join(o['squeezed'][:4])})")
    check(not o["contrast"], f"{where}: side-panel text meets WCAG AA contrast ({'; '.join(o['contrast'][:5])})")
    if globe:
        if W > 1180:
            ok = g["vw"] > g["lw"] and g["vw"] > g["rw"] and g["vw"] >= 0.45 * W
        else:
            ok = g["vw"] >= 0.55 * W and g["vh"] >= 300
        check(ok, f"{where}: the globe is the dominant region ({g['vw']:.0f} x {g['vh']:.0f} px; panels {g['lw']:.0f} / {g['rw']:.0f} px)")


try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        for W, H in VIEWPORTS:
            touch = W <= 1024
            kw = dict(viewport={"width": W, "height": H}, is_mobile=W < 800, has_touch=touch)
            ctx = b.new_context(**kw); pg = ctx.new_page(); pg.set_default_timeout(120000)
            pg.on("pageerror", lambda e, d=f"{W}x{H}": errors.append(d + ": " + str(e)))
            tag = f"{W}x{H}"
            pg.goto(URL); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000); time.sleep(0.6)
            check(not pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1"), f"{tag} landing: no horizontal page scroll")
            pg.screenshot(path=os.path.join(OUT, f"{tag}_landing.png"))
            pg.evaluate("runSearch()"); pg.wait_for_function("S.searched", timeout=60000); time.sleep(0.4)
            pg.evaluate("setTab('atlas')"); time.sleep(2.0)
            pg.screenshot(path=os.path.join(OUT, f"{tag}_atlas.png"))
            sweep(pg, f"{tag} atlas", W, True)
            pg.evaluate("select(S.res.distinct[2])"); time.sleep(1.2)
            pg.screenshot(path=os.path.join(OUT, f"{tag}_atlas_selected.png"))
            sweep(pg, f"{tag} atlas with a selected place", W, True)
            pg.evaluate("dsSetMode('advanced')"); time.sleep(0.8)
            pg.screenshot(path=os.path.join(OUT, f"{tag}_atlas_research.png"))
            sweep(pg, f"{tag} atlas in Research mode", W, True)
            pg.evaluate("setTab('lab'); DSF.step = 3; DSF.gloss = true; DSF.cmp2 = S.res.distinct[0]; renderLeft()"); time.sleep(1.2)
            pg.evaluate("window.scrollTo(0, 0); (document.querySelector('#left') || {}).scrollTop = 0")
            pg.screenshot(path=os.path.join(OUT, f"{tag}_lab_compare.png"))
            sweep(pg, f"{tag} lab comparison (Research mode)", W, False)
            pg.evaluate("dsSetMode('simple'); DSF.gloss = false; DSF.cmp2 = null; DSF.step = 7; renderLeft()"); time.sleep(1.0)
            pg.screenshot(path=os.path.join(OUT, f"{tag}_lab_interpret.png"))
            sweep(pg, f"{tag} lab interpretation (Explore mode)", W, False)
            # V17 views: Atlas with the Science layer and a selected place, Science domains, a Surprise me card
            pg.evaluate("setTab('atlas')"); time.sleep(1.5)
            pg.evaluate("select(S.res.distinct[2]); document.documentElement.classList.add('ds-layers-open'); setLayer('science')"); time.sleep(1.2)
            pg.screenshot(path=os.path.join(OUT, f"{tag}_atlas_science.png"))
            sweep(pg, f"{tag} atlas Science layer with a selected place", W, True)
            pg.evaluate("setLayer('sim'); document.documentElement.classList.remove('ds-layers-open'); XT.hub = 'domains'; V7.i = S.res.distinct[2]; setTab('discover'); dsSetMode('advanced'); renderLeft()"); time.sleep(1.0)
            pg.evaluate("window.scrollTo(0, 0); (document.querySelector('#left') || {}).scrollTop = 0")
            pg.screenshot(path=os.path.join(OUT, f"{tag}_science_domains.png"))
            sweep(pg, f"{tag} science domains (Research mode)", W, False)
            pg.evaluate("dsSetMode('simple'); XT.hub = 'surprise'; SP.mode = 'mars_unexpected'; SP.draw = 0; spDraw(); SP.level = 'scientific'; renderLeft()"); time.sleep(1.0)
            pg.evaluate("document.querySelector('[data-spcard]').scrollIntoView()")
            pg.screenshot(path=os.path.join(OUT, f"{tag}_surprise.png"))
            sweep(pg, f"{tag} Surprise me card", W, False)
            # V18 Local Impact with an analysed place
            pg.evaluate("setTab('local'); liSetPoint({ lat: -23.65, lon: -68.15 }, 'coordinates'); renderLeft()"); time.sleep(1.2)
            pg.evaluate("window.scrollTo(0, 0); (document.querySelector('#left') || {}).scrollTop = 0")
            pg.screenshot(path=os.path.join(OUT, f"{tag}_local_impact.png"))
            sweep(pg, f"{tag} Local Impact", W, False)
            ctx.close()
        check(not errors, f"no page errors ({errors[:3]})")
finally:
    srv.kill()
print(f"\n{'ALL PASS' if not fails else str(len(fails)) + ' FAIL'}")
sys.exit(1 if fails else 0)
