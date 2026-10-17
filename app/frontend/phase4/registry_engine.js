/* ASTERRO Phase IV — registry engine (browser + Node).
 *
 * Pure, deterministic functions over the canonical target registry (public/data/registry.json,
 * schema asterro.registry/1) used by every Phase IV module:
 *   index / search / filter / sort       hierarchical atlas: body → region → location → target
 *   quickActions                         what can be done with a location, and why not
 *   compatibility / aggregatePlan / aggregate   multi-target comparison with explicit blocking
 *   validationMetrics / weightSensitivity / holdoutCheck   researcher reference cases (never synthetic)
 *   mismatch                             deterministic per-criterion agreement classes
 *   collections                          versioned JSON, validated import, conflict-reporting merge
 *   provenanceExport                     machine-readable readiness / provenance export
 * Scoring reuses AsterroLab.prepare / fieldScore (the baseline formula). Nothing here changes the baseline
 * Analogue Score, weights, ranges or ranking. No randomness. No learned or generative model.
 */
(function (root) {
  "use strict";
  const LAB = root.AsterroLab || (typeof require === "function" ? require("../phase2/lab_engine.js") : null);
  const VERSION = "asterro-phase4-1.0.0";
  const SCHEMA = "asterro.registry/1";
  const COLLECTION_SCHEMA = "asterro.collections/1";
  const VALIDATION_SCHEMA = "asterro.validation/1";
  const SCENARIO_SCHEMA = "asterro.scenario-set/1";
  const ITEM_KINDS = ["location", "target", "earth_cell", "scenario_set", "comparison", "reference"];
  const EVIDENCE = { field_study: "Peer-reviewed field or laboratory study", mission_doc: "Mission or agency documentation", expert: "Expert judgment (documented)", other: "Other cited source" };
  const STATUSES = ["DIRECT", "PROXY", "N/A", "MISSING"];
  const AGGREGATES = {
    minimum: "Minimum of the per-target effective scores: a cell is high only if it resembles every target.",
    mean: "Arithmetic mean of the per-target effective scores — a labelled summary, not a physical quantity; a high mean can hide a poor match to one target.",
    pareto: "Pareto set: cells not dominated on every target's score. No single winner is claimed.",
    per_criterion: "Per shared DIRECT criterion: the minimum over targets of the criterion similarity. No cross-criterion sum.",
  };
  /* minimum label counts for metrics (documented in the UI and in each validation record) */
  const MIN_POS_RECALL = 5, MIN_POS_PRECISION = 5, MIN_NEG_PRECISION = 5;

  const norm = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  /* ------------------------------------------------------------------ index */
  function index(R) {
    if (!R || R.schema !== SCHEMA) throw new Error("not an " + SCHEMA + " registry");
    const by = k => Object.fromEntries((R[k] || []).map(x => [x.id, x]));
    const IX = { R, bodies: by("bodies"), regions: by("regions"), locations: by("locations"), targets: by("targets"),
      datasets: by("datasets"), missions: by("missions"), configs: by("scoring_configs"), docs: [] };
    for (const l of R.locations) {
      const reg = IX.regions[l.region];
      const ms = (l.missions || []).map(m => IX.missions[m] ? IX.missions[m].name : m);
      const ts = (l.target_ids || []).map(t => IX.targets[t]).filter(Boolean);
      IX.docs.push({ kind: "location", id: l.id, body: l.body, name: l.name, n: norm(l.name), aliases: (l.aliases || []).map(norm),
        extra: norm([l.feature_type, reg && reg.name, ms.join(" "), ts.map(t => t.name).join(" "), l.quadrangle].join(" ")) });
    }
    for (const r of R.regions) IX.docs.push({ kind: "region", id: r.id, body: r.body, name: r.name, n: norm(r.name), aliases: [], extra: norm(r.description) });
    IX.byBodyRegion = {};
    for (const r of R.regions) (IX.byBodyRegion[r.body] = IX.byBodyRegion[r.body] || []).push(r.id);
    return IX;
  }

  /* ------------------------------------------------------------------ search (aliases, prefixes, word matches) */
  function search(IX, q, { limit = 12, body = null } = {}) {
    const Q = norm(q); if (!Q) return [];
    const words = Q.split(" ");
    const out = [];
    for (const d of IX.docs) {
      if (body && d.body !== body) continue;
      let s = 0, matched = null;
      if (d.n === Q) { s = 100; matched = "name"; }
      else if (d.aliases.includes(Q)) { s = 90; matched = "alias"; }
      else if (d.n.startsWith(Q)) { s = 70; matched = "name prefix"; }
      else if (d.aliases.some(a => a.startsWith(Q))) { s = 60; matched = "alias prefix"; }
      else {
        const hay = [d.n, ...d.aliases, d.extra].join(" ");
        if (words.every(w => hay.split(" ").some(h => h.startsWith(w)))) { s = 30 + (words.every(w => (d.n + " " + d.aliases.join(" ")).includes(w)) ? 10 : 0); matched = "words"; }
      }
      if (s) out.push({ kind: d.kind, id: d.id, name: d.name, body: d.body, score: s + (d.kind === "location" ? 1 : 0), matched });
    }
    out.sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return out.slice(0, limit);
  }

  /* ------------------------------------------------------------------ filters + sorting */
  function locLevel(l) { return l.readiness ? l.readiness.level : 0; }
  function filterLocations(IX, f = {}) {
    const q = norm(f.q || "");
    const hit = q ? new Set(search(IX, q, { limit: 1e9 }).filter(h => h.kind === "location").map(h => h.id)) : null;
    return IX.R.locations.filter(l => {
      if (f.body && l.body !== f.body) return false;
      if (f.region && l.region !== f.region) return false;
      if (f.minLevel != null && locLevel(l) < f.minLevel) return false;
      if (f.level != null && f.level !== "" && locLevel(l) !== +f.level) return false;
      if (f.mission && !(l.missions || []).includes(f.mission)) return false;
      if (f.type && l.record_type !== f.type) return false;
      if (f.ftype && l.feature_type !== f.ftype) return false;
      if (f.dataset) {
        const ds = new Set((l.target_ids || []).flatMap(t => (IX.targets[t] || {}).datasets || []));
        if (!ds.has(f.dataset)) return false;
      }
      if (f.analytical === true && !(l.target_ids || []).length) return false;
      if (hit && !hit.has(l.id)) return false;
      return true;
    });
  }
  const SORTS = {
    name: (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    readiness: (a, b) => (locLevel(b) - locLevel(a)) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    latitude: (a, b) => (b.latitude - a.latitude) || a.id.localeCompare(b.id),
    longitude: (a, b) => (a.longitude_east - b.longitude_east) || a.id.localeCompare(b.id),
    targets: (a, b) => ((b.target_ids || []).length - (a.target_ids || []).length) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    region: (a, b) => a.region.localeCompare(b.region) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  };
  function sortLocations(list, key = "name") { return list.slice().sort(SORTS[key] || SORTS.name); }

  function counts(IX, locs = IX.R.locations) {
    const L = [0, 0, 0, 0, 0];               // indexed by level 1..4 (index 0 unused)
    for (const l of locs) L[locLevel(l)]++;
    const tl = locs.flatMap(l => (l.target_ids || []).map(t => IX.targets[t])).filter(Boolean);
    const T = [0, 0, 0, 0, 0]; for (const t of tl) T[t.readiness.level]++;
    return { locations: locs.length, byLevel: L, targets: tl.length, targetsByLevel: T,
      scoring: tl.filter(t => t.scoring.earth_analogue_enabled).length, partial: tl.filter(t => !t.scoring.earth_analogue_enabled && t.readiness.level >= 1).length };
  }

  /* ------------------------------------------------------------------ quick actions (enabled / disabled with reason) */
  function quickActions(IX, loc, { exploreIds = [] } = {}) {
    const ts = (loc.target_ids || []).map(t => IX.targets[t]).filter(Boolean);
    const best = ts.slice().sort((a, b) => b.readiness.level - a.readiness.level)[0] || null;
    const lvl = best ? best.readiness.level : 0;
    const A = (id, label, ok, why) => ({ id, label, enabled: !!ok, reason: ok ? null : why, target: best ? best.id : null });
    const none = "Catalogued entry (L1): no analytical target has been assembled for this location, so no similarity can be computed.";
    return [
      A("target", "Open target analysis", best, none),
      A("analogues", lvl >= 3 ? "Find Earth analogues" : "Find Earth analogues (partial)", best && lvl >= 2, none),
      A("explore", "Open in Explore (globe)", best && exploreIds.includes(best.id),
        best ? `Readiness L${lvl}: Explore runs the six-criterion baseline-style ranking only for readiness ≥ 3 targets.` : none),
      A("compare", "Add to comparison", best && lvl >= 2, none),
      A("validation", "Validation workspace", best && lvl >= 3, best ? `Readiness L${lvl}: reference cases are evaluated only against a complete (L3+) fingerprint.` : none),
      A("collection", "Add to a collection", true, null),
      A("provenance", "Readiness & provenance", true, null),
    ];
  }

  /* ------------------------------------------------------------------ compatibility matrix */
  function compatibility(targets, critIds) {
    const per = critIds.map(c => {
      const st = targets.map(t => t.fingerprint.criterion_status[c]);
      const allDirect = st.every(s => s === "DIRECT"), allComparable = st.every(s => s === "DIRECT" || s === "PROXY");
      const cls = allDirect ? "shared-direct" : allComparable ? "proxy-involved" : st.some(s => s === "N/A") ? "not-applicable" : "missing";
      const ds = targets.map(t => (t.fingerprint.provenance[c] || []).join("+") || "—");
      const sp = targets.map(t => t.fingerprint.spatial_support[c] || "—");
      const tp = targets.map(t => t.fingerprint.temporal_support[c] || "—");
      return { criterion: c, statuses: st, class: cls, datasets: ds, spatial: sp, temporal: tp,
        sourceDiffers: allDirect && new Set(ds).size > 1, scaleDiffers: allDirect && new Set(sp).size > 1, timeDiffers: allDirect && new Set(tp).size > 1 };
    });
    const pair = targets.map(a => targets.map(b => critIds.filter(c => a.fingerprint.criterion_status[c] === "DIRECT" && b.fingerprint.criterion_status[c] === "DIRECT").length));
    return { criteria: per, sharedDirect: per.filter(p => p.class === "shared-direct").map(p => p.criterion), pairwiseSharedDirect: pair };
  }
  /* is an aggregate permitted? returns { ok, reason, criteria, config, legacy } — never silently mixes criteria */
  function aggregatePlan(IX, targetIds, aggregate, critIds) {
    const ts = targetIds.map(id => IX.targets[id]);
    if (ts.length < 2) return { ok: false, reason: "Select at least two analytical targets." };
    if (ts.some(t => !t)) return { ok: false, reason: "Unknown target in the selection." };
    if (!AGGREGATES[aggregate]) return { ok: false, reason: `Unsupported aggregate "${aggregate}". Supported: ${Object.keys(AGGREGATES).join(", ")}.` };
    const low = ts.filter(t => t.readiness.level < 2);
    if (low.length) return { ok: false, reason: `${low.map(t => t.name).join(", ")}: readiness L1 (catalogued) — no analytical data.` };
    const legacy = (IX.R.comparison_experiments || []).find(x => x.regression && x.targets.length === ts.length && x.targets.every(t => targetIds.includes(t)));
    if (legacy && aggregate === legacy.aggregate) {
      const cfg = IX.configs[legacy.scoring_config];
      /* legacy rule (unchanged): each target is scored on its OWN DIRECT + PROXY criteria with the legacy table */
      return { ok: true, legacy: legacy.id, config: cfg.id, ranges: "legacy", includeProxy: true, ownCriteria: true,
        criteria: critIds.filter(c => ts.some(t => ["DIRECT", "PROXY"].includes(t.fingerprint.criterion_status[c]))),
        reason: `Legacy experiment "${legacy.label}": ${cfg.label}. ${legacy.meaning}` };
    }
    const C = compatibility(ts, critIds);
    if (!C.sharedDirect.length) return { ok: false, reason: "These targets share no DIRECT criterion. An aggregate would compare incompatible criteria and is blocked.", compat: C };
    const excluded = critIds.filter(c => !C.sharedDirect.includes(c));
    return { ok: true, config: "atlas-direct-v1", ranges: "per-target", includeProxy: false, criteria: C.sharedDirect, excluded, compat: C,
      reason: `Scored on the ${C.sharedDirect.length} criteria DIRECT for every selected target (${C.sharedDirect.join(", ")}); excluded: ${excluded.join(", ") || "none"}. Each target uses its own Earth ∪ target ranges (atlas-direct-v1).` };
  }
  /* fingerprint (registry) → the vector restricted to `criteria` */
  function vectorOn(t, criteria) {
    const tv = {};
    for (const c of Object.keys(t.fingerprint.variables)) tv[c] = criteria.includes(c) && t.fingerprint.variables[c] != null ? +t.fingerprint.variables[c] : null;
    return tv;
  }
  function earthRange(A, c) {
    let lo = Infinity, hi = -Infinity; const e = A[c];
    for (let i = 0; i < e.length; i++) { const x = e[i]; if (x - x !== 0) continue; if (x < lo) lo = x; if (x > hi) hi = x; }
    return [lo, hi];
  }
  function earthUnionRanges(A, critIds, tv) {
    const out = {};
    for (const c of critIds) { const r = earthRange(A, c); if (tv[c] != null) { r[0] = Math.min(r[0], tv[c]); r[1] = Math.max(r[1], tv[c]); } out[c] = r; }
    return out;
  }
  function aggregate({ IX, A, cell, lat, lon, critIds, targetIds, kind, w, legacyRanges, n = 20, sep = 300 }) {
    const plan = aggregatePlan(IX, targetIds, kind, critIds);
    if (!plan.ok) return { ok: false, plan };
    const ts = targetIds.map(id => IX.targets[id]);
    const Ps = ts.map(t => {
      const tv = vectorOn(t, plan.ownCriteria ? critIds.filter(c => ["DIRECT", "PROXY"].includes(t.fingerprint.criterion_status[c])) : plan.criteria);
      const ranges = plan.ranges === "legacy" ? legacyRanges : earthUnionRanges(A, critIds, tv);
      return Object.assign(LAB.prepare(A, critIds, tv, ranges), { tv, ranges, targetId: t.id });
    });
    const F = Ps.map(P => LAB.fieldScore(P, w).eff), N = cell.length;
    let eff = null, front = null, perCrit = null;
    if (kind === "minimum") {          // same rule as the baseline cross-planet field: any ineligible → -1, else min
      eff = new Float64Array(N);
      for (let i = 0; i < N; i++) { let m = Infinity; for (const f of F) { if (f[i] < 0) { m = -1; break; } if (f[i] < m) m = f[i]; } eff[i] = m; }
    }
    else if (kind === "mean") {
      eff = new Float64Array(N);
      for (let i = 0; i < N; i++) { let s = 0, bad = false; for (const f of F) { if (f[i] < 0) { bad = true; break; } s += f[i]; } eff[i] = bad ? -1 : s / F.length; }
    } else if (kind === "pareto") front = pareto(F, cell);
    else if (kind === "per_criterion") {
      perCrit = {};
      for (const c of plan.criteria) {
        const f = new Float64Array(N);
        for (let i = 0; i < N; i++) { let m = Infinity; for (const P of Ps) { const s = P.s[c][i]; if (s !== s) { m = -1; break; } if (s < m) m = s; } f[i] = m; }
        perCrit[c] = { top: distinct(f, cell, lat, lon, Math.min(n, 10), sep).map(i => ({ i, score: f[i] })) };
      }
    }
    const top = eff ? distinct(eff, cell, lat, lon, n, sep).map(i => ({ i, score: eff[i], perTarget: F.map(f => f[i]) })) : null;
    return { ok: true, plan, kind, eff, top, front, perCrit, perTarget: F, Ps };
  }
  function order(eff, cell) {
    const idx = Array.from({ length: eff.length }, (_, i) => i);
    idx.sort((a, b) => (eff[b] - eff[a]) || (cell[a] - cell[b]));
    return idx;
  }
  function haversine(la1, lo1, la2, lo2) {
    const r = Math.PI / 180, p1 = la1 * r, p2 = la2 * r, dp = p2 - p1, dl = (lo2 - lo1) * r;
    let a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    a = a < 0 ? 0 : (a > 1 ? 1 : a);
    return 2 * 6371.0088 * Math.asin(Math.sqrt(a));
  }
  function distinct(eff, cell, lat, lon, n = 20, sep = 300) {
    const o = order(eff, cell), kept = [];
    for (let k = 0; k < o.length && kept.length < n; k++) {
      const i = o[k]; if (!(eff[i] >= 0)) break;
      if (kept.every(j => haversine(lat[i], lon[i], lat[j], lon[j]) >= sep)) kept.push(i);
    }
    return kept;
  }
  /* non-dominated cells (maximise every target score); cells ineligible for any target are excluded.
   * Deterministic: cells sorted by first score desc, then by the others, then cell id. */
  function pareto(F, cell) {
    const N = cell.length, ids = [];
    for (let i = 0; i < N; i++) if (F.every(f => f[i] >= 0)) ids.push(i);
    ids.sort((a, b) => { for (const f of F) if (f[b] !== f[a]) return f[b] - f[a]; return cell[a] - cell[b]; });
    const front = [];
    for (const i of ids) {
      let dom = false;
      for (const j of front) { if (F.every(f => f[j] >= f[i]) && F.some(f => f[j] > f[i])) { dom = true; break; } }
      if (!dom && !front.some(j => F.every(f => f[j] === f[i]))) front.push(i);
    }
    return front;
  }

  /* ------------------------------------------------------------------ validation (researcher-entered reference cases only) */
  function cellIndexOf(lat, lon, idxMap) {
    if (!(Number.isFinite(lat) && Number.isFinite(lon)) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return -1;
    const row = Math.round((lat + 90) / 0.5), col = ((Math.round((lon + 180) / 0.625) % 576) + 576) % 576;
    const v = idxMap[row * 576 + col];
    return v == null || v < 0 ? -1 : v;
  }
  function validateCase(c, idxMap) {
    const e = [];
    if (!c || typeof c !== "object") return ["not an object"];
    if (!["positive", "negative"].includes(c.label)) e.push("label must be positive or negative");
    if (!String(c.name || "").trim()) e.push("name is required");
    if (!String(c.citation || "").trim()) e.push("a citation (publication, DOI or URL) is required");
    if (!(Number.isFinite(+c.lat) && Number.isFinite(+c.lon))) e.push("finite latitude and longitude are required");
    else if (cellIndexOf(+c.lat, +c.lon, idxMap) < 0) e.push("the coordinate is not on a valid Earth land cell of the stack");
    if (c.source === "synthetic-fixture") e.push("synthetic fixture: never counted as validation");
    if (c.evidence_quality != null && !EVIDENCE[c.evidence_quality]) e.push("evidence_quality must be one of " + Object.keys(EVIDENCE).join(", "));
    if (c.criteria != null && !Array.isArray(c.criteria)) e.push("criteria must be a list");
    return e;
  }
  function ranksOf(eff, cell, cellIdx) {
    const o = order(eff, cell), r = new Map();
    o.forEach((i, k) => { if (eff[i] >= 0) r.set(i, k + 1); });
    return cellIdx.map(i => r.get(i) ?? null);
  }
  function validationMetrics({ eff, cell, cases, idxMap, ks = [10, 50, 100, 500] }) {
    const ok = cases.map(c => ({ c, err: validateCase(c, idxMap) }));
    const used = ok.filter(x => !x.err.length).map(x => x.c);
    const idx = used.map(c => cellIndexOf(+c.lat, +c.lon, idxMap));
    const rk = ranksOf(eff, cell, idx);
    let nElig = 0; for (let i = 0; i < eff.length; i++) if (eff[i] >= 0) nElig++;
    const rows = used.map((c, k) => ({ name: c.name, label: c.label, cellIndex: idx[k], rank: rk[k], percentile: rk[k] ? rk[k] / nElig : null }));
    const pos = rows.filter(r => r.label === "positive"), neg = rows.filter(r => r.label === "negative");
    const recall = {}, precision = {};
    for (const k of ks) {
      recall[k] = pos.length >= MIN_POS_RECALL ? pos.filter(r => r.rank && r.rank <= k).length / pos.length : null;
      const lab = rows.filter(r => r.rank && r.rank <= k);
      precision[k] = pos.length >= MIN_POS_PRECISION && neg.length >= MIN_NEG_PRECISION && lab.length ? lab.filter(r => r.label === "positive").length / lab.length : null;
    }
    const why = [];
    if (pos.length < MIN_POS_RECALL) why.push(`Recall@k needs ≥ ${MIN_POS_RECALL} cited positive cases (have ${pos.length}).`);
    if (pos.length < MIN_POS_PRECISION || neg.length < MIN_NEG_PRECISION) why.push(`Labelled precision@k needs ≥ ${MIN_POS_PRECISION} positive and ≥ ${MIN_NEG_PRECISION} negative cited cases (have ${pos.length} / ${neg.length}); it is computed over labelled cases only, never over unlabelled cells.`);
    const evidence = {}; for (const c of used) { const k = c.evidence_quality || "unspecified"; evidence[k] = (evidence[k] || 0) + 1; }
    return { rows, evidence, rejected: ok.filter(x => x.err.length).map(x => ({ name: x.c && x.c.name, errors: x.err })), nEligible: nElig,
      positives: pos.length, negatives: neg.length, recall, precision, sufficiency: why, ks };
  }
  /* weight sensitivity: each active weight × factors; rank of every accepted case under each variant */
  function weightSensitivity({ P, w, cell, cases, idxMap, factors = [0.5, 2] }) {
    const used = cases.filter(c => !validateCase(c, idxMap).length), idx = used.map(c => cellIndexOf(+c.lat, +c.lon, idxMap));
    const base = ranksOf(LAB.fieldScore(P, w).eff, cell, idx);
    const act = P.applicable.filter(c => w[c] != null && +w[c] > 0), rows = [];
    for (const c of act) for (const f of factors) {
      const w2 = { ...w, [c]: +w[c] * f };
      const r = ranksOf(LAB.fieldScore(P, w2).eff, cell, idx);
      rows.push({ criterion: c, factor: f, ranks: r, maxShift: Math.max(0, ...r.map((x, k) => x == null || base[k] == null ? 0 : Math.abs(x - base[k]))) });
    }
    return { cases: used.map(c => c.name), base, rows };
  }
  function holdoutCheck() {
    return { applicable: false, reason: "Not meaningful here: ASTERRO's score has no parameters fitted to labels (the weights are editorial profiles), so a train/test split would not test a learned relation. Holdout analysis becomes meaningful only if weights are ever fitted to reference cases; it is then required." };
  }
  function validationRecord({ target, config, w, profile, ranges, metrics, sensitivity, cases, stackSha, createdUtc }) {
    const synthetic = cases.some(c => c && c.source === "synthetic-fixture");
    return { schema: VALIDATION_SCHEMA, engine: VERSION, created_utc: createdUtc, predictor_stack_sha256: stackSha,
      target, scoring_config: config, profile, weights: w, normalisation_ranges: ranges, cases,
      label_rules: { recall_min_positive: MIN_POS_RECALL, precision_min_positive: MIN_POS_PRECISION, precision_min_negative: MIN_NEG_PRECISION },
      evidence_classes: metrics.evidence || {}, evidence_note: "Counts by evidence class. Expert judgment is not empirical validation; software tests and synthetic fixtures are never validation.",
      metrics: { rows: metrics.rows, recall_at_k: metrics.recall, labelled_precision_at_k: metrics.precision, sufficiency: metrics.sufficiency, rejected: metrics.rejected },
      weight_sensitivity: sensitivity || null, holdout: holdoutCheck(), synthetic,
      statement: synthetic ? "TEST FIXTURE — contains synthetic cases; this is not a validation." :
        "Researcher-entered reference cases evaluated against this configuration. This record is an evaluation input, not a claim of scientific validation." };
  }

  /* ------------------------------------------------------------------ mismatch explorer */
  const MM_CLASSES = {
    agreement: "Similarity ≥ match threshold.", partial: "Similarity between the partial and match thresholds.", mismatch: "Similarity below the partial threshold.",
    proxy: "Target value is a rule-based PROXY (included only on request).", proxy_excluded: "PROXY criterion not used in this comparison.",
    missing_target: "No compatible target product (MISSING) — never imputed.", missing_earth: "Earth value missing in this cell.",
    incompatible: "No physical counterpart at the target (N/A).", excluded_weight: "Weight 0 in the active profile.",
  };
  function mismatch({ t, i, A, critIds, w, ranges, includeProxy = false, thresholds, cellKm }) {
    const fp = t.fingerprint, out = [];
    for (const c of critIds) {
      const st = fp.criterion_status[c], tv = fp.variables[c], e = A[c][i];
      let cls, s = null;
      if (st === "N/A") cls = "incompatible";
      else if (st === "MISSING") cls = "missing_target";
      else if (st === "PROXY" && !includeProxy) cls = "proxy_excluded";
      else if (!(w[c] > 0)) cls = "excluded_weight";
      else if (e - e !== 0) cls = "missing_earth";
      else {
        const span = ranges[c][1] - ranges[c][0]; s = 1 - Math.abs(e - tv) / span; s = s < 0 ? 0 : (s > 1 ? 1 : s);
        cls = st === "PROXY" ? "proxy" : s >= thresholds.match ? "agreement" : s >= thresholds.partial ? "partial" : "mismatch";
      }
      const scale = st === "DIRECT" ? `Target: ${fp.spatial_support[c]}; ${fp.temporal_support[c]}. Earth: ${cellKm} cell value.` : null;
      const pointVsCell = st === "DIRECT" && /point/.test(fp.spatial_support[c] || "");
      const text = {
        agreement: `Agreement: Earth ${fmt(e)} vs target ${fmt(tv)} (s = ${fmt(s, 3)}).`,
        partial: `Partial agreement: Earth ${fmt(e)} vs target ${fmt(tv)} (s = ${fmt(s, 3)}).`,
        mismatch: `Mismatch: Earth ${fmt(e)} vs target ${fmt(tv)} (s = ${fmt(s, 3)}); difference ${fmt(e - tv)}.`,
        proxy: `Proxy comparison: target value ${fmt(tv)} is a rule, not a measurement (s = ${fmt(s, 3)}).`,
        proxy_excluded: "Proxy criterion excluded from this comparison.",
        missing_target: "Target value missing; this criterion is not compared and does not count as a match.",
        missing_earth: "Earth value missing in this cell; this criterion is not compared.",
        incompatible: "Not applicable at this target; not compared.",
        excluded_weight: "Weight 0 in the active profile; excluded.",
      }[cls];
      out.push({ criterion: c, status: st, class: cls, similarity: s, earth: e - e === 0 ? +e : null, target: tv, text, scale,
        scaleWarning: pointVsCell ? "Point measurement compared with a 0.5° × 0.625° cell mean: a scale difference, not an error." : null });
    }
    return out;
  }
  function fmt(v, d = 2) { return v == null || v !== v ? "—" : (+v).toFixed(d); }

  /* ------------------------------------------------------------------ collections */
  function newCollection(id, name, createdUtc) {
    return { id, name, created_utc: createdUtc, updated_utc: createdUtc, version: 1, notes: "", items: [] };
  }
  function validateCollections(doc, IX) {
    const e = [];
    if (!doc || typeof doc !== "object") return ["not a JSON object"];
    if (doc.schema !== COLLECTION_SCHEMA) e.push(`schema must be "${COLLECTION_SCHEMA}"`);
    if (!Array.isArray(doc.collections)) { e.push("collections must be an array"); return e; }
    const seen = new Set();
    doc.collections.forEach((c, k) => {
      const p = `collections[${k}]`;
      if (!c || typeof c.id !== "string" || !/^[a-z0-9_\-]{1,64}$/.test(c.id)) e.push(`${p}: invalid id`);
      else if (seen.has(c.id)) e.push(`${p}: duplicate id ${c.id}`); else seen.add(c.id);
      if (!c || typeof c.name !== "string" || !c.name.trim() || c.name.length > 120) e.push(`${p}: name required (≤ 120 chars)`);
      if (!c || !Number.isInteger(c.version) || c.version < 1) e.push(`${p}: version must be a positive integer`);
      if (!c || !Array.isArray(c.items)) { e.push(`${p}: items must be an array`); return; }
      c.items.forEach((it, j) => {
        if (!it || !ITEM_KINDS.includes(it.kind)) { e.push(`${p}.items[${j}]: kind must be one of ${ITEM_KINDS.join(", ")}`); return; }
        const q = `${p}.items[${j}]`;
        if (it.kind === "location" && IX && !IX.locations[it.id]) e.push(`${q}: unknown location ${it.id}`);
        if (it.kind === "target" && IX && !IX.targets[it.id]) e.push(`${q}: unknown target ${it.id}`);
        if (it.kind === "earth_cell" && !(Number.isInteger(it.cell) && it.cell >= 0 && it.cell < 361 * 576 && Number.isFinite(it.lat) && Number.isFinite(it.lon))) e.push(`${q}: earth_cell needs an integer cell id and finite lat/lon`);
        if (it.kind === "earth_cell" && it.target != null && IX && !IX.targets[it.target]) e.push(`${q}: unknown target ${it.target}`);
        if (it.kind === "scenario_set" && (!it.config || it.config.schema !== SCENARIO_SCHEMA)) e.push(`${q}: scenario_set must embed an ${SCENARIO_SCHEMA} configuration`);
        if (it.kind === "comparison" && (!it.config || !Array.isArray(it.config.targets) || !AGGREGATES[it.config.aggregate])) e.push(`${q}: comparison needs targets and a supported aggregate`);
        if (it.kind === "reference" && !String(it.citation || "").trim()) e.push(`${q}: reference needs a citation`);
        if (["earth_cell", "scenario_set", "comparison"].includes(it.kind) && !(it.snapshot && it.snapshot.registry_version && it.snapshot.stack_sha256)) e.push(`${q}: ${it.kind} needs a provenance snapshot (registry version, stack SHA-256)`);
        if (it && it.note != null && (typeof it.note !== "string" || it.note.length > 2000)) e.push(`${p}.items[${j}]: note must be text ≤ 2000 chars`);
      });
    });
    return e;
  }
  const canon = x => JSON.stringify(x, Object.keys(x).sort());
  function sameCollection(a, b) { return a.name === b.name && a.version === b.version && JSON.stringify(a.items) === JSON.stringify(b.items) && (a.notes || "") === (b.notes || ""); }
  /* merge never overwrites: identical → skipped; same id, different content → conflict (left untouched) */
  function mergeCollections(existing, incoming) {
    const out = existing.map(c => ({ ...c, items: c.items.slice() })), by = Object.fromEntries(out.map(c => [c.id, c]));
    const added = [], skipped = [], conflicts = [];
    for (const c of incoming) {
      const cur = by[c.id];
      if (!cur) { out.push({ ...c, items: c.items.slice() }); by[c.id] = c; added.push(c.id); }
      else if (sameCollection(cur, c)) skipped.push(c.id);
      else conflicts.push({ id: c.id, existing: { name: cur.name, version: cur.version, items: cur.items.length }, incoming: { name: c.name, version: c.version, items: c.items.length },
        reason: "A collection with this id exists with different content. Nothing was overwritten; import it under a new id or keep the existing one." });
    }
    return { collections: out, added, skipped, conflicts };
  }
  function exportCollections(cols, createdUtc) { return { schema: COLLECTION_SCHEMA, exported_utc: createdUtc, engine: VERSION, collections: cols }; }

  function snapshot(IX, targetIds, extra = {}) {
    return Object.assign({ registry_version: IX.R.registry_version, registry_schema: IX.R.schema, readiness_model: IX.R.readiness_model.version,
      stack_sha256: IX.R.stack_sha256, fingerprints: Object.fromEntries(targetIds.filter(t => IX.targets[t]).map(t => [t, IX.targets[t].fingerprint.content_sha256])) }, extra);
  }

  /* ------------------------------------------------------------------ scenario laboratory (reproducible scenario sets) */
  /* A scenario = weights + proxy inclusion + normalisation strategy for ONE target. Ranges are computed by the
   * stated rule and recorded; the expected distinct sites are recorded so the set can be replayed (browser or Python). */
  function scenarioVector(t, includeProxy) {
    const fp = t.fingerprint, tv = {};
    for (const c of Object.keys(fp.variables)) { const s = fp.criterion_status[c]; tv[c] = (s === "DIRECT" || (includeProxy && s === "PROXY")) && fp.variables[c] != null ? +fp.variables[c] : null; }
    return tv;
  }
  function scenarioRanges(A, critIds, tv, normalisation) {
    if (normalisation === "earth_union_target") return earthUnionRanges(A, critIds, tv);
    if (normalisation === "earth_only") return Object.fromEntries(critIds.map(c => [c, earthRange(A, c)]));
    throw new Error("unsupported normalisation " + normalisation);
  }
  function runScenarios({ IX, A, cell, lat, lon, critIds, targetId, scenarios, n = 20, sep = 300, algorithm, createdUtc }) {
    const t = IX.targets[targetId];
    if (!t) throw new Error("unknown target " + targetId);
    if (t.readiness.level < 2) throw new Error(`${t.name}: readiness L${t.readiness.level} — no analytical data`);
    if (!scenarios.length || scenarios.length > 4) throw new Error("1 to 4 scenarios");
    const runs = scenarios.map(sc => {
      const tv = scenarioVector(t, !!sc.include_proxy);
      if (!Object.values(tv).some(v => v != null)) throw new Error(`${sc.label}: no scoreable criterion`);
      const ranges = scenarioRanges(A, critIds, tv, sc.normalisation);
      const P = LAB.prepare(A, critIds, tv, ranges), F = LAB.fieldScore(P, sc.weights);
      const top = distinct(F.eff, cell, lat, lon, n, sep);
      return { sc, tv, ranges, P, eff: F.eff, top, active: F.active };
    });
    const union = Array.from(new Set(runs.flatMap(r => r.top.slice(0, 10))));
    const ranks = runs.map(r => { const k = ranksOf(r.eff, cell, union); return k; });
    const robust = union.filter((i, u) => ranks.every(rk => rk[u] != null && rk[u] <= 100));
    const config = { schema: SCENARIO_SCHEMA, engine: VERSION, created_utc: createdUtc, algorithm, target: targetId, readiness_level: t.readiness.level,
      fingerprint_sha256: t.fingerprint.content_sha256, registry_version: IX.R.registry_version, stack_sha256: IX.R.stack_sha256, n, distinct_sep_km: sep,
      scenarios: runs.map(r => ({ id: r.sc.id, label: r.sc.label, weights: r.sc.weights, include_proxy: !!r.sc.include_proxy, normalisation: r.sc.normalisation,
        target_vector: r.tv, ranges: r.ranges, active_criteria: r.active, expected_top: r.top.map(i => ({ cell: cell[i], score: r.eff[i] })) })) };
    return { runs, union, ranks, robust, config, partial: t.readiness.level < 3 };
  }
  /* per-criterion contribution to the score of cell i: k_c = w_c·s_c / Σ w (criteria with a finite Earth value) */
  function contributions(P, w, i) {
    const act = P.applicable.filter(c => w[c] != null && +w[c] > 0);
    let ws = 0; for (const c of act) if (P.s[c][i] === P.s[c][i]) ws += +w[c];
    return Object.fromEntries(act.map(c => [c, P.s[c][i] === P.s[c][i] && ws > 0 ? +w[c] * P.s[c][i] / ws : null]));
  }
  /* replay a scenario set in the browser: recompute and compare (cells exact, scores to 1e-12) */
  function replayScenarios({ IX, A, cell, lat, lon, critIds, config }) {
    const msgs = [], t = IX.targets[config.target];
    if (config.schema !== SCENARIO_SCHEMA) return { ok: false, msgs: ["not an " + SCENARIO_SCHEMA + " configuration"] };
    if (!t) return { ok: false, msgs: ["target not in this registry"] };
    if (config.stack_sha256 !== IX.R.stack_sha256) return { ok: false, msgs: ["recorded for a different predictor stack"] };
    if (config.fingerprint_sha256 !== t.fingerprint.content_sha256) return { ok: false, msgs: ["target fingerprint differs from this registry"] };
    let ok = true;
    for (const s of config.scenarios) {
      const tv = scenarioVector(t, s.include_proxy), R = scenarioRanges(A, critIds, tv, s.normalisation);
      const rOK = JSON.stringify(R) === JSON.stringify(s.ranges);
      const eff = LAB.fieldScore(LAB.prepare(A, critIds, tv, R), s.weights).eff, top = distinct(eff, cell, lat, lon, config.n, config.distinct_sep_km);
      const same = rOK && top.length === s.expected_top.length && top.every((i, k) => cell[i] === s.expected_top[k].cell && Math.abs(eff[i] - s.expected_top[k].score) <= 1e-12);
      ok = ok && same; msgs.push(`${same ? "OK" : "FAIL"} ${s.label}${rOK ? "" : " (ranges differ)"}`);
    }
    return { ok, msgs };
  }

  /* ------------------------------------------------------------------ provenance / readiness export */
  function provenanceExport(IX, { level = null, kind = "all" } = {}) {
    const keep = r => level == null || level === "" || r.readiness.level === +level;
    const targets = kind === "locations" ? [] : IX.R.targets.filter(keep).map(t => ({
      id: t.id, record_type: t.record_type, name: t.name, body: t.body.id, region: t.region.id, location: t.location.id,
      readiness: { model: t.readiness.model, level: t.readiness.level, label: t.readiness.label, checks: t.readiness.checks.map(c => ({ id: c.id, passed: c.passed, detail: c.detail })) },
      criterion_status: t.fingerprint.criterion_status, fingerprint_version: t.fingerprint.version, fingerprint_sha256: t.fingerprint.content_sha256,
      datasets: t.datasets, scripts: t.provenance.scripts, regeneration: { passed: t.validation.regeneration.passed, summary: t.validation.regeneration.summary },
      scoring: { earth_analogue_enabled: t.scoring.earth_analogue_enabled, configs: t.scoring.configs }, scientific_validation: t.validation.scientific_validation }));
    const locations = kind === "targets" ? [] : IX.R.locations.filter(keep).map(l => ({
      id: l.id, record_type: l.record_type, name: l.name, body: l.body, region: l.region, latitude: l.latitude, longitude_east: l.longitude_east,
      source: l.source, readiness: { level: l.readiness.level, label: l.readiness.label, via_targets: l.readiness.via_targets } }));
    return { schema: "asterro.provenance-export/1", registry: { schema: IX.R.schema, version: IX.R.registry_version, built_utc: IX.R.built_utc },
      readiness_model: IX.R.readiness_model.version, filter: { level, kind }, targets, locations,
      datasets: Array.from(new Set(targets.flatMap(t => t.datasets))).sort().map(d => IX.datasets[d]) };
  }

  const api = { VERSION, SCHEMA, COLLECTION_SCHEMA, VALIDATION_SCHEMA, SCENARIO_SCHEMA, ITEM_KINDS, EVIDENCE, snapshot, scenarioVector, scenarioRanges, runScenarios, contributions, replayScenarios, STATUSES, AGGREGATES, MM_CLASSES, MIN_POS_RECALL, MIN_POS_PRECISION, MIN_NEG_PRECISION,
    norm, index, search, filterLocations, sortLocations, counts, quickActions, compatibility, aggregatePlan, aggregate, vectorOn, earthRange, earthUnionRanges,
    order, distinct, pareto, cellIndexOf, validateCase, validationMetrics, weightSensitivity, holdoutCheck, validationRecord, mismatch,
    newCollection, validateCollections, mergeCollections, exportCollections, provenanceExport, canon };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AsterroRegistry = api;
})(typeof window !== "undefined" ? window : globalThis);
