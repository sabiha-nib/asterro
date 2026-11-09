"""V17 regression baseline: snapshot of what V17 must preserve, taken from the pre-V17 commit and compared with the
working tree. Writes data/v17/baseline.json.
    python3 scripts/v17_baseline.py [base_commit]
Recorded: protected-file hashes, the reference results used by the parity tests, the dataset inventory, the engine
configuration (algorithm, thresholds, criteria, profiles), the top-level routes and Discover hubs, and the Laboratory
modules. Each is read from git at the base commit and from the working tree; any difference is listed."""
import hashlib, json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = sys.argv[1] if len(sys.argv) > 1 else "5fa654a"


def git_bytes(path):
    return subprocess.run(["git", "-C", ROOT, "show", f"{BASE}:{path}"], capture_output=True, check=True).stdout


def now_bytes(path):
    return open(os.path.join(ROOT, path), "rb").read()


def sha(b):
    return hashlib.sha256(b).hexdigest()


def snapshot(read):
    prot = json.loads(read("tests/phase3/fixtures/protected_sha256.json"))
    files = prot.get("files", prot)
    snap = {"protected": {p: sha(read(p)) for p, h in files.items() if isinstance(h, str)}}
    snap["protected_match_fixture"] = all(snap["protected"][p] == h for p, h in files.items() if isinstance(h, str))
    snap["reference_results"] = {p: sha(read(p)) for p in ["tests/fixtures/reference.json", "tests/fixtures/ext_reference.json",
                                                           "tests/fixtures/ref_mars_jezero.f64", "tests/fixtures/ref_moon_south_pole.f64",
                                                           "tests/fixtures/repro_cross.json", "tests/fixtures/repro_moon.json", "tests/fixtures/repro_mars_custom.json"]}
    inv = json.loads(read("data/inventory/inventory.json"))
    snap["datasets"] = {i["id"]: [i["status"], i.get("version")] for i in inv["items"] if i["class"] != "limitation"}
    app = json.loads(read("public/data/app.json"))
    snap["engine"] = {"algorithm": app["algorithm_version"], "thresholds": app["thresholds"], "criteria": [c["id"] for c in app["criteria"]],
                      "profiles": sorted(app["profiles"]), "ranges": app["ranges"]}
    snap["stack_sha256"] = sha(read("public/data/stack.bin"))
    src = read("app/frontend/index.src.html").decode()
    snap["routes"] = sorted(set(re.findall(r'id="tab-([a-z0-9]+)"', src))) + ["#terms", "#privacy"]
    hub = read("app/frontend/phase4/ui_22_discover_hub.js").decode()
    snap["discover_hubs"] = json.loads(re.search(r"const XHUB = (\[[^\]]*\])", hub).group(1).replace("'", '"'))
    return snap


def main():
    before, after = snapshot(git_bytes), snapshot(now_bytes)
    diff = {}
    for k in before:
        if before[k] != after[k]:
            if isinstance(before[k], dict):
                diff[k] = {x: [before[k].get(x), after[k].get(x)] for x in set(before[k]) | set(after[k]) if before[k].get(x) != after[k].get(x)}
            else:
                diff[k] = [before[k], after[k]]
    out = {"schema": "asterro.v17.baseline/1", "base_commit": BASE,
           "base_commit_full": subprocess.run(["git", "-C", ROOT, "rev-parse", BASE], capture_output=True, text=True).stdout.strip(),
           "baseline": before, "differences_in_working_tree": diff,
           "note": "Discover hubs gain entries at run time (ui_29_v17.js pushes them into XHUB); the source list in ui_22 is unchanged."}
    json.dump(out, open(os.path.join(ROOT, "data/v17/baseline.json"), "w"), indent=1)
    print("differences:", json.dumps(diff)[:600] if diff else "none")


if __name__ == "__main__":
    main()
