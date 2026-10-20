/* ASTERRO — Mismatch Signature engine and Method Arena (browser + Node).
 *
 * MISMATCH SIGNATURES. For a target vector t, weights w and normalisation ranges R, every Earth cell gets a signed,
 * range-normalised difference per active criterion, δ_c = (e_c − t_c) / (max_c − min_c), the same quantity the
 * baseline turns into s_c = clip(1 − |δ_c|, 0, 1). The signature discretises δ_c with the baseline's own class
 * thresholds (match s ≥ 0.85 ⇔ |δ| ≤ 0.15; partial s ≥ 0.60 ⇔ |δ| ≤ 0.40):
 *     ≈  |δ| ≤ 0.15        +/−  0.15 < |δ| ≤ 0.40 (Earth higher / lower)        ++/−−  |δ| > 0.40
 *     ?  Earth value missing in this cell          (criteria with weight 0 or no target value are not part of it)
 * Cells with the same signature fail to match the target IN THE SAME WAY: a "mismatch family". Families are an
 * exact partition (no clustering parameters). The "Earth ceiling" reports, per criterion, the best similarity any
 * Earth cell reaches — a structural limit that no weighting can remove.
 *
 * METHOD ARENA. Alternative scoring methods beside the unchanged baseline (named "baseline"); each is deterministic
 * and tested. They change the scoring RULE, never the data:
 *   baseline   S = Σ w_c s_c / Σ w_c over criteria with an Earth value; eligible if coverage ≥ 0.80 (tai-sim-1.0.0)
 *   quantile   s_c = 1 − |F_c(e) − F_c(t)|, F_c = mid-rank empirical CDF of the valid Earth cells (robust to range
 *              outliers; a target outside Earth's range maps to F = 0 or 1); same weighted mean and coverage rule
 *   minimum    S = min_c s_c over the active criteria with an Earth value (non-compensatory: one poor criterion
 *              caps the score; weights only select the criteria); same coverage rule
 *   strict     baseline formula, but a cell is eligible only if EVERY active criterion has an Earth value
 * Agreement between methods is reported (Spearman ρ over cells eligible under both, leading-site overlap,
 * top-100 Jaccard). Agreement between two methods does not show that either is scientifically correct.
 */
