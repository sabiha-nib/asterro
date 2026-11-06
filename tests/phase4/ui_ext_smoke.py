"""Extension UI walk-through (Playwright/Chromium): discovery hub, extended fingerprint, processes, beyond the
familiar, extended profiles, Learn, research queue, report editions and the Data-view additions.

    python tests/phase4/ui_ext_smoke.py [outdir]

Checks, in the built single-file app:
  - the Discover tab keeps its original first view (constellations) and gains a six-button hub;
  - Temperature extremes: Earth limits for Jezero (night surface and mean air colder than any Earth cell), a
    configuration id, Python/JS parity of the extended field against tests/fixtures/ext_reference.json, and with the
    three new weights at 0 the leaders equal the baseline leaders; the coverage sweep keeps the 80 % row as standard;
  - Processes: data-backed processes report a cell count and a rule; described-only processes name missing data;
  - Beyond the familiar: the honesty note is shown and no novelty score exists;
  - Mission profiles: five available, eight unavailable with their missing conditions; editing a weight changes the
    configuration id and reset restores it;
  - the place view shows absolute temperatures; the research queue survives a reload; report editions download as
    Markdown in the current language with a reproducibility block; the multi-site report lists every queued place;
  - Data view: every dimension and the five challenge labels; every integrated source carries a label;
  - five languages: no raw key, no page error; phone width: no horizontal page scroll;
  - the baseline result (target, weights, #1 and its score) is identical before and after all of this.
"""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_ext_ui"
os.makedirs(OUT, exist_ok=True)
PORT = 8802
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
REF = json.load(open(os.path.join(ROOT, "tests", "fixtures", "ext_reference.json")))
errors, fails = [], []


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg, flush=True)
    if not ok:
        fails.append(msg)


def boot(pg):
    pg.goto(URL); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000)
    pg.evaluate("runSearch()"); pg.wait_for_function("S.searched", timeout=60000); time.sleep(0.4)


def hub(pg, h):
    pg.click(f"[data-xhub='{h}']"); time.sleep(0.8)


