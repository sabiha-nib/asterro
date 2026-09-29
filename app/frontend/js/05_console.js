/* ===== 05 console: weights, profiles, what-if, change tracking ===== */
const WHATIF = [
  { id: "thermal_x2", label: "What if thermal behaviour matters 2× more?", desc: "Doubles the thermal (LST diurnal range) weight.",
    op: w => ({ ...w, lst_diurnal_range: 2 * w.lst_diurnal_range }) },
  { id: "terrain_dominates", label: "What if terrain dominates the search?", desc: "Triples elevation, slope and roughness weights.",
    op: w => Object.fromEntries(Object.entries(w).map(([c, v]) => [c, ["elevation", "slope", "surface_roughness"].includes(c) ? 3 * v : v])) },
  { id: "ignore_climate", label: "What if all climate variables are ignored?", desc: "Sets aridity and annual temperature range weights to 0.",
    op: w => Object.fromEntries(Object.entries(w).map(([c, v]) => [c, ["aridity", "annual_temperature_range"].includes(c) ? 0 : v])) },
];
const W_MAX = 6;

function currentLabel() { return S.profile === "custom" ? "Custom weights" : S.app.profiles[S.profile].label; }
function snapshot() { const R = S.res; return { tid: R.tid, w: { ...R.w }, eff: R.eff, rank: R.rank, nElig: R.nElig, distinct: R.distinct.slice(), label: currentLabel() }; }
function detectProfile(w) {
  for (const [pid, p] of Object.entries(S.app.profiles)) if (S.critIds.every(c => Math.abs(+p.weights[c] - +w[c]) < 1e-9)) return pid;
  return "custom";
}
/* A weight vector is usable only if every selected target keeps >= 1 active criterion
   (weight > 0 and target value not N/A) and every weight is finite and >= 0. */
function weightsValid(w) {
  if (!S.critIds.every(c => Number.isFinite(+w[c]) && +w[c] >= 0)) return false;
  const tids = S.targetId === "cross" ? TARGET_IDS : [S.targetId];
  return tids.every(t => ENG.activeCriteria(S.critIds, S.T[t].variables, w).length > 0);
}
const INVALID_W_MSG = "No score computed: at least one criterion that applies to the selected target needs a weight above 0.";
function commitWeights(w, why) {
  if (!weightsValid(w)) { announce(INVALID_W_MSG); renderStatus(INVALID_W_MSG); renderConsole(); return; }
  S.prev = snapshot(); S.weights = { ...w }; S.profile = detectProfile(w);
  compute(); paintField(); renderAll(); renderConsole();
  const R = S.res, i = R.distinct[0];
  announce(`${why || "Weights updated"}. Now #1: ${placeStr(i)} at ${fmtPct(R.eff[i])}.`);
}
let dragBase = null, raf = 0;
function liveWeights(w) {
  if (!weightsValid(w)) {            // keep the last valid field; never compute a score from zero weights
    S.weights = { ...w }; updateConsoleNumbers(); renderStatus(INVALID_W_MSG); announce(INVALID_W_MSG); return;
  }
  if (!dragBase) { dragBase = snapshot(); S.prev = dragBase; }
  S.weights = { ...w }; S.profile = detectProfile(w);
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => { compute(); paintField(); renderAll(["right", "legend", "status"]); updateConsoleNumbers(); });
}
function endDrag() {
  if (!weightsValid(S.weights)) { dragBase = null; S.weights = { ...S.res.w }; S.profile = detectProfile(S.weights); renderConsole(); renderStatus("Weights restored to the last valid set. " + INVALID_W_MSG); return; }
  if (!dragBase) return; dragBase = null; renderAll(); renderConsole(); announce(`Now #1: ${placeStr(S.res.distinct[0])}.`); }

