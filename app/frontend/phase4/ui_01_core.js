/* ===== Phase IV · Planetary Atlas & Research Workspace — core (registry, local state, grouped navigation) =====
 * Integration with the earlier layers is limited to:
 *   1. new views registered in the Phase III router (A3_VIEWS) and a grouped module bar (viewAtlas is redefined;
 *      every Phase III module stays reachable under the same id);
 *   2. the canonical registry (public/data/registry.json), verified against the SHA-256 recorded in atlas.json;
 *   3. the Explore adapter (ui_08_explore.js), which registers readiness ≥ 3 targets in the baseline target table.
 * Baseline scoring, weights, ranges, ranking and the legacy targets are never modified. */
const RG = window.AsterroRegistry;
const A4 = {
  reg: null, ix: null, err: null, loading: false,
  body: "mars", region: null, loc: null, mode: "browse", q: "", sort: "readiness",
  f: { level: "", mission: "", dataset: "", type: "", ftype: "", analytical: false },
  tree: {}, cmp: [], agg: "minimum", aggRes: null, val: { target: "mars_gale_curiosity", cases: [], res: null, sens: null, msg: null },
  mm: { target: null, cell: null, proxy: false }, prov: { level: "", kind: "all" }, colMsg: null, colPending: null,
};
const A4_KEYS = { prefs: "asterro.phase4.prefs.v1", collections: "asterro.collections.v1", cases: "asterro.phase4.cases.v1" };

/* ---------- local storage (per-viewer conveniences; always optional) ---------- */
function a4Get(k, dflt) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; } }
function a4Set(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return null; }
  catch (e) { return /quota/i.test(e.name + e.message) ? "Browser storage is full; nothing was saved." : "Browser storage is unavailable here; nothing was saved."; }
}
const A4P = Object.assign({ recent: [], fav: [] }, a4Get(A4_KEYS.prefs, {}));
function a4SavePrefs() { a4Set(A4_KEYS.prefs, { recent: A4P.recent.slice(0, 12), fav: A4P.fav }); }
function a4Touch(id) { A4P.recent = [id, ...A4P.recent.filter(x => x !== id)].slice(0, 12); a4SavePrefs(); }

/* ---------- registry (lazy, checksummed, bound to the atlas which is bound to the stack) ---------- */
async function a4Load() {
  if (A4.reg || A4.err || A4.loading) return A4.reg;
  const a = await atLoad(); if (!a) return null;
  A4.loading = true;
  try {
    if (!a.registry || !a.registry.sha256) throw new Error("this atlas build carries no registry reference");
    const r = await fetch("data/registry.json"); if (!r.ok) throw new Error("data/registry.json → HTTP " + r.status);
    const buf = await r.arrayBuffer();
    if ((await atSha(buf)) !== a.registry.sha256) throw new Error("registry.json fails its SHA-256 check (stale cache or corrupted file); not used.");
    const R = JSON.parse(new TextDecoder().decode(buf));
    if (R.stack_sha256 !== S.app.stack.sha256) throw new Error("the registry was built for a different predictor stack");
    A4.reg = R; A4.ix = RG.index(R);
    if (!A4.loc) A4.loc = "mars:gale";
    if (typeof a4ExploreRegister === "function") a4ExploreRegister();
  } catch (e) { A4.err = e.message; }
  A4.loading = false; atRender();
  return A4.reg;
}
function a4Need() {
  const n = atNeed(); if (n) return n;
  if (A4.err) return `<div class="sec"><div class="callout">The planetary registry is unavailable: ${esc(A4.err)} The baseline application and the Phase III modules are unaffected.</div></div>`;
  if (!A4.reg) { a4Load(); return `<div class="sec"><div class="empty">Loading the planetary registry…</div></div>`; }
  return null;
}
const a4L = id => A4.ix && A4.ix.locations[id];
const a4T = id => A4.ix && A4.ix.targets[id];
const a4Now = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
function a4Level(l) {
  const r = l.readiness, k = r.level;
  return `<span class="lvl lvl-${k}" title="${esc((A4.reg.readiness_model.levels[k] || {}).definition || "")}">L${k} · ${esc(r.label)}</span>`;
}
function a4Download(name, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }), u = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
}
function a4Banner(kind) {
  return `<div class="lab-banner p4"><b>PHASE IV</b>${esc(kind)} · beside the baseline engine · never changes the baseline Analogue Score, weights, ranges or ranking</div>`;
}

