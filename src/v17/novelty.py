"""Candidate novelty indicator (tai-v17-novelty-1.0.0). Deterministic; recomputed from retained inputs.

Novelty is NOT scientific importance and NOT a discovery claim. It describes how a cell sits relative to (a) the
whole valid Earth search space and (b) the list of frequently cited analogue sites in data/ext/known_analogues.json
(compiled from general knowledge, approximate centres; not a literature review).

Feature space: the six baseline conditions, each scaled to [0, 1] with the engine's published ranges
(public/data/app.json "ranges"), Euclidean distance. A cell with any of the six missing gets class "insufficient"
and no component values: missing data never makes a cell look novel.

Components (per valid cell)
  uniqueness_pct     percentile (0-100) of the mean distance to the K = 16 nearest other cells in feature space.
                     High = few cells anywhere on Earth have a similar combination of the six conditions.
  known_km           great-circle distance to the nearest listed analogue site (km).
  known_env_pct      percentile of the feature distance to the nearest listed site's own cell (the valid cell
                     closest to the site's coordinates). High = environmentally unlike every listed site.
Classes
  insufficient       one or more of the six conditions missing
  near_listed        within 300 km of a listed site (the list's own radius)
  outside_similar    farther than 300 km, environment like a listed site (known_env_pct < 50)
  outside_distinct   farther than 300 km, environment unlike every listed site (known_env_pct >= 50)
  outside_rare       outside_distinct and uniqueness_pct >= 90
"""
import json, os
import numpy as np
from scipy.spatial import cKDTree

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VERSION = "tai-v17-novelty-1.0.0"
CRIT = ["aridity", "annual_temperature_range", "elevation", "slope", "surface_roughness", "lst_diurnal_range"]
K = 16
RADIUS_KM = 300
CLASSES = ["insufficient", "near_listed", "outside_similar", "outside_distinct", "outside_rare"]


def haversine_km(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi, dl = p2 - p1, np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * 6371.0088 * np.arcsin(np.sqrt(np.minimum(1, a)))


def pct_rank(x):
    """Percentile rank 0-100 of each finite value (ties share the mean rank); NaN stays NaN."""
    out = np.full(x.shape, np.nan); f = np.isfinite(x)
    from scipy.stats import rankdata
    out[f] = (rankdata(x[f]) - 1) / max(1, f.sum() - 1) * 100
    return out


def compute():
    s = np.load(os.path.join(ROOT, "data/predictor_stack.npz")); v = s["valid"]
    ranges = json.load(open(os.path.join(ROOT, "public/data/app.json")))["ranges"]
    X = np.stack([(s[c][v].astype(np.float64) - ranges[c][0]) / (ranges[c][1] - ranges[c][0]) for c in CRIT], 1)
    complete = np.all(np.isfinite(X), 1)
    idx = np.flatnonzero(v.ravel())
    lat = -90 + 0.5 * (idx // 576); lon = -180 + 0.625 * (idx % 576)
    n = len(idx)
    uniq = np.full(n, np.nan)
    Xc = X[complete]
    tree = cKDTree(Xc)
    d, _ = tree.query(Xc, k=K + 1)
    uniq[complete] = d[:, 1:].mean(1)
    sites = json.load(open(os.path.join(ROOT, "data/ext/known_analogues.json")))["sites"]
    site_cells = []
    for st in sites:
        dk = haversine_km(st["lat"], st["lon"], lat, lon)
        dk[~complete] = np.inf
        j = int(np.argmin(dk))
        site_cells.append({"id": st["id"], "cell_index": j, "offset_km": round(float(dk[j]), 1)})
    known_km = np.min(np.stack([haversine_km(st["lat"], st["lon"], lat, lon) for st in sites]), 0)
    S = np.stack([X[sc["cell_index"]] for sc in site_cells])
    env = np.full(n, np.nan)
    env[complete] = np.min(np.linalg.norm(Xc[:, None, :] - S[None, :, :], axis=2), 1)
    up, ep = pct_rank(uniq), pct_rank(env)
    cls = np.zeros(n, dtype=np.uint8)
    cls[complete & (known_km <= RADIUS_KM)] = 1
    out = complete & (known_km > RADIUS_KM)
    cls[out & (ep < 50)] = 2
    cls[out & (ep >= 50)] = 3
    cls[out & (ep >= 50) & (up >= 90)] = 4
    return dict(uniqueness_pct=up, known_env_pct=ep, known_km=known_km, cls=cls, complete=complete,
                site_cells=site_cells, uniq_raw=uniq)


if __name__ == "__main__":
    r = compute()
    print({c: int((r["cls"] == k).sum()) for k, c in enumerate(CLASSES)})
    print(r["site_cells"][:3])
