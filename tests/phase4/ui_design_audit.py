"""Design audit and interaction walk-through of the Atlas and the Research Laboratory (Playwright/Chromium).

    python tests/phase4/ui_design_audit.py [outdir]

1. Prohibited-element audit of the RENDERED interface (computed styles and visible text), on the landing, the Atlas,
   the Research Laboratory (every workflow step) and the legal dialog, at 1440 x 900, 820 x 1180 and 390 x 844:
   decorative gradients (data colour scales excepted), shadows, translucent blur (V20: allowed only on [data-glass] floating surfaces), transitions and animations (hover
   animation, animated arrows), corner radii above 8 px on boxes, coloured left stripes, pure white backgrounds,
   Inter / Geist / Space Grotesk, monospace outside code, purple, neon and pastel colours, em dashes, emojis,
   checkmarks, sparkles, the "not just X, it's Y" formula, testimonials and pricing, rows of exactly three cards and
   bento grids.
2. Terms of Service and Privacy Policy: linked on the landing, the Atlas and the Laboratory, open by click and by
   address (#terms, #privacy), close by Escape, translated in five languages.
3. Atlas: the 3D globe is the default projection and the widest region; candidates are listed; a candidate selected on
   the list shows a context card with the engine's own score; layers are behind one button; the card leads to the full
   analysis and to the laboratory.
4. Research Laboratory: the eight-step workflow (target, Earth candidate, comparison, weights, differences and missing
   data, evidence, interpretation, reproduce) works end to end with the real engine; the fourteen modules stay visible and clickable.
5. The baseline result is unchanged afterwards; no page error.
"""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

def nav_tab(pg, t, act=None):
    """V20.3 navigation: the view buttons live in the dark sidebar, one section at a time. Open the view's section
    (from the menu button on phones), then press the view button itself. Every step is a real click or tap."""
    act = act or pg.click
    if pg.evaluate(f"(() => {{ const b = document.querySelector('#tab-{t}'); return !!b && b.checkVisibility({{ visibilityProperty: true }}) && !b.classList.contains('v22-off'); }})()"):
        act(f"#tab-{t}"); return
    sec = pg.evaluate(f"v22SecOf('{t}')")
    if pg.evaluate("innerWidth <= 760 && !document.body.classList.contains('v22-drawer')"): act("#v22-menu")
    act(f"#v22-side [data-v22sec={sec}]")
    act(f"#tab-{t}")


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_design_audit"
os.makedirs(OUT, exist_ok=True)
PORT = 8804
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
errors, fails = [], []


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg, flush=True)
    if not ok:
        fails.append(msg)


