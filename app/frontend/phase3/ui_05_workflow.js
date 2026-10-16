/* ===== Phase III · Research workflow (Target → Candidate → Evidence → Robustness → Requirements →
 * Measurements → Plan → Record) and the shared experiment contract (asterro.experiment/2). ===== */
const A3_VAULT = "asterro.phase3.vault.v2";
function atVaultLoad() { try { const s = localStorage.getItem(A3_VAULT); A3.records = s ? JSON.parse(s) : []; } catch (e) { A3.records = []; } }
function atVaultSave() { try { localStorage.setItem(A3_VAULT, JSON.stringify(A3.records.slice(-80))); return true; } catch (e) { return false; } }
atVaultLoad();
function atContext(targets, stage) {
  return { kind: "atlas", targets, workflow_stage: stage || null,
    atlas: { version: A3.atlas.version, schema: A3.atlas.schema, built_utc: A3.atlas.built_utc },
    normalisation: { kind: A3.norm, id: A3.norm === "atlas" ? A3.atlas.normalisation.id : A3.norm,
      ranges: Object.fromEntries(targets.map(id => [id, atRanges(atT(id))])) },
    profile: A3.profile, weights: atWeights(), include_proxy: A3.includeProxy,
    target_vectors: Object.fromEntries(targets.map(id => [id, ATL.targetVector(atT(id), S.critIds, { includeProxy: A3.includeProxy })])),
    predictor_stack: { sha256: S.app.stack.sha256 }, algorithm_version: S.app.algorithm_version,
    min_coverage: S.app.thresholds.min_coverage, distinct_sep_km: S.app.thresholds.distinct_sep_km };
}
async function atMakeRecord(module, params, outputs, { targets, stage, claims = [], limitations = [], parents = [] } = {}) {
  const r0 = { schema: ATL.CONTRACT, contract: "2.0.0", module, context: atContext(targets, stage), params };
  const id = (await LAB.sha256Hex(LAB.canonical(ATL.recordConfigV2(r0)))).slice(0, 16);
  const rec = { ...r0, id, created_utc: new Date().toISOString(), outputs, outputs_sha256: await LAB.sha256Hex(LAB.canonical(outputs)),
    claims, limitations, parents, replay: ["atlas-candidates", "atlas-stability"].includes(module) ? "browser + python (scripts/replay_atlas_record.py)" : "browser",
    software: { app: S.app.algorithm_version, phase2: LAB.VERSION, phase3: ATL.VERSION } };
  const issues = ATL.validateV2(rec); if (issues.length) throw new Error("record invalid: " + issues.join("; "));
  A3.records = A3.records.filter(r => r.id !== id); A3.records.push(rec); atVaultSave();
  return rec;
}
function atCandOutputs(t, n) {
  const r = ATL.candidates({ A: S.A, cell: S.cell, lat: S.lat, lon: S.lon, critIds: S.critIds, t: { ...t, values: { ...t.values } }, ranges: atRanges(t), w: atWeights(), n, includeProxy: A3.includeProxy });
  return { target: t.id, eligible: r.eligible, mode: r.mode, cells: r.eligible ? r.top.map(i => S.cell[i]) : [], scores: r.eligible ? r.top.map(i => r.eff[i]) : [] };
}
async function atReplay(r) {
  if (r.context.predictor_stack.sha256 !== S.app.stack.sha256) return { status: "BLOCKED", text: "Required predictor stack not available." };
  const saved = { profile: A3.profile, norm: A3.norm, proxy: A3.includeProxy };
  let out;
  try {
    A3.profile = r.context.profile; A3.norm = r.context.normalisation.kind; A3.includeProxy = r.context.include_proxy;
    const W = r.context.weights, same = Object.keys(W).every(c => +W[c] === +atWeights()[c]);
    if (!same) return { status: "BLOCKED", text: "The recorded profile weights differ from this build's profile table." };
    for (const id of r.context.targets) {
      const tv = ATL.targetVector(atT(id), S.critIds, { includeProxy: A3.includeProxy });
      if (LAB.canonical(tv) !== LAB.canonical(r.context.target_vectors[id])) return { status: "DIFFERS", text: `Target ${id} has a different fingerprint in this atlas build (${A3.atlas.version}).` };
    }
    if (r.module === "atlas-candidates") out = { candidates: r.context.targets.map(id => atCandOutputs(atT(id), r.params.n)) };
    else if (r.module === "atlas-stability") {
      const t = atT(r.context.targets[0]), P = ATL.prepareTarget(S.A, S.critIds, t, atRanges(t), { includeProxy: A3.includeProxy }), w = atWeights();
      const cand = r.params.candidates.map(c => S.index[c]); if (cand.some(i => i < 0)) return { status: "BLOCKED", text: "A candidate cell is not in this stack." };
      const design = LAB.designFactorial(w, r.params.active, S.critIds, r.params.factors);
      const run = LAB.runDesignSync({ Ps: [P], cell: S.cell, cand, baseW: w, design });
      out = { stats: LAB.rankStats(run, { topN: 20, topPct: 1 }).map(s => ({ baseline: s.baseline, min: s.min, max: s.max, median: s.median, cls: s.cls })) };
    } else return { status: "UNSUPPORTED", text: "Replay not implemented for module " + r.module + "." };
  } finally { A3.profile = saved.profile; A3.norm = saved.norm; A3.includeProxy = saved.proxy; }
  const h = await LAB.sha256Hex(LAB.canonical(out));
  return h === r.outputs_sha256 ? { status: "REPRODUCED", text: "Replay reproduced the stored outputs exactly (SHA-256 " + h.slice(0, 16) + "…)." }
    : { status: "DIFFERS", text: "Replay outputs differ (" + h.slice(0, 12) + "… vs " + r.outputs_sha256.slice(0, 12) + "…)." };
}

