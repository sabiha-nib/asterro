"""Phase II UI walk-through (Playwright/Chromium). Visits every Lab module, runs each experiment,
checks for page errors and that the baseline result is unchanged, and saves screenshots.

    python tests/phase2/ui_lab_smoke.py [outdir]
"""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_lab_shots"
os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8790", "-d", os.path.join(ROOT, "public")],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
errors, res = [], {}


def wait_idle(pg, timeout=120):
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
        pg.goto("http://localhost:8790/index.html")
        pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=60000)
        res["tabs"] = pg.eval_on_selector_all(".tabs button", "bs => bs.map(b => b.textContent)")
        pg.click("#hero-search"); time.sleep(6.5)
        base_top = pg.inner_text(".site >> nth=0")
        base_eff = pg.evaluate("Array.from(S.res.eff.slice(0, 50))")
        pg.click("#tab-lab"); time.sleep(0.8)
        pg.screenshot(path=f"{OUT}/lab_00_overview.png")

        def mod(m):
            pg.click(f"[data-labmod={m}]"); time.sleep(0.7)

        mod("robust"); pg.select_option("[data-labin=robust][data-k=design]", "factorial"); time.sleep(0.3)
        t0 = time.time(); pg.click("[data-lab=robust-run]"); time.sleep(0.5); wait_idle(pg); res["robust_s"] = round(time.time() - t0, 1)
        res["robust_rows"] = pg.eval_on_selector_all(".rq", "x => x.length")
        pg.screenshot(path=f"{OUT}/lab_01_robust.png", full_page=False)
        pg.click("[data-lab=ablation-run]"); time.sleep(0.5); wait_idle(pg); time.sleep(0.5)
        res["ablation_rows"] = pg.evaluate("L.res.ablation ? L.res.ablation.rows.length : 0")
        pg.evaluate("document.querySelector('#left').scrollTop = 99999"); time.sleep(0.2)
        pg.screenshot(path=f"{OUT}/lab_02_ablation.png")
        mod("portfolio"); pg.click("[data-lab=mo-run]"); time.sleep(1.5)
        res["pareto"] = pg.evaluate("L.res.mo && L.res.mo.P ? L.res.mo.P.front.length : null")
        pg.screenshot(path=f"{OUT}/lab_03_portfolio.png")
        mod("atlas"); time.sleep(0.8); pg.screenshot(path=f"{OUT}/lab_04_atlas.png")
        mod("uncert"); time.sleep(0.8); pg.screenshot(path=f"{OUT}/lab_05_uncert.png")
        mod("failure"); time.sleep(0.8); pg.click("[data-lab=fm-run]"); time.sleep(3); pg.screenshot(path=f"{OUT}/lab_06_failure.png")
        res["counterexamples"] = pg.evaluate("L.res.fm ? {a: L.res.fm.a.length, b: L.res.fm.b.length, flips: L.res.fm.flips.length, pd: L.res.fm.pd && L.res.fm.pd.list.length} : null")
        mod("graph"); time.sleep(1.0); pg.screenshot(path=f"{OUT}/lab_07_graph.png")
        res["graph"] = pg.evaluate("(() => { const G = evBuildGraph(labSel(), S.targetId === 'cross' ? 'mars_jezero' : S.targetId, 'all'); return {nodes: G.nodes.length, edges: G.edges.length, types: [...new Set(G.nodes.map(n => n.type))].length, etypes: [...new Set(G.edges.map(e => e.type))]}; })()")
        mod("xplanet"); time.sleep(1.0); pg.screenshot(path=f"{OUT}/lab_08_xplanet.png")
        mod("temporal"); time.sleep(0.6); pg.click("[data-lab=t-load]"); time.sleep(6); pg.screenshot(path=f"{OUT}/lab_09_temporal.png")
        res["series"] = pg.evaluate("L.series ? Object.keys(L.series) : L.seriesErr")
        mod("reqs"); time.sleep(0.6); pg.click("[data-lab=rq-ex]"); time.sleep(0.4); pg.click("[data-lab=rq-eval]"); time.sleep(2.5)
        res["reqs"] = pg.evaluate("L.res.reqEval ? L.res.reqEval.M.map(r => r.map(x => x.status).join(',')).slice(0, 3) : null")
        pg.screenshot(path=f"{OUT}/lab_10_reqs.png")
        mod("obsval"); time.sleep(0.6); pg.screenshot(path=f"{OUT}/lab_11_obsval.png")
        mod("planner"); time.sleep(0.4); pg.click("[data-lab=pl-build]"); time.sleep(1.5); pg.screenshot(path=f"{OUT}/lab_12_planner.png")
        res["plan_gaps"] = pg.evaluate("L.plan.out ? L.plan.out.evidence_gaps.length : null")
        mod("vault"); time.sleep(0.4)
        rec_ids = pg.evaluate("L.records.map(r => [r.id, r.module])"); res["records"] = rec_ids
        for rid, m in rec_ids:
            if m in ("robustness", "ablation", "requirements"):
                pg.click(f"[data-lab=v-replay][data-id='{rid}']"); time.sleep(0.5); wait_idle(pg, 180); time.sleep(0.5)
        res["replay"] = pg.evaluate("Object.fromEntries(Object.entries(L.vault.msg).map(([k, v]) => [k, v.replace(/<[^>]+>/g, '').slice(0, 40)]))")
        rob = [r for r, m in rec_ids if m == "robustness"]
        if rob:
            pg.click(f"[data-lab=v-export][data-id='{rob[0]}']"); time.sleep(0.4)
            pkg = pg.inner_text("#sheet-body pre"); open(f"{OUT}/robustness_record.json", "w").write(pkg); pg.click("#sheet-close")
        ab = [r for r, m in rec_ids if m == "ablation"]
        if ab:
            pg.click(f"[data-lab=v-export][data-id='{ab[0]}']"); time.sleep(0.4)
            open(f"{OUT}/ablation_record.json", "w").write(pg.inner_text("#sheet-body pre")); pg.click("#sheet-close")
        for rid, _ in rec_ids[:1]:
            pg.click(f"[data-lab=v-verify][data-id='{rid}']"); time.sleep(0.5)
        pg.screenshot(path=f"{OUT}/lab_13_vault.png")
        mod("review"); time.sleep(0.3); pg.click("[data-lab=rv-q][data-q=why]"); time.sleep(0.3)
        pg.fill("[data-labin=rv-text]", "The Altiplano is scientifically identical to Jezero and certified safe for rovers (85.0%, 12.3%)."); pg.dispatch_event("[data-labin=rv-text]", "change")
        pg.click("[data-lab=rv-run]"); time.sleep(0.4)
        res["review_flags"] = pg.evaluate("[L.rev.flags.length, L.rev.nums.map(n => n.match + ':' + n.ok)]")
        pg.screenshot(path=f"{OUT}/lab_14_review.png")
        # baseline untouched?
        pg.click("#tab-explore"); time.sleep(0.8)
        res["baseline_unchanged"] = pg.inner_text(".site >> nth=0") == base_top and pg.evaluate("Array.from(S.res.eff.slice(0, 50))") == base_eff
        res["weights_after"] = pg.evaluate("S.weights")
        # moon + cross smoke through every module
        for tgt in ("tgt-moon", "tgt-cross"):
            pg.click(f"#{tgt}"); time.sleep(1.2); pg.click("#tab-lab"); time.sleep(0.5)
            for m in ["robust", "portfolio", "atlas", "uncert", "failure", "graph", "xplanet", "temporal", "reqs", "obsval", "planner", "vault", "review"]:
                mod(m)
                txt = pg.inner_text("#left")
                if "This module failed" in txt:
                    errors.append(f"{tgt}:{m} module failed: " + txt[txt.find('This module failed'):][:200])
            pg.click("[data-labmod=robust]"); time.sleep(0.3); pg.select_option("[data-labin=robust][data-k=design]", "oat"); time.sleep(0.2); pg.click("[data-lab=robust-run]"); time.sleep(0.5); wait_idle(pg)
            pg.screenshot(path=f"{OUT}/lab_{tgt}_robust.png")
        m = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        m.on("pageerror", lambda e: errors.append("mobile pageerror: " + str(e)))
        m.goto("http://localhost:8790/index.html"); m.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=60000)
        m.click("#hero-search"); time.sleep(6); m.click("#tab-lab"); time.sleep(0.8)
        res["mobile_overflow"] = m.evaluate("document.documentElement.scrollWidth - innerWidth")
        m.screenshot(path=f"{OUT}/lab_m_overview.png", full_page=True)
        b.close()
finally:
    srv.terminate()
print(json.dumps(res, indent=1))
print("ERRORS:", json.dumps(errors, indent=1))
sys.exit(1 if errors or not res.get("baseline_unchanged") else 0)