AUDIT = r"""(scope) => {
  const V = [], root = scope ? document.querySelector(scope) : document.body; if (!root) return ['no scope ' + scope];
  const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const name = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const rgb = s => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(s); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; };
  const hsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; };
  const DATA_SCALE = e => !!e.closest('.legend, .ramp, .lg-ramp, [data-scale], .track, .dm-et, input[type=range], .fill, .bar, .spark, svg, canvas');
  const SELECTED = e => e.matches('[aria-pressed=true],[aria-selected=true],[aria-checked=true],[aria-current=true],[aria-current=page]') && [e.style.background, getComputedStyle(e).backgroundColor].some(c => /219, 234, 254|#dbeafe/i.test(c));
  const CODE = e => !!e.closest('code, pre, kbd, samp, .mono, .hash, .xt-cfg');
  const els = [root, ...root.querySelectorAll('*')].filter(e => !e.closest('canvas, svg, script, style, noscript, option') || e.tagName === 'svg');
  for (const e of els) {
    if (!vis(e)) continue;
    const cs = getComputedStyle(e), n = name(e), r = e.getBoundingClientRect();
    if (/gradient/.test(cs.backgroundImage) && !DATA_SCALE(e)) V.push('gradient ' + n + ' ' + cs.backgroundImage.slice(0, 60));
    if (cs.boxShadow !== 'none') V.push('shadow ' + n);
    if (cs.textShadow !== 'none') V.push('text-shadow ' + n);
    if (((cs.backdropFilter && cs.backdropFilter !== 'none') || (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none')) && !e.hasAttribute('data-glass')) V.push('glass ' + n);  // V20: glass only on surfaces marked [data-glass] (floating controls, overlays, dialogs)
    if (cs.transitionDuration.split(',').some(d => parseFloat(d) > 0)) V.push('transition ' + n);
    if (cs.animationName !== 'none') V.push('animation ' + n);
    const rad = parseFloat(cs.borderTopLeftRadius) || 0;
    if (rad > 8 && r.width > 24 && r.height > 24) V.push('radius ' + rad + ' ' + n);
    const bl = parseFloat(cs.borderLeftWidth), bt = parseFloat(cs.borderTopWidth), br = parseFloat(cs.borderRightWidth);
    const lc = rgb(cs.borderLeftColor);
    if (bl >= 2 && lc && lc[3] > 0.3 && (bt < bl || br < bl) && cs.borderLeftStyle !== 'none') V.push('left-stripe ' + n);
    const bg = rgb(cs.backgroundColor);
    if (bg && bg[3] > 0.5 && bg[0] >= 250 && bg[1] >= 250 && bg[2] >= 250) V.push('white-bg ' + n);
    if (/\b(Inter|Geist|Space Grotesk)\b/i.test(cs.fontFamily)) V.push('font ' + n + ' ' + cs.fontFamily.slice(0, 40));
    const own = [...e.childNodes].some(c => c.nodeType === 3 && c.nodeValue.trim());
    if (own && /^\s*"?(JetBrains Mono|SF Mono|ui-monospace|Menlo|Consolas|monospace|SFMono)/i.test(cs.fontFamily) && !CODE(e)) V.push('mono ' + n);
    for (const [prop, val] of [['color', cs.color], ['background', cs.backgroundColor], ['border', cs.borderTopWidth !== '0px' ? cs.borderTopColor : null]]) {
      const c = val && rgb(val); if (!c || c[3] < 0.3) continue;
      if (prop === 'color' && !own) continue;
      const [h, s, l] = hsl(c);
      if (h >= 255 && h <= 320 && s > 0.25 && l > 0.15 && l < 0.85 && !DATA_SCALE(e)) V.push('purple ' + prop + ' ' + n + ' ' + val);
      if (s > 0.85 && l > 0.45 && l < 0.7 && !DATA_SCALE(e)) V.push('neon ' + prop + ' ' + n + ' ' + val);
      const chroma = (Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2])) / 255;  // V20: HSL saturation is unstable near white; near-white slate tints (#F8FAFC, #E2E8F0) have almost no chroma
      if (prop === 'background' && l > 0.8 && s > 0.25 && chroma > 0.08 && !SELECTED(e)) V.push('pastel ' + n + ' ' + val);  // V20: pale blue #DBEAFE is the selected-surface colour
    }
    if (cs.display === 'grid' || cs.display === 'flex') {
      const kids = [...e.children].filter(k => vis(k) && (() => { const k2 = getComputedStyle(k), b = rgb(k2.backgroundColor); return parseFloat(k2.borderTopWidth) > 0 || (b && b[3] > 0.2); })() && k.getBoundingClientRect().height > 70);
      const rows = {}; for (const k of kids) { const t = Math.round(k.getBoundingClientRect().top / 4); (rows[t] = rows[t] || []).push(k); }
      for (const g of Object.values(rows)) if (g.length === 3 && Math.max(...g.map(k => k.getBoundingClientRect().width)) - Math.min(...g.map(k => k.getBoundingClientRect().width)) < 24) V.push('three-cards ' + n);
      if (cs.display === 'grid') { const spans = new Set([...e.children].filter(vis).map(k => getComputedStyle(k).gridColumnEnd + '/' + getComputedStyle(k).gridRowEnd)); if ([...spans].some(sp => /span [2-9]/.test(sp)) && spans.size > 1) V.push('bento ' + n); }
    }
  }
  const text = root.innerText || '';
  const attrs = [...root.querySelectorAll('[placeholder],[title],[aria-label]')].filter(vis).map(e => (e.getAttribute('placeholder') || '') + ' ' + (e.getAttribute('title') || '') + ' ' + (e.getAttribute('aria-label') || '')).join(' ');
  const T = text + ' ' + attrs + ' ' + document.title;
  const grab = (re, label) => { const m = T.match(re); if (m) V.push(label + ' ' + JSON.stringify(m.slice(0, 3))); };
  grab(/—/g, 'em-dash');
  grab(/\p{Extended_Pictographic}/gu, 'emoji');
  grab(/[✓✔☑✅]/g, 'checkmark');
  grab(/[✨✦✧❇❈✴✳]/g, 'sparkle');
  grab(/\b(not just|isn't just|not merely|it's not)\b[^.]{0,80}/gi, 'formula');
  grab(/\b(testimonial|what our users say|per month|\/mo\b|pricing)\b/gi, 'marketing');
  return V;
}"""


