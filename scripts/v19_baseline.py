"""V19 regression baseline: what V19 must preserve, read from the V18 release commit and compared with the working tree.
Writes data/v19/baseline.json.
    python3 scripts/v19_baseline.py [base_commit] [npm_test_log] [--check]
Reuses the V17 snapshot (protected files, reference results, dataset inventory, engine configuration, routes, Discover
hubs) and adds the V17/V18 products: the V17 data documents, the V18 Local Impact engine and its constants, the
registry state counts, and the per-suite test totals of a recorded `npm test` run."""
import hashlib, json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import v17_baseline as V  # noqa: E402

ROOT = V.ROOT
ARGS = [a for a in sys.argv[1:] if a != "--check"]
CHECK = "--check" in sys.argv  # compare only; do not rewrite data/v19/baseline.json
V.BASE = ARGS[0] if ARGS else "cab7a0c"
LOG = ARGS[1] if len(ARGS) > 1 else None
V17_DOCS = ["public/data/v17/cube.json", "public/data/v17/patterns.json", "public/data/v17/registry.json",
            "public/data/v17/modules.json", "public/data/v17/limits.json"]
V18 = "app/frontend/phase4/engine_v18.js"


def sha(b):
    return hashlib.sha256(b).hexdigest()


def snapshot(read):
    s = V.snapshot(read)
    s["routes"] = sorted(set(s["routes"]) | {"local"})  # the Local Impact tab is created by ui_31_local.js
    # tabs as rendered, in order: the exact list asserted by the design smoke test (some tabs are created in JS)
    s["rendered_tabs"] = json.loads(re.search(r"check\(tabs == (\[[^\]]*\])", read("tests/phase4/ui_design_smoke.py").decode()).group(1))
    s["v17_products"] = {p: sha(read(p)) for p in V17_DOCS}
    reg = json.loads(read("public/data/v17/registry.json"))
    states = {}
    for r in reg["sources"]:
        states[r["state"]] = states.get(r["state"], 0) + 1
    s["v17_registry_states"] = dict(sorted(states.items()))
    src = read(V18).decode()
    s["v18_local"] = {"engine_sha256": sha(read(V18)),
                      "version": re.search(r'VERSION\s*=\s*"([^"]+)"', src).group(1),
                      "radii_km": json.loads(re.search(r"RADII\s*=\s*(\[[^\]]*\])", src).group(1)),
                      "max_km": float(re.search(r"MAX_KM = ([\d.]+)", src).group(1))}
    return s


def tests(log):
    if not log or not os.path.exists(log):
        return None
    t = open(log, encoding="utf-8").read()
    out = {m.group(2).strip() or "python": m.group(1) for m in re.finditer(r"^(\d+/\d+) ?(.*?)(?: checks)? passed$", t, re.M)}
    rc = re.search(r"^rc=(\d+)$", t, re.M)
    return {"suites": out, "exit_code": int(rc.group(1)) if rc else None}


def main():
    before, after = snapshot(V.git_bytes), snapshot(V.now_bytes)
    diff = {}
    for k in before:
        if before[k] != after[k]:
            if isinstance(before[k], dict):
                diff[k] = {x: [before[k].get(x), after[k].get(x)] for x in set(before[k]) | set(after[k]) if before[k].get(x) != after[k].get(x)}
            else:
                diff[k] = [before[k], after[k]]
    out = {"schema": "asterro.v19.baseline/1", "base_commit": V.BASE,
           "base_commit_full": subprocess.run(["git", "-C", ROOT, "rev-parse", V.BASE], capture_output=True, text=True).stdout.strip(),
           "baseline": before, "tests_at_baseline": tests(LOG), "differences_in_working_tree": diff}
    if not CHECK:
        os.makedirs(os.path.join(ROOT, "data/v19"), exist_ok=True)
        json.dump(out, open(os.path.join(ROOT, "data/v19/baseline.json"), "w"), indent=1)
    # V20.3: differences approved in a later release are listed with their exact old and new values; only an exact
    # match is accepted, so any other or further change still fails
    acc = json.load(open(os.path.join(ROOT, "data/v22/accepted_differences.json")))["accepted"]
    accepted = {}
    for k in list(diff):
        if isinstance(diff[k], dict):
            for x in list(diff[k]):
                if acc.get(k, {}).get(x) == diff[k][x]:
                    accepted.setdefault(k, {})[x] = diff[k].pop(x)
            if not diff[k]:
                del diff[k]
        elif acc.get(k) == diff[k]:
            accepted[k] = diff.pop(k)
    if accepted:
        print("accepted (data/v22/accepted_differences.json):", ", ".join(sorted(f"{k}:{x}" for k in accepted for x in (accepted[k] if isinstance(accepted[k], dict) else [""]))))
    print("differences:", json.dumps(diff)[:800] if diff else "none")


if __name__ == "__main__":
    main()
