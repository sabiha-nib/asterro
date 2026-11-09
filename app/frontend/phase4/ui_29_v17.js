/* ===== V17: science domains, novelty and diversity, environmental patterns, data registry, science layer, report =====
 * Everything here reads the V17 analytical products (ASTERRO_V17, scripts/build_v17.py) through AsterroV17 and the
 * unchanged engine. The baseline score, ranking, thresholds and 300 km rule are not touched.
 * Discover gains four hub entries (Surprise me, Science domains, Novelty and diversity, Patterns); the Data tab gains
 * the Data Integration Registry; the Atlas card and Laboratory steps 6 and 8 link to the new evidence; the globe gains
 * a "Science" layer. */
const V17D = typeof ASTERRO_V17 !== "undefined" ? ASTERRO_V17 : null;
const V7 = { inst: null, i: null, div: "baseline", km: 600, lam: 0.7, layerVar: "aridity_class", proc: null };
function v7() {
  if (!V17D || typeof AsterroV17 === "undefined" || !S.n) return null;
  if (!V7.inst) { try { V7.inst = AsterroV17.create(V17D, S.n); } catch (e) { console.error(e); return null; } }
  return V7.inst;
}
function v7Tid() { const t = S.targetId; return t && t !== "cross" && S.T[t] ? t : "mars_jezero"; }
function v7Body(tid) { return String((S.T[tid] || {}).body || "").toLowerCase() === "moon" ? "moon" : "mars"; }
function v7Rows(tid, i) {
  const c = jnCtx(tid), D = ENG.detail(S.A, S.critIds, i, c.tv, S.weights, c.ranges);
  return D.rows.map(r => ({ c: r.c, e: r.e, t: r.t, s: r.s == null || r.s !== r.s ? null : r.s, w: r.w }));
}
function v7Cov(tid, i) { const c = jnCtx(tid); return ENG.detail(S.A, S.critIds, i, c.tv, S.weights, c.ranges).coverage; }
function v7ProcHits(i) {
  if (!V7.proc) { V7.proc = []; try { for (const P of XD.processes.processes) if (P.status === "data" && P.rule) { const r = xtProcEval(P); if (r && r.hitSet) V7.proc.push({ id: P.id, set: r.hitSet }); } } catch (e) { console.error(e); } }
  return V7.proc.filter(p => p.set.has(i)).map(p => p.id);
}
function v7Ctx(i) {
  return { A: Object.assign({}, S.A, typeof xtStack === "function" ? { t2m_mean_c: S.A.t2m_mean_c } : {}),
    gentle5: j => (typeof xcSlopeShare === "function" ? xcSlopeShare(j, 5) : null),
    noon: j => (typeof xcNoon === "function" ? xcNoon(S.lat[j], "earth").hi : null),
    ops: j => (typeof xcOps === "function" ? xcOps(j, v7Tid()) : null) };
}
function v7Num(v, x) {
  if (x == null) return esc(tx("val.na"));
  if (typeof x === "string") return esc(tx("v17.cls." + x));
  if (typeof x === "object" && x.id) return esc(tx("ext.op." + x.id + ".name")) + " · " + esc(txNum(x.mean, 2));
  const dp = Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2;
  return esc(txNum(x, Number.isInteger(x) ? 0 : dp));
}
function v7Kind(k) { return `<span class="v7-kind ${esc(k)}">${esc(tx("v17.kind." + k))}</span>`; }
function v7State(s) { return `<span class="v7-st ${esc(s)}">${esc(tx("v17.state." + s))}</span>`; }
function v7PlacePicker(i) {
  const top = S.res ? Array.from(S.res.distinct.slice(0, 20)) : [];
  if (i != null && !top.includes(i)) top.unshift(i);
  return `<label class="xt-field"><span>${esc(tx("v17.place"))}</span><select data-v7place>${top.map(c => `<option value="${c}"${c === i ? " selected" : ""}>${esc(jnPlaceText(c))} · ${esc(txPct(S.res.eff[c]))}</option>`).join("")}</select></label>`;
}
function v7Cur() { if (V7.i == null || !(S.res && S.res.eff[V7.i] >= -1)) V7.i = S.selected != null ? S.selected : (S.res ? S.res.distinct[0] : null); return V7.i; }