/* ---------- grouped module bar (every Phase III module keeps its id) ---------- */
const A4_GROUPS = [
  { label: "Atlas", items: [["home", "Planetary Atlas"], ["catalog", "Target cards"], ["target", "Target"]] },
  { label: "Compare", items: [["lab4", "Comparison Lab"], ["compare", "Fingerprints"], ["mmx", "Mismatch Explorer"], ["mismatch", "Mismatch map"], ["constellation", "Constellation"]] },
  { label: "Research", items: [["scen4", "Scenario Lab"], ["workflow", "Workflow"], ["validation", "Validation"], ["extremes", "Extremes"], ["landing", "Terrain"], ["counter", "Counterfactual"], ["translate", "Translator"], ["expedition", "Expedition"], ["copilot", "Copilot"]] },
  { label: "Records", items: [["readiness", "Readiness & Provenance"], ["collections", "Collections"], ["records", "Records"], ["provenance", "Sources"]] },
];
A3.view = "home";
viewAtlas = function () {
  const G = A4_GROUPS.find(g => g.items.some(([id]) => id === A3.view)) || A4_GROUPS[0];
  const nav = `<nav class="p4-nav" aria-label="Atlas modules"><div class="p4-g1" role="group" aria-label="Module groups">${A4_GROUPS.map(g => `<button data-a3view="${g.items[0][0]}" aria-current="${g === G ? "true" : "false"}">${esc(g.label)}</button>`).join("")}</div>
    <div class="p4-g2" role="group" aria-label="${esc(G.label)} modules">${G.items.map(([id, label]) => `<button data-a3view="${id}" aria-current="${A3.view === id ? "page" : "false"}">${esc(label)}</button>`).join("")}</div></nav>`;
  let body = atNeed();
  if (!body) {
    const v = A3_VIEWS[A3.view] || A3_VIEWS.home;
    try { body = v(); } catch (e) { console.error(e); body = `<div class="sec"><div class="callout">This module failed: ${esc(e.message)}. The baseline application is unaffected.</div></div>`; }
  }
  const l = A4.reg && a4L(A4.loc), t = A3.atlas && atT(A3.active);
  const ctx = [l ? "Location " + esc(l.name) : "", t ? "Target " + esc(t.name) + " · L" + t.readiness.level : "", A3.sel.length ? A3.sel.length + " selected" : ""].filter(Boolean).join(" · ");
  return `<div class="sec lab-head"><div class="lbl">Phase IV · Planetary atlas &amp; research workspace<span class="n">${ctx}</span></div>${nav}</div>${atBusyBar()}<div data-p4>${body}</div>`;
};
/* keep Phase III's selected target and the Phase IV location in step (one state for every view) */
function a4SyncFromTarget(tid) {
  const t = a4T(tid); if (!t) return;
  A4.loc = t.location.id; A4.body = t.body.id; A4.region = t.region.id; a4Touch(A4.loc);
}
function a4SyncFromLocation(lid) {
  const l = a4L(lid); if (!l) return;
  A4.loc = lid; A4.body = l.body; A4.region = l.region; a4Touch(lid);
  const best = l.target_ids.map(a4T).sort((a, b) => b.readiness.level - a.readiness.level)[0];
  if (best && atT(best.id)) { A3.active = best.id; A3.body = best.body.name; }
}
const _a3Pick = A3_ACTIONS.pick, _a3Go = A3_ACTIONS.go, _a3Active = A3_INPUTS["at-active"];
A3_ACTIONS.pick = function (a, e) { if (A4.ix) a4SyncFromTarget(a.dataset.id); return _a3Pick(a, e); };
A3_ACTIONS.go = function (a, e) { if (A4.ix && a.dataset.id) a4SyncFromTarget(a.dataset.id); return _a3Go(a, e); };
A3_INPUTS["at-active"] = function (a, e) { if (A4.ix) a4SyncFromTarget(a.value); return _a3Active(a, e); };
/* load the registry in the background once the baseline data are in (the Explore quick-switch needs it) */
const _p3RenderLeft = renderLeft;
renderLeft = function () { const r = _p3RenderLeft.apply(this, arguments); if (S.app && S.A && S.A.cell && !A4.reg && !A4.err && !A4.loading) setTimeout(a4Load, 0); return r; };