(function (root) {
  "use strict";
  const LAB = root.AsterroLab || (typeof require === "function" ? require("../phase2/lab_engine.js") : null);
  const VERSION = "asterro-methods-1.0.0";
  const MIN_COVERAGE = 0.80;
  const CODES = { "≈": "within the match threshold (|δ| ≤ 0.15)", "+": "Earth moderately higher (0.15 < δ ≤ 0.40)", "−": "Earth moderately lower", "++": "Earth much higher (δ > 0.40)", "−−": "Earth much lower", "?": "no Earth value in this cell" };
  const METHODS = {
    baseline: { label: "Baseline (tai-sim-1.0.0)", rule: "S = Σ w·s / Σw over criteria with an Earth value; s = clip(1 − |e − t| / (max − min)); coverage ≥ 0.80", note: "The authoritative ASTERRO score; unchanged." },
    quantile: { label: "Quantile-normalised", rule: "s = 1 − |F(e) − F(t)|, F = mid-rank empirical CDF over valid Earth cells; same weighted mean and coverage rule", note: "Insensitive to extreme range end-points (e.g. roughness to 1,500 m); a difference counts by how much of Earth lies between the two values. A target outside Earth's range maps to F = 0 or 1." },
    minimum: { label: "Non-compensatory minimum", rule: "S = min over active criteria with an Earth value of s (baseline s); coverage ≥ 0.80", note: "A strong match on some criteria cannot hide a poor match on another. Weights only select which criteria are active." },
    strict: { label: "Strict coverage", rule: "Baseline formula; eligible only if every active criterion has an Earth value", note: "Removes cells whose score rests on renormalised partial data." },
  };

  function activeOf(critIds, tv, w) { return critIds.filter(c => tv[c] != null && w[c] != null && +w[c] > 0); }

  /* ------------------------------------------------------------------ signatures */
  function code(d, thr) {
    if (d == null || d !== d) return "?";
    const a = Math.abs(d), m = 1 - thr.match, p = 1 - thr.partial;
    return a <= m + 1e-12 ? "≈" : a <= p + 1e-12 ? (d > 0 ? "+" : "−") : (d > 0 ? "++" : "−−");
  }
  function signatureOf(A, critIds, tv, w, ranges, i, thr) {
    return activeOf(critIds, tv, w).map(c => {
      const e = A[c][i], span = ranges[c][1] - ranges[c][0];
      const d = e - e === 0 ? (e - +tv[c]) / span : null;
      return { criterion: c, delta: d, code: code(d, thr), s: d == null ? null : Math.max(0, Math.min(1, 1 - Math.abs(d))), earth: d == null ? null : +e, target: +tv[c] };
    });
  }
  const keyOf = sig => sig.map(x => x.code).join("|");
  function haversine(la1, lo1, la2, lo2) {
    const r = Math.PI / 180, p1 = la1 * r, p2 = la2 * r, dp = p2 - p1, dl = (lo2 - lo1) * r;
    let a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    a = a < 0 ? 0 : (a > 1 ? 1 : a);
    return 2 * 6371.0088 * Math.asin(Math.sqrt(a));
  }
  function distinctOf(list, eff, cell, lat, lon, n, sep = 300) {
    const o = list.slice().sort((a, b) => (eff[b] - eff[a]) || (cell[a] - cell[b])), kept = [];
    for (const i of o) { if (kept.length >= n) break; if (kept.every(j => haversine(lat[i], lon[i], lat[j], lon[j]) >= sep)) kept.push(i); }
    return kept;
  }
  /* exact partition of the eligible cells by signature */
  function families({ A, critIds, tv, w, ranges, eff, cell, lat, lon, thr, sites = 5, sep = 300 }) {
    const act = activeOf(critIds, tv, w), spans = act.map(c => ranges[c][1] - ranges[c][0]), by = new Map();
    let nElig = 0;
    for (let i = 0; i < eff.length; i++) {
      if (!(eff[i] >= 0)) continue; nElig++;
      let k = "";
      for (let j = 0; j < act.length; j++) { const e = A[act[j]][i]; k += (j ? "|" : "") + code(e - e === 0 ? (e - +tv[act[j]]) / spans[j] : null, thr); }
      let f = by.get(k); if (!f) { f = { key: k, cells: [], sum: 0 }; by.set(k, f); }
      f.cells.push(i); f.sum += eff[i];
    }
    const out = [];
    for (const f of by.values()) {
      const best = f.cells.reduce((b, i) => (b == null || eff[i] > eff[b] || (eff[i] === eff[b] && cell[i] < cell[b])) ? i : b, null);
      out.push({ key: f.key, codes: f.key.split("|"), size: f.cells.length, share: f.cells.length / nElig, best, bestScore: eff[best], meanScore: f.sum / f.cells.length,
        nMatch: f.key.split("|").filter(x => x === "≈").length, sites: distinctOf(f.cells, eff, cell, lat, lon, sites, sep), cells: f.cells });
    }
    out.sort((a, b) => (b.bestScore - a.bestScore) || (b.size - a.size) || (a.key < b.key ? -1 : 1));
    return { criteria: act, families: out, nEligible: nElig, nFamilies: out.length };
  }
  /* best similarity any valid Earth cell reaches on each active criterion (independent of weights) */
  function ceiling({ A, critIds, tv, w, ranges, thr }) {
    return activeOf(critIds, tv, w).map(c => {
      const e = A[c], span = ranges[c][1] - ranges[c][0], t = +tv[c];
      let lo = Infinity, hi = -Infinity, best = -1, nM = 0, nP = 0, nV = 0;
      for (let i = 0; i < e.length; i++) {
        const x = e[i]; if (x - x !== 0) continue; nV++;
        if (x < lo) lo = x; if (x > hi) hi = x;
        const s = Math.max(0, Math.min(1, 1 - Math.abs(x - t) / span)); if (s > best) best = s;
        if (s >= thr.match) nM++; if (s >= thr.partial) nP++;
      }
      const outside = t > hi ? "above" : t < lo ? "below" : null;
      return { criterion: c, target: t, earthMin: lo, earthMax: hi, bestS: best, cellsMatch: nM, cellsPartial: nP, cellsValid: nV, outside,
        /* "outside" alone is not a limit (a target just beyond the range can still be matched); structural = no cell within the match threshold */
        structural: nM === 0, text: nM === 0 ? (outside ? `Target ${outside} every valid Earth value (${lo.toFixed(2)}–${hi.toFixed(2)}); best s = ${best.toFixed(3)}.` : `No Earth cell within the match threshold; best s = ${best.toFixed(3)}.`)
          : `${nM} Earth cells within the match threshold${outside ? ` (target marginally ${outside} the Earth range)` : ""}.` };
    });
  }
  /* sites that fail in the same way as cell i (same family), and the nearest signatures by δ distance */
  function sameWay({ A, critIds, tv, w, ranges, eff, cell, lat, lon, thr, i, n = 10, sep = 300 }) {
    const sig = signatureOf(A, critIds, tv, w, ranges, i, thr), k = keyOf(sig), act = sig.map(x => x.criterion), spans = act.map(c => ranges[c][1] - ranges[c][0]);
    const same = [], dist = new Float64Array(eff.length).fill(Infinity);
    for (let j = 0; j < eff.length; j++) {
      if (!(eff[j] >= 0) || j === i) continue;
      let kk = "", ss = 0, ok = true;
      for (let q = 0; q < act.length; q++) {
        const e = A[act[q]][j], d = e - e === 0 ? (e - +tv[act[q]]) / spans[q] : null;
        kk += (q ? "|" : "") + code(d, thr);
        if (d == null || sig[q].delta == null) ok = false; else ss += (d - sig[q].delta) ** 2;
      }
      if (kk === k) same.push(j);
      if (ok) dist[j] = Math.sqrt(ss);
    }
    const near = [];
    { const o = []; for (let j = 0; j < eff.length; j++) if (dist[j] < Infinity) o.push(j); o.sort((a, b) => (dist[a] - dist[b]) || (cell[a] - cell[b]));
      for (const j of o) { if (near.length >= n) break; if (haversine(lat[i], lon[i], lat[j], lon[j]) < sep) continue; if (near.every(x => haversine(lat[j], lon[j], lat[x.i], lon[x.i]) >= sep)) near.push({ i: j, distance: dist[j], score: eff[j] }); } }
    return { signature: sig, key: k, sameFamily: distinctOf(same.filter(j => haversine(lat[i], lon[i], lat[j], lon[j]) >= sep), eff, cell, lat, lon, n, sep), familySize: same.length + 1, nearest: near };
  }

  /* ------------------------------------------------------------------ methods */
  const sortedCache = new WeakMap();
  function sortedFinite(arr) {
    let s = sortedCache.get(arr); if (s) return s;
    const v = []; for (let i = 0; i < arr.length; i++) { const x = arr[i]; if (x - x === 0) v.push(+x); }
    s = Float64Array.from(v).sort(); sortedCache.set(arr, s); return s;
  }
  function lowerBound(a, x) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m; } return lo; }
  function upperBound(a, x) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= x) lo = m + 1; else hi = m; } return lo; }
  function cdf(sorted, x) { return (lowerBound(sorted, x) + upperBound(sorted, x)) / (2 * sorted.length); }
  function validW(w, critIds) { for (const c of critIds) if (w[c] != null && !(Number.isFinite(+w[c]) && +w[c] >= 0)) throw new Error("invalid weight " + c); }

  function score(method, { A, critIds, tv, w, ranges, minCoverage = MIN_COVERAGE }) {
    if (!METHODS[method]) throw new Error("unknown method " + method);
    validW(w, critIds);
    const act = activeOf(critIds, tv, w); if (!act.length) throw new Error("no active criteria");
    if (method === "baseline") return LAB.fieldScore(LAB.prepare(A, critIds, tv, ranges), w).eff;
    const n = A[act[0]].length, num = new Float64Array(n), wsum = new Float64Array(n), mn = new Float64Array(n).fill(Infinity);
    let totalW = 0; for (const c of act) totalW += +w[c];
    for (const c of act) {
      const e = A[c], t = +tv[c], wc = +w[c];
      if (method === "quantile") {
        const S = sortedFinite(e), Ft = cdf(S, t);
        for (let i = 0; i < n; i++) { const x = e[i]; if (x - x !== 0) continue; const s = 1 - Math.abs(cdf(S, +x) - Ft); num[i] += wc * s; wsum[i] += wc; }
      } else {
        const lo = ranges[c][0], span = ranges[c][1] - ranges[c][0];
        if (!(Number.isFinite(lo) && Number.isFinite(span) && span > 0)) throw new Error("undefined normalization range " + c);
        for (let i = 0; i < n; i++) { const x = e[i]; if (x - x !== 0) continue; let s = 1 - Math.abs(x - t) / span; s = s < 0 ? 0 : (s > 1 ? 1 : s); num[i] += wc * s; wsum[i] += wc; if (s < mn[i]) mn[i] = s; }
      }
    }
    const eff = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const cov = wsum[i] / totalW, ok = method === "strict" ? cov >= 1 - 1e-12 : cov >= minCoverage - 1e-12;
      eff[i] = ok && wsum[i] > 0 ? (method === "minimum" ? mn[i] : num[i] / wsum[i]) : -1;
    }
    return eff;
  }
  function order(eff, cell) { const o = Array.from({ length: eff.length }, (_, i) => i); o.sort((a, b) => (eff[b] - eff[a]) || (cell[a] - cell[b])); return o; }
  function distinct(eff, cell, lat, lon, n = 20, sep = 300) {
    const o = order(eff, cell), kept = [];
    for (const i of o) { if (kept.length >= n || !(eff[i] >= 0)) break; if (kept.every(j => haversine(lat[i], lon[i], lat[j], lon[j]) >= sep)) kept.push(i); }
    return kept;
  }
  function rankArray(eff, cell) { const o = order(eff, cell), r = new Int32Array(eff.length); o.forEach((i, k) => { r[i] = eff[i] >= 0 ? k + 1 : 0; }); return r; }
  /* Spearman ρ over cells eligible under both methods (ranks re-derived within that common set; no ties by construction) */
  function spearman(effA, effB, cell) {
    const common = []; for (let i = 0; i < effA.length; i++) if (effA[i] >= 0 && effB[i] >= 0) common.push(i);
    const n = common.length; if (n < 3) return { rho: null, n };
    const rk = eff => { const o = common.slice().sort((a, b) => (eff[b] - eff[a]) || (cell[a] - cell[b])), r = new Map(); o.forEach((i, k) => r.set(i, k + 1)); return r; };
    const ra = rk(effA), rb = rk(effB); let d2 = 0;
    for (const i of common) { const d = ra.get(i) - rb.get(i); d2 += d * d; }
    return { rho: 1 - 6 * d2 / (n * (n * n - 1)), n };
  }
  function arena({ A, cell, lat, lon, critIds, tv, w, ranges, methods = Object.keys(METHODS), K = 10, topN = 100, sep = 300 }) {
    const res = {};
    for (const m of methods) {
      const eff = score(m, { A, critIds, tv, w, ranges });
      let nE = 0; for (let i = 0; i < eff.length; i++) if (eff[i] >= 0) nE++;
      res[m] = { eff, rank: rankArray(eff, cell), top: distinct(eff, cell, lat, lon, 20, sep), nEligible: nE };
    }
    const pairs = [];
    for (let a = 0; a < methods.length; a++) for (let b = a + 1; b < methods.length; b++) {
      const A1 = res[methods[a]], B1 = res[methods[b]], sp = spearman(A1.eff, B1.eff, cell);
      const ta = new Set(A1.top.slice(0, K)), tb = B1.top.slice(0, K), ov = tb.filter(i => ta.has(i)).length;
      const ca = new Set(), cb = new Set(); for (let i = 0; i < cell.length; i++) { if (A1.rank[i] > 0 && A1.rank[i] <= topN) ca.add(i); if (B1.rank[i] > 0 && B1.rank[i] <= topN) cb.add(i); }
      let inter = 0; for (const i of ca) if (cb.has(i)) inter++;
      pairs.push({ a: methods[a], b: methods[b], rho: sp.rho, nCommon: sp.n, leadingOverlap: ov, jaccardTop: inter / (ca.size + cb.size - inter || 1), sameTop1: A1.top[0] === B1.top[0] });
    }
    /* sites in the top-100 cells under every method (method-robust), as distinct sites ranked by baseline score */
    const all = []; for (let i = 0; i < cell.length; i++) if (methods.every(m => res[m].rank[i] > 0 && res[m].rank[i] <= topN)) all.push(i);
    const base = res.baseline ? res.baseline.eff : res[methods[0]].eff;
    const robust = distinctOf(all, base, cell, lat, lon, K, sep);
    const leaders = (res.baseline || res[methods[0]]).top.slice(0, K).map(i => ({ i, ranks: Object.fromEntries(methods.map(m => [m, res[m].rank[i] || null])) }));
    return { methods, results: res, pairs, robust, robustPool: all.length, leaders, K, topN, note: "Agreement between methods shows how much a conclusion depends on the scoring rule; it does not show that any method is scientifically correct." };
  }

  /* ------------------------------------------------------------------ data counterfactual: leave one Earth source out
   * Baseline method with every criterion supplied by that source set to weight 0 (the criterion is excluded — never
   * imputed). Answers "would the leading sites survive without this dataset?". sources: { id: [criterion ids] }. */
  function dropSource({ A, cell, lat, lon, critIds, tv, w, ranges, sources, K = 10, sep = 300 }) {
    const base = score("baseline", { A, critIds, tv, w, ranges }), baseTop = distinct(base, cell, lat, lon, K, sep), baseR = rankArray(base, cell);
    const out = [];
    for (const [src, cs] of Object.entries(sources)) {
      const dropped = cs.filter(c => activeOf(critIds, tv, w).includes(c));
      if (!dropped.length) { out.push({ source: src, dropped, skipped: "no active criterion from this source" }); continue; }
      const w2 = { ...w }; for (const c of cs) w2[c] = 0;
      if (!activeOf(critIds, tv, w2).length) { out.push({ source: src, dropped, blocked: "no active criterion would remain" }); continue; }
      const eff = score("baseline", { A, critIds, tv, w: w2, ranges }), top = distinct(eff, cell, lat, lon, K, sep), R = rankArray(eff, cell);
      let nE = 0; for (let i = 0; i < eff.length; i++) if (eff[i] >= 0) nE++;
      const kept = top.filter(i => baseTop.includes(i));
      out.push({ source: src, dropped, top, kept: kept.length, sameTop1: top[0] === baseTop[0], nEligible: nE,
        leaders: baseTop.map(i => ({ i, rankBefore: baseR[i], rankAfter: R[i] > 0 ? R[i] : null })), rho: spearman(base, eff, cell).rho });
    }
    return { baseTop, results: out, note: "Data counterfactual under the unchanged baseline formula: the source's criteria are excluded (weight 0), not replaced by other values." };
  }

  const api = { VERSION, dropSource, MIN_COVERAGE, CODES, METHODS, activeOf, code, signatureOf, keyOf, families, ceiling, sameWay, score, order, distinct, rankArray, spearman, arena, cdf, sortedFinite, haversine };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AsterroMethods = api;
})(typeof window !== "undefined" ? window : globalThis);