/* ------------------------------------------------------------------ Science domains */
function v7Separate(i, tid) {
  const eff = S.res && S.res.tid === tid ? S.res.eff[i] : simFor(tid, S.weights).eff[i];
  const cov = v7Cov(tid, i), proc = v7ProcHits(i), ops = typeof xcOps === "function" ? xcOps(i, tid).filter(o => o.mean != null).sort((a, b) => b.mean - a.mean) : [];
  const st = S.T[tid].status || {}, dir = S.critIds.filter(c => st[c] === "DIRECT").length, prx = S.critIds.filter(c => st[c] === "PROXY").length;
  const row = (k, v, note) => `<tr data-v7sepk="${k}"><th scope="row">${esc(tx("v17.sep." + k))}<br><span class="meta v7-note">${esc(note)}</span></th><td>${v}</td></tr>`;
  return `<h4 class="xt-h">${esc(tx("v17.sep.title"))}</h4><p class="note small">${esc(tx("v17.sep.p"))}</p>
    <div class="tbl-wrap"><table class="t xt-t v7-sep" data-v7sep><tbody>
    ${row("env", eff >= 0 ? esc(txPct(eff)) : esc(tx("val.na")), tx("v17.sep.env_n"))}
    ${row("process", esc(txInt(proc.length)) + (proc.length ? " · " + proc.map(p => esc(tx("ext.proc." + p + ".name"))).join(", ") : ""), tx("v17.sep.process_n"))}
    ${row("ops", ops.length ? esc(tx("ext.op." + ops[0].id + ".name")) + " · " + esc(txNum(ops[0].mean, 2)) : esc(tx("val.na")), tx("v17.sep.ops_n"))}
    ${row("complete", esc(txPct(cov, 0)), tx("v17.sep.complete_n"))}
    ${row("evidence", esc(tx("v17.sep.evidence_v", { d: txInt(dir), p: txInt(prx), n: txInt(S.critIds.length) })), tx("v17.sep.evidence_n"))}
    </tbody></table></div>`;
}
function v7ModuleHTML(m) {
  const rows = m.rows.length ? `<div class="tbl-wrap"><table class="t xt-t v7-mod-t"><thead><tr><th scope="col">${esc(tx("v17.col.var"))}</th><th scope="col" class="n">${esc(tx("v17.col.value"))}</th><th scope="col">${esc(tx("v17.col.kind"))}</th><th scope="col" class="ds-adv">${esc(tx("v17.col.source"))}</th></tr></thead><tbody>
    ${m.rows.map(r => `<tr data-v7var="${esc(r.var)}"><th scope="row">${esc(tx("v17.var." + r.var))}</th><td class="n">${v7Num(r.var, r.value)} <span class="meta">${r.value != null && typeof r.value === "number" ? esc(tx("v17.unit." + r.var)) : ""}</span></td><td>${v7Kind(r.kind)}</td><td class="ds-adv meta">${keep(r.source)} · ${keep(r.resolution || "")}${r.period ? " · " + keep(r.period) : ""}</td></tr>`).join("")}</tbody></table></div>` : `<p class="note">${esc(tx("v17.mod.noinputs"))}</p>`;
  const blk = m.blocked.length ? `<p class="note small">${esc(tx("v17.mod.blocked"))} ${m.blocked.map(b => `${keep(b.id)} (${v7State(b.state)})`).join(", ")}</p>` : "";
  const comp = m.completeness == null ? "" : ` · ${esc(tx("v17.mod.complete", { k: txInt(m.have), n: txInt(m.need) }))}`;
  return `<details class="v7-mod" data-v7mod="${esc(m.id)}" data-v7status="${esc(m.status)}"${m.status !== "blocked" ? " open" : ""}><summary><b>${esc(tx("v17.mod." + m.id))}</b> <span class="v7-ms ${esc(m.status)}">${esc(tx("v17.mstatus." + m.status))}</span><span class="meta">${comp}</span></summary>
    <p class="note">${esc(tx("v17.modq." + m.id))}</p>${rows}${blk}
    <div class="ds-adv v7-mod-adv" lang="en"><p class="meta small"><b>${esc(tx("v17.mod.limits"))}</b> ${esc(m.limits)}</p><p class="meta small"><b>${esc(tx("v17.mod.validation"))}</b> ${esc(m.validation.method)} (${esc(m.validation.state)}) · ${keep(m.version)}</p>${m.target.length ? `<p class="meta small"><b>${esc(tx("v17.mod.target"))}</b> ${esc(m.target.join("; "))}</p>` : ""}</div></details>`;
}
function v7Limits(tid) {
  const body = v7Body(tid);
  return `<h4 class="xt-h">${esc(tx("v17.lim.title"))}</h4><p class="note small">${esc(tx("v17.lim.p"))}</p><div class="tbl-wrap"><table class="t xt-t" data-v7limits><thead><tr><th scope="col">${esc(tx("v17.lim.cond"))}</th><th scope="col">${esc(tx("v17.lim.earth"))}</th><th scope="col">${esc(jnBody(tid))}</th><th scope="col">${esc(tx("v17.lim.site"))}</th></tr></thead><tbody>
    ${V17D.limits.items.map(it => { const f = o => o.value == null ? esc(tx("v17.lim.q." + it.id + "." + (o === it.earth ? "earth" : body))) : Array.isArray(o.value) ? `${esc(txNum(o.value[0], 0))}–${esc(txNum(o.value[1], 0))} ${keep(o.unit)}` : `${esc(txNum(o.value, o.value % 1 ? 2 : 0))} ${keep(o.unit || "")}`;
      return `<tr data-v7lim="${it.id}"><th scope="row">${esc(tx("v17.lim." + it.id))}</th><td>${f(it.earth)}</td><td>${f(it[body])} <span class="meta">${esc(tx("v17.kind." + (it[body].kind === "measured" ? "direct" : it[body].kind === "reference" ? "reference" : "qualitative")))}</span></td><td>${esc(tx("v17.lim.site_" + it.earth_site))}</td></tr>`; }).join("")}</tbody></table></div>`;
}
function v7HubDomains() {
  const V = v7(); if (!V) return `<div class="sec"><p class="note">${esc(tx("v17.na"))}</p></div>`;
  const i = v7Cur(), tid = v7Tid();
  if (i == null) return `<div class="sec"><p class="note">${esc(tx("v17.pick_first"))}</p></div>`;
  const mods = V.modules(i, v7Ctx(i)), nv = V.novelty(i), pt = V.pattern(i);
  return `<div class="sec" data-v7domains><h3>${esc(tx("v17.dom.title"))}</h3><p class="note">${esc(tx("v17.dom.p"))}</p>
    <div class="v7-row">${v7PlacePicker(i)}${xtTidSel("v7tid", tid)}</div>
    <p class="meta">${jnPlace(i)} · ${esc(txLL(S.lat[i], S.lon[i]))} · ${esc(tx("v17.nov.cls." + nv.cls))}${pt ? " · " + esc(tx("v17.pat.cluster", { k: txInt(pt.cluster + 1) })) : ""}</p>
    ${v7Separate(i, tid)}
    <h4 class="xt-h">${esc(tx("v17.dom.modules"))}</h4><p class="note small">${esc(tx("v17.dom.modules_p"))}</p>
    <div class="v7-mods">${mods.map(v7ModuleHTML).join("")}</div>
    ${v7Limits(tid)}
    <p class="note small ds-adv">${esc(tx("v17.en_note"))}</p></div>`;
}

