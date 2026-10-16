"""Phase III UI walk-through (Playwright/Chromium). Opens the Atlas tab, visits every module, runs
the comparison (Gale · Elysium · Shackleton), stability, measurement impact, workflow, records with
browser replay, and checks page errors, the unchanged baseline result and mobile overflow.

    python tests/phase3/ui_atlas_smoke.py [outdir] [--fixtures]
"""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "/tmp/asterro_atlas_shots"
FIX = "--fixtures" in sys.argv
os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8791", "-d", os.path.join(ROOT, "public")],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
errors, res = [], {}


def wait_idle(pg, timeout=180):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if not pg.query_selector(".lab-busy"):
            return True
        time.sleep(0.4)
    return False


try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        pg = b.new_page(viewport={"width": 1512, "height": 900})
        pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errors.append("console." + m.type + ": " + m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text and "fonts" not in m.text else None)
        pg.goto("http://localhost:8791/index.html")
        pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=60000)
        res["tabs"] = pg.eval_on_selector_all(".tabs button", "bs => bs.map(b => b.textContent)")
        pg.click("#hero-search"); time.sleep(6.5)
        base_top = pg.inner_text(".site >> nth=0")
        base = pg.evaluate("({eff: Array.from(S.res.eff.slice(0, 200)), w: JSON.stringify(S.weights), t: S.targetId, ranges: JSON.stringify(S.ranges)})")
        pg.click("#tab-atlas"); pg.wait_for_selector(".at-cards", timeout=30000); time.sleep(0.8)
        res["mars_cards"] = pg.eval_on_selector_all(".at-card", "x => x.length")
        pg.screenshot(path=f"{OUT}/atlas_00_catalog_mars.png")
        pg.click("[data-a3=body][data-b=Moon]"); time.sleep(0.5)
        res["moon_cards"] = pg.eval_on_selector_all(".at-card", "x => x.length")
        pg.screenshot(path=f"{OUT}/atlas_01_catalog_moon.png")
        pg.fill("[data-a3live=q]", "apollo"); time.sleep(0.8)
        res["search_apollo"] = pg.eval_on_selector_all(".at-card", "x => x.length")
        pg.fill("[data-a3live=q]", ""); time.sleep(0.6)

        def view(v, shot=None, wait=0.8):
            pg.click(f"[data-a3view={v}]"); time.sleep(wait)
            if shot: pg.screenshot(path=f"{OUT}/{shot}.png", full_page=False)

        # target detail with terrain previews
        pg.evaluate("A3.active = 'moon_shackleton'"); view("target", wait=2.0)
        res["raster_canvases"] = pg.eval_on_selector_all("canvas.at-raster", "x => x.length")
        pg.screenshot(path=f"{OUT}/atlas_02_target_shackleton.png")
        # compare: the user's example
        pg.click("[data-a3view=catalog]"); time.sleep(0.4); pg.click("[data-a3=selexample]"); time.sleep(2.5)
        res["compare_cols"] = pg.eval_on_selector_all(".at-col", "x => x.length")
        pg.screenshot(path=f"{OUT}/atlas_03_compare.png")
        t0 = time.time(); pg.click("[data-a3=stab]"); time.sleep(0.5); wait_idle(pg); res["stability_s"] = round(time.time() - t0, 1)
        res["stability_tags"] = pg.eval_on_selector_all(".at-rank .rq", "x => x.length")
        t0 = time.time(); pg.click("[data-a3=impact]"); time.sleep(1.0); res["impact_s"] = round(time.time() - t0, 1)
        res["impact_text"] = pg.inner_text(".sec:has(.lbl:text('7 · Discriminating measurements'))")[:600]
        pg.click("[data-a3=cmp-save]"); time.sleep(1.0)
        pg.screenshot(path=f"{OUT}/atlas_04_compare_done.png", full_page=True)
        # workflow on Gale / Curiosity
        pg.evaluate("A3.active = 'mars_gale_curiosity'"); view("workflow", wait=1.5)
        pg.click(".at-rank [data-a3=cand] >> nth=0"); time.sleep(2.0)
        if pg.query_selector("[data-a3=wf-stab]"): pg.click("[data-a3=wf-stab]"); time.sleep(0.5); wait_idle(pg); time.sleep(0.5)
        pg.fill("[data-a3in=wf-obj]", "compare diurnal surface thermal cycling"); pg.dispatch_event("[data-a3in=wf-obj]", "change")
        pg.click("[data-a3=wf-plan]"); time.sleep(0.6); pg.click("[data-a3=wf-rec]"); time.sleep(1.2)
        res["stages"] = pg.eval_on_selector_all("ol.at-stages li", "x => x.map(l => l.className)")
        pg.screenshot(path=f"{OUT}/atlas_05_workflow.png", full_page=True)
        # every other module
        for v in ["extremes", "landing", "counter", "mismatch", "translate", "expedition", "constellation", "copilot", "provenance"]:
            view(v, shot=f"atlas_m_{v}", wait=1.5)
        pg.click("[data-a3view=copilot]"); time.sleep(0.4)
        for q in ["What is missing for Elysium Planitia?", "Is Shackleton safe to land?", "What is the weather on Jupiter?"]:
            pg.fill("[data-a3in=cp-q]", q); pg.dispatch_event("[data-a3in=cp-q]", "change"); pg.click("[data-a3=cp-ask]"); time.sleep(0.4)
        res["copilot"] = pg.evaluate("A3.copilot.log.map(m => m.a.slice(0, 140))")
        # records + browser replay
        view("records", wait=0.8)
        btns = pg.query_selector_all("[data-a3=rec-replay]"); res["records"] = len(btns)
        for k in range(len(btns)):
            pg.click(f"[data-a3=rec-replay] >> nth={k}"); time.sleep(3.0)
        res["replays"] = pg.evaluate("Object.values(A3.replayMsg || {})")
        if FIX:
            recs = pg.evaluate("A3.records.filter(r => ['atlas-candidates','atlas-stability'].includes(r.module))")
            fd = os.path.join(ROOT, "tests/phase3/fixtures"); os.makedirs(fd, exist_ok=True)
            for r in recs:
                json.dump(r, open(os.path.join(fd, f"record_{r['module']}_{r['id']}.json"), "w"), indent=1)
            res["fixtures_written"] = len(recs)
        # baseline unchanged after everything
        after = pg.evaluate("({eff: Array.from(S.res.eff.slice(0, 200)), w: JSON.stringify(S.weights), t: S.targetId, ranges: JSON.stringify(S.ranges)})")
        res["baseline_unchanged"] = after == base
        pg.click("#tab-explore"); time.sleep(1.0)
        res["baseline_top_same"] = pg.inner_text(".site >> nth=0") == base_top
        # mobile
        m = b.new_page(viewport={"width": 390, "height": 844})
        m.on("pageerror", lambda e: errors.append("mobile pageerror: " + str(e)))
        m.goto("http://localhost:8791/index.html#explore"); time.sleep(8)
        m.evaluate("setTab('atlas')"); time.sleep(3)
        res["mobile_overflow_px"] = m.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        m.screenshot(path=f"{OUT}/atlas_mobile.png")
        b.close()
finally:
    srv.terminate()
res["errors"] = errors
print(json.dumps(res, indent=1))
ok = not errors and res.get("baseline_unchanged") and res.get("baseline_top_same") and all("REPRODUCED" in x for x in res.get("replays", [])) and res.get("replays")
sys.exit(0 if ok else 1)
