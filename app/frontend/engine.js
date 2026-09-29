/* ASTERRO · Planetary Analogue Intelligence — deterministic engine (browser + Node).
 * Line-for-line port of src/compute/{similarity,ranking,clustering}.py.
 * Parity with the Python reference is asserted by tests/test_js_parity.mjs.
 * No randomness, no learned model, no generative component. */
(function (root) {
  "use strict";
  const MIN_COVERAGE = 0.80;
  const MATCH = 0.85, PARTIAL = 0.60;
  const R_EARTH_KM = 6371.0088;
  const N_CANDIDATES = 800, K_CHOICES = [3, 4, 5];
  const ALGORITHM_VERSION = "tai-sim-1.0.0";

  function activeCriteria(criteria, tv, w) {
    return criteria.filter(c => w[c] != null && +w[c] > 0 && tv[c] != null);
  }

  /* stack: {criterion: Float32Array}; returns Float64 arrays */
  function similarity(stack, criteria, tv, w, ranges) {
    for (const c of criteria) {
      if (w[c] == null) continue;
      if (!Number.isFinite(+w[c])) throw new Error("non-finite weight " + c);
      if (+w[c] < 0) throw new Error("negative weight " + c);
    }
    const act = activeCriteria(criteria, tv, w);
    if (!act.length) throw new Error("no active criteria");
    let totalW = 0; for (const c of act) totalW += +w[c];
    const n = stack[act[0]].length;
    const num = new Float64Array(n), wsum = new Float64Array(n);
    for (const c of act) {
      const e = stack[c], t = +tv[c], lo = ranges[c][0], span = ranges[c][1] - ranges[c][0], wc = +w[c];
      if (!(Number.isFinite(lo) && Number.isFinite(span) && span > 0)) throw new Error("undefined normalization range " + c);
      for (let i = 0; i < n; i++) {
        const x = e[i];
        if (x - x !== 0) continue;                   // NaN or ±Infinity: missing Earth value
        let s = 1 - Math.abs(x - t) / span;
        s = s < 0 ? 0 : (s > 1 ? 1 : s);
        num[i] += wc * s; wsum[i] += wc;
      }
    }
    const final = new Float64Array(n), coverage = new Float64Array(n), eff = new Float64Array(n);
    const eligible = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      final[i] = wsum[i] > 0 ? num[i] / wsum[i] : NaN;
      coverage[i] = wsum[i] / totalW;
      eligible[i] = coverage[i] >= MIN_COVERAGE - 1e-12 ? 1 : 0;
      eff[i] = eligible[i] && final[i] === final[i] ? final[i] : -1;
    }
    return { final, coverage, eligible, eff, active: act, totalW };
  }

  /* Full per-criterion breakdown for ONE cell (trace). */
  function detail(stack, criteria, i, tv, w, ranges) {
    const act = activeCriteria(criteria, tv, w);
    let wsum = 0; const rows = [];
    for (const c of criteria) {
      const e0 = stack[c][i], e = e0 - e0 === 0 ? e0 : NaN, t = tv[c], on = act.includes(c);
      const row = { c, e: e === e ? e : null, t, w: +(w[c] || 0), active: on, lo: ranges[c][0], hi: ranges[c][1] };
      if (on && e === e) {
        row.d = Math.abs(e - t) / (ranges[c][1] - ranges[c][0]);
        let s = 1 - row.d; row.s = s < 0 ? 0 : (s > 1 ? 1 : s);
        row.en = (e - ranges[c][0]) / (ranges[c][1] - ranges[c][0]);
        row.tn = (t - ranges[c][0]) / (ranges[c][1] - ranges[c][0]);
        wsum += row.w;
      } else if (e === e) {
        row.en = (e - ranges[c][0]) / (ranges[c][1] - ranges[c][0]);
        row.tn = t == null ? null : (t - ranges[c][0]) / (ranges[c][1] - ranges[c][0]);
      }
      rows.push(row);
    }
    let final = 0, num = 0;
    for (const r of rows) if (r.s != null) { r.k = r.w * r.s / wsum; num += r.w * r.s; }
    final = wsum > 0 ? num / wsum : NaN;
    let totalW = 0; for (const c of act) totalW += +w[c];
    return { rows, final, coverage: wsum / totalW, wsum, totalW };
  }

  function classify(s) { return s >= MATCH ? "MATCH" : (s >= PARTIAL ? "PARTIAL" : "MISMATCH"); }

  function order(eff, cell) {
    const n = eff.length, idx = new Int32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    idx.sort((a, b) => (eff[b] - eff[a]) || (cell[a] - cell[b]));
    return idx;
  }
  function ranksFromOrder(o) {
    const r = new Int32Array(o.length);
    for (let k = 0; k < o.length; k++) r[o[k]] = k + 1;
    return r;
  }
  function haversine(la1, lo1, la2, lo2) {
    const r = Math.PI / 180, p1 = la1 * r, p2 = la2 * r, dp = p2 - p1, dl = (lo2 - lo1) * r;
    let a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    a = a < 0 ? 0 : (a > 1 ? 1 : a);
    return 2 * R_EARTH_KM * Math.asin(Math.sqrt(a));
  }
  function distinctSites(o, lat, lon, n = 20, sep = 300) {
    const kept = [];
    for (let k = 0; k < o.length && kept.length < n; k++) {
      const i = o[k]; let ok = true;
      for (const j of kept) if (haversine(lat[i], lon[i], lat[j], lon[j]) < sep) { ok = false; break; }
      if (ok) kept.push(i);
    }
    return kept;
  }

  /* ---- clustering (constellations) ---- */
  function kmeans(X, d, k) {
    const n = X.length / d, C = new Float64Array(k * d), idx = [0];
    const dist = new Float64Array(n);
    const sq = (i, cRow, CC) => { let s = 0; for (let q = 0; q < d; q++) { const v = X[i * d + q] - CC[cRow * d + q]; s += v * v; } return s; };
    for (let q = 0; q < d; q++) C[q] = X[q];
    for (let i = 0; i < n; i++) dist[i] = sq(i, 0, C);
    for (let j = 1; j < k; j++) {
      let best = 0; for (let i = 1; i < n; i++) if (dist[i] > dist[best]) best = i;
      idx.push(best); for (let q = 0; q < d; q++) C[j * d + q] = X[best * d + q];
      for (let i = 0; i < n; i++) { const v = sq(i, j, C); if (v < dist[i]) dist[i] = v; }
    }
    let lab = new Int32Array(n);
    for (let it = 0; it < 100; it++) {
      const nl = new Int32Array(n);
      for (let i = 0; i < n; i++) {
        let b = 0, bv = Infinity;
        for (let j = 0; j < k; j++) { const v = sq(i, j, C); if (v < bv) { bv = v; b = j; } }
        nl[i] = b;
      }
      let same = it > 0; if (same) for (let i = 0; i < n; i++) if (nl[i] !== lab[i]) { same = false; break; }
      if (same) break;
      lab = nl;
      for (let j = 0; j < k; j++) {
        let m = 0; const acc = new Float64Array(d);
        for (let i = 0; i < n; i++) if (lab[i] === j) { m++; for (let q = 0; q < d; q++) acc[q] += X[i * d + q]; }
        if (m) for (let q = 0; q < d; q++) C[j * d + q] = acc[q] / m;
      }
    }
    return lab;
  }
  function silhouette(X, d, lab, k) {
    const n = lab.length; let tot = 0;
    const D = (i, j) => { let s = 0; for (let q = 0; q < d; q++) { const v = X[i * d + q] - X[j * d + q]; s += v * v; } return Math.sqrt(s); };
    for (let i = 0; i < n; i++) {
      const sum = new Float64Array(k), cnt = new Float64Array(k);
      for (let j = 0; j < n; j++) { if (j === i) continue; sum[lab[j]] += D(i, j); cnt[lab[j]]++; }
      const own = lab[i];
      if (cnt[own] === 0) continue;
      const a = sum[own] / cnt[own]; let b = Infinity;
      for (let j = 0; j < k; j++) if (j !== own && cnt[j] > 0) b = Math.min(b, sum[j] / cnt[j]);
      const m = Math.max(a, b); tot += m > 0 ? (b - a) / m : 0;
    }
    return tot / n;
  }
  /* norm(i, c) -> normalized value or NaN */
  function constellations(o, act, normFn) {
    const cand = Array.from(o.slice(0, N_CANDIDATES));
    const d = act.length, X = new Float64Array(cand.length * d);
    for (let q = 0; q < d; q++) {
      let s = 0, m = 0;
      for (const i of cand) { const v = normFn(i, act[q]); if (v === v) { s += v; m++; } }
      const mean = m ? s / m : 0.5;
      cand.forEach((i, r) => { const v = normFn(i, act[q]); X[r * d + q] = v === v ? v : mean; });
    }
    let best = null;
    for (const k of K_CHOICES) {
      if (cand.length <= k) continue;
      const lab = kmeans(X, d, k), sil = silhouette(X, d, lab, k);
      if (!best || sil > best.sil + 1e-12) best = { k, lab, sil };
    }
    return { candidates: cand, labels: best.lab, k: best.k, silhouette: best.sil };
  }
  function aridityClass(a) { return a < 0.05 ? "Hyper-arid" : a < 0.20 ? "Arid" : a < 0.50 ? "Semi-arid" : a < 0.65 ? "Dry sub-humid" : "Humid"; }
  function thermalClass(t) { return t < 0 ? "Cold" : (t < 18 ? "Temperate" : "Hot"); }
  function terrainClass(s, e) { const r = s < 2 ? "plains" : (s < 6 ? "rolling terrain" : "rugged terrain"); return e >= 3000 ? "high-altitude " + r : r; }
  function describe(st) {
    const mid = st.aridity == null || st.aridity !== st.aridity ? "" : aridityClass(st.aridity).toLowerCase() + " ";
    return thermalClass(st.t2m_mean_c) + " " + mid + terrainClass(st.slope, st.elevation);
  }

  const api = { MIN_COVERAGE, MATCH, PARTIAL, N_CANDIDATES, ALGORITHM_VERSION, activeCriteria, similarity, detail,
    classify, order, ranksFromOrder, haversine, distinctSites, kmeans, silhouette, constellations, describe,
    aridityClass, thermalClass, terrainClass };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TAIEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
