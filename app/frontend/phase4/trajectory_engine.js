/* ASTERRO — Discovery Trajectory engine (browser + Node).
 *
 * A trajectory is the ordered list of analytical configurations a user actually explored (target, weights,
 * profile), each with the RESULT OF THE DETERMINISTIC ENGINE for that configuration: the effective-score field,
 * the cell ranks and the distinct sites. Nothing here computes a score: the caller supplies engine outputs, and
 * ENG.detail rows for per-criterion contributions. This module only compares results:
 *   analyse()      leading-group membership per state, stable / entered / left / transient candidates,
 *                  rank range and median, "displaced by a nearby site" under the 300 km distinct-site rule
 *   transitions()  for each consecutive pair: the assumptions that changed, movers, entries and exits
 *   decompose()    exact per-criterion decomposition of a score change, ΔS = Σ_c Δk_c (k_c = w_c·s_c / Σw_valid)
 *   separating()   criteria that distinguish two candidates, including ones with weight 0 or missing data
 *   story()        an evidence-backed, calibrated narrative for one candidate (no free text generation)
 * Stability here is WEIGHT/CONFIGURATION SENSITIVITY over the configurations explored — not measurement,
 * data-quality or model uncertainty — and every output says so.
 */
(function (root) {
  "use strict";
  const VERSION = "asterro-trajectory-1.0.0";
  const SCHEMA = "asterro.trajectory/1";
  const SENS_NOTE = "Sensitivity to the analytical configurations in this trajectory (weights / profile / target). It is not measurement, data-quality or model uncertainty.";

  function haversine(la1, lo1, la2, lo2) {
    const r = Math.PI / 180, p1 = la1 * r, p2 = la2 * r, dp = p2 - p1, dl = (lo2 - lo1) * r;
    let a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    a = a < 0 ? 0 : (a > 1 ? 1 : a);
    return 2 * 6371.0088 * Math.asin(Math.sqrt(a));
  }
  const r4 = v => Math.round(+v * 1e4) / 1e4;
  function configKey(s) { return [s.tid, s.config || "", Object.keys(s.weights).sort().map(c => c + ":" + r4(s.weights[c])).join(",")].join("|"); }

  /* assumptions that differ between two configurations */
  function diffConfig(a, b, critIds) {
    const out = [];
    /* the profile is a label derived from the weights and the scoring configuration follows from the target, so
     * neither is counted as a separate assumption (that would turn a one-slider change into a "joint" change) */
    if (a.tid !== b.tid) out.push({ kind: "target", from: a.tid, to: b.tid });
    else if ((a.config || "") !== (b.config || "")) out.push({ kind: "scoring_config", from: a.config || null, to: b.config || null });
    for (const c of critIds) {
      const x = +a.weights[c] || 0, y = +b.weights[c] || 0;
      if (r4(x) !== r4(y)) out.push({ kind: "weight", criterion: c, from: x, to: y, activated: x === 0 && y > 0, deactivated: x > 0 && y === 0 });
    }
    return out;
  }

  /* membership + rank statistics over the trajectory. states[k] = { id, tid, label, weights, eff, rank, distinct } */
  function analyse(states, { K = 10, lat, lon, sep = 300 } = {}) {
    if (!states.length) return { K, states: 0, candidates: [], note: SENS_NOTE };
    const U = [];
    for (const s of states) for (const i of s.distinct.slice(0, K)) if (!U.includes(i)) U.push(i);
    const cands = U.map(i => {
      const pos = states.map(s => { const p = s.distinct.indexOf(i); return p >= 0 && p < K ? p + 1 : null; });
      const ranks = states.map(s => (s.eff[i] >= 0 && s.rank[i] > 0 ? s.rank[i] : null));
      const scores = states.map(s => (s.eff[i] >= 0 ? s.eff[i] : null));
      const displaced = states.map((s, k) => {
        if (pos[k] != null || ranks[k] == null || !lat) return null;
        const G = s.distinct.slice(0, K), cut = G.length ? s.eff[G[G.length - 1]] : Infinity;
        if (!(s.eff[i] >= cut)) return null;                 // its own score would not have qualified it
        for (const j of G) if (j !== i && s.eff[j] >= s.eff[i] && haversine(lat[i], lon[i], lat[j], lon[j]) < sep) return j;
        return null;
      });
      const inG = pos.map(p => p != null), n = inG.filter(Boolean).length;
      const cls = n === states.length ? "stable" : (!inG[0] && inG[inG.length - 1]) ? "entered" : (inG[0] && !inG[inG.length - 1]) ? "left" : "transient";
      const rr = ranks.filter(v => v != null).sort((a, b) => a - b), sc = scores.filter(v => v != null);
      return { i, pos, ranks, scores, displaced, inGroup: n, frequency: n / states.length, class: cls,
        medianRank: rr.length ? (rr.length % 2 ? rr[(rr.length - 1) / 2] : (rr[rr.length / 2 - 1] + rr[rr.length / 2]) / 2) : null,
        bestRank: rr.length ? rr[0] : null, worstRank: rr.length ? rr[rr.length - 1] : null,
        scoreMin: sc.length ? Math.min(...sc) : null, scoreMax: sc.length ? Math.max(...sc) : null,
        ineligibleIn: ranks.filter(v => v == null).length };
    });
    const order = { stable: 0, entered: 1, transient: 2, left: 3 };
    cands.sort((a, b) => (order[a.class] - order[b.class]) || (b.frequency - a.frequency) || ((a.medianRank ?? 1e9) - (b.medianRank ?? 1e9)) || (a.i - b.i));
    return { K, states: states.length, candidates: cands, stable: cands.filter(c => c.class === "stable").map(c => c.i), note: SENS_NOTE };
  }

  /* consecutive transitions: what changed and what it did to the leading group */
  function transitions(states, critIds, { K = 10 } = {}) {
    const out = [];
    for (let k = 1; k < states.length; k++) {
      const a = states[k - 1], b = states[k], A = a.distinct.slice(0, K), B = b.distinct.slice(0, K);
      const entered = B.filter(i => !A.includes(i)), left = A.filter(i => !B.includes(i));
      const sameTarget = a.tid === b.tid;
      const movers = sameTarget ? Array.from(new Set([...A, ...B])).map(i => ({ i, from: a.rank[i] > 0 && a.eff[i] >= 0 ? a.rank[i] : null, to: b.rank[i] > 0 && b.eff[i] >= 0 ? b.rank[i] : null }))
        .map(m => ({ ...m, delta: m.from != null && m.to != null ? m.from - m.to : null })).sort((x, y) => Math.abs(y.delta ?? 0) - Math.abs(x.delta ?? 0)) : [];
      const kept = B.filter(i => A.includes(i)).length;
      out.push({ from: a.id, to: b.id, changes: diffConfig(a, b, critIds), entered, left, overlap: kept / Math.max(1, Math.min(A.length, B.length)),
        topChanged: A[0] !== B[0], movers: movers.slice(0, 8), sameTarget,
        attribution: (() => { const ch = diffConfig(a, b, critIds); return ch.length === 1 ? "single" : ch.length ? "joint" : "none"; })() });
    }
    return out;
  }

  /* exact per-criterion decomposition from two ENG.detail results for the same cell */
  function decompose(dA, dB) {
    const by = d => Object.fromEntries(d.rows.map(r => [r.c, r]));
    const A = by(dA), B = by(dB), rows = [];
    for (const c of Object.keys(A)) {
      const ka = A[c].k ?? 0, kb = (B[c] || {}).k ?? 0;
      rows.push({ criterion: c, kFrom: A[c].k ?? null, kTo: (B[c] || {}).k ?? null, delta: kb - ka, sFrom: A[c].s ?? null, sTo: (B[c] || {}).s ?? null,
        wFrom: A[c].w, wTo: (B[c] || {}).w, activeFrom: !!A[c].active, activeTo: !!(B[c] || {}).active });
    }
    const sum = rows.reduce((t, r) => t + r.delta, 0), dS = (dB.final ?? 0) - (dA.final ?? 0);
    rows.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
    return { rows, deltaScore: dS, sumOfParts: sum, closes: Math.abs(sum - dS) < 1e-12, coverageFrom: dA.coverage, coverageTo: dB.coverage };
  }

  /* what separates two candidates under one configuration; includes inactive (weight 0) and missing criteria */
  function separating(dX, dY) {
    const Y = Object.fromEntries(dY.rows.map(r => [r.c, r]));
    return dX.rows.map(x => {
      const y = Y[x.c] || {};
      const sx = x.s ?? (x.e != null && x.t != null ? Math.max(0, Math.min(1, 1 - Math.abs(x.e - x.t) / (x.hi - x.lo))) : null);
      const sy = y.s ?? (y.e != null && y.t != null ? Math.max(0, Math.min(1, 1 - Math.abs(y.e - y.t) / (y.hi - y.lo))) : null);
      const status = x.t == null ? "target_missing" : (x.e == null || y.e == null) ? "earth_missing" : !x.active ? "inactive" : "active";
      return { criterion: x.c, sX: sx, sY: sy, gap: sx != null && sy != null ? sx - sy : null, status, kX: x.k ?? null, kY: y.k ?? null };
    }).sort((a, b) => Math.abs(b.gap ?? -1) - Math.abs(a.gap ?? -1));
  }

  /* calibrated, evidence-backed narrative; every sentence maps to a number in `ev` */
  function story({ targetName, candidateName, state, detail, cand, thresholds, missingTarget = [], proxies = [], sources = [], K = 10 }) {
    const M = thresholds.match, P = thresholds.partial, rows = detail.rows.filter(r => r.s != null);
    const match = rows.filter(r => r.s >= M), part = rows.filter(r => r.s >= P && r.s < M), miss = rows.filter(r => r.s < P);
    const earthMissing = detail.rows.filter(r => r.active === false && r.e == null && r.t != null && r.w > 0).map(r => r.c);
    const labels = [];
    if (detail.final >= M && miss.length === 0) labels.push("Strong environmental resemblance on the compared criteria");
    else if (detail.final >= P) labels.push("Candidate analogue");
    else labels.push("Weak resemblance under this configuration");
    if (cand && cand.class === "stable" && cand.inGroup >= 3) labels.push(`Robust under the ${cand.inGroup} tested configurations`);
    else if (cand && cand.inGroup <= 1) labels.push("Depends on this configuration");
    if (missingTarget.length || proxies.length || detail.coverage < 1) labels.push("Requires additional characterization");
    const dom = rows.slice().sort((a, b) => b.k - a.k)[0];
    return {
      labels,
      sections: [
        { h: "Target", t: `${targetName}.` },
        { h: "Earth candidate", t: `${candidateName}: score ${(100 * detail.final).toFixed(1)} % (coverage ${(100 * detail.coverage).toFixed(0)} %)${cand ? `; in the leading ${K} for ${cand.inGroup} of ${cand.pos.length} explored configurations, cell rank ${cand.bestRank ?? "—"}–${cand.worstRank ?? "—"}` : ""}.` },
        { h: "What matches", t: match.length ? match.map(r => `${r.c} (s = ${r.s.toFixed(2)})`).join(", ") + "." : "No criterion reaches the match threshold." },
        { h: "Partial matches", t: part.length ? part.map(r => `${r.c} (s = ${r.s.toFixed(2)})`).join(", ") + "." : "None." },
        { h: "Most important mismatches", t: miss.length ? miss.map(r => `${r.c} (s = ${r.s.toFixed(2)}; Earth ${fmt(r.e)} vs target ${fmt(r.t)})`).join(", ") + "." : "No compared criterion falls below the partial threshold." },
        { h: "What dominates the score", t: dom ? `${dom.c} contributes ${(100 * dom.k).toFixed(1)} points of ${(100 * detail.final).toFixed(1)}.` : "—" },
        { h: "Not measured", t: [missingTarget.length ? `not compared — no target measurement: ${missingTarget.join(", ")}` : "", proxies.length ? `scored, but the target value is a rule, not a measurement (proxy): ${proxies.join(", ")}` : "", earthMissing.length ? `not compared — no Earth value in this cell: ${earthMissing.join(", ")}` : ""].filter(Boolean).join("; ") || "Every weighted criterion is a measurement on both sides." },
        { h: "Configuration", t: state ? `${state.label}; weights ${Object.entries(state.weights).map(([c, w]) => `${c} ${(+w).toFixed(2)}`).join(", ")}.` : "" },
        { h: "Data sources", t: sources.join("; ") || "—" },
        { h: "Limitations", t: "Environmental resemblance on these modelled variables only. Gravity, atmosphere, radiation, regolith, chemistry and geology are not compared; cells are 0.5° × 0.625°, far coarser than metre-scale hazards. Not a safety, suitability or habitability assessment." },
        { h: "Next research question", t: miss.length ? `Does ${miss[0].c} disqualify ${candidateName} for the intended study, or can it be bracketed by a second site that matches it?` : missingTarget.length ? `Would a compatible ${missingTarget[0]} measurement for ${targetName} keep ${candidateName} in the leading group?` : `Is ${candidateName} representative at field scale — what do sub-cell data show?` },
      ],
      evidence: { final: detail.final, coverage: detail.coverage, match: match.map(r => r.c), partial: part.map(r => r.c), mismatch: miss.map(r => r.c), dominant: dom ? dom.c : null },
    };
  }
  function fmt(v) { return v == null || v !== v ? "—" : (+v).toFixed(2); }

  /* export: configurations + expected sites (scores to 1e-12); the eff arrays are not exported */
  function exportTrajectory(states, meta, K = 10) {
    return { schema: SCHEMA, engine: VERSION, ...meta, note: SENS_NOTE,
      states: states.map(s => ({ id: s.id, label: s.label, target: s.tid, scoring_config: s.config, profile: s.profile || null, weights: s.weights,
        normalization_ranges: s.ranges, expected_sites: s.distinct.slice(0, K).map(i => ({ cell_id: s.cellIds[i], score: +s.eff[i].toFixed(12) })) })) };
  }
  function validateTrajectory(doc) {
    const e = [];
    if (!doc || doc.schema !== SCHEMA) e.push(`schema must be ${SCHEMA}`);
    if (!doc || !Array.isArray(doc.states) || !doc.states.length) { e.push("states must be a non-empty array"); return e; }
    if (doc.states.length > 24) e.push("at most 24 states");
    doc.states.forEach((s, k) => {
      if (!s || typeof s.target !== "string") e.push(`states[${k}]: target required`);
      if (!s || !s.weights || typeof s.weights !== "object") e.push(`states[${k}]: weights required`);
      else for (const [c, w] of Object.entries(s.weights)) if (!(Number.isFinite(+w) && +w >= 0)) e.push(`states[${k}]: weight ${c} must be finite and ≥ 0`);
      if (s && s.expected_sites && !Array.isArray(s.expected_sites)) e.push(`states[${k}]: expected_sites must be an array`);
    });
    return e;
  }

  const api = { VERSION, SCHEMA, SENS_NOTE, configKey, diffConfig, analyse, transitions, decompose, separating, story, exportTrajectory, validateTrajectory, haversine };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AsterroTrajectory = api;
})(typeof window !== "undefined" ? window : globalThis);
