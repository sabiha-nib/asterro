/* ===== ASTERRO · Mismatch Signatures and Method Arena (Atlas workspace views) =====
 * Both views analyse the target and weights currently active in Explore (any legacy or readiness ≥ 3 target), with
 * the ranges that belong to that target (legacy table, or explore-target-v1). Results come from AsterroMethods
 * (methods_engine.js); the baseline Analogue Score is never altered. Added to the existing module groups. */
const MT = window.AsterroMethods;
const M6 = { tid: null, fam: null, cell: null, arena: null, drop: null, busy: false, key: null };
A4_GROUPS.find(g => g.label === "Compare").items.push(["mmsig", "Mismatch signatures"]);
A4_GROUPS.find(g => g.label === "Research").items.push(["arena", "Method Arena"]);

function m6Targets() { return ["mars_jezero", "moon_south_pole", ...(typeof a4ExploreIds === "function" ? a4ExploreIds() : [])].filter(t => S.T[t]); }
function m6Ctx() {
  const ids = m6Targets();
  let tid = M6.tid && ids.includes(M6.tid) ? M6.tid : (ids.includes(S.targetId) ? S.targetId : "mars_jezero");
  M6.tid = tid;
  const tv = S.T[tid].variables, ranges = typeof a4RangesFor === "function" ? a4RangesFor(tid) : S.app.ranges, w = { ...S.weights };
  return { tid, tv, ranges, w, config: typeof a4IsNew === "function" && a4IsNew(tid) ? "explore-target-v1" : "legacy-baseline-v1",
    key: [tid, JSON.stringify(w), JSON.stringify(ranges)].join("|") };
}
function m6Head(title, banner, ctx) {
  return `<div class="sec"><h3 class="ttl">${esc(title)}</h3>${a4Banner(banner)}
    <div class="lab-form"><label>Target<select data-m6in="tid">${m6Targets().map(t => `<option value="${t}" ${t === ctx.tid ? "selected" : ""}>${esc(TNAME[t] || t)}</option>`).join("")}</select></label>
    <span class="meta small">Weights from Explore (${esc(currentLabel())}): ${S.critIds.map(c => `${esc(shortOf(c))} ${(+ctx.w[c]).toFixed(2)}`).join(" · ")} · configuration ${esc(ctx.config)}. Change them in the console below.</span></div></div>`;
}
const M6_CODE_CLS = { "≈": "st-d", "+": "st-p", "−": "st-p", "++": "p4-bad", "−−": "p4-bad", "?": "st-u" };
function m6Chip(code, crit) { return `<span class="m6-chip ${M6_CODE_CLS[code]}" title="${esc(labelOf(crit))}: ${esc(MT.CODES[code])}"><i>${esc(shortOf(crit))}</i>${esc(code)}</span>`; }

