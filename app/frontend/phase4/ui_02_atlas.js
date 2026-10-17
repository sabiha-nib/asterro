/* ===== Phase IV · Hierarchical Planetary Atlas =====
 * body → region → named feature / reference area → analytical target → datasets → readiness.
 * Every location shows its readiness and the checks behind it; actions that the data cannot support are
 * shown disabled with the reason. A catalogued entry (L1) never receives a similarity score. */
const A4_ACTIONS = {}, A4_INPUTS = {};
const A4_MODES = [["browse", "Browse"], ["regions", "Regions"], ["list", "List"], ["table", "Table"]];
const A4_SORTS = [["readiness", "Readiness"], ["name", "Name"], ["region", "Region"], ["targets", "Targets"], ["latitude", "Latitude (N→S)"], ["longitude", "Longitude (W→E)"]];

function a4Filter() {
  const f = A4.f;
  return RG.sortLocations(RG.filterLocations(A4.ix, { body: A4.body, region: A4.mode === "browse" ? null : A4.region, q: A4.mode === "browse" ? "" : A4.q,
    level: f.level, mission: f.mission || null, dataset: f.dataset || null, type: f.type || null, ftype: f.ftype || null, analytical: f.analytical || null }), A4.sort);
}
function a4Thumb(l, size = 96) {
  const t = l.target_ids.map(a4T).find(x => x && x.thumbnail);
  return t ? `<figure class="p4-th" style="width:${size}px"><img src="${esc(t.thumbnail)}" width="${size}" height="${size}" alt="Shaded relief of the 55.6 km analysis window (${esc(t.name)})" loading="lazy"><figcaption>${esc(t.body.id === "mars" ? "MOLA" : "LOLA")} relief · real data</figcaption></figure>`
    : `<figure class="p4-th none" style="width:${size}px;height:${size}px" aria-label="No imagery in this build"><span>No imagery<br>in this build</span></figure>`;
}
function a4Ll(l) { return atFmtLL(l.latitude, l.longitude_east); }
function a4Star(id) { const on = A4P.fav.includes(id); return `<button class="p4-star" data-a4="fav" data-id="${esc(id)}" aria-pressed="${on}" aria-label="${on ? "Remove from" : "Add to"} favourites" title="Favourite">${on ? "★" : "☆"}</button>`; }

/* ---------- location map (basemap = context only) ---------- */
function a4LocMap(body, locs, { w = 720, h = 360 } = {}) {
  const F = A3.atlas.files["basemap_" + body], X = lon => (lon + 180) / 360 * w, Y = lat => (90 - lat) / 180 * h;
  const mk = locs.map(l => {
    const x = X(l.longitude_east), y = Y(l.latitude), act = l.id === A4.loc, k = l.readiness.level;
    return `<g class="p4mk lvl-${k}${act ? " act" : ""}" data-a4="loc" data-id="${esc(l.id)}" tabindex="-1" role="button" aria-label="${esc(l.name)}, readiness L${k}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${act ? 7 : k > 1 ? 4.5 : 3.2}"/>${act || k >= 2 ? `<text x="${(x > w - 140 ? x - 8 : x + 8).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="${x > w - 140 ? "end" : "start"}">${esc(l.name)}</text>` : ""}<title>${esc(l.name)} · ${a4Ll(l)} · L${k}</title></g>`;
  }).join("");
  return `<figure class="at-map p4-map"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${body === "mars" ? "Mars" : "Moon"} map with ${locs.length} locations; marker size and fill show readiness">
    ${F ? `<image href="data/phase3/${F.file}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" opacity=".85"/>` : `<rect width="${w}" height="${h}" fill="var(--panel-2)"/>`}${mk}</svg>
    <figcaption class="meta">${F ? `Shaded relief from ${esc(F.source.product_id)} — context only, never compared.` : "Basemap unavailable."} Filled = analytical target (L2–L4), small hollow = catalogued only (L1). Use the tree or the list for keyboard access.</figcaption></figure>`;
}