/* ---------- Phase II connections ---------- */
const A3_P2_LINKS = [
  ["Analogue Robustness Laboratory", "Workflow · Robustness and Compare §4: factorial weight perturbation of any eligible atlas target (AsterroLab.runDesign / rankStats)."],
  ["Multi-Objective Analogue Discovery", "Workflow · Evidence: Pareto front of the candidate's per-criterion similarities among the target's top 50 (AsterroLab.pareto)."],
  ["Spatial Analogue Microclimate Atlas", "Workflow · Evidence and Lab → Spatial atlas: Earth sub-cell slope distribution (new GMTED 30″ histogram data) for any candidate."],
  ["Planetary Uncertainty Explorer", "Target view: ring-window heterogeneity, Diviner seasonal split, REMS strict-filter variant, GCP bin spread — measured spreads, not modelled."],
  ["Analogue Failure-Mode Laboratory", "Mismatch Cartographer and Translator: per-criterion mismatch, missing data and non-equivalences for any atlas target."],
  ["Planetary Evidence Graph", "Knowledge Constellation: targets, criteria, statuses, datasets and candidates as typed nodes and documented edges."],
  ["Cross-Planet Evidence Comparator", "Compare §5: shared candidates for any set of eligible targets (the baseline minimum rule)."],
  ["Planetary Analogue Evolution Observatory", "Workflow · Evidence: Theil–Sen trend and Mann–Kendall test of the candidate's yearly MODIS ΔT (2016–2025)."],
  ["Mission Requirement Translator", "Workflow · Requirements: the Lab's user-defined requirement set evaluated on the atlas candidate."],
  ["Observation Value Engine", "Compare §7 and Workflow · Measurements: measurement-impact scenarios for missing target criteria."],
  ["Analogue Research Mission Planner", "Workflow · Plan and the Expedition Designer: research plan from evidence gaps; no logistics, cost or safety content."],
  ["Scientific Reproducibility Vault", "Records: contract asterro.experiment/2 records with browser and Python replay; Phase II v1 records shown through the v1→v2 adapter."],
  ["Scientific Review", "Copilot workspace: the same deterministic guardrails (AsterroLab.reviewText) applied to drafted text."],
];

