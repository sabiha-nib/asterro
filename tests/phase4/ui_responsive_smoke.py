"""Responsive, header and Bengali typography walk-through (Playwright/Chromium, simulated viewports).

    python tests/phase4/ui_responsive_smoke.py [outdir]

SIMULATED viewport checks in headless Chromium (SwiftShader WebGL); this is not a physical-device test. Phones and
tablets run with touch emulation (has_touch, is_mobile for phones) and taps instead of clicks.

Viewports: 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1512×982.
  - Header, in all five languages at every viewport: every tab visible, unclipped and hit-testable; the language
    control in the header showing the language's own name; no horizontal page scrolling; tabs reachable by tap or
    click; a language switch keeps tab, target, weights and the #1 result.
  - Every major interface in Deutsch (longest labels) and বাংলা (another script) at every viewport, English at the
    tablet sizes: globe / map with its controls, weight console and dimension panel, the result rail, Compare,
    Scenarios, Discover, Data, Method, a Lab module, Trajectory, Atlas, the journey (place view, Passport, Journal),
    and the Trace / Reproduce / Report sheet. For each: no horizontal page overflow, no element running past the
    viewport outside a scrolling container, no overlapping globe controls, the dialog's close control on screen, no
    text smaller than 9 px, the panel heading not hidden under the header.
  - Bengali typography: the Bengali font stack resolves to an installed Bengali-capable face; every Bengali code
    point used by the interface catalogues is covered by it; conjuncts are shaped (ক্ষ is narrower than ক্‌ষ with a
    ZWNJ) and pre-base vowel signs reorder; regular and bold weights both render; buttons keep their height.
"""
import json, os, re, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_responsive"
os.makedirs(OUT, exist_ok=True)
PORT = 8798
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
errors, fails = [], []
VIEWPORTS = [(390, 844, "phone", True), (430, 932, "large phone", True), (768, 1024, "tablet portrait", True),
             (1024, 768, "tablet landscape", True), (1280, 800, "compact laptop", False), (1512, 982, "desktop", False)]
LANGS = ["en", "bn", "es", "fr", "de"]
if os.environ.get("ASTERRO_VP"):          # developer shortcut: e.g. ASTERRO_VP=390,768 (the full run uses all six)
    VIEWPORTS = [v for v in VIEWPORTS if str(v[0]) in os.environ["ASTERRO_VP"].split(",")]


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg, flush=True)
    if not ok:
        fails.append(msg)


HEADER = r"""() => { const vw = innerWidth, bar = document.querySelector('header.bar'), br = bar.getBoundingClientRect();
  const tabs = [...document.querySelectorAll('nav.tabs button[data-tab]')].map(b => { const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, hit = document.elementFromPoint(cx, cy);
    return { id: b.dataset.tab, w: r.width, l: r.left, r: r.right, h: r.height, vis: r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= vw + 1, hit: !!hit && (hit === b || b.contains(hit)), fs: parseFloat(getComputedStyle(b).fontSize), label: b.textContent.trim() }; });
  const hdr = document.querySelector('header.bar #i18n-hdr'), sel = hdr && hdr.querySelector('select[data-i18n-lang]'), code = hdr && hdr.querySelector('.i18n-code');
  const hr = hdr && hdr.getBoundingClientRect();
  return { tabs, scrollW: document.documentElement.scrollWidth, vw, navScroll: (() => { const n = document.querySelector('nav.tabs'); return n.scrollWidth - n.clientWidth; })(),
    hdr: !!hdr && !!sel && bar.contains(hdr), hdrVis: !!hr && hr.width > 0 && hr.right <= vw + 1 && hr.left >= -1, name: code && code.textContent, value: sel && sel.value,
    inConsole: document.querySelectorAll('#console select[data-i18n-lang]').length, barH: br.height }; }"""

