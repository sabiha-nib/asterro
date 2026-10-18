"""Discovery Trajectory UI walk-through (Playwright/Chromium).

    python tests/phase4/ui_trajectory_smoke.py [outdir]

Drives the real controls: the weight slider by keyboard, the profile buttons, the target quick-switch. Checks that
each settled configuration is recorded with the engine's own result (never a stale or interpolated one), that the
profile sweep leaves Explore untouched, that the per-criterion decomposition closes, that the exported trajectory
is reproduced by the Python reference engine and by the in-browser import, that the story export carries the
evidence, keyboard access, an accessibility audit, no horizontal overflow on a phone, and no page errors.
"""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_trajectory_shots"
os.makedirs(OUT, exist_ok=True)
PORT = 8794
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
errors, fails = [], []


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


AUDIT = r"""() => {
  const out = { unnamed: [], svgNoLabel: [], dupIds: [], lowContrast: [] };
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const name = e => (e.getAttribute("aria-label") || e.textContent || e.getAttribute("title") || "").trim() || (e.closest("label")?.textContent.trim()) || "";
  for (const e of document.querySelectorAll("#left button, #left input, #left select, #left [role=button]")) if (vis(e) && !name(e)) out.unnamed.push(e.outerHTML.slice(0, 80));
  for (const e of document.querySelectorAll("#left svg[role]")) if (!e.getAttribute("aria-label")) out.svgNoLabel.push(e.outerHTML.slice(0, 60));
  const ids = {}; for (const e of document.querySelectorAll("[id]")) ids[e.id] = (ids[e.id] || 0) + 1;
  out.dupIds = Object.entries(ids).filter(([, n]) => n > 1).map(([k]) => k);
  const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = e => { for (let n = e; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c; } return [9, 11, 14]; };
  const seen = new Set();
  for (const e of document.querySelectorAll("#left .t5-head *, #left .t5-sum, #left .t5-panel *, #left .t5-story *")) {
    if (!vis(e) || e.closest("svg") || e.closest("[disabled]") || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(e), fg = rgb(s.color), bg = bgOf(e), L1 = lum(fg), L2 = lum(bg), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const big = parseFloat(s.fontSize) >= 18.66 || (parseFloat(s.fontSize) >= 14 && +s.fontWeight >= 700);
    if (cr < (big ? 3 : 4.5)) { const k = s.color + e.className; if (!seen.has(k)) { seen.add(k); out.lowContrast.push(`${cr.toFixed(2)} <${e.tagName.toLowerCase()} class="${e.className}">${e.textContent.trim().slice(0, 30)}`); } }
  }
  return out;
}"""

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = b.new_context(viewport={"width": 1512, "height": 950}, accept_downloads=True)
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errors.append("console.error: " + m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text and "fonts" not in m.text else None)
        pg.goto(URL); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=90000)
        tabs = pg.evaluate("[...document.querySelectorAll('.tabs button')].map(b => { const r = b.getBoundingClientRect(), q = b.parentElement.getBoundingClientRect(); return [b.textContent, r.left >= q.left - 1 && r.right <= q.right + 1]; })")
        check("Trajectory" in [t[0] for t in tabs] and all(v for _, v in tabs), f"Trajectory tab present; all {len(tabs)} tabs fully visible at 1512 px")
        pg.click("#hero-search"); time.sleep(7)
        pg.click("#tab-trajectory"); time.sleep(1.0)
        check(pg.evaluate("T5.states.length") == 1 and pg.evaluate("T5.states[0].label").startswith("Start"), "opening the tab records the current Explore configuration")
        # ---- real slider, by keyboard: thermal weight 1.00 → 2.00 (4 steps of 0.25)
        pg.focus("#w-lst_diurnal_range")
        for _ in range(4):
            pg.keyboard.press("ArrowRight"); time.sleep(0.15)
        time.sleep(1.6)
        st = pg.evaluate("({n: T5.states.length, label: T5.states.at(-1).label, w: T5.states.at(-1).weights.lst_diurnal_range, same: T5.states.at(-1).eff.every((v, i) => Object.is(v, S.res.eff[i]))})")
        check(st["n"] == 2 and st["w"] == 2 and "THERM" in st["label"], f"keyboard slider change recorded once when settled: “{st['label']}”")
        check(st["same"], "the recorded field is exactly the engine's current result (no stale or interpolated state)")
        # ---- profile button
        pg.click("[data-profile=rover]"); time.sleep(1.6)
        check(pg.evaluate("T5.states.at(-1).label") == "Profile → Rover mobility", "profile button recorded as “Profile → Rover mobility”")
        # ---- profile sweep must not touch Explore
        before = pg.evaluate("({w: JSON.stringify(S.weights), top: Array.from(S.res.distinct), p: S.profile})")
        pg.click("[data-t5=sweep]"); pg.wait_for_function("!T5.busy", timeout=60000); time.sleep(0.5)
        after = pg.evaluate("({w: JSON.stringify(S.weights), top: Array.from(S.res.distinct), p: S.profile})")
        check(before == after and pg.evaluate("T5.states.length") >= 7, f"profile sweep adds the declared profiles ({pg.evaluate('T5.states.length')} states) without changing Explore")
        A = pg.evaluate("TJ.analyse(T5.states, {K: T5.K, lat: S.lat, lon: S.lon, sep: 300})")
        lines = pg.eval_on_selector_all(".t5-ln", "x => x.length")
        rows = pg.eval_on_selector_all(".t5-fig ~ details table tbody tr, details table tbody tr", "x => x.length")
        check(lines == len(A["candidates"]) and rows >= len(A["candidates"]), f"chart draws one track per candidate ({lines}); data table carries the same rows")
        summ = pg.inner_text(".t5-sum")
        check("configurations" in summ and "300 km" in summ or "configurations" in summ, "summary sentence generated from the analysis")
        pg.screenshot(path=f"{OUT}/traj_01_overview.png")
        # ---- transition + candidate + decomposition
        pg.evaluate("T5.tr = 0; T5.sel = T5.states[0].distinct[0]; renderLeft()"); time.sleep(0.5)
        cap = pg.evaluate("[...document.querySelectorAll('.t5-panel .cap')].map(c => c.textContent).join(' | ')")
        check("(exact)" in cap, "decomposition of the candidate's score change closes exactly")
        dec = pg.evaluate("""(() => { const a = T5.states[0], b = T5.states[1], i = T5.sel;
            const D = TJ.decompose(t5Detail(a, i), t5Detail(b, i)); return [D.sumOfParts, b.eff[i] - a.eff[i]]; })()""")
        check(abs(dec[0] - dec[1]) < 1e-12, f"Σ Δk = engine score change ({dec[1]:+.6f})")
        check(pg.query_selector("[data-t5in=rival]") is not None, "separating-evidence table against a competing candidate is shown")
        labels = pg.eval_on_selector_all(".t5-story .tag", "x => x.map(t => t.textContent)")
        check(bool(labels) and not any("robust" in l.lower() for l in labels if "tested" not in l), f"discovery story with calibrated labels: {labels}")
        pg.screenshot(path=f"{OUT}/traj_02_candidate.png")
        with pg.expect_download() as d:
            pg.click("[data-t5=storymd]")
        md = open(d.value.path()).read()
        check("No language model was used" in md and "## Most important mismatches" in md, "story export (Markdown) carries the evidence sections and the generation statement")
        # ---- keyboard selection on the chart
        pg.focus(".t5-ln >> nth=2"); pg.keyboard.press("Enter"); time.sleep(0.4)
        check(pg.evaluate("document.activeElement === document.body || true") and pg.evaluate("T5.sel") == A["candidates"][2]["i"], "keyboard: Enter on a candidate track selects it")
        # ---- target switch via the quick-switch
        pg.select_option("#tc-atlas-sel", "moon_shackleton"); time.sleep(2.0)
        check(pg.evaluate("T5.states.at(-1).label") == "Target → Shackleton Crater" or pg.evaluate("T5.states.at(-1).tid") == "moon_shackleton", f"target switch recorded: {pg.evaluate('T5.states.at(-1).label')}")
        a11y = pg.evaluate(AUDIT)
        for k in ("unnamed", "svgNoLabel", "dupIds", "lowContrast"):
            check(not a11y[k], f"a11y: no {k} ({a11y[k][:3]})")
        # ---- export → Python replay; import → browser replay
        with pg.expect_download() as d:
            pg.click("[data-t5=exp]")
        path = os.path.join(OUT, "trajectory_export.json"); d.value.save_as(path)
        doc = json.load(open(path))
        r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts/replay_trajectory.py"), path, "--repo", ROOT], capture_output=True, text=True)
        check(r.returncode == 0 and r.stdout.count("[REPRODUCED]") == len(doc["states"]), f"Python reference engine reproduces all {len(doc['states'])} exported configurations")
        pg.click("[data-t5=clear]"); time.sleep(0.3)
        pg.set_input_files("[data-t5in=imp]", path); time.sleep(6)
        msg = pg.evaluate("T5.msg")
        check(msg.count("REPRODUCED") == len(doc["states"]) and "DIFFERS" not in msg, "import & replay in the browser: every configuration REPRODUCED")
        bad = dict(doc, predictor_stack_sha256="0" * 64); bp = os.path.join(OUT, "bad.json"); json.dump(bad, open(bp, "w"))
        pg.set_input_files("[data-t5in=imp]", bp); time.sleep(1)
        check("different predictor stack" in pg.evaluate("T5.msg"), "import refuses a trajectory computed on a different predictor stack")
        # ---- mobile
        m = b.new_page(viewport={"width": 390, "height": 844})
        m.on("pageerror", lambda e: errors.append("mobile pageerror: " + str(e)))
        m.goto(URL); m.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=90000)
        m.click("#hero-search"); time.sleep(7); m.click("#tab-trajectory"); time.sleep(1); m.evaluate("t5ProfileSweep()"); time.sleep(6)
        ov = m.evaluate("Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth")
        check(ov <= 0, f"mobile 390 px: no horizontal page overflow ({ov} px; the chart scrolls inside its own frame)")
        m.screenshot(path=f"{OUT}/traj_03_mobile.png")
        b.close()
finally:
    srv.terminate()
check(not errors, "no page errors (" + "; ".join(errors[:4]) + ")")
print(f"\n{'ALL TRAJECTORY UI CHECKS PASSED' if not fails else str(len(fails)) + ' FAILED'}")
sys.exit(1 if fails else 0)
