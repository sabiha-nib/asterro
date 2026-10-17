/* ===== Phase IV · Scientific Validation workspace =====
 * Researcher-entered reference cases (cited Earth locations labelled positive / negative analogues for one
 * target) are ranked under the target's scoring configuration. Recall@k and labelled Precision@k are reported
 * only when enough cited labels exist; weight sensitivity shows how case ranks move; holdout analysis is
 * declared not meaningful (no fitted parameters). No reference cases ship with ASTERRO: until a researcher
 * enters cited cases, nothing here is a validation. Synthetic fixtures are rejected and labelled. */
function a4ValTargets() { return A4.reg.targets.filter(t => t.scoring.earth_analogue_enabled); }
function a4ValStoreGet() { return a4Get(A4_KEYS.cases, {}); }
function a4ValCases(tid) { return (a4ValStoreGet()[tid] || []).slice(); }
function a4ValSave(tid, cases) { const all = a4ValStoreGet(); all[tid] = cases; return a4Set(A4_KEYS.cases, all); }
function a4ValPrep(t) {
  const fp = t.fingerprint, tv = Object.fromEntries(S.critIds.map(c => [c, ["DIRECT", "PROXY"].includes(fp.criterion_status[c]) ? fp.variables[c] : null]));
  const ranges = t.legacy ? S.app.ranges : t.scoring.explore_ranges;
  return { P: Object.assign(LAB.prepare(S.A, S.critIds, tv, ranges), { ranges }), config: t.scoring.default_explore, ranges };
}
function a4ValRun() {
  const t = a4T(A4.val.target), cases = a4ValCases(t.id), { P, config, ranges } = a4ValPrep(t), w = atWeights();
  const eff = LAB.fieldScore(P, w).eff;
  A4.val.res = { target: t.id, config, ranges, w, profile: A3.profile, metrics: RG.validationMetrics({ eff, cell: S.cell, cases, idxMap: S.index, ks: [10, 50, 100, 500, 1000] }) };
  A4.val.sens = null; atRender();
  announce(`Evaluated ${A4.val.res.metrics.rows.length} accepted reference cases.`);
}
function a4ValSens() {
  const t = a4T(A4.val.target), { P } = a4ValPrep(t);
  A4.val.sens = RG.weightSensitivity({ P, w: atWeights(), cell: S.cell, cases: a4ValCases(t.id), idxMap: S.index });
  atRender();
}
A3_VIEWS.validation = function () {
  const need = a4Need(); if (need) return need;
  const ts = a4ValTargets();
  if (!a4T(A4.val.target) || !a4T(A4.val.target).scoring.earth_analogue_enabled) A4.val.target = "mars_gale_curiosity";
  const t = a4T(A4.val.target), cases = a4ValCases(t.id), R = A4.val.res && A4.val.res.target === t.id ? A4.val.res : null;
  const off = A4.reg.targets.filter(x => !x.scoring.earth_analogue_enabled);
  let h = `<div class="sec"><h3 class="ttl">Validation workspace</h3>${a4Banner("evaluation against researcher reference cases")}
    <div class="callout"><b>No reference cases are shipped.</b> ASTERRO has not been scientifically validated. This workspace evaluates the ranking against cases <i>you</i> enter, each with a citation; the result is an evaluation record, not a validation claim. Synthetic or uncited cases are rejected.</div>
    <div class="lab-form"><label>Target (readiness ≥ 3)<select data-a4in="valt">${["mars", "moon"].map(b => `<optgroup label="${b === "mars" ? "Mars" : "Moon"}">${ts.filter(x => x.body.id === b).map(x => `<option value="${x.id}" ${x.id === t.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</optgroup>`).join("")}</select></label>
      ${a4ProfileSel()}</div>
    <p class="meta small">Configuration: <b>${esc(t.scoring.default_explore)}</b> · ${off.length} targets below readiness 3 are not offered (incomplete fingerprint).</p></div>
  <div class="sec"><div class="lbl">Reference cases for ${esc(t.name)} (${cases.length})</div>
    <form class="lab-form p4-caseform" data-a4form="case" aria-label="Add a reference case">
      <label>Name<input name="name" required maxlength="120" placeholder="e.g. a published analogue site"></label>
      <label>Label<select name="label"><option value="positive">positive analogue</option><option value="negative">negative (not an analogue)</option></select></label>
      <label>Latitude<input name="lat" inputmode="decimal" required placeholder="−90 … 90"></label><label>Longitude (E)<input name="lon" inputmode="decimal" required placeholder="−180 … 180"></label>
      <label class="wide">Citation (DOI, publication or URL)<input name="citation" required maxlength="400"></label>
      <label>Evidence class<select name="evidence_quality">${Object.entries(RG.EVIDENCE).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select></label>
      <label class="wide">Reason for inclusion<input name="reason" maxlength="400" placeholder="why this site is (or is not) an analogue of the target"></label>
      <fieldset class="p4-crit"><legend>Relevant criteria</legend>${S.critIds.map(c => `<label class="ck"><input type="checkbox" name="criteria" value="${c}"> ${esc(shortOf(c))}</label>`).join("")}</fieldset>
      <label class="wide">Evaluation protocol<input name="protocol" maxlength="400" placeholder="how the label was established"></label>
      <button class="btn-sm" type="submit">Add case</button></form>
    ${A4.val.msg ? `<p class="small ${A4.val.msg.ok ? "st-d" : "st-m"}" role="status">${esc(A4.val.msg.text)}</p>` : ""}
    ${cases.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Case</th><th>Label</th><th class="n">Lat</th><th class="n">Lon</th><th>Citation</th><th>Evidence</th><th>Check</th><th></th></tr></thead><tbody>${cases.map((c, k) => { const e = RG.validateCase(c, S.index); return `<tr><td>${esc(c.name)}${c.reason ? `<div class="meta small">${esc(c.reason)}</div>` : ""}</td><td>${esc(c.label)}</td><td class="n">${(+c.lat).toFixed(3)}</td><td class="n">${(+c.lon).toFixed(3)}</td><td class="small">${esc(c.citation)}${c.protocol ? `<div class="meta">protocol: ${esc(c.protocol)}</div>` : ""}</td><td class="small">${esc(RG.EVIDENCE[c.evidence_quality] || "unspecified")}${c.criteria && c.criteria.length ? `<div class="meta">${c.criteria.map(shortOf).join(", ")}</div>` : ""}</td><td class="small ${e.length ? "st-m" : "st-d"}">${e.length ? esc(e.join("; ")) : "accepted"}</td><td><button class="lnk" data-a4="caserm" data-k="${k}" aria-label="Remove ${esc(c.name)}">remove</button></td></tr>`; }).join("")}</tbody></table></div>` : `<p class="meta">No cases yet.</p>`}
    <div class="row"><label class="btn-sm p4-file">Import cases (JSON)<input type="file" accept="application/json,.json" data-a4in="caseimp" class="sr-only"></label>
      <button class="btn-sm" data-a4="valrun" ${cases.length ? "" : "disabled"}>Evaluate</button><button class="btn-sm" data-a4="valsens" ${R ? "" : "disabled"}>Weight sensitivity</button>
      <button class="btn-sm" data-a4="valexp" ${R ? "" : "disabled"}>Export evaluation record</button></div>
    <p class="meta small">Import format: {"schema":"asterro.reference-cases/1","target":"${esc(t.id)}","cases":[{"name","label","lat","lon","citation"}]}. Imported cases are appended; a case with an existing name is reported, not replaced.</p></div>`;
  if (R) {
    const M = R.metrics;
    h += `<div class="sec"><div class="lbl">Ranks under ${esc(R.config)} · ${esc(S.app.profiles[R.profile].label)}</div>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>Case</th><th>Label</th><th class="n">Rank</th><th class="n">of</th><th class="n">Percentile</th><th>Earth cell</th></tr></thead><tbody>${M.rows.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.label)}</td><td class="n">${r.rank ? r.rank.toLocaleString() : "ineligible"}</td><td class="n">${M.nEligible.toLocaleString()}</td><td class="n">${r.percentile == null ? "—" : (100 * r.percentile).toFixed(2) + " %"}</td><td>${esc(placeStr(r.cellIndex))}</td></tr>`).join("")}</tbody></table></div>
      ${M.rejected.length ? `<p class="small st-m">Rejected: ${M.rejected.map(x => esc(x.name + ": " + x.errors.join(", "))).join(" · ")}</p>` : ""}
      <div class="tbl-wrap"><table class="t"><thead><tr><th>k</th>${M.ks.map(k => `<th class="n">${k}</th>`).join("")}</tr></thead><tbody>
        <tr><td>Recall@k (${M.positives} positive)</td>${M.ks.map(k => `<td class="n">${M.recall[k] == null ? "withheld" : (100 * M.recall[k]).toFixed(0) + " %"}</td>`).join("")}</tr>
        <tr><td>Labelled precision@k</td>${M.ks.map(k => `<td class="n">${M.precision[k] == null ? "withheld" : (100 * M.precision[k]).toFixed(0) + " %"}</td>`).join("")}</tr></tbody></table></div>
      ${M.sufficiency.map(s => `<p class="meta small">${esc(s)}</p>`).join("")}
      <p class="meta small"><b>Evidence classes:</b> ${Object.entries(M.evidence).map(([k, n]) => `${esc(RG.EVIDENCE[k] || k)} × ${n}`).join(" · ") || "—"}. Expert judgment is not empirical validation; software tests and synthetic fixtures are never validation.</p>
      <p class="meta small"><b>Holdout:</b> ${esc(RG.holdoutCheck().reason)}</p></div>`;
  }
  if (A4.val.sens) {
    const V = A4.val.sens;
    h += `<div class="sec"><div class="lbl">Weight sensitivity of case ranks</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Weight change</th>${V.cases.map(c => `<th class="n">${esc(c)}</th>`).join("")}<th class="n">max shift</th></tr></thead><tbody>
      <tr><td>baseline weights</td>${V.base.map(r => `<td class="n">${r ?? "—"}</td>`).join("")}<td></td></tr>
      ${V.rows.map(r => `<tr><td>${esc(shortOf(r.criterion))} × ${r.factor}</td>${r.ranks.map(x => `<td class="n">${x ?? "—"}</td>`).join("")}<td class="n">${r.maxShift.toLocaleString()}</td></tr>`).join("")}</tbody></table></div></div>`;
  }
  return h;
};
document.addEventListener("submit", e => {
  const f = e.target.closest("[data-a4form=case]"); if (!f) return;
  e.preventDefault();
  const fd = new FormData(f), d = Object.fromEntries(fd.entries());
  const c = { name: d.name.trim(), label: d.label, lat: +String(d.lat).replace("−", "-"), lon: +String(d.lon).replace("−", "-"), citation: d.citation.trim(),
    evidence_quality: d.evidence_quality, reason: (d.reason || "").trim() || null, criteria: fd.getAll("criteria"), protocol: (d.protocol || "").trim() || null, added_utc: a4Now() };
  const err = RG.validateCase(c, S.index), cases = a4ValCases(A4.val.target);
  if (err.length) A4.val.msg = { ok: false, text: "Not added: " + err.join("; ") };
  else if (cases.some(x => x.name === c.name)) A4.val.msg = { ok: false, text: `A case named “${c.name}” exists; nothing was replaced.` };
  else { cases.push(c); const se = a4ValSave(A4.val.target, cases); A4.val.msg = se ? { ok: false, text: se } : { ok: true, text: `Added “${c.name}”.` }; A4.val.res = null; }
  atRender(); announce(A4.val.msg.text);
});
Object.assign(A4_ACTIONS, {
  caserm(a) { const cs = a4ValCases(A4.val.target); cs.splice(+a.dataset.k, 1); a4ValSave(A4.val.target, cs); A4.val.res = null; atRender(); },
  valrun() { a4ValRun(); },
  valsens() { a4ValSens(); },
  valexp() {
    const R = A4.val.res; if (!R) return;
    const rec = RG.validationRecord({ target: R.target, config: R.config, w: R.w, profile: R.profile, ranges: R.ranges, metrics: R.metrics, sensitivity: A4.val.sens,
      cases: a4ValCases(R.target), stackSha: S.app.stack.sha256, createdUtc: a4Now() });
    const t = a4T(R.target);
    rec.dataset_versions = Object.fromEntries(t.datasets.map(d => [d, (A4.ix.datasets[d] || {}).version || null]).concat(A4.reg.earth_search_configs[0].datasets.map(d => [d, (A4.ix.datasets[d] || {}).version || null])));
    rec.experiment = { algorithm: S.app.algorithm_version, fingerprint_sha256: t.fingerprint.content_sha256, registry_version: A4.reg.registry_version, readiness_model: A4.reg.readiness_model.version };
    a4Download(`asterro_evaluation_${R.target}.json`, rec);
  },
});
Object.assign(A4_INPUTS, {
  valt(a) { A4.val.target = a.value; A4.val.res = null; A4.val.sens = null; A4.val.msg = null; atRender(); },
  async caseimp(a) {
    const f = a.files && a.files[0]; if (!f) return;
    let doc; try { doc = JSON.parse(await f.text()); } catch (e) { A4.val.msg = { ok: false, text: "Not valid JSON: " + e.message }; atRender(); return; }
    if (!doc || doc.schema !== "asterro.reference-cases/1" || !Array.isArray(doc.cases)) { A4.val.msg = { ok: false, text: 'Expected {"schema":"asterro.reference-cases/1","target":…,"cases":[…]}.' }; atRender(); return; }
    if (doc.target !== A4.val.target) { A4.val.msg = { ok: false, text: `The file is for target “${doc.target}”, not ${A4.val.target}; nothing imported.` }; atRender(); return; }
    const cases = a4ValCases(A4.val.target), added = [], refused = [];
    for (const c of doc.cases) {
      const e = RG.validateCase(c, S.index);
      if (e.length) refused.push(`${c && c.name || "?"}: ${e.join(", ")}`);
      else if (cases.some(x => x.name === c.name)) refused.push(`${c.name}: name exists (not replaced)`);
      else { cases.push({ name: c.name, label: c.label, lat: +c.lat, lon: +c.lon, citation: c.citation, evidence_quality: c.evidence_quality || null, reason: c.reason || null, criteria: c.criteria || [], protocol: c.protocol || null, added_utc: a4Now() }); added.push(c.name); }
    }
    const se = added.length ? a4ValSave(A4.val.target, cases) : null;
    A4.val.msg = { ok: !refused.length && !se, text: se || `Imported ${added.length}; refused ${refused.length}${refused.length ? " — " + refused.join(" · ") : ""}.` };
    A4.val.res = null; atRender();
  },
});
