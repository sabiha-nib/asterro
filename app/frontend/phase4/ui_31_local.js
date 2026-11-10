/* ===== V18: Local Impact, "What can your location teach us about exploring the Moon and Mars?" =====
 * A new tab beside the existing ones. A location comes from the browser's geolocation (asked only when the person
 * presses the button), a typed place name or coordinates (matched against the Natural Earth names ASTERRO already
 * holds, offline), or the place selected on the globe. The point never leaves the browser: no request is made with
 * it, it is not put in the address, and it is not stored unless the person saves a profile, which keeps only the
 * cell and its name. The analysis is of the ~55 km grid cell that contains the point and its neighbourhood, from
 * data ASTERRO already holds (AsterroLocal + AsterroV17 + the unchanged engine). */
const LI = { loc: null, status: null, i: null, offKm: null, radius: 100, tid: null, precision: "cell", q: "", results: null, cache: new Map(), consent: false, msg: null };
const LI_KEY = "asterro.local.v1";
const LI_LAYERS = ["elevation", "slope", "surface_roughness", "lst_day_k", "lst_night_k", "lst_diurnal_range", "annual_temperature_range", "t2m_mean_c", "precip_mm_yr", "aridity_index_raw", "aridity"];
const LI_ACC_WARN_M = 25000;   // half a grid cell: beyond this the analysed cell may not contain the person
function liSaved() { try { return JSON.parse(localStorage.getItem(LI_KEY)) || []; } catch (e) { return []; } }
function liStore(list) { try { if (list.length) localStorage.setItem(LI_KEY, JSON.stringify(list)); else localStorage.removeItem(LI_KEY); return true; } catch (e) { return false; } }
function liTid() { if (!LI.tid || !S.T[LI.tid]) LI.tid = S.targetId && S.targetId !== "cross" && S.T[S.targetId] ? S.targetId : "mars_jezero"; return LI.tid; }
function liGrid() { return { n: S.n, lat: S.lat, lon: S.lon }; }
function liTitle(s) { return String(s || "").toLowerCase().replace(/(^|[\s\-(])([\p{L}])/gu, (m, a, b) => a + b.toUpperCase()); }
function liAt(i) {
  const V = v7(), c = { A: {} };
  for (const k of LI_LAYERS) { const a = S.A[k]; c.A[k] = a ? a[i] : null; }
  c.val = v => (V ? V.val(v, i) : null); c.cls = v => (V ? V.cls(v, i) : null);
  c.slopeShare5 = typeof xcSlopeShare === "function" ? xcSlopeShare(i, 5) : null;
  c.koppen = typeof xcKoppen === "function" ? xcKoppen(i) : null;
  c.regionIdx = S.A.region ? S.A.region[i] : -1;
  c.region = c.regionIdx >= 0 ? liTitle(S.labels.region[c.regionIdx]) : null;
  c.regionCls = c.regionIdx >= 0 && XD && XD.context ? XD.context.region_featurecla[c.regionIdx] : null;
  c.pattern = V ? V.pattern(i) : null; c.novelty = V ? V.novelty(i) : null;
  if (i === LI.i && LI._relief != null) c.relief = LI._relief;
  return c;
}
function liLst90() { if (LI._lst90 == null) { const a = []; for (let i = 0; i < S.n; i++) { const x = S.A.lst_diurnal_range[i]; if (x - x === 0) a.push(x); } a.sort((x, y) => x - y); LI._lst90 = a[Math.floor(0.9 * (a.length - 1))]; } return LI._lst90; }
function liMarsTid() { return v7Body(liTid()) === "mars" ? liTid() : "mars_jezero"; }
function liAnalysis() {
  const i = LI.i; if (i == null) return null;
  const key = `${i}:${LI.radius}:${liTid()}:${JSON.stringify(S.weights)}`;
  if (LI.cache.has(key)) return LI.cache.get(key);
  const L = AsterroLocal, cells = L.cellsWithin(i, LI.radius, liGrid());
  const nb = L.neighbourhood(i, cells, { at: liAt });
  LI._relief = nb.relief;
  const ctx = { at: liAt, cells, pct: { lst90: liLst90() }, rowsFor: (tid, j) => v7Rows(tid, j), marsTid: liMarsTid(), thr: S.app.thresholds };
  const prof = L.profile(i, ctx), disc = L.discoveries(cells, ctx, v7().registry);
  const tid = liTid(), eff = S.res && S.res.tid === tid ? S.res.eff : simFor(tid, S.weights).eff;
  let rank = 1, ranked = 0; for (let j = 0; j < S.n; j++) { if (eff[j] >= 0) { ranked++; if (eff[j] > eff[i]) rank++; } }
  let best = null; for (const { i: j, km } of cells) if (eff[j] >= 0 && (!best || eff[j] > eff[best.i])) best = { i: j, km, eff: eff[j] };
  const cmp = L.comparison(v7Rows(tid, i), S.app.thresholds, S.T[tid].status || {});
  const out = { key, i, cells, nb, prof, disc, tid, eff: eff[i], rank: eff[i] >= 0 ? rank : null, ranked, best, cmp, cov: v7Cov(tid, i) };
  if (LI.cache.size > 24) LI.cache.delete(LI.cache.keys().next().value);
  LI.cache.set(key, out);
  return out;
}
/* ------------------------------------------------------------------ location input */
function liSetPoint(p, source) {
  const L = AsterroLocal;
  if (!p || !L.validPoint(p.lat, p.lon)) { LI.status = "badcoords"; LI.loc = null; LI.i = null; return; }
  LI.loc = { lat: p.lat, lon: p.lon, acc: p.acc == null ? null : p.acc, source, name: p.name || null };
  const r = L.locate(p.lat, p.lon, liGrid(), 60);
  LI.offKm = r.km; LI.i = r.i; LI._relief = null;
  LI.status = r.i == null ? "offgrid" : p.acc != null && p.acc > LI_ACC_WARN_M ? "inaccurate" : "ok";
  if (r.i != null) { try { select(r.i, true); } catch (e) { console.error(e); } }
}
function liGeo() {
  LI.results = null;
  if (!("geolocation" in navigator) || !navigator.geolocation) { LI.status = "unsupported"; liRender("#li-status"); return; }
  LI.status = "asking"; liRender("#li-status");
  navigator.geolocation.getCurrentPosition(pos => {
    const c = pos.coords; liSetPoint({ lat: c.latitude, lon: c.longitude, acc: c.accuracy }, "device"); liRender("#li-result-h");
  }, err => {
    LI.status = err && err.code === 1 ? "denied" : err && err.code === 3 ? "timeout" : "unavailable"; liRender("#li-status");
  }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
}
function liSearch(q) {
  LI.q = q; LI.results = null;
  const p = AsterroLocal.parseCoords(q);
  if (p) { liSetPoint(p, "coordinates"); return; }
  if (/\d/.test(q) && /^[\s\d.,;+\-°NSEWnsew]+$/.test(q)) { LI.status = "badcoords"; LI.loc = null; LI.i = null; return; }   // numbers, but not valid coordinates
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const t = norm(q); if (t.length < 2) { LI.status = "short"; return; }
  const hits = [];
  S.labels.region.forEach((n, k) => { const m = norm(n); if (m.includes(t)) hits.push({ kind: "region", k, name: liTitle(n), score: m.startsWith(t) ? 0 : 1 }); });
  S.labels.country.forEach((n, k) => { const m = norm(n); if (m.includes(t)) hits.push({ kind: "country", k, name: n, score: m.startsWith(t) ? 0 : 1 }); });
  hits.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  LI.results = hits.slice(0, 10).map(h => {
    const arr = h.kind === "region" ? S.A.region : S.A.country; let sl = 0, so = 0, n = 0;
    for (let i = 0; i < S.n; i++) if (arr[i] === h.k) { sl += S.lat[i]; so += S.lon[i]; n++; }
    if (!n) return { ...h, i: null };
    const r = AsterroLocal.locate(sl / n, so / n, liGrid(), 1e9);
    let i = r.i; if (arr[i] !== h.k) { let bd = Infinity; for (let j = 0; j < S.n; j++) if (arr[j] === h.k) { const d = AsterroLocal.km(sl / n, so / n, S.lat[j], S.lon[j]); if (d < bd) { bd = d; i = j; } } }
    return { ...h, i, n };
  }).filter(h => h.i != null);
  LI.status = LI.results.length ? "results" : "noresults";
}
/* ------------------------------------------------------------------ rendering */
function liName(id) { return txHas("v18.var." + id) ? tx("v18.var." + id) : tx("v17.var." + id); }
function liUnit(u) { return u === "share" || u === "ratio" || u === "P/PET" || u === "months" || u === "yes/no" ? tx("v18.unit." + u.replace("/", "_")) : u; }
function liVal(r) {
  const v = r.value; if (v == null) return `<span class="meta">${esc(tx("v18.missing"))}</span>`;
  if (r.id === "koppen") return `<b>${keep(v)}</b> · ${esc(tx("ext.kg." + v))}`;
  if (r.id === "region") return keep(v);
  if (typeof v === "string") return esc(tx("v17.cls." + v));
  if (r.id === "lst_freeze_thaw" || r.id === "maat_below_zero") return esc(tx(v ? "v18.yes" : "v18.no"));
  const dp = r.id === "aridity_index_raw" ? 3 : r.id === "gentle_le5" || r.id === "precip_cv" ? 2 : Math.abs(v) >= 100 ? 0 : 1;
  return `<span class="li-nw">${esc(txNum(v, Number.isInteger(v) ? 0 : dp))} <span class="meta">${esc(liUnit(r.unit))}</span></span>`;
}
function liSrc(ids) { return ids.map(id => { const d = S.app.datasets.find(x => x.id === id); const R = V17D.registry.sources.find(x => x.id === id); return d ? `${keep(d.provider)} · ${keep(d.dataset.split(";")[0].slice(0, 70))}` : R ? `${keep(R.provider || "")} · ${keep(R.title || id)}` : keep(id); }).join("; "); }
function liStatusHTML() {
  const s = LI.status; if (!s) return "";
  const retry = `<button type="button" class="btn-ghost btn-sm" data-lido="geo">${esc(tx("v18.retry"))}</button>`;
  const txt = { asking: "v18.st.asking", denied: "v18.st.denied", unavailable: "v18.st.unavailable", timeout: "v18.st.timeout", unsupported: "v18.st.unsupported", badcoords: "v18.st.badcoords", offgrid: "v18.st.offgrid", noresults: "v18.st.noresults", short: "v18.st.short", inaccurate: "v18.st.inaccurate", results: "v18.st.results", ok: null }[s];
  if (!txt) return "";
  const p = { km: txInt(Math.round(LI.offKm || 0)), acc: LI.loc && LI.loc.acc != null ? txInt(Math.round(LI.loc.acc / 1000)) : "–" };
  const err = ["denied", "unavailable", "timeout"].includes(s);
  return `<p class="note li-st ${err || s === "offgrid" || s === "badcoords" || s === "unsupported" ? "li-err" : ""}" data-listatus="${s}">${esc(tx(txt, p))}${err || s === "unsupported" ? ` <span class="meta">${esc(tx("v18.st.manual"))}</span>` : ""}${err ? `<span class="li-retry">${retry}</span>` : ""}</p>`;
}
function liInput() {
  const sel = S.selected != null ? `<button type="button" class="btn-ghost" data-lido="sel">${esc(tx("v18.use_selected", { p: jnPlaceText(S.selected) }))}</button>` : "";
  const res = LI.results && LI.results.length ? `<ul class="xt-list li-res" data-lires>${LI.results.map((h, k) => `<li><button type="button" class="jn-lnk" data-lipick="${k}">${keep(h.name)}</button> <span class="meta">${esc(tx(h.kind === "region" ? "v18.kind.region" : "v18.kind.country"))}</span></li>`).join("")}</ul>` : "";
  return `<div class="li-in">
    <div class="li-row"><button type="button" class="btn-primary" data-lido="geo" id="li-geo">${esc(tx("v18.geo"))}</button>${sel}</div>
    <form class="li-row" data-liform role="search"><label class="xt-field li-q"><span>${esc(tx("v18.search_l"))}</span><input type="text" id="li-q" autocomplete="off" spellcheck="false" value="${esc(LI.q)}" placeholder="${esc(tx("v18.search_ph"))}"></label><button type="submit" class="btn-ghost">${esc(tx("v18.search_b"))}</button></form>
    <div id="li-status" aria-live="polite">${liStatusHTML()}</div>${res}
    <p class="note small li-priv" data-lipriv>${esc(tx("v18.privacy"))}</p></div>`;
}
function liProfile(A) {
  const groups = ["terrain", "thermal", "climate", "cold", "light", "context"];
  const row = r => `<tr data-livar="${r.id}"><th scope="row">${esc(liName(r.id))}${r.note ? `<br><span class="meta ds-adv" lang="en">${esc(r.note)}</span>` : ""}</th><td class="n">${liVal(r)}</td><td>${v7Kind(r.kind === "context" ? "derived" : r.kind)}</td>
    <td class="ds-adv meta">${liSrc(r.src)}</td><td class="ds-adv meta" lang="en">${esc(r.res)} · ${esc(r.period)}</td><td class="ds-adv n">${r.completeness == null ? "–" : esc(txPct(r.completeness, 0))}</td></tr>`;
  const un = AsterroLocal.unavailable(v7().registry);
  return `<div class="tbl-wrap"><table class="t xt-t li-prof" data-liprof><thead><tr><th scope="col">${esc(tx("v17.col.var"))}</th><th scope="col" class="n">${esc(tx("v17.col.value"))}</th><th scope="col">${esc(tx("v17.col.kind"))}</th><th scope="col" class="ds-adv">${esc(tx("v18.col.dataset"))}</th><th scope="col" class="ds-adv">${esc(tx("v18.col.res"))}</th><th scope="col" class="ds-adv n">${esc(tx("v18.col.comp", { r: txInt(LI.radius) }))}</th></tr></thead>
    ${groups.map(g => `<tbody><tr class="li-grp"><th colspan="6" scope="rowgroup">${esc(tx("v18.grp." + g))}</th></tr>${A.prof.filter(r => r.group === g).map(row).join("")}</tbody>`).join("")}</table></div>
    <h4 class="xt-h">${esc(tx("v18.unavail"))}</h4><ul class="xt-list" data-liunavail>${un.map(u => `<li><b>${esc(tx("v18.var." + u.id))}</b> · ${u.need.map(n => `${keep(n.id)} (${v7State(n.state)})`).join(", ")}</li>`).join("")}</ul>`;
}
function liTargetSel() {
  const tids = jnTargets(), opt = t => `<option value="${t}"${t === liTid() ? " selected" : ""}>${esc(jnBody(t))} · ${esc(jnTNameText(t))}</option>`;
  return `<label class="xt-field"><span>${esc(tx("v18.target"))}</span><select data-litid>${["mars", "moon"].map(b => `<optgroup label="${esc(tx("v17.body." + b))}">${tids.filter(t => v7Body(t) === b).map(opt).join("")}</optgroup>`).join("")}</select></label>`;
}
function liCompare(A) {
  const c = A.cmp, st = S.T[A.tid].status || {};
  const lbl = k => c[k].map(x => esc(tx("crit." + x + ".s"))).join(", ") || "–";
  return `<div class="v7-row">${liTargetSel()}</div>
    <p class="note" data-licmp-sum>${esc(A.eff >= 0 ? tx("v18.cmp.sum", { p: txPct(A.eff), t: jnTNameText(A.tid), r: txInt(A.rank), n: txInt(A.ranked) }) : tx("v18.cmp.unranked", { t: jnTNameText(A.tid), c: txPct(A.cov, 0) }))}</p>
    <div class="tbl-wrap"><table class="t xt-t ds-cmp" data-licmp><thead><tr><th scope="col">${esc(tx("ext.rep.c.crit"))}</th><th scope="col" class="n">${esc(tx("v18.cmp.here"))}</th><th scope="col" class="n">${esc(tx("ext.rep.c.target"))}</th><th scope="col" class="n">${esc(tx("ext.rep.c.s"))}</th><th scope="col">${esc(tx("ext.rep.c.state"))}</th><th scope="col">${esc(tx("dsf.compare.kind"))}</th></tr></thead><tbody>
    ${c.rows.map(r => `<tr data-licrit="${r.c}" data-lik="${r.k}"><th scope="row">${esc(tx("crit." + r.c + ".s"))}</th><td class="n">${jnVal(r.c, r.e)}</td><td class="n">${jnVal(r.c, r.t)}</td><td class="n">${r.s == null ? "–" : esc(txNum(r.s, 2))}<span class="ds-st-in ${r.k}">${esc(tx("state." + r.k))}</span></td><td><span class="ds-state ${r.k}">${esc(tx("state." + r.k))}</span></td><td><span class="ds-ev ${String(st[r.c] || "").toLowerCase().replace("/", "")}">${esc(txHas("status." + st[r.c]) ? tx("status." + st[r.c]) : (st[r.c] || "–"))}</span></td></tr>`).join("")}</tbody></table></div>
    <ul class="xt-list" data-licmp-lists><li><b>${esc(tx("v18.cmp.similar"))}</b> ${lbl("similar")}</li><li><b>${esc(tx("v18.cmp.partial"))}</b> ${lbl("partial")}</li><li><b>${esc(tx("v18.cmp.different"))}</b> ${lbl("different")}</li><li><b>${esc(tx("v18.cmp.missing"))}</b> ${lbl("missing")}</li><li><b>${esc(tx("v18.cmp.proxy"))}</b> ${lbl("proxy")}</li></ul>
    <p class="note small">${esc(tx("v18.cmp.uncert", { c: txPct(A.cov, 0) }))} ${esc(tx("dsa.note"))}</p>`;
}
function liNear(A) {
  const nb = A.nb, cnt = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${esc(tx("v17.cls." + k))} ${esc(txInt(n))}`).join(", ") || "–";
  const kg = Object.entries(nb.koppen).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${keep(k)} ${esc(txInt(n))}`).join(", ") || "–";
  const radii = AsterroLocal.RADII.map(r => `<button type="button" data-liradius="${r}" aria-pressed="${LI.radius === r}">${esc(txInt(r))} km</button>`).join("");
  const nf = AsterroLocal.noFeatures(v7().registry);
  return `<div class="ds-seg" role="group" aria-label="${esc(tx("v18.near.radius"))}">${radii}</div>
    <p class="note small" data-linear-scale>${esc(tx("v18.near.scale", { n: txInt(nb.n), r: txInt(LI.radius) }))}</p>
    <ul class="xt-list" data-linear>
      <li><b>${esc(tx("v18.near.relief"))}</b> ${nb.elevMin ? esc(tx("v18.near.relief_v", { lo: txInt(Math.round(nb.elevMin.v)), hi: txInt(Math.round(nb.elevMax.v)), d: txInt(Math.round(nb.relief)) })) : "–"}</li>
      <li><b>${esc(tx("v18.near.rough"))}</b> ${nb.roughMax ? `${esc(txInt(Math.round(nb.roughMax.v)))} m · ${xtPlaceBtn(nb.roughMax.i)}` : "–"}</li>
      <li><b>${esc(tx("v17.var.aridity_class"))}</b> ${cnt(nb.zones)}</li><li><b>${esc(tx("v17.var.landform_class"))}</b> ${cnt(nb.forms)}</li><li><b>${esc(tx("v18.var.koppen"))}</b> ${kg}</li>
      ${A.best ? `<li><b>${esc(tx("v18.near.best", { t: jnTNameText(A.tid) }))}</b> ${xtPlaceBtn(A.best.i)} · ${esc(txPct(A.best.eff))} · ${esc(txInt(Math.round(A.best.km)))} km</li>` : ""}</ul>
    <h4 class="xt-h">${esc(tx("v18.near.regions"))}</h4><p class="note small">${esc(tx("v18.near.regions_p"))}</p>
    ${nb.regions.length ? `<ul class="xt-list" data-liregions>${nb.regions.slice(0, 12).map(r => `<li><button type="button" class="jn-lnk" data-xtsel="${r.i}">${keep(liTitle(S.labels.region[r.idx]))}</button> · ${esc(tx("ext.env." + String(r.cls || "").replace(/[^A-Za-z]/g, "").toLowerCase()))} · ${esc(txInt(Math.round(r.km)))} km</li>`).join("")}</ul>` : `<p class="note">${esc(tx("v18.near.noregions"))}</p>`}
    <p class="note small" data-linofeat>${esc(tx("v18.near.nofeat"))} ${nf.map(f => `${esc(tx("v18.feat." + f.id))}${f.need.length ? " (" + f.need.map(n => keep(n.id)).join(", ") + ")" : ""}`).join("; ")}</p>`;
}
/* evidence numbers carry the profile's own unit; counts and percentiles are whole numbers */
function liEvNum(k, v) {
  const V = AsterroLocal.VARS.find(x => x.id === k), u = V ? V.unit : null;
  const whole = (u === "months") || k === "anomaly_pct" || k === "uniqueness_pct";
  const n = esc(txNum(v, whole || Math.abs(v) >= 100 ? 0 : k === "aridity" ? 3 : u ? 1 : 2));
  return u && u !== "class" && u !== "name" ? `<span class="li-nw">${n} ${esc(liUnit(u))}</span>` : n;
}
function liDisc(A) {
  const nm = k => k.startsWith("s_") ? "s · " + tx("crit." + k.slice(2) + ".s") : txHas("v18.var." + k) || txHas("v17.var." + k) ? liName(k) : k;
  const D = A.disc, ev = e => Object.entries(e).filter(([, v]) => v != null && v !== false).map(([k, v]) => `${esc(nm(k))} = ${v === true ? esc(tx("v18.yes")) : typeof v === "number" ? liEvNum(k, v) : k === "target" ? esc(jnTNameText(v)) : esc(tx("v17.cls." + v))}`).join("; ");
  return `${D.found.length ? D.found.map(d => `<article class="v7-card li-disc" data-lidisc="${d.id}"><h4 class="v7-h">${esc(tx("v18.disc." + d.id))}</h4>
      <p class="note"><b>${esc(tx("v18.disc.measured"))}</b> ${esc(tx("v18.disc.cells", { n: txInt(d.n), m: txInt(d.of) }))} ${xtPlaceBtn(d.best.i)} (${esc(txInt(Math.round(d.best.km)))} km): ${ev(d.best.ev)}</p>
      <p class="note"><b>${esc(tx("v18.disc.hypothesis"))}</b> ${esc(tx("v18.disc." + d.id + ".h"))}</p></article>`).join("") : `<p class="note">${esc(tx("v18.disc.none"))}</p>`}
    <p class="note small">${esc(tx("v18.disc.blocked"))} ${D.blocked.map(b => `${esc(tx("v18.disc." + b.id))} (${b.need.map(n => keep(n.id)).join(", ")})`).join("; ")}</p>`;
}
function liRelevance(A) {
  const ops = typeof xcOps === "function" ? xcOps(A.i, A.tid) : [], body = v7Body(A.tid);
  return `<ul class="xt-list" data-lirel>${ops.map(o => `<li><b>${esc(tx("ext.op." + o.id + ".name"))}</b>: ${o.mean == null ? esc(tx("v18.rel.cannot")) : `${esc(tx("state." + o.k))} (${esc(txNum(o.mean, 2))})`}${o.needs && o.needs.length ? ` · <span class="meta">${esc(tx("v18.rel.needs"))} ${o.needs.map(n => esc(tx("ext.dim." + n + ".name"))).join(", ")}</span>` : ""}</li>`).join("")}
    <li><b>${esc(tx("v18.rel.monitoring"))}</b>: ${esc(tx("v18.rel.monitoring_v"))}</li><li><b>${esc(tx("v18.rel.education"))}</b>: ${esc(tx("v18.rel.education_v"))}</li></ul>
    <p class="note small">${esc(tx("v18.rel.not_cert"))}</p>
    <h4 class="xt-h">${esc(tx("v17.lim.title"))}</h4><ul class="xt-list" data-lilimits>${V17D.limits.items.filter(x => x.earth_site !== "yes").map(x => `<li><b>${esc(tx("v17.lim." + x.id))}</b>: ${esc(tx("v17.lim.site_" + x.earth_site))}</li>`).join("")}</ul>`;
}
function liReportUI(A) {
  const opt = k => `<option value="${k}"${LI.precision === k ? " selected" : ""}>${esc(tx("v18.prec." + k))}</option>`;
  const saved = liSaved();
  return `<div class="v7-row"><label class="xt-field"><span>${esc(tx("v18.prec"))}</span><select data-liprec>${["cell", "1deg", "exact", "none"].map(opt).join("")}</select></label>
    <button type="button" class="btn-primary btn-sm" data-lido="report">${esc(tx("v18.report"))}</button></div>
    <p class="note small">${esc(tx("v18.prec_p"))}</p>
    <h4 class="xt-h">${esc(tx("v18.save.title"))}</h4>
    <label class="li-consent"><input type="checkbox" data-liconsent${LI.consent ? " checked" : ""}> ${esc(tx("v18.save.consent"))}</label>
    <div class="li-row"><button type="button" class="btn-ghost btn-sm" data-lido="save"${LI.consent ? "" : " disabled"}>${esc(tx("v18.save.btn"))}</button>${LI.msg ? ` <span class="note small" data-limsg>${esc(LI.msg)}</span>` : ""}</div>
    ${saved.length ? `<ul class="xt-list" data-lisaved>${saved.map((s, k) => `<li><button type="button" class="jn-lnk" data-liopen="${k}">${keep(s.name)}</button> <span class="meta">${esc(tx("v18.save.when", { d: s.saved.slice(0, 10) }))}</span> <button type="button" class="btn-ghost btn-sm" data-lidel="${k}" aria-label="${esc(tx("v18.save.del_aria", { p: s.name }))}">${esc(tx("v18.save.del"))}</button></li>`).join("")}</ul><button type="button" class="btn-ghost btn-sm" data-lido="delall">${esc(tx("v18.save.delall"))}</button>` : `<p class="note small">${esc(tx("v18.save.none"))}</p>`}`;
}
function viewLocal() {
  if (!S.res || !v7() || typeof AsterroLocal === "undefined") return `<div class="sec"><h2>${esc(tx("v18.title"))}</h2><p class="note">${esc(tx("v17.pick_first"))}</p></div>`;
  let h = `<div class="sec" data-local data-i18n-done><h2 class="li-h">${esc(tx("v18.title"))}</h2><p class="ds-lede">${esc(tx("v18.lede"))}</p>${liInput()}</div>`;
  if (LI.i == null) return h + `<div class="sec"><p class="note">${esc(tx("v18.start"))}</p><p class="note small">${esc(tx("v18.not_characterised"))}</p></div>`;
  const A = liAnalysis(), c = liAt(LI.i), loc = LI.loc;
  const zone = c.cls("aridity_class"), form = c.cls("landform_class");
  const where = `${jnPlace(LI.i)} · ${esc(tx("v18.cell_centre", { c: txLL(S.lat[LI.i], S.lon[LI.i]) }))}`;
  const accTxt = loc && loc.acc != null ? esc(tx("v18.acc", { km: txNum(loc.acc / 1000, loc.acc < 10000 ? 1 : 0) })) : "";
  const sec = (id, k, body) => `<section class="sec li-sec" data-lisec="${id}" data-i18n-done><h3>${esc(tx("v18.sec." + k))}</h3>${body}</section>`;
  h += `<section class="sec li-sum" data-lisum data-i18n-done><h3 id="li-result-h" tabindex="-1">${where}</h3>
    <p class="meta">${esc(tx("v18.src." + (loc ? loc.source : "selected")))}${accTxt ? " · " + accTxt : ""}${LI.offKm != null ? " · " + esc(tx("v18.off", { km: txInt(Math.round(LI.offKm)) })) : ""}</p>
    <p class="ds-sum-l">${esc(tx("v18.sum", { form: form ? tx("v17.cls." + form) : tx("val.na"), zone: zone ? tx("v17.cls." + zone) : tx("v18.zone_na"), el: c.A.elevation - c.A.elevation === 0 ? txInt(Math.round(c.A.elevation)) : "–", dr: c.A.lst_diurnal_range - c.A.lst_diurnal_range === 0 ? txNum(c.A.lst_diurnal_range, 1) : "–", fz: c.val("freeze_months") != null ? txInt(c.val("freeze_months")) : "–" }))}</p>
    <p class="note">${esc(A.eff >= 0 ? tx("v18.sum_cmp", { t: jnTNameText(A.tid), p: txPct(A.eff), s: A.cmp.similar.map(x => tx("crit." + x + ".s")).join(", ") || "–", d: A.cmp.different.map(x => tx("crit." + x + ".s")).join(", ") || "–" }) : tx("v18.cmp.unranked", { t: jnTNameText(A.tid), c: txPct(A.cov, 0) }))}</p>
    <p class="note small">${esc(tx("v18.scale_note"))}</p></section>`;
  h += sec("profile", "profile", `<p class="note small">${esc(tx("v18.profile_p"))}</p>${liProfile(A)}`);
  h += sec("compare", "compare", liCompare(A));
  h += sec("near", "near", liNear(A));
  h += sec("disc", "disc", `<p class="note small">${esc(tx("v18.disc_p"))}</p>${liDisc(A)}`);
  h += sec("rel", "rel", liRelevance(A));
  h += sec("report", "report", liReportUI(A));
  return h;
}
function liRender(focusSel) { if (S.tab !== "local") return; renderLeft(); if (focusSel) { const n = document.querySelector(focusSel); if (n) n.focus(); } }
/* ------------------------------------------------------------------ report */
function liReportData() {
  const A = liAnalysis(), i = LI.i, c = liAt(i), loc = LI.loc || { lat: S.lat[i], lon: S.lon[i] };
  const p = AsterroLocal.precise({ lat: loc.lat, lon: loc.lon, cellLat: S.lat[i], cellLon: S.lon[i] }, LI.precision);
  const fmt = r => r.value == null ? "not available" : typeof r.value === "number" ? String(+r.value.toFixed(3)) : String(r.value);
  const crit = x => tx("crit." + x + ".s"), th = S.app.thresholds, st = S.T[A.tid].status || {};
  const dsets = new Set(); A.prof.forEach(r => r.src.forEach(s => dsets.add(s)));
  return {
    title: tx("v18.rep.title", { p: jnPlaceText(i) }), when: new Date().toISOString(),
    versions: [AsterroLocal.VERSION, S.app.algorithm_version, v7().VERSION, V17D.cube.version],
    location: jnPlaceText(i) + " (" + tx("v18.src." + (LI.loc ? LI.loc.source : "selected")) + ")",
    coords: p ? `${p.lat}, ${p.lon} (${tx("v18.prec." + LI.precision)})` : tx("v18.prec.none"),
    scale: tx("v18.rep.scale", { r: LI.radius, n: A.nb.n }),
    target: `${jnTNameText(A.tid)} (${A.tid})`,
    measurements: A.prof.map(r => ({ name: liName(r.id), value: fmt(r), unit: r.unit, src: r.src.join(", "), res: r.res, period: r.period, kind: r.kind, comp: r.completeness == null ? "–" : Math.round(r.completeness * 100) + " %" })),
    unavailable: AsterroLocal.unavailable(v7().registry).map(u => `${tx("v18.var." + u.id)} (${u.need.map(n => n.id + ": " + n.state).join(", ")})`),
    provenance: [...dsets].map(id => { const d = S.app.datasets.find(x => x.id === id); return d ? `${id}: ${d.provider}, ${d.dataset}, ${d.version || ""}, ${d.url || ""}` : id; }),
    similar: A.cmp.rows.filter(r => r.k === "similar").map(r => `${crit(r.c)}: s = ${r.s.toFixed(2)}`),
    different: A.cmp.rows.filter(r => r.k === "different").map(r => `${crit(r.c)}: s = ${r.s.toFixed(2)}`),
    evidence: [tx("v18.rep.ev_cov", { c: Math.round(A.cov * 100) + " %" }), tx("v18.rep.ev_proxy", { n: S.critIds.filter(k => st[k] === "PROXY").length }), tx("v18.rep.ev_kinds")],
    gaps: A.cmp.missing.map(crit).concat(AsterroLocal.unavailable(v7().registry).map(u => tx("v18.var." + u.id))),
    discoveries: A.disc.found.map(d => `${tx("v18.disc." + d.id)}: ${d.n}/${d.of} cells; measured at cell ${S.cell[d.best.i]}: ${JSON.stringify(d.best.ev)}. ${tx("v18.disc.hypothesis")} ${tx("v18.disc." + d.id + ".h")}`),
    applications: (typeof xcOps === "function" ? xcOps(i, A.tid) : []).map(o => `${tx("ext.op." + o.id + ".name")}: ${o.mean == null ? tx("v18.rel.cannot") : tx("state." + o.k) + " (" + o.mean.toFixed(2) + ")"}`).concat([tx("v18.rel.not_cert")]),
    limits: [tx("v18.scale_note"), tx("v18.rep.lim_temporal")].concat(V17D.limits.items.filter(x => x.earth_site !== "yes").map(x => `${tx("v17.lim." + x.id)}: ${tx("v17.lim.site_" + x.earth_site)}`)),
    repro: { local: AsterroLocal.VERSION, engine: S.app.algorithm_version, cell: S.cell[i], cell_centre: [S.lat[i], S.lon[i]], radius_km: LI.radius, target: A.tid, weights: { ...S.weights }, profile: S.profile, thresholds: th, coordinate_precision: LI.precision, v17_sha256: V17D.sha256 },
  };
}
function liDownload() {
  const md = AsterroLocal.report(liReportData()), b = new Blob([md], { type: "text/markdown" }), u = URL.createObjectURL(b), a = document.createElement("a");
  a.href = u; a.download = `asterro-local-impact-cell${S.cell[LI.i]}-${LI.radius}km.md`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000);
}
/* ------------------------------------------------------------------ tab, events */
(function liTab() {
  const nav = $(".tabs"); if (!nav || $("#tab-local")) return;
  const b = document.createElement("button"); b.setAttribute("role", "tab"); b.dataset.tab = "local"; b.id = "tab-local"; b.dataset.i18nKey = "v18.tab"; b.textContent = tx("v18.tab");
  const after = $("#tab-atlas"); after ? after.insertAdjacentElement("afterend", b) : nav.appendChild(b);
})();
{ const f = renderLeft; renderLeft = function () {
  if (S.tab !== "local") return f.apply(this, arguments);
  const box = $("#left"), top = box.scrollTop;
  try { box.innerHTML = `<div data-p4>${viewLocal()}</div>`; } catch (e) { console.error(e); box.innerHTML = `<div class="sec"><div class="callout">${esc(tx("ext.err", { m: e.message }))}</div></div>`; }
  box.scrollTop = top; $("#app").classList.add("wide"); const a = $("#app"); if (a) a.dataset.tab = "local";
}; }
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("[data-lido],[data-lipick],[data-liradius],[data-liopen],[data-lidel]"); if (!t || S.tab !== "local") return;
  if (t.dataset.lido === "geo") return liGeo();
  if (t.dataset.lido === "sel") { if (S.selected != null) { liSetPoint({ lat: S.lat[S.selected], lon: S.lon[S.selected] }, "selected"); LI.results = null; } return liRender("#li-result-h"); }
  if (t.dataset.lipick != null) { const h = LI.results[+t.dataset.lipick]; if (h) { liSetPoint({ lat: S.lat[h.i], lon: S.lon[h.i], name: h.name }, "search"); LI.results = null; } return liRender("#li-result-h"); }
  if (t.dataset.liradius) { LI.radius = +t.dataset.liradius; return liRender(`[data-liradius="${LI.radius}"]`); }
  if (t.dataset.lido === "report") return liDownload();
  if (t.dataset.lido === "save") {
    if (!LI.consent || LI.i == null) return;
    const list = liSaved(); list.push({ name: jnPlaceText(LI.i), cell: S.cell[LI.i], radius: LI.radius, target: liTid(), saved: new Date().toISOString() });
    LI.msg = liStore(list) ? tx("v18.save.done") : tx("v18.save.fail"); return liRender("[data-lido=save]");
  }
  if (t.dataset.liopen != null) { const s = liSaved()[+t.dataset.liopen], i = s ? S.index[s.cell] : null; if (i != null) { LI.radius = s.radius || LI.radius; LI.tid = s.target || LI.tid; liSetPoint({ lat: S.lat[i], lon: S.lon[i] }, "saved"); } return liRender("#li-result-h"); }
  if (t.dataset.lidel != null) { const list = liSaved(); list.splice(+t.dataset.lidel, 1); liStore(list); LI.msg = tx("v18.save.deleted"); return liRender("[data-limsg]"); }
  if (t.dataset.lido === "delall") { liStore([]); LI.msg = tx("v18.save.deleted"); return liRender("[data-limsg]"); }
});
document.addEventListener("submit", e => { const f = e.target.closest && e.target.closest("[data-liform]"); if (!f) return; e.preventDefault(); liSearch(($("#li-q") || {}).value || ""); liRender(LI.i != null && LI.status !== "results" ? "#li-result-h" : "#li-q"); });
document.addEventListener("change", e => {
  const t = e.target; if (!t || !t.dataset || S.tab !== "local") return;
  if (t.dataset.litid != null) { LI.tid = t.value; liRender("[data-litid]"); }
  else if (t.dataset.liprec != null) { LI.precision = t.value; liRender("[data-liprec]"); }
  else if (t.dataset.liconsent != null) { LI.consent = t.checked; LI.msg = null; liRender("[data-liconsent]"); }
});
/* stacked layouts (tablets, phones): opening Local Impact brings its panel into view instead of the globe and ranking */
{ const f = setTab; setTab = function (t) { const r = f.apply(this, arguments); try { if (t === "local" && matchMedia("(max-width:1180px)").matches) { const l = $("#left"); if (l) setTimeout(() => l.scrollIntoView({ block: "start" }), 0); } } catch (e) { console.error(e); } return r; }; }
