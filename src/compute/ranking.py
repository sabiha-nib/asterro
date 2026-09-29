"""Deterministic ranking.

cell_ranks : rank of every valid cell by score (descending); ties broken by ascending cell id.
distinct_sites : greedy non-maximum suppression -- walk the ranked list and keep a cell only if
                 it lies >= min_sep_km (great-circle) from every site already kept. This turns
                 blobs of adjacent near-identical cells into geographically distinct candidates.
"""
import numpy as np

R_EARTH_KM = 6371.0088


def order(scores, cell_ids):
    # lexsort: last key is primary -> (-score) primary, cell id secondary
    return np.lexsort((np.asarray(cell_ids), -np.asarray(scores, dtype=np.float64)))


def cell_ranks(scores, cell_ids):
    o = order(scores, cell_ids)
    r = np.empty(len(o), dtype=np.int64)
    r[o] = np.arange(1, len(o) + 1)
    return r


def haversine_km(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dp, dl = p2 - p1, np.radians(np.asarray(lon2) - np.asarray(lon1))
    a = np.sin(dp / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * R_EARTH_KM * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def distinct_sites(scores, cell_ids, lat, lon, n=20, min_sep_km=300.0):
    o = order(scores, cell_ids)
    kept = []
    for i in o:
        if kept:
            d = haversine_km(lat[i], lon[i], lat[kept], lon[kept])
            if np.min(d) < min_sep_km:
                continue
        kept.append(int(i))
        if len(kept) == n:
            break
    return kept