LAYOUT = r"""(sel) => { const vw = innerWidth, vh = innerHeight, out = { over: [], small: 0, smallEx: [], scrollW: document.documentElement.scrollWidth };
  const scroller = e => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return true; if (/(auto|scroll)/.test(s.overflowX)) return true; } return false; };
  for (const root of document.querySelectorAll(sel)) { if (!root || root.hidden) continue;
    for (const e of root.querySelectorAll('*')) { const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (r.right > vw + 1 && !scroller(e) && cs.position !== 'fixed') out.over.push((e.id || e.className || e.tagName).toString().slice(0, 40) + ' ' + Math.round(r.right));
      const own = [...e.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim()); if (own && parseFloat(cs.fontSize) < 9 && !e.closest('svg,[aria-hidden=true],.sr-only')) { out.small++; if (out.smallEx.length < 4) out.smallEx.push(e.tagName + ':' + cs.fontSize + ':' + e.textContent.trim().slice(0, 20)); } } }
  out.over = out.over.slice(0, 6); return out; }"""

CONTROLS = r"""() => { const bs = [...document.querySelectorAll('.vp-top button, .vp-top select, #jl-chip, #legend')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map(b => b.getBoundingClientRect());
  let ov = 0; for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i], b = bs[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) ov++; }
  const g = document.querySelector('#globe').getBoundingClientRect(), vw = innerWidth;
  return { n: bs.length, overlap: ov, out: bs.filter(r => r.right > vw + 1 || r.left < -1).length, gw: g.width, gh: g.height, gl: !!(window.GLOBE) }; }"""

HEADING = r"""() => { const left = document.querySelector('#left'), h = left && left.querySelector('.lbl, h2, h3, .lab-head'); if (!h) return { ok: true, why: 'no heading' };
  h.scrollIntoView({ block: 'start' }); const r = h.getBoundingClientRect(), bar = document.querySelector('header.bar').getBoundingClientRect();
  const hit = document.elementFromPoint(Math.min(innerWidth - 2, r.left + 8), r.top + Math.min(6, r.height / 2));
  return { ok: !!hit && (h.contains(hit) || hit.contains(h) || left.contains(hit)), top: r.top, barBottom: bar.bottom, pos: getComputedStyle(document.querySelector('header.bar')).position }; }"""

DIALOG = r"""(sel) => { const d = document.querySelector(sel); if (!d) return null; const box = d.querySelector('.jn-box, .jn, [role=dialog]') || d; const r = (d.querySelector('.jn-panel') || box).getBoundingClientRect();
  const close = d.querySelector('#sheet-close') || d.querySelector('.jn-x, [data-jn=close]') || d.querySelector('button[aria-label]'); const c = close && close.getBoundingClientRect();
  return { w: r.width, left: r.left, right: r.right, vw: innerWidth, vh: innerHeight, close: !!c && c.top >= -1 && c.bottom <= innerHeight + 1 && c.right <= innerWidth + 1 && c.width > 0, scrollW: document.documentElement.scrollWidth }; }"""


def state(pg):
    return pg.evaluate("({tab: S.tab, tid: S.targetId, w: JSON.stringify(S.weights), top: S.res && S.res.distinct[0], s: S.res && S.res.eff[S.res.distinct[0]]})")


def view_checks(pg, label, roots="#left"):
    lay = pg.evaluate(LAYOUT, roots)
    ok = lay["scrollW"] <= pg.viewport_size["width"] + 1 and not lay["over"]
    return ok, lay