/* ---------------------------------------------------------------- Mismatch signatures */
A3_VIEWS.mmsig = function () {
  if (!S.res) return `<div class="sec"><div class="empty">Run a search in Explore first.</div></div>`;
  const ctx = m6Ctx(), thr = S.app.thresholds;
  const eff = effectiveFor(ctx.tid, ctx.w);
  const F = MT.families({ A: S.A, critIds: S.critIds, tv: ctx.tv, w: ctx.w, ranges: ctx.ranges, eff, cell: S.cell, lat: S.lat, lon: S.lon, thr });
  const C = MT.ceiling({ A: S.A, critIds: S.critIds, tv: ctx.tv, w: ctx.w, ranges: ctx.ranges, thr });
  M6._last = { ctx, F, C };
  const fam = F.families.find(f => f.key === M6.fam) || F.families[0];
  const top1 = F.families[0].best, i = M6.cell != null && eff[M6.cell] >= 0 ? M6.cell : top1;
  const SW = MT.sameWay({ A: S.A, critIds: S.critIds, tv: ctx.tv, w: ctx.w, ranges: ctx.ranges, eff, cell: S.cell, lat: S.lat, lon: S.lon, thr, i });
  M6._sw = { i, SW };
  let h = m6Head("Mismatch signatures", "how Earth fails to match a target", ctx) + `
  <div class="sec"><p class="note">Every eligible Earth cell gets one code per active criterion from the signed, range-normalised difference δ = (Earth − target) / (max − min), using the baseline's own thresholds: ${Object.entries(MT.CODES).map(([k, v]) => `<b>${esc(k)}</b> ${esc(v)}`).join(" · ")}. Cells with the same codes fail to match <i>in the same way</i> — a mismatch family. Families are an exact partition, not a clustering.</p></div>
  <div class="sec"><div class="lbl">1 · Earth ceiling — what no weighting can fix</div><div class="tbl-wrap"><table class="t"><caption class="sr-only">Best similarity any Earth cell reaches per criterion</caption><thead><tr><th>Criterion</th><th class="n">Target</th><th class="n">Earth range</th><th class="n">Best s</th><th class="n">Cells within match</th><th>Reading</th></tr></thead><tbody>
    ${C.map(x => `<tr${x.structural ? ' class="m6-struct"' : ""}><td>${esc(labelOf(x.criterion))}${S.T[ctx.tid].proxy_flags && S.T[ctx.tid].proxy_flags[x.criterion] ? ' <span class="tag proxy" title="The target value is a rule, not a measurement">proxy</span>' : ""}</td><td class="n">${atVal(x.criterion, x.target)}</td><td class="n">${fmtVal(x.criterion, x.earthMin)} – ${fmtVal(x.criterion, x.earthMax)}</td><td class="n">${x.bestS.toFixed(3)}</td><td class="n">${x.cellsMatch.toLocaleString()}</td><td class="small ${x.structural ? "p4-bad" : ""}">${esc(x.text)}${x.structural ? " A structural limit of the comparison." : ""}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="sec"><div class="lbl">2 · Mismatch families<span class="n">${F.nFamilies} signatures over ${F.nEligible.toLocaleString()} eligible cells</span></div>
    <div class="tbl-wrap"><table class="t m6-fam"><caption class="sr-only">Mismatch families ordered by their best score</caption><thead><tr><th>Signature</th><th class="n">Cells</th><th class="n">Share</th><th class="n">≈ count</th><th>Best site</th><th class="n">Best</th><th class="n">Mean</th></tr></thead><tbody>
      ${F.families.slice(0, 14).map(f => `<tr class="${f === fam ? "act" : ""}"><td><button class="lnk m6-sig" data-m6="fam" data-k="${esc(f.key)}" aria-pressed="${f === fam}" aria-label="Family ${esc(f.codes.join(" "))}">${f.codes.map((c, k) => m6Chip(c, F.criteria[k])).join("")}</button></td><td class="n">${f.size.toLocaleString()}</td><td class="n">${(100 * f.share).toFixed(1)} %</td><td class="n">${f.nMatch}/${F.criteria.length}</td><td><button class="lnk" data-m6="cell" data-i="${f.best}">${esc(placeStr(f.best))}</button></td><td class="n">${fmtPct(f.bestScore)}</td><td class="n">${fmtPct(f.meanScore)}</td></tr>`).join("")}</tbody></table></div>
    <p class="meta small">Ordered by the best score inside each family. The ${F.nFamilies > 14 ? F.nFamilies - 14 + " remaining families are included in the export." : "list is complete."}</p></div>
  <div class="sec"><div class="lbl">3 · Selected family</div><div class="row">${fam.codes.map((c, k) => m6Chip(c, F.criteria[k])).join("")}<span class="meta small">${fam.size.toLocaleString()} cells · ${fam.sites.length} distinct sites ≥ 300 km apart</span></div>
    ${atEarthMap("m6fam", fam.sites.map((j, k) => ({ i: j, label: String(k + 1), title: `${placeStr(j)} · ${fmtPct(eff[j])}` })))}
    <ol class="lab-ul small">${fam.sites.map(j => `<li><button class="lnk" data-m6="cell" data-i="${j}">${esc(placeStr(j))}</button> · ${fmtPct(eff[j])}</li>`).join("")}</ol></div>
  <div class="sec"><div class="lbl">4 · Sites that fail the same way</div><p class="small">as <b>${esc(placeStr(i))}</b></p>
    <div class="row">${SW.signature.map(x => m6Chip(x.code, x.criterion)).join("")}<span class="meta small">family of ${SW.familySize.toLocaleString()} cells</span>
      <button class="btn-sm" data-m6="globe" data-i="${i}">Show on globe</button></div>
    <div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th><th class="n">Earth</th><th class="n">Target</th><th class="n">δ</th><th class="n">s</th></tr></thead><tbody>${SW.signature.map(x => `<tr><td>${esc(labelOf(x.criterion))}</td><td class="n">${x.earth == null ? "missing" : atVal(x.criterion, x.earth)}</td><td class="n">${atVal(x.criterion, x.target)}</td><td class="n">${x.delta == null ? "—" : (x.delta >= 0 ? "+" : "−") + Math.abs(x.delta).toFixed(3)}</td><td class="n">${x.s == null ? "—" : x.s.toFixed(3)}</td></tr>`).join("")}</tbody></table></div>
    <div class="grid2"><div><div class="cap">Same signature, ≥ 300 km away</div><ol class="lab-ul small">${SW.sameFamily.map(j => `<li><button class="lnk" data-m6="cell" data-i="${j}">${esc(placeStr(j))}</button> · ${fmtPct(eff[j])}</li>`).join("") || "<li>No other distinct site has this signature.</li>"}</ol></div>
      <div><div class="cap">Closest mismatch pattern (Euclidean distance in δ)</div><ol class="lab-ul small">${SW.nearest.map(x => `<li><button class="lnk" data-m6="cell" data-i="${x.i}">${esc(placeStr(x.i))}</button> · distance ${x.distance.toFixed(3)} · ${fmtPct(x.score)}</li>`).join("")}</ol></div></div>
    <p class="meta small">Two sites with the same signature can have different scores; they share the direction and size class of every difference. δ is a normalised difference — not a physical equivalence.</p>
    <div class="row"><button class="btn-sm" data-m6="exp-sig">Export mismatch report (JSON)</button></div></div>`;
  return h;
};

/* ---------------------------------------------------------------- Method Arena */
function m6Sources() {
  const o = {}; for (const c of S.app.criteria) for (const s of c.earth_source) (o[s] = o[s] || []).push(c.id); return o;
}
async function m6RunArena() {
  const ctx = m6Ctx(); M6.busy = true; atRender();
  await new Promise(r => setTimeout(r, 20));
  try {
    const t0 = performance.now();
    const AR = MT.arena({ A: S.A, cell: S.cell, lat: S.lat, lon: S.lon, critIds: S.critIds, tv: ctx.tv, w: ctx.w, ranges: ctx.ranges });
    const X = MT.dropSource({ A: S.A, cell: S.cell, lat: S.lat, lon: S.lon, critIds: S.critIds, tv: ctx.tv, w: ctx.w, ranges: ctx.ranges, sources: m6Sources() });
    AR.ms = performance.now() - t0;
    /* the arena's baseline must equal Explore's live field for this configuration — refuse to show it otherwise */
    const live = effectiveFor(ctx.tid, ctx.w); let d = 0; for (let i = 0; i < S.n; i++) if (!Object.is(live[i], AR.results.baseline.eff[i])) d++;
    AR.baselineCheck = d;
    M6.arena = AR; M6.drop = X; M6.key = ctx.key;
    announce(`Method Arena: ${AR.methods.length} methods compared in ${(AR.ms / 1000).toFixed(1)} s.`);
  } catch (e) { M6.arena = { error: e.message }; }
  M6.busy = false; atRender();
}
A3_VIEWS.arena = function () {
  if (!S.res) return `<div class="sec"><div class="empty">Run a search in Explore first.</div></div>`;
  const ctx = m6Ctx(), AR = M6.arena && M6.key === ctx.key ? M6.arena : null, X = AR ? M6.drop : null;
  let h = m6Head("Method Arena", "competing scoring rules beside the baseline", ctx) + `
  <div class="sec"><p class="note">How much does a conclusion depend on the scoring rule itself? The unchanged baseline runs beside three alternative rules on identical data, target and weights. Agreement between methods shows how robust a ranking is to the rule; it does <b>not</b> show that any method is scientifically correct.</p>
    <div class="tbl-wrap"><table class="t"><thead><tr><th>Method</th><th>Rule</th><th>Why it exists</th></tr></thead><tbody>${Object.entries(MT.METHODS).map(([k, m]) => `<tr><td><b>${esc(m.label)}</b>${k === "baseline" ? ' <span class="tag st-d">authoritative</span>' : ""}</td><td class="small mono">${esc(m.rule)}</td><td class="small">${esc(m.note)}</td></tr>`).join("")}</tbody></table></div>
    <div class="row"><button class="btn-sm" data-m6="run" ${M6.busy ? "disabled" : ""}>${M6.busy ? "Computing…" : AR ? "Re-run" : "Run the arena"}</button>
      ${M6.arena && !AR && !M6.arena.error ? '<span class="meta small">The configuration changed since the last run — results hidden until you re-run.</span>' : ""}
      ${M6.arena && M6.arena.error ? `<span class="small p4-bad">${esc(M6.arena.error)}</span>` : ""}<span aria-live="polite" class="meta small">${M6.busy ? "Scoring 76,781 cells under 4 rules and 3 data counterfactuals…" : ""}</span></div></div>`;
  if (!AR) return h;
  const L = AR.methods;
  h += `<div class="sec"><div class="lbl">1 · Agreement between methods<span class="n">${(AR.ms / 1000).toFixed(1)} s · baseline check ${AR.baselineCheck === 0 ? "identical to Explore" : AR.baselineCheck + " differences"}</span></div>
    <div class="tbl-wrap"><table class="t"><caption class="sr-only">Pairwise agreement</caption><thead><tr><th>Pair</th><th class="n">Spearman ρ</th><th class="n">cells compared</th><th class="n">Leading-10 overlap</th><th class="n">Top-100 Jaccard</th><th>Same #1</th></tr></thead><tbody>
      ${AR.pairs.map(p => `<tr><td>${esc(MT.METHODS[p.a].label)} × ${esc(MT.METHODS[p.b].label)}</td><td class="n">${p.rho == null ? "—" : p.rho.toFixed(3)}</td><td class="n">${p.nCommon.toLocaleString()}</td><td class="n ${p.leadingOverlap <= 3 ? "p4-bad" : p.leadingOverlap >= 8 ? "st-d" : ""}">${p.leadingOverlap}/10</td><td class="n">${p.jaccardTop.toFixed(2)}</td><td>${p.sameTop1 ? "yes" : "no"}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="sec"><div class="lbl">2 · The baseline's leading sites under each rule</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Baseline site</th>${L.map(m => `<th class="n">${esc(MT.METHODS[m].label.split(" (")[0])}</th>`).join("")}</tr></thead><tbody>
    ${AR.leaders.map(l => `<tr><td><button class="lnk" data-m6="globe" data-i="${l.i}">${esc(placeStr(l.i))}</button></td>${L.map(m => `<td class="n">${l.ranks[m] == null ? "ineligible" : "#" + l.ranks[m].toLocaleString()}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="meta small">Cell ranks (not distinct-site positions) under each rule.</p></div>
  <div class="sec"><div class="lbl">3 · Method-robust sites<span class="n">in the top 100 cells under every rule</span></div>
    ${AR.robust.length ? `<ol class="lab-ul">${AR.robust.map(i => `<li><button class="lnk" data-m6="globe" data-i="${i}">${esc(placeStr(i))}</button> · baseline ${fmtPct(AR.results.baseline.eff[i])}</li>`).join("")}</ol>` : `<p class="callout">No site is in the top 100 under all four rules: for this target and weighting, which sites lead is decided by the scoring rule.</p>`}
    <p class="meta small">${AR.robustPool} cells qualify; shown as distinct sites ≥ 300 km apart, ordered by baseline score.</p></div>
  <div class="sec"><div class="lbl">4 · Data counterfactual — leave one Earth source out (baseline rule)</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Source removed</th><th>Criteria excluded</th><th class="n">Leading 10 kept</th><th>#1</th><th class="n">ρ vs full</th></tr></thead><tbody>
    ${X.results.map(r => `<tr><td>${esc((S.app.datasets.find(d => d.id === r.source) || {}).provider || r.source)}<div class="meta small">${esc(r.source)}</div></td><td class="small">${r.dropped.map(labelOf).map(esc).join(", ") || "—"}</td><td class="n ${r.kept === 0 ? "p4-bad" : ""}">${r.blocked || r.skipped ? "—" : r.kept + "/10"}</td><td class="small">${r.blocked ? esc(r.blocked) : r.skipped ? esc(r.skipped) : r.sameTop1 ? "unchanged" : `→ ${esc(placeStr(r.top[0]))}`}</td><td class="n">${r.rho == null ? "—" : r.rho.toFixed(3)}</td></tr>`).join("")}</tbody></table></div>
    <p class="meta small">${esc(X.note)}</p>
    <div class="row"><button class="btn-sm" data-m6="exp-arena">Export comparison report (JSON)</button></div>
    <p class="meta small">An independent numpy re-implementation (tests/test_methods.py) reproduces every method's leading sites to 1e-12. That checks the implementation, not the science.</p></div>`;
  return h;
};
function m6Report(kind) {
  const meta = { engine: MT.VERSION, algorithm_version: S.app.algorithm_version, predictor_stack_sha256: S.app.stack.sha256, created_utc: new Date().toISOString() };
  if (kind === "sig") {
    const { ctx, F, C } = M6._last, { i, SW } = M6._sw;
    return { schema: "asterro.mismatch-signatures/1", ...meta, target: ctx.tid, scoring_config: ctx.config, weights: ctx.w, normalization_ranges: ctx.ranges, thresholds: S.app.thresholds,
      codes: MT.CODES, criteria: F.criteria, n_eligible: F.nEligible, n_families: F.nFamilies,
      families: F.families.map(f => ({ signature: f.codes, cells: f.size, share: +f.share.toFixed(6), best_cell_id: S.cell[f.best], best_score: +f.bestScore.toFixed(12), mean_score: +f.meanScore.toFixed(12), sites: f.sites.map(j => S.cell[j]) })),
      earth_ceiling: C.map(x => ({ criterion: x.criterion, target: x.target, earth_min: x.earthMin, earth_max: x.earthMax, best_s: +x.bestS.toFixed(12), cells_within_match: x.cellsMatch, structural: x.structural })),
      same_way: { cell_id: S.cell[i], signature: SW.signature.map(x => ({ criterion: x.criterion, delta: x.delta, code: x.code })), same_family_sites: SW.sameFamily.map(j => S.cell[j]), nearest: SW.nearest.map(x => ({ cell_id: S.cell[x.i], distance: +x.distance.toFixed(12) })) },
      limitations: "δ is a range-normalised difference under this configuration's ranges; a shared signature is a shared direction and size class of difference, not physical equivalence." };
  }
  const AR = M6.arena, X = M6.drop, ctx = m6Ctx();
  return { schema: "asterro.method-arena/1", ...meta, target: ctx.tid, scoring_config: ctx.config, weights: ctx.w, normalization_ranges: ctx.ranges,
    methods: Object.fromEntries(AR.methods.map(m => [m, { ...MT.METHODS[m], n_eligible: AR.results[m].nEligible, top: AR.results[m].top.slice(0, 10).map(i => ({ cell_id: S.cell[i], score: +AR.results[m].eff[i].toFixed(12) })) }])),
    pairs: AR.pairs, method_robust_sites: AR.robust.map(i => S.cell[i]), baseline_matches_explore: AR.baselineCheck === 0,
    data_counterfactuals: X.results.map(r => ({ source: r.source, excluded_criteria: r.dropped, kept: r.kept ?? null, same_top1: r.sameTop1 ?? null, top: (r.top || []).map(i => S.cell[i]), note: r.blocked || r.skipped || null })),
    statement: AR.note };
}
function m6Download(kind) {
  const doc = m6Report(kind), blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }), u = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = u; a.download = kind === "sig" ? `asterro_mismatch_${doc.target}.json` : `asterro_method_arena_${doc.target}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000);
}
document.addEventListener("click", e => {
  const a = e.target.closest("[data-m6]"); if (!a || a.disabled) return;
  e.preventDefault(); const k = a.dataset.m6;
  if (k === "fam") { M6.fam = a.dataset.k; atRender(); }
  else if (k === "cell") { M6.cell = +a.dataset.i; atRender(); }
  else if (k === "globe") select(+a.dataset.i, true);
  else if (k === "run") m6RunArena();
  else if (k === "exp-sig") m6Download("sig");
  else if (k === "exp-arena") m6Download("arena");
});
document.addEventListener("change", e => {
  const a = e.target.closest("[data-m6in]"); if (!a) return;
  if (a.dataset.m6in === "tid") { M6.tid = a.value; M6.fam = null; M6.cell = null; atRender(); }
});
