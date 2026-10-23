/* ===== Exploration Journal: responsible local persistence =====
 * Progress stays where it was (localStorage key "asterro.journal.v1", the same shape: {marks, unlocked, ch}); this
 * layer only makes it sturdier and says plainly where it lives:
 *   - saving merges with what is stored (earliest time wins), so two open tabs never erase each other's progress and
 *     nothing is awarded twice; a "storage" event from another tab merges in silently (no second toast);
 *   - a corrupt stored value is kept aside (asterro.journal.v1.corrupt) instead of being overwritten;
 *   - reset asks for confirmation, and records resetAt so an older tab cannot bring reset progress back;
 *   - progress can be exported to a file and imported (merged) on another browser — the only transfer there is,
 *     because ASTERRO has no account system or server; nothing is synced;
 *   - the journal shows a progress summary and the storage state (saved here / storage unavailable).
 * Language, target and profile changes never touch this state; achievements still unlock only from recorded actions
 * (marks), and an import re-derives achievements from the imported marks rather than trusting them. */
const JLS = { KEY: "asterro.journal.v1", ok: true, corrupt: false, confirm: false, msg: null };
(function jlsInit() {
  try {
    const k = "asterro.__probe"; localStorage.setItem(k, "1"); localStorage.removeItem(k);
    const raw = localStorage.getItem(JLS.KEY);
    if (raw) { try { const v = JSON.parse(raw); if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("shape"); } catch (e) { JLS.corrupt = true; try { localStorage.setItem(JLS.KEY + ".corrupt", raw); } catch (e2) { } } }
  } catch (e) { JLS.ok = false; }
  for (const f of ["marks", "unlocked", "ch"]) if (!JL[f] || typeof JL[f] !== "object" || Array.isArray(JL[f])) JL[f] = {};
  if (typeof JL.resetAt !== "number") JL.resetAt = 0;
})();
function jlsValid(id, t) { return typeof id === "string" && id.length < 120 && typeof t === "number" && isFinite(t) && t > 0; }
/* merge another copy of the journal into JL in place (JL keeps its identity) */
function jlsMerge(o) {
  if (!o || typeof o !== "object") return [];
  const resetAt = Math.max(JL.resetAt || 0, typeof o.resetAt === "number" ? o.resetAt : 0);
  if (resetAt > (JL.resetAt || 0)) { for (const f of ["marks", "unlocked"]) for (const [k, t] of Object.entries(JL[f])) if (t <= resetAt) delete JL[f][k]; if ((JL.resetAt || 0) < resetAt) for (const k of Object.keys(JL.ch)) delete JL.ch[k]; JL.resetAt = resetAt; }
  const fresh = [];
  for (const f of ["marks", "unlocked"]) for (const [k, t] of Object.entries(o[f] || {})) {
    if (!jlsValid(k, t) || t <= resetAt) continue;
    if (f === "unlocked" && !JL_ACH.some(([id]) => id === k)) continue;
    if (JL[f][k] == null || t < JL[f][k]) { if (f === "unlocked" && JL[f][k] == null) fresh.push(k); JL[f][k] = t; }
  }
  for (const [k, v] of Object.entries(o.ch || {})) if (v && typeof v === "object" && !(JL.ch[k] && JL.ch[k].done)) JL.ch[k] = { picked: Array.isArray(v.picked) ? v.picked.filter(Number.isInteger) : undefined, c: typeof v.c === "string" ? v.c : undefined, o: typeof v.o === "string" ? v.o : undefined, done: !!v.done, correct: !!v.correct, why: typeof v.why === "string" ? esc(v.why.replace(/<[^>]*>/g, "")) : "" };
  return fresh;
}
function jlsStored() { try { const r = localStorage.getItem(JLS.KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
jlSave = function () {
  if (!JLS.ok) return;
  try {
    if (!JLS.corrupt) jlsMerge(jlsStored());
    localStorage.setItem(JLS.KEY, JSON.stringify({ marks: JL.marks, unlocked: JL.unlocked, ch: JL.ch, resetAt: JL.resetAt || 0 }));
    JLS.corrupt = false;
  } catch (e) { JLS.ok = false; }
};
/* unlocks are derived from marks; recomputed after a merge so an imported or other-tab mark unlocks what it earns */
function jlsDerive() { for (const [id, ok] of JL_ACH) if (!JL.unlocked[id] && ok(JL.marks)) JL.unlocked[id] = Math.max(...Object.values(JL.marks), 1); }
window.addEventListener("storage", e => {
  if (e.key !== JLS.KEY || !e.newValue) return;
  try { jlsMerge(JSON.parse(e.newValue)); jlsDerive(); jlChip(); if (JN.open && JN.view === "journal") jnRender(); } catch (x) { }
});
function jlsSummary() {
  const steps = JL_STEPS.filter(([, ok]) => ok(JL.marks)).length, ach = JL_ACH.filter(([id]) => JL.unlocked[id]).length;
  const ch = ["stronger", "costs", "excluded", "same"].filter(id => JL.ch[id] && JL.ch[id].done && JL.ch[id].correct).length;
  return { steps, ach, ch, nSteps: JL_STEPS.length, nAch: JL_ACH.length, nCh: 4 };
}
function jlsExport() {
  const blob = new Blob([JSON.stringify({ schema: "asterro.journal/1", exported_utc: new Date().toISOString(), note: "Exploration Journal progress from one browser. Contains no scores and no personal data.", marks: JL.marks, unlocked: JL.unlocked, ch: JL.ch, resetAt: JL.resetAt || 0 }, null, 1)], { type: "application/json" });
  const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = "asterro-journal.json"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000);
}
function jlsImport(text) {
  let o; try { o = JSON.parse(text); } catch (e) { return tx("jls.import_bad"); }
  if (!o || o.schema !== "asterro.journal/1") return tx("jls.import_bad");
  const before = Object.keys(JL.marks).length;
  jlsMerge({ marks: o.marks, ch: o.ch, resetAt: 0 });         // achievements are re-derived from the imported marks
  jlsDerive(); jlSave(); jlChip();
  return txP("jls.import_ok", Object.keys(JL.marks).length - before);
}
{ const f = jlView; jlView = function () {
  let h = f.apply(this, arguments);
  const s = jlsSummary();
  const sum = `<p class="jls-sum" data-jls-summary><b>${esc(tx("jls.summary", { s: txInt(s.steps), ns: txInt(s.nSteps), a: txInt(s.ach), na: txInt(s.nAch), c: txInt(s.ch), nc: txInt(s.nCh) }))}</b></p>`;
  const store = JLS.ok ? tx("jls.stored") : tx("jls.unavailable");
  const ctl = JLS.confirm
    ? `<span class="jls-confirm" role="group" aria-label="${esc(tx("jls.reset_q"))}">${esc(tx("jls.reset_q"))} <button class="jn-lnk" data-jls="reset-yes">${esc(tx("jls.reset_yes"))}</button> <button class="jn-lnk" data-jls="reset-no">${esc(tx("jls.reset_no"))}</button></span>`
    : `<button class="jn-lnk" data-jls="export">${esc(tx("jls.export"))}</button> · <label class="jn-lnk jls-imp">${esc(tx("jls.import"))}<input type="file" accept="application/json,.json" data-jls="import" class="sr-only"></label> · <button class="jn-lnk" data-jls="reset-ask">${esc(tx("journal.reset"))}</button>`;
  const foot = `<p class="jn-note jls-store" data-jls-store="${JLS.ok ? "local" : "none"}">${esc(store)}${JLS.corrupt ? " " + esc(tx("jls.corrupt")) : ""} ${ctl}</p>${JLS.msg ? `<p class="jn-note" role="status">${esc(JLS.msg)}</p>` : ""}`;
  h = h.replace(/<p class="jn-lead">/, sum + '<p class="jn-lead">');
  h = h.replace(/<p class="jn-note">[^<]*<button class="jn-lnk" data-jl="reset">[^<]*<\/button><\/p>/, foot);
  return h;
}; JN_VIEWS.journal.render = jlView; }
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("button[data-jls]"); if (!b || !$("#jn") || !$("#jn").contains(b)) return;
  const a = b.dataset.jls; JLS.msg = null;
  if (a === "export") jlsExport();
  else if (a === "reset-ask") JLS.confirm = true;
  else if (a === "reset-no") JLS.confirm = false;
  else if (a === "reset-yes") { JLS.confirm = false; JL.resetAt = Date.now(); for (const f of ["marks", "unlocked", "ch"]) for (const k of Object.keys(JL[f])) delete JL[f][k]; try { if (JLS.ok) localStorage.setItem(JLS.KEY, JSON.stringify({ marks: {}, unlocked: {}, ch: {}, resetAt: JL.resetAt })); } catch (x) { } jlChip(); JLS.msg = tx("jls.reset_done"); }
  jnRender();
  const n = document.querySelector(a === "reset-ask" ? '[data-jls="reset-no"]' : '[data-jls="reset-ask"]'); if (n) n.focus();
});
document.addEventListener("change", e => {
  const i = e.target; if (!i || !i.matches || !i.matches('input[data-jls="import"]') || !i.files || !i.files[0]) return;
  const r = new FileReader(); r.onload = () => { JLS.msg = jlsImport(String(r.result)); jnRender(); }; r.readAsText(i.files[0]);
});