A3_VIEWS.workflow = function () {
  const t = atT(A3.active), w = atWeights();
  const R = t ? atCands(t, 20) : null, ci = t ? A3.cand[t.id] ?? null : null;
  const stab = t && A3.stab[atStabKey(t)];
  const W = A3.workflow[t ? t.id : ""] || {};
  const gaps = t ? ATL.missingEvidence(t, S.critIds, w).filter(m => m.status !== "PROXY") : [];
  const st = ATL.workflowState({ target: t, candidate: R && R.eligible ? ci : null, stability: stab, requirements: W.req, gaps, plan: W.plan, record: W.record });
  let h = `<div class="sec"><h3 class="ttl">Research workflow</h3>${atBanner("guided analysis")}
    <p class="note">One target and one Earth candidate carried through every analytical stage. Each stage states what it used; the workflow stops where the evidence stops.</p>
    <div class="lab-form"><label class="wide">Target${atTargetPicker(t ? t.id : null)}</label></div>${atControls()}
    <ol class="at-stages">${st.map(s => `<li class="${s.status.toLowerCase()}"><b>${esc(s.stage)}</b><span>${esc(s.status)}</span><em>${esc(s.why)}</em></li>`).join("")}</ol></div>`;
  if (!t) return h;
  if (!R.eligible) return h + `<div class="sec"><div class="callout warn">Analytical boundary: ${esc(R.reason)}</div><p class="note small">What would move this target forward: ${gaps.map(g => esc(labelOf(g.criterion) || g.criterion)).join(", ") || "—"}.</p></div>`;
  // candidate
  h += `<div class="sec"><div class="lbl">Candidate · ${esc(R.mode === "full" ? "full comparison" : "partial comparison")} on ${R.P.applicable.filter(c => w[c] > 0).map(shortOf).join(", ")}</div>
    ${R.saturated ? `<div class="callout warn">${nfmt(R.nNearTop)} cells score within 0.1 pt of the best: the comparison is saturated and the order below is set by the tie-break, not by evidence. Choosing among these needs more comparable criteria.</div>` : ""}
    <ol class="at-rank">${R.top.slice(0, 10).map(i => `<li class="${i === ci ? "on" : ""}"><button class="lnk" data-a3="cand" data-t="${t.id}" data-i="${i}">${esc(placeStr(i))}</button> <b>${fmtPct(R.eff[i])}</b> <span class="meta">${atFmtLL(S.lat[i], S.lon[i])}</span></li>`).join("")}</ol></div>`;
  if (ci == null) return h;
  // evidence
  const X = ATL.explain(R.P, w, ci, S.A, R.ranges);
  h += `<div class="sec"><div class="lbl">Evidence · ${esc(placeStr(ci))}</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th><th class="n">Earth</th><th class="n">${esc(t.name)}</th><th class="n">similarity</th><th class="n">contribution</th></tr></thead><tbody>
    ${X.map(x => `<tr><td>${esc(labelOf(x.criterion))}</td><td class="n">${atVal(x.criterion, x.earth)}</td><td class="n">${atVal(x.criterion, x.target)}</td><td class="n">${x.similarity == null ? '<span class="st st-m">missing on Earth</span>' : x.similarity.toFixed(3)}</td><td class="n">${x.contribution == null ? "—" : (100 * x.contribution).toFixed(1) + " pts"}</td></tr>`).join("")}
    ${S.critIds.filter(c => !X.some(x => x.criterion === c)).map(c => `<tr class="dim"><td>${esc(labelOf(c))}</td><td class="n">${atVal(c, S.A[c][ci])}</td><td class="n">—</td><td colspan="2">${atStatus(t.status[c])} not scored</td></tr>`).join("")}</tbody></table></div>`;
  // Pareto among top 50 (Phase II multi-objective)
  const R50 = atCands(t, 50), act = R.P.applicable.filter(c => w[c] > 0);
  const pts = R50.top.map(i => ({ id: i, v: act.map(c => R.P.s[c][i]) })), PF = LAB.pareto(pts);
  h += `<p class="note small">Multi-objective view: among the target's top ${R50.top.length} distinct candidates, this site is ${PF.front.some(p => p.id === ci) ? "<b>on</b>" : "<b>not on</b>"} the Pareto front of per-criterion similarities (${PF.front.length} non-dominated).</p>`;
  // sub-cell (Phase II spatial atlas completion)
  if (A3.sub) {
    const n = atSubVal("n", ci);
    h += `<div class="lbl">Earth sub-cell slope distribution (GMTED 30″, ${nfmt(n)} pixels)</div><div class="grid2">${[2, 5, 10, 15, 20, 30].map(X2 => `<div class="kv"><span>slope ≤ ${X2}°</span><b>${pct(atSubVal("frac_le_" + X2, ci))}</b></div>`).join("")}
      <div class="kv"><span>p10 / p50 / p90</span><b>${f1(atSubVal("p10", ci))} / ${f1(atSubVal("p50", ci))} / ${f1(atSubVal("p90", ci))}°</b></div></div>`;
  } else { h += `<p class="meta">${A3.subErr ? esc(A3.subErr) : "Loading sub-cell data…"}</p>`; if (!A3.subErr) atSubcell(); }
  // temporal (Phase II evolution)
  const yrs = S.app.stack.years, ys = yrs.map((_, k) => { const v = S.A.lst_diurnal_range_yearly[k * S.n + ci]; return v === -32768 ? NaN : v / 100; });
  const okY = ys.map((v, k) => [yrs[k], v]).filter(p => p[1] === p[1]);
  if (okY.length >= 5) {
    const ts2 = LAB.theilSen(okY.map(p => p[0]), okY.map(p => p[1])), mk = LAB.mannKendall(okY.map(p => p[1]));
    h += `<p class="note small">Earth-side temporal check (MODIS yearly ΔT ${okY[0][0]}–${okY[okY.length - 1][0]}, ${okY.length} years): Theil–Sen ${ts2.slope >= 0 ? "+" : ""}${ts2.slope.toFixed(2)} K/yr, Mann–Kendall p = ${mk.p.toFixed(2)}. ${mk.p < 0.05 ? "A monotonic trend is detected; the candidate's thermal match may not be stationary." : "No monotonic trend detected at p < 0.05."}</p>`;
  }
  h += `</div>`;
  // robustness
  const sk = stab && stab.cand.indexOf(ci);
  h += `<div class="sec"><div class="lbl">Robustness</div>${stab ? (sk >= 0 ? `<p class="note">${clsTag(stab.stats[sk].cls)} · baseline-configuration rank ${nfmt(stab.stats[sk].baseline)}, range ${nfmt(stab.stats[sk].min)}–${nfmt(stab.stats[sk].max)} over ${stab.design} configurations.</p>` : `<p class="meta">This candidate was not in the analysed set.</p>`)
    : `<button class="btn-sm" data-a3="wf-stab">Run weight-perturbation stability</button>`}</div>`;
  // requirements (Phase II translator)
  const reqs = (typeof L !== "undefined" && L.reqs) || [];
  h += `<div class="sec"><div class="lbl">Requirements · user-defined</div>${reqs.length ? (W.req ? `<div class="tbl-wrap"><table class="t"><tbody>${W.req.map((r, k) => `<tr><td class="meta">${esc(reqText(reqs[k], registry()[reqs[k].variable]))}</td><td>${statusTag(r.status)}</td><td class="meta">${esc((r.why || []).join(" "))}</td></tr>`).join("")}</tbody></table></div>` : `<button class="btn-sm" data-a3="wf-req">Evaluate the Lab requirement set (${reqs.length})</button>`)
    : `<p class="meta">No requirement set defined. Define user thresholds in <button class="lnk" data-a3="to-lab" data-mod="reqs">Lab → Requirements</button>; ASTERRO supplies no engineering threshold.</p>`}</div>`;
  // measurements
  h += `<div class="sec"><div class="lbl">Measurements needed</div><ul class="lab-ul">${gaps.map(g => `<li><b>${esc(g.criterion === "heterogeneity" ? "Within-feature heterogeneity" : labelOf(g.criterion))}</b> (${g.status}, ${pct(g.weightShare)} of profile weight): ${esc(g.action)}</li>`).join("") || "<li>No target-side gap among the scored criteria.</li>"}
    ${S.A.modis_coverage[ci] < 0.9 ? `<li>Earth side: MODIS pixel-month coverage at this cell is ${pct(S.A.modis_coverage[ci])}.</li>` : ""}<li>Earth side: every value is a ~55 km cell statistic; site-scale characterisation requires field or high-resolution data.</li></ul></div>`;
  // plan
  h += `<div class="sec"><div class="lbl">Plan</div><div class="lab-form"><label class="wide">Research objective (your words)<input type="text" data-a3in="wf-obj" value="${esc(W.obj || "")}" placeholder="e.g. compare diurnal surface thermal cycling"></label><button class="btn-sm" data-a3="wf-plan">Draft plan</button></div>
    ${W.plan ? `<pre class="code lab-pre">${esc(W.plan)}</pre>` : ""}</div>`;
  h += `<div class="sec"><div class="lbl">Record</div><div class="row"><button class="btn-sm" data-a3="wf-rec" ${W.plan ? "" : "disabled"}>Save workflow record</button>${W.record ? `<span class="meta">Saved ${esc(W.record)} · <button class="lnk" data-a3="go" data-to="records">Records</button></span>` : ""}</div></div>`;
  h += `<div class="sec"><details><summary class="lbl">How the 13 Phase II systems connect to atlas targets</summary><div class="tbl-wrap"><table class="t"><tbody>${A3_P2_LINKS.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="meta">${esc(b)}</td></tr>`).join("")}</tbody></table></div></details></div>`;
  return h;
};
function atPlanText(t, ci, W) {
  const R = atCands(t, 20), w = atWeights(), gaps = ATL.missingEvidence(t, S.critIds, w).filter(m => m.status !== "PROXY");
  const X = ATL.explain(R.P, w, ci, S.A, R.ranges), stab = A3.stab[atStabKey(t)], k = stab ? stab.cand.indexOf(ci) : -1;
  return [`RESEARCH PLAN (draft) — exploratory analogue study`, `Objective (user): ${W.obj || "(not stated)"}`,
    `Target: ${t.name} [${t.id}] · readiness L${t.readiness.level} (${t.readiness.label})`,
    `Earth candidate: ${placeStr(ci)} · ${atFmtLL(S.lat[ci], S.lon[ci])} · cell ${S.cell[ci]} · atlas comparison score ${fmtPct(R.eff[ci])} (${A3_NORM_LABEL[A3.norm]}; ${S.app.profiles[A3.profile].label})`,
    `Basis: ${X.map(x => `${shortOf(x.criterion)} s=${x.similarity == null ? "n/a" : x.similarity.toFixed(2)}`).join(", ")}`,
    `Stability: ${k >= 0 ? LAB.CLASS_LABEL[stab.stats[k].cls] : "not run"}`,
    `Target-side evidence gaps: ${gaps.length ? gaps.map(g => `${g.criterion} (${g.status})`).join("; ") : "none among scored criteria"}`,
    `Activities (analytical only): 1) verify the candidate's cell statistics against higher-resolution data; 2) document which target dimensions are not represented; 3) close the gaps above where a compatible product exists.`,
    `Not included: logistics, travel, cost, permits, access or safety. These must be established by the user from authoritative sources.`,
    `Generated deterministically by ASTERRO ${ATL.VERSION}; not reviewed, not certified.`].join("\n");
}
Object.assign(A3_ACTIONS, {
  "wf-stab"() { const t = atT(A3.active); if (t) atRunStability([t]); },
  async "wf-req"() {
    const t = atT(A3.active), ci = A3.cand[t.id]; if (!L.ctx) await labCtx();
    const reg = registry(), ctx = reqCtx();
    (A3.workflow[t.id] = A3.workflow[t.id] || {}).req = L.reqs.map(q => LAB.evaluateRequirement(q, ci, reg, ctx)); atRender();
  },
  "wf-plan"() { const t = atT(A3.active), ci = A3.cand[t.id], W = (A3.workflow[t.id] = A3.workflow[t.id] || {}); W.plan = atPlanText(t, ci, W); atRender(); },
  async "wf-rec"() {
    const t = atT(A3.active), ci = A3.cand[t.id], W = A3.workflow[t.id];
    const R = atCands(t, 20), stab = A3.stab[atStabKey(t)];
    if (stab) await atMakeRecord("atlas-stability", { candidates: stab.cand.map(i => S.cell[i]), active: stab.active, factors: stab.factors },
      { stats: stab.stats.map(s => ({ baseline: s.baseline, min: s.min, max: s.max, median: s.median, cls: s.cls })) }, { targets: [t.id], stage: "robustness" });
    const rec = await atMakeRecord("atlas-workflow", { candidate: S.cell[ci], objective: W.obj || "" },
      { score: R.eff[ci], explanation: ATL.explain(R.P, atWeights(), ci, S.A, R.ranges), plan: W.plan, requirements: W.req ? W.req.map(r => r.status) : null },
      { targets: [t.id], stage: "record", claims: atClaims(t).map(c => ({ ...c })), limitations: ["Exploratory analysis; not a site certification."] });
    W.record = rec.id; atRender();
  },
  "to-lab"(a) { L.mod = a.dataset.mod; setTab("lab"); },
});
A3_INPUTS["wf-obj"] = a => { const t = atT(A3.active); (A3.workflow[t.id] = A3.workflow[t.id] || {}).obj = a.value; };