RAW = "(document.body.innerText.match(/\\b(ext|inv)\\.[a-z_]+\\.[a-z0-9_.]+/g) || [])"
BASE = "({tid: S.targetId, w: JSON.stringify(S.weights), top: S.res.distinct[0], s: S.res.eff[S.res.distinct[0]]})"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce", accept_downloads=True)
        pg = ctx.new_page(); pg.set_default_timeout(90000)
        pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        boot(pg)
        base0 = pg.evaluate(BASE)

        # --- Discover hub
        pg.evaluate("setTab('discover')"); time.sleep(0.6)
        btns = pg.evaluate("[...document.querySelectorAll('[data-xhub]')].map(b => b.dataset.xhub)")
        check(btns == ["constellations", "thermal", "processes", "beyond", "profiles", "learn"], f"Discover has the six-view hub ({btns})")
        check(pg.evaluate("document.querySelector('[data-xhub=constellations]').getAttribute('aria-pressed')") == "true" and pg.evaluate("!document.querySelector('[data-xtleaders]')"),
              "the original constellations view is the first view")

        # --- Temperature extremes
        hub(pg, "thermal")
        lim = pg.evaluate("Object.fromEntries([...document.querySelectorAll('[data-xtlim]')].map(e => [e.dataset.xtlim, e.className]))")
        check(lim.get("surface_temp_night") == "out" and lim.get("mean_air_temperature") == "out" and lim.get("surface_temp_day") == "",
              f"Jezero: night surface and mean air are outside Earth's range, day is inside ({lim})")
        cfg = pg.evaluate("document.querySelector('.xt-cfg code').textContent")
        check(cfg.startswith("cfg-") and len(cfg) == 20, f"configuration identifier shown ({cfg})")
        case = next(c for c in REF["cases"] if c["tid"] == "mars_jezero")
        par = pg.evaluate("w => { const f = xtField('mars_jezero', w); return {sites: Array.from(f.sites.slice(0, 5)), eff: Array.from(f.sites.slice(0, 5), i => f.eff[i])}; }", case["weights"])
        check(par["sites"] == case["sites"][:5] and all(abs(a - b) < 1e-6 for a, b in zip(par["eff"], case["eff_sites"][:5])),
              f"browser extended field equals the Python reference (top 5 cells {par['sites']})")
        for c in ["surface_temp_day", "surface_temp_night", "mean_air_temperature"]:
            pg.select_option(f"[data-xtw='{c}']", "0"); time.sleep(0.5)
        z = pg.evaluate("(() => { const base = simFor('mars_jezero', S.weights), bo = ENG.order(base.eff, S.cell), bs = ENG.distinctSites(bo, S.lat, S.lon, 10, S.app.thresholds.distinct_sep_km); return {ext: [...document.querySelectorAll('[data-xtsite]')].map(r => +r.dataset.xtsite), base: Array.from(bs, i => S.cell[i])}; })()")
        check(z["ext"] == z["base"], "with the three new weights at 0 the leaders are the baseline leaders")
        for c in ["surface_temp_day", "surface_temp_night", "mean_air_temperature"]:
            pg.select_option(f"[data-xtw='{c}']", "1"); time.sleep(0.4)
        check(pg.evaluate("document.querySelector('.xt-cfg code').textContent") == cfg, "restoring the weights restores the configuration identifier")
        pg.click("[data-xtx=sweep]"); time.sleep(2.5)
        sw = pg.evaluate("[...document.querySelectorAll('[data-xtsweep] tbody tr')].map(r => [r.className, r.cells[1].textContent])")
        check(len(sw) == 5 and sw[2][0] == "ref", f"coverage sweep: five thresholds, 80 % marked as the standard ({[s[1] for s in sw]})")
        with pg.expect_download() as d:
            pg.click("[data-xtx=export-th]")
        rec = json.load(open(d.value.path()))
        check(rec.get("configuration", {}).get("configuration") == "explore-ext-thermal-v1" or "explore-ext-thermal-v1" in json.dumps(rec), "extended-fingerprint export names its configuration")

        # --- Processes
        hub(pg, "processes")
        procs = pg.evaluate("[...document.querySelectorAll('[data-xproc]')].map(b => b.dataset.xproc)")
        check(len(procs) == 12, f"12 processes listed ({len(procs)})")
        pg.click("[data-xproc=thermal_cycling]"); time.sleep(1.5)
        cnt = pg.evaluate("(document.querySelector('[data-xproccount]') || {dataset: {}}).dataset.xproccount")
        check(cnt is not None and int(cnt) > 100 and pg.evaluate("!!document.querySelector('[data-xprule]')"), f"thermal cycling: rule applied to every cell, {cnt} cells match")
        pg.click("[data-xproc=aeolian]"); time.sleep(0.8)
        check(pg.evaluate("!!document.querySelector('[data-xprocnodata]') && !document.querySelector('[data-xproccount]')"), "aeolian processes: described only, missing data named, no fabricated count")

        # --- Beyond the familiar
        hub(pg, "beyond")
        check(pg.evaluate("!!document.querySelector('[data-xbfhonest]')") and pg.evaluate("!/novelty score\\s*[:=]|newly discovered/i.test(document.querySelector('[data-xbfhonest]').closest('.sec').innerText.replace(/No novelty score is shown/, ''))"),
              "beyond the familiar: honesty note shown, no novelty score")
        bf = pg.evaluate("+document.querySelector('[data-xbfcount]').dataset.xbfcount")
        check(bf > 0 and pg.evaluate("document.querySelectorAll('[data-xbf]').length") > 0, f"{bf} leading places outside the frequently cited list are shown")

        # --- Profiles
        hub(pg, "profiles")
        av = pg.evaluate("[...document.querySelectorAll('[data-xprof]')].map(b => b.dataset.xprof)")
        un = pg.evaluate("document.querySelectorAll('[data-xprofna]').length")
        check(len(av) == 5 and un == 8, f"five profiles available, eight unavailable with their missing conditions ({len(av)}, {un})")
        id0 = pg.evaluate("document.querySelector('.xt-cfg code').textContent")
        pg.select_option("[data-xtpw=slope]", "0"); time.sleep(0.8)
        id1 = pg.evaluate("document.querySelector('.xt-cfg code').textContent")
        pg.click("[data-xtx=prof-reset]"); time.sleep(0.8)
        id2 = pg.evaluate("document.querySelector('.xt-cfg code').textContent")
        check(id1 != id0 and id2 == id0, "editing a profile weight changes the configuration id; reset restores it")

        hub(pg, "learn")
        check(pg.evaluate("document.querySelectorAll('[data-xlearn] details, [data-xlearn] .xt-det, details.xt-det').length") >= 7, "Learn: seven modules")

        # --- place view: thermal block, research queue
        i = pg.evaluate("S.res.distinct[0]")
        pg.evaluate(f"jnOpen('place', {{i: {i}, tid: 'mars_jezero', pid: 'general', sec: 'lens', step: 0}})"); time.sleep(0.8)
        check(pg.evaluate("document.querySelectorAll('#jn [data-xtrow]').length") == 3, "the Lens shows the three absolute temperatures")
        pg.click("#jn [data-rq=add]"); time.sleep(0.4)
        i2 = pg.evaluate("S.res.distinct[3]")
        pg.evaluate(f"jnOpen('place', {{i: {i2}, tid: 'mars_jezero', pid: 'general', sec: 'reveal', step: 0}})"); time.sleep(0.5)
        pg.click("#jn [data-rq=add]"); time.sleep(0.4)
        st = pg.evaluate("JSON.parse(localStorage.getItem('asterro.research.v1'))")
        check(st and len(st["items"]) == 2 and all(it["status"] == "to_investigate" for it in st["items"]), "two places added to the research queue")

        # --- report editions (passport)
        pg.evaluate(f"jnOpen('place', {{i: {i}, tid: 'mars_jezero', pid: 'general', sec: 'passport', step: 0}})"); time.sleep(0.8)
        kinds = pg.evaluate("[...document.querySelectorAll('#jn [data-xrep]')].map(b => b.dataset.xrep)")
        check(kinds == ["concise", "detailed", "comparative", "profiles"], f"four single-place report editions ({kinds})")
        for k in kinds:
            with pg.expect_download() as d:
                pg.click(f"#jn [data-xrep='{k}']")
            md = open(d.value.path(), encoding="utf-8").read()
            check(md.startswith("# ") and "```json" in md and "tai-sim-1.0.0" in md and "NASA" in md and "probability" in md,
                  f"{k} report: Markdown with references, reproducibility block and the not-a-probability statement ({len(md)} chars)")
        pg.evaluate("setLang('fr')"); time.sleep(0.6)
        md_fr = pg.evaluate("xtReport('concise')")
        check("Rapport concis" in md_fr and "Résumé" in md_fr, "reports follow the interface language (French)")
        pg.evaluate("setLang('en')"); time.sleep(0.4)
        multi = pg.evaluate("xtReportMulti()")
        mrec = json.loads(multi.split("```json")[1].split("```")[0])
        check(len(mrec["places"]) == 2 and {x["cell"] for x in mrec["places"]} == set(pg.evaluate(f"[S.cell[{i}], S.cell[{i2}]]")) and multi.count("\n| ") >= 4,
              "the multi-site report has one row per queued place and a reproducibility record")

        # --- persistence across a reload
        pg.evaluate("jnClose()")
        pg.reload(); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000)
        pg.evaluate("runSearch()"); pg.wait_for_function("S.searched", timeout=60000); time.sleep(0.4)
        pg.evaluate("jnOpen('queue')"); time.sleep(0.6)
        check(pg.evaluate("document.querySelectorAll('#jn .rq-item').length") == 2, "the research queue survives a reload")
        pg.select_option("#jn .rq-item select", "under_review"); time.sleep(0.4)
        st = pg.evaluate("JSON.parse(localStorage.getItem('asterro.research.v1'))")
        check(any(it["status"] == "under_review" and any(h["event"] == "status" for h in it["history"]) for it in st["items"]), "a status change is stored with its history")
        check(pg.evaluate("!/confirm/i.test([...document.querySelectorAll('#jn .rq-item select option')].map(o => o.value + o.textContent).join(' '))"), "no research status claims confirmation")
        pg.evaluate("jnClose()")

        # --- Data view
        pg.evaluate("setTab('data')"); time.sleep(0.8)
        nd = pg.evaluate("document.querySelectorAll('[data-xdim]').length")
        labs = pg.evaluate("[...document.querySelectorAll('[data-xlab]')].map(e => [e.dataset.xlab, e.dataset.xlabk])")
        lk = dict(labs)
        check(nd == 28, f"Data view: all {nd} dimensions with their status")
        check(lk.get("nasa_power") == "pending" and lk.get("modis_aqua_lst") == "pending" and lk.get("mola") == "verified" and lk.get("hirise") == "future",
              f"challenge labels follow the inventory rule ({len(labs)} sources)")
        check(set(lk.values()) <= {"verified", "pending", "future", "unsuitable", "unavailable"}, "only the challenge's five labels are used")

        # --- five languages
        for L in ["bn", "es", "fr", "de", "en"]:
            pg.evaluate(f"setLang('{L}')"); time.sleep(0.6)
            raw = []
            for t in ["data", "discover"]:
                pg.evaluate(f"setTab('{t}')"); time.sleep(0.4)
                if t == "discover":
                    for h in ["thermal", "processes", "beyond", "profiles", "learn"]:
                        hub(pg, h); raw += pg.evaluate(RAW)
                else:
                    raw += pg.evaluate(RAW)
            pg.evaluate("jnOpen('queue')"); time.sleep(0.4); raw += pg.evaluate(RAW); pg.evaluate("jnClose()")
            check(not raw, f"{L}: no raw catalogue key in the extension views ({raw[:3]})")
        check(pg.evaluate("I18N.clash.length") == 0, "no extension key overwrote an original one")

        # --- phone width
        ph = b.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce", is_mobile=True, has_touch=True)
        pp = ph.new_page(); pp.set_default_timeout(90000); pp.on("pageerror", lambda e: errors.append("phone pageerror: " + str(e)))
        boot(pp); pp.evaluate("setTab('discover')"); time.sleep(0.5)
        over = []
        for h in ["thermal", "processes", "beyond", "profiles", "learn"]:
            hub(pp, h)
            if pp.evaluate("document.documentElement.scrollWidth > innerWidth + 1"): over.append(h)
        pp.evaluate("setTab('data')"); time.sleep(0.6)
        if pp.evaluate("document.documentElement.scrollWidth > innerWidth + 1"): over.append("data")
        pp.screenshot(path=os.path.join(OUT, "phone_data.png"))
        check(not over, f"phone width: no horizontal page scroll ({over})")
        ph.close()

        base1 = pg.evaluate("setTab('explore'), " + BASE)
        check(base1 == base0, "baseline target, weights, #1 and its score unchanged by the extension")
        check(not errors, f"no page errors ({errors[:3]})")
finally:
    srv.kill()
print(f"\n{'ALL PASS' if not fails else str(len(fails)) + ' FAIL'}")
sys.exit(1 if fails else 0)
