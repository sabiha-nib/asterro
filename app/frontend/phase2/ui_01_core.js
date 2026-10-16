/* ===== Phase II · Research Laboratory — core (state, data, router, vault, shared widgets) =====
 * Integration with the baseline app is limited to:
 *   1. one extra tab button appended to the existing tab bar ("Lab"), added at runtime;
 *   2. a wrapper around renderLeft() that renders the Lab view when S.tab === "lab" and
 *      otherwise calls the ORIGINAL function unchanged.
 * Baseline state (S.weights, S.res, S.targetId …) is read, never written, except through the
 * existing public actions select() and setTarget() when the user explicitly clicks them. */
const LAB = window.AsterroLab;
const L = {
  mod: "overview", ctx: null, ctxErr: null, series: null, seriesErr: null, seriesLoading: false,
  res: {}, busy: null, records: [], notes: {}, planner: null, reqs: null, reviewText: "",
};
const LAB_MODULES = [
  { id: "overview", label: "Overview" },
  { id: "robust", label: "Robustness", title: "Analogue Robustness Laboratory" },
  { id: "portfolio", label: "Multi-objective", title: "Multi-Objective Analogue Discovery" },
  { id: "atlas", label: "Spatial atlas", title: "Spatial Analogue Microclimate Atlas" },
  { id: "uncert", label: "Uncertainty", title: "Planetary Uncertainty Explorer" },
  { id: "failure", label: "Failure modes", title: "Analogue Failure-Mode Laboratory" },
  { id: "graph", label: "Evidence graph", title: "Planetary Evidence Graph" },
  { id: "xplanet", label: "Cross-planet", title: "Cross-Planet Evidence Comparator" },
  { id: "temporal", label: "Temporal", title: "Planetary Analogue Evolution Observatory" },
  { id: "reqs", label: "Requirements", title: "Mission Requirement Translator" },
  { id: "obsval", label: "Observation value", title: "Observation Value Engine" },
  { id: "planner", label: "Planner", title: "Analogue Research Mission Planner" },
  { id: "vault", label: "Vault", title: "Scientific Reproducibility Vault" },
  { id: "review", label: "Review", title: "Scientific Review (deterministic)" },
];
const LAB_VIEWS = {};

/* ---------- data (lazy, checksummed) ---------- */
async function labCtx() {
  if (L.ctx || L.ctxErr) return L.ctx;
  try {
    const r = await fetch("data/phase2/context.json"); if (!r.ok) throw new Error("data/phase2/context.json → HTTP " + r.status);
    const c = await r.json();
    if (c.stack_sha256 !== S.app.stack.sha256) throw new Error("Phase II context was built for a different predictor stack (" + c.stack_sha256.slice(0, 12) + "…).");
    L.ctx = c;
  } catch (e) { L.ctxErr = e.message; }
  return L.ctx;
}
async function labSeries() {
  if (L.series || L.seriesErr) return L.series;
  const c = await labCtx(); if (!c) { L.seriesErr = L.ctxErr; return null; }
  L.seriesLoading = true; labRender();
  try {
    const r = await fetch("data/phase2/" + c.series.file); if (!r.ok) throw new Error("series → HTTP " + r.status);
    const bs = atob((await r.text()).trim()), u8 = new Uint8Array(bs.length);
    for (let k = 0; k < bs.length; k++) u8[k] = bs.charCodeAt(k);
    const h = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", u8.buffer)), b => b.toString(16).padStart(2, "0")).join("");
    if (h !== c.series.sha256) throw new Error("Phase II series checksum mismatch; data not used.");
    const TA = { int16: Int16Array, uint16: Uint16Array }, out = {};
    for (const Ly of c.series.layout) out[Ly.name] = Object.assign(new TA[Ly.dtype](u8.buffer, Ly.offset, Ly.length), { meta: Ly });
    L.series = out;
  } catch (e) { L.seriesErr = e.message; }
  L.seriesLoading = false; labRender();
  return L.series;
}
function seriesVal(name, row, i) {        // decoded value or NaN
  const a = L.series[name], m = a.meta, v = a[row * S.n + i];
  return v === m.fill ? NaN : v * m.scale;
}

