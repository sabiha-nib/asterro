/* ASTERRO — Discovery Journey engine (browser + Node), asterro-journey-1.0.0.
 *
 * Everything the story-led journey shows is derived here from the unchanged baseline engine (TAIEngine,
 * tai-sim-1.0.0): the same similarity s_c = clip(1 − |e − t| / (max − min)), the same weighted mean, the same
 * coverage rule, the same tie-break (score descending, then cell id) and the same 300 km distinct-site rule.
 * The engine returns DATA ONLY (numbers, ids, keys); the interface turns them into words in the chosen language,
 * so every language shows the same result.
 *
 *   lens         per-criterion state for one Earth cell against one target:
 *                  similar   s ≥ 0.85 (the baseline MATCH threshold)      partial   0.60 ≤ s < 0.85
 *                  different s < 0.60                                     unknown   active, but no Earth value here
 *                  na        the target has no value (not applicable / missing)   off   weight 0 under this objective
 *                and the points each criterion costs: loss_c = w_c (1 − s_c) / Σw, so Σ loss_c = 1 − S exactly.
 *   objectives   the same cell under each declared mission profile: score, cell rank, leading-site position, and
 *                the two criteria that cost it most under that profile.
 *   changeMind   deterministic sensitivity of ONE conclusion ("this place is among the K leading distinct
 *                analogues", or its rank when it is not): every declared profile, leave one Earth source out,
 *                leave the target's proxy values out, leave one criterion out. Each alternative states exactly
 *                which weights changed. Nothing is sampled; nothing is imputed.
 *   team         greedy cover: the fewest distinct Earth places (≥ 300 km apart) that together match every active
 *                criterion (s ≥ 0.85) — and the criteria no place on Earth can match.
 *   missing      plain-language evidence gaps as typed records, each linked to a dataset or a sensitivity result.
 *   trust        an evidence summary as separate rows. There is deliberately NO combined trust score.
 *   passport     asterro.passport/1: a self-contained, re-scorable record of one result.
 * No function here changes a baseline score, weight, range or ranking. */
