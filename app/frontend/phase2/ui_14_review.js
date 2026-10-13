/* ===== Phase II · Scientific Review (deterministic) =====
 * The optional language-model "Review Copilot" is NOT implemented: the static build has no model
 * service, and none may touch the scoring pipeline. This module answers a fixed set of questions
 * from computed outputs (every sentence tagged with its evidence category and source) and checks
 * free text against scientific-language guardrails. */
L.rev = { q: null, flags: null, nums: null };
const QUESTIONS = [
  ["why", "Why did this candidate rank highly?"],
  ["reduced", "Which criteria most reduced its similarity?"],
  ["unmodelled", "What important planetary differences are not modelled?"],
  ["datasets", "Which source datasets support this result?"],
  ["sensitive", "How sensitive is this ranking to the chosen weights?"],
  ["measure", "What additional measurements would help distinguish these candidates?"],
];
function answer(q, i) {
  const tid = S.targetId === "cross" ? TARGET_IDS[0] : S.targetId, T = S.T[tid], w = S.weights;
  const d = ENG.detail(S.A, S.critIds, i, T.variables, w, S.ranges), out = [];
  const say = (cat, text, src) => out.push({ cat, text, src });
  if (q === "why") {
    say("DERIVED", `${candShort(i)} has a baseline Analogue Score of ${fmtPct(d.final, 2)} to ${T.name} under ${currentLabel()} (cell rank #${S.res.rank[i].toLocaleString()} of ${S.res.nElig.toLocaleString()}${S.targetId === "cross" ? "; cross-planet mode ranks by the minimum of both targets" : ""}).`, "baseline engine (TAIEngine.detail)");
    const top = d.rows.filter(r => r.k != null).sort((a, b) => b.k - a.k).slice(0, 3);
    say("DERIVED", "Largest contributions: " + top.map(r => `${labelOf(r.c)} ${(100 * r.k).toFixed(1)} pts (s = ${r.s.toFixed(3)})`).join("; ") + ".", "Trace result breakdown");
    const prox = top.filter(r => T.proxy_flags[r.c]); if (prox.length) say("ASSUMED", `${prox.map(r => labelOf(r.c)).join(" and ")} ${prox.length > 1 ? "are" : "is a"} PROXY criteri${prox.length > 1 ? "a" : "on"}; ${prox.length > 1 ? "their" : "its"} contribution reflects a modelling choice, not a measured planetary match.`, "targets.json status");
    say("UNVALIDATED", "A high rank means similar values of the selected modelled variables; it has not been validated as an analogue for any activity.", "ASTERRO interpretation statement");
  } else if (q === "reduced") {
    const L2 = lossRows(i, tid, w).filter(r => r.loss != null).slice(0, 3);
    say("DERIVED", "Largest losses: " + L2.map(r => `${labelOf(r.c)} −${r.loss.toFixed(1)} pts (Earth ${fmtVal(r.c, r.e)} vs target ${fmtVal(r.c, r.t)} ${unitOf(r.c)})`).join("; ") + ".", "Failure-mode laboratory");
    const miss = d.rows.filter(r => r.active && r.e == null); if (miss.length) say("UNAVAILABLE", "No Earth value for " + miss.map(r => labelOf(r.c)).join(", ") + "; excluded and the score renormalised.", "predictor stack");
  } else if (q === "unmodelled") {
    const mf = L.ctx ? L.ctx.catalog.missing_factors : [];
    say("UNAVAILABLE", "Not evaluated: " + mf.filter(f => f.status === "UNMODELED").map(f => f.label.toLowerCase()).join(", ") + ".", "src/phase2/catalog.py");
    say("ASSUMED", "Atmospheric pressure enters only through the elevation proxy ('thin atmosphere').", "targets.json proxy_method");
    say("MEASURED", "Absolute temperature level is not in the score; the Failure-mode laboratory compares it separately using MODIS, MEDA and Diviner values.", "Failure-mode laboratory");
  } else if (q === "datasets") {
    for (const r of d.rows.filter(x => x.active)) { const cr = S.crit.find(x => x.id === r.c), ds = cr.earth_source.map(id => S.app.datasets.find(x => x.id === id));
      say(T.status[r.c] === "PROXY" ? "ASSUMED" : "MEASURED", `${labelOf(r.c)}: Earth from ${ds.map(x => x.dataset.split(";")[0] + " (" + x.version + ")").join(", ")}; target ${T.status[r.c]} — ${T.methodology[r.c].slice(0, 120)}…`, "app.json datasets · targets.json methodology"); }
    say("DERIVED", `Predictor stack SHA-256 ${S.app.stack.sha256.slice(0, 16)}… (${S.hashOK === true ? "verified in this browser" : "not verified in this browser"}).`, "data integrity check");
  } else if (q === "sensitive") {
    const R = L.res.robust && L.res.robust.key === baseKey() ? L.res.robust : null, k = R ? R.cand.indexOf(i) : -1;
    if (k >= 0) say("DERIVED", `Across ${R.D.design.length} configurations (${R.D.name}): median rank #${R.st[k].median}, range #${R.st[k].min}–#${R.st[k].max}; ${LAB.CLASS_LABEL[R.st[k].cls].toLowerCase()} under the documented rule. Most sensitive single weight: ${labelOf(R.sens[k].driver)}.`, "Robustness record " + R.rec.id);
    else say("UNAVAILABLE", "No robustness experiment for this candidate and configuration yet; run one in the Robustness Laboratory.", "—");
  } else if (q === "measure") {
    const R = L.res.robust && L.res.robust.key === baseKey() ? L.res.robust : null;
    if (!R) say("UNAVAILABLE", "Needs a robustness experiment (Observation value engine uses its pair-flip analysis).", "—");
    else { const fl = R.flips.filter(f => f.frac >= 0.2); say("INFERRED", fl.length ? `${fl.length} candidate pair(s) change order in ≥ 20 % of tested weightings; see the Observation value engine for the criterion behind each and the evidence that would test it.` : "No pair changes order in ≥ 20 % of tested weightings; no measurement is singled out.", "Robustness record " + R.rec.id); }
    say("UNAVAILABLE", "Formal value-of-information is not computed (no decision utility or likelihood model).", "Observation value engine");
  }
  return out;
}
function numberCheck(text) {
  const sc = new Set(); for (const i of S.res.distinct) for (const t of TARGET_IDS) { const e = simFor(t, S.weights).eff[i]; if (e >= 0) { sc.add((100 * e).toFixed(1)); sc.add((100 * e).toFixed(0)); } }
  for (const i of S.res.distinct) { sc.add((100 * S.res.eff[i]).toFixed(1)); sc.add((100 * S.res.eff[i]).toFixed(0)); }
  const out = []; const re = /(\d+(?:\.\d+)?)\s?%/g; let m;
  while ((m = re.exec(text))) out.push({ at: m.index, match: m[0], ok: sc.has((+m[1]).toFixed(m[1].includes(".") ? 1 : 0)) });
  return out;
}
LAB_VIEWS.review = function () {
  if (!S.res) return `<div class="sec"><div class="empty">Run the search first.</div></div>`;
  const i = labSel();
  let h = `<div class="sec"><h3 class="ttl">Scientific review</h3>
    <div class="callout"><b>Language-model copilot: not implemented.</b> This static build has no model service, and no model may compute, change, rank or explain a score. The questions below are answered deterministically from computed outputs, each statement tagged with its evidence category and source.</div></div>
    <div class="sec"><div class="lbl">Evidence-grounded questions · ${esc(candShort(i))}</div><div class="chip-list">${QUESTIONS.map(([k, t]) => `<button class="btn-sm${L.rev.q === k ? " on" : ""}" data-lab="rv-q" data-q="${k}">${esc(t)}</button>`).join("")}</div>`;
  if (L.rev.q) h += `<div class="rv-ans">${answer(L.rev.q, i).map(s => `<div class="ev-row"><div class="row">${evTag(s.cat)}<span class="meta">source: ${esc(s.src)}</span></div><div class="ev-text">${esc(s.text)}</div></div>`).join("")}</div>`;
  h += `</div><div class="sec"><div class="lbl">Unsupported-claim check</div><p class="note small">Paste report text. Flags equivalence, certification, safety, suitability, validation, habitability, authority, proof, optimality, probability and future-projection language, and percentages that match no displayed Analogue Score.</p>
    <textarea class="lab-ta" rows="5" data-labin="rv-text" placeholder="e.g. The Altiplano is scientifically identical to Jezero and certified safe for rover tests (85%).">${esc(L.reviewText)}</textarea>
    <div class="row"><button class="btn-sm on" data-lab="rv-run">Review text</button>${L.plan && L.plan.out ? `<button class="btn-sm" data-lab="rv-plan">Review the generated plan</button>` : ""}</div>`;
  if (L.rev.flags) {
    h += L.rev.flags.length || L.rev.nums.some(n => !n.ok) ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Found</th><th>Issue</th><th>Prefer</th></tr></thead><tbody>
      ${L.rev.flags.map(f => `<tr><td><b>${esc(f.match)}</b></td><td class="meta">${esc(f.issue)}</td><td>“${esc(f.prefer)}”</td></tr>`).join("")}
      ${L.rev.nums.filter(n => !n.ok).map(n => `<tr><td><b>${esc(n.match)}</b></td><td class="meta">Number matches no baseline score of the top-20 sites shown</td><td>cite the value from Trace result</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="note small c-match">No guardrail phrase found. This does not establish that the text is correct.</p>`;
  }
  return h + `</div>`;
};
LAB_ACTIONS["rv-q"] = a => { L.rev.q = a.dataset.q; if (a.dataset.q === "unmodelled") labCtx().then(labRender); labRender(); };
LAB_INPUTS["rv-text"] = a => { L.reviewText = a.value; };
LAB_ACTIONS["rv-run"] = () => { const ta = $("[data-labin=rv-text]"); if (ta) L.reviewText = ta.value; L.rev.flags = LAB.reviewText(L.reviewText); L.rev.nums = numberCheck(L.reviewText); labRender(); };
LAB_ACTIONS["rv-plan"] = () => { L.reviewText = planMarkdown(L.plan.out); L.rev.flags = LAB.reviewText(L.reviewText); L.rev.nums = numberCheck(L.reviewText); labRender(); };
