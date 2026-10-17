/* ASTERRO Phase III — Planetary Target Atlas engine (browser + Node).
 *
 * Pure, deterministic functions shared by every Phase III module. They sit BESIDE the baseline
 * engine (engine.js / TAIEngine) and the Phase II laboratory engine (lab_engine.js / AsterroLab):
 *   - scoring reuses AsterroLab.prepare / fieldScore, i.e. the baseline formula and accumulation
 *     order, with an explicit target vector and an explicit, versioned normalisation table;
 *   - the baseline Analogue Score, weights, ranges and ranking are never read-modified-written;
 *   - every result carries the readiness level and criterion statuses it was computed from;
 *   - a missing value is never scored, never treated as a match, never imputed.
 * No randomness except the seeded sampler inherited from AsterroLab. No learned or generative model.
 */
(function (root) {
  "use strict";
  const LAB = root.AsterroLab || (typeof require === "function" ? require("../phase2/lab_engine.js") : null);
  const VERSION = "asterro-phase3-0.1.0";
  const CONTRACT = "asterro.experiment/2";
  const STATUS = ["DIRECT", "DERIVED", "PROXY", "MISSING", "INCOMPATIBLE", "UNVALIDATED"];
  const SCOREABLE = { DIRECT: true, DERIVED: true };          // PROXY only on explicit request; never the others

  /* ------------------------------------------------------------------ target vectors + eligibility */
  function targetVector(t, critIds, { includeProxy = false } = {}) {
    const tv = {};
    for (const c of critIds) {
      const s = t.status[c], v = t.values[c];
      tv[c] = (SCOREABLE[s] || (includeProxy && s === "PROXY")) && v != null && Number.isFinite(+v) ? +v : null;
    }
    return tv;
  }
  function eligibility(t, critIds) {
    /* Readiness (Phase IV model 3.0.0, and the Phase III v1 rule — same thresholds): L1 catalogued, never ranked;
     * L2 partially characterized → partial comparison on DIRECT criteria only; L3+ full. A record carrying the
     * transitional model 2.0.0 (levels 0–4) is read with its own thresholds (L0 none, L1–L2 partial). */
    const lvl = t.readiness.level, m2 = t.readiness.model === "2.0.0";
    const direct = critIds.filter(c => SCOREABLE[t.status[c]]);
    if ((m2 ? lvl < 1 : lvl < 2) || !direct.length) return { ok: false, mode: "none", reason: `Readiness level ${lvl}: no analytical data / no directly comparable criterion. Excluded from every ranking.` };
    const terrainOnly = direct.every(c => c === "slope" || c === "surface_roughness");
    if (m2 ? lvl <= 2 : lvl === 2) return { ok: true, mode: terrainOnly ? "partial-terrain" : "partial", direct,
      reason: `Readiness level ${lvl}: only ${direct.length} directly comparable criteria (${direct.join(", ")}). Results are an exploratory partial comparison, not a six-variable ranking.` };
    return { ok: true, mode: "full", direct, reason: `Readiness level ${lvl}: ${direct.length} directly comparable criteria.` };
  }

  /* ------------------------------------------------------------------ normalisation alternatives */
  /* atlas: the versioned table shipped in atlas.json (Earth ∪ all atlas targets).
   * baseline: the baseline table (Earth ∪ the two baseline targets).
   * target: Earth ∪ this target only (rankings independent of the rest of the catalogue).
   * earth: Earth only; a target outside Earth's range is clipped to similarity 0 on that criterion. */
  function earthRange(A, c) {
    let lo = Infinity, hi = -Infinity; const e = A[c];
    for (let i = 0; i < e.length; i++) { const x = e[i]; if (x - x !== 0) continue; if (x < lo) lo = x; if (x > hi) hi = x; }
    return [lo, hi];
  }
  function rangesFor(kind, { A, critIds, atlas, baselineRanges, tv }) {
    const out = {};
    for (const c of critIds) {
      if (kind === "atlas") out[c] = atlas.normalisation.ranges[c].slice();
      else if (kind === "baseline") out[c] = baselineRanges[c].slice();
      else {
        const r = earthRange(A, c);
        if (kind === "target" && tv && tv[c] != null) { r[0] = Math.min(r[0], tv[c]); r[1] = Math.max(r[1], tv[c]); }
        out[c] = r;
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ scoring */
  function prepareTarget(A, critIds, t, ranges, opts = {}) {
    const tv = targetVector(t, critIds, opts);
    if (!Object.values(tv).some(v => v != null)) throw new Error(t.id + ": no scoreable criterion");
    return Object.assign(LAB.prepare(A, critIds, tv, ranges), { tv, targetId: t.id });
  }
  function scoreTarget(P, w) { return LAB.fieldScore(P, w); }
  function order(eff, cell) {
    const n = eff.length, idx = new Int32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    idx.sort((a, b) => (eff[b] - eff[a]) || (cell[a] - cell[b]));
    return idx;
  }
  function haversine(la1, lo1, la2, lo2) {
    const r = Math.PI / 180, p1 = la1 * r, p2 = la2 * r, dp = p2 - p1, dl = (lo2 - lo1) * r;
    let a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    a = a < 0 ? 0 : (a > 1 ? 1 : a);
    return 2 * 6371.0088 * Math.asin(Math.sqrt(a));
  }
  /* greedy 300 km non-maximum suppression: identical to the baseline distinct-site rule */
  function distinct(eff, cell, lat, lon, n = 20, sep = 300) {
    const o = order(eff, cell), kept = [];
    for (let k = 0; k < o.length && kept.length < n; k++) {
      const i = o[k]; if (eff[i] < 0) break;
      let ok = true;
      for (const j of kept) if (haversine(lat[i], lon[i], lat[j], lon[j]) < sep) { ok = false; break; }
      if (ok) kept.push(i);
    }
    return kept;
  }
  function candidates({ A, cell, lat, lon, critIds, t, ranges, w, n = 20, sep = 300, includeProxy = false }) {
    const el = eligibility(t, critIds);
    if (!el.ok) return { eligible: false, reason: el.reason, mode: el.mode };
    const P = prepareTarget(A, critIds, t, ranges, { includeProxy });
    const F = scoreTarget(P, w);
    const top = distinct(F.eff, cell, lat, lon, n, sep);
    let elig = 0, near = 0; const best = top.length ? F.eff[top[0]] : -1;
    for (let i = 0; i < F.eff.length; i++) { if (F.eff[i] >= 0) elig++; if (best >= 0 && F.eff[i] >= best - 0.001) near++; }
    /* saturation: when many cells score within 0.1 pt of the best, their order is set by the tie-break
     * (cell id), not by evidence — typical of terrain-only comparisons of flat plains. */
    return { eligible: true, mode: el.mode, reason: el.reason, P, eff: F.eff, coverage: F.coverage, active: F.active, top, nEligible: elig,
      nNearTop: near, saturated: near > 2 * n };
  }

  /* per-candidate explanation: criterion similarity, contribution, raw difference, out-of-Earth-range flags */
  function explain(P, w, i, A, ranges) {
    const act = P.applicable.filter(c => w[c] != null && +w[c] > 0);
    let ws = 0; for (const c of act) if (P.s[c][i] === P.s[c][i]) ws += +w[c];
    return act.map(c => {
      const s = P.s[c][i], e = A[c][i], t = P.tv[c];
      return { criterion: c, earth: e - e === 0 ? +e : null, target: t, similarity: s === s ? s : null,
        contribution: s === s && ws > 0 ? +w[c] * s / ws : null, diff: e - e === 0 ? e - t : null,
        normDiff: e - e === 0 ? Math.abs(e - t) / (ranges[c][1] - ranges[c][0]) : null };
    });
  }
  function outsideEarth(A, critIds, tv) {
    const out = [];
    for (const c of critIds) {
      if (tv[c] == null) continue;
      const [lo, hi] = earthRange(A, c);
      if (tv[c] > hi) out.push({ criterion: c, side: "above", earthMax: hi, target: tv[c], gap: tv[c] - hi });
      else if (tv[c] < lo) out.push({ criterion: c, side: "below", earthMin: lo, target: tv[c], gap: lo - tv[c] });
    }
    return out;
  }

  /* ------------------------------------------------------------------ stability (Phase II robustness on atlas targets) */
  function stability({ A, cell, critIds, t, ranges, w, cand, factors = [0.5, 1, 2], topN = 20, topPct = 1, includeProxy = false }) {
    const P = prepareTarget(A, critIds, t, ranges, { includeProxy });
    const act = P.applicable.filter(c => w[c] != null && +w[c] > 0);
    const design = LAB.designFactorial(w, act, critIds, factors);
    const run = LAB.runDesignSync({ Ps: [P], cell, cand, baseW: w, design });
    const st = LAB.rankStats(run, { topN, topPct });
    return { design: design.length, active: act, stats: st, run };
  }

  /* ------------------------------------------------------------------ distinguishing dimensions between targets */
  function distinguishing(targets, critIds, ranges) {
    const rows = critIds.map(c => {
      const span = ranges[c][1] - ranges[c][0];
      const vals = targets.map(t => ({ id: t.id, status: t.status[c], v: SCOREABLE[t.status[c]] && t.values[c] != null ? +t.values[c] : null }));
      const known = vals.filter(x => x.v != null);
      const proxyAll = targets.every(t => t.status[c] === "PROXY");
      let spread = null, pairs = [];
      if (known.length >= 2) {
        const xs = known.map(x => x.v); spread = (Math.max(...xs) - Math.min(...xs)) / span;
        for (let a = 0; a < known.length; a++) for (let b = a + 1; b < known.length; b++)
          pairs.push({ a: known[a].id, b: known[b].id, normDiff: Math.abs(known[a].v - known[b].v) / span, diff: known[a].v - known[b].v });
      }
      const missing = vals.filter(x => x.v == null && !["PROXY", "INCOMPATIBLE"].includes(x.status)).map(x => x.id);
      const incompatible = vals.filter(x => x.status === "INCOMPATIBLE").map(x => x.id);
      let verdict;
      if (proxyAll) verdict = "NOT_DISTINGUISHING_PROXY";
      else if (known.length < 2) verdict = "NOT_COMPARABLE";
      else if (missing.length || incompatible.length) verdict = "PARTIALLY_COMPARABLE";
      else verdict = "COMPARABLE";
      return { criterion: c, values: vals, spread, pairs, missing, incompatible, verdict };
    });
    const ranked = rows.filter(r => r.spread != null).sort((x, y) => y.spread - x.spread || (x.criterion < y.criterion ? -1 : 1));
    return { rows, ranked };
  }

  /* ------------------------------------------------------------------ complementary + shared candidates */
  /* shared: cells scoring well for every selected target (min rule, as the baseline cross-planet ranking).
   * complementary: one candidate per target, each the best for that target that is >= sep km from
   * those already chosen; reports what each adds. Both use the effective scores of each target. */
  function shared(effs, cell, lat, lon, n = 10, sep = 300) {
    const m = effs[0].length, out = new Float64Array(m);
    for (let i = 0; i < m; i++) {
      let v = Infinity;
      for (const e of effs) { if (e[i] < 0) { v = -1; break; } if (e[i] < v) v = e[i]; }
      out[i] = v;
    }
    return { eff: out, top: distinct(out, cell, lat, lon, n, sep) };
  }
  function complementary(results, cell, lat, lon, sep = 300) {
    const chosen = [];
    for (const r of results) {
      if (!r.eligible) { chosen.push({ target: r.targetId, index: null, reason: r.reason }); continue; }
      const o = order(r.eff, cell); let pick = null;
      for (let k = 0; k < o.length; k++) {
        const i = o[k]; if (r.eff[i] < 0) break;
        if (chosen.every(c => c.index == null || haversine(lat[i], lon[i], lat[c.index], lon[c.index]) >= sep)) { pick = i; break; }
      }
      chosen.push({ target: r.targetId, index: pick, score: pick == null ? null : r.eff[pick],
        scoresForOthers: results.map(q => ({ target: q.targetId, score: pick == null || !q.eligible ? null : q.eff[pick] })) });
    }
    return chosen;
  }

  /* ------------------------------------------------------------------ missing evidence + discriminating measurements */
  function missingEvidence(t, critIds, w) {
    let wAll = 0; for (const c of critIds) wAll += +(w[c] || 0);
    const items = [];
    for (const c of critIds) {
      const s = t.status[c];
      if (SCOREABLE[s]) continue;
      items.push({ criterion: c, status: s, reason: t.status_reason[c], weightShare: wAll > 0 ? +(w[c] || 0) / wAll : 0,
        action: s === "MISSING" ? "Assemble a compatible product (same definition as the Earth criterion) for this location."
          : s === "UNVALIDATED" ? "Resolve the quality issue before the value can be used."
          : s === "PROXY" ? "Proxy by rule; cannot distinguish targets. Not a measurement gap that a dataset can close."
          : "No compatible counterpart exists; this dimension cannot be compared." });
    }
    const D = t.anchor && t.anchor.gazetteer && t.anchor.gazetteer.diameter_km;
    if (t.terrain && !t.terrain.heterogeneity && t.kind === "named_feature" && D && D > 55.6) items.push({ criterion: "heterogeneity", status: "MISSING", weightShare: 0,
      reason: "A single 55.6 km window represents this feature; between-location variability was not sampled.", action: "Sample additional windows across the feature." });
    return items.sort((a, b) => b.weightShare - a.weightShare || (a.criterion < b.criterion ? -1 : 1));
  }
  /* For a target with a MISSING criterion: how much would the current candidate list change if the
   * value were each of a set of SCENARIO values (explicitly labelled; e.g. the values observed at
   * other targets on the same body)? Large change = a discriminating measurement. */
  function measurementImpact({ A, cell, lat, lon, critIds, t, ranges, w, criterion, scenarios, n = 20, sep = 300 }) {
    const base = candidates({ A, cell, lat, lon, critIds, t, ranges, w, n, sep });
    if (!base.eligible) return { criterion, blocked: base.reason };
    const baseSet = new Set(base.top);
    const out = scenarios.map(sc => {
      const t2 = { ...t, values: { ...t.values, [criterion]: sc.value }, status: { ...t.status, [criterion]: "DIRECT" }, readiness: { ...t.readiness, level: Math.max(2, t.readiness.level) } };
      const r2 = { ...ranges, [criterion]: [Math.min(ranges[criterion][0], sc.value), Math.max(ranges[criterion][1], sc.value)] };
      const res = candidates({ A, cell, lat, lon, critIds, t: t2, ranges: r2, w, n, sep });
      const kept = res.top.filter(i => baseSet.has(i)).length;
      return { label: sc.label, value: sc.value, overlap: kept / Math.max(1, base.top.length), newTop: res.top[0], baseTop: base.top[0], top: res.top };
    });
    const minOverlap = out.length ? Math.min(...out.map(o => o.overlap)) : 1;
    /* agreement between scenarios: if different plausible values give different lists, the actual
     * value matters (a discriminating measurement); if all scenarios agree, measuring it mainly
     * adds a dimension without changing which sites are preferred. */
    let agreement = null;
    for (let a = 0; a < out.length; a++) for (let b = a + 1; b < out.length; b++) {
      const sb = new Set(out[b].top), ov = out[a].top.filter(i => sb.has(i)).length / Math.max(1, out[a].top.length);
      agreement = agreement == null ? ov : Math.min(agreement, ov);
    }
    return { criterion, scenarios: out, minOverlap, agreement, discriminating: agreement != null ? agreement < 0.5 : minOverlap < 0.5 };
  }

  /* ------------------------------------------------------------------ extremes (Earth stack, explainable) */
  function median(a) { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; }
  function robustZ(A, critIds) {
    const Z = {}, M = {};
    for (const c of critIds) {
      const e = A[c], vals = [];
      for (let i = 0; i < e.length; i++) if (e[i] - e[i] === 0) vals.push(+e[i]);
      const med = median(vals), mad = median(vals.map(v => Math.abs(v - med))) * 1.4826;
      M[c] = { median: med, mad, n: vals.length };
      const z = new Float64Array(e.length);
      for (let i = 0; i < e.length; i++) z[i] = e[i] - e[i] === 0 && mad > 0 ? (e[i] - med) / mad : NaN;
      Z[c] = z;
    }
    return { Z, M };
  }
  /* regime = per-criterion tercile code (L/M/H) over the criteria chosen; explainable by construction */
  function regimes(A, critIds) {
    const cuts = {};
    for (const c of critIds) {
      const e = A[c], vals = [];
      for (let i = 0; i < e.length; i++) if (e[i] - e[i] === 0) vals.push(+e[i]);
      vals.sort((x, y) => x - y);
      cuts[c] = [vals[Math.floor(vals.length / 3)], vals[Math.floor(2 * vals.length / 3)]];
    }
    const n = A[critIds[0]].length, code = new Array(n), count = new Map();
    for (let i = 0; i < n; i++) {
      let s = "";
      for (const c of critIds) { const x = A[c][i]; s += x - x !== 0 ? "?" : (x < cuts[c][0] ? "L" : x < cuts[c][1] ? "M" : "H"); }
      code[i] = s; count.set(s, (count.get(s) || 0) + 1);
    }
    return { cuts, code, count };
  }

  /* ------------------------------------------------------------------ landing-site style window analysis (exploratory) */
  /* grid: 60x60 Float32 (row 0 = north). Returns class fractions and the largest 4-connected
   * component meeting slope <= maxSlope (and optional dT range) in km² at 926.6 m bins. */
  const BIN_M = 6371007.2 * Math.PI / 180 / 120;
  function windowClasses(slope, { thresholds = [2, 5, 10, 15, 20, 30], maxSlope = 5, mask = null } = {}) {
    const n = slope.length; let valid = 0; const le = thresholds.map(() => 0);
    for (let i = 0; i < n; i++) { const s = slope[i]; if (s !== s) continue; valid++; thresholds.forEach((X, k) => { if (s <= X) le[k]++; }); }
    const ok = new Uint8Array(n);
    for (let i = 0; i < n; i++) ok[i] = slope[i] === slope[i] && slope[i] <= maxSlope && (!mask || mask[i]) ? 1 : 0;
    const seen = new Uint8Array(n); let best = 0, bestCells = null, comps = 0;
    for (let i = 0; i < n; i++) {
      if (!ok[i] || seen[i]) continue;
      comps++; const q = [i]; seen[i] = 1; const cells = [];
      while (q.length) {
        const k = q.pop(); cells.push(k);
        const r = (k / 60) | 0, cc = k % 60;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr, c2 = cc + dc; if (rr < 0 || rr >= 60 || c2 < 0 || c2 >= 60) continue;
          const j = rr * 60 + c2; if (ok[j] && !seen[j]) { seen[j] = 1; q.push(j); }
        }
      }
      if (cells.length > best) { best = cells.length; bestCells = cells; }
    }
    const binKm2 = (BIN_M / 1000) ** 2;
    return { valid, total: n, fracLe: thresholds.map((X, k) => ({ deg: X, frac: valid ? le[k] / valid : null })),
      components: comps, largestKm2: best * binKm2, largestCells: bestCells || [], binKm2, maxSlope };
  }

  /* ------------------------------------------------------------------ experiment contract v2 + v1 adapter */
  function recordConfigV2(r) {
    return { schema: r.schema, contract: r.contract, module: r.module, context: r.context, params: r.params };
  }
  /* v1 → v2: lossless; the v1 baseline block becomes context.baseline, target becomes context.targets */
  function adaptV1(r) {
    if (!r || r.schema !== "asterro.experiment/1") throw new Error("not an asterro.experiment/1 record");
    return {
      schema: CONTRACT, contract: "2.0.0", module: r.module,
      context: { kind: "baseline-target", targets: [r.baseline.target], baseline: r.baseline, atlas: null, workflow_stage: null },
      params: r.params, id_v1: r.id, created_utc: r.created_utc, outputs: r.outputs, outputs_sha256: r.outputs_sha256,
      limitations: r.limitations || [], claims: r.claims || [], parents: r.parent ? [r.parent] : [], replay: r.replay, software: r.software,
      adapted_from: "asterro.experiment/1",
    };
  }
  function validateV2(r) {
    const issues = [];
    if (!r || r.schema !== CONTRACT) issues.push("schema must be " + CONTRACT);
    for (const k of ["module", "context", "params", "outputs", "outputs_sha256"]) if (!r || r[k] === undefined) issues.push("missing " + k);
    if (r && r.context && !Array.isArray(r.context.targets)) issues.push("context.targets must be an array");
    if (r && r.claims) for (const c of r.claims) { try { LAB.claim(c); } catch (e) { issues.push(e.message); } }
    return issues;
  }

  /* ------------------------------------------------------------------ workflow stages */
  const STAGES = ["target", "candidate", "evidence", "robustness", "requirements", "measurements", "plan", "record"];
  /* returns per-stage status: READY / DONE / BLOCKED (with the analytical boundary that stops it) */
  function workflowState(ctx) {
    const t = ctx.target, out = [];
    const block = (s, why) => out.push({ stage: s, status: "BLOCKED", why });
    if (!t) { STAGES.forEach(s => block(s, "Select a target.")); return out; }
    out.push({ stage: "target", status: "DONE", why: `${t.name} · readiness L${t.readiness.level}` });
    if (!eligibility(t, Object.keys(t.status)).ok) { STAGES.slice(1).forEach(s => block(s, `Readiness level ${t.readiness.level}: no comparable criteria. Stop: assemble target data first.`)); return out; }
    out.push({ stage: "candidate", status: ctx.candidate != null ? "DONE" : "READY", why: ctx.candidate != null ? "Candidate selected." : "Choose an Earth candidate." });
    if (ctx.candidate == null) { STAGES.slice(2).forEach(s => block(s, "Needs a candidate.")); return out; }
    out.push({ stage: "evidence", status: "DONE", why: "Evidence record assembled from statuses and provenance." });
    out.push({ stage: "robustness", status: ctx.stability ? "DONE" : "READY", why: ctx.stability ? "Weight-perturbation stability computed." : "Run stability." });
    out.push({ stage: "requirements", status: ctx.requirements ? "DONE" : "READY", why: ctx.requirements ? "Requirements evaluated." : "Optional: define user requirements." });
    const gaps = ctx.gaps || [];
    out.push({ stage: "measurements", status: "DONE", why: gaps.length ? `${gaps.length} evidence gap(s) listed.` : "No gap among scoreable criteria." });
    out.push({ stage: "plan", status: ctx.plan ? "DONE" : "READY", why: ctx.plan ? "Plan drafted." : "Draft a research plan." });
    out.push({ stage: "record", status: ctx.record ? "DONE" : (ctx.plan ? "READY" : "BLOCKED"), why: ctx.record ? "Saved to the vault." : (ctx.plan ? "Save the record." : "Needs a plan.") });
    return out;
  }

  /* ------------------------------------------------------------------ copilot (deterministic, evidence-grounded) */
  const CANNOT = "I cannot determine that from the available evidence.";
  /* Answers only questions whose answer is a lookup in the evidence index; otherwise CANNOT.
   * index: [{id, kind, target, criterion, text, category}] built from atlas statuses, values, provenance. */
  function copilotAnswer(question, index) {
    const q = String(question || "").toLowerCase();
    const forbidden = /(safe to land|certif|guarantee|approved|habitable|life|best landing|will it work|cost|travel|visa|permit)/;
    if (forbidden.test(q)) return { text: CANNOT + " ASTERRO does not assess safety, certification, habitability, cost, travel or permits.", cites: [] };
    const tHits = index.filter(e => e.target && (e.aliases || [String(e.targetName).toLowerCase()]).some(a => a && q.includes(a)));
    const crit = [["thermal", "lst_diurnal_range"], ["diurnal", "lst_diurnal_range"], ["lst", "lst_diurnal_range"], ["annual", "annual_temperature_range"],
      ["season", "annual_temperature_range"], ["slope", "slope"], ["rough", "surface_roughness"], ["elevation", "elevation"], ["arid", "aridity"]]
      .filter(([k]) => q.includes(k)).map(([, c]) => c);
    let hits = tHits.length ? tHits : index;
    if (crit.length) hits = hits.filter(e => crit.includes(e.criterion));
    if (/missing|gap|lack|unknown/.test(q)) hits = hits.filter(e => ["MISSING", "INCOMPATIBLE", "UNVALIDATED"].includes(e.status));
    if (/readiness|level/.test(q)) hits = hits.filter(e => e.kind === "readiness");
    if (!tHits.length && !crit.length && !/readiness|level|missing|gap/.test(q)) return { text: CANNOT, cites: [] };
    if (!hits.length || hits.length > 40) return { text: CANNOT + (hits.length > 40 ? " The question matches too much evidence to answer specifically; name a target and a criterion." : ""), cites: [] };
    return { text: hits.map(h => h.text).join(" "), cites: hits.map(h => h.id) };
  }

  const api = { VERSION, CONTRACT, STATUS, targetVector, eligibility, earthRange, rangesFor, prepareTarget, scoreTarget, order, haversine,
    distinct, candidates, explain, outsideEarth, stability, distinguishing, shared, complementary, missingEvidence, measurementImpact,
    robustZ, regimes, median, windowClasses, BIN_M, recordConfigV2, adaptV1, validateV2, STAGES, workflowState, CANNOT, copilotAnswer };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AsterroAtlas = api;
})(typeof window !== "undefined" ? window : globalThis);
