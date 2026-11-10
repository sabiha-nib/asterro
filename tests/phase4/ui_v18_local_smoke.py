"""V18 Local Impact in the browser (Playwright/Chromium).

    python tests/phase4/ui_v18_local_smoke.py [outdir]

Location permission granted, denied, unavailable, timed out, unsupported and inaccurate; manual search by name and by
coordinates, invalid and off-grid input; privacy (no position request before the button, no network request carrying
the position, nothing stored without consent, saved profiles hold no coordinates and can be deleted); analysis radii;
missing data and incomplete coverage; planetary comparison against the unchanged engine; nearby geography and
discoveries inside the radius; the report at each coordinate precision; keyboard use; phone and tablet layouts; five
languages; the prohibited-element audit; the baseline left unchanged.
"""
import os, re, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_v18_smoke"
os.makedirs(OUT, exist_ok=True)
PORT = 8808
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
errors, fails = [], []
AUDIT = re.search(r'AUDIT = r"""(.*?)"""', open(os.path.join(ROOT, "tests/phase4/ui_design_audit.py")).read(), re.S).group(1)
ATACAMA = {"latitude": -23.65432, "longitude": -68.15678, "accuracy": 1200}
COUNT_GEO = """(() => { window.__geo = { get: 0, watch: 0 }; const g = navigator.geolocation; if (!g) return;
  const o = g.getCurrentPosition.bind(g), w = g.watchPosition.bind(g);
  g.getCurrentPosition = function () { window.__geo.get++; return o.apply(null, arguments); };
  g.watchPosition = function () { window.__geo.watch++; return w.apply(null, arguments); }; })();"""
FAIL_GEO = """(() => { window.__geo = { get: 0, watch: 0 }; const g = navigator.geolocation;
  g.getCurrentPosition = function (ok, err) { window.__geo.get++; setTimeout(() => err({ code: %d, message: "simulated" }), 50); }; })();"""
NO_GEO = "Object.defineProperty(Navigator.prototype, 'geolocation', { get: () => undefined, configurable: true });"


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def boot(pg):
    pg.goto(URL); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000)
    pg.evaluate("try { localStorage.removeItem('asterro.local.v1') } catch (e) {}")
    pg.evaluate("runSearch()"); pg.wait_for_function("S.searched", timeout=60000); time.sleep(0.4)
    pg.evaluate("document.querySelectorAll('.jl-toast').forEach(t => t.remove())")
    pg.evaluate("document.querySelector('#tab-local').scrollIntoView()"); pg.click("#tab-local"); time.sleep(0.8)


def status(pg):
    return pg.evaluate("(document.querySelector('[data-listatus]') || {dataset: {}}).dataset.listatus || null")


def search(pg, q):
    pg.fill("#li-q", q); pg.press("#li-q", "Enter"); time.sleep(0.8)


