/* ===== 03 compute: deterministic pipeline (all numbers come from TAIEngine) ===== */
const TARGET_IDS = ["mars_jezero", "moon_south_pole"];
const simCache = new Map();

function simFor(tid, w) {
  const key = tid + "|" + S.critIds.map(c => (+w[c]).toFixed(4)).join(",");
  if (simCache.has(key)) return simCache.get(key);
  const r = ENG.similarity(S.A, S.critIds, S.T[tid].variables, w, S.ranges);
  if (simCache.size > 24) simCache.delete(simCache.keys().next().value);
  simCache.set(key, r); return r;
}
/* rank of one cell without sorting: 1 + #cells ordered ahead of it (same tie-break as the sort) */
function rankOf(eff, i) {
  if (eff[i] < 0) return null;
  const e = eff[i], c = S.cell[i]; let k = 1;
  for (let j = 0; j < S.n; j++) { const v = eff[j]; if (v > e || (v === e && S.cell[j] < c)) k++; }
  return k;
}
function effectiveFor(tid, w) {
  if (tid !== "cross") return simFor(tid, w).eff;
  const a = simFor(TARGET_IDS[0], w).eff, b = simFor(TARGET_IDS[1], w).eff, out = new Float64Array(S.n);
  for (let i = 0; i < S.n; i++) out[i] = (a[i] < 0 || b[i] < 0) ? -1 : Math.min(a[i], b[i]);
  return out;
}

function compute() {
  const t0 = performance.now(), tid = S.targetId, w = S.weights;
  let r = null, rJ = null, rM = null;
  if (tid === "cross") { rJ = simFor(TARGET_IDS[0], w); rM = simFor(TARGET_IDS[1], w); }
  else r = simFor(tid, w);
  const eff = effectiveFor(tid, w);
  const order = ENG.order(eff, S.cell);
  const rank = ENG.ranksFromOrder(order);
  let nElig = 0; for (let i = 0; i < S.n; i++) if (eff[i] >= 0) nElig++;
  const distinct = ENG.distinctSites(order, S.lat, S.lon, 20, S.app.thresholds.distinct_sep_km);
  const hi = eff[order[0]], lo = eff[order[Math.floor(nElig / 2)]];
  const active = tid === "cross" ? Array.from(new Set([...rJ.active, ...rM.active])) : r.active;
  S.res = { tid, w: { ...w }, r, rJ, rM, eff, order, rank, nElig, distinct, lo, hi, active, clusters: null };
  S.computeMs = performance.now() - t0;
  scheduleClusters();
  return S.res;
}

let clusterTimer = null;
function scheduleClusters() {
  clearTimeout(clusterTimer);
  clusterTimer = setTimeout(() => { computeClusters(); paintField(); renderAll(["right", "left"]); }, 140);
}
function normOf(i, c) { const v = S.A[c][i], R = S.ranges[c]; return v === v ? (v - R[0]) / (R[1] - R[0]) : NaN; }
function computeClusters() {
  const R = S.res; if (!R) return;
  const cl = ENG.constellations(R.order, R.active, normOf);
  const groups = [];
  for (let g = 0; g < cl.k; g++) groups.push({ id: g, members: [] });
  cl.candidates.forEach((i, r) => groups[cl.labels[r]].members.push(i));
  for (const G of groups) {
    const m = G.members, mean = f => { let s = 0, k = 0; for (const i of m) { const v = f(i); if (v === v) { s += v; k++; } } return k ? s / k : NaN; };
    G.stats = { aridity: mean(i => S.A.aridity[i]), t2m_mean_c: mean(i => S.A.t2m_mean_c[i]), slope: mean(i => S.A.slope[i]),
                elevation: mean(i => S.A.elevation[i]), lst: mean(i => S.A.lst_diurnal_range[i]), score: mean(i => R.eff[i]) };
    G.name = ENG.describe(G.stats);
    G.area = m.reduce((a, i) => a + cellArea(i), 0);
    G.best = m[0];                         // members are in rank order
    const cc = new Map(); for (const i of m) { const k = placeName(i).secondary || placeName(i).primary; cc.set(k, (cc.get(k) || 0) + 1); }
    G.countries = [...cc.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3);
  }
  // order constellations by mean score (deterministic), keep ids for colours
  groups.sort((a, b) => b.stats.score - a.stats.score || a.id - b.id);
  groups.forEach((G, k) => G.rankNo = k + 1);
  R.clusters = { k: cl.k, silhouette: cl.silhouette, groups, member: new Int8Array(S.n).fill(-1), threshold: R.eff[cl.candidates[cl.candidates.length - 1]] };
  for (const G of groups) for (const i of G.members) R.clusters.member[i] = G.rankNo - 1;
}

/* per-cell breakdown (trace) — current or arbitrary weights */
function detailFor(tid, i, w = S.weights) { return ENG.detail(S.A, S.critIds, i, S.T[tid].variables, w, S.ranges); }

