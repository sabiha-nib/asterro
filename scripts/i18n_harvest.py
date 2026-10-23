"""Harvest every English segment the research routes render (developer tool for the route catalogues).

    python3 scripts/i18n_harvest.py [--suites] [--out build/i18n/harvest.json]

1. A sweep of its own: every tab, every Lab and Atlas module, three targets, the Trace / Report / Reproduce sheets.
2. With --suites, also every existing browser walk-through (they drive the modules into their result states), run
   unchanged under a hook that records what they render.
Segments are keyed exactly as the runtime translator keys them (i18n_60_seg.js: i18gHarvest), so the output is the
list of keys the catalogues must carry. Nothing is translated here.
"""
import json, os, runpy, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else os.path.join(ROOT, "build/i18n/harvest.json")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
SEEN = {}

INIT = r"""(() => {
  let t = 0; const sent = new Set();
  const go = () => { t = 0;
    try { if (typeof i18gHarvest !== "function" || typeof S === "undefined" || !S.app || I18N.lang !== "en") return;
      const roots = []; const left = document.getElementById("left"); if (left && S.tab !== "explore") roots.push(left);
      const sh = document.getElementById("sheet"); if (sh && !sh.hidden) roots.push(sh);
      const route = i18gRoute(), batch = [];
      for (const r of roots) for (const h of i18gHarvest(r, r.id === "sheet" ? "sheet" : route)) { const id = h.key + "\u0001" + h.route; if (!sent.has(id)) { sent.add(id); batch.push(h); } }
      if (batch.length && window.__harvest) window.__harvest(JSON.stringify(batch));
    } catch (e) { }
  };
  new MutationObserver(() => { if (!t) t = setTimeout(go, 120); }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true });
})();"""


def collect(batch):
    for h in json.loads(batch):
        k = h["key"]
        e = SEEN.setdefault(k, {"nkey": h.get("nkey"), "text": h["text"], "routes": [], "quote": h.get("quote"), "attr": h.get("attr"), "auto": h.get("auto")})
        if h["route"] not in e["routes"]:
            e["routes"].append(h["route"])


def hook_context(ctx):
    ctx.add_init_script(INIT)
    try:
        ctx.expose_function("__harvest", collect)
    except Exception:
        pass


def patch_playwright():
    from playwright.sync_api._generated import Browser
    orig = Browser.new_context
    def new_context(self, *a, **k):
        ctx = orig(self, *a, **k); hook_context(ctx); return ctx
    Browser.new_context = new_context
    orig_page = Browser.new_page
    def new_page(self, *a, **k):
        ctx = self.new_context(*a, **k); return ctx.new_page()
    Browser.new_page = new_page


def sweep():
    from playwright.sync_api import sync_playwright
    port = 8797
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
            ctx = b.new_context(viewport={"width": 1512, "height": 950}, reduced_motion="reduce")
            pg = ctx.new_page(); pg.set_default_timeout(90000)
            pg.goto(f"http://localhost:{port}/index.html")
            pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000)
            pg.evaluate("runSearch()"); pg.wait_for_function("S.searched", timeout=60000); time.sleep(0.5)
            pg.evaluate("a4Load()"); pg.wait_for_function("A4.reg", timeout=90000); time.sleep(0.3)
            labmods = pg.evaluate("LAB_MODULES.map(m => m.id)")
            atmods = pg.evaluate("A4_GROUPS.flatMap(g => g.items.map(x => x[0]))")
            for tid in ["mars_jezero", "moon_south_pole", "cross"]:
                pg.evaluate(f"setTarget('{tid}')"); time.sleep(0.8)
                for tab in ["compare", "scenarios", "discover", "data", "method", "trajectory"]:
                    pg.evaluate(f"setTab('{tab}')"); time.sleep(0.6)
                pg.evaluate("setTab('lab')"); time.sleep(0.4)
                for m in labmods:
                    pg.evaluate(f"(() => {{ const b = document.querySelector('[data-labmod={m}]'); if (b) b.click(); }})()"); time.sleep(0.9)
                    for _ in range(40):
                        if not pg.evaluate("!!(typeof L !== 'undefined' && L.busy)"): break
                        time.sleep(0.5)
                pg.evaluate("setTab('atlas')"); time.sleep(0.5)
                for m in atmods:
                    pg.evaluate(f"(() => {{ A3.view = '{m}'; atRender(); }})()"); time.sleep(0.8)
                md = pg.evaluate("(() => { const out = []; for (const k of [0, 1, 2, 5, 9]) { const i = S.res.distinct[k]; if (i != null) out.push(...i18gMdHarvest(reportMD(i))); } return JSON.stringify(out); })()")
                collect(md)
                for fn in ["showTrace", "showReproduce", "showReport"]:
                    pg.evaluate("setTab('explore')"); pg.evaluate(f"select(S.res.distinct[0]); {fn}()"); time.sleep(0.6); pg.evaluate("closeSheet()"); time.sleep(0.2)
            b.close()
    finally:
        srv.terminate()


if __name__ == "__main__":
    patch_playwright()
    if "--merge" in sys.argv and os.path.exists(OUT):
        SEEN.update(json.load(open(OUT)))
    sweep()
    print(f"sweep: {len(SEEN)} keys", flush=True)
    if "--suites" in sys.argv:
        suites = ["tests/phase2/ui_lab_smoke.py", "tests/phase3/ui_atlas_smoke.py", "tests/phase4/ui_phase4_smoke.py",
                  "tests/phase4/ui_trajectory_smoke.py", "tests/phase4/ui_methods_smoke.py", "tests/ui_smoke.py"]
        for s in suites:
            argv = sys.argv; sys.argv = [s, "/tmp/asterro_harvest_shots"]
            try:
                runpy.run_path(os.path.join(ROOT, s), run_name="__main__")
            except SystemExit:
                pass
            except Exception as e:
                print("suite error", s, e)
            sys.argv = argv
            print(f"{s}: {len(SEEN)} keys", flush=True)
    json.dump(SEEN, open(OUT, "w"), ensure_ascii=False, indent=1, sort_keys=True)
    print("wrote", OUT, len(SEEN))