/* ------------------------------------------------------------------ Novelty and diversity */
function v7Feat(i) { const r = S.app.ranges; return S.critIds.map(c => { const x = S.A[c][i]; return x - x === 0 ? (x - r[c][0]) / (r[c][1] - r[c][0]) : 0.5; }); }
function v7Diverse(tid) {
  const V = v7(), eff = S.res && S.res.tid === tid ? S.res.eff : simFor(tid, S.weights).eff;
  if (V7.div === "baseline") return S.res && S.res.tid === tid ? Array.from(S.res.distinct.slice(0, 20)) : [];
  const order = []; for (let i = 0; i < S.n; i++) if (eff[i] >= 0) order.push(i);
  order.sort((a, b) => (eff[b] - eff[a]) || (S.cell[a] - S.cell[b]));
  const top = order.slice(0, 4000);
  if (V7.div === "km") return V.diversify(top, S.lat, S.lon, { method: "km", km: V7.km, n: 20 });
  if (V7.div === "region") return V.diversify(top, S.lat, S.lon, { method: "region", label: j => (S.A.country ? S.A.country[j] : null), n: 20 });
  return V.diversify(top, S.lat, S.lon, { method: "mmr", lambda: V7.lam, feat: v7Feat, score: j => eff[j], n: 20, pool: 400 });
}
function v7HubNovelty() {
  const V = v7(); if (!V) return `<div class="sec"><p class="note">${esc(tx("v17.na"))}</p></div>`;
  const tid = v7Tid(), eff = S.res && S.res.tid === tid ? S.res.eff : simFor(tid, S.weights).eff, list = v7Diverse(tid), N = V17D.patterns.novelty;
  const opt = (k) => `<button type="button" data-v7div="${k}" aria-pressed="${V7.div === k}">${esc(tx("v17.div." + k))}</button>`;
  const ctl = V7.div === "km" ? `<label class="xt-field"><span>${esc(tx("v17.div.km_l"))}</span><input type="number" min="100" max="3000" step="100" value="${V7.km}" data-v7km></label>`
    : V7.div === "mmr" ? `<label class="xt-field"><span>${esc(tx("v17.div.lam_l"))}</span><input type="number" min="0" max="1" step="0.1" value="${V7.lam}" data-v7lam></label>` : "";
  return `<div class="sec" data-v7novelty><h3>${esc(tx("v17.nov.title"))}</h3><p class="note">${esc(tx("v17.nov.p"))}</p>
    <div class="v7-row">${xtTidSel("v7tid", tid)}</div>
    <div class="ds-seg ds-wrap" role="group" aria-label="${esc(tx("v17.div.aria"))}">${["baseline", "km", "mmr", "region"].map(opt).join("")}</div>${ctl}
    <p class="note small">${esc(tx("v17.div." + V7.div + "_p"))}</p>
    <div class="tbl-wrap"><table class="t xt-t" data-v7divt><thead><tr><th scope="col">#</th><th scope="col">${esc(tx("v17.place"))}</th><th scope="col" class="n">${esc(tx("v17.col.sim"))}</th><th scope="col">${esc(tx("v17.nov.class"))}</th><th scope="col" class="n">${esc(tx("v17.nov.uniq"))}</th><th scope="col" class="n">${esc(tx("v17.nov.km"))}</th></tr></thead><tbody>
    ${list.map((i, k) => { const nv = V.novelty(i); return `<tr data-v7cell="${S.cell[i]}"><td>${esc(txInt(k + 1))}</td><td>${xtPlaceBtn(i)}</td><td class="n">${esc(txPct(eff[i]))}</td><td>${esc(tx("v17.nov.cls." + nv.cls))}</td><td class="n">${nv.uniq != null ? esc(txInt(nv.uniq)) : "–"}</td><td class="n">${nv.km != null ? esc(txInt(nv.km)) : "–"}</td></tr>`; }).join("")}</tbody></table></div>
    <h4 class="xt-h">${esc(tx("v17.nov.method"))}</h4><p class="note small">${esc(tx("v17.nov.method_p", { k: txInt(N.k), r: txInt(N.radius_km) }))}</p>
    <ul class="xt-list">${N.classes.map(c => `<li><b>${esc(tx("v17.nov.cls." + c))}</b> · ${esc(txInt(N.counts[c]))} ${esc(tx("v17.cells"))} · ${esc(tx("v17.nov.def." + c))}</li>`).join("")}</ul>
    <p class="note small">${esc(tx("v17.nov.not_importance"))}</p></div>`;
}