/* ---------- baseline snapshot (read-only) ---------- */
function labBaseline() {
  const A = S.app;
  return {
    product: "ASTERRO — Planetary Analogue Intelligence", algorithm_version: A.algorithm_version, phase2_version: LAB.VERSION,
    target: S.targetId, weights: { ...S.weights }, profile: S.profile, profile_label: currentLabel(),
    normalization_ranges: S.ranges, min_coverage: ENG.MIN_COVERAGE, distinct_sep_km: A.thresholds.distinct_sep_km,
    predictor_stack: { sha256: A.stack.sha256, file_hashes: A.file_hashes },
    phase2_series_sha256: L.ctx ? L.ctx.series.sha256 : null,
    dataset_versions: Object.fromEntries(A.datasets.map(d => [d.id, d.version])),
  };
}
function baseKey() { return LAB.canonical({ t: S.targetId, w: S.critIds.map(c => +S.weights[c]) }); }
function targetsFor(tid) { return tid === "cross" ? TARGET_IDS : [tid]; }
const prepCache = new Map();
function prepFor(tid) {                      // per-criterion similarity arrays, cached per target
  if (!prepCache.has(tid)) prepCache.set(tid, LAB.prepare(S.A, S.critIds, S.T[tid].variables, S.ranges));
  return prepCache.get(tid);
}
function PsFor(tid) { return targetsFor(tid).map(prepFor); }
function candSet() { return S.res ? S.res.distinct.slice() : []; }
function labSel() { const i = S.selected ?? S.picked ?? (S.res && S.res.distinct[0]); return i == null ? null : i; }
function activeFor(tid, w = S.weights) {
  const set = new Set(); for (const t of targetsFor(tid)) for (const c of S.critIds) if (S.T[t].variables[c] != null && +w[c] > 0) set.add(c);
  return S.critIds.filter(c => set.has(c));
}
function coverageOf(tid, i, w = S.weights) {
  return Math.min(...targetsFor(tid).map(t => { const a = S.critIds.filter(c => S.T[t].variables[c] != null && +w[c] > 0); let tot = 0, ok = 0; for (const c of a) { tot += +w[c]; if (S.A[c][i] === S.A[c][i]) ok += +w[c]; } return tot ? ok / tot : 0; }));
}

/* ---------- vault (experiment records) ---------- */
const VAULT_KEY = "asterro.phase2.vault.v1";
function vaultLoad() { try { const s = localStorage.getItem(VAULT_KEY); L.records = s ? JSON.parse(s) : []; } catch (e) { L.records = []; } }
function vaultSave() { try { localStorage.setItem(VAULT_KEY, JSON.stringify(L.records.slice(-60))); return true; } catch (e) { return false; } }
async function makeRecord(module, params, outputs, extra = {}) {
  const config = { schema: "asterro.experiment/1", module, baseline: labBaseline(), params };
  const id = (await LAB.sha256Hex(LAB.canonical(config))).slice(0, 16);
  const outputs_sha256 = await LAB.sha256Hex(LAB.canonical(outputs));
  const rec = { ...config, id, created_utc: new Date().toISOString(), outputs, outputs_sha256,
    limitations: extra.limitations || [], claims: extra.claims || [], parent: extra.parent || null,
    replay: extra.replay || "browser", software: { app: S.app.algorithm_version, phase2: LAB.VERSION } };
  L.records = L.records.filter(r => r.id !== id); L.records.push(rec); vaultSave();
  return rec;
}

