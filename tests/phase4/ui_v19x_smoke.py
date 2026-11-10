"""V19 data extension in the browser (Playwright/Chromium), including a real offline run.

    python tests/phase4/ui_v19x_smoke.py [outdir]

Online: the environmental cube loads, passes its integrity check (size, SHA-256, cell order) and is stored in
IndexedDB; Data shows the store and the inventory (NASA / non-NASA, nine states, every field, filters); Discover ›
Science domains and Local Impact show the data layers at the cell with provenance, lower bounds and what each domain
cannot say; values equal the cube decoded independently in Python; an analysis is saved offline; the six-dimensional
result is unchanged. Offline (network disabled, page reloaded): the app shell comes from the service worker, the layers
come from the IndexedDB copy and are labelled as an offline copy, never as live; the Local Impact analysis states the
datasets used and the domains without data; a refresh keeps the valid copy. A corrupted stored copy is refused.
"""
import json, os, re, subprocess, sys, time
import numpy as np
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_v19x_smoke"
os.makedirs(OUT, exist_ok=True)
PORT = 8823
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
errors, fails = [], []
AUDIT = re.search(r'AUDIT = r"""(.*?)"""', open(os.path.join(ROOT, "tests/phase4/ui_design_audit.py")).read(), re.S).group(1)
ATACAMA = {"latitude": -23.65432, "longitude": -68.15678, "accuracy": 1200}
MAN = json.load(open(os.path.join(ROOT, "public/data/v19/env/cube.json")))
CUBE = np.frombuffer(open(os.path.join(ROOT, "public/data/v19/env/cube.bin"), "rb").read(), "<i2")


def py_value(vid, i):
    v = next(x for x in MAN["variables"] if x["id"] == vid); q = CUBE[v["offset"] // 2 + i]
    return None if q == MAN["nodata"] else float(q) * v["scale"]


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def boot(pg):
    pg.goto(URL); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000)
    pg.evaluate("runSearch()"); pg.wait_for_function("S.searched", timeout=60000); time.sleep(0.4)
    pg.evaluate("document.querySelectorAll('.jl-toast').forEach(t => t.remove())")