function paintField() {
  const R = S.res, g = window.GLOBE; if (!R || !g) return;
  const d = g.fieldData; d.fill(0);
  const n = R.nElig, prev = S.prev && S.prev.tid === R.tid ? S.prev : null;
  const pN = prev ? Math.max(1, prev.nElig - 1) : 1, dMax = 0.25;   // change layer: relative-rank (percentile) change
  for (let k = 0; k < S.n; k++) {
    const i = R.order[k], c = S.cell[i] * 4, e = R.eff[i];
    d[c] = e < 0 ? 0 : Math.round(e * 255);
    d[c + 1] = e < 0 ? 255 : Math.round(255 * (1 - k / Math.max(1, n - 1)));
    d[c + 2] = R.clusters ? R.clusters.member[i] + 1 : 0;
    let code = 128;
    if (prev && e >= 0 && prev.eff[i] >= 0) {
      const pNow = 1 - k / Math.max(1, n - 1), pWas = 1 - (prev.rank[i] - 1) / pN;
      code = Math.round(128 + clamp((pNow - pWas) / dMax, -1, 1) * 127);
    }
    d[c + 3] = e < 0 ? 1 : Math.max(1, code);
  }
  g.lo = R.lo; g.hi = R.hi; g.ramp = RAMPS[R.tid]; g.uploadField();
}

/* analogue evolution: yearly LST replaces the climatological LST, everything else fixed */
function evolution(tid, i, w = S.weights) {
  const Y = S.app.stack.years, out = [];
  const yr = S.A.lst_diurnal_range_yearly;
  for (let y = 0; y < Y.length; y++) {
    const raw = yr[y * S.n + i]; const v = raw === -32768 ? NaN : raw * 0.01;
    const st = {}; for (const c of S.critIds) st[c] = new Float32Array([c === "lst_diurnal_range" ? v : S.A[c][i]]);
    const scoreOf = t => { const r = ENG.similarity(st, S.critIds, S.T[t].variables, w, S.ranges); return r.eff[0]; };
    const s = tid === "cross" ? Math.min(scoreOf(TARGET_IDS[0]), scoreOf(TARGET_IDS[1])) : scoreOf(tid);
    out.push({ year: Y[y], lst: v, score: v === v ? s : null });
  }
  const sc = out.filter(o => o.score != null && o.score >= 0).map(o => o.score);
  const range = sc.length ? (Math.max(...sc) - Math.min(...sc)) * 100 : null;
  const cls = range == null ? "DATA NOT AVAILABLE" : (range <= S.app.thresholds.evolution_stable_pts ? "STABLE ANALOGUE" : "VARIABLE ANALOGUE");
  return { series: out, rangePts: range, cls, years: sc.length };
}

function stability(tid, i) {
  const rows = [];
  for (const [pid, p] of Object.entries(S.app.profiles)) {
    const eff = effectiveFor(tid, p.weights); rows.push({ pid, label: p.label, rank: rankOf(eff, i), score: eff[i] });
  }
  return rows;
}
function profileFor(i, w = S.weights) {   // reverse search: one Earth cell against every target
  return TARGET_IDS.map(t => { const r = simFor(t, w); return { tid: t, score: r.eff[i], rank: rankOf(r.eff, i), cov: r.coverage[i] }; });
}
function paretoFront(w = S.weights, limit = 14) {
  const a = simFor(TARGET_IDS[0], w).eff, b = simFor(TARGET_IDS[1], w).eff, idx = [];
  for (let i = 0; i < S.n; i++) if (a[i] >= 0 && b[i] >= 0) idx.push(i);
  idx.sort((x, y) => (a[y] - a[x]) || (b[y] - b[x]) || (S.cell[x] - S.cell[y]));
  const front = []; let best = -1;
  for (const i of idx) if (b[i] > best) { front.push(i); best = b[i]; }
  return { front, a, b, count: idx.length };
}
function dataQuality(i, tid) {
  const t = tid === "cross" ? null : S.T[tid];
  const w = S.weights, act = S.res.active;
  let proxies = 0; const tl = tid === "cross" ? TARGET_IDS.map(x => S.T[x]) : [t];
  const pset = new Set(); for (const tt of tl) for (const c of act) if (tt.proxy_flags[c] && +w[c] > 0) pset.add(c);
  proxies = pset.size;
  const cov = tid === "cross" ? Math.min(S.res.rJ.coverage[i], S.res.rM.coverage[i]) : S.res.r.coverage[i];
  const [dy, dx] = cellDims(i);
  return { coverage: cov, modis: S.A.modis_coverage[i], land: S.A.gmted_land_fraction[i], proxies, active: act.length,
           res: `0.5° × 0.625° (${dy.toFixed(1)} × ${dx.toFixed(1)} km)`, missing: act.filter(c => S.A[c][i] !== S.A[c][i]) };
}