/* ---------- shared widgets ---------- */
const f1 = x => x == null || x !== x ? "—" : (+x).toFixed(1), f2 = x => x == null || x !== x ? "—" : (+x).toFixed(2), f3 = x => x == null || x !== x ? "—" : (+x).toFixed(3);
const pct = x => x == null || x !== x ? "—" : (100 * x).toFixed(0) + "%";
const nfmt = x => x == null || x !== x ? "—" : Math.round(x).toLocaleString();
const EV_CLASS = { MEASURED: "ev-m", DERIVED: "ev-d", INFERRED: "ev-i", ASSUMED: "ev-a", UNAVAILABLE: "ev-u", UNVALIDATED: "ev-v" };
function evTag(cat) { return `<span class="tag ev ${EV_CLASS[cat]}" title="${esc(LAB.CATEGORY_HELP[cat])}">${cat}</span>`; }
function claimsBlock(claims, title = "Evidence record") {
  if (!claims || !claims.length) return "";
  return `<details class="lab-ev"><summary>${title} · ${claims.length} claim${claims.length > 1 ? "s" : ""}</summary>
    ${claims.map(c => `<div class="ev-row"><div class="row">${evTag(c.category)}<span class="meta">${esc(c.id)}</span><span class="meta">completeness: ${c.completeness}</span></div>
      <div class="ev-text">${esc(c.text)}</div>
      ${c.method ? `<div class="meta"><b>Method</b> ${esc(c.method)}</div>` : ""}
      ${c.provenance.length ? `<div class="meta"><b>Provenance</b> ${c.provenance.map(esc).join(" · ")}</div>` : ""}
      ${c.assumptions.length ? `<div class="meta"><b>Assumptions</b> ${c.assumptions.map(esc).join(" · ")}</div>` : ""}
      ${c.limitations.length ? `<div class="meta"><b>Limitations</b> ${c.limitations.map(esc).join(" · ")}</div>` : ""}
      ${c.reproduce ? `<div class="meta"><b>Reproduce</b> ${esc(c.reproduce)}</div>` : ""}</div>`).join("")}</details>`;
}
function statusTag(st) {
  const m = { MEETS: ["c-match", "✓", "Meets"], FAILS: ["c-mismatch", "✕", "Does not meet"], PARTIAL: ["c-partial", "◐", "Partially supported"], CANNOT: ["", "?", "Cannot evaluate"] }[st];
  return `<span class="rq ${m[0]}" title="${esc(LAB.REQ_STATUS[st])}"><b>${m[1]}</b> ${m[2]}</span>`;
}
function clsTag(cls) {
  const m = { STABLE: ["c-match", "●"], MODERATELY_SENSITIVE: ["c-partial", "◐"], HIGHLY_SENSITIVE: ["c-mismatch", "○"], INSUFFICIENT_EVIDENCE: ["", "?"] }[cls];
  return `<span class="rq ${m[0]}"><b>${m[1]}</b> ${esc(LAB.CLASS_LABEL[cls])}</span>`;
}
function experimentBanner(kind = "experiment") {
  return `<div class="lab-banner"><b>${kind === "analysis" ? "ANALYSIS" : "EXPERIMENT"}</b> Separate from the baseline. The baseline Analogue Score, ranking and weights shown elsewhere are unchanged.</div>`;
}
function staleNote(r) {
  return r && r.key !== baseKey() ? `<div class="callout">Baseline configuration changed since this was run (target or weights). Results below refer to the recorded configuration; re-run to update.</div>` : "";
}
function busyBar() {
  if (!L.busy) return "";
  const p = L.busy.total ? L.busy.done / L.busy.total : 0;
  return `<div class="lab-busy" role="status"><div class="row" style="justify-content:space-between"><span class="meta">${esc(L.busy.label)} · ${L.busy.done}/${L.busy.total}</span><button class="btn-sm" data-lab="cancel">Cancel</button></div><div class="track"><div class="fill" style="width:${(100 * p).toFixed(1)}%"></div></div></div>`;
}
function candName(i) { return placeStr(i); }
function candShort(i) { const p = placeName(i); return p.primary + (p.secondary ? ", " + p.secondary : ""); }
function siteNo(i) { const k = S.res.distinct.indexOf(i); return k >= 0 ? "#" + pad2(k + 1) : "pick"; }
function svgAxisLog(x0, x1, y, lo, hi, X) {
  let t = ""; for (let p = 0; Math.pow(10, p) <= hi * 1.0001; p++) { const v = Math.pow(10, p); if (v < lo) continue; t += `<line x1="${X(v)}" x2="${X(v)}" y1="${y - 4}" y2="${y}" stroke="var(--line-2)"/><text x="${X(v)}" y="${y + 11}" text-anchor="middle" font-size="9" fill="var(--ink-3)">${v.toLocaleString()}</text>`; }
  return `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="var(--line-2)"/>` + t;
}
/* Download: inside the claude.ai artifact viewer the `downloads` capability asks the viewer to
 * confirm; on an ordinary static host (e.g. GitHub Pages) a plain download link is used. */