def audit(pg, where, scope=None):
    v = pg.evaluate(AUDIT, scope)
    uniq = sorted(set(v))
    check(not uniq, f"{where}: no prohibited design element ({len(uniq)} found{': ' + '; '.join(uniq[:6]) if uniq else ''})")
    return uniq


def boot(pg):
    pg.goto(URL); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000); time.sleep(0.8)


try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        for dev, kw in [("desktop", dict(viewport={"width": 1440, "height": 900})),
                        ("tablet", dict(viewport={"width": 820, "height": 1180}, is_mobile=True, has_touch=True)),
                        ("mobile", dict(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True))]:
            ctx = b.new_context(accept_downloads=True, **kw); pg = ctx.new_page(); pg.set_default_timeout(90000)
            pg.on("pageerror", lambda e, d=dev: errors.append(d + ": " + str(e)))
            tap = (lambda sel: pg.tap(sel)) if kw.get("has_touch") else (lambda sel: pg.click(sel))
            boot(pg)
            audit(pg, f"{dev} landing")
            check(pg.evaluate("[...document.querySelectorAll('#hero [data-dslegal]')].filter(a => a.getBoundingClientRect().width > 0).length") == 2, f"{dev} landing: Terms of Service and Privacy Policy links visible")
            pg.evaluate("runSearch()"); pg.wait_for_function("S.searched", timeout=60000); time.sleep(0.5)
            base = pg.evaluate("({top: S.res.distinct[0], s: S.res.eff[S.res.distinct[0]], w: JSON.stringify(S.weights), tid: S.targetId})")
            # ------------------------------------------------------------ Atlas
            pg.evaluate("document.querySelector('#tab-atlas').scrollIntoView()"); nav_tab(pg, "atlas", tap); pg.wait_for_function("S.tab === 'atlas'"); time.sleep(2.5)
            g = pg.evaluate("""(() => { const v = document.querySelector('#viewport').getBoundingClientRect(), l = document.querySelector('#left').getBoundingClientRect(), c = document.querySelector('#globe').getBoundingClientRect();
              return { vw: v.width, vh: v.height, lw: l.width, cw: c.width, globe: document.querySelector('#proj-globe').getAttribute('aria-pressed'), W: innerWidth,
                       layerHidden: getComputedStyle(document.querySelectorAll('#viewport .vp-top .seg')[1]).display === 'none', btn: !!document.querySelector('#ds-layers'),
                       hint: (document.querySelector('#ds-acard') || {}).dataset ? document.querySelector('#ds-acard').dataset.dsacard : null, sites: document.querySelectorAll('#right .site').length }; })()""")
            check(g["globe"] == "true", f"{dev} atlas: the 3D globe is the default projection")
            if dev == "desktop":
                check(g["vw"] > g["lw"] and g["vw"] >= 0.45 * g["W"] and abs(g["cw"] - g["vw"]) < 4, f"{dev} atlas: the globe is the widest region ({g['vw']:.0f} px of {g['W']} px; atlas panel {g['lw']:.0f} px)")
            elif dev == "tablet":
                check(g["vw"] >= 0.55 * g["W"] and g["vh"] > 400, f"{dev} atlas: the globe is the largest region of the first row ({g['vw']:.0f} x {g['vh']:.0f} px)")
            else:
                check(g["vw"] >= 0.85 * g["W"] and g["vh"] > 300, f"{dev} atlas: the globe spans the screen ({g['vw']:.0f} x {g['vh']:.0f} px)")
            check(g["layerHidden"] and g["btn"], f"{dev} atlas: analysis layers are behind one Layers button")
            check(g["hint"] in ("hint",) or (g["hint"] or "").isdigit(), f"{dev} atlas: the globe carries a context card ({g['hint']})")
            check(g["sites"] >= 10, f"{dev} atlas: Earth candidates listed ({g['sites']})")
            pg.screenshot(path=os.path.join(OUT, f"{dev}_atlas.png"))
            audit(pg, f"{dev} atlas")
            check(pg.evaluate("[...document.querySelectorAll('#left [data-dslegal], #console [data-dslegal]')].some(a => a.getBoundingClientRect().width > 0) || !!document.querySelector('#left [data-dslegal]')"), f"{dev} atlas: legal links present")
            m = pg.evaluate("({ names: [...document.querySelectorAll('.ds-mode button')].map(b => b.textContent.trim()), cfg: (document.querySelector('.ds-cfg') || {}).textContent || '' })")
            check(m["names"][:2] == ["Explore mode", "Research mode"], f"{dev}: Explore mode and Research mode are offered ({m['names']})")
            check("of 6 dimensions weighted" in m["cfg"], f"{dev}: the console summarises the analysis configuration ({m['cfg'][:60]})")
            if dev == "desktop":
                # V20.1: the ranking may float over the globe, so the measure is the globe area NOT covered by the ranking
                FREE = "(() => { const v = document.querySelector('#viewport').getBoundingClientRect(), r = document.querySelector('#right').getBoundingClientRect(); const cover = r.width > 0 && r.left < v.right && r.right > v.left ? Math.min(v.right, r.right) - Math.max(v.left, r.left) : 0; return v.width - cover; })()"
                f0 = pg.evaluate(FREE)
                tap('[data-dspanel="right"]'); time.sleep(0.6)
                wr = pg.evaluate("({ hid: document.querySelector('#app').classList.contains('ds-hide-right'), vw: " + FREE + " })")
                check(wr["hid"] and wr["vw"] > f0 + 150, f"{dev} atlas: hiding the ranking widens the uncovered globe ({f0:.0f} -> {wr['vw']:.0f} px)")
                tap('[data-dspanel="right"]'); time.sleep(0.6)
                check(not pg.evaluate("document.querySelector('#app').classList.contains('ds-hide-right')") and pg.evaluate("document.querySelectorAll('#right .site').length") >= 10, f"{dev} atlas: the ranking comes back")
                pg.evaluate("dsSetMode('advanced')"); time.sleep(0.4)
                pg.evaluate("document.querySelector('#w-' + S.critIds[0]).value = 0; document.querySelector('#w-' + S.critIds[0]).dispatchEvent(new Event('input', {bubbles: true}))"); time.sleep(1.0)
                changed = pg.evaluate("JSON.stringify(S.weights)") != base["w"]
                pg.evaluate("document.querySelector('[data-dsreset]').scrollIntoView()"); tap("[data-dsreset]"); time.sleep(1.2)
                check(changed and pg.evaluate("JSON.stringify(S.weights)") == base["w"], f"{dev}: 'Reset weights' restores the profile weights")
                pg.evaluate("dsSetMode('simple')"); time.sleep(0.3)
            tap("#ds-layers"); time.sleep(0.3)
            check(pg.evaluate("getComputedStyle(document.querySelectorAll('#viewport .vp-top .seg')[1]).display") != "none", f"{dev} atlas: the Layers button reveals the analysis layers")
            tap("#ds-layers"); time.sleep(0.2)
            pg.evaluate("document.querySelectorAll('#right .site')[2].scrollIntoView()"); tap("#right .site >> nth=2"); time.sleep(1.2)
            card = pg.evaluate("(() => { const c = document.querySelector('#ds-acard'); return { cell: c.dataset.dsacard, sel: S.cell[S.selected], txt: c.innerText, pct: txPct(S.res.eff[S.selected]) }; })()")
            check(card["cell"] == str(card["sel"]) and card["pct"] in card["txt"], f"{dev} atlas: selecting a candidate shows its context card with the engine's score ({card['pct']})")
            pg.screenshot(path=os.path.join(OUT, f"{dev}_atlas_selected.png"))
            audit(pg, f"{dev} atlas with a selected place")
            pg.evaluate("document.querySelector('#ds-acard [data-dsaopen]').scrollIntoView()"); tap("#ds-acard [data-dsaopen]"); time.sleep(0.8)
            check(pg.evaluate("JN.open && JN.view === 'place' && S.cell[JN.i]") == card["sel"], f"{dev} atlas: 'Full analysis' opens the analysis of that place")
            pg.evaluate("jnClose()"); time.sleep(0.3)
            pg.evaluate("document.querySelector('#ds-acard [data-dsalab]').scrollIntoView()"); tap("#ds-acard [data-dsalab]"); time.sleep(1.0)
            lab = pg.evaluate("({tab: S.tab, step: DSF.step, cell: (document.querySelector('[data-dsfcmp]') ? S.cell[dsfCand()] : null)})")
            check(lab["tab"] == "lab" and lab["step"] == 3 and lab["cell"] == card["sel"], f"{dev} atlas: 'Compare in the laboratory' opens step 3 for that place")
            # ------------------------------------------------------------ Research Laboratory
            steps = pg.evaluate("[...document.querySelectorAll('[data-dsfstep]')].map(s => s.dataset.dsfstep)")
            check(steps == ["target", "candidate", "compare", "weights", "gaps", "evidence", "interpret", "reproduce"], f"{dev} lab: eight-step workflow ({steps})")
            rows = pg.evaluate("""(() => { const out = []; for (const tr of document.querySelectorAll('[data-dsfcmp] tbody tr[data-dsfrow]')) { const c = tr.dataset.dsfrow; out.push([c, tr.dataset.dsfk]); }
              const D = ENG.detail(S.A, S.critIds, dsfCand(), jnCtx(S.targetId).tv, S.weights, jnCtx(S.targetId).ranges), th = S.app.thresholds;
              const ref = D.rows.map(r => [r.c, r.s == null || r.s !== r.s ? 'na' : r.s >= th.match ? 'similar' : r.s >= th.partial ? 'partial' : 'different']); return { out, ref }; })()""")
            check(rows["out"] == rows["ref"] and len(rows["out"]) == 6, f"{dev} lab step 3: six dimensions compared, readings equal the engine's")
            pg.screenshot(path=os.path.join(OUT, f"{dev}_lab_compare.png"))
            opt2 = pg.evaluate("document.querySelectorAll('[data-dsfcmp2] option')[2].value")
            pg.select_option("[data-dsfcmp2]", opt2); time.sleep(0.8)
            c2 = pg.evaluate("""(() => { const j = DSF.cmp2, D = ENG.detail(S.A, S.critIds, j, jnCtx(S.targetId).tv, S.weights, jnCtx(S.targetId).ranges), th = S.app.thresholds;
              const ref = D.rows.map(r => r.s == null || r.s !== r.s ? 'na' : r.s >= th.match ? 'similar' : r.s >= th.partial ? 'partial' : 'different');
              const got = [...document.querySelectorAll('[data-dsfc2]')].map(td => td.dataset.dsfc2); return { j, ref, got }; })()""")
            check(c2["j"] == int(opt2) and c2["got"] == c2["ref"], f"{dev} lab step 3: a second place is compared side by side with the engine's readings ({c2['got']})")
            pg.select_option("[data-dsfcmp2]", ""); time.sleep(0.5)
            tap("[data-dsgloss]"); time.sleep(0.4)
            check(pg.evaluate("document.querySelectorAll('#ds-gloss dt').length") == 7, f"{dev} lab step 3: the glossary explains seven terms in plain words")
            tap("[data-dsgloss]"); time.sleep(0.3)
            check(pg.evaluate("[...document.querySelectorAll('[data-dsfcmp] .ds-adv')].every(e => getComputedStyle(e).display === 'none')"), f"{dev} lab step 3: source and status columns stay hidden in Explore mode")
            pg.evaluate("dsSetMode('advanced')"); time.sleep(0.5)
            check(pg.evaluate("[...document.querySelectorAll('[data-dsfcmp] .ds-adv')].some(e => getComputedStyle(e).display !== 'none') && S.res && DSF.step === 3"), f"{dev} lab step 3: Research mode adds target status, Earth dataset and resolution, keeping the analysis")
            pg.evaluate("dsSetMode('simple')"); time.sleep(0.4)
            for k in range(1, 9):
                pg.evaluate(f"document.querySelector('[data-dsfgo=\"{k}\"].ds-step-h').scrollIntoView()"); tap(f"[data-dsfgo=\"{k}\"].ds-step-h"); time.sleep(0.5)
                audit(pg, f"{dev} lab step {k}", "#left")
            # step 1: Moon target, then back to Mars
            tap('[data-dsfgo="1"].ds-step-h'); time.sleep(0.3)
            tap('[data-dsftgt="moon_south_pole"]'); time.sleep(2.0)
            check(pg.evaluate("S.targetId") == "moon_south_pole" and pg.evaluate("DSF.step") == 1, f"{dev} lab step 1: the Moon target is selected")
            tap('[data-dsftgt="mars_jezero"]'); time.sleep(2.0)
            # step 2: candidate
            tap('[data-dsfgo="2"].ds-step-h'); time.sleep(0.3)
            opt = pg.evaluate("document.querySelectorAll('[data-dsfcand] option')[4].value")
            pg.select_option("[data-dsfcand]", opt); time.sleep(1.0)
            check(pg.evaluate("S.selected") == int(opt), f"{dev} lab step 2: the Earth candidate is chosen ({opt})")
            # step 4: weights
            tap('[data-dsfgo="4"].ds-step-h'); time.sleep(0.3)
            tap('[data-dsfprof="thermal"]'); time.sleep(1.5)
            check(pg.evaluate("S.profile") == "thermal", f"{dev} lab step 4: a mission profile sets the weights")
            tap("[data-dsfweights]"); time.sleep(0.5)
            check(pg.evaluate("document.documentElement.classList.contains('ds-advanced') && document.querySelector('#console').classList.contains('open')"), f"{dev} lab step 4: 'Show all weights' opens every weight (Advanced view)")
            pg.evaluate("dsSetMode('simple')")
            # step 5: differences and missing data
            tap('[data-dsfgo="5"].ds-step-h'); time.sleep(0.4)
            check(pg.evaluate("document.querySelectorAll('[data-dsfdiff] li').length > 0 && document.querySelectorAll('[data-dsfmiss] li').length > 0"), f"{dev} lab step 5: differences and missing evidence listed")
            # step 6: evidence, trace
            tap('[data-dsfgo="6"].ds-step-h'); time.sleep(0.4)
            check(pg.evaluate("document.querySelectorAll('[data-dsfev] li').length") >= 5, f"{dev} lab step 6: Earth datasets listed")
            tap('[data-dsfdo="trace"]'); time.sleep(0.8)
            check(pg.evaluate("!document.querySelector('#sheet').hidden"), f"{dev} lab step 6: the trace of the result opens")
            audit(pg, f"{dev} trace sheet", "#sheet")
            pg.evaluate("closeSheet()"); time.sleep(0.3)
            # step 7: interpret and apply
            tap('[data-dsfgo="7"].ds-step-h'); time.sleep(0.4)
            ip = pg.evaluate("""({ card: !!document.querySelector('[data-dsflow] .ds-sum'), ops: document.querySelectorAll('[data-dsfops] li').length,
                                   procs: !!document.querySelector('[data-dsfprocs]') })""")
            check(ip["card"] and ip["ops"] > 0 and ip["procs"], f"{dev} lab step 7: interpretation card, exploration operations and indicated processes ({ip})")
            # step 8: reproduce
            tap('[data-dsfgo="8"].ds-step-h'); time.sleep(0.4)
            rec = json.loads(pg.evaluate("document.querySelector('[data-dsfrec]').textContent"))
            check(rec["cell"] == pg.evaluate("S.cell[dsfCand()]") and rec["algorithm"] == "tai-sim-1.0.0" and rec["target"] == "mars_jezero", f"{dev} lab step 8: the reproduction record names the algorithm, target and place")
            tap('[data-dsfdo="repro"]'); time.sleep(0.8)
            check(pg.evaluate("!document.querySelector('#sheet').hidden"), f"{dev} lab step 8: 'Reproduce this result' opens the reproduction sheet")
            pg.evaluate("closeSheet()"); time.sleep(0.3)
            with pg.expect_download() as d:
                tap('[data-dsfdo="report"]')
            check(d.value.suggested_filename.endswith(".md"), f"{dev} lab step 8: the detailed report downloads ({d.value.suggested_filename})")
            # modules stay visible and work
            pg.evaluate("document.querySelector('[data-labmod=robust]').scrollIntoView()"); tap("[data-labmod=robust]"); time.sleep(0.8)
            check(pg.evaluate("L.mod") == "robust" and pg.evaluate("!!document.querySelector('[data-dsflow]')"), f"{dev} lab: the research modules stay visible and open below the workflow")
            check(pg.evaluate("!!document.querySelector('#left [data-dslegal]')"), f"{dev} lab: legal links present")
            pg.screenshot(path=os.path.join(OUT, f"{dev}_lab.png"))
            # ------------------------------------------------------------ legal pages
            pg.evaluate("document.querySelector('#left [data-dslegal=terms]').scrollIntoView()"); tap("#left [data-dslegal=terms]"); time.sleep(0.5)
            t = pg.evaluate("({open: !document.querySelector('#ds-legal-dlg').hidden, h: document.querySelector('#ds-legal-title').textContent, n: document.querySelectorAll('#ds-legal-dlg h3').length, hash: location.hash, focus: document.activeElement.id})")
            check(t["open"] and t["h"] == "Terms of Service" and t["n"] == 6 and t["hash"] == "#terms" and t["focus"] == "ds-legal-title", f"{dev}: Terms of Service open in a dialog ({t})")
            audit(pg, f"{dev} terms of service", "#ds-legal-dlg")
            pg.keyboard.press("Escape"); time.sleep(0.3)
            check(pg.evaluate("document.querySelector('#ds-legal-dlg').hidden"), f"{dev}: Escape closes the legal dialog")
            if dev == "desktop":
                pg.goto(URL + "#privacy"); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000); time.sleep(1.0)
                pp = pg.evaluate("({open: document.querySelector('#ds-legal-dlg') && !document.querySelector('#ds-legal-dlg').hidden, h: (document.querySelector('#ds-legal-title') || {}).textContent, txt: (document.querySelector('#ds-legal-dlg') || {}).innerText || ''})")
                check(pp["open"] and pp["h"] == "Privacy Policy" and "local storage" in pp["txt"] and "fonts.googleapis.com" in pp["txt"], "the Privacy Policy opens by address (#privacy) and names what is stored and sent")
                audit(pg, "desktop privacy policy", "#ds-legal-dlg")
                for L in ["bn", "es", "fr", "de"]:
                    pg.evaluate(f"setLang('{L}')"); time.sleep(0.5)
                    h = pg.evaluate("document.querySelector('#ds-legal-title').textContent")
                    check(h and h != "Privacy Policy" and pg.evaluate("tx('ds.pp.title')") == h, f"{L}: the Privacy Policy is translated ({h})")
                    audit(pg, f"desktop privacy policy {L}", "#ds-legal-dlg")
                pg.evaluate("setLang('en')"); pg.keyboard.press("Escape")
                pg.evaluate("runSearch()"); pg.wait_for_function("S.searched", timeout=60000); time.sleep(0.4)
                pg.evaluate("setTab('lab')"); time.sleep(0.8)
                for L in ["bn", "de"]:
                    pg.evaluate(f"setLang('{L}')"); time.sleep(0.8)
                    audit(pg, f"desktop lab in {L}", "#left")
                    pg.evaluate("setTab('atlas')"); time.sleep(1.5)
                    audit(pg, f"desktop atlas in {L}")
                    pg.evaluate("setTab('lab')"); time.sleep(0.6)
                pg.evaluate("setLang('en')")
            # ------------------------------------------------------------ baseline untouched
            pg.evaluate("applyProfile('general'); setTarget('mars_jezero')"); time.sleep(1.5)
            after = pg.evaluate("({top: S.res.distinct[0], s: S.res.eff[S.res.distinct[0]], w: JSON.stringify(S.weights), tid: S.targetId})")
            check(after == base, f"{dev}: baseline result identical after the walk-through")
            check(not pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1"), f"{dev}: no horizontal page scroll")
            ctx.close()
        check(not errors, f"no page errors ({errors[:3]})")
finally:
    srv.kill()
print(f"\n{'ALL PASS' if not fails else str(len(fails)) + ' FAIL'}")
sys.exit(1 if fails else 0)
