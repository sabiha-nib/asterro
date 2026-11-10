/* ===== ASTERRO V19 planetary intelligence: interface =====
 * Adds, without new top-level tabs:
 *   Discover › Science domains   why the candidate ranked, nine separate measures, sixteen domains, objective profiles,
 *                                 the most important physical differences
 *   Discover › Patterns           validation of the V17 patterns (stability, sensitivity, geographic bias)
 *   Local Impact                  the sixteen domains at the analysed cell, and the objective profiles
 *   Data                          the V19 Data Integration Registry (nine states, last attempt per dataset)
 *   Site samples (V19.1)          geology (Macrostrat map units, GVP volcanoes within 100 km) and biological records
 *                                 (GBIF) at the 16 sampled cells; material evidence beside published target observations
 * Uses AsterroV19 (engine_v19.js), the V18 variable registry (AsterroLocal.VARS) and ASTERRO_V19 (data_v19.js).
 * Nothing here changes the baseline engine, the V17 products or the V18 module. */
const V19D = typeof ASTERRO_V19 !== "undefined" ? ASTERRO_V19 : null;
const V9_RANK = ["integrated_validated", "integrated_awaiting_validation", "processing", "acquired_awaiting_processing", "awaiting_credentials", "provider_unavailable", "access_blocked", "unsuitable", "not_investigated"];
let V9_REG = null, V9_VARS = null;
function v9Reg() {
  if (V9_REG || !V19D) return V9_REG || {};
  const R = {};  // one state per dataset id: the most advanced of its rows (V17 row and V19 catalogue row)
  for (const s of V19D.registry.sources) { const id = s.id.replace(/@v19$/, ""); if (!R[id] || V9_RANK.indexOf(s.state) < V9_RANK.indexOf(R[id].state)) R[id] = s; }
  return (V9_REG = R);
}
function v9Vars() { if (!V9_VARS && typeof AsterroLocal !== "undefined") V9_VARS = Object.fromEntries(AsterroLocal.VARS.map(v => [v.id, v])); return V9_VARS || {}; }
function v9Ready() { return !!(V19D && typeof AsterroV19 !== "undefined" && typeof AsterroLocal !== "undefined" && typeof liAt === "function" && S.A && S.res); }
function v9St(s) { return `<span class="v7-st v9-st ${esc(s)}">${esc(tx("v19.state." + s))}</span>`; }
function v9DsName(id) { const r = v9Reg()[id]; return keep(r && r.title ? r.title : id); }
function v9Sample(i) { return V19D && V19D.samples ? AsterroV19.sampleFor(V19D.samples, S.cell[i]) : null; }
function v9DomainsAt(i) {
  const c = liAt(i), reg = v9Reg(), vars = v9Vars(), out = {}, smp = v9Sample(i);
  for (const d of AsterroV19.DOMAINS) out[d.id] = AsterroV19.evaluate(d, c, reg, vars, smp);
  return out;
}
function v9Ctx(i, tid) {
  const eff = (S.res && S.res.tid === tid ? S.res.eff : simFor(tid, S.weights).eff);
  let rank = 1, ranked = 0; for (let j = 0; j < S.n; j++) if (eff[j] >= 0) { ranked++; if (eff[j] > eff[i]) rank++; }
  let distinctKm = null;
  if (S.res && S.res.tid === tid) {
    const top = Array.from(S.res.distinct.slice(0, 20));
    if (top.includes(i)) for (const j of top) if (j !== i) { const d = AsterroLocal.km(S.lat[i], S.lon[i], S.lat[j], S.lon[j]); if (distinctKm == null || d < distinctKm) distinctKm = d; }
  }
  const V = v7();
  return { eff: eff[i], rank: eff[i] >= 0 ? rank : null, ranked, cov: v7Cov(tid, i), rows: v7Rows(tid, i), tkind: S.T[tid].status || {},
    procHits: typeof v7ProcHits === "function" ? v7ProcHits(i) : null, ops: typeof xcOps === "function" ? xcOps(i, tid) : [], novelty: V ? V.novelty(i) : null, distinctKm, domains: v9DomainsAt(i), thr: S.app.thresholds };
}
const v9C = c => esc(tx("crit." + c + ".s"));
const v9List = a => a.length ? a.map(v9C).join(", ") : "–";
/* ------------------------------------------------------------------ why this candidate ranked */
function v9Interp(ctx, tid) {
  const I = AsterroV19.interpret(ctx);
  const li = (k, v) => `<li data-v9int="${k}"><b>${esc(tx("v19.interp." + k))}:</b> ${v}</li>`;
  return `<h4 class="xt-h">${esc(tx("v19.interp.title"))}</h4>
    <p class="note">${esc(I.rank ? tx("v19.interp.rank", { r: txInt(I.rank), n: txInt(I.ranked), t: jnTNameText(tid) }) : tx("v19.interp.unranked", { t: jnTNameText(tid) }))}</p>
    <ul class="xt-list" data-v9interp>${li("drivers", v9List(I.drivers))}${li("supporting", v9List(I.supporting))}${li("partial", v9List(I.partial))}${li("contradicting", v9List(I.contradicting))}${li("missing", v9List(I.missing))}
    ${li("direct", v9List(I.direct))}${li("proxy", v9List(I.proxy))}
    ${li("apps", I.applications.length ? I.applications.map(o => esc(tx("ext.op." + o + ".name"))).join(", ") : "–")}
    ${li("field", I.field.map(d => esc(tx("v19.dom." + d))).join(", ") || "–")}</ul>`;
}
/* ------------------------------------------------------------------ nine separate measures */
function v9MeasureVal(id, m) {
  if (m.value == null) return `<span class="meta">${esc(tx("v19.why." + m.why))}</span>`;
  if (id === "spatial_diversity") return esc(txInt(Math.round(m.value))) + " km";
  if (id === "novelty") return esc(tx("v19.meas.pct", { p: txInt(Math.round(m.value)) })) + (m.cls ? " · " + esc(tx("v17.nov.cls." + m.cls)) : "");
  if (id === "operational_relevance") return esc(tx("ext.op." + m.best + ".name")) + " · " + esc(txNum(m.value, 2)) + ` <span class="meta">${esc(tx("v19.meas.ops_n", { m: txNum(m.mean, 2), k: txInt(m.n), n: txInt(m.of) }))}</span>`;
  if (id === "process_relevance") return esc(txInt(m.value)) + (m.list.length ? " · " + m.list.map(p => esc(tx("ext.proc." + p + ".name"))).join(", ") : "");
  if (id === "evidence_strength") return esc(txPct(m.value, 0)) + ` <span class="meta">${esc(tx("v19.meas.target_kinds", { d: txInt(S.critIds.filter(c => (S.T[v9Tid].status || {})[c] === "DIRECT").length), p: txInt(S.critIds.filter(c => (S.T[v9Tid].status || {})[c] === "PROXY").length) }))}</span>`;
  return esc(txPct(m.value, id === "environmental_similarity" ? 1 : 0));
}
function v9Measures(ctx) {
  const M = AsterroV19.measures(ctx);
  return `<h4 class="xt-h">${esc(tx("v19.meas.title"))}</h4><p class="note small">${esc(tx("v19.meas.p"))}</p>
    <div class="tbl-wrap"><table class="t xt-t v9-meas" data-v9meas><thead><tr><th scope="col">${esc(tx("v19.meas.col"))}</th><th scope="col">${esc(tx("v17.col.value"))}</th></tr></thead><tbody>
    ${AsterroV19.MEASURES.map(id => `<tr data-v9m="${id}" data-v9has="${M[id].value != null ? 1 : 0}"><th scope="row">${esc(tx("v19.meas." + id))}<br><span class="meta v7-note">${esc(tx("v19.meas." + id + ".n"))}</span></th><td>${v9MeasureVal(id, M[id])}</td></tr>`).join("")}
    </tbody></table></div>`;
}
/* ------------------------------------------------------------------ site-sample evidence (geology, biology) */
function v9Year(y) { return y == null ? esc(tx("v19.pt.last_none")) : y < 0 ? esc(tx("v19.pt.bce", { y: txInt(-y) })) : esc(String(y)); }
function v9Point(d, ev) {
  const SM = V19D.samples;
  if (ev.state === "not_sampled") return `<p class="note" data-v9notsampled>${esc(tx("v19.pt.not_sampled", { n: txInt(SM.n_sites) }))}</p>`;
  const P = ev.point, src = `<p class="meta small">${esc(tx("v19.pt.src", { d: SM.retrieved }))}</p>`;
  if (d.id === "geology") {
    const units = `<p class="note"><b>${esc(tx("v19.pt.units"))}</b></p><div class="tbl-wrap"><table class="t xt-t v9-pt" data-v9units><thead><tr><th scope="col">${esc(tx("v19.pt.col.unit"))}</th><th scope="col">${esc(tx("v19.pt.col.lith"))}</th><th scope="col" class="n">${esc(tx("v19.pt.col.age"))}</th><th scope="col">${esc(tx("v19.pt.col.map"))}</th></tr></thead><tbody>
      ${P.geology.units.map(u => `<tr data-v9unit="${u.map_id}"><th scope="row" lang="en">${keep(u.name)}</th><td lang="en">${keep(u.lith)}</td><td class="n">${esc(txNum(u.t_age_ma, u.t_age_ma % 1 ? 1 : 0))}–${esc(txNum(u.b_age_ma, u.b_age_ma % 1 ? 1 : 0))}</td><td class="meta">${esc(tx("v19.pt.scale." + u.scale))}<span class="ds-adv" lang="en"> · ${keep(u.source)}</span></td></tr>`).join("")}</tbody></table></div>`;
    const V = P.volcanoes, vt = V.n ? `<p class="note" data-v9volc="${V.n}">${esc(tx("v19.pt.volc", { n: txInt(V.n), r: txInt(V.radius_km) }))}</p><div class="tbl-wrap"><table class="t xt-t v9-pt"><thead><tr><th scope="col">${esc(tx("v19.pt.col.volc"))}</th><th scope="col">${esc(tx("v19.pt.col.type"))}</th><th scope="col" class="n">${esc(tx("v19.pt.col.dist"))}</th><th scope="col">${esc(tx("v19.pt.col.last"))}</th><th scope="col" class="ds-adv">${esc(tx("v19.pt.col.rock"))}</th></tr></thead><tbody>
      ${V.near.map(x => { const v = SM.volcanoes[x.number]; return `<tr data-v9v="${x.number}"><th scope="row" lang="en">${keep(v.name)}</th><td lang="en">${keep(v.primary_type)}</td><td class="n">${esc(txInt(Math.round(x.km)))} km</td><td>${v9Year(v.last_eruption_year)}</td><td class="ds-adv meta" lang="en">${keep(v.major_rock_type)} · ${keep(v.evidence_category)}</td></tr>`; }).join("")}</tbody></table></div>`
      : `<p class="note" data-v9volc="0">${esc(tx("v19.pt.volc_none", { r: txInt(V.radius_km) }))}</p>`;
    return units + vt + `<p class="note small">${esc(tx("v19.pt.geo_note"))}</p>` + src;
  }
  if (d.id === "biology") {
    const B = P.biology;
    const ex = B.archaea_examples.length ? `<p class="note">${esc(tx("v19.pt.bio_ex"))}</p><ul class="xt-list" data-v9bio-ex>${B.archaea_examples.map(r => `<li><i lang="en">${keep(r.name)}</i> · ${keep(r.date)} · <span lang="en">${keep(r.dataset_title)}</span> <span class="meta">(doi ${keep(r.dataset_doi)}${r.coords_whole_degrees ? "; " + esc(tx("v19.pt.bio_whole")) : ""})</span></li>`).join("")}</ul>` : "";
    return `<p class="note" data-v9bio="${B.all}">${esc(tx("v19.pt.bio", { all: txInt(B.all), a: txInt(B.archaea), b: txInt(B.bacteria) }))}</p>${ex}<p class="note small">${esc(tx("v19.pt.bio_note"))}</p>` + src;
  }
  return "";
}
function v9Material(i, tid) {
  const SM = V19D && V19D.samples; if (!SM) return "";
  const M = AsterroV19.material(v9Sample(i), tid, SM.literature), t = jnTNameText(tid);
  const kind = k => `<span class="v7-kind ${k === "in_situ" || k === "orbital_spectral" ? "direct" : "derived"}">${esc(tx("v19.mat.kind." + k))}</span>`;
  const e = M.earth.length ? M.earth.map(r => r.kind === "catalogue" ? `<li>${kind(r.kind)} ${esc(tx("v19.mat.volc", { n: txInt(r.volcanoes), r: txInt(r.radius) }))}</li>`
    : `<li>${kind(r.kind)} <span lang="en">${keep(r.text)}</span> <span class="meta">(${esc(tx("v19.pt.scale." + r.scale))})</span></li>`).join("") : `<li class="meta">${esc(tx("v19.mat.none_earth"))}</li>`;
  const g = M.target.length ? M.target.map(r => `<li>${kind(r.kind)} <span lang="en">${keep(r.text)}</span><br><span class="meta" lang="en">${keep(r.source)}</span></li>`).join("") : `<li class="meta">${esc(tx("v19.mat.none_target"))}</li>`;
  return `<h4 class="xt-h">${esc(tx("v19.mat.title", { t }))}</h4><p class="note small">${esc(tx("v19.mat.p"))}</p>
    <div class="v9-mat" data-v9mat data-v9mat-sampled="${M.sampled ? 1 : 0}"><div><p class="note"><b>${esc(tx("v19.mat.earth"))}</b></p><ul class="xt-list">${e}</ul></div><div><p class="note"><b>${esc(t)}</b></p><ul class="xt-list">${g}</ul></div></div>`;
}
/* ------------------------------------------------------------------ sixteen domains */
function v9DomainHTML(d, ev) {
  const rows = ev.state === "sampled" || ev.state === "not_sampled" ? v9Point(d, ev) : ev.rows.length ? `<div class="tbl-wrap"><table class="t xt-t v9-dom-t"><thead><tr><th scope="col">${esc(tx("v17.col.var"))}</th><th scope="col" class="n">${esc(tx("v17.col.value"))}</th><th scope="col">${esc(tx("v17.col.kind"))}</th><th scope="col" class="ds-adv">${esc(tx("v17.col.source"))}</th></tr></thead><tbody>
    ${ev.rows.map(r => `<tr data-v9var="${esc(r.id)}"><th scope="row">${esc(liName(r.id))}</th><td class="n">${liVal(r)}</td><td>${v7Kind(r.kind === "context" ? "derived" : r.kind)}</td><td class="ds-adv meta" lang="en">${r.src.map(keep).join(", ")} · ${esc(r.res)} · ${esc(r.period)}</td></tr>`).join("")}</tbody></table></div>`
    : `<p class="note" data-v9noinputs>${esc(tx("v19.dom.noinputs"))}</p>`;
  const ops = d.ops && ev.state !== "blocked" && v9Ops ? `<p class="note small"><b>${esc(tx("v19.dom.ops"))}</b> ${d.ops.map(o => { const r = v9Ops.find(x => x.id === o); return `${esc(tx("ext.op." + o + ".name"))} (${r && r.mean != null ? esc(txNum(r.mean, 2)) : esc(tx("v18.rel.cannot"))})`; }).join(", ")}</p>` : "";
  const pend = ev.pending.length ? `<p class="note small">${esc(tx("v19.dom.pending"))} ${ev.pending.map(p => `${v9DsName(p.id)} ${v9St(p.state)}`).join(", ")}</p>` : "";
  const comp = ev.completeness == null ? "" : ` · ${esc(tx("v19.dom.complete", { k: txInt(ev.rows.filter(r => r.value != null).length), n: txInt(ev.rows.length) }))}`;
  return `<details class="v7-mod v9-dom" data-v9dom="${d.id}" data-v9state="${ev.state}"${ev.state !== "blocked" && ev.state !== "not_sampled" ? " open" : ""}><summary><b>${esc(tx("v19.dom." + d.id))}</b> <span class="v7-ms ${ev.state === "available" || ev.state === "sampled" ? "available" : ev.state === "not_sampled" ? "blocked" : ev.state}">${esc(tx("v19.dstate." + ev.state))}</span><span class="meta">${comp}</span></summary>
    <p class="note">${esc(tx("v19.domq." + d.id))}</p>${rows}${ops}${pend}
    <div class="ds-adv v7-mod-adv" lang="en"><p class="meta small"><b>${esc(tx("v19.dom.method"))}</b> ${esc(d.method)} · ${esc(d.res)} · ${esc(d.period)}</p><p class="meta small"><b>${esc(tx("v17.mod.limits"))}</b> ${esc(d.limits)}</p><p class="meta small"><b>${esc(tx("v17.mod.validation"))}</b> ${esc(d.validation)} · ${keep(d.version)}</p>${d.planet.length ? `<p class="meta small"><b>${esc(tx("v19.dom.planet"))}</b> ${d.planet.map(p => `${v9DsName(p)} ${v9St((v9Reg()[p] || {}).state || "not_investigated")}`).join(", ")}</p>` : ""}</div></details>`;
}
let v9Ops = null, v9Tid = "mars_jezero";
function v9Domains(i, tid, doms) {
  v9Ops = typeof xcOps === "function" ? xcOps(i, tid) : [];
  const n = s => AsterroV19.DOMAINS.filter(d => doms[d.id].state === s).length;
  return `<h4 class="xt-h">${esc(tx("v19.dom.title"))}</h4><p class="note small">${esc(tx("v19.dom.p"))}</p>
    <p class="meta" data-v9domcount>${esc(tx("v19.dom.count", { a: txInt(n("available")), p: txInt(n("partial")), b: txInt(n("blocked")) }))}${n("sampled") + n("not_sampled") ? " · " + esc(tx("v19.dom.count_s", { s: txInt(n("sampled")), u: txInt(n("not_sampled")) })) : ""}</p>
    <div class="v7-mods" data-v9doms>${AsterroV19.DOMAINS.map(d => v9DomainHTML(d, doms[d.id])).join("")}</div>`;
}
/* ------------------------------------------------------------------ objective profiles */
function v9Profiles(i, doms) {
  const st = Object.fromEntries(Object.entries(doms).map(([k, v]) => [k, v.state])), c = liAt(i), vars = v9Vars();
  return `<h4 class="xt-h">${esc(tx("v19.prof.title"))}</h4><p class="note small">${esc(tx("v19.prof.p"))}</p>
    <ul class="xt-list" data-v9profs>${AsterroV19.PROFILES.map(p => { const r = AsterroV19.profileState(p, st);
      const vals = r.computable && p.extra.length ? " · " + p.extra.map(v => { const x = { id: v, value: (() => { try { return vars[v].get(c); } catch (e) { return null; } })(), unit: vars[v].unit }; return `${esc(liName(v))} ${x.value == null ? esc(tx("v18.missing")) : liVal(x)}`; }).join("; ") : "";
      /* only assessable operations are listed; a profile evaluated through site samples points to that evidence */
      const okOps = r.computable && v9Ops ? p.ops.map(o => v9Ops.find(x => x.id === o)).filter(q => q && q.mean != null) : [];
      const pt = r.computable ? p.essential.filter(id => doms[id] && doms[id].state === "sampled") : [];
      const ops = (okOps.length ? " · " + okOps.map(q => `${esc(tx("ext.op." + q.id + ".name"))} ${esc(txNum(q.mean, 2))}`).join("; ") : "")
        + (pt.length ? " · " + esc(tx("v19.prof.see", { d: pt.map(id => tx("v19.dom." + id)).join(", ") })) : "");
      return `<li data-v9prof="${p.id}" data-v9ok="${r.computable ? 1 : 0}"><b>${esc(tx("v19.prof." + p.id))}</b>: ${r.computable ? esc(tx("v19.prof.ok")) + vals + ops : `<span class="meta">${esc(tx("v19.prof.cannot", { d: r.missing.map(d => tx("v19.dom." + d)).join(", ") }))}</span>`}</li>`; }).join("")}</ul>`;
}
/* ------------------------------------------------------------------ most important physical differences */
function v9Diffs(tid, ctx) {
  const body = v7Body(tid), I = AsterroV19.interpret(ctx);
  const never = V17D.limits.items.filter(x => x.earth_site === "no").map(x => x.id);
  return `<h4 class="xt-h">${esc(tx("v19.diff.title"))}</h4><p class="note small">${esc(tx("v19.diff.p", { b: jnBody(tid) }))}</p>
    <ul class="xt-list" data-v9diffs><li><b>${esc(tx("v19.diff.never"))}</b> ${never.map(id => esc(tx("v17.lim." + id))).join(", ")}${body === "moon" ? " · " + esc(tx("v19.diff.vacuum")) : ""}</li>
    <li><b>${esc(tx("v19.diff.measured"))}</b> ${v9List(I.contradicting)}</li>
    <li><b>${esc(tx("v19.diff.unknown"))}</b> ${I.field.map(d => esc(tx("v19.dom." + d))).join(", ") || "–"}</li></ul>`;
}
function v9Block(i, tid) {
  v9Tid = tid; const ctx = v9Ctx(i, tid);
  return `<div class="sec" data-v19 data-i18n-done><h3>${esc(tx("v19.title"))}</h3><p class="note">${esc(tx("v19.p"))}</p>
    ${v9Interp(ctx, tid)}${v9Measures(ctx)}${v9Domains(i, tid, ctx.domains)}${v9Material(i, tid)}${v9Profiles(i, ctx.domains)}${v9Diffs(tid, ctx)}</div>`;
}
{ const f = v7HubDomains; v7HubDomains = function () {
  let h = f.apply(this, arguments);
  try { const i = v7Cur(); if (v9Ready() && i != null && S.res && S.res.eff[i] >= -1) h += v9Block(i, v7Tid()); } catch (e) { console.error(e); }
  return h;
}; }
/* ------------------------------------------------------------------ pattern validation (Discover › Patterns) */
function v9MlVal() {
  const M = V19D && V19D.ml_validation; if (!M) return "";
  const ari = Math.min(...Object.values(M.kmeans_seed_ari)), rho = Math.min(...Object.values(M.iforest_seed).map(x => x.spearman)), jac = Object.values(M.iforest_seed).map(x => x.top2_jaccard);
  const abl = Object.entries(M.ablation).sort((a, b) => a[1].top2_jaccard - b[1].top2_jaccard).slice(0, 3);
  const mc = M.missing_checks || {};
  return `<div class="sec" data-v9ml data-i18n-done><h3>${esc(tx("v19.ml.title"))}</h3><p class="note">${esc(tx("v19.ml.p"))}</p>
    <ul class="xt-list"><li data-v9mlk="kmeans">${esc(tx("v19.ml.kmeans", { k: txInt(M.k), a: txNum(ari, 3), n: txInt(Object.keys(M.kmeans_seed_ari).length) }))}</li>
    <li data-v9mlk="iforest">${esc(tx("v19.ml.iforest", { r: txNum(rho, 3), j0: txNum(Math.min(...jac), 2), j1: txNum(Math.max(...jac), 2) }))}</li>
    <li data-v9mlk="ablation">${esc(tx("v19.ml.ablation", { f: abl.map(([k, v]) => `${S.critIds.includes(k) ? tx("crit." + k + ".s") : liName(k)} (${txNum(v.top2_jaccard, 2)})`).join(", ") }))}</li>
    <li data-v9mlk="bias">${esc(tx("v19.ml.bias", { b: M.latitude_bias.filter(x => x.ratio >= 1.25 || x.ratio <= 0.8).map(x => `${txInt(x.band[0])}…${txInt(x.band[1])}° ×${txNum(x.ratio, 2)}`).join("; ") }))}</li>
    ${M.hidden_persistence ? `<li data-v9mlk="persist">${esc(tx("v19.ml.persist", { n: txInt(M.hidden_persistence.n_hidden_seed0), k: txInt(M.hidden_persistence.kept_in_all_seeds), s: txInt(Object.keys(M.iforest_seed).length) }))}</li>` : ""}
    <li data-v9mlk="missing">${esc(tx(mc.anomaly_none_equals_incomplete && mc.rarity_scored_with_missing_criteria === 0 ? "v19.ml.missing_ok" : "v19.ml.missing_bad", { n: txInt(M.n_incomplete) }))}</li></ul>
    <p class="note small">${esc(tx("v19.ml.never"))}</p><p class="meta small ds-adv" lang="en">${keep(M.version)} validates ${keep(M.validates)} · ${esc(M.note)}</p></div>`;
}
{ const f = v7HubPatterns; v7HubPatterns = function () { let h = f.apply(this, arguments); try { h += v9MlVal(); } catch (e) { console.error(e); } return h; }; }
/* ------------------------------------------------------------------ Local Impact: domains at the analysed cell */
{ const f = viewLocal; viewLocal = function () {
  let h = f.apply(this, arguments);
  try {
    if (v9Ready() && LI.i != null) {
      const tid = liTid(); v9Ops = typeof xcOps === "function" ? xcOps(LI.i, tid) : [];
      const doms = v9DomainsAt(LI.i);
      const sec = `<section class="sec li-sec" data-lisec="v19" data-i18n-done><h3>${esc(tx("v19.local.title"))}</h3><p class="note small">${esc(tx("v19.local.p"))}</p>${v9Domains(LI.i, tid, doms)}${v9Material(LI.i, tid)}${v9Profiles(LI.i, doms)}</section>`;
      const smp = v9Sample(LI.i);  /* the V18 "not shown" note stays; a sampled cell adds what the V19 sample holds */
      if (smp) h = h.replace(/(<p class="note small" data-linofeat>[\s\S]*?)<\/p>/, (m, a) => `${a} <span data-v9volcnote>${esc(tx("v19.local.volc_note", { n: txInt(smp.volcanoes.n), r: txInt(smp.volcanoes.radius_km) }))}</span></p>`);
      const k = h.indexOf('<section class="sec li-sec" data-lisec="report"');
      h = k >= 0 ? h.slice(0, k) + sec + h.slice(k) : h + sec;
    }
  } catch (e) { console.error(e); }
  return h;
}; }
/* ------------------------------------------------------------------ Data tab: the V19 registry */
function v9Registry() {
  if (!V19D) return "";
  const R = V19D.registry, order = R.states.map(s => s.id);
  const rows = R.sources.slice().sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || (a.priority || 9) - (b.priority || 9));
  const last = x => { const a = x.last_attempt; if (!a) return x.state.startsWith("integrated") ? esc(tx("v19.reg.retained")) : "–"; if (typeof a === "string") return keep(a);
    return `${esc(tx("v19.reg.cls." + a.class))} · <span lang="en">${keep(a.utc)}</span><span class="ds-adv meta" lang="en"> · ${esc(a.error || ("HTTP " + a.http_status))}</span>`; };
  return `<div class="sec" data-v9registry data-i18n-done><h3>${esc(tx("v19.reg.title"))}</h3><p class="note">${esc(tx("v19.reg.p"))}</p>
    <ul class="xt-list" data-v9regcounts>${R.states.map(s => `<li data-v9cnt="${s.id}">${v9St(s.id)} · ${esc(txInt(R.counts[s.id]))}</li>`).join("")}</ul>
    <div class="tbl-wrap"><table class="t xt-t v9-reg" data-v9regt><thead><tr><th scope="col">${esc(tx("v17.reg.source"))}</th><th scope="col">${esc(tx("v17.reg.state"))}</th><th scope="col">${esc(tx("v19.reg.last"))}</th><th scope="col" class="ds-adv">${esc(tx("v19.reg.routes"))}</th></tr></thead><tbody>
    ${rows.map(x => `<tr data-v9src="${esc(x.id)}" data-v9state="${esc(x.state)}"><th scope="row">${keep(x.title || x.id)}<br><span class="meta">${keep(x.provider || "–")}${x.doc_status ? " · " + esc(tx("v19.reg.doc." + x.doc_status)) : ""}</span></th><td>${v9St(x.state)}${x.v17_state ? `<br><span class="meta ds-adv">${esc(tx("v19.reg.v17", { s: tx("v17.state." + x.v17_state) }))}</span>` : ""}</td><td class="meta">${last(x)}</td><td class="ds-adv meta" lang="en">${(x.routes || []).map(r => `${keep(r.kind)}${r.auth !== "none" ? " (" + keep(r.auth) + ")" : ""}`).join(", ") || "–"}</td></tr>`).join("")}</tbody></table></div>
    <p class="note small">${esc(tx("v19.reg.never"))}</p></div>`;
}
{ const f = viewData; viewData = function () { let h = f.apply(this, arguments); try { h += v9Registry(); } catch (e) { console.error(e); } return h; }; }