/* ---------- keyboard tree ---------- */
function a4Tree() {
  const regs = A4.reg.regions.filter(r => r.body === A4.body);
  const item = (id, label, level, kids, extra = "") => {
    const open = !!A4.tree[id], has = kids != null;
    return `<li role="treeitem" id="tr-${esc(id.replace(/[^a-z0-9_-]/gi, "_"))}" data-tid="${esc(id)}" aria-level="${level}" ${has ? `aria-expanded="${open}"` : ""} aria-selected="${A4.loc === id}" tabindex="${A4.loc === id || (!A4.loc && level === 1) ? 0 : -1}"><span class="p4-tn">${has ? `<i aria-hidden="true">${open ? "▾" : "▸"}</i>` : `<i aria-hidden="true">·</i>`}${label}${extra}</span>${has && open ? `<ul role="group">${kids}</ul>` : ""}</li>`;
  };
  const html = regs.map(r => item(r.id, esc(r.name), 1, r.location_ids.map(lid => {
    const l = a4L(lid);
    const tk = l.target_ids.map(t => { const T = a4T(t); return item("t:" + t, esc(T.name), 3, null, ` <span class="lvl lvl-${T.readiness.level}">L${T.readiness.level}</span>`); }).join("");
    return item(lid, esc(l.name), 2, l.target_ids.length ? tk : null, ` <span class="lvl lvl-${l.readiness.level}">L${l.readiness.level}</span>`);
  }).join(""), ` <span class="meta">${r.counts.locations} · ${r.counts.targets}t</span>`)).join("");
  return `<ul class="p4-tree" role="tree" aria-label="${A4.body === "mars" ? "Mars" : "Moon"}: regions, locations and analytical targets">${html}</ul>`;
}
function a4TreeKey(e) {
  const it = e.target.closest('[role="treeitem"]'); if (!it) return;
  const all = $$('.p4-tree [role="treeitem"]').filter(x => x.offsetParent !== null), k = all.indexOf(it), id = it.dataset.tid;
  const focus = x => { if (!x) return; all.forEach(y => y.tabIndex = -1); x.tabIndex = 0; x.focus(); };
  const exp = it.getAttribute("aria-expanded");
  if (e.key === "ArrowDown") focus(all[k + 1]);
  else if (e.key === "ArrowUp") focus(all[k - 1]);
  else if (e.key === "Home") focus(all[0]);
  else if (e.key === "End") focus(all[all.length - 1]);
  else if (e.key === "ArrowRight") { if (exp === "false") { A4.tree[id] = true; a4RenderKeep(id); } else if (exp === "true") focus(all[k + 1]); }
  else if (e.key === "ArrowLeft") { if (exp === "true") { A4.tree[id] = false; a4RenderKeep(id); } else { const p = it.parentElement.closest('[role="treeitem"]'); focus(p); } }
  else if (e.key === "Enter" || e.key === " ") a4TreeSelect(id, true);
  else return;
  e.preventDefault();
}
function a4TreeSelect(id, keep) {
  if (id.startsWith("t:")) { const t = id.slice(2); a4SyncFromTarget(t); A3.active = t; }
  else if (id.startsWith("region:")) { A4.tree[id] = !A4.tree[id]; A4.region = id; }
  else { a4SyncFromLocation(id); if (a4L(id).target_ids.length) A4.tree[id] = true; announce(`${a4L(id).name}: readiness L${a4L(id).readiness.level}.`); }
  keep ? a4RenderKeep(id) : atRender();
}
function a4RenderKeep(id) {
  atRender();
  const el = document.querySelector(`.p4-tree [data-tid="${CSS.escape(id)}"]`);
  if (el) { $$('.p4-tree [role="treeitem"]').forEach(y => y.tabIndex = -1); el.tabIndex = 0; el.focus(); }
}