try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        # ------------------------------------------------ permission granted
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, geolocation=ATACAMA, permissions=["geolocation"], accept_downloads=True)
        ctx.add_init_script(COUNT_GEO)
        pg = ctx.new_page(); pg.set_default_timeout(120000); pg.on("pageerror", lambda e: errors.append(str(e)))
        reqs = []; pg.on("request", lambda r: reqs.append((r.url, r.post_data or "")))
        boot(pg)
        base = pg.evaluate("({top: S.res.distinct[0], s: S.res.eff[S.res.distinct[0]], w: JSON.stringify(S.weights), tid: S.targetId})")
        tab = pg.evaluate("[...document.querySelectorAll('.tabs [role=tab]')].filter(b => b.getBoundingClientRect().width > 0).map(b => b.id)")
        check("tab-local" in tab and "tab-atlas" in tab and "tab-explore" in tab and "tab-lab" in tab, "Local Impact is a tab beside the existing ones")
        check(pg.evaluate("window.__geo.get + window.__geo.watch") == 0, "no position is requested before the person asks")
        check(pg.evaluate("!!document.querySelector('[data-lipriv]')") and "nowhere" in pg.evaluate("document.querySelector('[data-lipriv]').textContent"), "the privacy statement is shown before any position is used")
        check("characterised" in pg.evaluate("document.querySelector('#left').innerText"), "before a location is analysed, the page says nothing has been characterised")
        n_before = len(reqs); href = pg.evaluate("location.href")
        pg.focus("#li-geo"); pg.keyboard.press("Enter"); pg.wait_for_function("LI.i != null"); time.sleep(0.8)
        g = pg.evaluate("({ st: LI.status, cell: S.cell[LI.i], off: LI.offKm, acc: LI.loc.acc, focus: document.activeElement.id, h: document.querySelector('#li-result-h').textContent, meta: document.querySelector('[data-lisum] .meta').textContent })")
        check(g["st"] == "ok" and g["cell"] == 76787 and g["off"] < 40, f"permission granted: the Atacama cell is analysed ({g['cell']}, {g['off']:.0f} km from its centre)")
        check("1.2 km" in g["meta"] and "position from this device" in g["meta"], f"the accuracy radius and source are shown ({g['meta']})")
        check(g["focus"] == "li-result-h", "keyboard: focus moves to the result")
        check(pg.evaluate("window.__geo.watch") == 0 and pg.evaluate("window.__geo.get") == 1, "one position request, no background tracking")
        new = reqs[n_before:]
        check(not [u for u, d in new if "23.65" in u + d or "68.15" in u + d or "23.6" in u + d], "no network request carries the position")
        check(not [u for u, d in new if not u.startswith(f"http://localhost:{PORT}") and "fonts.g" not in u], f"no external request is made for the analysis ({[u for u, d in new][:3]})")
        check(pg.evaluate("location.href") == href and "23.6" not in pg.evaluate("location.href"), "the position is not put in the page address")
        check(pg.evaluate("localStorage.getItem('asterro.local.v1')") is None, "nothing is stored without consent")
        prof = pg.evaluate("""[...document.querySelectorAll('[data-liprof] tr[data-livar]')].map(r => [r.dataset.livar, r.querySelector('td.n').textContent.trim()])""")
        d = dict(prof)
        check(len(prof) >= 20 and d["elevation"].startswith(f"{pg.evaluate('Math.round(S.A.elevation[LI.i])'):,}"), f"local profile with {len(prof)} variables; values from the stack")
        check(pg.evaluate("document.querySelectorAll('[data-liunavail] li').length") == 9 and "Endpoint unavailable" in pg.evaluate("document.querySelector('[data-liunavail]').textContent"), "nine unavailable variables shown with their registry state, not as zero")
        pg.evaluate("dsSetMode('advanced')"); time.sleep(0.4)
        rm = pg.evaluate("""(() => { const r = document.querySelector('[data-livar=elevation]'); const t = [...r.querySelectorAll('td')].map(x => x.textContent); return { vis: getComputedStyle(r.querySelectorAll('td')[2]).display, t }; })()""")
        check(rm["vis"] != "none" and "USGS" in rm["t"][2] and "%" in rm["t"][4], f"Research mode shows dataset, provider, resolution, period and completeness ({rm['t'][2][:40]})")
        pg.evaluate("dsSetMode('simple')"); time.sleep(0.3)
        # radii
        ns = []
        for r in [50, 100, 250, 500]:
            pg.focus(f"[data-liradius='{r}']"); pg.keyboard.press("Enter"); time.sleep(0.5)
            ns.append(pg.evaluate("+document.querySelector('[data-linear-scale]').textContent.match(/\\d+/)[0]"))
            rd = pg.evaluate(f"[...document.querySelectorAll('[data-liregions] li')].map(li => +li.textContent.match(/(\\d[\\d,]*) km/)[1].replace(',', ''))")
            if not all(x <= r for x in rd):
                check(False, f"named regions within {r} km ({rd})")
        check(ns == sorted(ns) and ns[0] >= 1 and ns[-1] > ns[1], f"the number of cells grows with the radius ({ns})")
        check(pg.evaluate("LI.radius") == 500 and pg.evaluate("document.activeElement.dataset.liradius") == "500", "radius buttons work from the keyboard and keep focus")
        best = pg.evaluate("(() => { const A = liAnalysis(); return A.best ? AsterroLocal.km(S.lat[A.i], S.lon[A.i], S.lat[A.best.i], S.lon[A.best.i]) : -1; })()")
        check(0 <= best <= 500, f"closest analogue lies within the radius ({best:.0f} km)")
        dd = pg.evaluate("""[...document.querySelectorAll('[data-lidisc]')].map(a => [a.dataset.lidisc, a.innerText.includes('Measured:'), a.innerText.includes('Hypothesis to test:')])""")
        check(dd and all(x[1] and x[2] for x in dd), f"local discoveries show measured evidence and a separate hypothesis ({[x[0] for x in dd]})")
        ins = pg.evaluate("(() => { const A = liAnalysis(), s = new Set(A.cells.map(c => c.i)); return A.disc.found.every(d => d.cells.every(c => s.has(c.i))); })()")
        check(ins, "every discovery cites cells inside the radius")
        # comparison
        cmp = pg.evaluate("""(() => { const out = [...document.querySelectorAll('[data-licmp] tr[data-licrit]')].map(r => [r.dataset.licrit, r.dataset.lik]);
            const D = ENG.detail(S.A, S.critIds, LI.i, jnCtx(LI.tid).tv, S.weights, jnCtx(LI.tid).ranges), th = S.app.thresholds;
            const ref = D.rows.map(r => [r.c, r.s == null || r.s !== r.s ? 'na' : r.s >= th.match ? 'similar' : r.s >= th.partial ? 'partial' : 'different']); return { out, ref }; })()""")
        check(cmp["out"] == cmp["ref"] and len(cmp["out"]) == 6, "comparison readings equal the unchanged engine's, each dimension separately")
        pg.select_option("[data-litid]", "moon_south_pole"); time.sleep(1.0)
        mm = pg.evaluate("({ tid: LI.tid, miss: document.querySelector('[data-licmp-lists]').innerText, rows: [...document.querySelectorAll('[data-licmp] tr[data-lik=na]')].map(r => r.dataset.licrit) })")
        check(mm["tid"] == "moon_south_pole" and "annual_temperature_range" in mm["rows"], f"switching to the Lunar South Pole shows the target's missing dimension ({mm['rows']})")
        check("not a probability" in pg.evaluate("document.querySelector('[data-lisec=compare]').innerText"), "similarity is never shown as a probability")
        pg.select_option("[data-litid]", "mars_jezero"); time.sleep(0.8)
        pg.evaluate("document.querySelector('#left').scrollTop = 0"); pg.screenshot(path=os.path.join(OUT, "local_desktop.png"))
        v = sorted(set(pg.evaluate(AUDIT, "#left")))
        check(not v, f"Local Impact: no prohibited design element ({'; '.join(v[:4])})")
        # report at each precision
        for prec, want, nowant in [("cell", f"{-23.5:.1f}", "-23.6543"), ("exact", "-23.6543", None), ("1deg", "-24, -68", "-23.6543"), ("none", "no coordinates", "-23.6543")]:
            pg.select_option("[data-liprec]", prec); time.sleep(0.4)
            with pg.expect_download() as dl:
                pg.click("[data-lido=report]")
            md = open(dl.value.path(), encoding="utf-8").read()
            ok = want in md and (nowant is None or nowant not in md) and len(re.findall(r"^## \d+\. ", md, re.M)) == 14
            check(ok, f"report with coordinate precision '{prec}' ({dl.value.suggested_filename})")
        check("tai-v18-local-1.0.0" in md and '"radius_km": 500' in md and "Not available in ASTERRO" in md, "the report records calculation version, radius and data gaps")
        # saved profiles
        check(pg.evaluate("document.querySelector('[data-lido=save]').disabled"), "saving is disabled until consent is given")
        pg.check("[data-liconsent]"); time.sleep(0.3); pg.click("[data-lido=save]"); time.sleep(0.3)
        sv = pg.evaluate("JSON.parse(localStorage.getItem('asterro.local.v1'))")
        check(len(sv) == 1 and set(sv[0]) == {"name", "cell", "radius", "target", "saved"} and "-23.65" not in str(sv), f"a saved profile holds the cell and name only ({sv[0]})")
        pg.click("[data-lidel='0']"); time.sleep(0.3)
        check(pg.evaluate("localStorage.getItem('asterro.local.v1')") is None, "a saved profile can be deleted")
        pg.click("[data-lido=save]"); pg.click("[data-lido=save]"); time.sleep(0.3); pg.click("[data-lido=delall]"); time.sleep(0.3)
        check(pg.evaluate("localStorage.getItem('asterro.local.v1')") is None, "all saved profiles can be deleted at once")
        # manual search, keyboard
        pg.evaluate("document.querySelector('#left').scrollTop = 0")
        pg.focus("#li-q"); pg.keyboard.type("Atacama"); pg.keyboard.press("Enter"); time.sleep(0.8)
        check(status(pg) == "results" and pg.evaluate("document.querySelectorAll('[data-lipick]').length") >= 1, "manual search by name lists matching places")
        pg.focus("[data-lipick='0']"); pg.keyboard.press("Enter"); time.sleep(0.8)
        check(pg.evaluate("LI.loc.source") == "search" and pg.evaluate("S.A.region[LI.i] >= 0 && S.labels.region[S.A.region[LI.i]].toLowerCase().includes('atacama')"), "choosing a result with the keyboard analyses a cell of that region")
        search(pg, "64.1 N, 21.9 W")
        check(pg.evaluate("LI.loc.source") == "coordinates" and pg.evaluate("S.labels.country[S.A.country[LI.i]]") == "Iceland", "coordinates typed by hand analyse that place (Iceland)")
        search(pg, "95, 10"); check(status(pg) == "badcoords", "invalid coordinates are refused")
        search(pg, "0, -30"); check(status(pg) == "offgrid" and pg.evaluate("LI.i") is None, "a point in the ocean is reported as off the land grid, not analysed")
        search(pg, "qqqxyz"); check(status(pg) == "noresults", "an unknown name says so")
        # missing data and incomplete coverage (Antarctica, Moon target)
        search(pg, "84.5 S, 172.5 E")
        pg.select_option("[data-litid]", "moon_south_pole"); time.sleep(1.0)
        an = pg.evaluate("({ ar: document.querySelector('[data-livar=aridity_class] td.n').textContent.trim(), miss: [...document.querySelectorAll('[data-licmp] tr[data-lik=na]')].map(r => r.dataset.licrit), cov: liAnalysis().cov })")
        check(an["ar"] == "not available" and set(["aridity", "annual_temperature_range"]) <= set(an["miss"]) and an["cov"] < 1, f"missing data stay missing and incomplete coverage is stated ({an})")
        after = pg.evaluate("({top: S.res.distinct[0], s: S.res.eff[S.res.distinct[0]], w: JSON.stringify(S.weights), tid: S.targetId})")
        check(after == base, "the baseline result is unchanged")
        ctx.close()
        # ------------------------------------------------ inaccurate position
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, geolocation={"latitude": -23.65, "longitude": -68.15, "accuracy": 60000}, permissions=["geolocation"])
        pg = ctx.new_page(); pg.set_default_timeout(120000); pg.on("pageerror", lambda e: errors.append(str(e)))
        boot(pg); pg.click("#li-geo"); pg.wait_for_function("LI.status && LI.status !== 'asking'"); time.sleep(0.6)
        check(status(pg) == "inaccurate" and "60 km" in pg.evaluate("document.querySelector('[data-listatus]').textContent") and pg.evaluate("LI.i") is not None, "an inaccurate position is analysed with a warning and its accuracy")
        ctx.close()
        # ------------------------------------------------ denied, unavailable, timeout, unsupported
        for name, init, want in [("denied", None, "denied"), ("unavailable", FAIL_GEO % 2, "unavailable"), ("timeout", FAIL_GEO % 3, "timeout"), ("unsupported", NO_GEO, "unsupported")]:
            ctx = b.new_context(viewport={"width": 1440, "height": 900})
            if init: ctx.add_init_script(init)
            pg = ctx.new_page(); pg.set_default_timeout(120000); pg.on("pageerror", lambda e: errors.append(str(e)))
            boot(pg); pg.click("#li-geo")
            try:
                pg.wait_for_function("LI.status && LI.status !== 'asking'", timeout=20000)
            except Exception:
                pass
            time.sleep(0.4)
            st = status(pg); txt = pg.evaluate("(document.querySelector('[data-listatus]') || {}).textContent || ''")
            retry = pg.evaluate("!!document.querySelector('[data-listatus] [data-lido=geo]')")
            check(st == want and pg.evaluate("LI.i") is None and "type a place" in txt and (retry or want == "unsupported"), f"position {name}: explained, retry offered, manual entry suggested, nothing analysed")
            check(pg.evaluate("localStorage.getItem('asterro.local.v1')") is None, f"position {name}: nothing stored")
            if name == "denied":
                search(pg, "Iceland"); pg.click("[data-lipick='0']"); time.sleep(0.8)
                check(pg.evaluate("LI.i") is not None, "after a refusal, manual entry still works")
            ctx.close()
        # ------------------------------------------------ phone and tablet, languages
        for W, H, tag in [(390, 844, "phone"), (768, 1024, "tablet portrait"), (1024, 768, "tablet landscape")]:
            ctx = b.new_context(viewport={"width": W, "height": H}, is_mobile=W < 800, has_touch=True, geolocation=ATACAMA, permissions=["geolocation"])
            pg = ctx.new_page(); pg.set_default_timeout(120000); pg.on("pageerror", lambda e, t=tag: errors.append(t + ": " + str(e)))
            boot(pg); pg.tap("#li-geo"); pg.wait_for_function("LI.i != null"); time.sleep(0.8)
            check(not pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1"), f"{tag}: no horizontal page scroll")
            pg.screenshot(path=os.path.join(OUT, f"local_{tag.replace(' ', '_')}.png"))
            if tag == "phone":
                for L in ["bn", "es", "fr", "de"]:
                    pg.evaluate(f"setLang('{L}')"); time.sleep(0.6); pg.evaluate("renderLeft()"); time.sleep(0.4)
                    t = pg.evaluate("document.querySelector('#left').innerText"); raw = re.findall(r"\bv1[78]\.[a-z_.]+", t)
                    check(not raw and pg.evaluate("document.querySelector('#tab-local').textContent") != "Local Impact", f"{L}: Local Impact translated, no raw keys ({raw[:3]})")
                pg.evaluate("setLang('en')")
            ctx.close()
        check(not errors, f"no page errors ({errors[:3]})")
finally:
    srv.kill()
print(f"\n{'ALL PASS' if not fails else str(len(fails)) + ' FAIL'}")
sys.exit(1 if fails else 0)
