/* ===== Phase IV · Research collections =====
 * Named sets of locations and targets with notes, stored in this browser (asterro.collections.v1) and
 * exchanged as versioned JSON (asterro.collections/1). Imports are validated against the registry; an import
 * never overwrites: identical collections are skipped, conflicting ones are reported and left untouched. */
function a4Cols() { const d = a4Get(A4_KEYS.collections, null); return d && Array.isArray(d.collections) ? d.collections : []; }
function a4ColsSave(cols) { return a4Set(A4_KEYS.collections, RG.exportCollections(cols, a4Now())); }
function a4ColBump(c) { c.version += 1; c.updated_utc = a4Now(); }
function a4ItemName(it) {
  if (it.kind === "location" || it.kind === "target") { const r = it.kind === "location" ? a4L(it.id) : a4T(it.id); return r ? r.name : it.id + " (not in this registry)"; }
  if (it.kind === "earth_cell") return `Earth cell ${it.cell} · ${it.place || atFmtLL(it.lat, it.lon)}${it.target && a4T(it.target) ? " (for " + a4T(it.target).name + ")" : ""}`;
  if (it.kind === "scenario_set") return it.label || "Scenario set";
  if (it.kind === "comparison") return it.label || `Comparison (${it.config.aggregate})`;
  if (it.kind === "reference") return it.citation;
  return it.kind;
}
function a4ItemKey(it) { return it.kind + ":" + (it.id || it.cell || (it.config && JSON.stringify(it.config).length + ":" + (it.config.created_utc || "")) || it.citation); }
/* any module can hand an item to the collections view (it never saves silently: the user picks the collection) */
function a4SaveItem(item) { A4.colPending = item; A3.view = "collections"; $("#left").scrollTop = 0; atRender(); announce("Choose a collection for: " + a4ItemName(item)); }
A3_VIEWS.collections = function () {
  const need = a4Need(); if (need) return need;
  const cols = a4Cols(), pend = A4.colPending;
  let h = `<div class="sec"><h3 class="ttl">Research collections</h3>${a4Banner("locally stored collections")}
    <p class="note">Collections are saved in this browser only. Export them to keep or share; import validates every entry against this registry and never overwrites an existing collection.</p>
    ${pend ? `<div class="callout">Add <b>${esc(a4ItemName(pend))}</b> to: ${cols.map(c => `<button class="btn-sm" data-a4="coladd" data-id="${esc(c.id)}">${esc(c.name)}</button>`).join(" ") || "(no collection yet — create one below)"} <button class="lnk" data-a4="colcancel">cancel</button></div>` : ""}
    <form class="lab-form" data-a4form="col" aria-label="Create a collection"><label class="wide">New collection<input name="name" required maxlength="120" placeholder="e.g. Polar thermal windows"></label><button class="btn-sm" type="submit">Create</button></form>
    ${A4.colMsg ? `<p class="small ${A4.colMsg.ok ? "st-d" : "st-m"}" role="status">${esc(A4.colMsg.text)}</p>` : ""}
    <div class="row"><button class="btn-sm" data-a4="colexp" ${cols.length ? "" : "disabled"}>Export all (JSON)</button><label class="btn-sm p4-file">Import (JSON)<input type="file" accept="application/json,.json" data-a4in="colimp" class="sr-only"></label></div></div>`;
  if (A4.colConflicts && A4.colConflicts.length) h += `<div class="sec"><div class="lbl">Import conflicts (nothing overwritten)</div><ul class="lab-ul small">${A4.colConflicts.map(c => `<li><b>${esc(c.id)}</b>: existing “${esc(c.existing.name)}” v${c.existing.version} (${c.existing.items} items) vs incoming “${esc(c.incoming.name)}” v${c.incoming.version} (${c.incoming.items} items). ${esc(c.reason)}</li>`).join("")}</ul></div>`;
  h += cols.map(c => `<div class="sec p4-col"><div class="row" style="justify-content:space-between"><div><b>${esc(c.name)}</b> <span class="meta">id ${esc(c.id)} · v${c.version} · updated ${esc(c.updated_utc)}</span></div>
      <div class="row"><button class="btn-sm" data-a4="colcmp" data-id="${esc(c.id)}" ${c.items.filter(i => i.kind === "target" || (a4L(i.id) || {}).target_ids?.length).length >= 2 ? "" : "disabled"}>Compare targets</button><button class="btn-sm" data-a4="coldel" data-id="${esc(c.id)}">Delete</button></div></div>
    ${c.items.length ? `<ul class="lab-ul">${c.items.map((it, k) => `<li><button class="lnk" data-a4="colopen" data-c="${esc(c.id)}" data-k="${k}">${esc(a4ItemName(it))}</button> <span class="meta">${esc(it.kind.replace("_", " "))}${it.kind === "location" && a4L(it.id) ? " · L" + a4L(it.id).readiness.level : it.kind === "target" && a4T(it.id) ? " · L" + a4T(it.id).readiness.level : ""}${it.snapshot ? ` · registry ${esc(it.snapshot.registry_version)}${a4SnapStale(it.snapshot) ? ' · <b class="p4-bad">fingerprint changed since saved</b>' : ""}` : ""}</span>${it.note ? `<div class="small">${esc(it.note)}</div>` : ""} <button class="lnk" data-a4="colrm" data-id="${esc(c.id)}" data-k="${k}" aria-label="Remove from ${esc(c.name)}">remove</button></li>`).join("")}</ul>` : `<p class="meta">Empty. Use “Add to a collection” on a location, or “Save to collection” in the Comparison Lab, Scenario Lab or Mismatch Explorer.</p>`}
    <form class="lab-form" data-a4form="colref" data-id="${esc(c.id)}" aria-label="Add a source reference to ${esc(c.name)}"><label class="wide">Add a source reference<input name="citation" maxlength="400" placeholder="DOI, publication or URL"></label><label class="wide">Note<input name="note" maxlength="400"></label><button class="btn-sm" type="submit">Add reference</button></form>
    <label class="wide">Notes<textarea data-a4in="colnote" data-id="${esc(c.id)}" rows="2" maxlength="4000">${esc(c.notes || "")}</textarea></label></div>`).join("");
  return h;
};
document.addEventListener("submit", e => {
  const f = e.target.closest("[data-a4form=col]"); if (!f) return;
  e.preventDefault();
  const name = String(new FormData(f).get("name") || "").trim(); if (!name) return;
  const cols = a4Cols(); let id = RG.norm(name).replace(/ /g, "_").slice(0, 48) || "collection", k = 2;
  while (cols.some(c => c.id === id)) id = id.replace(/_\d+$/, "") + "_" + k++;
  const c = RG.newCollection(id, name, a4Now());
  if (A4.colPending) { c.items.push({ ...A4.colPending }); A4.colPending = null; }
  cols.push(c); const se = a4ColsSave(cols);
  A4.colMsg = se ? { ok: false, text: se } : { ok: true, text: `Created “${name}”.` }; atRender(); announce(A4.colMsg.text);
});
Object.assign(A4_ACTIONS, {
  coladd(a) {
    const cols = a4Cols(), c = cols.find(x => x.id === a.dataset.id), it = A4.colPending; if (!c || !it) return;
    if (c.items.some(x => a4ItemKey(x) === a4ItemKey(it))) A4.colMsg = { ok: false, text: "Already in this collection." };
    else { c.items.push({ ...it }); a4ColBump(c); const se = a4ColsSave(cols); A4.colMsg = se ? { ok: false, text: se } : { ok: true, text: `Added to “${c.name}”.` }; }
    A4.colPending = null; atRender(); announce(A4.colMsg.text);
  },
  colcancel() { A4.colPending = null; atRender(); },
  colrm(a) { const cols = a4Cols(), c = cols.find(x => x.id === a.dataset.id); if (!c) return; c.items.splice(+a.dataset.k, 1); a4ColBump(c); a4ColsSave(cols); atRender(); },
  coldel(a) { const cols = a4Cols().filter(x => x.id !== a.dataset.id); a4ColsSave(cols); A4.colMsg = { ok: true, text: `Deleted collection ${a.dataset.id}.` }; atRender(); },
  colexp() { a4Download("asterro_collections.json", RG.exportCollections(a4Cols(), a4Now())); },
  colopen(a) {
    const c = a4Cols().find(x => x.id === a.dataset.c), it = c && c.items[+a.dataset.k]; if (!it) return;
    if (it.kind === "location" && a4L(it.id)) { a4SyncFromLocation(it.id); A4.mode = "browse"; A3.view = "home"; }
    else if (it.kind === "target" && a4T(it.id)) { a4SyncFromTarget(it.id); A3.active = it.id; A3.view = "target"; }
    else if (it.kind === "earth_cell") { const i = S.index[it.cell]; if (i >= 0) { if (it.target && a4T(it.target)) A4.mm.target = it.target; A4.mm.cell = i; A3.view = "mmx"; } }
    else if (it.kind === "scenario_set") { const r = RG.replayScenarios({ IX: A4.ix, A: S.A, cell: S.cell, lat: S.lat, lon: S.lon, critIds: S.critIds, config: it.config });
      A4.scn.target = it.config.target; A4.scn.list = it.config.scenarios.map(s => ({ id: s.id, label: s.label, profile: "custom", weights: s.weights, include_proxy: s.include_proxy, normalisation: s.normalisation }));
      A3.view = "scen4"; a4ScnRun(); A4.scn.msg = { ok: r.ok, text: (r.ok ? "Saved set REPRODUCED: " : "Saved set NOT REPRODUCED: ") + r.msgs.join(" · ") }; }
    else if (it.kind === "comparison") { A4.cmp = it.config.targets.filter(a4T); A4.agg = it.config.aggregate; A4.aggRes = null; A3.view = "lab4"; }
    else if (it.kind === "reference") { if (/^https?:\/\//.test(it.citation)) window.open(it.citation, "_blank", "noopener"); return; }
    $("#left").scrollTop = 0; atRender();
  },
  colcmp(a) {
    const c = a4Cols().find(x => x.id === a.dataset.id); if (!c) return;
    A4.cmp = Array.from(new Set(c.items.flatMap(it => it.kind === "target" ? [it.id] : (a4L(it.id) || { target_ids: [] }).target_ids))).filter(id => a4T(id) && a4T(id).readiness.level >= 2);
    A4.aggRes = null; A3.view = "lab4"; atRender();
  },
});
Object.assign(A4_INPUTS, {
  colnote(a) { const cols = a4Cols(), c = cols.find(x => x.id === a.dataset.id); if (!c || c.notes === a.value) return; c.notes = a.value; a4ColBump(c); a4ColsSave(cols); },
  async colimp(a) {
    const f = a.files && a.files[0]; if (!f) return;
    let doc; try { doc = JSON.parse(await f.text()); } catch (e) { A4.colMsg = { ok: false, text: "Not valid JSON: " + e.message }; atRender(); return; }
    const errs = RG.validateCollections(doc, A4.ix);
    if (errs.length) { A4.colMsg = { ok: false, text: `Import refused (${errs.length} problem${errs.length > 1 ? "s" : ""}): ${errs.slice(0, 6).join("; ")}${errs.length > 6 ? " …" : ""}` }; A4.colConflicts = []; atRender(); return; }
    const m = RG.mergeCollections(a4Cols(), doc.collections), se = m.added.length ? a4ColsSave(m.collections) : null;
    A4.colConflicts = m.conflicts;
    A4.colMsg = { ok: !se && !m.conflicts.length, text: se || `Imported ${m.added.length}; ${m.skipped.length} identical skipped; ${m.conflicts.length} conflicts left untouched.` };
    atRender(); announce(A4.colMsg.text);
  },
});

function a4SnapStale(sn) { return Object.entries(sn.fingerprints || {}).some(([t, h]) => !a4T(t) || a4T(t).fingerprint.content_sha256 !== h); }
document.addEventListener("submit", e => {
  const f = e.target.closest("[data-a4form=colref]"); if (!f) return;
  e.preventDefault();
  const d = Object.fromEntries(new FormData(f).entries()), cite = String(d.citation || "").trim(); if (!cite) return;
  const cols = a4Cols(), c = cols.find(x => x.id === f.dataset.id); if (!c) return;
  c.items.push({ kind: "reference", citation: cite, note: String(d.note || "").trim() || undefined, added_utc: a4Now() }); a4ColBump(c);
  const se = a4ColsSave(cols); A4.colMsg = se ? { ok: false, text: se } : { ok: true, text: "Reference added." }; atRender();
});
