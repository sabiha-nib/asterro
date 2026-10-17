/* ===== Phase III · Planetary Target Atlas — catalogue (map, search, filters, cards, multi-select) ===== */
function atMatches(t) {
  if (t.body !== A3.body) return false;
  if (A3.kind !== "all" && t.kind !== A3.kind) return false;
  if (t.readiness.level < A3.minLevel) return false;
  const q = A3.q.trim().toLowerCase();
  if (!q) return true;
  const hay = [t.name, t.id, t.context, t.kind, t.anchor.gazetteer && t.anchor.gazetteer.name, t.anchor.gazetteer && t.anchor.gazetteer.clean_name].join(" ").toLowerCase();
  return q.split(/\s+/).every(w => hay.includes(w));
}
function atCard(t) {
  const on = A3.sel.includes(t.id), act = A3.active === t.id;
  const tr = t.terrain, th = t.thermal;
  const dir = S.critIds.filter(c => t.status[c] === "DIRECT").map(shortOf);
  const gaps = S.critIds.filter(c => ["MISSING", "UNVALIDATED"].includes(t.status[c])).map(shortOf);
  return `<article class="at-card${act ? " act" : ""}" aria-label="${esc(t.name)}">
    <header><div><div class="at-card-t">${esc(t.name)}</div><div class="meta">${t.body} · ${atFmtLL(t.anchor.lat, t.anchor.lon)} ${t.baseline ? '· <b class="at-base">BASELINE TARGET</b>' : ""}</div></div>${atLevel(t)}</header>
    <div class="row">${atKind(t.kind)}${t.anchor.secondary_source ? '<span class="tag st-u" title="Coordinate from a secondary source">secondary coordinate</span>' : ""}${tr && tr.heterogeneity ? '<span class="tag">9-window sample</span>' : ""}${th ? `<span class="tag">${esc(th.source.replace("_", " "))}</span>` : ""}</div>
    <p class="note small">${esc(t.context)}</p>
    <div class="at-fpmini">${S.critIds.map(c => `<div title="${esc(labelOf(c))}: ${esc(t.status[c])}"><span>${esc(shortOf(c))}</span><b class="${AT_ST_CLASS[t.status[c]]}">${t.status[c] === "DIRECT" ? atVal(c, t.values[c]) : t.status[c].slice(0, 4)}</b></div>`).join("")}</div>
    <div class="meta small">Comparable: ${dir.length ? esc(dir.join(", ")) : "none"}${gaps.length ? " · Gaps: " + esc(gaps.join(", ")) : ""}</div>
    <footer class="row"><button class="btn-sm" data-a3="go" data-to="target" data-id="${t.id}">Open</button>
      <button class="btn-sm${on ? " on" : ""}" data-a3="toggle" data-id="${t.id}" aria-pressed="${on}">${on ? "Selected" : "Select to compare"}</button>
      ${ATL.eligibility(t, S.critIds).ok ? `<button class="btn-sm" data-a3="go" data-to="workflow" data-id="${t.id}">Workflow</button>` : `<span class="meta">Not rankable (L${t.readiness.level})</span>`}</footer></article>`;
}
A3_VIEWS.catalog = function () {  // Phase IV: readiness model 3 (L1–L4); catalogue-only locations live in the hierarchical atlas
  const A = A3.atlas, all = A.targets.filter(t => t.body === A3.body), shown = A.targets.filter(atMatches);
  const lv = [1, 2, 3, 4].map(l => all.filter(t => t.readiness.level === l).length);
  let h = `<div class="sec"><h3 class="ttl">Planetary target atlas</h3>${atBanner("catalogue")}
    <p class="note">${A.targets.length} catalogued targets on Mars and the Moon, each with a verified location, a fingerprint whose every value carries a status, and a readiness level. Values come only from mission data processed by documented scripts; nothing is copied from the baseline targets or estimated.</p>
    <div class="lab-form"><span class="toggles" role="group" aria-label="Body">${["Mars", "Moon"].map(b => `<button aria-pressed="${A3.body === b}" data-a3="body" data-b="${b}">${b}</button>`).join("")}</span>
      <label class="wide">Search<input type="text" data-a3live="q" value="${esc(A3.q)}" placeholder="name, feature, mission…" aria-label="Search targets"></label>
      <label>Kind<select data-a3in="kind"><option value="all">all kinds</option>${Object.keys(A.kinds).map(k => `<option value="${k}" ${A3.kind === k ? "selected" : ""}>${esc(k.replace("_", " "))}</option>`).join("")}</select></label>
      <label>Minimum readiness<select data-a3in="minlvl">${[1, 2, 3, 4].map(l => `<option value="${l}" ${A3.minLevel === l ? "selected" : ""}>L${l}+</option>`).join("")}</select></label></div>
    <div class="row meta">${A3.body}: ${all.length} targets · ${lv.map((n, k) => `L${k + 1} ${n}`).join(" · ")} · showing ${shown.length}</div></div>
    <div class="sec">${atPlanetMap(A3.body, shown, { selected: A3.sel, active: A3.active })}</div>`;
  if (A3.sel.length) {
    h += `<div class="sec at-selbar"><div class="lbl">Selected for comparison (${A3.sel.length})</div><div class="row">${A3.sel.map(id => `<span class="tag">${esc(atT(id).name)} <button class="lnk" data-a3="toggle" data-id="${id}" aria-label="Remove">×</button></span>`).join("")}
      <button class="btn-sm" data-a3="go" data-to="compare" ${A3.sel.length < 1 ? "disabled" : ""}>Compare ${A3.sel.length}</button><button class="btn-sm" data-a3="selclear">Clear</button><button class="btn-sm" data-a3="selexample">Example: Gale · Elysium · Shackleton</button></div></div>`;
  } else h += `<div class="sec"><div class="row"><span class="meta">Select two or more targets to compare them.</span><button class="btn-sm" data-a3="selexample">Example: Gale · Elysium · Shackleton</button></div></div>`;
  h += `<div class="sec"><div class="at-cards">${shown.map(atCard).join("") || `<div class="empty">No target matches the filters.</div>`}</div></div>
    <div class="sec"><div class="lbl">Readiness levels</div><div class="tbl-wrap"><table class="t"><tbody>${Object.entries(A.readiness_levels).map(([k, v]) => `<tr><td><span class="lvl lvl-${k}">L${k}</span></td><td>${esc(v.label)}</td><td class="meta">${esc(v.meaning)}</td></tr>`).join("")}</tbody></table></div>
    <p class="note small">${esc(A.readiness_rule)}</p></div>`;
  return h;
};
Object.assign(A3_ACTIONS, {
  body(a) { A3.body = a.dataset.b; atRender(); },
  selclear() { A3.sel = []; atRender(); },
  selexample() { A3.sel = ["mars_gale_curiosity", "mars_elysium_planitia", "moon_shackleton"].filter(atT); A3.view = "compare"; atRender(); },
});
Object.assign(A3_INPUTS, {
  q(a) { A3.q = a.value; clearTimeout(A3._qt); A3._qt = setTimeout(() => { const p = a.selectionStart; atRender(); const n = $('[data-a3live="q"]'); if (n) { n.focus(); n.setSelectionRange(p, p); } }, 160); },
  kind(a) { A3.kind = a.value; atRender(); },
  minlvl(a) { A3.minLevel = +a.value; atRender(); },
});
