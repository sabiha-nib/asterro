"""Analogue constellations: deterministic clustering of the highest-similarity cells.

Candidates : the N_CANDIDATES = 800 highest-scoring eligible cells (~1 % of valid land cells),
             ordered by score then cell id.
Space      : active criteria, range-normalized to [0, 1]; a missing value is replaced by the
             candidate-set column mean for clustering only.
Algorithm  : k-means (Lloyd, 100 iterations max) with deterministic farthest-point
             initialisation seeded at the highest-scoring candidate; k in {3, 4, 5} chosen by
             maximum mean silhouette. No random numbers anywhere -> identical output every run.
Naming     : generated ONLY from cluster statistics with fixed, documented thresholds
             (see describe()). No language model is involved.
"""
import numpy as np

K_CHOICES = (3, 4, 5)
N_CANDIDATES = 800


def farthest_point_init(X, k, first):
    idx = [first]
    d = np.sum((X - X[first]) ** 2, axis=1)
    for _ in range(1, k):
        nxt = int(np.argmax(d))          # argmax returns first max -> deterministic
        idx.append(nxt)
        d = np.minimum(d, np.sum((X - X[nxt]) ** 2, axis=1))
    return X[idx].copy()


def kmeans(X, k, first, iters=100):
    C = farthest_point_init(X, k, first)
    lab = np.zeros(len(X), dtype=np.int64)
    for _ in range(iters):
        D = ((X[:, None, :] - C[None, :, :]) ** 2).sum(-1)
        new = np.argmin(D, axis=1)
        if _ > 0 and np.array_equal(new, lab):
            break
        lab = new
        for j in range(k):
            m = lab == j
            if m.any():
                C[j] = X[m].mean(axis=0)
    return lab, C


def silhouette(X, lab):
    D = np.sqrt(((X[:, None, :] - X[None, :, :]) ** 2).sum(-1))
    ks = np.unique(lab)
    s = np.zeros(len(X))
    for i in range(len(X)):
        own = lab == lab[i]
        n_own = own.sum() - 1
        if n_own == 0:
            s[i] = 0.0
            continue
        a = D[i, own].sum() / n_own
        b = min(D[i, lab == j].mean() for j in ks if j != lab[i])
        s[i] = (b - a) / max(a, b) if max(a, b) > 0 else 0.0
    return float(s.mean())


def aridity_class(ai):
    # UNEP (1997) aridity classes
    return ("Hyper-arid" if ai < 0.05 else "Arid" if ai < 0.20 else
            "Semi-arid" if ai < 0.50 else "Dry sub-humid" if ai < 0.65 else "Humid")


def thermal_class(t2m_mean_c):
    return "Cold" if t2m_mean_c < 0 else ("Temperate" if t2m_mean_c < 18 else "Hot")


def terrain_class(slope_deg, elev_m):
    relief = "plains" if slope_deg < 2 else ("rolling terrain" if slope_deg < 6 else "rugged terrain")
    return ("high-altitude " + relief) if elev_m >= 3000 else relief


def describe(stats):
    """stats: dict of cluster means in physical units (aridity, t2m_mean_c, slope, elevation).
    aridity may be NaN (Hargreaves PET undefined, e.g. ice sheets) -> the aridity term is omitted."""
    ar = stats.get("aridity")
    mid = "" if ar is None or not np.isfinite(ar) else aridity_class(ar).lower() + " "
    return f"{thermal_class(stats['t2m_mean_c'])} {mid}{terrain_class(stats['slope'], stats['elevation'])}"


def constellations(scores, norm_matrix, cell_ids):
    """scores: (N,), norm_matrix: (N, C) normalized active criteria. Returns candidate idx, labels, k."""
    o = np.lexsort((np.asarray(cell_ids), -np.asarray(scores, dtype=np.float64)))
    cand = o[:N_CANDIDATES]                               # ordered: best first (deterministic)
    thr = float(scores[cand[-1]])
    X = np.array(norm_matrix[cand], dtype=np.float64)
    # Missing normalized values -> candidate-set column mean (clustering only; never affects scores)
    col = np.nanmean(np.where(np.isfinite(X), X, np.nan), axis=0)
    col = np.where(np.isfinite(col), col, 0.5)
    X = np.where(np.isfinite(X), X, col[None, :])
    best = None
    for k in K_CHOICES:
        if len(X) <= k:
            continue
        lab, C = kmeans(X, k, first=0)
        sil = silhouette(X, lab)
        if best is None or sil > best[0] + 1e-12:
            best = (sil, k, lab)
    sil, k, lab = best
    return dict(candidates=cand, labels=lab, k=k, silhouette=sil, threshold=float(thr))