let labDownloads; // undefined = not yet resolved, null = unavailable
async function downloadText(name, text, type = "application/json") {
  if (labDownloads === undefined) {
    try { labDownloads = window.claude && typeof window.claude.use === "function" ? await window.claude.use("downloads") : null; } catch (e) { labDownloads = null; }
  }
  if (labDownloads) {
    try { await labDownloads.save({ filename: name, data: text }); return "saved"; }
    catch (e) { return e && e.code === "declined" ? "declined" : "unavailable"; }
  }
  try {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); return "saved";
  } catch (e) { return "unavailable"; }
}
function showExport(title, text, name, type) {
  openSheet(title, `<p class="note small">Copy the record below, or download it. Nothing is uploaded anywhere.</p><pre class="code" style="max-height:60vh;overflow:auto">${esc(text)}</pre>`,
    `<button class="btn-sm" id="lab-copy">Copy</button><button class="btn-sm" id="lab-dl">Download</button>`);
  $("#lab-copy").onclick = e => copyText(text, e.target);
  $("#lab-dl").onclick = async e => { const b = e.target, r = await downloadText(name, text, type); if (r !== "saved") b.textContent = r === "declined" ? "Download declined" : "Download unavailable — use Copy"; };
}

/* ---------- router ---------- */
function labRender() { if (S.tab === "lab") renderLeft(); }
function viewLab() {
  const nav = `<div class="lab-nav" role="tablist" aria-label="Laboratory modules">${LAB_MODULES.map(m => `<button role="tab" aria-selected="${L.mod === m.id}" data-labmod="${m.id}">${esc(m.label)}</button>`).join("")}</div>`;
  const v = LAB_VIEWS[L.mod] || LAB_VIEWS.overview;
  let body;
  try { body = v(); } catch (e) { console.error(e); body = `<div class="sec"><div class="callout">This module failed: ${esc(e.message)}. The baseline application is unaffected.</div></div>`; }
  return `<div class="sec lab-head"><div class="lbl">Phase II · Research laboratory<span class="n">${esc(TNAME[S.targetId])}</span></div>${nav}</div>${busyBar()}${body}`;
}
const _baselineRenderLeft = renderLeft;
renderLeft = function () {
  if (S.tab !== "lab") return _baselineRenderLeft.apply(this, arguments);
  const box = $("#left"), top = box.scrollTop;
  box.innerHTML = S.app ? viewLab() : "";
  box.scrollTop = top;
  $("#app").classList.add("wide");
};
(function addLabTab() {
  const nav = $(".tabs"); if (!nav || $("#tab-lab")) return;
  const b = document.createElement("button");
  b.setAttribute("role", "tab"); b.dataset.tab = "lab"; b.id = "tab-lab"; b.textContent = "Lab"; b.title = "Phase II research laboratory (experimental analyses beside the baseline)";
  nav.appendChild(b);
})();
vaultLoad();

