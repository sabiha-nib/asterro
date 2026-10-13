"""Phase II reference implementation (Python) of the Research Laboratory analyses.

Independent of the browser module app/frontend/phase2/lab_engine.js; the two are compared by
tests/phase2/test_phase2_parity.py. Scores always come from the UNCHANGED baseline engine
src.compute.similarity.similarity(); this module only re-runs it with explicitly different,
recorded inputs and summarises the results.
"""
import json, math
import numpy as np
from src.compute.similarity import similarity, effective_scores, cross_planet
from src.compute.ranking import order, cell_ranks, distinct_sites, haversine_km

VERSION = "asterro-phase2-0.1.0"
BOUNDS = dict(factor=(0.1, 10), topPct=(0.1, 5), stableFrac=(0.8, 1), moderateFrac=(0.3, 0.95),
              samples=(10, 2000), logRange=(0.1, 2), topN=(5, 500))


# ----------------------------------------------------------------------------- canonical JSON
def _num(x):
    if isinstance(x, bool):
        return "true" if x else "false"
    if isinstance(x, int):
        return str(x)
    x = float(x)
    if not math.isfinite(x):
        return "null"
    if x == int(x) and abs(x) < 2 ** 53:
        return str(int(x))
    r = repr(x)                                   # shortest round-trip, as JavaScript
    if "e" in r:                                  # JS exponent format: 1e-7, 1.5e+21
        m, e = r.split("e")
        e = int(e)
        if -7 < e < 21:                           # JS writes these positionally
            from decimal import Decimal
            return format(Decimal(r), "f")
        r = f"{m}e{'+' if e > 0 else '-'}{abs(e)}"
    return r


def canonical(v):
    if v is None:
        return "null"
    if isinstance(v, (bool, int, float, np.integer, np.floating)):
        return _num(v.item() if hasattr(v, "item") else v)
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, (list, tuple, np.ndarray)):
        return "[" + ",".join(canonical(x) for x in (v.tolist() if isinstance(v, np.ndarray) else v)) + "]"
    if isinstance(v, dict):
        return "{" + ",".join(json.dumps(k, ensure_ascii=False) + ":" + canonical(v[k]) for k in sorted(v)) + "}"
    raise TypeError(type(v))


