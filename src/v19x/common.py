"""Shared helpers for the V19 data extension (tai-v19-data): grid, cell order, hashing, raw-file access.

The ASTERRO grid is the NASA POWER / MERRA-2 native grid: 361 rows (90 S .. 90 N, 0.5 deg) x 576 columns
(180 W .. 179.375 E, 0.625 deg). Cell id = row * 576 + column. The app's per-cell arrays follow the order of
the valid land cells (np.flatnonzero of the stack's valid mask), exactly as data/predictor_stack.npz.
"""
import gzip, hashlib, json, os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "data", "v19", "raw")
NLAT, NLON = 361, 576
VERSION = "tai-v19-data-2.0.0"


def p(*a):
    return os.path.join(ROOT, *a)


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def sha256_text(t):
    return hashlib.sha256(t.encode("utf-8")).hexdigest()


def load_raw(rel):
    path = os.path.join(RAW, rel)
    if rel.endswith(".gz"):
        return json.load(gzip.open(path, "rt", encoding="utf-8"))
    return json.load(open(path, encoding="utf-8"))


def valid_cells():
    """Cell ids of the valid land cells, in the app's order."""
    v = np.load(p("data", "predictor_stack.npz"))["valid"]
    return np.flatnonzero(v.ravel())


def cell_of(lat, lon):
    """Grid cell id of a grid-point coordinate; raises if the point is not on the grid."""
    r = (lat + 90.0) / 0.5
    c = (lon + 180.0) / 0.625
    ri, ci = int(round(r)), int(round(c))
    if abs(r - ri) > 1e-6 or abs(c - ci) > 1e-6:
        raise ValueError(f"point {lat},{lon} is not on the 0.5 x 0.625 grid")
    return ri * NLON + (ci % NLON)


def cell_centres(cells):
    cells = np.asarray(cells)
    return -90.0 + 0.5 * (cells // NLON), -180.0 + 0.625 * (cells % NLON)


def haversine_km(la1, lo1, la2, lo2):
    r = np.pi / 180
    p1, p2 = np.asarray(la1) * r, np.asarray(la2) * r
    a = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin((np.asarray(lo2) - np.asarray(lo1)) * r / 2) ** 2
    return 2 * 6371.0088 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))