(function (root) {
  "use strict";
  const ENG = root.TAIEngine || (typeof require === "function" ? require("../engine.js") : null);
  const VERSION = "asterro-journey-1.0.0";
  const STATES = ["similar", "partial", "different", "unknown", "na", "off"];

  /* ---------------------------------------------------------------- fields and ranks (baseline semantics) */
  function field(ctx, w) {
    if (ctx.effFor) return ctx.effFor(w);
    return ENG.similarity(ctx.A, ctx.critIds, ctx.tv, w, ctx.ranges).eff;
  }
  function detail(ctx, i, w) { return ENG.detail(ctx.A, ctx.critIds, i, ctx.tv, w, ctx.ranges); }
  /* 1 + number of cells ordered ahead of i (same tie-break as the baseline sort); null when ineligible */
  function rank(eff, cell, i) {
    if (!(eff[i] >= 0)) return null;
    const e = eff[i], c = cell[i]; let k = 1;
    for (let j = 0; j < eff.length; j++) { const v = eff[j]; if (v > e || (v === e && cell[j] < c)) k++; }
    return k;
  }
  function nEligible(eff) { let n = 0; for (let j = 0; j < eff.length; j++) if (eff[j] >= 0) n++; return n; }
  /* cells ordered ahead of i, sorted with the baseline tie-break */
  function ahead(eff, cell, i) {
    const e = eff[i], c = cell[i], out = [];
    for (let j = 0; j < eff.length; j++) { const v = eff[j]; if (v > e || (v === e && cell[j] < c)) out.push(j); }
    out.sort((a, b) => (eff[b] - eff[a]) || (cell[a] - cell[b]));
    return out;
  }
  /* position of i among the K leading distinct sites (ENG.distinctSites semantics), or null. Cost ∝ rank. */
  function leadPos(eff, ctx, i, K = 10) {
    if (!(eff[i] >= 0)) return null;
    const sep = ctx.sep || 300, kept = [];
    for (const j of ahead(eff, ctx.cell, i)) {
      if (kept.length >= K) return null;
      let ok = true; for (const k of kept) if (ENG.haversine(ctx.lat[j], ctx.lon[j], ctx.lat[k], ctx.lon[k]) < sep) { ok = false; break; }
      if (ok) kept.push(j);
    }
    if (kept.length >= K) return null;
    for (const k of kept) if (ENG.haversine(ctx.lat[i], ctx.lon[i], ctx.lat[k], ctx.lon[k]) < sep) return null;
    return kept.length + 1;
  }
  function leaders(eff, ctx, K = 10) { return ENG.distinctSites(ENG.order(eff, ctx.cell), ctx.lat, ctx.lon, K, ctx.sep || 300).filter(j => eff[j] >= 0); }

  /* ---------------------------------------------------------------- the lens */
  function stateOf(row, thr) {
    if (row.t == null) return "na";
    if (!(row.w > 0)) return "off";
    if (row.e == null) return "unknown";
    return row.s >= thr.match ? "similar" : row.s >= thr.partial ? "partial" : "different";
  }
  function lens(ctx, i, w) {
    const det = detail(ctx, i, w), thr = ctx.thr;
    const rows = det.rows.map(r => {
      const st = stateOf(r, thr);
      return { c: r.c, state: st, s: r.s == null ? null : r.s, e: r.e, t: r.t == null ? null : r.t, w: r.w,
        contribution: r.k == null ? null : r.k, loss: r.s == null || !(det.wsum > 0) ? null : r.w * (1 - r.s) / det.wsum,
        dir: r.s == null || r.e == null || r.t == null ? null : (r.e > r.t ? "higher" : r.e < r.t ? "lower" : "equal"),
        delta: r.s == null ? null : (r.e - r.t) / (r.hi - r.lo), status: (ctx.status || {})[r.c] || null };
    });
    const groups = Object.fromEntries(STATES.map(s => [s, rows.filter(r => r.state === s).map(r => r.c)]));
    const compared = rows.filter(r => r.s != null).length;
    const matter = rows.filter(r => r.loss != null && r.loss > 0).sort((a, b) => (b.loss - a.loss) || (ctx.critIds.indexOf(a.c) - ctx.critIds.indexOf(b.c)));
    return { score: det.final, coverage: det.coverage, rows, groups, compared, matter: matter.map(r => r.c), lossTotal: rows.reduce((t, r) => t + (r.loss || 0), 0) };
  }

  /* ---------------------------------------------------------------- objectives (declared profiles) */
  function objectives(ctx, i, K = 10) {
    return Object.entries(ctx.profiles).map(([pid, p]) => {
      const eff = field(ctx, p.weights), L = lens(ctx, i, p.weights);
      return { pid, score: eff[i] >= 0 ? eff[i] : null, rank: rank(eff, ctx.cell, i), nEligible: nEligible(eff), lead: leadPos(eff, ctx, i, K),
        costs: L.matter.slice(0, 2), groups: L.groups };
    });
  }

  /* ---------------------------------------------------------------- what would change my mind? */
  function diffW(a, b, critIds) { return critIds.filter(c => +(a[c] || 0) !== +(b[c] || 0)).map(c => ({ c, from: +(a[c] || 0), to: +(b[c] || 0) })); }
  function activeCount(ctx, w) { return ctx.critIds.filter(c => ctx.tv[c] != null && +(w[c] || 0) > 0).length; }
  function alternatives(ctx, w) {
    const out = [], seen = new Set([JSON.stringify(ctx.critIds.map(c => +(w[c] || 0)))]);
    const push = (kind, id, w2) => {
      const key = JSON.stringify(ctx.critIds.map(c => +(w2[c] || 0)));
      if (seen.has(key) || activeCount(ctx, w2) === 0) return; seen.add(key);
      out.push({ kind, id, w: w2, changes: diffW(w, w2, ctx.critIds) });
    };
    for (const [pid, p] of Object.entries(ctx.profiles)) push("profile", pid, { ...p.weights });
    for (const [src, cs] of Object.entries(ctx.sources || {})) { const w2 = { ...w }; for (const c of cs) w2[c] = 0; push("drop_source", src, w2); }
    const prox = ctx.critIds.filter(c => (ctx.status || {})[c] === "PROXY" && +(w[c] || 0) > 0);
    if (prox.length) { const w2 = { ...w }; for (const c of prox) w2[c] = 0; push("drop_proxy", prox.join("+"), w2); }
    for (const c of ctx.critIds) if (ctx.tv[c] != null && +(w[c] || 0) > 0) { const w2 = { ...w, [c]: 0 }; push("drop_criterion", c, w2); }
    return out;
  }
  /* Robustness label — documented rule over the declared mission profiles only (the weighting assumptions):
   *   insufficient  the place is not scored (coverage < 80 %), or fewer than 2 profile alternatives were tested
   *   stable        the conclusion holds under every tested profile
   *   sensitive     it holds under at least half of them, but not all
   *   changes       it holds under fewer than half
   * Data-source and proxy dependence are reported separately (they are not weighting assumptions). */
  function robustnessLabel(alts, r0) {
    const P = alts.filter(a => a.kind === "profile");
    if (r0 == null || P.length < 2) return { label: "insufficient", hold: P.filter(a => a.holds).length, tested: P.length };
    const h = P.filter(a => a.holds).length;
    return { label: h === P.length ? "stable" : 2 * h >= P.length ? "sensitive" : "changes", hold: h, tested: P.length };
  }
  /* other leading distinct sites whose score is within `tol` (default 1 point) of this place's */
  function nearTies(eff, ctx, i, K = 20, tol = 0.01) {
    if (!(eff[i] >= 0)) return [];
    return leaders(eff, ctx, K).filter(j => j !== i && Math.abs(eff[j] - eff[i]) <= tol + 1e-12).map(j => ({ i: j, cell: ctx.cell[j], score: eff[j], delta: eff[j] - eff[i] }));
  }
  function changeMind(ctx, i, w, K = 10) {
    const eff0 = field(ctx, w), r0 = rank(eff0, ctx.cell, i), l0 = leadPos(eff0, ctx, i, K);
    const base = { score: eff0[i] >= 0 ? eff0[i] : null, rank: r0, lead: l0, nEligible: nEligible(eff0) };
    const conclusion = l0 != null ? "leading" : "rank";
    const alts = alternatives(ctx, w).map(a => {
      const eff = field(ctx, a.w), r = rank(eff, ctx.cell, i), l = leadPos(eff, ctx, i, K);
      const holds = conclusion === "leading" ? l != null : (r != null && r0 != null && r <= r0);
      return { kind: a.kind, id: a.id, changes: a.changes, score: eff[i] >= 0 ? eff[i] : null, rank: r, lead: l, holds, eligible: r != null };
    });
    const ranks = alts.map(a => a.rank).filter(r => r != null);
    const breakers = alts.filter(a => !a.holds);
    const ties = r0 == null ? [] : nearTies(eff0, ctx, i, 20, 0.01);
    return { conclusion, K, base, alternatives: alts, nAlternatives: alts.length, nHold: alts.length - breakers.length,
      robustness: robustnessLabel(alts, r0), nearTies: ties,
      breakers: breakers.map(a => a.kind + ":" + a.id), bestRank: ranks.length ? Math.min(r0 ?? Infinity, ...ranks) : r0,
      worstRank: ranks.length ? Math.max(r0 ?? 0, ...ranks) : r0, ineligibleUnder: alts.filter(a => !a.eligible).map(a => a.kind + ":" + a.id) };
  }

  /* ---------------------------------------------------------------- a team of Earth places */
  function team(ctx, w, opts = {}) {
    const thr = ctx.thr, sep = ctx.sep || 300, eff = opts.eff || field(ctx, w);
    const act = ctx.critIds.filter(c => ctx.tv[c] != null && +(w[c] || 0) > 0), n = eff.length;
    const mask = new Uint8Array(n), any = new Array(act.length).fill(false);
    act.forEach((c, b) => {
      const e = ctx.A[c], span = ctx.ranges[c][1] - ctx.ranges[c][0], t = +ctx.tv[c];
      for (let j = 0; j < n; j++) {
        if (!(eff[j] >= 0)) continue; const x = e[j]; if (x - x !== 0) continue;
        if (1 - Math.abs(x - t) / span >= thr.match) { mask[j] |= 1 << b; any[b] = true; }
      }
    });
    const pop = m => { let k = 0; while (m) { k += m & 1; m >>= 1; } return k; };
    const members = []; let covered = 0;
    const reachable = act.reduce((m, c, b) => any[b] ? m | (1 << b) : m, 0);
    while ((covered & reachable) !== reachable && members.length < act.length) {
      let best = -1, bn = 0;
      for (let j = 0; j < n; j++) {
        const g = mask[j] & ~covered; if (!g) continue;
        const k = pop(g);
        if (k < bn) continue;
        if (best >= 0 && k === bn && (eff[j] < eff[best] || (eff[j] === eff[best] && ctx.cell[j] > ctx.cell[best]))) continue;
        let ok = true; for (const m of members) if (ENG.haversine(ctx.lat[j], ctx.lon[j], ctx.lat[m.i], ctx.lon[m.i]) < sep) { ok = false; break; }
        if (!ok) continue;
        best = j; bn = k;
      }
      if (best < 0) break;
      const gain = mask[best] & ~covered;
      members.push({ i: best, cell: ctx.cell[best], score: eff[best], adds: act.filter((c, b) => gain & (1 << b)), matches: act.filter((c, b) => mask[best] & (1 << b)) });
      covered |= gain;
    }
    return { criteria: act, members, covered: act.filter((c, b) => covered & (1 << b)), unmatchable: act.filter((c, b) => !any[b]),
      uncovered: act.filter((c, b) => !(covered & (1 << b))), bestSingle: (() => { let b = -1, bk = -1; for (let j = 0; j < n; j++) { if (!(eff[j] >= 0)) continue; const k = pop(mask[j]); if (k > bk || (k === bk && (eff[j] > eff[b] || (eff[j] === eff[b] && ctx.cell[j] < ctx.cell[b])))) { b = j; bk = k; } } return { i: b, matches: bk }; })() };
  }

  /* ---------------------------------------------------------------- Earth ceiling (per criterion, weight independent) */
  function ceiling(ctx, c) {
    const e = ctx.A[c], span = ctx.ranges[c][1] - ctx.ranges[c][0], t = +ctx.tv[c];
    let lo = Infinity, hi = -Infinity, best = -1, nM = 0, arg = -1;
    for (let j = 0; j < e.length; j++) {
      const x = e[j]; if (x - x !== 0) continue;
      if (x < lo) lo = x; if (x > hi) hi = x;
      const s = Math.max(0, Math.min(1, 1 - Math.abs(x - t) / span));
      if (s > best || (s === best && ctx.cell[j] < ctx.cell[arg])) { best = s; arg = j; }
      if (s >= ctx.thr.match) nM++;
    }
    return { criterion: c, target: t, earthMin: lo, earthMax: hi, bestS: best, bestCell: arg, cellsMatch: nM, structural: nM === 0, outside: t > hi ? "above" : t < lo ? "below" : null };
  }

  /* ---------------------------------------------------------------- missing pieces (typed records, no prose) */
  function missing(ctx, i, w, extra = {}) {
    const L = extra.lens || lens(ctx, i, w), items = [];
    for (const r of L.rows) {
      if (r.state === "na") items.push({ id: "target_na:" + r.c, kind: "target_na", severity: "gap", c: r.c, status: r.status, link: { type: "target_sources" } });
      if (r.state === "unknown") items.push({ id: "earth_missing:" + r.c, kind: "earth_missing", severity: "gap", c: r.c, link: { type: "dataset", ids: (ctx.earthSource || {})[r.c] || [] } });
      if (r.status === "PROXY" && r.w > 0) items.push({ id: "target_proxy:" + r.c, kind: "target_proxy", severity: "caution", c: r.c, link: { type: "target_sources" } });
    }
    for (const r of L.rows) {
      if (r.t == null || !(r.w > 0)) continue;
      const C = ceiling(ctx, r.c);
      if (C.structural) items.push({ id: "structural:" + r.c, kind: "structural", severity: "gap", c: r.c, target: C.target, earthMin: C.earthMin, earthMax: C.earthMax, bestS: C.bestS, outside: C.outside, link: { type: "dataset", ids: (ctx.earthSource || {})[r.c] || [] } });
    }
    if (extra.modisCoverage != null && extra.modisCoverage < 0.5 && L.rows.some(r => r.c === "lst_diurnal_range" && r.w > 0 && r.e != null))
      items.push({ id: "modis_coverage", kind: "thin_coverage", severity: "caution", c: "lst_diurnal_range", value: extra.modisCoverage, link: { type: "dataset", ids: ["modis_aqua_lst"] } });
    if (L.coverage < 1 - 1e-12) items.push({ id: "partial_coverage", kind: "partial_coverage", severity: "caution", value: L.coverage, link: { type: "rule" } });
    if (extra.change) {
      for (const a of extra.change.alternatives) if (!a.holds && a.kind === "drop_source") items.push({ id: "source_dependence:" + a.id, kind: "source_dependence", severity: "caution", source: a.id, rank: a.rank, link: { type: "sensitivity", alternative: a.kind + ":" + a.id } });
      for (const a of extra.change.alternatives) if (!a.holds && a.kind === "drop_proxy") items.push({ id: "proxy_dependence", kind: "proxy_dependence", severity: "caution", criteria: a.id.split("+"), rank: a.rank, link: { type: "sensitivity", alternative: a.kind + ":" + a.id } });
    }
    items.push({ id: "resolution", kind: "resolution", severity: "info", km: extra.cellKm || null, targetKm: extra.targetWindowKm || null, link: { type: "dataset", ids: ["gmted2010", "nasa_power"] } });
    items.push({ id: "temporal", kind: "temporal", severity: "info", link: { type: "dataset", ids: ["nasa_power", "modis_aqua_lst", "gmted2010"] } });
    items.push({ id: "not_measured", kind: "not_measured", severity: "info", link: { type: "rule" } });
    const order = { gap: 0, caution: 1, info: 2 };
    return items.sort((a, b) => order[a.severity] - order[b.severity]);
  }

  /* ---------------------------------------------------------------- trust view: evidence rows, never a single score */
  function trust(ctx, i, w, extra = {}) {
    const L = extra.lens || lens(ctx, i, w), st = ctx.status || {};
    const act = L.rows.filter(r => r.t != null && r.w > 0);
    const rows = [
      { id: "measurements", direct: act.filter(r => r.status === "DIRECT").length, proxy: act.filter(r => r.status === "PROXY").length, compared: L.compared, active: act.length },
      { id: "coverage", value: L.coverage, missing: L.groups.unknown, modis: extra.modisCoverage ?? null, land: extra.landFraction ?? null },
      { id: "limits", structural: act.filter(r => ceiling(ctx, r.c).structural).map(r => r.c) },
      { id: "robustness", available: !!extra.change, hold: extra.change ? extra.change.nHold : null, total: extra.change ? extra.change.nAlternatives : null, conclusion: extra.change ? extra.change.conclusion : null },
      { id: "reproducibility", algorithm: ENG.ALGORITHM_VERSION, stack: extra.stackSha || null, verified: extra.stackVerified ?? null, config: ctx.config || null },
      { id: "sources", earth: Array.from(new Set(act.flatMap(r => (ctx.earthSource || {})[r.c] || []))), target: (extra.targetSources || []).slice() },
      { id: "scope" },
    ];
    void st;
    return { rows, note: "no_single_score" };
  }

  /* ---------------------------------------------------------------- calibrated summary (keys, not prose) */
  function summary(L, change, thr) {
    /* levels count agreeing criteria (s ≥ match threshold), so the words never claim more than the per-criterion test */
    const sim = L.groups.similar.length, comp = L.compared;
    const level = !(L.score >= 0) || !comp ? "none" : sim === comp ? "close" : 2 * sim >= comp ? "partial" : "weak";
    const robust = !change ? null : change.nHold === change.nAlternatives ? "all" : 2 * change.nHold > change.nAlternatives ? "most" : 2 * change.nHold === change.nAlternatives ? "half" : "few";
    return { level, robust, similar: L.groups.similar.length, compared: L.compared, different: L.groups.different.length, unknown: L.groups.unknown.length, na: L.groups.na.length };
  }

  /* ---------------------------------------------------------------- reveal: 7 steps of data */
  function reveal(ctx, i, w, extra = {}) {
    const L = extra.lens || lens(ctx, i, w), obj = extra.objectives || null;
    let alt = null;
    if (obj) {
      const cur = obj.find(o => o.pid === extra.profile) || null;
      const others = obj.filter(o => o.pid !== extra.profile && o.rank != null).sort((a, b) => (a.rank - b.rank) || (a.pid < b.pid ? -1 : 1));
      alt = { current: cur, best: others[0] || null, worst: others.length ? others[others.length - 1] : null };
    }
    return [
      { id: "earth", values: L.rows.map(r => ({ c: r.c, e: r.e })) },
      { id: "target", values: L.rows.map(r => ({ c: r.c, t: r.t, status: r.status })) },
      { id: "agree", criteria: L.groups.similar, rows: L.rows.filter(r => r.state === "similar") },
      { id: "differ", criteria: L.groups.partial.concat(L.groups.different), rows: L.rows.filter(r => r.state === "partial" || r.state === "different").sort((a, b) => b.loss - a.loss), unknown: L.groups.unknown, na: L.groups.na },
      { id: "evidence", earth: L.rows.filter(r => r.s != null).map(r => ({ c: r.c, sources: (ctx.earthSource || {})[r.c] || [], status: r.status })) },
      { id: "objective", alt },
      { id: "summary", summary: summary(L, extra.change || null, ctx.thr), score: L.score },
    ];
  }

  /* ---------------------------------------------------------------- one place against several worlds */
  function multiWorld(ctxs, i, w) {
    return ctxs.map(c => {
      const L = lens(c, i, w);
      const eligible = L.coverage >= 0.8 - 1e-12 && L.compared > 0;
      return { tid: c.tid, config: c.config || null, score: eligible ? L.score : null, compared: L.compared, na: L.groups.na, unknown: L.groups.unknown, similar: L.groups.similar, different: L.groups.different, coverage: L.coverage };
    });
  }

  /* ---------------------------------------------------------------- Analogue Passport */
  function passport(ctx, i, w, meta = {}) {
    const L = meta.lens || lens(ctx, i, w);
    const r6 = x => x == null ? null : Math.round(x * 1e12) / 1e12;
    return {
      schema: "asterro.passport/1",
      generator: { journey: VERSION, algorithm: ENG.ALGORITHM_VERSION },
      created: meta.created || null,
      place: { cell_id: ctx.cell[i], lat: ctx.lat[i], lon: ctx.lon[i], name: meta.place || null, country: meta.country || null, cell_size_deg: [0.5, 0.625] },
      target: { id: ctx.tid, name: meta.targetName || null, body: meta.body || null, scoring_config: ctx.config || null, fingerprint_sha256: meta.fingerprint || null },
      configuration: { profile: meta.profile || null, weights: Object.fromEntries(ctx.critIds.map(c => [c, +(w[c] || 0)])), normalization_ranges: Object.fromEntries(ctx.critIds.map(c => [c, ctx.ranges[c].slice()])), thresholds: { match: ctx.thr.match, partial: ctx.thr.partial, min_coverage: 0.8, distinct_sep_km: ctx.sep || 300 } },
      result: { analogue_score: r6(L.score), coverage: r6(L.coverage), cell_rank: meta.rank ?? null, eligible_cells: meta.nEligible ?? null, leading_site_position: meta.lead ?? null },
      criteria: L.rows.map(r => ({ id: r.c, earth: r.e, target: r.t, target_status: r.status, weight: r.w, similarity: r6(r.s), state: r.state, contribution: r6(r.contribution), earth_sources: (ctx.earthSource || {})[r.c] || [] })),
      sensitivity: meta.change ? { conclusion: meta.change.conclusion, holds: meta.change.nHold, alternatives: meta.change.nAlternatives, breakers: meta.change.breakers } : null,
      evidence_gaps: (meta.missing || []).map(m => m.id),
      sources: { earth: meta.earthDatasets || [], target: meta.targetSources || [] },
      reproducibility: { predictor_stack_sha256: meta.stackSha || null, rescore: "score = Σ w·s / Σw over criteria with an Earth value; s = clip(1 − |earth − target| / (max − min), 0, 1); eligible if Σw(with Earth value) / Σw(active) ≥ 0.80" },
      disclaimer: "Environmental similarity on the measured criteria only. Not physical, geological, biological or engineering equivalence; not validated against field data; not endorsed by NASA.",
    };
  }
  /* re-score a passport from its own contents (used by tests and by anyone holding only the JSON) */
  function rescore(p) {
    let num = 0, ws = 0, tot = 0;
    for (const r of p.criteria) {
      if (r.target == null || !(r.weight > 0)) continue; tot += r.weight;
      if (r.earth == null) continue;
      const R = p.configuration.normalization_ranges[r.id], s = Math.max(0, Math.min(1, 1 - Math.abs(r.earth - r.target) / (R[1] - R[0])));
      num += r.weight * s; ws += r.weight;
    }
    return ws > 0 && ws / tot >= 0.8 - 1e-12 ? num / ws : null;
  }

  /* ---------------------------------------------------------------- the score, written out (Trust view)
   * exactly the engine's rule: d = |e − t| / (max − min); s = clip(1 − d, 0, 1); over criteria that are active
   * (weight > 0 and a target value) AND have an Earth value: k = w·s / Σw(those), S = Σk. Coverage =
   * Σw(with Earth value) / Σw(active); the cell is ranked only if coverage ≥ 0.80. */
  function calculation(ctx, i, w) {
    const det = detail(ctx, i, w);
    const rows = det.rows.map(r => ({ c: r.c, e: r.e, t: r.t == null ? null : r.t, lo: r.lo, hi: r.hi, w: r.w, active: r.active, d: r.d ?? null, s: r.s ?? null, k: r.k ?? null }));
    const sumK = rows.reduce((t, r) => t + (r.k || 0), 0);
    return { rows, wsum: det.wsum, totalW: det.totalW, coverage: det.coverage, score: det.final, sumK, ranked: det.coverage >= 0.8 - 1e-12, minCoverage: 0.8 };
  }

  /* ---------------------------------------------------------------- Same Earth, different mission
   * the K leading distinct sites under two declared profiles; which stay, enter, leave; and, for one site, the exact
   * per-criterion change of its contribution (Σ Δk = ΔS). */
  function missions(ctx, wA, wB, K = 10, focus = null) {
    const eA = field(ctx, wA), eB = field(ctx, wB), LA = leaders(eA, ctx, K), LB = leaders(eB, ctx, K);
    const row = (i, own, other, eff2) => ({ i, cell: ctx.cell[i], score: own[i], rankOther: rank(eff2, ctx.cell, i), leadOther: leadPos(eff2, ctx, i, K), scoreOther: eff2[i] >= 0 ? eff2[i] : null });
    const A = LA.map(i => row(i, eA, eB, eB)), B = LB.map(i => row(i, eB, eA, eA));
    const both = LA.filter(i => LB.includes(i));
    const f = focus != null ? focus : LA[0];
    const dA = detail(ctx, f, wA), dB = detail(ctx, f, wB);
    const contrib = dA.rows.map((r, k) => ({ c: r.c, kA: r.k ?? 0, kB: dB.rows[k].k ?? 0, delta: (dB.rows[k].k ?? 0) - (r.k ?? 0), wA: r.w, wB: dB.rows[k].w, s: r.s ?? null }));
    return { K, A, B, both, onlyA: LA.filter(i => !LB.includes(i)), onlyB: LB.filter(i => !LA.includes(i)), changes: diffW(wA, wB, ctx.critIds),
      focus: { i: f, scoreA: eA[f] >= 0 ? eA[f] : null, scoreB: eB[f] >= 0 ? eB[f] : null, rankA: rank(eA, ctx.cell, f), rankB: rank(eB, ctx.cell, f), leadA: leadPos(eA, ctx, f, K), leadB: leadPos(eB, ctx, f, K), contrib,
        sumDelta: contrib.reduce((t, x) => t + x.delta, 0) } };
  }

  /* ---------------------------------------------------------------- a portfolio the user assembles
   * per site and criterion: s and its state; per criterion: the best site and how many sites match (s ≥ 0.85);
   * pairwise great-circle distances. It is a comparison, not an optimisation: nothing is labelled optimal. */
  function portfolio(ctx, cells, w) {
    const sites = cells.map(i => { const L = lens(ctx, i, w); return { i, cell: ctx.cell[i], score: L.score, coverage: L.coverage, rows: L.rows }; });
    const crit = ctx.critIds.filter(c => ctx.tv[c] != null && +(w[c] || 0) > 0);
    const per = crit.map(c => {
      const v = sites.map(s => ({ i: s.i, s: s.rows.find(r => r.c === c).s }));
      const best = v.filter(x => x.s != null).sort((a, b) => (b.s - a.s) || (ctx.cell[a.i] - ctx.cell[b.i]))[0] || null;
      const matching = v.filter(x => x.s != null && x.s >= ctx.thr.match).map(x => x.i);
      return { c, best: best ? best.i : null, bestS: best ? best.s : null, matching, covered: matching.length > 0, overlap: matching.length > 1, unique: matching.length === 1 ? matching[0] : null };
    });
    const dist = [];
    for (let a = 0; a < sites.length; a++) for (let b = a + 1; b < sites.length; b++) dist.push({ a: sites[a].i, b: sites[b].i, km: ENG.haversine(ctx.lat[sites[a].i], ctx.lon[sites[a].i], ctx.lat[sites[b].i], ctx.lon[sites[b].i]) });
    return { sites, criteria: crit, per, covered: per.filter(p => p.covered).map(p => p.c), uncovered: per.filter(p => !p.covered).map(p => p.c),
      overlap: per.filter(p => p.overlap).map(p => p.c), dist, minKm: dist.length ? Math.min(...dist.map(d => d.km)) : null,
      contributions: sites.map(s => ({ i: s.i, unique: per.filter(p => p.unique === s.i).map(p => p.c) })) };
  }

  /* ---------------------------------------------------------------- challenges: answers derived from the data
   *   stronger_on   leading sites (top K distinct) with a higher s on criterion c than the #1 site
   *   costs_most    the criterion that costs the #1 site the most points
   *   excluded      a place with an Earth value missing whose weight coverage falls below 80 % under profile w
   *   same_score    pairs of leading sites within tol points whose largest cost is a different criterion */
  function challenges(ctx, w, opts = {}) {
    const K = opts.K || 20, eff = field(ctx, w), L = leaders(eff, ctx, K), top = L[0], c = opts.criterion || "lst_diurnal_range";
    const sOf = (i, cc) => { const r = detail(ctx, i, w).rows.find(x => x.c === cc); return r.s ?? null; };
    const s0 = sOf(top, c);
    const stronger = L.slice(1).filter(i => { const s = sOf(i, c); return s != null && s0 != null && s > s0 + 1e-12; });
    const Ltop = lens(ctx, top, w);
    const out = { leaders: L, top, criterion: c, s0, stronger, costsMost: Ltop.matter[0] || null };
    if (opts.wExcl) {
      /* the highest-scoring place under w that the other weighting cannot rank (ties: lower cell id) */
      const e2 = field(ctx, opts.wExcl); let ex = null;
      for (let j = 0; j < eff.length; j++) if (eff[j] >= 0 && !(e2[j] >= 0) && (ex == null || eff[j] > eff[ex] || (eff[j] === eff[ex] && ctx.cell[j] < ctx.cell[ex]))) ex = j;
      out.excluded = ex == null ? null : { i: ex, cell: ctx.cell[ex], coverage: detail(ctx, ex, opts.wExcl).coverage, missing: detail(ctx, ex, opts.wExcl).rows.filter(r => r.active && r.e == null).map(r => r.c) };
    }
    const tol = opts.tol ?? 0.01, pairs = [];
    const top1 = L.map(i => ({ i, m: lens(ctx, i, w).matter[0] || null }));
    for (let a = 0; a < top1.length; a++) for (let b = a + 1; b < top1.length; b++)
      if (Math.abs(eff[top1[a].i] - eff[top1[b].i]) <= tol + 1e-12 && top1[a].m && top1[b].m && top1[a].m !== top1[b].m) pairs.push([top1[a].i, top1[b].i]);
    out.sameScore = pairs; out.mainCost = Object.fromEntries(top1.map(x => [x.i, x.m]));
    return out;
  }

  const api = { VERSION, STATES, robustnessLabel, nearTies, calculation, missions, portfolio, challenges, field, detail, rank, nEligible, leadPos, leaders, lens, stateOf, objectives, alternatives, changeMind, team, ceiling, missing, trust, summary, reveal, multiWorld, passport, rescore };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AsterroJourney = api;
})(typeof window !== "undefined" ? window : globalThis);