function renderConsole() {
  const box = $("#console"); if (!S.app) return;
  const tid = S.targetId, tv = tid === "cross" ? null : S.T[tid].variables;
  const naFor = c => tid === "cross" ? S.targets.every(t => t.variables[c] == null) : tv[c] == null;
  const tot = S.critIds.reduce((a, c) => a + (naFor(c) ? 0 : +S.weights[c]), 0);
  box.innerHTML = `<div class="sliders">${S.critIds.map(c => {
      const v = +S.weights[c], na = naFor(c);
      return `<div class="sl"><label for="w-${c}"><span class="nm">${esc(labelOf(c))}</span><b id="wv-${c}">${v.toFixed(2)}</b></label>
      <input type="range" id="w-${c}" data-c="${c}" min="0" max="${W_MAX}" step="0.25" value="${v}" style="--p:${(v / W_MAX * 100).toFixed(1)}%" aria-describedby="ws-${c}" aria-valuetext="weight ${v.toFixed(2)}${na ? ", not applicable to this target" : ""}">
      <div class="foot">${na ? '<span class="tag na">N/A for target</span>' : compTag(tid, c) || (S.targets.every(t => t.variables[c] != null) ? '<span class="tag">Both</span>' : '<span class="tag na" title="Not applicable to the Lunar South Pole; scored for Jezero only">Mars only</span>')}<span class="share" id="ws-${c}">${na ? "excluded" : (tot > 0 ? (100 * v / tot).toFixed(0) : 0) + "% of weight"}</span></div></div>`;
    }).join("")}</div>
    <div class="con-side"><div class="profiles" role="group" aria-label="Mission profile">
      <button class="btn-sm con-toggle" data-contoggle aria-expanded="${box.classList.contains("open")}">Weights ${box.classList.contains("open") ? "▴" : "▾"}</button>
      ${Object.entries(S.app.profiles).map(([pid, p]) => `<button class="btn-sm${S.profile === pid ? " on" : ""}" data-profile="${pid}" title="${esc(p.rationale)}">${esc(p.label)}</button>`).join("")}
      <span class="btn-sm${S.profile === "custom" ? " on" : ""}" aria-disabled="true">Custom</span></div>
      <div class="disclaimer">This system identifies environmental analogues using selected measurable variables. A high similarity score does not establish geological equivalence, engineering suitability, habitability, safety, or mission-site certification.</div></div>`;
  $$("input[type=range]", box).forEach(inp => {
    inp.addEventListener("input", () => { inp.style.setProperty("--p", (inp.value / W_MAX * 100) + "%"); liveWeights({ ...S.weights, [inp.dataset.c]: +inp.value }); });
    inp.addEventListener("change", endDrag);
  });
}
function updateConsoleNumbers() {
  const tid = S.targetId;
  const naFor = c => tid === "cross" ? S.targets.every(t => t.variables[c] == null) : S.T[tid].variables[c] == null;
  const tot = S.critIds.reduce((a, c) => a + (naFor(c) ? 0 : +S.weights[c]), 0);
  for (const c of S.critIds) { const b = $("#wv-" + c); if (b) b.textContent = (+S.weights[c]).toFixed(2); const inp = $("#w-" + c); if (inp) inp.setAttribute("aria-valuetext", "weight " + (+S.weights[c]).toFixed(2)); const s = $("#ws-" + c); if (s && !naFor(c)) s.textContent = (tot > 0 ? (100 * S.weights[c] / tot).toFixed(0) : 0) + "% of weight"; }
  $$(".profiles .btn-sm").forEach(b => b.classList.toggle("on", (b.dataset.profile || "custom") === S.profile));
}
function applyProfile(pid) { commitWeights({ ...S.app.profiles[pid].weights }, "Profile " + S.app.profiles[pid].label); }
function applyWhatIf(id) {
  const wf = WHATIF.find(x => x.id === id), next = wf.op({ ...S.weights });
  commitWeights(next, wf.label.replace("What if ", "Applied: ").replace("?", ""));
  if (S.tab !== "scenarios") setTab("scenarios");
  setTimeout(() => { const w = $("#why"); w && w.scrollIntoView({ block: "start", behavior: REDUCED ? "auto" : "smooth" }); }, 50);
  setLayer("delta");
}
