"""Validation of the V17 environmental patterns (asterro.v19.mlval/1). Build-time, offline, deterministic.

The V17 models (src/v17/ml.py, tai-v17-ml-1.0.0) are unsupervised: there are no labels, so "accuracy" does not apply
and none is reported. What can be validated, and is here:
  1. Seed stability   k-means at the chosen k refitted with random_state 1..5: adjusted Rand index against seed 0.
                      Isolation forest refitted with random_state 1..5: Spearman correlation of scores against seed 0,
                      and Jaccard overlap of the top-2 % sets.
  2. Feature ablation each of the 12 features removed in turn: Spearman of the isolation-forest scores against the full
                      model and Jaccard of the top-2 % sets, showing which features drive the anomalies.
  3. Interpretable baselines (from V17): Koeppen-Geiger agreement for the clusters (ARI/NMI) and the k-nearest-neighbour
                      distance for anomalies (Spearman), carried over.
  3b. Hidden-combination persistence: how many of the seed-0 hidden-combination cells stay in the top 2 % under every
                      other seed (a pattern that disappears with the random start is not worth inspecting first).
  4. Geographic bias  share of the top-2 % anomalies per 30-degree latitude band against the share of complete cells.
  5. Missing data     cells with any feature missing receive no score (never a high one): checked, not assumed.
Results describe statistical behaviour of coarse variables. They are not scientific validation of any discovery.
"""
import os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VERSION = "tai-v19-mlval-1.0.0"
SEEDS = [1, 2, 3, 4, 5]


def _matrix():
    from src.v17 import features, ml
    _, f = features.compute()
    s = np.load(os.path.join(ROOT, "data/predictor_stack.npz")); v = s["valid"]
    cell = np.flatnonzero(v.ravel())
    lat = -90 + 0.5 * (cell // v.shape[-1])  # row-major 361 x 576 grid, 0.5-degree rows from -90
    cols = [s[c][v].astype(np.float64) for c in ml.BASE] + [f[c] for c in ml.EXTRA]
    X = np.stack(cols, 1)
    ok = np.all(np.isfinite(X), 1)
    mu, sd = X[ok].mean(0), X[ok].std(0)
    return (X - mu) / sd, ok, ml.BASE + ml.EXTRA, lat, f, cell


def _top(scores, q=98):
    return set(np.flatnonzero(scores >= np.percentile(scores, q)))


def jacc(a, b):
    return len(a & b) / max(1, len(a | b))


def compute(kbest):
    from sklearn.cluster import KMeans
    from sklearn.ensemble import IsolationForest
    from sklearn.metrics import adjusted_rand_score
    from scipy.stats import spearmanr
    Z, ok, names, lat, _, cell = _matrix()
    cid = cell[ok]  # grid cell id of each complete cell
    Zc = Z[ok]
    km0 = KMeans(n_clusters=kbest, n_init=10, random_state=0).fit(Zc).labels_
    km = {s: float(adjusted_rand_score(km0, KMeans(n_clusters=kbest, n_init=10, random_state=s).fit(Zc).labels_)) for s in SEEDS}
    fit = lambda M, s=0: -IsolationForest(n_estimators=300, max_samples=4096, random_state=s).fit(M).score_samples(M)
    a0 = fit(Zc); t0 = _top(a0)
    calm = np.all(np.abs(Zc) < 2.0, 1)  # every feature within 2 SD: the V17 "hidden combination" condition
    hid0 = {int(x) for x in t0 if calm[x]}
    iso, keep = {}, {x: 0 for x in hid0}
    for s in SEEDS:
        a = fit(Zc, s); ts = _top(a); iso[s] = {"spearman": float(spearmanr(a0, a).statistic), "top2_jaccard": jacc(t0, ts)}
        for x in hid0:
            keep[x] += int(x in ts)
    abl = {}
    for j, n in enumerate(names):
        a = fit(np.delete(Zc, j, axis=1)); abl[n] = {"spearman": float(spearmanr(a0, a).statistic), "top2_jaccard": jacc(t0, _top(a))}
    bias = None
    if lat is not None:
        L = lat[ok]; top = np.zeros(len(Zc), bool); top[list(t0)] = True
        bias = []
        for lo in range(-90, 90, 30):
            m = (L >= lo) & (L < lo + 30)
            if m.sum():
                bias.append({"band": [lo, lo + 30], "cells_share": float(m.mean()), "top2_share": float(top[m].sum() / top.sum()),
                             "ratio": float((top[m].sum() / top.sum()) / m.mean())})
    return {"schema": "asterro.v19.mlval/1", "version": VERSION, "validates": "tai-v17-ml-1.0.0", "k": kbest,
            "n_complete": int(ok.sum()), "n_incomplete": int((~ok).sum()), "features": names,
            "kmeans_seed_ari": km, "iforest_seed": iso,
            "hidden_persistence": {"n_hidden_seed0": len(hid0), "kept_in_all_seeds": sum(1 for v in keep.values() if v == len(SEEDS)),
                                   "kept_counts": sorted(keep.values(), reverse=True),
                                   "cells": sorted([{"cell": int(cid[x]), "kept": v} for x, v in keep.items()], key=lambda r: (-r["kept"], r["cell"]))}, "ablation": abl, "latitude_bias": bias,
            "missing_rule": "cells with any of the 12 features missing receive no cluster label and no anomaly score",
            "note": "Unsupervised models: no labels, so no accuracy is reported. Stability and sensitivity only."}


def missing_checks(ok):
    """Read the published V17 products and check that no incomplete cell carries a score (255 = none)."""
    import base64, json
    P = json.load(open(os.path.join(ROOT, "public/data/v17/patterns.json")))
    dec = lambda b: np.frombuffer(base64.b64decode(b), dtype=np.uint8)
    an, lab, uq = dec(P["ml"]["anomaly_pct_b64"]), dec(P["ml"]["labels_b64"]), dec(P["novelty"]["uniqueness_pct_b64"])
    s = np.load(os.path.join(ROOT, "data/predictor_stack.npz")); v = s["valid"]
    crit = np.stack([s[c][v].astype(np.float64) for c in P["novelty"]["criteria"]], 1)
    ok6 = np.all(np.isfinite(crit), 1)
    return {"anomaly_none_equals_incomplete": bool(np.array_equal(an == 255, ~ok)),
            "label_none_equals_incomplete": bool(np.array_equal(lab == 255, ~ok)),
            "rarity_scored_with_missing_criteria": int(((uq != 255) & ~ok6).sum()),
            "incomplete_cells": int((~ok).sum()), "cells_missing_a_rarity_criterion": int((~ok6).sum())}


if __name__ == "__main__":
    import json, sys
    sys.path.insert(0, ROOT)
    v17 = json.load(open(os.path.join(ROOT, "public/data/v17/patterns.json")))
    k = v17["ml"]["k"]
    r = compute(int(k))
    r["missing_checks"] = missing_checks(_matrix()[1])
    os.makedirs(os.path.join(ROOT, "data/v19"), exist_ok=True)
    json.dump(r, open(os.path.join(ROOT, "data/v19/ml_validation.json"), "w"), indent=1)
    print(json.dumps({k2: r[k2] for k2 in ("k", "kmeans_seed_ari", "iforest_seed")})[:900])