/* ---------- search combobox (aliases, prefixes; updates its own listbox without re-rendering the page) ---------- */
function a4SearchBox() {
  return `<div class="p4-search" role="search"><label for="a4q" class="sr-only">Search the planetary atlas</label>
    <input id="a4q" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="a4sr" autocomplete="off" data-a4live="q" value="${esc(A4.q)}" placeholder="Search features, aliases, missions — e.g. Gale Crater, Shackleton, Apollo 15">
    <ul id="a4sr" role="listbox" class="p4-sr" aria-label="Search results" hidden></ul></div>`;
}
function a4SearchUpdate(inp) {
  A4.q = inp.value;
  const box = $("#a4sr"), hits = RG.search(A4.ix, A4.q, { limit: 10 });
  A4._hits = hits; A4._hi = hits.length ? 0 : -1;
  if (!A4.q.trim()) { box.hidden = true; inp.setAttribute("aria-expanded", "false"); inp.removeAttribute("aria-activedescendant"); return; }
  box.innerHTML = hits.length ? hits.map((h, k) => {
    const L = h.kind === "location" ? a4L(h.id) : null;
    return `<li role="option" id="a4sr-${k}" aria-selected="${k === 0}" data-a4="hit" data-k="${k}"><b>${esc(h.name)}</b> <span class="meta">${h.kind === "region" ? "region" : esc(L.feature_type)} · ${h.body === "mars" ? "Mars" : "Moon"}${L ? " · L" + L.readiness.level : ""} · ${esc(h.matched)}</span></li>`;
  }).join("") : `<li role="option" aria-disabled="true" class="meta">No catalogued feature matches “${esc(A4.q)}”.</li>`;
  box.hidden = false; inp.setAttribute("aria-expanded", "true");
  if (hits.length) inp.setAttribute("aria-activedescendant", "a4sr-0");
  announce(hits.length ? `${hits.length} results. Use the arrow keys, Enter to open.` : "No results.");
}
function a4SearchKey(e) {
  const hits = A4._hits || []; if (!hits.length) { if (e.key === "Escape") { e.target.value = ""; a4SearchUpdate(e.target); } return; }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    A4._hi = (A4._hi + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length;
    $$("#a4sr [role=option]").forEach((o, k) => o.setAttribute("aria-selected", k === A4._hi));
    e.target.setAttribute("aria-activedescendant", "a4sr-" + A4._hi); e.preventDefault();
  } else if (e.key === "Enter") { a4OpenHit(hits[Math.max(0, A4._hi)]); e.preventDefault(); }
  else if (e.key === "Escape") { $("#a4sr").hidden = true; e.target.setAttribute("aria-expanded", "false"); }
}
function a4OpenHit(h) {
  if (!h) return;
  A4.q = ""; A4._hits = [];
  if (h.kind === "region") { A4.body = h.body; A4.region = h.id; A4.tree[h.id] = true; A4.mode = "browse"; }
  else { a4SyncFromLocation(h.id); A4.tree[a4L(h.id).region] = true; A4.mode = "browse"; }
  atRender(); const n = $(".p4-summary h3"); if (n) { n.tabIndex = -1; n.focus(); }
}