/* ------------------------------------------------------------------ Patterns (unsupervised learning) */
function v7HubPatterns() {
  const V = v7(); if (!V) return `<div class="sec"><p class="note">${esc(tx("v17.na"))}</p></div>`;
  const M = V17D.patterns.ml, a = M.agreement_koppen, tid = v7Tid(), eff = S.res && S.res.tid === tid ? S.res.eff : simFor(tid, S.weights).eff;
  const fi = k => M.features.indexOf(k), nm = n => n.map(w => tx("v17.pat.w." + w)).join(" · ");
  return `<div class="sec" data-v7patterns><h3>${esc(tx("v17.pat.title"))}</h3><p class="note">${esc(tx("v17.pat.p"))}</p>
    <h4 class="xt-h">${esc(tx("v17.pat.clusters", { k: txInt(M.k) }))}</h4>
    <div class="tbl-wrap"><table class="t xt-t" data-v7clusters><thead><tr><th scope="col">#</th><th scope="col">${esc(tx("v17.pat.name"))}</th><th scope="col" class="n">${esc(tx("v17.cells"))}</th><th scope="col" class="n">${esc(tx("v17.var.t2m_mean_c"))}</th><th scope="col" class="n">${esc(tx("crit.aridity"))}</th><th scope="col" class="n">${esc(tx("crit.surface_roughness"))}</th></tr></thead><tbody>
    ${M.centers.map((c, k) => `<tr><td>${esc(txInt(k + 1))}</td><td>${esc(nm(M.names[k]))}</td><td class="n">${esc(txInt(M.sizes[k]))}</td><td class="n">${esc(txNum(c[fi("t2m_mean_c")], 1))} °C</td><td class="n">${esc(txNum(c[fi("aridity")], 2))}</td><td class="n">${esc(txInt(Math.round(c[fi("surface_roughness")])))} m</td></tr>`).join("")}</tbody></table></div>
    <p class="note small" data-v7agree>${esc(tx("v17.pat.agree", { ari: txNum(a.ari_main_groups, 2), nmi: txNum(a.nmi_main_groups, 2), ari30: txNum(a.ari_30_classes, 2) }))}</p>
    <h4 class="xt-h">${esc(tx("v17.pat.hidden"))}</h4><p class="note small">${esc(tx("v17.pat.hidden_p", { rho: txNum(M.spearman_isolation_vs_knn, 2) }))}</p>
    <ul class="xt-list" data-v7hidden>${M.hidden_cells.map(i => `<li>${xtPlaceBtn(i)} · ${esc(txLL(S.lat[i], S.lon[i]))} · ${esc(tx("v17.pat.score_for", { t: jnTNameText(tid) }))} ${eff[i] >= 0 ? esc(txPct(eff[i])) : esc(tx("val.na"))}</li>`).join("")}</ul>
    <details class="ds-adv"><summary>${esc(tx("v17.pat.method"))}</summary><p class="meta small" lang="en">k-means (scikit-learn ${keep(M.sklearn)}, n_init 10, random_state 0; k ${keep("6–12")} by silhouette: ${Object.entries(M.silhouette).map(([k, s]) => keep(k + ": " + s.toFixed(3))).join(", ")}). IsolationForest (300 trees, 4096 samples, random_state 0). Features (z-scored over ${keep(String(M.complete_cells))} complete cells): ${M.features.map(keep).join(", ")}. ${keep(M.version)}.</p></details>
    <p class="note small">${esc(tx("v17.pat.limits"))}</p></div>`;
}

