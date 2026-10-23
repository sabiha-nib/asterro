"""Exploration Journal persistence — UI walk-through (Playwright/Chromium).

    python tests/phase4/ui_journal_persist_smoke.py [outdir]

Checks, in a real browser profile (one browser context = one browser):
  - progress stored by the earlier version (localStorage "asterro.journal.v1", {marks, unlocked, ch}) is kept as is;
  - a new achievement earned by a real action survives a reload;
  - language switches (five languages) and target switches leave the journal untouched;
  - re-rendering the journal and re-running the same action never awards anything twice (one toast at most);
  - two tabs of the same browser merge their progress instead of overwriting each other, and no toast repeats;
  - a corrupt stored value is set aside (…v1.corrupt), not silently erased;
  - reset asks for confirmation; a stale tab cannot bring reset progress back;
  - export → import into a fresh browser re-derives achievements from the recorded actions only;
  - the journal says progress is stored in this browser only (there is no account or server: nothing is synced);
  - journal state never enters a score: target, weights and the #1 result are identical before and after.
"""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/asterro_journal_persist"
os.makedirs(OUT, exist_ok=True)
PORT = 8799
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", os.path.join(ROOT, "public")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
URL = f"http://localhost:{PORT}/index.html"
KEY = "asterro.journal.v1"
errors, fails = [], []


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg, flush=True)
    if not ok:
        fails.append(msg)


def boot(pg, search=True):
    pg.goto(URL); pg.wait_for_function("document.querySelector('#hero-facts').textContent.includes('valid land cells')", timeout=120000)
    if search:
        pg.evaluate("runSearch()"); pg.wait_for_function("S.searched", timeout=60000); time.sleep(0.4)


def stored(pg):
    return pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}') || 'null')")