/* ---------- selected-location summary ---------- */
function a4Summary(l) {
  if (!l) return `<div class="empty">Select a location in the tree, the map or the list.</div>`;
  const reg = A4.ix.regions[l.region], ts = l.target_ids.map(a4T);
  const qa = RG.quickActions(A4.ix, l, { exploreIds: a4ExploreIds() });
  const src = l.source || {};
  const why = ts.length ? ts.map(t => `<details class="p4-checks"><summary>${esc(t.name)} — ${a4Level(t)} · why</summary><ul>${t.readiness.checks.map(c => `<li class="${c.passed ? "ok" : "no"}"><b>${c.passed ? "✓" : "✗"} ${esc(c.id)}</b> <span class="meta">${esc(c.requirement)}</span><br><span class="small">${esc(c.detail)}</span></li>`).join("")}</ul></details>`).join("")
    : `<p class="note small">Catalogue entry: name and coordinates from the cited source; no analytical window has been assembled. Checks: ${l.readiness.checks.map(c => `${c.passed ? "✓" : "✗"} ${esc(c.id)}`).join(" · ")}.</p>`;
  const tsel = ts.find(x => x.id === A3.active) || ts[0];
  const crumbs = `<nav class="p4-crumbs" aria-label="Location in the hierarchy"><button data-a4="body" data-b="${l.body}">${l.body === "mars" ? "Mars" : "Moon"}</button><i>›</i><button data-a4="region" data-id="${reg.id}">${esc(reg.name)}</button><i>›</i><span ${tsel ? "" : 'aria-current="location"'}>${esc(l.name)}</span>${tsel ? `<i>›</i><span aria-current="location">${esc(tsel.name)}</span>` : ""}</nav>`;
  return `<article class="p4-summary" aria-label="Selected location">${crumbs}
    <div class="row p4-sh">${a4Thumb(l, 104)}<div class="grow"><div class="body-tag">${l.body === "mars" ? "MARS" : "MOON"} · ${esc(reg.name)}</div>
      <h3 class="ttl">${esc(l.name)} ${a4Star(l.id)}</h3>
      <div class="meta">${esc(l.feature_type)} · ${a4Ll(l)}${l.diameter_km ? ` · Ø ${l.diameter_km.toFixed(1)} km` : ""}${l.quadrangle ? " · " + esc(l.quadrangle) : ""}</div>
      ${l.aliases.length ? `<div class="meta">Also: ${esc(l.aliases.join(", "))}</div>` : ""}
      <div class="row">${a4Level(l)}<span class="tag">${esc(l.record_type.replace("_", " "))}</span>${l.approval ? `<span class="tag">${esc(l.approval)}</span>` : ""}</div></div></div>
    <p class="meta small">Source: ${src.url ? `<a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.type)} record</a>` : esc(src.type || "")}${src.reference ? " · " + esc(src.reference) : ""} · ${esc(l.coordinate_reference)}</p>
    <div class="p4-qa" role="group" aria-label="Actions for ${esc(l.name)}">${qa.map(a => `<button class="btn-sm" data-a4="qa" data-q="${a.id}" data-t="${esc(a.target || "")}" ${a.enabled ? "" : `disabled aria-describedby="qa-${a.id}"`}>${esc(a.label)}</button>`).join("")}</div>
    ${qa.filter(a => !a.enabled).map(a => `<p class="meta small" id="qa-${a.id}"><b>${esc(a.label)}:</b> ${esc(a.reason)}</p>`).join("")}
    ${ts.length ? `<div class="lbl">Analytical targets (${ts.length})</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Target</th><th>Readiness</th>${S.critIds.map(c => `<th title="${esc(labelOf(c))}">${esc(shortOf(c))}</th>`).join("")}<th>Datasets</th></tr></thead><tbody>
      ${ts.map(t => `<tr><td><button class="lnk" data-a4="tgt" data-id="${t.id}">${esc(t.name)}</button>${t.legacy ? ' <b class="at-base">BASELINE</b>' : ""}</td><td>${a4Level(t)}</td>${S.critIds.map(c => { const s = t.fingerprint.criterion_status[c]; return `<td class="${{ DIRECT: "st-d", PROXY: "st-p", "N/A": "st-x", MISSING: "st-m" }[s]}" title="${esc(s)}">${s === "DIRECT" ? atVal(c, t.fingerprint.variables[c]) : esc(s)}</td>`; }).join("")}<td class="small">${t.datasets.map(d => esc(d)).join(", ")}</td></tr>`).join("")}</tbody></table></div>` : ""}
    ${ts.length ? a4DataPanel(ts) : `<p class="note small"><b>Analysis support:</b> Earth-analogue analysis — no (catalogued only). Target comparison — no. Needed first: a documented terrain or environmental dataset processed into a complete 55.6 km window (readiness 2), then a complete compatible fingerprint (readiness 3).</p>`}
    <div class="lbl">Why this readiness level</div>${why}
    ${l.missions.length ? `<p class="meta small">Missions: ${l.missions.map(m => esc((A4.ix.missions[m] || {}).name || m)).join(" · ")}</p>` : ""}
    <p class="meta small">Readiness concerns data completeness and reproducibility only — not scientific validity, landing safety or habitability.</p></article>`;
}