/* ------------------------------------------------------------------ hub integration */
if (typeof XHUB !== "undefined") { for (const h of ["surprise", "domains", "novelty", "patterns"]) if (!XHUB.includes(h)) XHUB.splice(XHUB.indexOf("learn"), 0, h); }
{ const f = viewDiscover; viewDiscover = function () {
  const H = { domains: v7HubDomains, novelty: v7HubNovelty, patterns: v7HubPatterns, surprise: typeof v7HubSurprise === "function" ? v7HubSurprise : null };
  if (!H[XT.hub] || !XD || !S.A || !S.A.cell) return f.apply(this, arguments);
  let body; try { body = `<div data-i18n-done>${(H[XT.hub] || (() => ""))()}</div>`; } catch (e) { console.error(e); body = `<div class="sec"><div class="callout">${esc(tx("ext.err", { m: e.message }))}</div></div>`; }
  return xtHubNav() + body;
}; }
function v7Open(hub, i) { if (i != null) { V7.i = i; } XT.hub = hub; if (S.tab !== "discover") setTab("discover"); else renderLeft(); }
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("[data-v7div],[data-v7dom],[data-v7report]"); if (!t) return;
  if (t.dataset.v7div) { V7.div = t.dataset.v7div; renderLeft(); }
  else if (t.dataset.v7dom != null) v7Open("domains", +t.dataset.v7dom);
  else if (t.dataset.v7report != null) v7DownloadReport(+t.dataset.v7report);
});
document.addEventListener("change", e => {
  const t = e.target; if (!t || !t.dataset) return;
  if (t.dataset.v7place != null) { V7.i = +t.value; renderLeft(); }
  else if (t.dataset.v7km != null) { V7.km = Math.max(100, Math.min(3000, +t.value || 600)); renderLeft(); }
  else if (t.dataset.v7lam != null) { V7.lam = Math.max(0, Math.min(1, +t.value)); renderLeft(); }
  else if (t.dataset.xtin === "v7tid") { if (t.value !== S.targetId) setTarget(t.value); }
});

/* ------------------------------------------------------------------ Data tab: the Data Integration Registry */
function v7Registry() {
  if (!V17D) return "";
  const R = V17D.registry, by = s => R.sources.filter(x => x.state === s);
  return `<div class="sec" data-v7registry data-i18n-done><h3>${esc(tx("v17.reg.title"))}</h3><p class="note">${esc(tx("v17.reg.p", { t: R.probed_utc }))}</p>
    <ul class="xt-list">${R.states.map(s => `<li>${v7State(s.id)} · ${esc(txInt(R.counts[s.id]))}</li>`).join("")}</ul>
    <div class="tbl-wrap"><table class="t xt-t v7-reg" data-v7regt><thead><tr><th scope="col">${esc(tx("v17.reg.source"))}</th><th scope="col">${esc(tx("v17.reg.domain"))}</th><th scope="col">${esc(tx("v17.reg.state"))}</th><th scope="col" class="ds-adv">${esc(tx("v17.reg.res"))}</th><th scope="col" class="ds-adv">${esc(tx("v17.reg.detail"))}</th></tr></thead><tbody>
    ${R.states.flatMap(s => by(s.id)).map(x => `<tr data-v7src="${esc(x.id)}" data-v7state="${esc(x.state)}"><th scope="row">${keep(x.title || x.id)}<br><span class="meta">${keep(x.provider || "–")}</span></th><td>${esc(tx("v17.dom." + (x.domain || "other")))} · ${esc(tx("v17.body." + x.body.replace("+", "_")))}</td><td>${v7State(x.state)}</td><td class="ds-adv meta">${keep(x.spatial || "–")}</td><td class="ds-adv meta" lang="en">${esc(x.probe && x.probe.error ? x.probe.error : x.validation || x.note || x.access || "")}</td></tr>`).join("")}</tbody></table></div>
    <p class="note small">${esc(tx("v17.reg.never"))}</p></div>`;
}
{ const f = viewData; viewData = function () { let h = f.apply(this, arguments); try { h += v7Registry(); } catch (e) { console.error(e); } return h; }; }

