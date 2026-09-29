"""UI smoke test (Playwright/Chromium, SwiftShader WebGL): hero -> search -> select #1 ->
weight change -> why-did-this-move -> trace -> reproduce -> tabs -> mobile. Saves screenshots."""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/claude-0/shots"
os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765", "-d", os.path.join(ROOT, "public")],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
errors, results = [], {}
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        pg = b.new_page(viewport={"width": 1512, "height": 900}, device_scale_factor=1)
        pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errors.append("console." + m.type + ": " + m.text) if m.type in ("error", "warning") else None)
        pg.goto("http://localhost:8765/index.html")
        pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=30000)
        time.sleep(0.6); pg.screenshot(path=f"{OUT}/01_hero.png")
        pg.click("#hero-search"); time.sleep(6.5)
        pg.screenshot(path=f"{OUT}/02_searched.png")
        results["top1"] = pg.inner_text(".site >> nth=0")
        pg.click(".site >> nth=0"); time.sleep(1.4)
        pg.screenshot(path=f"{OUT}/03_selected.png")
        # thermal weight up
        pg.fill("#w-lst_diurnal_range", "3"); pg.dispatch_event("#w-lst_diurnal_range", "change"); time.sleep(0.8)
        pg.click("#tab-scenarios"); time.sleep(0.5)
        results["why"] = pg.inner_text("#why")[:400]
        pg.screenshot(path=f"{OUT}/04_scenarios.png")
        pg.click("button[data-whatif=thermal_x2]"); time.sleep(0.9)
        pg.screenshot(path=f"{OUT}/05_whatif.png")
        pg.click("#tab-compare"); time.sleep(0.6); pg.screenshot(path=f"{OUT}/06_compare.png")
        pg.click("#tab-discover"); time.sleep(0.8); pg.screenshot(path=f"{OUT}/07_discover.png")
        pg.click("#tab-data"); time.sleep(0.5); pg.screenshot(path=f"{OUT}/08_data.png")
        pg.click("button[data-act=trace] >> nth=0"); time.sleep(0.5); pg.screenshot(path=f"{OUT}/09_trace.png")
        results["trace_formula"] = pg.inner_text("#sheet-body .formula")[:300]
        pg.click("#to-repro"); time.sleep(0.3)
        repro = json.loads(pg.inner_text("#sheet-body pre"))
        json.dump(repro, open(f"{OUT}/reproduce.json", "w"), indent=1)   # check: python -m scripts.reproduce <OUT>/reproduce.json
        results["repro"] = repro["selected_cell"]
        pg.click("#sheet-close")
        pg.click("#tab-method"); time.sleep(0.4); pg.screenshot(path=f"{OUT}/10_method.png")
        pg.click("#tgt-moon"); pg.click("#tab-explore"); time.sleep(0.8); pg.screenshot(path=f"{OUT}/11_moon.png")
        pg.click("#tgt-cross"); pg.click("#tab-compare"); time.sleep(1.2); pg.screenshot(path=f"{OUT}/12_cross.png")
        pg.click("#proj-map"); time.sleep(1.6); pg.screenshot(path=f"{OUT}/13_map.png")
        # click on the map to reverse search (centre of viewport)
        box = pg.locator("#globe").bounding_box(); pg.mouse.click(box["x"] + box["width"] * 0.62, box["y"] + box["height"] * 0.42); time.sleep(0.8)
        pg.screenshot(path=f"{OUT}/14_pick.png")
        m = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        m.on("pageerror", lambda e: errors.append("mobile pageerror: " + str(e)))
        m.goto("http://localhost:8765/index.html"); m.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=30000)
        time.sleep(0.5); m.screenshot(path=f"{OUT}/20_m_hero.png")
        m.click("#hero-search"); time.sleep(6.5); m.screenshot(path=f"{OUT}/21_m_search.png", full_page=True)
        results["mobile_overflow"] = m.evaluate("document.documentElement.scrollWidth - innerWidth")
        b.close()
finally:
    srv.terminate()
print(json.dumps(results, indent=1))
print("ERRORS:", json.dumps(errors, indent=1))
