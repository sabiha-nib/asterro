"""Environmental patterns by unsupervised learning (tai-v17-ml-1.0.0). Build-time only; the page receives the
labels and scores with this documentation. The deterministic baseline engine is not touched.

Input features (12, per valid cell, each standardised to zero mean and unit variance over the complete cells):
  the six baseline conditions; MODIS LST day and night climatology (K); mean 2 m air temperature (C);
  V17 freeze_months, dry_months and precip_cv. A cell with any feature missing gets no label and no score.

1. Environmental clustering: k-means (scikit-learn KMeans, n_init = 10, random_state = 0) for k = 6..12; k chosen by
   the highest mean silhouette on a deterministic 1-in-20 sample of complete cells. Interpretable baseline:
   the Koeppen-Geiger classes already in ASTERRO (tai-ext-context-1.0.0). Agreement is reported as adjusted Rand
   index and normalised mutual information, against the 5 main groups (A, B, C, D, E) and the 30 classes.
2. Anomaly detection: IsolationForest (n_estimators = 300, max_samples = 4096, random_state = 0). Score = the negated
   sklearn score_samples, so higher = more isolated. Interpretable baseline: mean distance to the 16 nearest
   neighbours in the same standardised space. Agreement is reported as Spearman rank correlation.
3. Hidden combination: a cell in the top 2 % of anomaly scores whose every feature lies within 2 standard deviations
   of the mean. Each value is ordinary on its own; the combination is rare. This is a pattern for inspection, not a
   discovery claim.

Labels are statistical groupings of 12 coarse variables. They do not identify landforms, rock types or ecosystems.
"""
import json, os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VERSION = "tai-v17-ml-1.0.0"
BASE = ["aridity", "annual_temperature_range", "elevation", "slope", "surface_roughness", "lst_diurnal_range",
        "lst_day_k", "lst_night_k", "t2m_mean_c"]
EXTRA = ["freeze_months", "dry_months", "precip_cv"]
K_RANGE = range(6, 13)


def koppen_codes(n):
    import base64
    cx = json.load(open(os.path.join(ROOT, "public/data/ext/context_ext.json")))
    codes = np.frombuffer(base64.b64decode(cx["koppen_b64"]), dtype=np.uint8)
    assert len(codes) == n
    names = cx["koppen_classes"]
    main = np.array([("ABCDE".index(names[c][0]) if c != 255 else 255) for c in codes])
    return codes, main


def compute(feat):
    import sklearn
    from sklearn.cluster import KMeans
    from sklearn.ensemble import IsolationForest
    from sklearn.metrics import silhouette_score, adjusted_rand_score, normalized_mutual_info_score
    from scipy.spatial import cKDTree
    from scipy.stats import spearmanr
    s = np.load(os.path.join(ROOT, "data/predictor_stack.npz")); v = s["valid"]
    cols = [s[c][v].astype(np.float64) for c in BASE] + [feat[c] for c in EXTRA]
    X = np.stack(cols, 1)
    ok = np.all(np.isfinite(X), 1)
    mu, sd = X[ok].mean(0), X[ok].std(0)
    Z = (X - mu) / sd
    Zc = Z[ok]
    sample = np.arange(0, len(Zc), 20)
    sil = {}
    models = {}
    for k in K_RANGE:
        km = KMeans(n_clusters=k, n_init=10, random_state=0).fit(Zc)
        models[k] = km
        sil[k] = float(silhouette_score(Zc[sample], km.labels_[sample]))
    kbest = max(sil, key=lambda k: (sil[k], -k))
    km = models[kbest]
    labels = np.full(len(X), 255, dtype=np.uint8); labels[ok] = km.labels_
    centers = km.cluster_centers_ * sd + mu
    codes, main = koppen_codes(len(X))
    m = ok & (codes != 255)
    agree = {"n_cells": int(m.sum()),
             "ari_main_groups": float(adjusted_rand_score(main[m], labels[m])),
             "nmi_main_groups": float(normalized_mutual_info_score(main[m], labels[m])),
             "ari_30_classes": float(adjusted_rand_score(codes[m], labels[m])),
             "nmi_30_classes": float(normalized_mutual_info_score(codes[m], labels[m]))}
    iso = IsolationForest(n_estimators=300, max_samples=4096, random_state=0).fit(Zc)
    an = np.full(len(X), np.nan); an[ok] = -iso.score_samples(Zc)
    d, _ = cKDTree(Zc).query(Zc, k=17)
    knn = np.full(len(X), np.nan); knn[ok] = d[:, 1:].mean(1)
    rho = float(spearmanr(an[ok], knn[ok]).statistic)
    thr = float(np.percentile(an[ok], 98))
    hidden = ok & (an >= thr) & np.all(np.abs(np.nan_to_num(Z)) < 2.0, 1)
    sizes = np.bincount(km.labels_, minlength=kbest).tolist()
    return dict(labels=labels, anomaly=an, knn=knn, hidden=hidden, kbest=kbest, silhouette=sil, agree=agree,
                spearman_if_knn=rho, anomaly_p98=thr, centers=centers.tolist(), sizes=sizes, features=BASE + EXTRA,
                mean=mu.tolist(), sd=sd.tolist(), complete=int(ok.sum()), sklearn=sklearn.__version__)


if __name__ == "__main__":
    from src.v17 import features
    _, f = features.compute()
    r = compute(f)
    print(r["kbest"], r["silhouette"], r["agree"], r["spearman_if_knn"], int(r["hidden"].sum()), r["sizes"])