/* ------------------------------------------------------------------ Atlas card and Laboratory links */
{ const f = dsaCard; dsaCard = function () {
  const r = f.apply(this, arguments);
  try {
    const c = document.getElementById("ds-acard"), V = v7(), i = S.selected;
    if (c && V && i != null && c.dataset.dsacard !== "hint" && !c.querySelector("[data-v7dom]")) {
      const nv = V.novelty(i), act = c.querySelector(".dsa-act");
      const p = document.createElement("p"); p.className = "dsa-l"; p.innerHTML = `<span>${esc(tx("v17.nov.class"))}:</span> ${esc(tx("v17.nov.cls." + nv.cls))}`;
      if (act) act.insertAdjacentElement("beforebegin", p);
      if (act) act.insertAdjacentHTML("beforeend", `<button type="button" class="btn-ghost btn-sm" data-v7dom="${i}">${esc(tx("v17.dom.open"))}</button>`);
    }
  } catch (e) { console.error(e); }
  return r;
}; }
{ const f = dsfStep; dsfStep = function (k) {
  let h = f.apply(this, arguments);
  try {
    const i = dsfCand();
    if (i != null && k === "evidence") h += `<p class="note small v7-link">${esc(tx("v17.lab.domains_p"))} <button type="button" class="btn-ghost btn-sm" data-v7dom="${i}">${esc(tx("v17.dom.open"))}</button></p>`;
    if (i != null && k === "reproduce") h += `<p class="note small v7-link">${esc(tx("v17.lab.report_p"))} <button type="button" class="btn-ghost btn-sm" data-v7report="${i}">${esc(tx("v17.report.btn"))}</button></p>`;
  } catch (e) { console.error(e); }
  return h;
}; }

