/* ===== Phase III · Planetary Research Observatory — core (state, data, router, shared widgets) =====
 * Integration with the baseline app and the Phase II laboratory is limited to:
 *   1. one extra tab button ("Atlas") appended at runtime to the existing tab bar;
 *   2. a wrapper around renderLeft() that renders the Atlas workspace when S.tab === "atlas" and
 *      otherwise calls the previous renderLeft (Phase II wrapper → baseline) unchanged.
 * The baseline state (S.*) and the Phase II state (L.*) are read, never written, except through the
 * existing public action select() when the user explicitly opens a candidate in the baseline views. */
const ATL = window.AsterroAtlas;
const A3 = {
  view: "catalog", atlas: null, err: null, loading: false, grids: null, gridErr: null, sub: null, subErr: null,
  body: "Mars", q: "", kind: "all", minLevel: 1, sel: [], active: null, cand: {}, profile: "general",
  includeProxy: false, norm: "target", cache: new Map(), stab: {}, busy: null, records: [], workflow: {},
  imgs: {}, draw: [], copilot: { q: "", log: [] },
};
const A3_VIEWS = {};
const A3_ACTIONS = {};
const A3_INPUTS = {};
const A3_NAV = [
  { id: "catalog", label: "Atlas" }, { id: "target", label: "Target" }, { id: "compare", label: "Compare" },
  { id: "workflow", label: "Workflow" }, { id: "extremes", label: "Extremes" }, { id: "landing", label: "Terrain" },
  { id: "counter", label: "Counterfactual" }, { id: "mismatch", label: "Mismatch" }, { id: "translate", label: "Translator" },
  { id: "expedition", label: "Expedition" }, { id: "constellation", label: "Constellation" }, { id: "copilot", label: "Copilot" },
  { id: "records", label: "Records" }, { id: "provenance", label: "Provenance" },
];

/* ---------- data (lazy, checksummed) ---------- */
async function atSha(buf) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buf)), b => b.toString(16).padStart(2, "0")).join("");
}
async function atLoad() {
  if (A3.atlas || A3.err || A3.loading) return A3.atlas;
  A3.loading = true;
  try {
    const r = await fetch("data/phase3/atlas.json"); if (!r.ok) throw new Error("data/phase3/atlas.json → HTTP " + r.status);
    const a = await r.json();
    if (a.stack_sha256 !== S.app.stack.sha256) throw new Error("The atlas was built for a different predictor stack (" + a.stack_sha256.slice(0, 12) + "…).");
    a.byId = Object.fromEntries(a.targets.map(t => [t.id, t]));
    A3.atlas = a;
    if (!A3.active) A3.active = "mars_gale_curiosity";
  } catch (e) { A3.err = e.message; }
  A3.loading = false; atRender();
  return A3.atlas;
}
async function atB64(file, sha) {
  const r = await fetch("data/phase3/" + file); if (!r.ok) throw new Error(file + " → HTTP " + r.status);
  const bs = atob((await r.text()).trim()), u8 = new Uint8Array(bs.length);
  for (let k = 0; k < bs.length; k++) u8[k] = bs.charCodeAt(k);
  if ((await atSha(u8.buffer)) !== sha) throw new Error(file + ": checksum mismatch; data not used.");
  return u8;
}
async function atGrids() {
  if (A3.grids || A3.gridErr) return A3.grids;
  const a = await atLoad(); if (!a) return null;
  try {
    const F = a.files.grids, u8 = await atB64(F.file, F.sha256), G = {};
    for (const Ly of F.layout) (G[Ly.target] = G[Ly.target] || {})[Ly.name] = new Float32Array(u8.buffer, Ly.offset, Ly.length);
    A3.grids = G;
  } catch (e) { A3.gridErr = e.message; }
  atRender(); return A3.grids;
}
async function atSubcell() {
  if (A3.sub || A3.subErr) return A3.sub;
  const a = await atLoad(); if (!a) return null;
  if (!a.files.subcell) { A3.subErr = "Earth sub-cell data not present in this build."; return null; }
  try {
    const F = a.files.subcell, u8 = await atB64(F.file, F.sha256), out = {};
    const TA = { uint8: Uint8Array, u1: Uint8Array, uint16: Uint16Array, u2: Uint16Array };
    for (const Ly of F.layout) out[Ly.name] = Object.assign(new (TA[Ly.dtype] || Uint16Array)(u8.buffer, Ly.offset, Ly.length), { meta: Ly });
    A3.sub = out;
  } catch (e) { A3.subErr = e.message; }
  atRender(); return A3.sub;
}
function atSubVal(name, i) {
  const a = A3.sub[name], m = a.meta, v = a[i];
  if (m.missing != null && v === m.missing) return NaN;
  return v * m.scale;
}