try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        for (W, H, kind, touch) in VIEWPORTS:
            ctx = b.new_context(viewport={"width": W, "height": H}, reduced_motion="reduce", has_touch=touch, is_mobile=touch and W < 600)
            pg = ctx.new_page(); pg.set_default_timeout(90000)
            pg.on("pageerror", lambda e: errors.append(f"{W}: pageerror: {e}"))
            pg.goto(URL); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000)
            pg.evaluate("runSearch()"); pg.wait_for_function("S.searched", timeout=60000); time.sleep(0.4)
            pg.evaluate("a4Load()"); pg.wait_for_function("A4.reg && document.querySelector('#tc-atlas-sel')", timeout=90000); time.sleep(0.4)
            tag = f"{W}×{H} {kind}"
            # ------------------------------------------------ header in all five languages
            st0 = state(pg); hdr_bad = []
            for L in LANGS:
                pg.evaluate(f"setLang('{L}')"); time.sleep(0.5)
                h = pg.evaluate(HEADER)
                bad = [t["id"] for t in h["tabs"] if not (t["vis"] and t["hit"])]
                small = [t["id"] for t in h["tabs"] if t["fs"] < 10.5]
                name_ok = h["name"] and h["value"] == L and (L == "en" or h["name"] != "EN")
                if bad or small or h["scrollW"] > W + 1 or h["navScroll"] > 1 or not h["hdr"] or not h["hdrVis"] or h["inConsole"] or not name_ok:
                    hdr_bad.append((L, bad, small, h["scrollW"], h["navScroll"], h["hdr"], h["hdrVis"], h["name"]))
                if W in (1512, 768) and L in ("de", "bn"):
                    pg.screenshot(path=f"{OUT}/{W}_{L}_header.png", clip={"x": 0, "y": 0, "width": W, "height": max(60, h["barH"] + 4)})
            check(not hdr_bad, f"{tag}: header in all five languages — every tab visible, unclipped and hit-testable, ≥ 10.5 px, no sideways scrolling, language control in the header naming the language ({hdr_bad[:2]})")
            check(state(pg) == st0, f"{tag}: five language switches keep tab, target, weights and the #1 result")
            # tab reachable by tap / click in German
            pg.evaluate("setLang('de')"); time.sleep(0.4)
            for t in ["atlas", "data", "explore"]:
                sel = f"nav.tabs button[data-tab={t}]"
                (pg.tap if touch else pg.click)(sel); time.sleep(0.6)
            check(pg.evaluate("S.tab") == "explore" and pg.evaluate("document.querySelector('#tab-atlas').getAttribute('aria-selected')") == "false", f"{tag}: tabs work by {'tap' if touch else 'click'} (Deutsch)")
            # ------------------------------------------------ interfaces
            langs = ["de", "bn"] + (["en"] if W in (768, 1024) else [])
            if os.environ.get("ASTERRO_LANGS"): langs = os.environ["ASTERRO_LANGS"].split(",")
            for L in langs:
                pg.evaluate(f"setLang('{L}'); setTab('explore'); setTarget('mars_jezero'); select(S.res.distinct[0])"); time.sleep(0.8)
                c = pg.evaluate(CONTROLS)
                ok, lay = view_checks(pg, "explore", "#left,#right,#console,.vp-top,#legend")
                check(ok and c["overlap"] == 0 and c["out"] == 0 and c["gw"] > 200 and c["gh"] > 150 and c["gl"], f"{tag} {L}: globe ({c['gw']:.0f}×{c['gh']:.0f}) with {c['n']} controls (incl. legend and expedition chip), none overlapping ({c['overlap']}) or off-screen ({c['out']}); Explore panel, rail and weights fit ({lay['over'][:3]})")
                check(lay["small"] == 0, f"{tag} {L}: no text under 9 px in the workspace ({lay['smallEx']})")
                if L == "de":
                    pg.screenshot(path=f"{OUT}/{W}_{L}_explore.png")
                # dimension panel through its ⓘ button (a button, not a hover)
                pg.evaluate("document.querySelector('#console').scrollIntoView()")
                if pg.evaluate("getComputedStyle(document.querySelector('#console .sliders')).display === 'none'"):   # phones fold the weights behind “Weights ▾”
                    (pg.tap if touch else pg.click)("[data-contoggle]"); time.sleep(0.4)
                ib = pg.query_selector("[data-dm-info]")
                if ib:
                    if ib.get_attribute("aria-expanded") == "true":        # left open by the previous language's pass
                        (ib.tap if touch else ib.click)(); time.sleep(0.3)
                    (ib.tap if touch else ib.click)(); time.sleep(0.4)
                    dm = pg.evaluate("(() => { const d = document.querySelector('#dm-info'); if (!d) return null; const r = d.getBoundingClientRect(); return { vis: r.width > 0 && !d.hidden, r: r.right, l: r.left }; })()")
                    check(bool(dm) and dm["vis"] and dm["r"] <= W + 1 and dm["l"] >= -1, f"{tag} {L}: the dimension explanation opens by {'tap' if touch else 'click'} and fits the screen")
                    pg.keyboard.press("Escape")
                views = [("compare", "setTab('compare')"), ("scenarios", "setTab('scenarios')"), ("discover", "setTab('discover')"), ("data", "setTab('data')"), ("method", "setTab('method')"),
                         ("lab", "setTab('lab'); L.mod = 'robust'; labRender()"), ("trajectory", "setTab('trajectory')"), ("atlas", "setTab('atlas'); A3.view = 'home'; atRender()"), ("atlas-lab4", "setTab('atlas'); A3.view = 'lab4'; atRender()")]
                bad = []
                for name, js in views:
                    pg.evaluate(js); time.sleep(0.9)
                    ok, lay = view_checks(pg, name)
                    hd = pg.evaluate(HEADING)
                    if not ok or not hd["ok"] or lay["small"]:
                        bad.append((name, lay["scrollW"], lay["over"][:2], hd, lay["smallEx"][:2]))
                    if W in (390, 768, 1024) and L == "de" and name in ("compare", "data", "atlas", "trajectory"):
                        pg.screenshot(path=f"{OUT}/{W}_{L}_{name}.png")
                    pg.evaluate("window.scrollTo(0, 0); document.querySelector('#left').scrollTop = 0")
                check(not bad, f"{tag} {L}: Compare, Scenarios, Discover, Data, Method, Lab, Trajectory, Atlas fit — no sideways overflow, heading not under the header, no text under 9 px ({bad[:2]})")
                # journey: place view, passport, journal
                pg.evaluate("setTab('explore'); jnOpen('place', {i: S.res.distinct[0], tid: 'mars_jezero', pid: 'general', sec: 'trust'})"); time.sleep(0.6)
                dj = [pg.evaluate(DIALOG, "#jn")]
                pg.evaluate("JN.sec = 'passport'; jnRender()"); time.sleep(0.4); dj.append(pg.evaluate(DIALOG, "#jn"))
                if W in (390, 768) and L == "bn":
                    pg.screenshot(path=f"{OUT}/{W}_{L}_passport.png")
                pg.evaluate("JN.view = 'journal'; jnRender()"); time.sleep(0.4); dj.append(pg.evaluate(DIALOG, "#jn"))
                jok = all(d and d["right"] <= W + 1 and d["left"] >= -1 and d["close"] and d["scrollW"] <= W + 1 for d in dj)
                check(jok, f"{tag} {L}: journey place view, Passport and Journal fit the screen with the close control visible ({[ (round(d['left']), round(d['right']), d['close']) for d in dj if d]})")
                pg.evaluate("jnClose()"); time.sleep(0.3)
                # sheets
                sh = []
                for fn in ["showTrace", "showReproduce", "showReport"]:
                    pg.evaluate(f"select(S.res.distinct[0]); {fn}()"); time.sleep(1.0)
                    d = pg.evaluate(DIALOG, "#sheet"); lay = pg.evaluate(LAYOUT, "#sheet")
                    sh.append((fn, d and d["close"], d and d["right"] <= W + 1, lay["over"][:2], pg.evaluate("(() => { const c = document.querySelector('#sheet-close').getBoundingClientRect(); return [Math.round(c.top), Math.round(c.bottom), document.querySelector('#sheet').scrollTop]; })()")))
                    pg.evaluate("closeSheet()"); time.sleep(0.2)
                check(all(x[1] and x[2] and not x[3] for x in sh), f"{tag} {L}: Trace, Reproduce and Report sheets fit, close control on screen ({[x for x in sh if not (x[1] and x[2] and not x[3])][:2]})")
            # ------------------------------------------------ Bengali typography (once per viewport class)
            if W in (390, 1512):
                pg.evaluate("setLang('bn'); setTab('explore')"); time.sleep(0.4)
                ty = pg.evaluate(r"""async () => { await document.fonts.ready;
                  const m = (txt, w = 400) => { const s = document.createElement('span'); s.style.cssText = `font:${w} 20px var(--f-body);white-space:nowrap;position:absolute;visibility:hidden`; s.textContent = txt; document.body.appendChild(s); const x = s.getBoundingClientRect().width; s.remove(); return x; };
                  const conj = m('ক্ষ'), split = m('ক্‌ষ'), ki = m('কি'), k = m('ক'), i = m('ি'), bold = m('বাংলা ভাষা', 700), reg = m('বাংলা ভাষা', 400);
                  const fam = getComputedStyle(document.body).fontFamily;
                  const mw = f => { const s = document.createElement('span'); s.style.cssText = `font:400 40px ${f};white-space:nowrap;position:absolute;visibility:hidden`; s.textContent = 'mmmmwwwwiiii'; document.body.appendChild(s); const x = s.getBoundingClientRect().width; s.remove(); return x; };
                  const noto = mw('"Noto Sans Bengali", monospace') !== mw('monospace');   // a face is loaded only if its Latin metrics differ from the fallback's
                  const bh = [...document.querySelectorAll('nav.tabs button')].map(b => b.getBoundingClientRect().height);
                  return { conj, split, ki, ksum: k + i, bold, reg, fam, noto, bh: [Math.min(...bh), Math.max(...bh)] }; }""")
                check(ty["conj"] + 2 < ty["split"], f"{tag}: Bengali conjuncts are shaped (ক্ষ {ty['conj']:.1f} px < ক্‌ষ {ty['split']:.1f} px)")
                check(ty["ki"] < ty["ksum"] + 0.5, f"{tag}: the pre-base vowel sign combines with its consonant (কি {ty['ki']:.1f} px ≤ ক + ি {ty['ksum']:.1f} px)")
                check(ty["bold"] > 0 and ty["reg"] > 0, f"{tag}: regular and bold Bengali both render ({ty['reg']:.1f} / {ty['bold']:.1f} px)")
                check(ty["bh"][1] - ty["bh"][0] <= 1 and ty["bh"][0] >= 28, f"{tag}: Bengali tab buttons keep one height ({ty['bh']})")
                print(f"INFO {tag}: Bengali font stack {ty['fam'][:120]}; Noto Sans Bengali available here: {ty['noto']}")
                pg.screenshot(path=f"{OUT}/{W}_bn_typography.png")
            ctx.close()
        b.close()
