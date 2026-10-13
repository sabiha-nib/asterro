/* ASTERRO Phase II — Research Laboratory analysis engine (browser + Node).
 *
 * Pure, deterministic functions that sit BESIDE the baseline engine (engine.js / TAIEngine).
 * Nothing here modifies baseline scores, weights, ranges, thresholds or rankings:
 *   - every experiment receives explicit inputs and returns new objects;
 *   - the per-criterion similarities s_c are recomputed with the baseline formula and the
 *     baseline accumulation order, so the baseline configuration reproduces TAIEngine scores
 *     bit-for-bit (asserted by tests/phase2/test_lab_engine.mjs).
 * No randomness except the documented, seeded sampler (mulberry32). No learned or generative model.
 */
(function (root) {
  "use strict";
  const VERSION = "asterro-phase2-0.1.0";
  const MIN_COVERAGE = 0.80;                 // baseline rule, read-only copy
  const R_EARTH_KM = 6371.0088;

  /* ------------------------------------------------------------------ evidence protocol */
  const EVIDENCE = ["MEASURED", "DERIVED", "INFERRED", "ASSUMED", "UNAVAILABLE", "UNVALIDATED"];
  const COMPLETENESS = ["complete", "partial", "none"];
  const CATEGORY_HELP = {
    MEASURED: "Directly supported by a source measurement.",
    DERIVED: "Calculated from documented source measurements.",
    INFERRED: "Interpretation supported by a defined analytical method.",
    ASSUMED: "An explicit modelling assumption.",
    UNAVAILABLE: "The necessary evidence is absent.",
    UNVALIDATED: "The method or conclusion has not received the required validation.",
  };
  function claim(o) {
    if (!o || typeof o.id !== "string" || !o.id) throw new Error("claim: id required");
    if (typeof o.text !== "string" || !o.text) throw new Error("claim " + o.id + ": text required");
    if (!EVIDENCE.includes(o.category)) throw new Error("claim " + o.id + ": category must be one of " + EVIDENCE.join("/"));
    const c = {
      id: o.id, text: o.text, category: o.category,
      supporting: o.supporting || [], method: o.method || null, provenance: o.provenance || [],
      assumptions: o.assumptions || [], limitations: o.limitations || [],
      completeness: o.completeness || (o.category === "UNAVAILABLE" ? "none" : "complete"),
      reproduce: o.reproduce || null,
    };
    if (!COMPLETENESS.includes(c.completeness)) throw new Error("claim " + o.id + ": completeness must be complete/partial/none");
    if (c.category === "MEASURED" && !c.provenance.length) throw new Error("claim " + o.id + ": MEASURED requires provenance");
    if (c.category === "DERIVED" && !c.method) throw new Error("claim " + o.id + ": DERIVED requires a method");
    if (c.category === "INFERRED" && !c.method) throw new Error("claim " + o.id + ": INFERRED requires a method");
    if (c.category === "UNAVAILABLE" && c.completeness !== "none") throw new Error("claim " + o.id + ": UNAVAILABLE implies completeness none");
    return Object.freeze(c);
  }

  /* ------------------------------------------------------------------ canonical JSON + hashing */
  function canonNum(x) {
    if (!Number.isFinite(x)) return "null";              // NaN / ±Inf are not representable: recorded as null
    return JSON.stringify(x);
  }
  function canonical(v) {
    if (v === null || v === undefined) return "null";
    if (typeof v === "number") return canonNum(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "string") return JSON.stringify(v);
    if (ArrayBuffer.isView(v)) v = Array.from(v);
    if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
    const keys = Object.keys(v).filter(k => v[k] !== undefined).sort();
    return "{" + keys.map(k => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  }
  async function sha256Hex(str) {
    const subtle = (root.crypto && root.crypto.subtle) || (typeof require !== "undefined" ? require("crypto").webcrypto.subtle : null);
    const buf = await subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
  }

  /* ------------------------------------------------------------------ seeded sampler */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------------ fast experimental scoring */
  /* Per-criterion similarity with the BASELINE formula s = clip(1 - |e - t| / (max - min), 0, 1).
   * Missing / non-finite Earth value -> NaN (excluded, as in the baseline). */
  function prepare(A, critIds, tv, ranges) {
    const s = {}, act = [];
    for (const c of critIds) {
      if (tv[c] == null) continue;
      const lo = ranges[c][0], span = ranges[c][1] - ranges[c][0], t = +tv[c], e = A[c], n = e.length;
      if (!(Number.isFinite(lo) && Number.isFinite(span) && span > 0)) throw new Error("undefined normalization range " + c);
      const out = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const x = e[i];
        if (x - x !== 0) { out[i] = NaN; continue; }
        let v = 1 - Math.abs(x - t) / span;
        out[i] = v < 0 ? 0 : (v > 1 ? 1 : v);
      }
      s[c] = out; act.push(c);
    }
    return { critIds: critIds.slice(), applicable: act, s, n: act.length ? s[act[0]].length : 0 };
  }
  function validateWeights(w, critIds) {
    for (const c of critIds) {
      const v = w[c];
      if (v == null) continue;
      if (!Number.isFinite(+v)) throw new Error("non-finite weight " + c);
      if (+v < 0) throw new Error("negative weight " + c);
    }
  }
  /* Effective score field for weights w. Identical accumulation order to TAIEngine.similarity. */
  function fieldScore(P, w, out) {
    validateWeights(w, P.critIds);
    const act = P.applicable.filter(c => w[c] != null && +w[c] > 0);
    if (!act.length) throw new Error("no active criteria");
    let totalW = 0; for (const c of act) totalW += +w[c];
    const n = P.n, num = new Float64Array(n), wsum = new Float64Array(n);
    for (const c of act) {
      const s = P.s[c], wc = +w[c];
      for (let i = 0; i < n; i++) { const v = s[i]; if (v !== v) continue; num[i] += wc * v; wsum[i] += wc; }
    }
    const eff = out || new Float64Array(n), coverage = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const f = wsum[i] > 0 ? num[i] / wsum[i] : NaN;
      coverage[i] = wsum[i] / totalW;
      eff[i] = (coverage[i] >= MIN_COVERAGE - 1e-12) && f === f ? f : -1;
    }
    return { eff, coverage, active: act, totalW };
  }
  function crossEff(a, b) {
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = (a[i] < 0 || b[i] < 0) ? -1 : Math.min(a[i], b[i]);
    return out;
  }
  /* Ps: [P] for one target, [P_mars, P_moon] for cross-planet (min rule, as baseline). */
  function effFor(Ps, w) {
    if (Ps.length === 1) return fieldScore(Ps[0], w).eff;
    return crossEff(fieldScore(Ps[0], w).eff, fieldScore(Ps[1], w).eff);
  }

  /* ------------------------------------------------------------------ exact ranks of a candidate set */
  /* Rank = 1 + #cells ordered ahead (score desc, then cell id asc) — the baseline tie-break.
   * O(n log k) per configuration instead of a full sort. */
  function candidateRanks(eff, cell, cand) {
    const k = cand.length, ord = cand.map((i, q) => q).sort((x, y) => (eff[cand[x]] - eff[cand[y]]) || (cell[cand[y]] - cell[cand[x]]));
    const ev = ord.map(q => eff[cand[q]]), cv = ord.map(q => cell[cand[q]]);
    const ahead = new Int32Array(k + 1);
    const n = eff.length;
    for (let j = 0; j < n; j++) {
      const v = eff[j];
      let lo = 0, hi = k;                       // number of sorted candidates with value < v
      while (lo < hi) { const m = (lo + hi) >> 1; if (ev[m] < v) lo = m + 1; else hi = m; }
      if (lo > 0) { ahead[0]++; ahead[lo]--; }  // j is ahead of candidates [0, lo)
      for (let q = lo; q < k && ev[q] === v; q++) if (cell[j] < cv[q]) { ahead[q]++; ahead[q + 1]--; }
    }
    const rk = new Int32Array(k); let run = 0;
    for (let q = 0; q < k; q++) { run += ahead[q]; rk[ord[q]] = run + 1; }
    return rk;
  }
  function countEligible(eff) { let m = 0; for (let i = 0; i < eff.length; i++) if (eff[i] >= 0) m++; return m; }

  /* ------------------------------------------------------------------ robustness designs */
  const BOUNDS = {
    factor: [0.1, 10], topPct: [0.1, 5], stableFrac: [0.8, 1], moderateFrac: [0.3, 0.95],
    samples: [10, 2000], logRange: [0.1, 2], topN: [5, 500],
  };
  function inBounds(name, v) {
    const b = BOUNDS[name]; if (!b) throw new Error("unknown bound " + name);
    if (!Number.isFinite(v) || v < b[0] || v > b[1]) throw new Error(`${name} = ${v} outside documented bounds [${b[0]}, ${b[1]}]`);
    return v;
  }
  function wcopy(w, critIds) { const o = {}; for (const c of critIds) o[c] = w[c] == null ? 0 : +w[c]; return o; }
  function designFactorial(baseW, act, critIds, factors = [0.5, 1, 2]) {
    factors.forEach(f => inBounds("factor", f));
    const out = [], k = act.length, m = factors.length, total = Math.pow(m, k);
    if (total > 20000) throw new Error("factorial design too large: " + total);
    for (let code = 0; code < total; code++) {
      const w = wcopy(baseW, critIds); let x = code; const f = {};
      for (const c of act) { const fc = factors[x % m]; x = Math.floor(x / m); w[c] = +baseW[c] * fc; f[c] = fc; }
      out.push({ id: "F" + code, w, factors: f });
    }
    return out;
  }
  function designOAT(baseW, act, critIds, factors = [0.5, 2]) {
    factors.forEach(f => inBounds("factor", f));
    const out = [];
    for (const c of act) for (const f of factors) { const w = wcopy(baseW, critIds); w[c] = +baseW[c] * f; out.push({ id: `OAT:${c}x${f}`, w, factors: { [c]: f }, criterion: c, factor: f }); }
    return out;
  }
  function designSampled(baseW, act, critIds, n, seed, logRange = 1) {
    inBounds("samples", n); inBounds("logRange", logRange);
    if (!Number.isInteger(seed) || seed < 0) throw new Error("seed must be a non-negative integer");
    const rnd = mulberry32(seed), out = [];
    for (let q = 0; q < n; q++) {
      const w = wcopy(baseW, critIds), f = {};
      for (const c of act) { const u = (2 * rnd() - 1) * logRange; const fc = Math.pow(2, u); w[c] = +baseW[c] * fc; f[c] = fc; }
      out.push({ id: "S" + q, w, factors: f });
    }
    return out;
  }
  function designAblation(baseW, act, critIds) {
    return act.map(c => { const w = wcopy(baseW, critIds); w[c] = 0; return { id: "ABL:" + c, w, removed: c }; });
  }

  function quantile(sorted, p) {             // nearest-rank (documented): ceil(p * n)-th smallest
    if (!sorted.length) return NaN;
    const r = Math.max(1, Math.ceil(p * sorted.length));
    return sorted[Math.min(sorted.length, r) - 1];
  }

  /* Run a design. Returns ranks[c][q] for each candidate and config, plus baseline ranks.
   * onProgress(done, total) may return false to cancel. Async (yields every `chunk` configs). */
  async function runDesign({ Ps, cell, cand, baseW, design, onProgress, chunk = 8 }) {
    const ranks = cand.map(() => new Int32Array(design.length));
    const scores = cand.map(() => new Float64Array(design.length));
    const nElig = new Int32Array(design.length);
    const base = effFor(Ps, baseW), baseRanks = candidateRanks(base, cell, cand), baseElig = countEligible(base);
    for (let q = 0; q < design.length; q++) {
      const eff = effFor(Ps, design[q].w), rk = candidateRanks(eff, cell, cand);
      for (let c = 0; c < cand.length; c++) { ranks[c][q] = rk[c]; scores[c][q] = eff[cand[c]]; }
      nElig[q] = countEligible(eff);
      if ((q + 1) % chunk === 0 || q === design.length - 1) {
        if (onProgress && onProgress(q + 1, design.length) === false) return { cancelled: true, done: q + 1 };
        await new Promise(r => setTimeout(r, 0));
      }
    }
    return { cancelled: false, ranks, scores, nElig, baseRanks, baseScores: cand.map(i => base[i]), baseElig };
  }
  function runDesignSync(args) {             // same as runDesign without yielding (tests / replay)
    const { Ps, cell, cand, baseW, design } = args;
    const ranks = cand.map(() => new Int32Array(design.length)), scores = cand.map(() => new Float64Array(design.length));
    const nElig = new Int32Array(design.length);
    const base = effFor(Ps, baseW), baseRanks = candidateRanks(base, cell, cand), baseElig = countEligible(base);
    design.forEach((d, q) => {
      const eff = effFor(Ps, d.w), rk = candidateRanks(eff, cell, cand);
      for (let c = 0; c < cand.length; c++) { ranks[c][q] = rk[c]; scores[c][q] = eff[cand[c]]; }
      nElig[q] = countEligible(eff);
    });
    return { cancelled: false, ranks, scores, nElig, baseRanks, baseScores: cand.map(i => base[i]), baseElig };
  }

  /* Rank statistics + classification for one design run. */
  function rankStats(run, { topPct = 1, topN = 20, stableFrac = 0.95, moderateFrac = 0.5, coverage = null } = {}) {
    inBounds("topPct", topPct); inBounds("topN", topN); inBounds("stableFrac", stableFrac); inBounds("moderateFrac", moderateFrac);
    if (moderateFrac >= stableFrac) throw new Error("moderateFrac must be below stableFrac");
    const nCfg = run.ranks.length ? run.ranks[0].length : 0;
    return run.ranks.map((rk, c) => {
      const arr = Array.from(rk).sort((a, b) => a - b);
      let inPct = 0, inN = 0;
      for (let q = 0; q < nCfg; q++) { if (rk[q] <= Math.max(1, Math.floor(run.nElig[q] * topPct / 100))) inPct++; if (rk[q] <= topN) inN++; }
      const fracPct = nCfg ? inPct / nCfg : NaN, fracN = nCfg ? inN / nCfg : NaN;
      let cls;
      if (nCfg < 10) cls = "INSUFFICIENT_EVIDENCE";
      else if (coverage && coverage[c] < 1 - 1e-12) cls = "INSUFFICIENT_EVIDENCE";
      else if (fracPct >= stableFrac) cls = "STABLE";
      else if (fracPct >= moderateFrac) cls = "MODERATELY_SENSITIVE";
      else cls = "HIGHLY_SENSITIVE";
      return { baseline: run.baseRanks[c], min: arr[0], max: arr[arr.length - 1], median: quantile(arr, 0.5),
               p25: quantile(arr, 0.25), p75: quantile(arr, 0.75), fracTopPct: fracPct, fracTopN: fracN, n: nCfg, cls };
    });
  }
  const CLASS_LABEL = { STABLE: "Stable across tested configurations", MODERATELY_SENSITIVE: "Moderately sensitive",
    HIGHLY_SENSITIVE: "Highly sensitive", INSUFFICIENT_EVIDENCE: "Insufficient evidence" };

  /* One-at-a-time sensitivity: for each candidate and criterion, log2 rank ratio for the up/down factors. */
  function oatSensitivity(run, design) {
    return run.ranks.map((rk, c) => {
      const byCrit = {};
      design.forEach((d, q) => {
        const e = byCrit[d.criterion] || (byCrit[d.criterion] = { criterion: d.criterion, ranks: {}, maxAbsLog2: 0 });
        e.ranks[d.factor] = rk[q];
        const l = Math.abs(Math.log2(rk[q] / run.baseRanks[c])); if (l > e.maxAbsLog2) e.maxAbsLog2 = l;
      });
      const list = Object.values(byCrit).sort((a, b) => b.maxAbsLog2 - a.maxAbsLog2 || (a.criterion < b.criterion ? -1 : 1));
      return { driver: list.length ? list[0].criterion : null, list };
    });
  }

  /* Pairwise order flips among candidates across a design (for the observation-value engine). */
  function pairFlips(run) {
    const k = run.ranks.length, n = k ? run.ranks[0].length : 0, out = [];
    for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) {
      const baseAB = run.baseRanks[a] < run.baseRanks[b];
      let flips = 0; for (let q = 0; q < n; q++) if ((run.ranks[a][q] < run.ranks[b][q]) !== baseAB) flips++;
      out.push({ a, b, flips, frac: n ? flips / n : NaN });
    }
    return out.sort((x, y) => y.frac - x.frac || x.a - y.a || x.b - y.b);
  }

  /* ------------------------------------------------------------------ ablation */
  function spearman(x, y) {
    const n = x.length; if (n < 3) return NaN;
    const rank = v => { const idx = v.map((_, i) => i).sort((a, b) => v[a] - v[b] || a - b), r = new Float64Array(n);
      let i = 0; while (i < n) { let j = i; while (j + 1 < n && v[idx[j + 1]] === v[idx[i]]) j++; const m = (i + j) / 2 + 1; for (let q = i; q <= j; q++) r[idx[q]] = m; i = j + 1; } return r; };
    const rx = rank(x), ry = rank(y); let mx = 0, my = 0; for (let i = 0; i < n; i++) { mx += rx[i]; my += ry[i]; } mx /= n; my /= n;
    let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { const a = rx[i] - mx, b = ry[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
    return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
  }
  /* ENG: baseline engine (order, ranksFromOrder, distinctSites) — reused, not modified. */
  function ablation({ ENG, Ps, cell, lat, lon, baseW, act, critIds, nDistinct = 20, sep = 300, compareTop = 1000 }) {
    const base = effFor(Ps, baseW), bo = ENG.order(base, cell), br = ENG.ranksFromOrder(bo);
    const bd = ENG.distinctSites(bo, lat, lon, nDistinct, sep);
    const topIdx = Array.from(bo.slice(0, compareTop));
    return designAblation(baseW, act, critIds).map(d => {
      let eff;
      try { eff = effFor(Ps, d.w); } catch (e) { return { removed: d.removed, error: e.message }; }
      const o = ENG.order(eff, cell), r = ENG.ranksFromOrder(o), ds = ENG.distinctSites(o, lat, lon, nDistinct, sep);
      const setB = new Set(bd), overlap = ds.filter(i => setB.has(i)).length;
      const rho = spearman(topIdx.map(i => br[i]), topIdx.map(i => r[i]));
      return { removed: d.removed, w: d.w, top: ds[0], distinct: ds, overlap, rho,
               baselineDistinctNewRanks: bd.map(i => r[i]), nElig: countEligible(eff) };
    });
  }

  /* ------------------------------------------------------------------ Pareto (maximisation) */
  /* a dominates b iff a >= b on every objective and a > b on at least one. Points with any NaN
   * objective are not evaluable and are returned separately (never treated as dominated or optimal). */
  function pareto(points) {
    const ok = points.filter(p => p.v.every(x => x === x)), bad = points.filter(p => !p.v.every(x => x === x));
    const front = [];
    for (const p of ok) {
      let dom = false;
      for (const q of ok) {
        if (q === p) continue;
        let ge = true, gt = false;
        for (let k = 0; k < p.v.length; k++) { if (q.v[k] < p.v[k]) { ge = false; break; } if (q.v[k] > p.v[k]) gt = true; }
        if (ge && gt) { dom = true; break; }
      }
      if (!dom) front.push(p.id);
    }
    return { front, notEvaluable: bad.map(p => p.id), evaluated: ok.length };
  }

  /* ------------------------------------------------------------------ portfolio diversity */
  function normVec(A, i, crits, ranges) { return crits.map(c => { const v = A[c][i], R = ranges[c]; return v - v === 0 ? (v - R[0]) / (R[1] - R[0]) : NaN; }); }
  function envDist(a, b) {                    // RMS over criteria finite in both; NaN if none shared
    let s = 0, m = 0; for (let k = 0; k < a.length; k++) if (a[k] === a[k] && b[k] === b[k]) { s += (a[k] - b[k]) ** 2; m++; }
    return m ? Math.sqrt(s / m) : NaN;
  }
  function haversine(la1, lo1, la2, lo2) {
    const r = Math.PI / 180, p1 = la1 * r, p2 = la2 * r, dp = p2 - p1, dl = (lo2 - lo1) * r;
    let a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2; a = a < 0 ? 0 : (a > 1 ? 1 : a);
    return 2 * R_EARTH_KM * Math.asin(Math.sqrt(a));
  }
  function portfolioMetrics({ set, A, crits, ranges, lat, lon, eff, pool, redundancyDelta = 0.05, robust = null }) {
    const V = set.map(i => normVec(A, i, crits, ranges)), k = set.length;
    const env = [], geo = [];
    for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) { env.push(envDist(V[a], V[b])); geo.push(haversine(lat[set[a]], lon[set[a]], lat[set[b]], lon[set[b]])); }
    const fin = env.filter(x => x === x), mean = xs => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN;
    const PV = pool ? pool.map(i => normVec(A, i, crits, ranges)) : null;
    const coverage = crits.map((c, q) => {
      const vals = V.map(v => v[q]).filter(x => x === x), pv = PV ? PV.map(v => v[q]).filter(x => x === x) : [];
      const spread = vals.length ? Math.max(...vals) - Math.min(...vals) : NaN;
      const pspread = pv.length ? Math.max(...pv) - Math.min(...pv) : NaN;
      return { criterion: c, spread, poolSpread: pspread, ratio: pspread > 0 ? spread / pspread : NaN, missing: k - vals.length };
    });
    return {
      n: k, envMin: fin.length ? Math.min(...fin) : NaN, envMean: mean(fin), geoMinKm: geo.length ? Math.min(...geo) : NaN, geoMeanKm: mean(geo),
      redundantPairs: fin.filter(x => x < redundancyDelta).length, pairs: env.length, coverage,
      meanScore: mean(set.map(i => eff[i])), missingValues: coverage.reduce((s, c) => s + c.missing, 0),
      stableShare: robust ? robust.filter(r => r.cls === "STABLE").length / robust.length : null,
    };
  }
  /* Greedy max-min diversity (farthest-point) from the pool, starting at the pool's first (highest-score)
   * cell, restricted to cells >= minScore and >= sep km from those already chosen. A heuristic: not optimal. */
  function diversePortfolio({ pool, k, A, crits, ranges, lat, lon, eff, minScore = 0, sep = 300 }) {
    const P = pool.filter(i => eff[i] >= minScore);
    if (!P.length) return [];
    const V = new Map(P.map(i => [i, normVec(A, i, crits, ranges)]));
    const chosen = [P[0]], dmin = new Map(P.map(i => [i, envDist(V.get(i), V.get(P[0]))]));
    while (chosen.length < k) {
      let best = -1, bv = -1;
      for (const i of P) {
        if (chosen.includes(i)) continue;
        let far = true; for (const j of chosen) if (haversine(lat[i], lon[i], lat[j], lon[j]) < sep) { far = false; break; }
        if (!far) continue;
        const d = dmin.get(i); if (d === d && d > bv) { bv = d; best = i; }
      }
      if (best < 0) break;
      chosen.push(best);
      for (const i of P) { const d = envDist(V.get(i), V.get(best)); if (d === d && !(d >= dmin.get(i))) dmin.set(i, d); }
    }
    return chosen;
  }

  /* ------------------------------------------------------------------ neighbourhood (spatial context) */
  /* Window of (2r+1)^2 grid cells centred on cell i (0.5° x 0.625° grid, longitude wraps). Context only:
   * neighbours are NOT part of the candidate's score footprint. */
  function neighbourhood({ i, r, cell, index, nlat = 361, nlon = 576 }) {
    const c0 = cell[i], row0 = Math.floor(c0 / nlon), col0 = c0 % nlon, out = [];
    for (let dr = -r; dr <= r; dr++) for (let dc = -r; dc <= r; dc++) {
      const row = row0 + dr; if (row < 0 || row >= nlat) { out.push({ dr, dc, k: -1, offGrid: true }); continue; }
      const col = ((col0 + dc) % nlon + nlon) % nlon, k = index[row * nlon + col];
      out.push({ dr, dc, k, centre: dr === 0 && dc === 0 });
    }
    return out;
  }
  function stats(vals) {
    const v = vals.filter(x => x - x === 0).sort((a, b) => a - b), n = v.length;
    if (!n) return { n: 0, mean: NaN, median: NaN, sd: NaN, p25: NaN, p75: NaN, iqr: NaN, min: NaN, max: NaN };
    const mean = v.reduce((s, x) => s + x, 0) / n;
    const sd = n > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : NaN;
    const p25 = quantile(v, 0.25), p75 = quantile(v, 0.75);
    return { n, mean, median: quantile(v, 0.5), sd, p25, p75, iqr: p75 - p25, min: v[0], max: v[n - 1] };
  }
  /* Least-squares plane z = a + gx*x + gy*y over valid window cells (x east, y north, km). */
  function planeGradient(pts) {
    const P = pts.filter(p => p.z - p.z === 0); if (P.length < 3) return null;
    let sx = 0, sy = 0, sz = 0, n = P.length; for (const p of P) { sx += p.x; sy += p.y; sz += p.z; }
    const mx = sx / n, my = sy / n, mz = sz / n; let xx = 0, yy = 0, xy = 0, xz = 0, yz = 0;
    for (const p of P) { const x = p.x - mx, y = p.y - my, z = p.z - mz; xx += x * x; yy += y * y; xy += x * y; xz += x * z; yz += y * z; }
    const det = xx * yy - xy * xy; if (Math.abs(det) < 1e-9) return null;
    const gx = (xz * yy - yz * xy) / det, gy = (yz * xx - xz * xy) / det;
    return { gx, gy, mag: Math.hypot(gx, gy), bearingDeg: (Math.atan2(gx, gy) * 180 / Math.PI + 360) % 360, n };
  }
  function windowAnalysis({ i, r, cell, index, A, crits, lat, lon, tvs, ranges }) {
    const W = neighbourhood({ i, r, cell, index }), valid = W.filter(w => w.k >= 0);
    const perCrit = {};
    for (const c of crits) {
      const vals = valid.map(w => A[c][w.k]);
      const pts = valid.map(w => ({ x: haversine(lat[i], lon[i], lat[i], lon[w.k]) * Math.sign(w.dc), y: haversine(lat[i], lon[i], lat[w.k], lon[i]) * Math.sign(w.dr), z: A[c][w.k] }));
      const sims = {};
      for (const [tid, tv] of Object.entries(tvs || {})) {
        if (tv[c] == null) { sims[tid] = null; continue; }
        const R = ranges[c], span = R[1] - R[0];
        sims[tid] = W.map(w => { if (w.k < 0) return null; const x = A[c][w.k]; if (x - x !== 0) return null; const s = 1 - Math.abs(x - tv[c]) / span; return s < 0 ? 0 : (s > 1 ? 1 : s); });
      }
      perCrit[c] = { stats: stats(vals), centre: A[c][i], gradient: planeGradient(pts), sims,
                     validFraction: W.length ? vals.filter(x => x - x === 0).length / W.length : NaN };
    }
    return { window: W, cellsTotal: W.length, cellsValid: valid.length, perCrit };
  }

  /* ------------------------------------------------------------------ requirements */
  /* Every requirement is USER-DEFINED. The variable registry states dataset, statistic, unit, resolution
   * and temporal coverage; evaluation never treats missing data as a match. */
  const REQ_STATUS = { MEETS: "Meets the specified analytical condition", FAILS: "Does not meet the specified analytical condition",
    PARTIAL: "Partially supported", CANNOT: "Cannot be evaluated with available evidence" };
  function testValue(op, v, x) {
    if (op === "<=") return v <= x;
    if (op === ">=") return v >= x;
    if (op === "between") return v >= x[0] && v <= x[1];
    throw new Error("unknown operator " + op);
  }
  function validateRequirement(req, registry) {
    const V = registry[req.variable]; if (!V) throw new Error("unknown variable " + req.variable);
    if (!["<=", ">=", "between"].includes(req.op)) throw new Error("operator must be <=, >= or between");
    if (req.op === "between") { if (!Array.isArray(req.value) || req.value.length !== 2 || !req.value.every(Number.isFinite) || req.value[0] > req.value[1]) throw new Error("between needs [lo, hi] with lo <= hi"); }
    else if (!Number.isFinite(req.value)) throw new Error("threshold must be a finite number");
    for (const k of ["requiredResolutionKm", "requiredYears", "minAreaKm2"]) if (req[k] != null && !(Number.isFinite(req[k]) && req[k] > 0)) throw new Error(k + " must be a positive number");
    return V;
  }
  /* ctx: {A, cell, index, lat, lon, cellAreaKm2(i), cellSizeKm(i) -> [dy,dx]} */
  function evaluateRequirement(req, i, registry, ctx) {
    const V = validateRequirement(req, registry), v = V.get(ctx.A, i), why = [], gaps = [];
    if (!(v - v === 0)) return { status: "CANNOT", value: null, why: ["No finite value for this cell (" + V.dataset + ")."], gaps: ["Missing " + V.label + " at this cell."] };
    let ok = testValue(req.op, v, req.value), status = ok ? "MEETS" : "FAILS";
    why.push(`${V.statistic} = ${v.toFixed(V.fmt)} ${V.unit} ${ok ? "satisfies" : "does not satisfy"} ${req.op} ${Array.isArray(req.value) ? req.value.join("–") : req.value} ${V.unit}.`);
    let area = null;
    if (req.minAreaKm2 != null) {
      if (!ok) why.push("Candidate cell itself fails the condition, so no qualifying area contains it.");
      else {
        area = connectedArea(i, cc => { const x = V.get(ctx.A, cc); return x - x === 0 && testValue(req.op, x, req.value); }, ctx);
        if (area.km2 < req.minAreaKm2) { status = "FAILS"; why.push(`Contiguous qualifying area ${Math.round(area.km2).toLocaleString()} km² (${area.cells} cells, 8-connected, cell-mean values) < required ${req.minAreaKm2.toLocaleString()} km².`); }
        else why.push(`Contiguous qualifying area ${Math.round(area.km2).toLocaleString()} km² (${area.cells} cells) ≥ required ${req.minAreaKm2.toLocaleString()} km².`);
      }
    }
    if (req.requiredResolutionKm != null) {
      const [dy, dx] = ctx.cellSizeKm(i), res = Math.max(dy, dx);
      if (res > req.requiredResolutionKm) {
        gaps.push(`Required spatial resolution ${req.requiredResolutionKm} km is finer than the data (${V.resolution}; this cell ≈ ${dy.toFixed(0)} × ${dx.toFixed(0)} km).`);
        why.push(`The condition was tested on a cell-mean statistic only; it cannot be verified at the required ${req.requiredResolutionKm} km scale.`);
        status = "PARTIAL";
      }
    }
    if (req.requiredYears != null) {
      if (V.years == null) { gaps.push(`${V.label} is static (no time series); a ${req.requiredYears}-year temporal requirement cannot be assessed.`); status = status === "CANNOT" ? status : "PARTIAL"; }
      else if (V.years < req.requiredYears) { gaps.push(`Data span ${V.years} years < required ${req.requiredYears} years (${V.temporal}).`); status = "PARTIAL"; }
    }
    return { status, value: v, why, gaps, area, ok };
  }
  function connectedArea(i, test, ctx, maxCells = 20000) {
    const nlon = 576, seen = new Set([i]), q = [i]; let km2 = 0, cells = 0;
    while (q.length && cells < maxCells) {
      const k = q.shift(); cells++; km2 += ctx.cellAreaKm2(k);
      const c = ctx.cell[k], row = Math.floor(c / nlon), col = c % nlon;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue; const rr = row + dr; if (rr < 0 || rr > 360) continue;
        const j = ctx.index[rr * nlon + ((col + dc) % nlon + nlon) % nlon];
        if (j >= 0 && !seen.has(j)) { seen.add(j); if (test(j)) q.push(j); }
      }
    }
    return { km2, cells, truncated: q.length > 0 };
  }

  /* ------------------------------------------------------------------ temporal statistics */
  function theilSen(xs, ys) {
    const P = xs.map((x, k) => [x, ys[k]]).filter(p => p[1] - p[1] === 0); if (P.length < 3) return null;
    const sl = []; for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) if (P[b][0] !== P[a][0]) sl.push((P[b][1] - P[a][1]) / (P[b][0] - P[a][0]));
    sl.sort((a, b) => a - b); const m = sl.length;
    const slope = m % 2 ? sl[(m - 1) / 2] : (sl[m / 2 - 1] + sl[m / 2]) / 2;
    const ints = P.map(p => p[1] - slope * p[0]).sort((a, b) => a - b), n = ints.length;
    return { slope, intercept: n % 2 ? ints[(n - 1) / 2] : (ints[n / 2 - 1] + ints[n / 2]) / 2, n: P.length };
  }
  function normCdf(z) {                      // Abramowitz-Stegun 7.1.26 erf approximation (|err| < 1.5e-7)
    const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
    return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
  }
  /* Mann-Kendall test with tie correction and continuity correction; normal approximation. */
  function mannKendall(ys) {
    const v = ys.filter(y => y - y === 0), n = v.length; if (n < 4) return null;
    let S = 0; for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) S += Math.sign(v[b] - v[a]);
    const counts = new Map(); for (const y of v) counts.set(y, (counts.get(y) || 0) + 1);
    let tie = 0; for (const t of counts.values()) if (t > 1) tie += t * (t - 1) * (2 * t + 5);
    const varS = (n * (n - 1) * (2 * n + 5) - tie) / 18;
    const z = varS > 0 ? (S > 0 ? (S - 1) / Math.sqrt(varS) : S < 0 ? (S + 1) / Math.sqrt(varS) : 0) : 0;
    const p = 2 * (1 - normCdf(Math.abs(z)));
    return { S, varS, z, p, n, tau: S / (n * (n - 1) / 2) };
  }
  /* First-harmonic fit to 12 monthly values (equal month weights). Amplitude in input units. */
  function harmonic(m12) {
    const v = m12.filter(x => x - x === 0); if (v.length !== 12) return null;
    let a = 0, b = 0, mean = 0; for (let k = 0; k < 12; k++) mean += m12[k] / 12;
    for (let k = 0; k < 12; k++) { const th = 2 * Math.PI * (k + 0.5) / 12; a += (m12[k] - mean) * Math.cos(th) * 2 / 12; b += (m12[k] - mean) * Math.sin(th) * 2 / 12; }
    const amp = Math.hypot(a, b); let phase = Math.atan2(b, a) / (2 * Math.PI) * 12 - 0.5; phase = ((phase % 12) + 12) % 12;
    let ss = 0, sr = 0; for (let k = 0; k < 12; k++) { const th = 2 * Math.PI * (k + 0.5) / 12, f = mean + a * Math.cos(th) + b * Math.sin(th); ss += (m12[k] - mean) ** 2; sr += (m12[k] - f) ** 2; }
    return { mean, amplitude: amp, peakMonth: phase, varianceExplained: ss > 0 ? 1 - sr / ss : NaN };
  }

  /* ------------------------------------------------------------------ scientific language review */
  const GUARDRAILS = [
    { re: /\b(scientifically\s+)?identical\b/gi, issue: "Equivalence claim", prefer: "similar under the selected modelled criteria" },
    { re: /\bcertif(ied|y|ication)\b/gi, issue: "Certification claim", prefer: "potential terrestrial analogue for further investigation" },
    { re: /\bsafe(ty)?\b/gi, issue: "Safety claim — not assessed by ASTERRO", prefer: "safety was not assessed" },
    { re: /\bconfirmed\s+suitable\b|\bsuitable\s+for\s+(astronaut|crew|mission)/gi, issue: "Suitability claim", prefer: "additional evidence is required" },
    { re: /\bvalidated\b|\bvalidation\s+shows\b/gi, issue: "Validation claim — no ranking has been validated against field studies", prefer: "unvalidated" },
    { re: /\bhabitab(le|ility)\b/gi, issue: "Habitability is not modelled", prefer: "habitability is outside the model" },
    { re: /\bNASA[-\s](approved|endorsed|validated|certified)\b|\bendorsed\s+by\s+NASA\b/gi, issue: "Authority claim without evidence", prefer: "built from NASA data products" },
    { re: /\bproves?\b|\bproof\b/gi, issue: "Proof language", prefer: "is consistent with" },
    { re: /\bguarantee[sd]?\b/gi, issue: "Guarantee language", prefer: "under the stated assumptions" },
    { re: /\b(best|optimal)\s+(site|analogue|location)\b/gi, issue: "Optimality claim — no global optimisation problem is defined", prefer: "highest-ranked under the current weighting profile" },
    { re: /\bprobability\b|\bconfidence\s+interval\b/gi, issue: "Probabilistic claim — no probability model is defined for scores", prefer: "sensitivity range over documented alternatives" },
    { re: /\bwill\s+(remain|be|become)\b.*\b(in\s+20\d\d|future)\b/gi, issue: "Future projection — not supported", prefer: "historical observations only" },
  ];
  function reviewText(text) {
    const out = [];
    for (const g of GUARDRAILS) { g.re.lastIndex = 0; let m; while ((m = g.re.exec(text))) out.push({ at: m.index, match: m[0], issue: g.issue, prefer: g.prefer }); }
    return out.sort((a, b) => a.at - b.at);
  }

  const api = { VERSION, EVIDENCE, CATEGORY_HELP, COMPLETENESS, claim, canonical, sha256Hex, mulberry32,
    prepare, fieldScore, crossEff, effFor, candidateRanks, countEligible, BOUNDS, inBounds,
    designFactorial, designOAT, designSampled, designAblation, runDesign, runDesignSync, rankStats, CLASS_LABEL,
    oatSensitivity, pairFlips, ablation, spearman, quantile, pareto, normVec, envDist, haversine, portfolioMetrics,
    diversePortfolio, neighbourhood, stats, planeGradient, windowAnalysis, REQ_STATUS, validateRequirement,
    evaluateRequirement, connectedArea, theilSen, mannKendall, normCdf, harmonic, GUARDRAILS, reviewText };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.AsterroLab = api;
})(typeof window !== "undefined" ? window : globalThis);
