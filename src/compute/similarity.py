"""Deterministic weighted, range-normalized similarity (the ONLY scoring mechanism).

For each criterion c with weight w_c > 0 and a non-null target value t_c:
    d_c = |e_c - t_c| / (max_c - min_c)                    normalized difference
    s_c = clip(1 - d_c, 0, 1)                               criterion similarity
    k_c = w_c * s_c / W                                     weighted contribution
    S   = sum_c k_c                                         final score in [0, 1]
with W = sum of w_c over the criteria that are ACTIVE (w_c > 0, target not null) AND have a
finite Earth value in that cell. Criteria with null targets (not applicable to that body) or
weight 0 are excluded everywhere. A cell missing an Earth value for an active criterion is
scored on the remaining criteria, and its weight coverage C = W / sum_active(w) is reported;
cells with C < MIN_COVERAGE are not eligible for ranking. No learned or generative component.
"""
import numpy as np

MIN_COVERAGE = 0.80


def active_criteria(target_vector, weights):
    return [c for c, w in weights.items()
            if w is not None and float(w) > 0 and target_vector.get(c) is not None]


def similarity(earth_stack, target_vector, weights, ranges):
    """earth_stack: {criterion: array}; target_vector: {criterion: float|None};
    weights: {criterion: float >= 0}; ranges: {criterion: [min, max]}."""
    for c, w in weights.items():
        if w is None:
            continue
        if not np.isfinite(float(w)):
            raise ValueError(f"non-finite weight for {c}")
        if float(w) < 0:
            raise ValueError(f"negative weight for {c}")
    act = active_criteria(target_vector, weights)
    if not act:
        raise ValueError("no active criteria: all weights are zero or targets null")
    total_w = float(sum(float(weights[c]) for c in act))
    shape = np.shape(earth_stack[act[0]])
    wsum = np.zeros(shape, dtype=np.float64)
    num = np.zeros(shape, dtype=np.float64)
    sim, diff = {}, {}
    for c in act:
        lo, hi = ranges[c]
        if not (np.isfinite(lo) and np.isfinite(hi) and hi > lo):
            raise ValueError(f"undefined normalization range for {c}: {ranges[c]}")
        e = np.asarray(earth_stack[c], dtype=np.float64)
        e = np.where(np.isfinite(e), e, np.nan)          # NaN or +/-inf Earth value = missing, never scored
        d = np.abs(e - float(target_vector[c])) / (hi - lo)
        s = np.clip(1.0 - d, 0.0, 1.0)
        ok = np.isfinite(s)
        diff[c], sim[c] = d, s
        wsum = wsum + np.where(ok, float(weights[c]), 0.0)
        num = num + np.where(ok, float(weights[c]) * np.nan_to_num(s), 0.0)
    with np.errstate(invalid="ignore", divide="ignore"):
        final = np.where(wsum > 0, num / wsum, np.nan)
        contrib = {c: np.where(np.isfinite(sim[c]) & (wsum > 0), float(weights[c]) * sim[c] / wsum, np.nan)
                   for c in act}
    coverage = wsum / total_w
    return dict(final=final, criterion_similarity=sim, normalized_difference=diff,
                weighted_contribution=contrib, active=act, weight_sum=total_w,
                coverage=coverage, eligible=coverage >= MIN_COVERAGE - 1e-12)


def classify(s, match=0.85, partial=0.60):
    """Documented thresholds -> MATCH / PARTIAL / MISMATCH."""
    return "MATCH" if s >= match else ("PARTIAL" if s >= partial else "MISMATCH")


def effective_scores(result):
    """Ranking key: final score for eligible cells, -1 for ineligible / undefined cells."""
    f = result["final"]
    return np.where(result["eligible"] & np.isfinite(f), f, -1.0)


def cross_planet(effective_a, effective_b):
    """Cross-planet ranking key: the MINIMUM of the two per-target effective scores, so a cell ranks
    high only if it is similar to BOTH targets. A cell ineligible for either target (-1) stays -1."""
    a, b = np.asarray(effective_a, dtype=np.float64), np.asarray(effective_b, dtype=np.float64)
    return np.where((a < 0) | (b < 0), -1.0, np.minimum(a, b))
