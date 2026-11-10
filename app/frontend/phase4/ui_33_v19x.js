/* ASTERRO V19 data extension (tai-v19-data-2.0.0): offline data store, data inventory, environmental data layers.
 * Store   : IndexedDB "asterro-data" (stores: datasets, analyses). Each dataset is versioned and hashed; a copy is
 *           used only if its SHA-256 and cell order match. Refresh never deletes a valid copy before a new valid
 *           copy has been verified. Cached data are never called live: every view states where the copy came from
 *           and when the providers were queried.
 * Views   : Data (inventory with NASA / non-NASA attribution and nine states, store status, refresh, verify),
 *           Discover › Science domains and Local Impact (data layers at the cell, with provenance), saved analyses. */
const V9X = { man: null, C: null, src: null, stored: null, err: null, inv: null, vol: null, sites: null, loading: null, online: typeof navigator === "undefined" ? true : navigator.onLine, filter: { nasa: "all", state: "all" }, analyses: [], cellOk: null, msg: null };
const V9X_DB = "asterro-data", V9X_FILES = { cube: ["data/v19/env/cube.json", "data/v19/env/cube.bin"], inventory: ["data/v19/env/inventory.json"], volcanoes: ["data/v19/env/volcanoes.json"], sites: ["data/v19/env/sites.json"] };
function v9xDb() {
  return new Promise((res, rej) => { try { const r = indexedDB.open(V9X_DB, 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains("datasets")) d.createObjectStore("datasets", { keyPath: "id" }); if (!d.objectStoreNames.contains("analyses")) d.createObjectStore("analyses", { keyPath: "key" }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
}
async function v9xTx(store, mode, fn) { const d = await v9xDb(); return new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store); let out; Promise.resolve(fn(s)).then(r => { out = r; }); t.oncomplete = () => res(out); t.onerror = () => rej(t.error); }); }
const v9xReq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function v9xGet(id) { try { return await v9xTx("datasets", "readonly", s => v9xReq(s.get(id))); } catch (e) { return null; } }
async function v9xPut(rec) { try { await v9xTx("datasets", "readwrite", s => v9xReq(s.put(rec))); return true; } catch (e) { return false; } }
async function v9xAll(store) { try { return await v9xTx(store, "readonly", s => v9xReq(s.getAll())); } catch (e) { return []; } }
async function v9xCellSha() { const a = new Int32Array(S.cell.length); for (let i = 0; i < a.length; i++) a[i] = S.cell[i]; return AsterroV19X.sha256Hex(a.buffer); }
async function v9xFetch(u, kind, opts) { const r = await fetch(u, opts); if (!r.ok) throw new Error("HTTP " + r.status); return kind === "bin" ? r.arrayBuffer() : r.json(); }
/* load: network (through the service worker) first, then the IndexedDB copy; a copy is used only if it verifies */
async function v9xLoad(force) {
  if (typeof AsterroV19X === "undefined" || !S.cell) return;
  if (V9X.loading) return V9X.loading;
  V9X.loading = (async () => {
    V9X.err = null; const cellSha = V9X.cellSha || (V9X.cellSha = await v9xCellSha());
    let man = null, buf = null, src = null;
    if (V9X.online || force) {
      try {
        const o = force ? { cache: "reload" } : undefined;
        man = await v9xFetch(V9X_FILES.cube[0] + (force ? "?r=" + Date.now() : ""), "json", o); buf = await v9xFetch(V9X_FILES.cube[1] + (force ? "?r=" + Date.now() : ""), "bin", o);
        const v = await AsterroV19X.verify(man, buf, cellSha);
        if (!v.ok) { V9X.err = "verify_" + v.why; man = buf = null; } else src = "server";
      } catch (e) { man = buf = null; }
    }
    const rec = await v9xGet("cube");
    if (man && buf) {
      if (!rec || rec.sha256 !== man.sha256) await v9xPut({ id: "cube", version: man.version, sha256: man.sha256, bytes: man.bytes, manifest: man, buffer: buf, stored: new Date().toISOString(), from: "server" });
      V9X.stored = rec && rec.sha256 === man.sha256 ? rec.stored : new Date().toISOString();
    } else if (rec) {
      const v = await AsterroV19X.verify(rec.manifest, rec.buffer, cellSha);
      if (v.ok) { man = rec.manifest; buf = rec.buffer; src = "offline_store"; V9X.stored = rec.stored; } else V9X.err = "store_" + v.why;
    }
    if (man && buf) { V9X.man = man; V9X.C = AsterroV19X.create(man, buf); V9X.src = src; V9X.cellOk = true; }
    else if (!V9X.err) V9X.err = "unavailable";
    for (const k of ["inventory", "volcanoes", "sites"]) {
      let j = null;
      if (V9X.online || force) { try { j = await v9xFetch(V9X_FILES[k][0] + (force ? "?r=" + Date.now() : ""), "json", force ? { cache: "reload" } : undefined); await v9xPut({ id: k, json: j, stored: new Date().toISOString(), from: "server" }); } catch (e) { j = null; } }
      if (!j) { const r = await v9xGet(k); if (r) j = r.json; }
      V9X[k === "inventory" ? "inv" : k === "volcanoes" ? "vol" : "sites"] = j;
    }
    V9X.analyses = await v9xAll("analyses");
  })().finally(() => { V9X.loading = null; });
  return V9X.loading;
}
async function v9xSaveAnalysis(i) {
  if (!V9X.C) return;
  const key = S.cell[i] + ":" + V9X.man.sha256.slice(0, 16);
  if (V9X.analyses.some(a => a.key === key)) return;
  const a = V9X.C.analyse(i, { source: V9X.src, retrieved: v9xRetrieved(), now: new Date().toISOString() });
  const rec = { key, cell: S.cell[i], place: jnPlaceText ? jnPlaceText(i) : String(S.cell[i]), result: a, created: a.created };
  try { await v9xTx("analyses", "readwrite", s => v9xReq(s.put(rec))); V9X.analyses.push(rec); } catch (e) { /* storage refused: the analysis is still shown */ }
}
function v9xRetrieved() { const s = (V9X.man && V9X.man.sources) || {}; const d = Object.values(s).map(x => String(x.retrieved || "").slice(0, 10)).filter(Boolean).sort(); return d.length ? d[0] === d[d.length - 1] ? d[0] : d[0] + " – " + d[d.length - 1] : null; }
function v9xRerender() { if (["data", "local", "discover"].includes(S.tab) && typeof renderLeft === "function") renderLeft(); }
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { V9X.online = true; v9xRerender(); });
  window.addEventListener("offline", () => { V9X.online = false; v9xRerender(); });
}
/* ------------------------------------------------------------------ formatting */
function v9xVal(r) {
  if (r.value == null) return `<span class="meta">${esc(tx("v18.missing"))}</span>`;
  if (r.cls) return `${esc(r.cls)} <span class="meta">(${esc(txInt(Math.round(r.value)))})</span>`;
  const u = r.units, x = r.value, dp = u === "count" || u === "months" || u === "km" || u === "class" || u === "index" ? 0 : Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : u === "1" || u === "ratio" || u.startsWith("fraction") ? 3 : 2;
  const unit = u === "1" || u === "class" || u === "index" ? "" : (txHas("v19x.unit." + u) ? tx("v19x.unit." + u) : u);
  return `<span class="li-nw">${r.lower_bound ? "≥ " : ""}${esc(txNum(x, dp))}${unit ? ` <span class="meta">${esc(unit)}</span>` : ""}</span>`;
}
function v9xAgency(r) { const nasa = String(r.agency || "").startsWith("NASA"); return `<span class="v9x-ag ${nasa ? "nasa" : "other"}">${esc(tx(nasa ? "v19x.nasa" : "v19x.not_nasa"))}</span>`; }
function v9xKind(k) { const c = /reanalysis|model/.test(k) ? "model" : /satellite observation/.test(k) ? "direct" : /satellite/.test(k) ? "proxy" : /catalogue|classification/.test(k) ? "derived" : "derived";
  return `<span class="v7-kind ${c}" title="${esc(k)}">${esc(tx("v19x.kind." + (/reanalysis|model/.test(k) ? "model" : /lower bound/.test(k) ? "obs_lb" : /satellite observation/.test(k) ? "obs" : /classification/.test(k) ? "class" : /satellite-derived/.test(k) ? "satderived" : /catalogue/.test(k) ? "catalogue" : "derived")))}</span>`; }
