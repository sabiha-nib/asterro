"""Mismatch Signatures + Method Arena UI walk-through (Playwright/Chromium).

    python tests/phase4/ui_methods_smoke.py [outdir]

Checks the views inside the existing Atlas workspace: mismatch families partition the eligible cells, the Earth
ceiling flags Jezero's thermal criterion as structural, family / site selection, target switching, the JSON
mismatch report; the arena's baseline equals Explore's live field, six pairwise comparisons, stale results are
hidden after a weight change, the exported arena report is re-scored by the independent Python implementation
(tests/test_methods.py) with the same leading sites, accessibility audit, phone width, no page errors.
"""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_methods_shots"
os.makedirs(OUT, exist_ok=True)
PORT = 8792
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
errors, fails = [], []


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


AUDIT = r"""() => {
  const out = { unnamed: [], dupIds: [], lowContrast: [] };
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const name = e => (e.getAttribute("aria-label") || e.textContent || e.getAttribute("title") || "").trim() || (e.closest("label")?.textContent.trim()) || "";
  for (const e of document.querySelectorAll("#left [data-p4] button, #left [data-p4] select")) if (vis(e) && !name(e)) out.unnamed.push(e.outerHTML.slice(0, 80));
  const ids = {}; for (const e of document.querySelectorAll("[id]")) ids[e.id] = (ids[e.id] || 0) + 1;
  out.dupIds = Object.entries(ids).filter(([, n]) => n > 1).map(([k]) => k);
  const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = e => { for (let n = e; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c; } return [9, 11, 14]; };
  const seen = new Set();
  for (const e of document.querySelectorAll("#left [data-p4] *")) {
    if (!vis(e) || e.closest("svg") || e.closest("[disabled]") || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(e), fg = rgb(s.color), bg = bgOf(e), L1 = lum(fg), L2 = lum(bg), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const big = parseFloat(s.fontSize) >= 18.66 || (parseFloat(s.fontSize) >= 14 && +s.fontWeight >= 700);
    if (cr < (big ? 3 : 4.5)) { const k = s.color + e.className; if (!seen.has(k)) { seen.add(k); out.lowContrast.push(`${cr.toFixed(2)} <${e.tagName.toLowerCase()} class="${e.className}">${e.textContent.trim().slice(0, 30)}`); } }
  }
  return out;
}"""


def nav(pg, view, group):
    pg.click(f".p4-g1 button:text-is('{group}')"); time.sleep(0.3)
    pg.click(f".p4-g2 [data-a3view={view}]"); time.sleep(1.2)


