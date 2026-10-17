/* ===== Phase IV · Planetary Comparison Lab =====
 * Side-by-side fingerprints, a criterion compatibility matrix (status, source, spatial and temporal support),
 * pairwise shared-DIRECT counts, and multi-target aggregates (minimum · labelled mean · Pareto · per-criterion).
 * An aggregate is blocked when the targets share no DIRECT criterion; criteria outside the shared DIRECT set are
 * listed as excluded, never silently mixed. Jezero + Lunar South Pole + minimum runs the unchanged legacy
 * cross-planet configuration, and its regression against the baseline field can be run here. */
const A4_CLS = { "shared-direct": ["st-d", "shared DIRECT"], "proxy-involved": ["st-p", "PROXY involved — excluded"], "not-applicable": ["st-x", "N/A for a target — excluded"], missing: ["st-m", "MISSING for a target — excluded"] };
function a4CmpTargets() {
  if (!A4.cmp.length) A4.cmp = (A3.sel.length >= 2 ? A3.sel : ["mars_gale_curiosity", "moon_shackleton"]).filter(a4T);
  return A4.cmp.map(a4T).filter(Boolean);
}
function a4RunAgg() {
  const ids = A4.cmp.slice(), t0 = performance.now();
  try {
    A4.aggRes = RG.aggregate({ IX: A4.ix, A: S.A, cell: S.cell, lat: S.lat, lon: S.lon, critIds: S.critIds, targetIds: ids, kind: A4.agg, w: atWeights(), legacyRanges: S.app.ranges });
    A4.aggRes.ms = performance.now() - t0; A4.aggRes.ids = ids; A4.aggRes.profile = A3.profile;
    announce(A4.aggRes.ok ? `${A4.agg} aggregate computed for ${ids.length} targets.` : "Aggregate blocked: " + A4.aggRes.plan.reason);
  } catch (e) { A4.aggRes = { ok: false, plan: { reason: e.message } }; }
  atRender();
}
function a4LegacyRegression() {
  const w = S.weights, r = RG.aggregate({ IX: A4.ix, A: S.A, cell: S.cell, lat: S.lat, lon: S.lon, critIds: S.critIds, targetIds: TARGET_IDS.slice(), kind: "minimum", w, legacyRanges: S.app.ranges });
  const base = effectiveFor("cross", w);
  let d = 0; for (let i = 0; i < S.n; i++) if (!Object.is(base[i], r.eff[i])) d++;
  const o = ENG.order(base, S.cell), dist = ENG.distinctSites(o, S.lat, S.lon, 20, S.app.thresholds.distinct_sep_km);
  A4.legacyCheck = { diffs: d, sameTop: JSON.stringify(dist) === JSON.stringify(r.top.map(x => x.i)), profile: currentLabel(), at: a4Now() };
  announce(d === 0 ? "Legacy cross-planet regression: identical." : `Legacy cross-planet regression: ${d} differences.`);
  atRender();
}
function a4AggResults(R, ts) {
  if (!R) return `<p class="meta">Choose an aggregate and run it.</p>`;
  if (!R.ok) return `<div class="callout">Blocked: ${esc(R.plan.reason)}</div>`;
  const P = R.plan, head = `<p class="note small"><b>${esc(P.legacy ? "Legacy configuration" : P.config)}</b> · ${esc(P.reason)} · profile ${esc(S.app.profiles[R.profile].label)} · ${R.ms.toFixed(0)} ms <button class="btn-sm" data-a4="aggsave">Save to collection</button></p>`;
  const L = ts.map((t, k) => `<th class="n">${AT_LETTER[k]}</th>`).join("");
  if (R.kind === "pareto") {
    const f = R.front.slice().sort((a, b) => (Math.min(...R.perTarget.map(x => x[b])) - Math.min(...R.perTarget.map(x => x[a]))) || (S.cell[a] - S.cell[b]));
    return head + `<p class="note">${f.length} Pareto-optimal cells: none can be improved for one target without losing for another. Listed by their lowest target score (a display order, not a ranking).</p>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>Cell</th>${L}</tr></thead><tbody>${f.slice(0, 25).map(i => `<tr><td><button class="lnk" data-a3="baseline" data-i="${i}">${esc(placeStr(i))}</button></td>${R.perTarget.map(x => `<td class="n">${fmtPct(x[i])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  if (R.kind === "per_criterion") {
    return head + Object.entries(R.perCrit).map(([c, v]) => `<div class="lbl">${esc(labelOf(c))} — minimum criterion similarity over the targets</div><ol class="lab-ul small">${v.top.map(x => `<li>${esc(placeStr(x.i))} · ${x.score.toFixed(3)}</li>`).join("")}</ol>`).join("") +
      `<p class="note small">No cross-criterion sum is formed in this mode.</p>`;
  }
  return head + (R.kind === "mean" ? `<p class="callout small">Mean of the per-target scores — a labelled summary. A high mean can hide a poor match to one target; check the per-target columns.</p>` : "") +
    `<div class="tbl-wrap"><table class="t"><thead><tr><th>#</th><th>Earth cell</th><th class="n">${R.kind === "mean" ? "mean" : "min"}</th>${L}</tr></thead><tbody>${R.top.map((x, k) => `<tr><td>${k + 1}</td><td><button class="lnk" data-a3="baseline" data-i="${x.i}">${esc(placeStr(x.i))}</button></td><td class="n"><b>${fmtPct(x.score)}</b></td>${x.perTarget.map(v => `<td class="n">${fmtPct(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function a4ProfileSel() {
  return `<div class="lab-form"><label>Weighting profile<select data-a3in="profile">${Object.entries(S.app.profiles).map(([k, p]) => `<option value="${k}" ${k === A3.profile ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select></label><span class="meta small">${esc(AT_PROFILE_NOTE)} Normalisation is fixed by the scoring configuration shown with each result.</span></div>`;
}
A3_VIEWS.lab4 = function () {
  const need = a4Need(); if (need) return need;
  const ts = a4CmpTargets(), C = ts.length ? RG.compatibility(ts, S.critIds) : null;
  const pick = A4.reg.targets.filter(t => t.readiness.level >= 2 && !A4.cmp.includes(t.id));
  let h = `<div class="sec"><h3 class="ttl">Planetary Comparison Lab</h3>${a4Banner("multi-target comparison")}
    <p class="note">Compare analytical targets criterion by criterion before any aggregate. Aggregates use only criteria that are DIRECT for every selected target; everything else is listed as excluded.</p>
    <div class="row">${ts.map((t, k) => `<span class="tag"><b>${AT_LETTER[k]}</b> ${esc(t.name)} · L${t.readiness.level} <button class="lnk" data-a4="cmprm" data-id="${t.id}" aria-label="Remove ${esc(t.name)}">×</button></span>`).join("")}
      <label class="p4-inl">Add<select data-a4in="cmpadd" aria-label="Add a target"><option value="">target…</option>${["mars", "moon"].map(b => `<optgroup label="${b === "mars" ? "Mars" : "Moon"}">${pick.filter(t => t.body.id === b).map(t => `<option value="${t.id}">${esc(t.name)} — L${t.readiness.level}</option>`).join("")}</optgroup>`).join("")}</select></label>
      <button class="btn-sm" data-a4="cmpex" data-set="mars_jezero,moon_south_pole">Legacy pair</button><button class="btn-sm" data-a4="cmpex" data-set="mars_gale_curiosity,mars_elysium_planitia,moon_shackleton">Gale · Elysium · Shackleton</button></div></div>`;
  if (ts.length < 2) return h + `<div class="sec"><div class="empty">Select at least two targets.</div></div>`;
  h += `<div class="sec"><div class="lbl">1 · Fingerprints side by side</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th>${ts.map((t, k) => `<th>${AT_LETTER[k]} · ${esc(t.name)}<div class="meta">${a4Level(t)}</div></th>`).join("")}</tr></thead><tbody>
    ${S.critIds.map(c => `<tr><td>${esc(labelOf(c))}</td>${ts.map(t => { const s = t.fingerprint.criterion_status[c], v = t.fingerprint.variables[c]; return `<td class="${{ DIRECT: "st-d", PROXY: "st-p", "N/A": "st-x", MISSING: "st-m" }[s]}">${v == null ? "—" : atVal(c, v)} <span class="small">${esc(s)}</span></td>`; }).join("")}</tr>`).join("")}</tbody></table></div></div>
  <div class="sec"><div class="lbl">2 · Compatibility matrix</div><div class="tbl-wrap"><table class="t p4-cm"><caption class="sr-only">Per-criterion compatibility of the selected targets</caption><thead><tr><th>Criterion</th>${ts.map((t, k) => `<th>${AT_LETTER[k]}</th>`).join("")}<th>Verdict</th><th>Source / scale / time</th></tr></thead><tbody>
    ${C.criteria.map(r => `<tr><td>${esc(labelOf(r.criterion))}</td>${r.statuses.map(s => `<td class="${{ DIRECT: "st-d", PROXY: "st-p", "N/A": "st-x", MISSING: "st-m" }[s]}">${esc(s)}</td>`).join("")}<td><span class="tag ${A4_CLS[r.class][0]}">${esc(A4_CLS[r.class][1])}</span></td>
      <td class="small">${r.class === "shared-direct" ? [r.sourceDiffers ? "different source products: " + r.datasets.join(" · ") : "same source family", r.scaleDiffers ? "different spatial support" : "same spatial support", r.timeDiffers ? "different temporal support" : "same temporal support"].map(esc).join("; ") : "—"}
      ${r.class === "shared-direct" && (r.scaleDiffers || r.timeDiffers) ? `<details><summary>details</summary>${r.spatial.map((s, k) => `<div>${AT_LETTER[k]}: ${esc(s)} · ${esc(r.temporal[k])}</div>`).join("")}</details>` : ""}</td></tr>`).join("")}</tbody></table></div>
    <div class="row"><span class="meta">Shared DIRECT criteria: <b>${C.sharedDirect.length}</b> (${esc(C.sharedDirect.map(shortOf).join(", ") || "none")})</span></div>
    <div class="tbl-wrap"><table class="t p4-pair" aria-label="Pairwise number of shared DIRECT criteria"><thead><tr><th></th>${ts.map((t, k) => `<th>${AT_LETTER[k]}</th>`).join("")}</tr></thead><tbody>${C.pairwiseSharedDirect.map((row, k) => `<tr><th>${AT_LETTER[k]}</th>${row.map((v, j) => `<td class="n" style="--a:${(v / 6).toFixed(2)}">${j === k ? "—" : v}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
  const plan = RG.aggregatePlan(A4.ix, A4.cmp, A4.agg, S.critIds);
  h += `<div class="sec"><div class="lbl">3 · Aggregate</div><div class="p4-agg" role="radiogroup" aria-label="Aggregate">${Object.entries(RG.AGGREGATES).map(([k, v]) => {
      const p = RG.aggregatePlan(A4.ix, A4.cmp, k, S.critIds);
      return `<label class="p4-radio${p.ok ? "" : " off"}"><input type="radio" name="a4agg" data-a4in="agg" value="${k}" ${A4.agg === k ? "checked" : ""}> <b>${esc(k.replace("_", "-"))}</b><span class="meta small">${esc(v)}</span>${p.ok ? "" : `<span class="small st-m">blocked: ${esc(p.reason)}</span>`}</label>`; }).join("")}</div>
    ${a4ProfileSel()}
    <div class="row"><button class="btn-sm" data-a4="aggrun" ${plan.ok ? "" : 'disabled aria-describedby="agg-why"'}>Run ${esc(A4.agg.replace("_", "-"))}</button>${plan.ok ? `<span class="meta small">${esc(plan.reason)}</span>` : `<span class="meta small" id="agg-why">${esc(plan.reason)}</span>`}</div>
    <div aria-live="polite">${a4AggResults(A4.aggRes && JSON.stringify(A4.aggRes.ids) === JSON.stringify(A4.cmp) && A4.aggRes.kind === A4.agg ? A4.aggRes : (A4.aggRes && !A4.aggRes.ok ? A4.aggRes : null), ts)}</div></div>
  <div class="sec"><div class="lbl">4 · Legacy cross-planet configuration (regression)</div>
    <p class="note small">${esc(A4.reg.comparison_experiments[0].meaning)} Configuration legacy-baseline-v1 (legacy normalisation table, DIRECT + PROXY per target). The check recomputes it with the Phase IV aggregate engine and compares it bit for bit with the baseline cross-planet field under the current Explore weights.</p>
    <div class="row"><button class="btn-sm" data-a4="legacy">Run regression check</button>${A4.legacyCheck ? `<span class="${A4.legacyCheck.diffs === 0 && A4.legacyCheck.sameTop ? "st-d" : "p4-bad"}">${A4.legacyCheck.diffs === 0 && A4.legacyCheck.sameTop ? "IDENTICAL" : "DIFFERS"}: ${A4.legacyCheck.diffs} cell differences; distinct sites ${A4.legacyCheck.sameTop ? "identical" : "differ"} (${esc(A4.legacyCheck.profile)})</span>` : ""}</div></div>`;
  return h;
};
Object.assign(A4_ACTIONS, {
  cmprm(a) { A4.cmp = A4.cmp.filter(x => x !== a.dataset.id); A4.aggRes = null; atRender(); },
  cmpex(a) { A4.cmp = a.dataset.set.split(","); A4.aggRes = null; if (A4.cmp.length === 2 && A4.cmp.every(x => TARGET_IDS.includes(x))) A4.agg = "minimum"; atRender(); },
  aggrun() { a4RunAgg(); },
  aggsave() {
    const R = A4.aggRes; if (!R || !R.ok) return;
    const cfg = { targets: R.ids, aggregate: R.kind, scoring_config: R.plan.config, legacy: R.plan.legacy || null, criteria: R.plan.criteria, excluded: R.plan.excluded || [],
      profile: R.profile, weights: S.app.profiles[R.profile].weights, algorithm: S.app.algorithm_version,
      result: R.top ? R.top.slice(0, 10).map(x => ({ cell: S.cell[x.i], score: x.score, per_target: x.perTarget })) : R.front ? { pareto_cells: R.front.map(i => S.cell[i]) } : { per_criterion: Object.fromEntries(Object.entries(R.perCrit).map(([c, v]) => [c, v.top.map(x => ({ cell: S.cell[x.i], score: x.score }))])) } };
    a4SaveItem({ kind: "comparison", label: `${R.kind.replace("_", "-")} · ${R.ids.map(id => a4T(id).name.split(" (")[0]).join(" + ")}`, config: cfg, snapshot: RG.snapshot(A4.ix, R.ids) });
  },
  legacy() { a4LegacyRegression(); },
});
Object.assign(A4_INPUTS, {
  cmpadd(a) { if (a.value && !A4.cmp.includes(a.value)) A4.cmp.push(a.value); A4.aggRes = null; atRender(); },
  agg(a) { A4.agg = a.value; atRender(); },
});
