"""Compute Python reference results from the web bundle (public/data) for JS parity tests,
and export the web-side JSON (targets, ranges, profiles, provenance)."""
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.compute.similarity import similarity, effective_scores
from src.compute.normalization import compute_ranges
from src.compute.ranking import order, distinct_sites
from src.compute.clustering import constellations
from src.compute.variables import CRITERION_IDS as C
from src.compute.sensitivity import MISSION_PROFILES


def load_bundle(repo):
    info = json.load(open(os.path.join(repo, "data/metadata/stack_build.json")))
    buf = open(os.path.join(repo, "public/data/stack.bin"), "rb").read()
    arr = {}
    for L in info["layout"]:
        a = np.frombuffer(buf, dtype=L["dtype"], count=L["length"], offset=L["offset"]).reshape(L["shape"])
        arr[L["name"]] = a
    return info, arr


def main(repo="."):
    info, A = load_bundle(repo)
    T = json.load(open(os.path.join(repo, "data/targets.json")))["targets"]
    E = {c: A[c].astype(np.float64) for c in C}
    R = compute_ranges(E, T, C)
    cell = A["cell"].astype(np.int64)
    lat = -90 + 0.5 * (cell // 576); lon = -180 + 0.625 * (cell % 576)
    ref = dict(ranges=R, targets={})
    for t in T:
        w = MISSION_PROFILES["general"]["weights"]
        r = similarity(E, t["variables"], w, R)
        eff = effective_scores(r)
        o = order(eff, cell)
        ds = distinct_sites(eff, cell, lat, lon, n=20, min_sep_km=300)
        act = r["active"]
        norm = np.column_stack([(E[c] - R[c][0]) / (R[c][1] - R[c][0]) for c in act])
        cl = constellations(eff, norm, cell)
        eff.astype("<f8").tofile(os.path.join(repo, f"tests/fixtures/ref_{t['id']}.f64"))
        ref["targets"][t["id"]] = dict(order_top1000=o[:1000].tolist(), distinct=[int(i) for i in ds],
                                        k=int(cl["k"]), labels=cl["labels"].tolist(),
                                        candidates=[int(i) for i in cl["candidates"]], silhouette=cl["silhouette"])
        print(t["id"], "top", [round(float(eff[i]), 4) for i in ds[:5]], "k", cl["k"], round(cl["silhouette"], 4))
    json.dump(ref, open(os.path.join(repo, "tests/fixtures/reference.json"), "w"))


if __name__ == "__main__":
    main(*sys.argv[1:])