/* ------------------------------------------------------------------ 20-section research report */
function v7ReportData(i, tid) {
  const T = S.T[tid], rows = v7Rows(tid, i), st = T.status || {}, th = S.app.thresholds, cov = v7Cov(tid, i);
  const eff = S.res && S.res.tid === tid ? S.res.eff[i] : simFor(tid, S.weights).eff[i];
  const crit = c => S.app.criteria.find(x => x.id === c) || {}, lbl = c => tx("crit." + c);
  const srcOf = c => { let ids = crit(c).earth_source; if (typeof ids === "string") { try { ids = JSON.parse(ids.replace(/'/g, '"')); } catch (e) { ids = [ids]; } } return (ids || []).map(id => S.app.datasets.find(d => d.id === id)).filter(Boolean); };
  const fmt = (c, x) => x == null || x !== x ? null : +x.toFixed(3) + " " + (crit(c).unit || "");
  const V = v7(), mods = V.modules(i, v7Ctx(i)), ops = typeof xcOps === "function" ? xcOps(i, tid).filter(o => o.mean != null).sort((a, b) => b.mean - a.mean).slice(0, 3) : [];
  const body = v7Body(tid), place = jnPlaceText(i);
  const used = new Set(); for (const c of S.critIds) for (const d of srcOf(c)) used.add(d.id);
  const dsets = S.app.datasets.filter(d => used.has(d.id) || (body === "mars" ? ["mola", "meda"] : ["lola", "diviner"]).includes(d.id));
  return {
    title: tx("v17.report.title", { place, target: jnTNameText(tid) }),
    question: tx("v17.report.q", { place, target: jnTNameText(tid) }),
    when: new Date().toISOString(),
    versions: [S.app.algorithm_version, V.VERSION, V17D.cube.version, V17D.patterns.novelty.version],
    target: { id: tid, name: jnTNameText(tid), body },
    place: { name: place, coords: txLL(S.lat[i], S.lon[i]), cell: S.cell[i] },
    scale: tx("v17.report.scale"),
    sources: dsets.map(d => `${d.provider}: ${d.dataset} (${d.resolution || "resolution not recorded"}; ${d.temporal || "period not recorded"})`),
    dataVersions: dsets.map(d => `${d.id}: ${d.version || "not recorded"}`).concat([`ASTERRO_V17 cube sha256 ${V17D.sha256.cube}`, `ASTERRO_V17 patterns sha256 ${V17D.sha256.patterns}`]),
    measurements: rows.map(r => ({ c: lbl(r.c), e: fmt(r.c, r.e), t: fmt(r.c, r.t), kind: st[r.c] || null, src: srcOf(r.c).map(d => d.id).join(", ") || null })),
    method: [tx("v17.report.m1", { a: S.app.algorithm_version }), tx("v17.report.m2", { m: txNum(th.match, 2), p: txNum(th.partial, 2), c: txPct(th.min_coverage, 0) }), tx("v17.report.m3", { p: S.profile })],
    result: tx("v17.report.result", { p: eff >= 0 ? txPct(eff) : tx("val.na"), c: txPct(cov, 0) }),
    similar: rows.filter(r => r.s != null && r.s >= th.match).map(r => `${lbl(r.c)}: s = ${r.s.toFixed(2)}`),
    different: rows.filter(r => r.s != null && r.s < th.partial).map(r => `${lbl(r.c)}: s = ${r.s.toFixed(2)}`),
    uncertainty: [tx("v17.report.u1"), tx("v17.report.u2", { n: txInt(S.critIds.filter(c => st[c] === "PROXY").length) }), tx("v17.report.u3"), tx("v17.report.u4")],
    missing: rows.filter(r => r.s == null).map(r => lbl(r.c)).concat(mods.filter(m => m.status === "blocked").map(m => tx("v17.report.blocked", { m: tx("v17.mod." + m.id) }))),
    relevance: ops.map(o => `${tx("ext.op." + o.id + ".name")}: ${o.mean.toFixed(2)} (${tx("state." + o.k)})`).concat([tx("v17.report.rel_note")]),
    limits: V17D.limits.items.filter(x => x.earth_site !== "yes").map(x => `${tx("v17.lim." + x.id)}: ${tx("v17.lim.site_" + x.earth_site)}`),
    conclusion: tx("v17.report.conclusion", { place, target: jnTNameText(tid), p: eff >= 0 ? txPct(eff) : tx("val.na") }),
    repro: { algorithm: S.app.algorithm_version, v17: V.VERSION, target: tid, cell: S.cell[i], lat: S.lat[i], lon: S.lon[i], profile: S.profile, weights: { ...S.weights }, thresholds: th, v17_sha256: V17D.sha256, app_file_hashes: S.app.file_hashes || null },
    refs: dsets.map(d => `${d.provider}. ${d.dataset}. ${d.version || ""}. ${d.url || ""}`).concat(["ASTERRO (2026). Planetary analogue intelligence, V17 analytical products (scripts/build_v17.py)."]),
  };
}
function v7DownloadReport(i) {
  const tid = v7Tid(), md = AsterroV17.report(v7ReportData(i, tid));
  const b = new Blob([md], { type: "text/markdown" }), u = URL.createObjectURL(b), a = document.createElement("a");
  a.href = u; a.download = `asterro-research-report-${tid}-cell${S.cell[i]}.md`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000);
  if (typeof v7Award === "function") v7Award("reproducibility");
}

/* ------------------------------------------------------------------ globe: Science layer */
const V7L = ["freeze_months", "ft_air_months", "dry_months", "precip_cv", "polar_night_months", "toa_annual_wm2", "lst_dr_iav_k", "aridity_class", "landform_class", "uniqueness", "anomaly"];
const V7L_RANGE = { freeze_months: [0, 12], ft_air_months: [0, 12], dry_months: [0, 12], precip_cv: [0, 2], polar_night_months: [0, 6], toa_annual_wm2: [170, 420], lst_dr_iav_k: [0, 3], aridity_class: [0, 4], landform_class: [0, 4], uniqueness: [0, 100], anomaly: [0, 100] };
const V7L_RAMP = ["#2b5d66", "#3f8a80", "#8fb07a", "#d9b45a", "#f6e7c1"];
/* dry is sand-coloured, wet is teal: the aridity zones (hyper-arid first) use the ramp reversed */
const v7Ramp = v => (v === "aridity_class" ? V7L_RAMP.slice().reverse() : V7L_RAMP);
function v7LayerVal(V, v, i) {
  if (v === "uniqueness") { const n = V.novelty(i); return n.uniq == null ? null : n.uniq; }
  if (v === "anomaly") { const p = V.pattern(i); return p && p.anomaly != null ? p.anomaly : null; }
  return V.val(v, i);
}
function v7Paint() {
  const g = window.GLOBE, V = v7(); if (!g || !V) return;
  const v = V7.layerVar, [lo, hi] = V7L_RANGE[v], d = g.fieldData; d.fill(0);
  for (let i = 0; i < S.n; i++) { const x = v7LayerVal(V, v, i); if (x == null) continue; const c = S.cell[i] * 4; d[c] = Math.round(clamp((x - lo) / (hi - lo), 0, 1) * 255); d[c + 1] = 0; d[c + 2] = 0; d[c + 3] = 1; }
  g.lo = 0; g.hi = 1; g.ramp = v7Ramp(v); g.layer = 0; g.uploadField();
}
{ const f = paintField; paintField = function () { if (S.layer === "science") { if (window.GLOBE) GLOBE.layer = 0; return v7Paint(); } return f.apply(this, arguments); }; }
{ const f = setLayer; setLayer = function (l) {
  if (l === "science") {
    if (!v7()) return;
    S.layer = l; $$("[data-layer]").forEach(b => b.setAttribute("aria-pressed", b.dataset.layer === l));
    GLOBE.layer = 0; GLOBE.reveal = 1; v7Paint(); GLOBE.dirty = true; renderLegend(); return;
  }
  const was = S.layer, r = f.apply(this, arguments);
  if (was === "science") { paintField(); GLOBE.dirty = true; }
  return r;
}; }
{ const f = renderLegend; renderLegend = function () {
  if (S.layer !== "science") return f.apply(this, arguments);
  const L = $("#legend"); if (!L) return;
  const v = V7.layerVar, [lo, hi] = V7L_RANGE[v], cat = v === "aridity_class" || v === "landform_class";
  const ticks = cat ? V17D.cube.classes[v].map(c => `<span>${esc(tx("v17.cls." + c))}</span>`).join("") : `<span>${esc(txNum(lo, 0))}</span><span>${esc(txNum(hi, hi < 10 ? 1 : 0))}${hi === 12 || hi === 6 ? "" : ""}</span>`;
  L.innerHTML = `<h4>${esc(tx("v17.layer.title"))}</h4><label class="gl-dim"><span class="sr-only">${esc(tx("v17.layer.pick"))}</span><select id="v7-layer" aria-label="${esc(tx("v17.layer.pick"))}">${V7L.map(k => `<option value="${k}"${k === v ? " selected" : ""}>${esc(tx("v17.var." + k))}</option>`).join("")}</select></label>
    <div class="ramp" style="background:linear-gradient(90deg,${v7Ramp(v).join(",")})"></div><div class="ticks v7-ticks">${ticks}</div>
    <p class="meta gl-note" data-v7legend>${tx("v17.unit." + v) ? esc(tx("v17.unit." + v)) + " · " : ""}${esc(tx("v17.layer.src." + v))}</p><p class="meta gl-note">${esc(tx("v17.layer.lim." + v))}</p>`;
}; }
document.addEventListener("change", e => { if (e.target && e.target.id === "v7-layer") { V7.layerVar = e.target.value; v7Paint(); GLOBE.dirty = true; renderLegend(); const s = $("#v7-layer"); if (s) s.focus(); } });
(function v7LayerButton() {
  const seg = $("#layer-delta") && $("#layer-delta").parentElement; if (!seg || $("#layer-science") || !V17D) return;
  const b = document.createElement("button"); b.id = "layer-science"; b.dataset.layer = "science"; b.setAttribute("aria-pressed", "false"); b.dataset.i18nKey = "v17.layer.btn"; b.textContent = tx("v17.layer.btn"); seg.appendChild(b);
})();
document.addEventListener("asterro:lang", () => { if (S.layer === "science") renderLegend(); });

/* the V17 hub views use the wide research layout, like the Data and Method tabs */
const V7_WIDE = new Set(["surprise", "domains", "novelty", "patterns"]);
{ const f = renderLeft; renderLeft = function () { const r = f.apply(this, arguments); try { if (S.tab === "discover" && V7_WIDE.has(XT.hub)) { const a = document.getElementById("app"); if (a && !a.classList.contains("wide")) { a.classList.add("wide"); if (window.GLOBE) setTimeout(() => GLOBE.resize && GLOBE.resize(), 0); } } } catch (e) { console.error(e); } return r; }; }