function v9xSourceLine() {
  if (!V9X.man) return "";
  return `<p class="meta small" data-v9xsrc="${esc(V9X.src)}">${esc(tx("v19x.src." + V9X.src, { d: v9xRetrieved() || "–", s: (V9X.stored || "").slice(0, 10) }))} · <span class="ds-adv" lang="en">${keep(V9X.man.version)} · ${keep(V9X.man.sha256.slice(0, 12))}</span></p>`;
}
function v9xLayers(i, attr) {
  if (!V9X.C) return `<div class="sec" ${attr} data-i18n-done><h3>${esc(tx("v19x.layers.title"))}</h3><p class="note" data-v9xnone>${esc(tx(V9X.err ? "v19x.err." + (V9X.err.startsWith("verify") || V9X.err.startsWith("store") ? "verify" : "unavailable") : "v19x.loading"))}</p></div>`;
  const doms = V9X.C.domains(i), a = V9X.C.analyse(i, { source: V9X.src });
  const vol = V9X.vol && V9X.C.value("volc_nearest_idx", i) != null ? V9X.vol.volcanoes[Math.round(V9X.C.value("volc_nearest_idx", i))] : null;
  return `<div class="sec" ${attr} data-i18n-done><h3>${esc(tx("v19x.layers.title"))}</h3><p class="note">${esc(tx("v19x.layers.p"))}</p>${v9xSourceLine()}
    ${doms.map(d => `<details class="v7-mod v9x-dom" data-v9xdom="${d.id}" data-v9xstate="${d.state}"${d.have ? " open" : ""}><summary><b>${esc(tx("v19x.dom." + d.id))}</b> <span class="meta">· ${esc(tx("v19x.dom.have", { k: txInt(d.have), n: txInt(d.n) }))}</span></summary>
      <div class="tbl-wrap"><table class="t xt-t li-prof v9x-t"><thead><tr><th scope="col">${esc(tx("v17.col.var"))}</th><th scope="col" class="n">${esc(tx("v17.col.value"))}</th><th scope="col">${esc(tx("v17.col.kind"))}</th><th scope="col" class="ds-adv">${esc(tx("v18.col.dataset"))}</th><th scope="col" class="ds-adv">${esc(tx("v18.col.res"))}</th></tr></thead><tbody>
      ${d.rows.map(r => `<tr data-v9xvar="${r.id}"${r.lower_bound ? " data-v9xlb" : ""}><th scope="row">${esc(txHas("v19x.var." + r.id) ? tx("v19x.var." + r.id) : r.label)}${r.lower_bound ? `<br><span class="meta">${esc(tx("v19x.lower_bound"))}</span>` : ""}</th><td class="n">${v9xVal(r)}</td><td>${v9xKind(r.kind)} ${v9xAgency(r)}</td>
        <td class="ds-adv meta" lang="en">${r.datasets.map(keep).join(", ")}</td><td class="ds-adv meta" lang="en">${esc(r.resolution || "")} · ${esc(r.period || "")}</td></tr>`).join("")}</tbody></table></div>
      ${d.id === "volcanic" && vol ? `<p class="note small" data-v9xvolc>${esc(tx("v19x.volc.nearest", { name: vol[1], km: txInt(Math.round(V9X.C.value("volc_nearest_km", i))), y: vol[3] == null ? tx("v19.pt.last_none") : vol[3] < 0 ? tx("v19.pt.bce", { y: txInt(-vol[3]) }) : String(vol[3]) }))}</p>` : ""}
      <p class="note small" data-v9xnotsaid>${esc(tx("v19x.not." + d.not_said))}</p></details>`).join("")}
    <p class="note small" data-v9xused>${esc(tx("v19x.used", { n: txInt(a.datasets_used.length), m: a.domains_unavailable.length ? a.domains_unavailable.map(x => tx("v19x.dom." + x)).join(", ") : "–" }))}</p></div>`;
}
/* ------------------------------------------------------------------ Data tab: inventory and store */
function v9xInventory() {
  const I = V9X.inv; if (!I) return `<div class="sec" data-v9xinv data-i18n-done><h3>${esc(tx("v19x.inv.title"))}</h3><p class="note">${esc(tx(V9X.loading ? "v19x.loading" : "v19x.err.unavailable"))}</p></div>`;
  const F = V9X.filter, rows = I.rows.filter(r => (F.nasa === "all" || (F.nasa === "nasa") === !!r.nasa) && (F.state === "all" || r.state === F.state));
  const st = s => `<span class="v9x-st ${esc(s.toLowerCase())}">${esc(tx("v19x.st." + s))}</span>`;
  const fld = (k, v) => v == null || v === "" || (Array.isArray(v) && !v.length) ? "" : `<dt>${esc(tx("v19x.f." + k))}</dt><dd lang="en">${typeof v === "object" ? esc(JSON.stringify(v)) : esc(String(v))}</dd>`;
  const order = I.states.concat(["NOT_INVESTIGATED"]);
  return `<div class="sec" data-v9xinv data-i18n-done><h3>${esc(tx("v19x.inv.title"))}</h3><p class="note">${esc(tx("v19x.inv.p"))}</p>
    <p class="meta">${esc(tx("v19x.inv.counts", { n: txInt(I.n), k: txInt(I.nasa), o: txInt(I.n - I.nasa) }))}</p>
    <ul class="xt-list" data-v9xcounts>${order.filter(s => I.counts[s]).map(s => `<li data-v9xcnt="${s}">${st(s)} · ${esc(txInt(I.counts[s]))}</li>`).join("")}</ul>
    <div class="li-row"><label class="xt-field"><span>${esc(tx("v19x.inv.agency"))}</span><select data-v9xf="nasa">${["all", "nasa", "other"].map(k => `<option value="${k}"${F.nasa === k ? " selected" : ""}>${esc(tx("v19x.inv.f_" + k))}</option>`).join("")}</select></label>
      <label class="xt-field"><span>${esc(tx("v19x.inv.state"))}</span><select data-v9xf="state"><option value="all">${esc(tx("v19x.inv.f_all"))}</option>${order.map(s => `<option value="${s}"${F.state === s ? " selected" : ""}>${esc(tx("v19x.st." + s))}</option>`).join("")}</select></label></div>
    <p class="meta" data-v9xshown>${esc(tx("v19x.inv.shown", { n: txInt(rows.length) }))}</p>
    <div class="v9x-inv">${rows.map(r => `<details class="v7-mod" data-v9xrow="${esc(r.id)}" data-v9xstate="${esc(r.state)}" data-v9xnasa="${r.nasa ? 1 : 0}"><summary><b>${keep(r.name || r.id)}</b> ${`<span class="v9x-ag ${r.nasa ? "nasa" : "other"}">${esc(tx(r.nasa ? "v19x.nasa" : "v19x.not_nasa"))}</span>`} ${st(r.state)}</summary>
      <p class="meta">${r.states.length ? r.states.map(st).join(" ") : esc(tx("v19x.inv.no_states"))}</p>
      <dl class="v9x-dl">${fld("agency", r.agency)}${fld("provider", r.provider)}${fld("product", r.product)}${fld("source_product", r.source_product)}${fld("doi", r.doi)}${fld("url", r.url)}${fld("docs", r.docs)}${fld("variables", r.variables)}${fld("units", r.units)}${fld("spatial", r.spatial)}${fld("temporal", r.temporal)}${fld("coverage", r.coverage)}${fld("period", r.period)}${fld("retrieved", r.retrieved)}${fld("route", r.route)}${fld("processing", r.processing)}${fld("validation", r.validation)}${fld("cube_variables", r.cube_variables)}${fld("cloud", r.cloud)}${fld("access", r.access)}${fld("last_attempt", r.last_attempt && (r.last_attempt.class + " · " + r.last_attempt.utc + " · " + (r.last_attempt.error || "")))}${fld("note", r.note)}${fld("limitations", r.limitations)}${fld("raw_sha256", r.raw_sha256)}${fld("from", r.from)}</dl></details>`).join("")}</div>
    <p class="note small">${esc(tx("v19x.inv.never"))}</p></div>`;
}
function v9xStore() {
  const m = V9X.man;
  return `<div class="sec" data-v9xstore data-i18n-done><h3>${esc(tx("v19x.store.title"))}</h3>
    <p class="li-st" data-v9xnet="${V9X.online ? "online" : "offline"}" role="status" aria-live="polite">${esc(tx(V9X.online ? "v19x.store.online" : "v19x.store.offline"))}</p>
    ${m ? `<ul class="xt-list"><li data-v9xcube>${esc(tx("v19x.store.cube", { v: txInt(m.variables.length), mb: txNum(m.bytes / 1048576, 1), s: (V9X.stored || "").slice(0, 16).replace("T", " ") }))} · ${esc(tx("v19x.store.verified"))}</li>
      <li>${esc(tx("v19x.store.src." + V9X.src))}</li><li>${esc(tx("v19x.store.retrieved", { d: v9xRetrieved() || "–" }))}</li></ul>` : `<p class="note">${esc(tx(V9X.err ? "v19x.err." + (/verify|store/.test(V9X.err) ? "verify" : "unavailable") : "v19x.loading"))}</p>`}
    <p class="note small">${esc(tx("v19x.store.never_live"))}</p>
    <div class="li-row"><button class="btn-ghost" data-v9xdo="refresh">${esc(tx("v19x.store.refresh"))}</button><button class="btn-ghost" data-v9xdo="verify">${esc(tx("v19x.store.verify"))}</button>${V9X.analyses.length ? `<button class="btn-ghost" data-v9xdo="clear">${esc(tx("v19x.store.clear"))}</button>` : ""}</div>
    ${V9X.msg ? `<p class="li-st" role="status" data-v9xmsg="${esc(V9X.msg.k)}">${esc(tx("v19x.msg." + V9X.msg.k, V9X.msg.p || {}))}</p>` : ""}
    <h4 class="xt-h">${esc(tx("v19x.saved.title", { n: txInt(V9X.analyses.length) }))}</h4>
    ${V9X.analyses.length ? `<ul class="xt-list" data-v9xsaved>${V9X.analyses.slice(-12).reverse().map(a => `<li>${keep(a.place)} · ${esc((a.created || "").slice(0, 16).replace("T", " "))} · ${esc(tx("v19x.saved.used", { n: txInt(a.result.datasets_used.length), m: txInt(a.result.domains_unavailable.length) }))}</li>`).join("")}</ul>` : `<p class="note small">${esc(tx("v19x.saved.none"))}</p>`}</div>`;
}
/* ------------------------------------------------------------------ wiring into existing views */
{ const f = viewData; viewData = function () { let h = f.apply(this, arguments); try { if (!V9X.man && !V9X.loading && !V9X.err) v9xLoad().then(v9xRerender); h += v9xStore() + v9xInventory(); } catch (e) { console.error(e); } return h; }; }
{ const f = v7HubDomains; v7HubDomains = function () {
  let h = f.apply(this, arguments);
  try { const i = v7Cur(); if (i != null) { if (!V9X.man && !V9X.loading && !V9X.err) v9xLoad().then(v9xRerender); h += v9xLayers(i, "data-v9xlayers"); } } catch (e) { console.error(e); }
  return h;
}; }
{ const f = viewLocal; viewLocal = function () {
  let h = f.apply(this, arguments);
  try {
    if (typeof LI !== "undefined" && LI.i != null) {
      if (!V9X.man && !V9X.loading && !V9X.err) v9xLoad().then(v9xRerender);
      if (V9X.C) v9xSaveAnalysis(LI.i);
      const sec = `<section class="sec li-sec" data-lisec="v19x" data-i18n-done>${v9xLayers(LI.i, "data-v9xlayers").replace(/^<div class="sec" [^>]*>/, "").replace(/<\/div>$/, "")}</section>`;
      const k = h.indexOf('<section class="sec li-sec" data-lisec="report"');
      h = k >= 0 ? h.slice(0, k) + sec + h.slice(k) : h + sec;
    }
  } catch (e) { console.error(e); }
  return h;
}; }
if (typeof document !== "undefined") {
  document.addEventListener("change", e => {
    const t = e.target; if (!t || !t.dataset || !t.dataset.v9xf) return;
    V9X.filter[t.dataset.v9xf] = t.value; const sel = `[data-v9xf="${t.dataset.v9xf}"]`; renderLeft(); const n = document.querySelector(sel); if (n) n.focus();
  });
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-v9xdo]"); if (!b) return;
    const k = b.dataset.v9xdo, sel = `[data-v9xdo="${k}"]`, done = m => { V9X.msg = m; renderLeft(); const n = document.querySelector(sel); if (n) n.focus(); };
    if (k === "refresh") { const old = V9X.man && V9X.man.sha256; V9X.err = null; v9xLoad(true).then(() => done(V9X.src === "server" ? { k: V9X.man.sha256 === old ? "same" : "updated" } : { k: V9X.online ? "failed" : "offline" })); }
    else if (k === "verify") { v9xGet("cube").then(async r => { if (!r) return done({ k: "nostore" }); const v = await AsterroV19X.verify(r.manifest, r.buffer, V9X.cellSha); done({ k: v.ok ? "verify_ok" : "verify_bad" }); }); }
    else if (k === "clear") { v9xTx("analyses", "readwrite", s => v9xReq(s.clear())).then(() => { V9X.analyses = []; done({ k: "cleared" }); }).catch(() => done({ k: "failed" })); }
  });
}