/* ---------- shared analytical context ---------- */
const AT_PROFILE_NOTE = "Editorial weightings, not empirically fitted (same table as the baseline).";
function atT(id) { return A3.atlas && A3.atlas.byId[id]; }
function atWeights() { return { ...S.app.profiles[A3.profile].weights }; }
function atRanges(t) {
  return ATL.rangesFor(A3.norm, { A: S.A, critIds: S.critIds, atlas: A3.atlas, baselineRanges: S.app.ranges,
    tv: t ? ATL.targetVector(t, S.critIds, { includeProxy: A3.includeProxy }) : null });
}
function atKey(t, extra = "") { return [t.id, A3.profile, A3.norm, A3.includeProxy ? 1 : 0, extra].join("|"); }
function atCands(t, n = 20) {
  const k = atKey(t, n);
  if (!A3.cache.has(k)) {
    const ranges = atRanges(t);
    let r;
    try { r = ATL.candidates({ A: S.A, cell: S.cell, lat: S.lat, lon: S.lon, critIds: S.critIds, t, ranges, w: atWeights(), n, includeProxy: A3.includeProxy }); }
    catch (e) { r = { eligible: false, reason: e.message, mode: "none" }; }
    r.ranges = ranges; r.targetId = t.id;
    A3.cache.set(k, r);
  }
  return A3.cache.get(k);
}
function atCtxLine() {
  const P = S.app.profiles[A3.profile];
  return `<div class="at-ctx"><span>Profile <b>${esc(P.label)}</b></span><span>Normalisation <b>${esc(A3_NORM_LABEL[A3.norm])}</b></span><span>Proxy criteria <b>${A3.includeProxy ? "included" : "excluded"}</b></span><span>Score type <b>atlas comparison score</b> (not the baseline Analogue Score)</span></div>`;
}
const A3_NORM_LABEL = { target: "Earth ∪ this target (default)", atlas: "Catalogue table (Earth ∪ all targets)", baseline: "Baseline table", earth: "Earth only" };