/* ---------- events (delegated, namespaced data-lab* attributes only) ---------- */
document.addEventListener("click", e => {
  const m = e.target.closest("[data-labmod]");
  if (m) { L.mod = m.dataset.labmod; $("#left").scrollTop = 0; labRender(); if (["atlas", "temporal", "graph", "uncert", "failure", "reqs", "xplanet"].includes(L.mod)) labCtx().then(labRender); return; }
  const a = e.target.closest("[data-lab]"); if (!a) return;
  const fn = LAB_ACTIONS[a.dataset.lab]; if (fn) { e.preventDefault(); fn(a, e); }
});
const LAB_ACTIONS = {
  cancel() { if (L.busy) L.busy.cancel = true; },
  sel(a) { const i = +a.dataset.i; if (i >= 0) select(i, true); },
  goto(a) { L.mod = a.dataset.to; $("#left").scrollTop = 0; labRender(); },
};
document.addEventListener("change", e => {
  const a = e.target.closest("[data-labin]"); if (!a) return;
  const fn = LAB_INPUTS[a.dataset.labin]; if (fn) fn(a, e);
});
const LAB_INPUTS = {};

/* ---------- overview ---------- */
const LAB_STATUS = {
  robust: ["Implemented", "Predictor stack (baseline bundle)"],
  portfolio: ["Implemented", "Predictor stack"],
  atlas: ["Implemented (terrain sub-cell via Phase III; climate/thermal sub-cell not available)", "Stack neighbourhood, target windows, GMTED 30″ slope histograms"],
  uncert: ["Implemented (quantified where data allow; qualitative elsewhere)", "Stack, MODIS yearly, MEDA, Diviner"],
  failure: ["Implemented", "Stack, targets, catalogue"],
  graph: ["Implemented", "app.json, targets.json, provenance manifest"],
  xplanet: ["Implemented", "Stack, targets"],
  temporal: ["Implemented (MODIS 10 yr, POWER monthly climatology)", "Phase II series (lazy, 7 MB)"],
  reqs: ["Implemented", "Stack; user-defined thresholds"],
  obsval: ["Implemented as qualitative evidence-priority (formal VOI blocked)", "Robustness results"],
  planner: ["Implemented", "Outputs of the other modules"],
  vault: ["Implemented (browser storage; Python replay for robustness/ablation)", "Browser localStorage"],
  review: ["Deterministic review implemented; language-model copilot not implemented", "Evidence records"],
};
LAB_VIEWS.overview = function () {
  return `<div class="sec"><h3 class="ttl">Research laboratory</h3>
    <p class="note">Analyses that sit <b>beside</b> the baseline engine. They answer questions the Analogue Score cannot: is a rank stable, how varied is the area around a cell, what does the data not show, and which evidence is missing. They never change the baseline score, weights, normalisation or ranking.</p>
    <p class="note small">Four kinds of output are kept apart throughout: <b>A</b> baseline Analogue Score · <b>B</b> new analytical metrics · <b>C</b> engineering / mission considerations (user-defined) · <b>D</b> evidence gaps. Nothing here combines them into one number.</p></div>
    <div class="sec"><div class="lbl">Modules</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Module</th><th>Status</th><th>Data</th></tr></thead><tbody>
    ${LAB_MODULES.filter(m => m.id !== "overview").map(m => `<tr><td><button class="lnk" data-lab="goto" data-to="${m.id}">${esc(m.title)}</button></td><td class="meta">${esc(LAB_STATUS[m.id][0])}</td><td class="meta">${esc(LAB_STATUS[m.id][1])}</td></tr>`).join("")}
    </tbody></table></div></div>
    <div class="sec"><div class="lbl">Evidence before assertion</div><div class="ev-legend">${LAB.EVIDENCE.map(c => `<div>${evTag(c)}<span class="meta">${esc(LAB.CATEGORY_HELP[c])}</span></div>`).join("")}</div>
    <p class="note small">Every analytical result carries claims labelled with one of these categories, its method, provenance, assumptions and limitations. The categories are never interchangeable: a derived quantity is not an observation; an assumption is not a measurement; nothing here is operationally certified.</p></div>`;
};