finally:
    srv.terminate()

# ---------------------------------------------------------------- glyph coverage of the installed Bengali face
bn = set()
for f in ["i18n_20_bn.js", "i18n_71_routes_bn.js"]:
    bn |= {c for c in open(os.path.join(ROOT, "app/frontend/phase4", f), encoding="utf8").read() if "ঀ" <= c <= "৿"}
try:
    from fontTools.ttLib import TTFont
    fc = subprocess.run(["fc-match", "-f", "%{file}", "Noto Sans Bengali:lang=bn"], capture_output=True, text=True).stdout.strip()
    font = TTFont(fc); cmap = font.getBestCmap(); miss = sorted(c for c in bn if ord(c) not in cmap)
    scripts = {r.ScriptTag for r in font["GSUB"].table.ScriptList.ScriptRecord} if "GSUB" in font else set()
    feats = {r.FeatureTag for r in font["GSUB"].table.FeatureList.FeatureRecord} if "GSUB" in font else set()
    check(not miss, f"the Bengali face this machine falls back to ({os.path.basename(fc)}) covers all {len(bn)} Bengali code points the interface uses (missing {[hex(ord(c)) for c in miss]})")
    check(bool(scripts & {"beng", "bng2"}) and {"akhn", "blwf", "half", "pstf"} <= feats, f"{os.path.basename(fc)} carries Bengali shaping tables (scripts {sorted(scripts & {'beng', 'bng2'})}, features {sorted(feats & {'akhn', 'blwf', 'half', 'pstf', 'pres', 'abvs', 'blws', 'psts'})})")
    print(f"INFO Noto Sans Bengali resolves on this machine to: {fc} (Noto Sans Bengali itself is {'installed' if 'Noto' in fc and 'Bengali' in fc else 'NOT installed; Google Fonts is unreachable here'})")
except Exception as e:
    check(False, f"font coverage check ran ({e})")
check(not errors, f"no page errors ({errors[:3]})")
print(json.dumps({"fails": fails}, ensure_ascii=False, indent=1))
sys.exit(1 if fails else 0)
