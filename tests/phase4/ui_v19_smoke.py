"""V19 planetary intelligence in the browser (Playwright/Chromium).

    python tests/phase4/ui_v19_smoke.py [outdir]

Discover › Science domains: the V17 section is unchanged and the V19 section adds why the candidate ranked, nine separate
measures (equal to the engine and consistent with V17's definitions), sixteen domains (blocked ones show no value), the
objective profiles and the physical differences. Discover › Patterns: the validation of the V17 patterns. Data: the V19
registry with nine states, counts equal to the data. Local Impact: the domains at the analysed cell, before the report.
Research mode details, keyboard access, five languages, phone width, the prohibited-element audit, the baseline unchanged.
"""
import os, re, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_v19_smoke"
os.makedirs(OUT, exist_ok=True)
PORT = 8819
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
errors, fails = [], []
AUDIT = re.search(r'AUDIT = r"""(.*?)"""', open(os.path.join(ROOT, "tests/phase4/ui_design_audit.py")).read(), re.S).group(1)
ATACAMA = {"latitude": -23.65432, "longitude": -68.15678, "accuracy": 1200}


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def boot(pg):
    pg.goto(URL); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000)
    pg.evaluate("runSearch()"); pg.wait_for_function("S.searched", timeout=60000); time.sleep(0.4)
    pg.evaluate("document.querySelectorAll('.jl-toast').forEach(t => t.remove())")


def domains(pg, i="S.res.distinct[0]"):
    pg.evaluate(f"v7Open('domains', {i})"); time.sleep(1.2)