T0 = 1767225600000   # 2026-01-01T00:00:00Z, an earlier session
OLD = {"marks": {"search": T0, "target": T0, "cell:1234": T0}, "unlocked": {"first_contact": T0}, "ch": {}}
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = b.new_context(viewport={"width": 1512, "height": 950}, reduced_motion="reduce", accept_downloads=True)
        ctx.add_init_script(f"if (!sessionStorage.getItem('seeded')) {{ localStorage.setItem('{KEY}', {json.dumps(json.dumps(OLD))}); sessionStorage.setItem('seeded', '1'); }}")
        pg = ctx.new_page(); pg.set_default_timeout(90000)
        pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        toasts = []
        pg.expose_function("__toast", lambda t: toasts.append(t))
        pg.add_init_script("(() => { const go = () => { if (typeof jlToast !== 'function') return setTimeout(go, 50); const f = jlToast; jlToast = function (t) { window.__toast(String(t)); return f.apply(this, arguments); }; }; go(); })()")
        boot(pg)
        s = stored(pg)
        check(s and s["marks"].get("cell:1234") == T0 and s["unlocked"].get("first_contact") == T0, "progress stored by the earlier version is kept, with its original times")
        base0 = pg.evaluate("({tid: S.targetId, w: JSON.stringify(S.weights), top: S.res.distinct[0], s: S.res.eff[S.res.distinct[0]]})")
        # earn "Beyond the top" with three real cell selections (one already recorded)
        pg.evaluate("for (const i of S.res.distinct.slice(3, 5)) select(i)"); time.sleep(0.4)
        s = stored(pg)
        check("beyond_top" in s["unlocked"] and len([k for k in s["marks"] if k.startswith("cell:")]) >= 3, "selecting places unlocks “Beyond the top” and stores it")
        n_toast = len(toasts)
        # same actions again, re-render the journal several times: nothing new, no second toast
        pg.evaluate("for (const i of S.res.distinct.slice(3, 5)) select(i); jnOpen('journal'); jnRender(); jnRender(); jnClose(); jnOpen('journal'); jnClose()"); time.sleep(0.3)
        s2 = stored(pg)
        check(s2["unlocked"] == s["unlocked"] and len(toasts) == n_toast, f"repeating the action and re-rendering the journal awards nothing twice ({len(toasts) - n_toast} extra toasts)")
        # language and target switches
        before = json.dumps(stored(pg), sort_keys=True)
        for L in ["bn", "es", "fr", "de", "en"]:
            pg.evaluate(f"setLang('{L}')"); time.sleep(0.25)
        after_lang = stored(pg)
        check(json.dumps({k: after_lang[k] for k in ("unlocked",)}, sort_keys=True) == json.dumps({k: json.loads(before)[k] for k in ("unlocked",)}, sort_keys=True) and all(k in after_lang["marks"] for k in json.loads(before)["marks"]),
              "five language switches keep every achievement and recorded action")
        pg.evaluate("setTarget('moon_south_pole')"); time.sleep(0.6); pg.evaluate("setTarget('mars_jezero')"); time.sleep(0.6)
        s3 = stored(pg)
        check(all(k in s3["unlocked"] for k in s["unlocked"]), "target switches keep every achievement")
        # reload
        pg.reload(); boot(pg)
        s4 = stored(pg)
        check(all(k in s4["unlocked"] for k in s3["unlocked"]) and all(k in s4["marks"] for k in s3["marks"]), "everything survives a reload")
        # summary and storage statement in the journal
        pg.evaluate("jnOpen('journal')"); time.sleep(0.4)
        j = pg.evaluate("({sum: (document.querySelector('[data-jls-summary]') || {}).textContent, store: (document.querySelector('[data-jls-store]') || {}).dataset && document.querySelector('[data-jls-store]').dataset.jlsStore, txt: (document.querySelector('[data-jls-store]') || {}).textContent})")
        check(bool(j["sum"]) and j["store"] == "local" and j["txt"] and ("browser" in j["txt"].lower()), f"the journal shows a progress summary and says it is stored in this browser only ({j['sum']!r})")
        pg.screenshot(path=f"{OUT}/journal.png")
        pg.evaluate("jnClose()")
        # two tabs: each earns something different; neither overwrites the other
        pg2 = ctx.new_page(); boot(pg2)
        pg2.evaluate("setTarget('moon_south_pole')"); time.sleep(0.6)        # tgt:moon_south_pole
        pg.evaluate("jlMark('missing'); jlMark('trust:sources')"); time.sleep(0.4)  # evidence (in tab 1)
        pg2.evaluate("jlMark('repro')"); time.sleep(0.4)
        pg.evaluate("jlMark('passport_out')"); time.sleep(0.4)
        s5 = stored(pg)
        check(all(k in s5["unlocked"] for k in ["evidence", "repro", "storyteller"]), f"two open tabs merge their progress (evidence, repro, storyteller all kept: {sorted(s5['unlocked'])})")
        in_mem = pg.evaluate("Object.keys(JL.unlocked).sort()")
        check("repro" in in_mem, "the other tab's progress reaches this tab's journal without a reload")
        # reset: confirmation, and a stale tab cannot resurrect
        pg.evaluate("jnOpen('journal')"); time.sleep(0.3)
        pg.click("[data-jls=reset-ask]"); time.sleep(0.2)
        asked = pg.locator("[data-jls=reset-yes]").count() == 1 and len(stored(pg)["unlocked"]) > 0
        pg.click("[data-jls=reset-yes]"); time.sleep(0.3)
        check(asked and not stored(pg)["unlocked"], "reset asks for confirmation first, then clears the journal")
        pg2.evaluate("jlMark('worlds')"); time.sleep(0.4)                     # the other tab still held the old progress
        s6 = stored(pg)
        check("first_contact" not in s6["unlocked"] and "evidence" not in s6["unlocked"], f"a stale tab cannot bring reset progress back (after reset: {sorted(s6['unlocked'])})")
        pg2.close(); pg.evaluate("jnClose()")
        # corrupt value is set aside
        pg.evaluate(f"localStorage.setItem('{KEY}', '{{not json')"); pg.reload(); boot(pg, search=False); time.sleep(0.3)
        cor = pg.evaluate(f"localStorage.getItem('{KEY}.corrupt')")
        check(cor == "{not json", "a corrupt stored value is set aside (…v1.corrupt), not silently erased")
        # export → import into a fresh browser
        pg.evaluate("runSearch()"); pg.wait_for_function("S.searched", timeout=60000)
        pg.evaluate("for (const i of S.res.distinct.slice(0, 3)) select(i)"); time.sleep(0.3)
        pg.evaluate("jnOpen('journal')"); time.sleep(0.3)
        with pg.expect_download() as d:
            pg.click("[data-jls=export]")
        path = os.path.join(OUT, "journal_export.json"); d.value.save_as(path)
        exp = json.load(open(path))
        check(exp.get("schema") == "asterro.journal/1" and "beyond_top" in exp["unlocked"] and set(exp) <= {"schema", "exported_utc", "note", "marks", "unlocked", "ch", "resetAt"} and not any(k in json.dumps({x: exp[x] for x in ("marks", "unlocked", "ch")}) for k in ("score", "email", "weights", "@")), "export writes the journal (schema asterro.journal/1, no scores, no personal data)")
        forged = dict(exp); forged["unlocked"] = dict(exp["unlocked"], repro=T0)          # an achievement without its action
        json.dump(forged, open(os.path.join(OUT, "journal_forged.json"), "w"))
        ctx2 = b.new_context(viewport={"width": 1512, "height": 950}); q = ctx2.new_page(); q.set_default_timeout(90000); boot(q)
        q.evaluate("jnOpen('journal')"); time.sleep(0.3)
        q.set_input_files("input[data-jls=import]", os.path.join(OUT, "journal_forged.json")); time.sleep(0.6)
        imp = q.evaluate(f"JSON.parse(localStorage.getItem('{KEY}'))")
        check("beyond_top" in imp["unlocked"] and "repro" not in imp["unlocked"], f"import into another browser re-derives achievements from the recorded actions only (a listed achievement without its action is not granted: {sorted(imp['unlocked'])})")
        ctx2.close()
        pg.evaluate("jnClose(); setTarget('mars_jezero'); applyProfile('general')"); time.sleep(0.6)
        base1 = pg.evaluate("({tid: S.targetId, w: JSON.stringify(S.weights), top: S.res.distinct[0], s: S.res.eff[S.res.distinct[0]]})")
        check(base1 == base0, "journal state never enters a score: target, weights and #1 result identical")
        ctx.close(); b.close()
finally:
    srv.terminate()
check(not errors, f"no page errors ({errors[:3]})")
print(json.dumps({"fails": fails}, indent=1))
sys.exit(1 if fails else 0)
