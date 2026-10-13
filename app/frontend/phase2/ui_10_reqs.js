/* ===== Phase II · Mission Requirement Translator =====
 * Requirements are always USER-DEFINED analytical conditions on documented cell statistics.
 * ASTERRO supplies no engineering threshold. Missing data is never a match. */
L.reqs = [];
L.reqDraft = { variable: "slope", op: "<=", value: "", lo: "", hi: "", res: "", years: "", area: "", note: "" };
const REQ_LABEL = "User-defined analytical requirement";
let reqSeq = 1;

function reqCtx() {
  return { A: S.A, cell: S.cell, index: S.index, lat: S.lat, lon: S.lon, cellAreaKm2: k => cellArea(k), cellSizeKm: k => cellDims(k) };
}
function registry() {
  const R = {}; for (const [k, v] of Object.entries(L.ctx.catalog.requirement_variables)) R[k] = { ...v, get: (A, i) => A[v.field][i] }; return R;
}
function reqText(q, V) {
  const val = q.op === "between" ? `${q.value[0]}–${q.value[1]}` : `${q.op} ${q.value}`;
  return `${V.label} ${val} ${V.unit}${q.minAreaKm2 ? ` over ≥ ${q.minAreaKm2.toLocaleString()} km² contiguous` : ""}${q.requiredResolutionKm ? ` · at ≤ ${q.requiredResolutionKm} km resolution` : ""}${q.requiredYears ? ` · ≥ ${q.requiredYears} yr record` : ""}`;
}
function addReq() {
  const d = L.reqDraft, num = x => x === "" || x == null ? null : +x;
  const q = { id: "R" + reqSeq++, label: REQ_LABEL, variable: d.variable, op: d.op, value: d.op === "between" ? [num(d.lo), num(d.hi)] : num(d.value),
    requiredResolutionKm: num(d.res), requiredYears: num(d.years), minAreaKm2: num(d.area), note: d.note || "" };
  try { LAB.validateRequirement(q, registry()); } catch (e) { L.reqErr = e.message; labRender(); return; }
  L.reqErr = null; L.reqs.push(q); L.res.reqEval = null; labRender();
}
function exampleReqs() {
  L.reqs.push(
    { id: "R" + reqSeq++, label: REQ_LABEL, variable: "slope", op: "<=", value: 5, requiredResolutionKm: null, requiredYears: null, minAreaKm2: 5000, note: "EXAMPLE value — replace with your own threshold" },
    { id: "R" + reqSeq++, label: REQ_LABEL, variable: "lst_diurnal_range", op: ">=", value: 30, requiredResolutionKm: null, requiredYears: 10, minAreaKm2: null, note: "EXAMPLE value — replace with your own threshold" },
    { id: "R" + reqSeq++, label: REQ_LABEL, variable: "modis_coverage", op: ">=", value: 0.9, requiredResolutionKm: null, requiredYears: null, minAreaKm2: null, note: "EXAMPLE data-availability requirement" },
    { id: "R" + reqSeq++, label: REQ_LABEL, variable: "surface_roughness", op: "between", value: [100, 400], requiredResolutionKm: 1, requiredYears: null, minAreaKm2: null, note: "EXAMPLE — 1 km resolution is finer than the data" });
  L.res.reqEval = null; labRender();
}
async function evalReqs() {
  const reg = registry(), cand = candSet(), sel = labSel(); if (sel != null && !cand.includes(sel)) cand.unshift(sel);
  const ctx = reqCtx(), M = cand.map(i => L.reqs.map(q => LAB.evaluateRequirement(q, i, reg, ctx)));
  L.res.reqEval = { key: baseKey(), cand, M };
  const rec = await makeRecord("requirements", { requirements: L.reqs, candidates: cand.map(i => S.cell[i]) },
    { matrix: M.map((row, k) => ({ cell: S.cell[cand[k]], status: row.map(r => r.status), values: row.map(r => r.value) })) },
    { claims: [LAB.claim({ id: "req.user", category: "ASSUMED", text: "All thresholds are user-defined analytical requirements; ASTERRO provides none.", completeness: "complete" })] });
  L.res.reqEval.rec = rec; labRender();
}
LAB_VIEWS.reqs = function () {
  if (!S.res) return `<div class="sec"><div class="empty">Run the search first.</div></div>`;
  if (!L.ctx) return `<div class="sec"><p class="meta">${L.ctxErr ? esc(L.ctxErr) : "Loading variable registry…"}</p></div>`;
  const reg = registry(), d = L.reqDraft, V = reg[d.variable];
  let h = `<div class="sec"><h3 class="ttl">Mission requirement translator</h3>
    <p class="note">State what a research or training activity requires as explicit, testable conditions, then see which candidates the available evidence can and cannot support. This is not an engineering or mission-certification engine: every threshold is yours and is labelled “${REQ_LABEL}”.</p>
    <div class="lab-form">
      <label>Variable <select data-labin="rq" data-k="variable">${Object.entries(reg).map(([k, v]) => `<option value="${k}"${k === d.variable ? " selected" : ""}>${esc(v.label)}</option>`).join("")}</select></label>
      <label>Condition <select data-labin="rq" data-k="op">${["<=", ">=", "between"].map(o => `<option${o === d.op ? " selected" : ""}>${o}</option>`).join("")}</select></label>
      ${d.op === "between" ? `<label>From <input type="number" step="any" value="${esc(d.lo)}" data-labin="rq" data-k="lo"></label><label>To <input type="number" step="any" value="${esc(d.hi)}" data-labin="rq" data-k="hi"></label>` : `<label>Threshold (${esc(V.unit || "—")}) <input type="number" step="any" value="${esc(d.value)}" data-labin="rq" data-k="value"></label>`}
      <label>Min contiguous area km² <input type="number" min="0" step="any" value="${esc(d.area)}" data-labin="rq" data-k="area" placeholder="optional"></label>
      <label>Required resolution km <input type="number" min="0" step="any" value="${esc(d.res)}" data-labin="rq" data-k="res" placeholder="optional"></label>
      <label>Required record (years) <input type="number" min="0" step="1" value="${esc(d.years)}" data-labin="rq" data-k="years" placeholder="optional"></label>
      <label class="wide">Note / source of threshold <input type="text" value="${esc(d.note)}" data-labin="rq" data-k="note" placeholder="e.g. study protocol §2.1"></label>
      <button class="btn-sm on" data-lab="rq-add">Add requirement</button><button class="btn-sm" data-lab="rq-ex">Add example set</button></div>
    <p class="note small">${esc(V.statistic)} · ${esc(V.dataset)} · ${esc(V.resolution)} · ${esc(V.temporal)}</p>${L.reqErr ? `<div class="callout">${esc(L.reqErr)}</div>` : ""}</div>`;
  if (L.reqs.length) {
    h += `<div class="sec"><div class="lbl">Requirement-to-evidence mapping<span class="row"><button class="btn-sm" data-lab="rq-export">Export set</button><button class="btn-sm" data-lab="rq-clear">Clear</button></span></div><div class="tbl-wrap"><table class="t"><thead><tr><th>ID</th><th>Requirement</th><th>Dataset · statistic</th><th>Resolution · period</th><th class="n">Data available</th><th>Can evaluate?</th></tr></thead><tbody>
      ${L.reqs.map(q => { const W = reg[q.variable]; let fin = 0; const arr = S.A[W.field]; for (let k = 0; k < S.n; k++) if (arr[k] === arr[k]) fin++;
        const gaps = []; if (q.requiredResolutionKm) gaps.push(`data are ${W.resolution}`); if (q.requiredYears && (W.years == null || W.years < q.requiredYears)) gaps.push(W.years == null ? "static variable" : `${W.years}-year record`);
        return `<tr><td class="meta" style="white-space:nowrap">${q.id} <button class="lnk" data-lab="rq-del" data-id="${q.id}" title="Remove ${q.id}" aria-label="Remove ${q.id}">×</button></td><td style="min-width:210px">${esc(reqText(q, W))}<div class="meta"><span class="tag">USER-DEFINED</span>${q.note ? " " + esc(q.note) : ""}</div></td><td class="meta">${esc(W.dataset)} · ${esc(W.statistic)}</td><td class="meta">${esc(W.resolution)} · ${esc(W.temporal)}</td><td class="n">${pct(fin / S.n)}</td><td class="meta">${gaps.length ? "Partially — " + esc(gaps.join("; ")) : "Yes, at cell scale"}</td></tr>`; }).join("")}
      </tbody></table></div><button class="btn-sm on" data-lab="rq-eval">Evaluate candidates</button></div>`;
  }
  const E = L.res.reqEval;
  if (E && L.reqs.length) {
    h += `<div class="sec">${staleNote(E)}<div class="lbl">Candidate comparison<span class="meta">record ${E.rec ? E.rec.id : "…"}</span></div><div class="tbl-wrap"><table class="t"><thead><tr><th>Site</th><th class="n">Analogue Score (A)</th>${L.reqs.map(q => `<th title="${esc(reqText(q, reg[q.variable]))}">${q.id}</th>`).join("")}<th>Summary</th></tr></thead><tbody>
      ${E.cand.map((i, k) => { const row = E.M[k], cnt = s => row.filter(r => r.status === s).length;
        return `<tr><td><button class="lnk" data-lab="sel" data-i="${i}">${siteNo(i)} ${esc(candShort(i).slice(0, 20))}</button></td><td class="n">${fmtPct(S.res.eff[i])}</td>${row.map(r => `<td title="${esc(r.why.concat(r.gaps).join(" "))}">${statusTag(r.status)}</td>`).join("")}<td class="meta">${cnt("MEETS")} meet · ${cnt("FAILS")} fail · ${cnt("PARTIAL")} partial · ${cnt("CANNOT")} n/e</td></tr>`; }).join("")}
      </tbody></table></div>
      <p class="note small">Logic: <b>Meets</b> — finite cell value satisfies the condition (and any area condition). <b>Does not meet</b> — it does not. <b>Partially supported</b> — tested only at cell-mean scale or on a shorter record than required. <b>Cannot be evaluated</b> — no finite value. The Analogue Score is shown separately and never overrides a failed requirement. Hover a status for its reasoning.</p></div>`;
  }
  return h;
};
LAB_INPUTS.rq = a => { L.reqDraft[a.dataset.k] = a.value; if (a.dataset.k === "variable" || a.dataset.k === "op") labRender(); };
LAB_ACTIONS["rq-add"] = () => addReq();
LAB_ACTIONS["rq-ex"] = () => exampleReqs();
LAB_ACTIONS["rq-del"] = a => { L.reqs = L.reqs.filter(q => q.id !== a.dataset.id); L.res.reqEval = null; labRender(); };
LAB_ACTIONS["rq-clear"] = () => { L.reqs = []; L.res.reqEval = null; labRender(); };
LAB_ACTIONS["rq-eval"] = () => evalReqs();
LAB_ACTIONS["rq-export"] = () => { const t = JSON.stringify({ schema: "asterro.requirements/1", created_utc: new Date().toISOString(), target: S.targetId, requirements: L.reqs }, null, 1); showExport("Requirement set", t, "asterro-requirements.json"); };