try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = b.new_context(viewport={"width": 1512, "height": 950}, accept_downloads=True)
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errors.append("console.error: " + m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text and "fonts" not in m.text else None)
        pg.goto(URL); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=90000)
        pg.click("#hero-search"); time.sleep(7)
        pg.click("#tab-atlas"); pg.wait_for_selector(".p4-g1", timeout=60000); time.sleep(1)
        # ---------------------------------------------------------------- mismatch signatures
        nav(pg, "mmsig", "Compare")
        info = pg.evaluate("({n: M6._last.F.nFamilies, sum: M6._last.F.families.reduce((t, f) => t + f.size, 0), el: M6._last.F.nEligible, lst: M6._last.C.find(x => x.criterion === 'lst_diurnal_range').structural})")
        check(info["sum"] == info["el"] and info["n"] > 10, f"Jezero: {info['n']} mismatch families partition all {info['el']:,} eligible cells")
        check(info["lst"] and pg.locator(".m6-struct").count() == 1, "Earth ceiling: LST diurnal range flagged as the only structural limit")
        pg.screenshot(path=f"{OUT}/mm_01.png")
        pg.click(".m6-sig >> nth=3"); time.sleep(0.8)
        fam = pg.evaluate("M6.fam"); k3 = pg.evaluate("M6._last.F.families[3].key")
        check(fam == k3 and pg.locator("#m6fam-field").count() == 1, "selecting a family shows its distinct sites on the map")
        pg.click("[data-m6=cell] >> nth=0"); time.sleep(0.8)
        check(pg.evaluate("M6._sw.i === M6.cell"), "selecting a site recomputes “fails the same way” for it")
        with pg.expect_download() as d:
            pg.click("[data-m6=exp-sig]")
        rep = json.load(open(d.value.path()))
        check(rep["schema"] == "asterro.mismatch-signatures/1" and sum(f["cells"] for f in rep["families"]) == rep["n_eligible"] and rep["predictor_stack_sha256"], "mismatch report: schema, complete family partition, stack hash")
        pg.select_option("[data-m6in=tid]", "moon_shackleton"); time.sleep(1.5)
        sh = pg.evaluate("({tid: M6._last.ctx.tid, crit: M6._last.F.criteria, cfg: M6._last.ctx.config})")
        check(sh["tid"] == "moon_shackleton" and "annual_temperature_range" not in sh["crit"] and sh["cfg"] == "explore-target-v1", "Shackleton: N/A criterion is not part of the signature; explore-target-v1 ranges used")
        a1 = pg.evaluate(AUDIT)
        pg.select_option("[data-m6in=tid]", "mars_jezero"); time.sleep(1.0)
        # ---------------------------------------------------------------- method arena
        nav(pg, "arena", "Research")
        pg.click("[data-m6=run]"); pg.wait_for_function("M6.arena && !M6.busy", timeout=120000); time.sleep(0.5)
        ar = pg.evaluate("({ms: M6.arena.ms, chk: M6.arena.baselineCheck, pairs: M6.arena.pairs.length, robust: M6.arena.robust.length})")
        check(ar["chk"] == 0, "arena baseline field is bit-identical to Explore's live field")
        check(ar["pairs"] == 6, f"six pairwise method comparisons ({ar['ms'] / 1000:.1f} s for 4 rules + 3 data counterfactuals)")
        pg.screenshot(path=f"{OUT}/ar_01.png")
        with pg.expect_download() as d:
            pg.click("[data-m6=exp-arena]")
        arep = json.load(open(d.value.path()))
        import tests.test_methods as TM
        from src.compute.ranking import distinct_sites
        tv = json.load(open(os.path.join(ROOT, "data/targets.json")))["targets"][0]["variables"]
        okpy = True
        for m, r in arep["methods"].items():
            eff = TM.score(m, tv, arep["weights"], arep["normalization_ranges"])
            ds = distinct_sites(eff, TM.CELL, TM.LAT, TM.LON, n=10, min_sep_km=300)
            if [dict(cell_id=int(TM.CELL[i]), score=round(float(eff[i]), 12)) for i in ds] != r["top"]:
                okpy = False
        check(okpy and arep["schema"] == "asterro.method-arena/1", "exported arena report re-scored by the independent Python implementation: same leading sites for all 4 rules")
        check(len(arep["data_counterfactuals"]) == 3 and any(x["kept"] == 0 for x in arep["data_counterfactuals"]), "data counterfactuals for the 3 Earth sources are in the report")
        pg.evaluate("commitWeights({...S.weights, lst_diurnal_range: 2}, 'test')"); time.sleep(1.2)
        pg.click("#tab-atlas"); time.sleep(1.0)
        check(pg.locator("text=results hidden until you re-run").count() == 1 and pg.locator("[data-m6=exp-arena]").count() == 0, "after a weight change the old arena results are hidden (never shown as current)")
        a2 = pg.evaluate(AUDIT)
        for k, a in (("signatures", a1), ("arena", a2)):
            for key in ("unnamed", "dupIds", "lowContrast"):
                check(not a[key], f"a11y {k}: no {key} ({a[key][:3]})")
        m = b.new_page(viewport={"width": 390, "height": 844})
        m.on("pageerror", lambda e: errors.append("mobile pageerror: " + str(e)))
        m.goto(URL); m.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=90000)
        m.click("#hero-search"); time.sleep(7); m.evaluate("A3.view = 'mmsig'; setTab('atlas')"); time.sleep(3)
        ov = m.evaluate("Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth")
        check(ov <= 0, f"mobile 390 px: no horizontal page overflow ({ov} px)")
        b.close()
finally:
    srv.terminate()
check(not errors, "no page errors (" + "; ".join(errors[:4]) + ")")
print(f"\n{'ALL METHOD UI CHECKS PASSED' if not fails else str(len(fails)) + ' FAILED'}")
sys.exit(1 if fails else 0)