/* ---------- Records (contract v2 + adapted v1) ---------- */
A3_VIEWS.records = function () {
  const v1 = ((typeof L !== "undefined" && L.records) || []).map(r => { try { return ATL.adaptV1(r); } catch (e) { return null; } }).filter(Boolean);
  const recs = A3.records.slice().reverse();
  let storeOK = true; try { localStorage.setItem("asterro.p3test", "1"); localStorage.removeItem("asterro.p3test"); } catch (e) { storeOK = false; }
  let h = `<div class="sec"><h3 class="ttl">Experiment records</h3>${atBanner("contract asterro.experiment/2")}
    <p class="note">Every Phase III result can be saved as a self-describing record: configuration (targets, fingerprints, normalisation table, weights), outputs, their SHA-256, claims and limitations. The record id is the SHA-256 of the canonical configuration. ${storeOK ? "Stored in this browser only." : "<b>Browser storage is unavailable here: records last for this session only.</b>"}</p></div>
    <div class="sec"><div class="lbl">Phase III records (${recs.length})</div>${recs.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>id</th><th>module</th><th>targets</th><th>created</th><th></th></tr></thead><tbody>
    ${recs.map(r => `<tr><td class="mono">${r.id}</td><td>${esc(r.module)}</td><td class="meta">${r.context.targets.map(id => esc(atT(id) ? atT(id).name : id)).join(", ")}</td><td class="meta">${esc(r.created_utc.slice(0, 19))}</td>
      <td>${["atlas-candidates", "atlas-stability"].includes(r.module) ? `<button class="btn-sm" data-a3="rec-replay" data-id="${r.id}">Replay</button>` : `<span class="meta">re-run in Workflow</span>`} <button class="btn-sm" data-a3="rec-export" data-id="${r.id}">Export</button>${A3.replayMsg && A3.replayMsg[r.id] ? `<div class="vault-msg">${esc(A3.replayMsg[r.id])}</div>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<p class="meta">None yet. Save a comparison or a workflow.</p>`}</div>
    <div class="sec"><div class="lbl">Phase II records through the v1 → v2 adapter (${v1.length}, read-only)</div>${v1.length ? `<div class="tbl-wrap"><table class="t"><tbody>${v1.map(r => `<tr><td class="mono">${r.id_v1}</td><td>${esc(r.module)}</td><td class="meta">${esc(r.context.targets.join(", "))}</td><td class="meta">replay in Lab → Vault</td></tr>`).join("")}</tbody></table></div>` : `<p class="meta">No Phase II records in this browser.</p>`}
    <p class="note small">The adapter is lossless: the v1 baseline block becomes context.baseline and the v1 id is kept as id_v1; the v1 record itself is not modified.</p></div>`;
  return h;
};
Object.assign(A3_ACTIONS, {
  async "rec-replay"(a) { const r = A3.records.find(x => x.id === a.dataset.id); A3.replayMsg = A3.replayMsg || {}; A3.replayMsg[r.id] = "Replaying…"; atRender(); const o = await atReplay(r); A3.replayMsg[r.id] = o.status + " — " + o.text; atRender(); },
  "rec-export"(a) { const r = A3.records.find(x => x.id === a.dataset.id); showExport("Experiment record " + r.id, JSON.stringify(r, null, 1), `asterro-${r.module}-${r.id}.json`); },
});
