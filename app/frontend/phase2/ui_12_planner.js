/* ===== Phase II · Analogue Research Mission Planner =====
 * Turns recorded analyses into a structured, preliminary investigation plan. Every statement is
 * assembled from system outputs; suggestions are labelled as suggestions. Not a mission plan. */
const OBJECTIVES = [
  { id: "rover", label: "Compare rover mobility environments", activity: "rover_mobility" },
  { id: "thermal", label: "Evaluate surface-temperature variability", activity: "thermal_equipment" },
  { id: "terrain", label: "Investigate terrain heterogeneity", activity: "terrain_navigation" },
  { id: "eva", label: "Prepare an EVA training study", activity: "eva_preparation" },
  { id: "measure", label: "Compare measurement strategies", activity: "environmental_monitoring" },
  { id: "instrument", label: "Evaluate usefulness for instrument development", activity: "instrument_testing" },
  { id: "geology", label: "Plan geological fieldwork comparison", activity: "geological_fieldwork" },
];
L.plan = { obj: "rover", title: "", notes: "", picks: null, out: null };

function planPicks() { if (!L.plan.picks) L.plan.picks = S.res.distinct.slice(0, 3); return L.plan.picks; }
async function buildPlan() {
  const ctx = await labCtx(); if (!ctx) { L.plan.err = L.ctxErr; labRender(); return; }
  const O = OBJECTIVES.find(o => o.id === L.plan.obj), act = ctx.catalog.activities[O.activity], tids = targetsFor(S.targetId), w = { ...S.weights };
  const picks = planPicks().slice();
  const cands = picks.map(i => ({ cell_id: S.cell[i], name: candShort(i), lat: S.lat[i], lon: S.lon[i],
    baseline: { score: S.res.eff[i], rank: S.res.rank[i], target: S.targetId, profile: currentLabel() },
    perTarget: tids.map(t => { const d = ENG.detail(S.A, S.critIds, i, S.T[t].variables, w, S.ranges);
      return { target: t, score: d.final, coverage: d.coverage, criteria: d.rows.filter(r => r.active).map(r => ({ c: r.c, earth: r.e, target: r.t, s: r.s, class: r.s == null ? "MISSING" : ENG.classify(r.s), status: S.T[t].status[r.c] })) }; }) }));
  const gaps = [];
  for (const t of tids) for (const c of S.critIds) { const st = S.T[t].status[c]; if (st !== "DIRECT") gaps.push({ kind: st, text: `${labelOf(c)} for ${S.T[t].name} is ${st === "PROXY" ? "a PROXY (" + S.T[t].proxy_method[c] + ")" : "not applicable"}` }); }
  cands.forEach(c => c.perTarget.forEach(p => p.criteria.filter(r => r.earth == null).forEach(r => gaps.push({ kind: "MISSING", text: `${c.name}: no Earth value for ${labelOf(r.c)}` }))));
  gaps.push({ kind: "UNAVAILABLE", text: SUBCELL_MSG });
  for (const f of act.factors) { const F = ctx.catalog.missing_factors.find(x => x.id === f); gaps.push({ kind: F.status === "UNMODELED" ? "UNMODELED" : F.status, text: `${F.label}: ${F.note}` }); }
  (ctx.manifest ? ctx.manifest.unverified : []).forEach(u => gaps.push({ kind: "UNVERIFIED", text: u }));
  const reqEval = L.res.reqEval && L.res.reqEval.key === baseKey() ? L.res.reqEval : null;
  const requirements = L.reqs.map((q, k) => ({ ...q, results: reqEval ? picks.map(i => { const r = reqEval.cand.indexOf(i); return r >= 0 ? { cell_id: S.cell[i], status: reqEval.M[r][k].status } : { cell_id: S.cell[i], status: "NOT_EVALUATED" }; }) : null }));
  const R = L.res.robust && L.res.robust.key === baseKey() ? L.res.robust : null;
  const robust = R ? picks.map(i => { const q = R.cand.indexOf(i); return q >= 0 ? { cell_id: S.cell[i], class: R.st[q].cls, median: R.st[q].median, min: R.st[q].min, max: R.st[q].max } : null; }).filter(Boolean) : null;
  const measurements = act.criteria.filter(c => tids.some(t => S.T[t].variables[c] != null)).map(c => ({ variable: labelOf(c), why: `Listed for “${act.label}” (editorial checklist); current Earth value is a ${ctx.catalog.requirement_variables[c] ? ctx.catalog.requirement_variables[c].resolution : "cell"} statistic.`,
    scale: "finer than the 0.5° × 0.625° cell (scale to be set by the researcher)", origin: "AUTOMATIC SUGGESTION" }));
  for (const q of L.reqs) measurements.push({ variable: ctx.catalog.requirement_variables[q.variable].label, why: q.note || "User requirement", scale: q.requiredResolutionKm ? `≤ ${q.requiredResolutionKm} km` : "as specified", origin: "USER-DEFINED" });
  const questions = [];
  const crits = act.criteria.filter(c => cands.length && cands[0].perTarget[0].criteria.some(r => r.c === c));
  for (const c of crits) questions.push(`Does ${labelOf(c).toLowerCase()} measured at field scale across ${cands.map(x => x.name).join(", ")} reproduce the cell-mean similarity ordering?`);
  if (cands.length > 1) questions.push(`Which of the selected sites spans the widest range of ${crits.map(c => labelOf(c).toLowerCase()).join(" / ")} within one accessible area?`);
  for (const f of act.factors.slice(0, 2)) questions.push(`How would ${ctx.catalog.missing_factors.find(x => x.id === f).label.toLowerCase()} — not modelled by ASTERRO — limit what this study can conclude?`);
  const checklist = ["Confirm site access and land-use permissions (outside ASTERRO).",
    ...crits.map(c => `Obtain finer-scale ${labelOf(c).toLowerCase()} data for each selected site.`),
    "Check the sensitivity of the conclusions to the weighting profile (Robustness Laboratory)" + (R ? " — done: see record " + R.rec.id : " — not yet run."),
    "Record every field measurement with instrument, date, local time and uncertainty.",
    "Re-run the analysis with the field data and compare against this record (Vault)."];
  const config = labBaseline();
  const records = L.records.filter(r => LAB.canonical(r.baseline.weights) === LAB.canonical(S.weights) && r.baseline.target === S.targetId).map(r => ({ id: r.id, module: r.module, outputs_sha256: r.outputs_sha256 }));
  const plan = { schema: "asterro.research-plan/1", created_utc: new Date().toISOString(), title: L.plan.title || O.label, objective: { id: O.id, label: O.label, notes: L.plan.notes },
    candidates: cands, robustness: robust, requirements, evidence_gaps: gaps, proposed_measurements: measurements,
    research_questions: questions.map(q => ({ text: q, label: "SUGGESTION — not a finding" })), checklist, reproducibility: { baseline: config, records },
    limitations: ["Preliminary investigation plan; not a validated mission plan, safety assessment, or site certification.", "Scores compare six modelled variables at ~55 km scale.", "All engineering requirements are user-defined."],
    assumptions: ["The current weighting profile reflects the researcher's priorities.", "Activity checklists are editorial (src/phase2/catalog.py)."] };
  L.plan.out = plan;
  await makeRecord("research_plan", { objective: O.id, picks: picks.map(i => S.cell[i]), requirements: L.reqs.map(q => q.id) }, { title: plan.title, n_gaps: gaps.length, n_questions: questions.length });
  labRender();
}
function planMarkdown(p) {
  const pc = x => x == null || x !== x ? "—" : (100 * x).toFixed(1) + "%";
  let m = `# ${p.title}\n\n*ASTERRO preliminary research plan — generated ${p.created_utc}. Not a validated mission plan.*\n\n## Objective\n${p.objective.label}${p.objective.notes ? "\n\n" + p.objective.notes : ""}\n\n## Selected candidates (baseline Analogue Score)\n`;
  for (const c of p.candidates) {
    m += `\n### ${c.name} — cell ${c.cell_id} (${c.lat.toFixed(2)}°, ${c.lon.toFixed(3)}°)\nBaseline: ${pc(c.baseline.score)}, rank #${c.baseline.rank} (${c.baseline.target}, ${c.baseline.profile})\n\n| Target | Criterion | Earth | Target | s | Class | Status |\n|---|---|---|---|---|---|---|\n`;
    for (const t of c.perTarget) for (const r of t.criteria) m += `| ${t.target} | ${r.c} | ${r.earth == null ? "missing" : (+r.earth).toFixed(3)} | ${(+r.target).toFixed(3)} | ${r.s == null ? "—" : r.s.toFixed(3)} | ${r.class} | ${r.status} |\n`;
  }
  if (p.robustness) m += `\n## Robustness (separate analysis)\n` + p.robustness.map(r => `- cell ${r.cell_id}: ${r.class}, median rank #${r.median} (range #${r.min}–#${r.max})`).join("\n") + "\n";
  if (p.requirements.length) m += `\n## User-defined analytical requirements\n` + p.requirements.map(q => `- ${q.id}: ${q.variable} ${q.op} ${JSON.stringify(q.value)}${q.minAreaKm2 ? `, area ≥ ${q.minAreaKm2} km²` : ""}${q.note ? ` — ${q.note}` : ""}${q.results ? " → " + q.results.map(r => `${r.cell_id}: ${r.status}`).join(", ") : " (not evaluated)"}`).join("\n") + "\n";
  m += `\n## Evidence gaps\n` + p.evidence_gaps.map(g => `- [${g.kind}] ${g.text}`).join("\n") + "\n";
  m += `\n## Proposed measurements\n` + p.proposed_measurements.map(x => `- [${x.origin}] ${x.variable} — ${x.why} Scale: ${x.scale}.`).join("\n") + "\n";
  m += `\n## Research questions (suggestions, not findings)\n` + p.research_questions.map(q => `- ${q.text}`).join("\n") + "\n";
  m += `\n## Evidence collection checklist\n` + p.checklist.map(c => `- [ ] ${c}`).join("\n") + "\n";
  m += `\n## Reproducibility\n- Algorithm ${p.reproducibility.baseline.algorithm_version}; Phase II ${p.reproducibility.baseline.phase2_version}\n- Predictor stack SHA-256 ${p.reproducibility.baseline.predictor_stack.sha256}\n- Weights ${JSON.stringify(p.reproducibility.baseline.weights)}\n` + p.reproducibility.records.map(r => `- Record ${r.id} (${r.module}) outputs ${r.outputs_sha256.slice(0, 16)}…`).join("\n") + "\n";
  m += `\n## Limitations\n` + p.limitations.map(x => `- ${x}`).join("\n") + `\n\n## Assumptions\n` + p.assumptions.map(x => `- ${x}`).join("\n") + "\n";
  return m;
}
LAB_VIEWS.planner = function () {
  if (!S.res) return `<div class="sec"><div class="empty">Run the search first.</div></div>`;
  const picks = planPicks(), pool = [...S.res.distinct]; const sel = labSel(); if (sel != null && !pool.includes(sel)) pool.unshift(sel);
  let h = `<div class="sec"><h3 class="ttl">Analogue research mission planner</h3>
    <p class="note">Turn an analogue discovery into a structured preliminary investigation plan. Built only from recorded outputs; suggestions are labelled. Not a validated mission plan.</p>
    <div class="lab-form"><label>Objective <select data-labin="pl" data-k="obj">${OBJECTIVES.map(o => `<option value="${o.id}"${o.id === L.plan.obj ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select></label>
    <label class="wide">Title <input type="text" value="${esc(L.plan.title)}" data-labin="pl" data-k="title" placeholder="optional"></label>
    <label class="wide">Notes <input type="text" value="${esc(L.plan.notes)}" data-labin="pl" data-k="notes" placeholder="context, constraints"></label></div>
    <fieldset class="lab-picks"><legend class="meta">Candidates (${picks.length} selected)</legend>${pool.map(i => `<label class="ck"><input type="checkbox" data-labin="pl-pick" value="${i}"${picks.includes(i) ? " checked" : ""}> ${siteNo(i)} ${esc(candShort(i).slice(0, 24))}</label>`).join("")}</fieldset>
    <div class="row"><button class="btn-sm on" data-lab="pl-build">Generate plan</button><span class="meta">Includes Robustness ${L.res.robust && L.res.robust.key === baseKey() ? "✓" : "— not run"} · Requirements ${L.reqs.length ? L.reqs.length + (L.res.reqEval ? " evaluated" : " (not evaluated)") : "— none"}</span></div>${L.plan.err ? `<div class="callout">${esc(L.plan.err)}</div>` : ""}</div>`;
  if (L.plan.out) {
    const md = planMarkdown(L.plan.out);
    h += `<div class="sec"><div class="lbl">Plan preview<span class="row"><button class="btn-sm" data-lab="pl-md">Export Markdown</button><button class="btn-sm" data-lab="pl-json">Export JSON</button></span></div><pre class="code lab-pre">${esc(md)}</pre></div>`;
  }
  return h;
};
LAB_INPUTS.pl = a => { L.plan[a.dataset.k] = a.value; };
LAB_INPUTS["pl-pick"] = a => { const s = new Set(planPicks()); const i = +a.value; a.checked ? s.add(i) : s.delete(i); L.plan.picks = [...s]; };
LAB_ACTIONS["pl-build"] = () => buildPlan();
LAB_ACTIONS["pl-md"] = () => showExport("Research plan (Markdown)", planMarkdown(L.plan.out), "asterro-research-plan.md", "text/markdown");
LAB_ACTIONS["pl-json"] = () => showExport("Research plan (JSON)", JSON.stringify(L.plan.out, null, 1), "asterro-research-plan.json");