/* ---------- data panel: what is measured, by what, at which support; what is missing; what is supported ---------- */
function a4DataPanel(ts) {
  return ts.map(t => {
    const fp = t.fingerprint, D = A4.ix.datasets;
    const rows = S.critIds.map(c => {
      const st = fp.criterion_status[c], ds = (fp.provenance[c] || []).map(d => D[d]).filter(Boolean);
      return `<tr><td>${esc(labelOf(c))}</td><td class="${{ DIRECT: "st-d", PROXY: "st-p", "N/A": "st-x", MISSING: "st-m" }[st]}">${esc(st)}</td><td class="n">${fp.variables[c] == null ? "—" : atVal(c, fp.variables[c])}</td><td class="small">${esc(fp.units[c])}</td>
        <td class="small">${ds.length ? ds.map(d => `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.product_id)}</a> · ${esc(d.provider)} · ${esc(d.original_resolution)}`).join("<br>") : st === "PROXY" ? "rule (not a measurement)" : "—"}</td>
        <td class="small">${esc(fp.spatial_support[c] || fp.missingness[c] || (st === "N/A" ? "no physical counterpart" : "—"))}${fp.temporal_support[c] ? "<br><span class=\"meta\">" + esc(fp.temporal_support[c]) + "</span>" : ""}</td></tr>`;
    }).join("");
    const sc = t.scoring, comp = t.readiness.level >= 3 ? "yes — with any target sharing a DIRECT criterion (Comparison Lab)" : "partial — shared DIRECT criteria only, labelled exploratory";
    return `<details class="p4-checks p4-data" ${t.id === A3.active ? "open" : ""}><summary>Data · ${esc(t.name)}</summary>
      <p class="small"><b>Earth-analogue analysis:</b> ${sc.earth_analogue_enabled ? `yes — ${esc(sc.default_explore)}${A4X.ids.includes(t.id) || t.legacy ? " (also in Explore)" : ""}` : `partial only — ${esc(sc.reason)}`}<br><b>Comparison with other targets:</b> ${comp}</p>
      <div class="tbl-wrap"><table class="t"><caption class="sr-only">Criteria, values, sources and support for ${esc(t.name)}</caption><thead><tr><th>Criterion</th><th>Status</th><th class="n">Value</th><th>Unit</th><th>Dataset · provider · resolution</th><th>Spatial / temporal support</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="small"><b>Window:</b> ${t.location.window_km} km centred ${atFmtLL(t.location.latitude, t.location.longitude_east)} · ${esc(t.location.relation)} · terrain ${t.terrain_window.bins_filled}/${t.terrain_window.bins_total} bins</p>
      ${t.limitations.length ? `<p class="small"><b>Limitations:</b></p><ul class="lab-ul small">${t.limitations.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      <p class="small"><b>References:</b> ${t.sources.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//, "").slice(0, 60))}</a>`).join(" · ")}</p>
      <p class="meta small">${esc(t.validation.scientific_validation)}</p></details>`;
  }).join("");
}

/* ---------- region cards / list / table ---------- */
function a4RegionCards() {
  const regs = A4.reg.regions.filter(r => r.body === A4.body);
  return `<div class="p4-regions">${regs.map(r => `<article class="p4-rc${A4.region === r.id ? " act" : ""}"><button class="p4-rcb" data-a4="region" data-id="${r.id}" aria-label="${esc(r.name)}: ${r.counts.locations} locations, ${r.counts.targets} analytical targets">
    ${r.thumbnail ? `<img src="${esc(r.thumbnail)}" alt="" width="64" height="64" loading="lazy">` : `<span class="p4-th none" style="width:64px;height:64px"><span>No imagery</span></span>`}
    <span><b>${esc(r.name)}</b><span class="meta small">${esc(r.description)}</span>
    <span class="p4-cnt"><i>${r.counts.locations} locations</i><i>${r.counts.targets} targets</i><i>${r.counts.scoring_enabled} L3+</i>${[4, 3, 2, 1].filter(k => r.counts.by_level[k]).map(k => `<i class="lvl lvl-${k}">L${k}×${r.counts.by_level[k]}</i>`).join("")}</span></span></button></article>`).join("")}</div>`;
}
function a4ListCards(locs) {
  return locs.length ? `<div class="p4-cards">${locs.map(l => `<article class="p4-card${l.id === A4.loc ? " act" : ""}">${a4Thumb(l, 72)}<div class="grow">
    <button class="lnk p4-ct" data-a4="loc" data-id="${esc(l.id)}">${esc(l.name)}</button> ${a4Star(l.id)}
    <div class="meta small">${esc(l.feature_type)} · ${a4Ll(l)} · ${esc(A4.ix.regions[l.region].name)}</div>
    <div class="row">${a4Level(l)}${l.target_ids.length ? `<span class="tag">${l.target_ids.length} target${l.target_ids.length > 1 ? "s" : ""}</span>` : `<span class="tag">catalogue only</span>`}</div></div></article>`).join("")}</div>`
    : `<div class="empty">No location matches these filters.</div>`;
}
function a4Table(locs) {
  const th = (k, label) => `<th scope="col" aria-sort="${A4.sort === k ? "descending" : "none"}"><button class="lnk" data-a4="sort" data-k="${k}">${esc(label)}</button></th>`;
  return `<div class="tbl-wrap"><table class="t p4-tbl"><caption class="sr-only">Locations on ${A4.body === "mars" ? "Mars" : "the Moon"}, sorted by ${esc(A4.sort)}</caption><thead><tr>${th("name", "Location")}${th("region", "Region")}<th scope="col">Type</th>${th("latitude", "Lat")}${th("longitude", "Lon")}${th("readiness", "Readiness")}${th("targets", "Targets")}<th scope="col">Datasets</th><th scope="col">Source</th></tr></thead><tbody>
    ${locs.map(l => `<tr${l.id === A4.loc ? ' class="act"' : ""}><td><button class="lnk" data-a4="loc" data-id="${esc(l.id)}">${esc(l.name)}</button></td><td>${esc(A4.ix.regions[l.region].name)}</td><td class="small">${esc(l.feature_type)}</td><td class="n">${l.latitude.toFixed(2)}</td><td class="n">${l.longitude_east.toFixed(2)}</td><td>${a4Level(l)}</td><td class="n">${l.target_ids.length}</td><td class="small">${Array.from(new Set(l.target_ids.flatMap(t => a4T(t).datasets))).join(", ") || "—"}</td><td class="small">${l.source.url ? `<a href="${esc(l.source.url)}" target="_blank" rel="noopener">${esc(l.source.type)}</a>` : esc(l.source.type)}</td></tr>`).join("")}</tbody></table></div>`;
}
function a4Filters() {
  const R = A4.reg, regs = R.regions.filter(r => r.body === A4.body), ms = R.missions.filter(m => m.body === A4.body);
  const ds = Array.from(new Set(R.targets.filter(t => t.body.id === A4.body).flatMap(t => t.datasets))).sort();
  const sel = (key, label, opts, cur) => `<label>${esc(label)}<select data-a4in="${key}"><option value="">any</option>${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(cur) === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
  return `<div class="lab-form p4-filters">
    ${A4.mode !== "browse" ? sel("region", "Region", regs.map(r => [r.id, r.name]), A4.region || "") : ""}
    ${sel("level", "Readiness", [1, 2, 3, 4].map(k => [k, `L${k} · ${R.readiness_model.levels[k].label.toLowerCase()}`]), A4.f.level)}
    ${sel("mission", "Mission", ms.map(m => [m.id, m.name]), A4.f.mission)}
    ${sel("dataset", "Dataset", ds.map(d => [d, d]), A4.f.dataset)}
    ${sel("ftype", "Terrain category", Array.from(new Set(R.locations.filter(l => l.body === A4.body).map(l => l.feature_type))).sort().map(v => [v, v]), A4.f.ftype)}
    ${sel("type", "Record type", [["catalog_location", "catalogue location"], ["reference_area", "reference area"]], A4.f.type)}
    ${A4.mode === "list" || A4.mode === "table" ? `<label>Sort<select data-a4in="sort">${A4_SORTS.map(([k, t]) => `<option value="${k}" ${A4.sort === k ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>` : ""}
    <label class="ck"><input type="checkbox" data-a4in="analytical" ${A4.f.analytical ? "checked" : ""}> analytical targets only</label></div>`;
}
function a4Strip(title, ids) {
  const ls = ids.map(a4L).filter(Boolean);
  if (!ls.length) return "";
  return `<div class="row p4-strip"><span class="lbl">${esc(title)}</span>${ls.map(l => `<button class="tag" data-a4="loc" data-id="${esc(l.id)}">${esc(l.name)} <span class="meta">L${l.readiness.level}</span></button>`).join("")}</div>`;
}

function a4ActiveStrip() {
  const ids = Array.from(new Set([A3.active, ...A4.cmp, ...A3.sel].filter(id => a4T(id))));
  if (!ids.length) return "";
  return `<div class="row p4-strip" role="group" aria-label="Active analytical targets"><span class="lbl">Active targets</span>${ids.map(id => { const t = a4T(id); return `<button class="tag${id === A3.active ? " on" : ""}" data-a4="tgtsw" data-id="${id}" aria-pressed="${id === A3.active}">${esc(t.name.split(" (")[0])} <span class="meta">L${t.readiness.level}</span></button>`; }).join("")}</div>`;
}
A3_VIEWS.home = function () {
  const need = a4Need(); if (need) return need;
  const R = A4.reg, c = RG.counts(A4.ix), cb = RG.counts(A4.ix, R.locations.filter(l => l.body === A4.body));
  const locs = a4Filter(), l = a4L(A4.loc);
  const lvRow = cb.byLevel.slice(1).map((n, j) => [n, j + 1]).map(([n, k]) => `<span class="lvl lvl-${k}" title="${esc(R.readiness_model.levels[k].definition)}">L${k} ${n}</span>`).join("");
  let h = `<div class="sec p4-hero"><div class="row" style="justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap">
    <div><div class="body-tag">PLANETARY ATLAS · REGISTRY ${esc(R.registry_version)}</div><h2 class="ttl p4-h">${A4.body === "mars" ? "Mars" : "The Moon"}</h2>
    <p class="note">${c.locations} catalogued locations on Mars and the Moon in ${R.regions.length} regions; ${c.targets} analytical targets, ${c.scoring} of them complete enough (readiness ≥ 3) for Earth-analogue ranking. Names and coordinates come from the IAU/USGS gazetteer or cited mission sources; values only from mission data processed by recorded scripts.</p></div>
    <span class="toggles p4-body" role="group" aria-label="Body">${[["mars", "Mars"], ["moon", "Moon"]].map(([b, t]) => `<button aria-pressed="${A4.body === b}" data-a4="body" data-b="${b}">${t}</button>`).join("")}</span></div>
    ${a4Banner("planetary atlas")}${a4SearchBox()}
    <div class="row meta p4-lv">${A4.body === "mars" ? "Mars" : "Moon"} locations by readiness: ${lvRow}</div>
    ${a4ActiveStrip()}${a4Strip("Recent", A4P.recent.filter(id => a4L(id) && a4L(id).body === A4.body).slice(0, 6))}${a4Strip("Favourites", A4P.fav.filter(id => a4L(id) && a4L(id).body === A4.body))}
    <div class="p4-modes" role="tablist" aria-label="Atlas views">${A4_MODES.map(([k, t]) => `<button role="tab" aria-selected="${A4.mode === k}" data-a4="mode" data-m="${k}">${t}</button>`).join("")}</div></div>`;
  if (A4.mode === "browse") {
    h += `<div class="sec p4-split"><div class="p4-col-tree"><div class="lbl">Regions → locations → targets</div>${a4Tree()}<p class="meta small">Arrow keys move, → expands, ← collapses, Enter selects.</p></div>
      <div class="p4-col-main">${a4LocMap(A4.body, R.locations.filter(x => x.body === A4.body))}${a4Summary(l && l.body === A4.body ? l : null)}</div></div>`;
  } else if (A4.mode === "regions") {
    h += `<div class="sec">${a4RegionCards()}</div>`;
    if (A4.region && A4.ix.regions[A4.region] && A4.ix.regions[A4.region].body === A4.body) h += `<div class="sec"><div class="lbl">${esc(A4.ix.regions[A4.region].name)} — locations</div>${a4ListCards(locs)}</div>`;
  } else {
    h += `<div class="sec">${a4Filters()}<div class="meta">Showing ${locs.length} of ${cb.locations} ${A4.body === "mars" ? "Mars" : "Moon"} locations.</div></div>
      <div class="sec">${A4.mode === "table" ? a4Table(locs) : a4ListCards(locs)}</div>`;
    if (l && l.body === A4.body) h += `<div class="sec">${a4Summary(l)}</div>`;
  }
  return h;
};

/* ---------- quick actions ---------- */
function a4Quick(q, tid) {
  const t = tid && atT(tid);
  if (q === "target" && t) { A3.active = tid; A3.view = "target"; }
  else if (q === "analogues" && t) { A3.active = tid; A3.view = "workflow"; }
  else if (q === "explore") { a4ExploreOpen(tid); return; }
  else if (q === "compare" && tid) { if (!A4.cmp.includes(tid)) A4.cmp.push(tid); if (!A3.sel.includes(tid)) A3.sel.push(tid); A3.view = "lab4"; A4.aggRes = null; }
  else if (q === "validation" && tid) { A4.val.target = tid; A4.val.res = null; A3.view = "validation"; }
  else if (q === "collection") { A4.colPending = { kind: "location", id: A4.loc }; A3.view = "collections"; }
  else if (q === "provenance") { A4.prov.focus = tid || A4.loc; A3.view = "readiness"; }
  $("#left").scrollTop = 0; atRender();
}

/* ---------- events (namespaced data-a4* attributes) ---------- */
document.addEventListener("click", e => {
  const a = e.target.closest("[data-a4]"); if (!a || a.disabled) return;
  const fn = A4_ACTIONS[a.dataset.a4]; if (fn) { e.preventDefault(); fn(a, e); }
});
document.addEventListener("change", e => { const a = e.target.closest("[data-a4in]"); if (a && A4_INPUTS[a.dataset.a4in]) A4_INPUTS[a.dataset.a4in](a, e); });
document.addEventListener("input", e => { const a = e.target.closest("[data-a4live]"); if (a && A4_INPUTS[a.dataset.a4live]) A4_INPUTS[a.dataset.a4live](a, e); });
document.addEventListener("keydown", e => {
  if (e.target && e.target.id === "a4q") return a4SearchKey(e);
  if (e.target.closest && e.target.closest(".p4-tree")) return a4TreeKey(e);
  if ((e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest("g[data-a4]")) { const g = e.target.closest("g[data-a4]"); e.preventDefault(); A4_ACTIONS[g.dataset.a4](g, e); }
});
document.addEventListener("click", e => { const t = e.target.closest(".p4-tree [role=treeitem]"); if (t && !e.target.closest("[data-a4]")) { e.stopPropagation(); a4TreeSelect(t.dataset.tid, true); } }, true);
Object.assign(A4_ACTIONS, {
  body(a) { A4.body = a.dataset.b; A4.region = null; const l = a4L(A4.loc); if (!l || l.body !== A4.body) A4.loc = A4.body === "mars" ? "mars:gale" : "moon:shackleton"; atRender(); },
  mode(a) { A4.mode = a.dataset.m; atRender(); },
  loc(a) { a4SyncFromLocation(a.dataset.id); A4.tree[a4L(a.dataset.id).region] = true; atRender(); announce(`${a4L(a.dataset.id).name} selected.`); },
  region(a) { A4.region = a.dataset.id; A4.tree[a.dataset.id] = true; atRender(); },
  tgtsw(a) { const t = a4T(a.dataset.id); a4SyncFromTarget(t.id); A3.active = t.id; A4.tree[t.region.id] = true; A4.tree[t.location.id] = true; A4.mode = "browse"; atRender(); announce(`${t.name} is the active target.`); },
  tgt(a) { a4SyncFromTarget(a.dataset.id); A3.active = a.dataset.id; A3.view = "target"; $("#left").scrollTop = 0; atRender(); },
  fav(a) { const id = a.dataset.id, k = A4P.fav.indexOf(id); if (k >= 0) A4P.fav.splice(k, 1); else A4P.fav.push(id); a4SavePrefs(); atRender(); announce(k >= 0 ? "Removed from favourites." : "Added to favourites."); },
  hit(a) { a4OpenHit((A4._hits || [])[+a.dataset.k]); },
  qa(a) { a4Quick(a.dataset.q, a.dataset.t); },
  sort(a) { A4.sort = a.dataset.k; atRender(); },
});
Object.assign(A4_INPUTS, {
  q(a) { a4SearchUpdate(a); },
  region(a) { A4.region = a.value || null; atRender(); },
  level(a) { A4.f.level = a.value; atRender(); },
  mission(a) { A4.f.mission = a.value; atRender(); },
  dataset(a) { A4.f.dataset = a.value; atRender(); },
  type(a) { A4.f.type = a.value; atRender(); },
  ftype(a) { A4.f.ftype = a.value; atRender(); },
  sort(a) { A4.sort = a.value; atRender(); },
  analytical(a) { A4.f.analytical = a.checked; atRender(); },
});