try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, geolocation=ATACAMA, permissions=["geolocation"])
        pg = ctx.new_page(); pg.set_default_timeout(120000); pg.on("pageerror", lambda e: errors.append(str(e)))
        boot(pg)
        base = pg.evaluate("({top: S.res.distinct[0], s: S.res.eff[S.res.distinct[0]], w: JSON.stringify(S.weights), tid: S.targetId, n: S.res.nElig})")
        domains(pg)
        r = pg.evaluate("""(() => { const s = document.querySelector('[data-v19]'); return s && { v17: !!document.querySelector('[data-v7domains] [data-v7sep]') && document.querySelectorAll('[data-v7mod]').length,
          doms: [...s.querySelectorAll('[data-v9dom]')].map(d => [d.dataset.v9dom, d.dataset.v9state, d.querySelectorAll('[data-v9var]').length, !!d.querySelector('[data-v9noinputs]')]),
          meas: Object.fromEntries([...s.querySelectorAll('[data-v9m]')].map(t => [t.dataset.v9m, t.querySelector('td').innerText])),
          interp: [...s.querySelectorAll('[data-v9int]')].map(l => l.dataset.v9int), profs: [...s.querySelectorAll('[data-v9prof]')].map(l => [l.dataset.v9prof, l.dataset.v9ok]),
          v17sep: Object.fromEntries([...document.querySelectorAll('[data-v7sepk]')].map(t => [t.dataset.v7sepk, t.querySelector('td').innerText])) }; })()""")
        check(r and r["v17"] == 10, f"the V17 Science domains section is still there with its ten modules ({r and r['v17']})")
        check(r and len(r["doms"]) == 16, "the V19 section lists sixteen domains")
        blocked = [d for d in r["doms"] if d[1] == "blocked"]
        check(blocked and all(d[2] == 0 and d[3] for d in blocked), f"blocked domains show no value, only what they wait for ({[d[0] for d in blocked]})")
        check(all(d[2] > 0 for d in r["doms"] if d[1] not in ("blocked", "sampled", "not_sampled")), "domains with per-cell data show their input values")
        # site samples: the top Jezero candidate (Altiplano) is one of the 16 sampled cells
        sm = pg.evaluate("""(() => { const s = document.querySelector('[data-v19]'), g = s.querySelector('[data-v9dom=geology]'), bio = s.querySelector('[data-v9dom=biology]'), smp = v9Sample(S.res.distinct[0]);
          return { cell: S.cell[S.res.distinct[0]], g: g.dataset.v9state, units: [...g.querySelectorAll('[data-v9unit]')].map(t => +t.dataset.v9unit), want: smp && smp.geology.units.map(u => u.map_id),
                   volc: [...g.querySelectorAll('[data-v9v]')].map(t => +t.dataset.v9v), wantv: smp && smp.volcanoes.near.map(x => x.number), b: bio.dataset.v9state, bn: +bio.querySelector('[data-v9bio]').dataset.v9bio, wantb: smp && smp.biology.all,
                   mat: !!s.querySelector('[data-v9mat][data-v9mat-sampled="1"]'), mt: (s.querySelector('[data-v9mat]') || {}).closest ? s.querySelector('[data-v9mat]').previousElementSibling.innerText : '' }; })()""")
        check(sm["cell"] == 77940 and sm["g"] == "sampled" and sm["units"] == sm["want"] and sm["volc"] == sm["wantv"] and len(sm["volc"]) == 8, f"sampled cell: the geology domain shows its map units and the Holocene volcanoes within 100 km, equal to the data ({sm['units']}, {len(sm['volc'])} volcanoes)")
        check(sm["b"] == "sampled" and sm["bn"] == sm["wantb"], f"sampled cell: the biology domain shows the GBIF record counts ({sm['bn']})")
        check(sm["mat"] and "not compared" in sm["mt"], "material evidence is shown side by side and says it is not compared")
        check(len(r["meas"]) == 9, "nine separate measures")
        eng = pg.evaluate("txPct(S.res.eff[S.res.distinct[0]])")
        check(r["meas"]["environmental_similarity"] == eng and r["v17sep"]["env"] == eng, f"environmental similarity equals the engine's score and V17's ({eng})")
        check(r["meas"]["process_relevance"].split(" ")[0] == r["v17sep"]["process"].split(" ")[0], "process relevance uses V17's definition (same count)")
        check(r["v17sep"]["ops"].split(" · ")[0] in r["meas"]["operational_relevance"], "operational relevance names the same best operation as V17")
        check(r["meas"]["data_completeness"] == r["v17sep"]["complete"], "data completeness equals V17's")
        check(not re.search(r"\d", r["meas"]["geological_relevance"]) and "cannot be assessed" in r["meas"]["mineralogical_relevance"], f"geological relevance is shown but never scored where map units exist; mineralogical relevance cannot be assessed ({r['meas']['geological_relevance']})")
        txt = pg.evaluate("document.querySelector('[data-v19]').innerText")
        check("never combined" in txt and "Not a probability" in txt and "not confidence" in txt.lower(), "the section states: never one score, not a probability, completeness is not confidence")
        check(r["interp"] == ["drivers", "supporting", "partial", "contradicting", "missing", "direct", "proxy", "apps", "field"], "why the candidate ranked: drivers, supporting, partial, contradicting, missing, measured vs proxy, uses, field work")
        part = pg.evaluate("""(() => { const g = k => document.querySelector(`[data-v9int=${k}]`).innerText.split(': ')[1]; const I = AsterroV19.interpret(v9Ctx(S.res.distinct[0], v7Tid()));
          return { ok: ['supporting', 'contradicting'].every(k => (I[k].map(c => tx('crit.' + c + '.s')).join(', ') || '–') === g(k)) }; })()""")
        check(part["ok"], "the interpretation shown equals the engine's partition")
        pr = dict(r["profs"])
        check(len(pr) == 14 and pr["geological_fieldwork"] == "1" and pr["mineralogical_investigation"] == "0" and pr["landing_terrain"] == "1", "fourteen objectives; at the sampled cell geological fieldwork and landing terrain can be evaluated, mineralogy cannot")
        check("Not reproducible at any Earth site" in txt and "Gravity" in txt, "the most important physical differences are listed")
        pg.screenshot(path=os.path.join(OUT, "v19_domains.png"))
        # an unsampled candidate: geology and biology show nothing
        domains(pg, "S.res.distinct[15]")
        un = pg.evaluate("""(() => { const s = document.querySelector('[data-v19]'), g = s.querySelector('[data-v9dom=geology]');
          return { smp: !!v9Sample(S.res.distinct[15]), g: g.dataset.v9state, units: g.querySelectorAll('[data-v9unit]').length, note: !!g.querySelector('[data-v9notsampled]'), b: s.querySelector('[data-v9dom=biology]').dataset.v9state,
                   fw: s.querySelector('[data-v9prof=geological_fieldwork]').dataset.v9ok, why: s.querySelector('[data-v9m=geological_relevance] td').innerText, mat: s.querySelector('[data-v9mat]').dataset.v9matSampled }; })()""")
        check(not un["smp"] and un["g"] == "not_sampled" and un["units"] == 0 and un["note"] and un["b"] == "not_sampled", "an unsampled candidate: geology and biology say 'not sampled' and show no value")
        check(un["fw"] == "0" and "not sampled" in un["why"] and un["mat"] == "0", f"an unsampled candidate: geological fieldwork cannot be evaluated, geological relevance says why ({un['why']})")
        domains(pg)
        # Research mode and keyboard
        pg.evaluate("dsSetMode('advanced')"); time.sleep(0.5)
        adv = pg.evaluate("(() => { const d = document.querySelector('[data-v9dom=thermal] .v7-mod-adv'); return d && getComputedStyle(d).display !== 'none' && d.innerText; })()")
        check(adv and "MODIS" in adv and "tai-v19-dom-thermal" in adv, "Research mode shows method, limits, validation and version")
        pg.evaluate("dsSetMode('simple')"); time.sleep(0.3)
        pg.focus("[data-v9dom=mineralogy] summary"); pg.keyboard.press("Enter"); time.sleep(0.3)
        check(pg.evaluate("document.querySelector('[data-v9dom=mineralogy]').open"), "a closed domain opens from the keyboard")
        v = sorted(set(pg.evaluate(AUDIT, "#left")))
        check(not v, f"V19 section: no prohibited design element ({'; '.join(v[:4])})")
        # patterns
        pg.evaluate("XT.hub = 'patterns'; renderLeft()"); time.sleep(1.0)
        ml = pg.evaluate("(() => { const s = document.querySelector('[data-v9ml]'); return s && { k: [...s.querySelectorAll('[data-v9mlk]')].map(l => l.dataset.v9mlk), t: s.innerText }; })()")
        check(ml and ml["k"] == ["kmeans", "iforest", "ablation", "bias", "persist", "missing"] and "no labels and no accuracy" in ml["t"] and "not a discovery" in ml["t"], "pattern validation: stability, sensitivity, bias, missing data, and no accuracy claimed")
        # data tab
        pg.evaluate("setTab('data')"); time.sleep(1.2)
        rg = pg.evaluate("""(() => { const s = document.querySelector('[data-v9registry]'); if (!s) return null; const R = ASTERRO_V19.registry;
          return { cnt: [...s.querySelectorAll('[data-v9cnt]')].map(l => [l.dataset.v9cnt, +l.innerText.split('· ')[1].replace(/,/g, '')]), want: R.states.map(x => [x.id, R.counts[x.id]]),
                   rows: s.querySelectorAll('[data-v9src]').length, n: R.sources.length, v17: !!document.querySelector('[data-v7registry]'),
                   blocked: [...s.querySelectorAll('[data-v9state=access_blocked]')].every(t => t.innerText.includes('refused by this environment') || t.innerText.includes('refused on the fetch route')),
                   acq: ['macrostrat_units', 'gvp_holocene', 'gbif_extremophiles'].map(k => (s.querySelector(`[data-v9src=${k}]`) || {dataset: {}}).dataset.v9state) }; })()""")
        check(rg and rg["cnt"] == rg["want"] and len(rg["cnt"]) == 9, "Data tab: nine states with counts equal to the registry")
        check(rg and rg["rows"] == rg["n"] and rg["v17"], f"every dataset is listed ({rg and rg['rows']}) and the V17 registry is still shown")
        check(rg and rg["blocked"], "every blocked dataset says where it was refused (this environment or the fetch route), not that the provider failed")
        check(rg and rg["acq"] == ["integrated_awaiting_validation"] * 3, "Macrostrat, the volcano catalogue and GBIF are 'integrated, awaiting full validation'")
        pg.screenshot(path=os.path.join(OUT, "v19_registry.png"))
        # Local Impact
        pg.evaluate("document.querySelector('#tab-local').scrollIntoView()"); pg.click("#tab-local"); time.sleep(0.6)
        pg.click("#li-geo"); pg.wait_for_function("LI.i != null"); time.sleep(1.0)
        li = pg.evaluate("""(() => { const secs = [...document.querySelectorAll('[data-lisec]')].map(s => s.dataset.lisec); const s = document.querySelector('[data-lisec=v19]');
          return { secs, doms: s ? s.querySelectorAll('[data-v9dom]').length : 0, profs: s ? s.querySelectorAll('[data-v9prof]').length : 0 }; })()""")
        check((li["secs"][-2:] == ["v19", "report"] or li["secs"][-3:] == ["v19", "v19x", "report"]) and li["doms"] == 16 and li["profs"] == 14, f"Local Impact shows the sixteen domains and the objectives before the report ({li['secs']})")
        check(pg.evaluate("localStorage.getItem('asterro.local.v1')") is None, "Local Impact privacy unchanged: nothing stored without consent")
        lg = pg.evaluate("""(() => { const s = document.querySelector('[data-lisec=v19]'); return { g: s.querySelector('[data-v9dom=geology]').dataset.v9state, v: s.querySelectorAll('[data-v9dom=geology] [data-v9v]').length,
          note: (document.querySelector('[data-linofeat] [data-v9volcnote]') || {}).innerText || '', bio: (s.querySelector('[data-v9bio-ex]') || {}).innerText || '' }; })()""")
        check(lg["g"] == "sampled" and lg["v"] == 15 and "15 Holocene volcanoes" in lg["note"], f"Local Impact at the Atacama cell: 15 Holocene volcanoes within 100 km, and the V18 note says so ({lg['note'][:60]})")
        check("Tebenquiche" in lg["bio"], "Local Impact: the Archaea records name their dataset (Brava and Tebenquiche microbial mats)")
        pg.screenshot(path=os.path.join(OUT, "v19_local.png"))
        # baseline unchanged
        after = pg.evaluate("({top: S.res.distinct[0], s: S.res.eff[S.res.distinct[0]], w: JSON.stringify(S.weights), tid: S.targetId, n: S.res.nElig})")
        check(after == base, "the baseline result is unchanged")
        # languages
        domains(pg)
        for L in ["bn", "es", "fr", "de"]:
            pg.evaluate(f"setLang('{L}')"); time.sleep(0.6); pg.evaluate("renderLeft()"); time.sleep(0.5)
            t = pg.evaluate("document.querySelector('[data-v19]').innerText"); raw = re.findall(r"\bv19\.[a-z_.]+", t)
            check(not raw and "Sixteen science domains" not in t, f"{L}: V19 section translated, no raw keys ({raw[:3]})")
        pg.evaluate("setLang('en')")
        ctx.close()
        # phone
        ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); pg.set_default_timeout(120000); pg.on("pageerror", lambda e: errors.append("phone: " + str(e)))
        boot(pg); domains(pg)
        check(not pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1"), "phone: no horizontal page scroll with the V19 section")
        pg.evaluate("document.querySelector('[data-v19]').scrollIntoView()"); time.sleep(0.4)
        pg.screenshot(path=os.path.join(OUT, "v19_phone.png"))
        ctx.close()
        check(not errors, f"no page errors ({errors[:3]})")
finally:
    srv.kill()
print(f"\n{'ALL PASS' if not fails else str(len(fails)) + ' FAIL'}")
sys.exit(1 if fails else 0)
