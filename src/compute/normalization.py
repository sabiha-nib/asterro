"""Normalization ranges.

For each criterion c the range is [min, max] over the union of
  (a) every valid Earth cell in the predictor stack and
  (b) every non-null target value in data/targets.json.
Including the targets guarantees that a target lying beyond Earth's range still produces a
finite, interpretable similarity for the closest Earth cells instead of collapsing to 0.
"""
import numpy as np


def compute_ranges(earth, targets, criteria):
    ranges = {}
    for c in criteria:
        vals = [float(np.nanmin(earth[c])), float(np.nanmax(earth[c]))]
        for t in targets:
            v = t["variables"].get(c)
            if v is not None:
                vals.append(float(v))
        lo, hi = min(vals), max(vals)
        if hi <= lo:
            raise ValueError(f"degenerate range for {c}")
        ranges[c] = [lo, hi]
    return ranges


def normalize(values, rng):
    lo, hi = rng
    return (np.asarray(values, dtype=np.float64) - lo) / (hi - lo)