try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, geolocation=ATACAMA, permissions=["geolocation"])
        pg = ctx.new_page(); pg.set_default_timeout(120000); pg.on("pageerror", lambda e: errors.append(str(e)))
        boot(pg)
        base = pg.evaluate("({top: S.res.distinct[0], s: S.res.eff[S.res.distinct[0]], w: JSON.stringify(S.weights), tid: S.targetId, n: S.res.nElig})")
        # ---------------------------------------------------------------- load, verify, store
        pg.evaluate("v9xLoad()"); pg.wait_for_function("V9X.C || V9X.err", timeout=60000)
        st = pg.evaluate("({ok: !!V9X.C, err: V9X.err, src: V9X.src, sha: V9X.man && V9X.man.sha256, n: V9X.C && V9X.C.n, inv: V9X.inv && V9X.inv.n})")
        check(st["ok"] and st["src"] == "server" and st["sha"] == MAN["sha256"] and st["n"] == len(CUBE) // len(MAN["variables"]), f"the cube loads from the server and passes its integrity check ({st['err']})")
        stored = pg.evaluate("v9xGet('cube').then(r => r && {sha: r.sha256, bytes: r.buffer.byteLength})")
        check(stored and stored["sha"] == MAN["sha256"] and stored["bytes"] == MAN["bytes"], "a verified copy is kept in IndexedDB with its hash")
        # ---------------------------------------------------------------- Data tab
        pg.evaluate("setTab('data')"); time.sleep(1.2)
        d = pg.evaluate("""(() => { const s = document.querySelector('[data-v9xinv]'), I = V9X.inv;
            return { rows: s.querySelectorAll('[data-v9xrow]').length, n: I.n, nasa: [...s.querySelectorAll('[data-v9xrow][data-v9xnasa="1"]')].length, kn: I.nasa,
                     cnt: [...s.querySelectorAll('[data-v9xcnt]')].map(l => [l.dataset.v9xcnt, +l.innerText.split('· ')[1].replace(/,/g, '')]), want: I.counts,
                     power: !!s.querySelector('[data-v9xrow=power_ws10m][data-v9xnasa="1"][data-v9xstate=CACHED]'), gvp: !!s.querySelector('[data-v9xrow=gvp_holocene_full][data-v9xnasa="0"]'),
                     store: document.querySelector('[data-v9xstore]').innerText, v19: !!document.querySelector('[data-v9registry]') }; })()""")
        check(d["rows"] == d["n"] and d["nasa"] == d["kn"], f"Data: every dataset is listed ({d['rows']}) with its NASA / non-NASA attribution ({d['nasa']} NASA)")
        check(all(d["want"][k] == v for k, v in d["cnt"]) and len(d["cnt"]) >= 4, "Data: state counts equal the inventory")
        check(d["power"] and d["gvp"], "Data: NASA POWER is marked NASA and cached; the Smithsonian volcano list is marked non-NASA")
        check("integrity verified" in d["store"] and "not live" in d["store"].lower() or "never shown as live" in d["store"], "Data: the store states its verified copy and that stored data are never shown as live")
        check(d["v19"], "Data: the earlier V19 registry is still shown")
        pg.evaluate("document.querySelector('[data-v9xrow=power_ws10m]').open = true"); time.sleep(0.3)
        f = pg.evaluate("[...document.querySelectorAll('[data-v9xrow=power_ws10m] dt')].map(x => x.textContent)")
        need = ["Agency", "Provider", "Product and version", "Official source", "Variables", "Units", "Spatial resolution", "Temporal resolution", "Coverage", "Observation period", "Retrieved", "Processing", "Validation", "Limitations"]
        check(all(k in f for k in need), f"Data: a dataset shows every required field ({[k for k in need if k not in f]})")
        pg.select_option("[data-v9xf=nasa]", "other"); time.sleep(0.6)
        o = pg.evaluate("({n: document.querySelectorAll('[data-v9xrow]').length, nasa: document.querySelectorAll('[data-v9xrow][data-v9xnasa=\"1\"]').length, focus: document.activeElement.dataset.v9xf})")
        check(o["n"] > 0 and o["nasa"] == 0 and o["focus"] == "nasa", f"Data: the agency filter shows only non-NASA datasets and keeps focus ({o['n']})")
        pg.select_option("[data-v9xf=nasa]", "all"); time.sleep(0.4)
        pg.screenshot(path=os.path.join(OUT, "v19x_data.png"))
        # ---------------------------------------------------------------- Discover › Science domains
        pg.evaluate("v7Open('domains', S.res.distinct[0])"); time.sleep(1.2)
        lay = pg.evaluate("""(() => { const s = document.querySelector('[data-v9xlayers]'); const i = S.res.distinct[0];
            return { doms: [...s.querySelectorAll('[data-v9xdom]')].map(x => x.dataset.v9xdom), notsaid: s.querySelectorAll('[data-v9xnotsaid]').length, i,
                     ws: (s.querySelector('[data-v9xvar=wind_ws10m] td.n') || {}).textContent, src: (s.querySelector('[data-v9xsrc]') || {dataset: {}}).dataset.v9xsrc,
                     v17: !!document.querySelector('[data-v19]') }; })()""")
        check(len(lay["doms"]) == 7 and lay["notsaid"] == 7 and lay["v17"], f"Science domains: seven data-layer domains, each stating what it cannot say; the V19 section is still there ({lay['doms']})")
        wsv = py_value("wind_ws10m", lay["i"])
        check(wsv is not None and lay["ws"] and f"{wsv:.2f}" in lay["ws"].replace(",", ""), f"the 10 m wind speed shown equals the cube decoded in Python ({lay['ws']} vs {wsv})")
        check(lay["src"] == "server", "the layers say where the copy came from")
        v = sorted(set(pg.evaluate(AUDIT, "#left")))
        check(not v, f"data layers: no prohibited design element ({'; '.join(v[:4])})")
        # ---------------------------------------------------------------- Local Impact
        pg.evaluate("document.querySelector('#tab-local').scrollIntoView()"); pg.click("#tab-local"); time.sleep(0.6)
        pg.click("#li-geo"); pg.wait_for_function("LI.i != null"); time.sleep(1.5)
        li = pg.evaluate("""(() => { const secs = [...document.querySelectorAll('[data-lisec]')].map(s => s.dataset.lisec), s = document.querySelector('[data-lisec=v19x]');
            return { secs, volc: (s.querySelector('[data-v9xvolc]') || {}).textContent || '', n: s.querySelector('[data-v9xvar=volc_holo_100km] td.n').textContent.trim(),
                     lb: s.querySelectorAll('[data-v9xlb]').length, lc: s.querySelector('[data-v9xvar=lc_dominant] td.n').textContent, used: s.querySelector('[data-v9xused]').textContent }; })()""")
        check(li["secs"][-3:] == ["v19", "v19x", "report"], f"Local Impact: the data layers sit before the report ({li['secs'][-4:]})")
        check(li["n"] == "15" and "Tujle" in li["volc"], f"Local Impact (Atacama): 15 Holocene volcanoes within 100 km, nearest Cerro Tujle, from the full catalogue ({li['volc'][:70]})")
        check("Barren" in li["lc"], f"Local Impact (Atacama): dominant land cover Barren ({li['lc']})")
        check("datasets" in li["used"], "Local Impact: the analysis states how many datasets it used and which domains had no data")
        pg.wait_for_function("V9X.analyses.length > 0", timeout=10000)
        check(pg.evaluate("v9xAll('analyses').then(a => a.length)") >= 1, "the Local Impact analysis is saved offline in IndexedDB")
        check(pg.evaluate("localStorage.getItem('asterro.local.v1')") is None, "Local Impact privacy unchanged: no position stored without consent")
        after = pg.evaluate("({top: S.res.distinct[0], s: S.res.eff[S.res.distinct[0]], w: JSON.stringify(S.weights), tid: S.targetId, n: S.res.nElig})")
        check(after == base, "the six-dimensional baseline result is unchanged")
        pg.screenshot(path=os.path.join(OUT, "v19x_local.png"))
        # ---------------------------------------------------------------- offline
        pg.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller", timeout=60000)
        time.sleep(3)
        ctx.set_offline(True)
        pg.reload(); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000)
        pg.evaluate("runSearch()"); pg.wait_for_function("S.searched", timeout=60000)
        pg.evaluate("V9X.online = navigator.onLine"); pg.evaluate("v9xLoad()"); pg.wait_for_function("V9X.C || V9X.err", timeout=60000)
        off = pg.evaluate("({online: navigator.onLine, src: V9X.src, ok: !!V9X.C, err: V9X.err})")
        check(not off["online"] and off["ok"] and off["src"] == "offline_store", f"offline: the layers come from the verified IndexedDB copy ({off})")
        pg.evaluate("setTab('data')"); time.sleep(1.0)
        txt = pg.evaluate("document.querySelector('[data-v9xstore]').innerText")
        check("offline" in txt.lower() and "offline store" in txt.lower(), "offline: the Data tab says the browser is offline and the copy comes from the offline store")
        pg.click("[data-v9xdo=refresh]"); pg.wait_for_selector("[data-v9xmsg]", timeout=30000)
        m = pg.evaluate("({k: document.querySelector('[data-v9xmsg]').dataset.v9xmsg, ok: !!V9X.C})")
        check(m["k"] in ("offline", "failed") and m["ok"], f"offline: a refresh keeps the valid stored copy ({m['k']})")
        pg.evaluate("v7Open('domains', S.res.distinct[0])"); time.sleep(1.0)
        s2 = pg.evaluate("(document.querySelector('[data-v9xsrc]') || {dataset: {}}).dataset.v9xsrc + '|' + (document.querySelector('[data-v9xsrc]') || {}).textContent")
        check(s2.startswith("offline_store|") and "Not live data" in s2, f"offline: Science domains label the values as an offline copy, not live ({s2[:90]})")
        pg.screenshot(path=os.path.join(OUT, "v19x_offline.png"))
        # corrupted store is refused
        pg.evaluate("""v9xGet('cube').then(r => { const b = new Uint8Array(r.buffer.slice(0)); b[100] ^= 255; r.buffer = b.buffer; return v9xPut(r); })""")
        pg.evaluate("V9X.C = null; V9X.man = null; V9X.err = null"); pg.evaluate("v9xLoad()"); pg.wait_for_function("V9X.C || V9X.err", timeout=60000)
        cor = pg.evaluate("({ok: !!V9X.C, err: V9X.err})")
        check(not cor["ok"] and cor["err"] == "store_hash", f"a corrupted stored copy is refused, not used ({cor})")
        ctx.set_offline(False)
        # ---------------------------------------------------------------- languages
        pg.reload(); boot(pg); pg.evaluate("v9xLoad()"); pg.wait_for_function("V9X.C || V9X.err", timeout=60000); pg.evaluate("v7Open('domains', S.res.distinct[0])"); time.sleep(1.0)
        for L in ["bn", "es", "fr", "de"]:
            pg.evaluate(f"setLang('{L}')"); time.sleep(0.5); pg.evaluate("renderLeft()"); time.sleep(0.4)
            t = pg.evaluate("document.querySelector('[data-v9xlayers]').innerText"); raw = re.findall(r"\bv19x\.[a-z_.]+", t)
            check(not raw and "Environmental data layers" not in t, f"{L}: data layers translated, no raw keys ({raw[:3]})")
        pg.evaluate("setLang('en')")
        ctx.close()
        # ---------------------------------------------------------------- phone
        ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); pg.set_default_timeout(120000); pg.on("pageerror", lambda e: errors.append("phone: " + str(e)))
        boot(pg); pg.evaluate("v9xLoad()"); pg.wait_for_function("V9X.C || V9X.err", timeout=60000); pg.evaluate("setTab('data')"); time.sleep(1.0)
        check(not pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1"), "phone: no horizontal page scroll in Data with the inventory")
        pg.evaluate("v7Open('domains', S.res.distinct[0])"); time.sleep(1.0)
        check(not pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1"), "phone: no horizontal page scroll with the data layers")
        pg.evaluate("document.querySelector('[data-v9xlayers]').scrollIntoView()"); time.sleep(0.3); pg.screenshot(path=os.path.join(OUT, "v19x_phone.png"))
        ctx.close()
        check(not errors, f"no page errors ({errors[:3]})")
finally:
    srv.terminate()
print(("ALL PASS" if not fails else f"{len(fails)} FAILED"))
sys.exit(1 if fails else 0)