/* ---------- shared widgets ---------- */
const AT_ST_CLASS = { DIRECT: "st-d", DERIVED: "st-v", PROXY: "st-p", MISSING: "st-m", INCOMPATIBLE: "st-x", UNVALIDATED: "st-u" };
function atStatus(s) { return `<span class="st ${AT_ST_CLASS[s] || ""}" title="${esc(A3.atlas ? A3.atlas.statuses[s] : s)}">${esc(s)}</span>`; }
function atLevel(t) {
  const l = t.readiness.level;
  return `<span class="lvl lvl-${l}" title="${esc(t.readiness.meaning)}">L${l} · ${esc(t.readiness.label)}</span>`;
}
function atKind(k) { return `<span class="tag" title="${esc(A3.atlas.kinds[k])}">${esc(k.replace("_", " "))}</span>`; }
function atVal(c, v) { return v == null || v !== v ? "—" : fmtVal(c, v) + (unitOf(c) ? " " + unitOf(c) : ""); }
function atFmtLL(lat, lon) { return `${fmtLat(lat)} ${fmtLon(lon)}`; }
function atBanner(kind = "exploratory analysis") {
  return `<div class="lab-banner"><b>PHASE III</b>${esc(kind)} · beside the baseline engine · never changes the baseline Analogue Score, weights, ranges or ranking</div>`;
}
function atFingerprint(t, { compact = false } = {}) {
  const rows = S.critIds.map(c => `<tr><td>${esc(labelOf(c))}</td><td class="n">${t.status[c] === "PROXY" ? `<span class="meta">${atVal(c, t.values[c])}</span>` : atVal(c, t.values[c])}</td><td>${atStatus(t.status[c])}</td>${compact ? "" : `<td class="meta small">${esc(t.status_reason[c] || "")}</td>`}</tr>`).join("");
  return `<div class="tbl-wrap"><table class="t at-fp"><thead><tr><th>Criterion</th><th class="n">Value</th><th>Status</th>${compact ? "" : "<th>Basis</th>"}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function atClaims(t) {
  const out = [];
  for (const c of S.critIds) {
    const s = t.status[c], prov = (t.provenance[c] || []).map(p => "dataset:" + p);
    const base = { id: `${t.id}.${c}`, text: `${t.name} — ${labelOf(c)}: ${s === "DIRECT" || s === "PROXY" ? atVal(c, t.values[c]) : "no value"} (${s}). ${t.status_reason[c] || ""}` };
    if (s === "DIRECT") out.push(LAB.claim({ ...base, category: "DERIVED", method: A3.atlas.compatibility[c].planet, provenance: prov.length ? prov : ["atlas.json"],
      limitations: [A3.atlas.compatibility[c].why] }));
    else if (s === "PROXY") out.push(LAB.claim({ ...base, category: "ASSUMED", limitations: [A3.atlas.compatibility[c].why] }));
    else if (s === "UNVALIDATED") out.push(LAB.claim({ ...base, category: "UNVALIDATED", completeness: "partial", limitations: ["Not used for scoring."] }));
    else out.push(LAB.claim({ ...base, category: "UNAVAILABLE", completeness: "none" }));
  }
  out.push(LAB.claim({ id: t.id + ".location", text: `Location ${atFmtLL(t.anchor.lat, t.anchor.lon)} (${t.anchor.type}). ${t.anchor.source || ""}`,
    category: t.anchor.secondary_source ? "UNVALIDATED" : "MEASURED", completeness: t.anchor.secondary_source ? "partial" : "complete",
    provenance: [t.anchor.source || "catalogue"], limitations: t.anchor.secondary_source ? ["Coordinate from a secondary source (Wikipedia); not checked against a primary mission archive."] : [] }));
  return out;
}
function atBusyBar() {
  if (!A3.busy) return "";
  const b = A3.busy, f = b.total ? b.done / b.total : 0;
  return `<div class="lab-busy"><div class="row"><span class="meta">${esc(b.label)}</span><span class="meta">${b.done}/${b.total}</span></div><div class="bar"><i style="width:${(100 * f).toFixed(1)}%"></i></div></div>`;
}
function atNeed() {
  if (!S.app) return `<div class="sec"><div class="empty">Loading…</div></div>`;
  if (A3.err) return `<div class="sec"><div class="callout">The Planetary Target Atlas is unavailable: ${esc(A3.err)} The baseline application is unaffected.</div></div>`;
  if (!A3.atlas) return `<div class="sec"><div class="empty">Loading the Planetary Target Atlas…</div></div>`;
  return null;
}
function atTargetPicker(cur, action = "at-active", filter = null) {
  const ts = A3.atlas.targets.filter(t => !filter || filter(t));
  return `<select data-a3in="${action}" aria-label="Target">${["Mars", "Moon"].map(b => `<optgroup label="${b}">${ts.filter(t => t.body === b).map(t => `<option value="${t.id}" ${t.id === cur ? "selected" : ""}>${esc(t.name)} — L${t.readiness.level}</option>`).join("")}</optgroup>`).join("")}</select>`;
}
function atControls() {
  return `<div class="lab-form at-controls">
    <label>Weighting profile<select data-a3in="profile">${Object.entries(S.app.profiles).map(([k, p]) => `<option value="${k}" ${k === A3.profile ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select></label>
    <label>Normalisation<select data-a3in="norm">${Object.entries(A3_NORM_LABEL).map(([k, v]) => `<option value="${k}" ${k === A3.norm ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
    <label class="ck"><input type="checkbox" data-a3in="proxy" ${A3.includeProxy ? "checked" : ""}> include proxy criteria</label></div>`;
}

/* ---------- maps ---------- */
/* Planetary map: equirectangular basemap (MOLA / LOLA shaded relief, context only) + target markers. */
function atPlanetMap(body, targets, { w = 720, h = 360, selected = [], active = null } = {}) {
  const F = A3.atlas.files["basemap_" + body.toLowerCase()];
  const X = lon => (lon + 180) / 360 * w, Y = lat => (90 - lat) / 180 * h;
  const grat = [-120, -60, 0, 60, 120].map(l => `<line x1="${X(l)}" x2="${X(l)}" y1="0" y2="${h}" class="grat"/>`).join("") +
    [-60, -30, 0, 30, 60].map(l => `<line x1="0" x2="${w}" y1="${Y(l)}" y2="${Y(l)}" class="grat"/>`).join("");
  const mk = targets.map(t => {
    const x = X(t.anchor.lon), y = Y(t.anchor.lat), on = selected.includes(t.id), act = t.id === active;
    return `<g class="atmk lvl-${t.readiness.level}${on ? " on" : ""}${act ? " act" : ""}" data-a3="pick" data-id="${t.id}" tabindex="0" role="button" aria-label="${esc(t.name)}, readiness level ${t.readiness.level}">
      <circle cx="${x}" cy="${y}" r="${act ? 7 : 5}"/><text x="${x > w - 150 ? x - 8 : x + 8}" y="${y + 3}" text-anchor="${x > w - 150 ? "end" : "start"}">${esc(t.name.split(" (")[0].split(" — ")[0].replace(/ Crater$/, ""))}</text><title>${esc(t.name)} · ${atFmtLL(t.anchor.lat, t.anchor.lon)} · L${t.readiness.level}</title></g>`;
  }).join("");
  return `<figure class="at-map"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${body} map with ${targets.length} catalogued targets">
    ${F ? `<image href="data/phase3/${F.file}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" opacity=".9"/>` : `<rect width="${w}" height="${h}" fill="var(--panel-2)"/>`}
    ${grat}${mk}</svg>
    <figcaption class="meta">${F ? `Shaded relief from ${esc(F.source.product_id)} (context only, never compared). Equirectangular, 0° E centred.` : "Basemap unavailable."} Marker fill = readiness level.</figcaption></figure>`;
}
/* Earth map: Blue Marble (context) + optional score field + labelled candidates.
 * items: [{ i, label, title, cls }] (cell indices into the stack arrays). */
function atEarthMap(id, items, { w = 720, h = 360, field = null } = {}) {
  const X = lon => (lon + 180) / 360 * w, Y = lat => (90 - lat) / 180 * h;
  const mk = items.map(o => `<g class="emk ${o.cls || ""}" data-a3="cand" data-i="${o.i}" data-t="${o.t || ""}" tabindex="0" role="button" aria-label="${esc(o.title || placeStr(o.i))}"><circle cx="${X(S.lon[o.i]).toFixed(1)}" cy="${Y(S.lat[o.i]).toFixed(1)}" r="${String(o.label).length > 2 ? 8 : 6.5}"/><text x="${X(S.lon[o.i]).toFixed(1)}" y="${(Y(S.lat[o.i]) + 3).toFixed(1)}" text-anchor="middle">${esc(o.label)}</text><title>${esc(o.title || placeStr(o.i))}</title></g>`).join("");
  if (field) A3.draw.push(() => atDrawField(id, field, w, h));
  return `<figure class="at-map"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Earth map with ${items.length} candidates">
    <image href="data/bluemarble_2048.jpg" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" opacity=".55"/>
    <image id="${id}-field" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none"/>${mk}</svg></figure>`;
}
function atDrawField(id, eff, w, h) {
  const img = document.getElementById(id + "-field"); if (!img) return;
  const c = document.createElement("canvas"); c.width = 576; c.height = 361;
  const g = c.getContext("2d"), D = g.createImageData(576, 361);
  const rgb = getComputedStyle($("#app")).getPropertyValue("--accent").trim() || "#E0874F";
  const hx = rgb.replace("#", ""), R = parseInt(hx.slice(0, 2), 16), G = parseInt(hx.slice(2, 4), 16), B = parseInt(hx.slice(4, 6), 16);
  for (let i = 0; i < eff.length; i++) {
    const v = eff[i]; if (!(v >= 0)) continue;
    const cl = S.cell[i], row = 360 - Math.floor(cl / 576), col = cl % 576, p = (row * 576 + col) * 4;
    D.data[p] = R; D.data[p + 1] = G; D.data[p + 2] = B; D.data[p + 3] = Math.round(255 * Math.pow(v, 3) * 0.9);
  }
  g.putImageData(D, 0, 0);
  img.setAttribute("href", c.toDataURL());
}
/* 60x60 window rasters (terrain hillshade / slope / thermal) drawn after render */
function atRaster(id, arr, kind, px = 3) {
  A3.draw.push(() => {
    const c = document.getElementById(id); if (!c || !arr) return;
    const g = c.getContext("2d"), D = g.createImageData(60, 60), b = ATL.BIN_M;
    let lo = Infinity, hi = -Infinity;
    for (const v of arr) if (v === v) { if (v < lo) lo = v; if (v > hi) hi = v; }
    for (let r = 0; r < 60; r++) for (let q = 0; q < 60; q++) {
      const k = r * 60 + q, v = arr[k], p = k * 4;
      if (v !== v) { D.data[p] = 40; D.data[p + 1] = 20; D.data[p + 2] = 20; D.data[p + 3] = 255; continue; }
      let s;
      if (kind === "hill") {
        const zl = arr[r * 60 + Math.max(0, q - 1)], zr = arr[r * 60 + Math.min(59, q + 1)], zu = arr[Math.max(0, r - 1) * 60 + q], zd = arr[Math.min(59, r + 1) * 60 + q];
        const dzdx = ((zr === zr ? zr : v) - (zl === zl ? zl : v)) / (2 * b), dzdy = ((zu === zu ? zu : v) - (zd === zd ? zd : v)) / (2 * b);
        const sl = Math.atan(Math.hypot(dzdx, dzdy)), as = Math.atan2(dzdy, -dzdx), z = Math.PI / 4, az = 5.497787;
        s = Math.max(0, Math.cos(z) * Math.cos(sl) + Math.sin(z) * Math.sin(sl) * Math.cos(az - as));
        const tint = hi > lo ? (v - lo) / (hi - lo) : 0.5; s = 0.75 * s + 0.25 * tint;
        D.data[p] = D.data[p + 1] = D.data[p + 2] = Math.round(255 * s);
      } else {
        s = kind === "slope" ? Math.min(1, v / 30) : (hi > lo ? (v - lo) / (hi - lo) : 0.5);
        const ramp = kind === "slope" ? [[22, 30, 36], [216, 180, 91], [217, 112, 95]] : [[30, 40, 70], [127, 179, 174], [230, 233, 236]];
        const [a0, a1, a2] = ramp, m = s < 0.5 ? [a0, a1, s * 2] : [a1, a2, (s - 0.5) * 2];
        for (let j = 0; j < 3; j++) D.data[p + j] = Math.round(m[0][j] + (m[1][j] - m[0][j]) * m[2]);
      }
      D.data[p + 3] = 255;
    }
    const t = document.createElement("canvas"); t.width = 60; t.height = 60; t.getContext("2d").putImageData(D, 0, 0);
    g.imageSmoothingEnabled = false; g.drawImage(t, 0, 0, 60 * px, 60 * px);
  });
  return `<canvas id="${id}" width="${60 * px}" height="${60 * px}" class="at-raster" role="img" aria-label="${esc(kind)} map of the 55.6 km window"></canvas>`;
}

/* ---------- router ---------- */
function atRender() { if (S.tab === "atlas") renderLeft(); }
function viewAtlas() {
  const nav = `<div class="lab-nav" role="tablist" aria-label="Atlas modules">${A3_NAV.map(m => `<button role="tab" aria-selected="${A3.view === m.id}" data-a3view="${m.id}">${esc(m.label)}</button>`).join("")}</div>`;
  let body = atNeed();
  if (!body) {
    const v = A3_VIEWS[A3.view] || A3_VIEWS.catalog;
    try { body = v(); } catch (e) { console.error(e); body = `<div class="sec"><div class="callout">This module failed: ${esc(e.message)}. The baseline application is unaffected.</div></div>`; }
  }
  const t = A3.atlas && atT(A3.active);
  return `<div class="sec lab-head"><div class="lbl">Phase III · Planetary research observatory<span class="n">${t ? esc(t.name) + " · L" + t.readiness.level : ""}${A3.sel.length ? " · " + A3.sel.length + " selected" : ""}</span></div>${nav}</div>${atBusyBar()}${body}`;
}
const _p2RenderLeft = renderLeft;
renderLeft = function () {
  if (S.tab !== "atlas") return _p2RenderLeft.apply(this, arguments);
  const box = $("#left"), top = box.scrollTop;
  A3.draw = [];
  box.innerHTML = S.app ? viewAtlas() : "";
  box.scrollTop = top;
  $("#app").classList.add("wide");
  for (const f of A3.draw) { try { f(); } catch (e) { console.error(e); } }
  if (S.app && !A3.atlas && !A3.err) atLoad();
};
(function addAtlasTab() {
  const nav = $(".tabs"); if (!nav || $("#tab-atlas")) return;
  const b = document.createElement("button");
  b.setAttribute("role", "tab"); b.dataset.tab = "atlas"; b.id = "tab-atlas"; b.textContent = "Atlas";
  b.title = "Phase III planetary target atlas and research observatory (beside the baseline)";
  nav.appendChild(b);
})();

/* ---------- events (delegated, namespaced data-a3* attributes only) ---------- */
document.addEventListener("click", e => {
  const m = e.target.closest("[data-a3view]");
  if (m) { A3.view = m.dataset.a3view; $("#left").scrollTop = 0; atRender(); return; }
  const a = e.target.closest("[data-a3]"); if (!a) return;
  const fn = A3_ACTIONS[a.dataset.a3]; if (fn) { e.preventDefault(); fn(a, e); }
});
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const a = e.target.closest && e.target.closest("g[data-a3]"); if (!a) return;
  const fn = A3_ACTIONS[a.dataset.a3]; if (fn) { e.preventDefault(); fn(a, e); }
});
document.addEventListener("change", e => {
  const a = e.target.closest("[data-a3in]"); if (!a) return;
  const fn = A3_INPUTS[a.dataset.a3in]; if (fn) fn(a, e);
});
document.addEventListener("input", e => {
  const a = e.target.closest("[data-a3live]"); if (!a) return;
  const fn = A3_INPUTS[a.dataset.a3live]; if (fn) fn(a, e);
});
Object.assign(A3_ACTIONS, {
  go(a) { A3.view = a.dataset.to; if (a.dataset.id) A3.active = a.dataset.id; $("#left").scrollTop = 0; atRender(); },
  pick(a) { A3.active = a.dataset.id; if (A3.view === "catalog") { atRender(); return; } A3.view = "target"; atRender(); },
  toggle(a) { const id = a.dataset.id, k = A3.sel.indexOf(id); if (k >= 0) A3.sel.splice(k, 1); else A3.sel.push(id); atRender(); },
  cand(a) { const tid = a.dataset.t || A3.active; if (atT(tid)) { A3.active = tid; A3.cand[tid] = +a.dataset.i; } atRender(); },
  baseline(a) { const i = +a.dataset.i; if (i >= 0) { select(i, true); } },
  cancel() { if (A3.busy) A3.busy.cancel = true; },
});
Object.assign(A3_INPUTS, {
  "at-active"(a) { A3.active = a.value; atRender(); },
  profile(a) { A3.profile = a.value; atRender(); },
  norm(a) { A3.norm = a.value; atRender(); },
  proxy(a) { A3.includeProxy = a.checked; atRender(); },
});