# ----------------------------------------------------------------------------- seeded sampler
def mulberry32(seed):
    a = seed & 0xFFFFFFFF

    def imul(x, y):
        return ((x & 0xFFFFFFFF) * (y & 0xFFFFFFFF)) & 0xFFFFFFFF

    def nxt():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = imul(t ^ (t >> 15), t | 1)
        t = (t ^ ((t + imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return nxt


def _bound(name, v):
    lo, hi = BOUNDS[name]
    if not (isinstance(v, (int, float)) and math.isfinite(v) and lo <= v <= hi):
        raise ValueError(f"{name} = {v} outside documented bounds [{lo}, {hi}]")
    return v


# ----------------------------------------------------------------------------- designs
def design_factorial(base_w, act, crit, factors=(0.5, 1, 2)):
    for f in factors:
        _bound("factor", f)
    m, out = len(factors), []
    for code in range(m ** len(act)):
        w = {c: float(base_w.get(c, 0) or 0) for c in crit}
        x, fs = code, {}
        for c in act:
            fc = factors[x % m]; x //= m
            w[c] = float(base_w[c]) * fc; fs[c] = fc
        out.append(dict(id=f"F{code}", w=w, factors=fs))
    return out


def design_oat(base_w, act, crit, factors=(0.5, 2)):
    out = []
    for c in act:
        for f in factors:
            _bound("factor", f)
            w = {k: float(base_w.get(k, 0) or 0) for k in crit}
            w[c] = float(base_w[c]) * f
            out.append(dict(id=f"OAT:{c}x{_num(f)}", w=w, factors={c: f}, criterion=c, factor=f))
    return out


def design_sampled(base_w, act, crit, n, seed, log_range=1.0):
    _bound("samples", n); _bound("logRange", log_range)
    rnd, out = mulberry32(seed), []
    for q in range(n):
        w = {k: float(base_w.get(k, 0) or 0) for k in crit}
        fs = {}
        for c in act:
            u = (2 * rnd() - 1) * log_range
            fc = 2.0 ** u
            w[c] = float(base_w[c]) * fc; fs[c] = fc
        out.append(dict(id=f"S{q}", w=w, factors=fs))
    return out


def design_ablation(base_w, act, crit):
    out = []
    for c in act:
        w = {k: float(base_w.get(k, 0) or 0) for k in crit}
        w[c] = 0.0
        out.append(dict(id=f"ABL:{c}", w=w, removed=c))
    return out


# ----------------------------------------------------------------------------- scoring + ranks
def eff_for(E, targets, w, ranges):
    """targets: list of target variable dicts; one -> that target, two -> cross-planet min rule."""
    effs = [effective_scores(similarity(E, tv, w, ranges)) for tv in targets]
    return effs[0] if len(effs) == 1 else cross_planet(*effs)


def candidate_ranks(eff, cell, cand):
    eff = np.asarray(eff); cell = np.asarray(cell)
    return np.array([1 + int(np.count_nonzero((eff > eff[i]) | ((eff == eff[i]) & (cell < cell[i])))) for i in cand])


def run_design(E, targets, ranges, cell, cand, base_w, design):
    base = eff_for(E, targets, base_w, ranges)
    ranks = np.zeros((len(cand), len(design)), dtype=np.int64)
    scores = np.zeros((len(cand), len(design)))
    n_elig = np.zeros(len(design), dtype=np.int64)
    for q, d in enumerate(design):
        eff = eff_for(E, targets, d["w"], ranges)
        ranks[:, q] = candidate_ranks(eff, cell, cand)
        scores[:, q] = eff[cand]
        n_elig[q] = int(np.count_nonzero(eff >= 0))
    return dict(ranks=ranks, scores=scores, n_elig=n_elig, base_ranks=candidate_ranks(base, cell, cand),
                base_scores=base[cand], base_elig=int(np.count_nonzero(base >= 0)))


def quantile(sorted_vals, p):
    if not len(sorted_vals):
        return float("nan")
    r = max(1, math.ceil(p * len(sorted_vals)))
    return sorted_vals[min(len(sorted_vals), r) - 1]


def rank_stats(run, top_pct=1.0, top_n=20, stable_frac=0.95, moderate_frac=0.5, coverage=None):
    _bound("topPct", top_pct); _bound("topN", top_n); _bound("stableFrac", stable_frac); _bound("moderateFrac", moderate_frac)
    if moderate_frac >= stable_frac:
        raise ValueError("moderateFrac must be below stableFrac")
    out = []
    n_cfg = run["ranks"].shape[1]
    for c, rk in enumerate(run["ranks"]):
        arr = sorted(int(x) for x in rk)
        lim = np.maximum(1, np.floor(run["n_elig"] * top_pct / 100))
        frac_pct = float(np.mean(rk <= lim)) if n_cfg else float("nan")
        frac_n = float(np.mean(rk <= top_n)) if n_cfg else float("nan")
        if n_cfg < 10 or (coverage is not None and coverage[c] < 1 - 1e-12):
            cls = "INSUFFICIENT_EVIDENCE"
        elif frac_pct >= stable_frac:
            cls = "STABLE"
        elif frac_pct >= moderate_frac:
            cls = "MODERATELY_SENSITIVE"
        else:
            cls = "HIGHLY_SENSITIVE"
        out.append(dict(baseline=int(run["base_ranks"][c]), min=arr[0], max=arr[-1], median=quantile(arr, 0.5),
                        p25=quantile(arr, 0.25), p75=quantile(arr, 0.75), fracTopPct=frac_pct, fracTopN=frac_n,
                        n=n_cfg, cls=cls))
    return out


def pair_flips(run):
    k, n = run["ranks"].shape
    out = []
    for a in range(k):
        for b in range(a + 1, k):
            base_ab = run["base_ranks"][a] < run["base_ranks"][b]
            flips = int(np.count_nonzero((run["ranks"][a] < run["ranks"][b]) != base_ab))
            out.append(dict(a=a, b=b, flips=flips, frac=flips / n if n else float("nan")))
    return sorted(out, key=lambda x: (-x["frac"], x["a"], x["b"]))


def _rankavg(v):
    v = np.asarray(v, dtype=np.float64)
    idx = np.lexsort((np.arange(len(v)), v))
    r = np.empty(len(v)); i = 0
    while i < len(v):
        j = i
        while j + 1 < len(v) and v[idx[j + 1]] == v[idx[i]]:
            j += 1
        r[idx[i:j + 1]] = (i + j) / 2 + 1
        i = j + 1
    return r


def spearman_rho(x, y):
    if len(x) < 3:
        return float("nan")
    rx, ry = _rankavg(x), _rankavg(y)
    a, b = rx - rx.mean(), ry - ry.mean()
    d = math.sqrt(float((a * a).sum() * (b * b).sum()))
    return float((a * b).sum() / d) if d > 0 else float("nan")


def ablation(E, targets, ranges, cell, lat, lon, base_w, act, crit, n_distinct=20, sep=300.0, compare_top=1000):
    base = eff_for(E, targets, base_w, ranges)
    bo = order(base, cell); br = cell_ranks(base, cell)
    bd = distinct_sites(base, cell, lat, lon, n=n_distinct, min_sep_km=sep)
    top = bo[:compare_top]
    out = []
    for d in design_ablation(base_w, act, crit):
        try:
            eff = eff_for(E, targets, d["w"], ranges)
        except ValueError as e:
            out.append(dict(removed=d["removed"], error=str(e))); continue
        r = cell_ranks(eff, cell)
        ds = distinct_sites(eff, cell, lat, lon, n=n_distinct, min_sep_km=sep)
        out.append(dict(removed=d["removed"], top=int(ds[0]), distinct=[int(i) for i in ds],
                        overlap=len(set(ds) & set(bd)), rho=spearman_rho(br[top], r[top]),
                        baselineDistinctNewRanks=[int(r[i]) for i in bd], nElig=int(np.count_nonzero(eff >= 0))))
    return out


def pareto(points):
    """points: list of (id, [objective values]); maximisation; NaN -> not evaluable."""
    ok = [(i, v) for i, v in points if all(math.isfinite(x) for x in v)]
    bad = [i for i, v in points if not all(math.isfinite(x) for x in v)]
    front = []
    for i, v in ok:
        dom = any(all(b >= a for a, b in zip(v, u)) and any(b > a for a, b in zip(v, u)) for j, u in ok if j != i)
        if not dom:
            front.append(i)
    return dict(front=front, notEvaluable=bad, evaluated=len(ok))


# ----------------------------------------------------------------------------- temporal
def theil_sen(xs, ys):
    P = [(x, y) for x, y in zip(xs, ys) if y is not None and math.isfinite(y)]
    if len(P) < 3:
        return None
    sl = sorted((P[b][1] - P[a][1]) / (P[b][0] - P[a][0]) for a in range(len(P)) for b in range(a + 1, len(P)) if P[b][0] != P[a][0])
    m = len(sl)
    slope = sl[(m - 1) // 2] if m % 2 else (sl[m // 2 - 1] + sl[m // 2]) / 2
    ints = sorted(y - slope * x for x, y in P); n = len(ints)
    return dict(slope=slope, intercept=ints[(n - 1) // 2] if n % 2 else (ints[n // 2 - 1] + ints[n // 2]) / 2, n=len(P))


def mann_kendall(ys):
    v = [y for y in ys if y is not None and math.isfinite(y)]
    n = len(v)
    if n < 4:
        return None
    S = sum(np.sign(v[b] - v[a]) for a in range(n) for b in range(a + 1, n))
    from collections import Counter
    tie = sum(t * (t - 1) * (2 * t + 5) for t in Counter(v).values() if t > 1)
    var = (n * (n - 1) * (2 * n + 5) - tie) / 18
    z = 0.0 if var <= 0 else ((S - 1) / math.sqrt(var) if S > 0 else ((S + 1) / math.sqrt(var) if S < 0 else 0.0))
    p = 2 * (1 - 0.5 * (1 + math.erf(abs(z) / math.sqrt(2))))
    return dict(S=float(S), varS=var, z=z, p=p, n=n, tau=float(S) / (n * (n - 1) / 2))


def harmonic(m12):
    m12 = list(m12)
    if len(m12) != 12 or not all(math.isfinite(x) for x in m12):
        return None
    mean = sum(m12) / 12
    th = [2 * math.pi * (k + 0.5) / 12 for k in range(12)]
    a = sum((m12[k] - mean) * math.cos(th[k]) * 2 / 12 for k in range(12))
    b = sum((m12[k] - mean) * math.sin(th[k]) * 2 / 12 for k in range(12))
    amp = math.hypot(a, b)
    phase = (math.atan2(b, a) / (2 * math.pi) * 12 - 0.5) % 12
    ss = sum((x - mean) ** 2 for x in m12)
    sr = sum((m12[k] - (mean + a * math.cos(th[k]) + b * math.sin(th[k]))) ** 2 for k in range(12))
    return dict(mean=mean, amplitude=amp, peakMonth=phase, varianceExplained=1 - sr / ss if ss > 0 else float("nan"))


# ----------------------------------------------------------------------------- requirements
def evaluate_requirement(req, i, registry, A, cell_size_km=None, area_km2=None, index=None, cell=None):
    """Cell-level evaluation; mirrors AsterroLab.evaluateRequirement (area/resolution/years)."""
    V = registry[req["variable"]]
    v = float(A[V["field"]][i])
    if not math.isfinite(v):
        return dict(status="CANNOT", value=None)
    op, x = req["op"], req["value"]
    ok = v <= x if op == "<=" else (v >= x if op == ">=" else x[0] <= v <= x[1])
    status = "MEETS" if ok else "FAILS"
    if req.get("minAreaKm2") is not None and ok:
        km2, cells = connected_area(i, lambda k: _test(op, float(A[V["field"]][k]), x), A, area_km2, index, cell)
        if km2 < req["minAreaKm2"]:
            status = "FAILS"
    if req.get("requiredResolutionKm") is not None and max(cell_size_km(i)) > req["requiredResolutionKm"]:
        status = "PARTIAL"
    if req.get("requiredYears") is not None:
        if V["years"] is None or V["years"] < req["requiredYears"]:
            status = "PARTIAL"
    return dict(status=status, value=v)


def _test(op, v, x):
    if not math.isfinite(v):
        return False
    return v <= x if op == "<=" else (v >= x if op == ">=" else x[0] <= v <= x[1])


def connected_area(i, test, A, area_km2, index, cell, nlon=576, max_cells=20000):
    seen, q, km2, cells = {i}, [i], 0.0, 0
    while q and cells < max_cells:
        k = q.pop(0); cells += 1; km2 += area_km2(k)
        row, col = divmod(int(cell[k]), nlon)
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if not dr and not dc:
                    continue
                rr = row + dr
                if rr < 0 or rr > 360:
                    continue
                j = int(index[rr * nlon + (col + dc) % nlon])
                if j >= 0 and j not in seen:
                    seen.add(j)
                    if test(j):
                        q.append(j)
    return km2, cells
