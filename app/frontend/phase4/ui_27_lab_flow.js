/* ===== Research Laboratory: a seven-step workflow above the existing modules =====
 * 1 target (Moon or Mars) · 2 Earth candidate · 3 compare the environmental dimensions · 4 weights · 5 differences
 * and missing data · 6 scientific evidence · 7 reproduce. One step is open at a time (progressive disclosure). Every
 * value comes from the existing engine and records (ENG.detail, S.res, jnMissingItems, S.app.datasets, the target
 * record); every action calls an existing function (setTarget, select, applyProfile, showTrace, showReproduce,
 * xtRepDownload). The fourteen research modules stay below, unchanged and always visible. */
const DSF = { step: 1, steps: ["target", "candidate", "compare", "weights", "gaps", "evidence", "interpret", "reproduce"], cmp2: null };
function dsfCand() { if (!S.res) return null; const i = S.selected != null ? S.selected : (S.picked != null ? S.picked : S.res.distinct[0]); return i == null ? null : i; }
function dsfTargets() {
  const ids = Object.keys(S.T).filter(t => t !== "cross" && S.T[t] && S.T[t].variables);
  const body = t => String(S.T[t].body || "").toLowerCase() === "moon" ? "moon" : "mars";
  return { mars: ids.filter(t => body(t) === "mars").sort((a, b) => jnTNameText(a).localeCompare(jnTNameText(b))), moon: ids.filter(t => body(t) === "moon").sort((a, b) => jnTNameText(a).localeCompare(jnTNameText(b))) };
}
function dsfSummary(k) {
  const tid = S.targetId, i = dsfCand();
  if (k === "target") return tid === "cross" ? tx("dsf.target.cross") : `${jnBody(tid)} · ${jnTNameText(tid)}`;
  if (k === "candidate") return i == null ? tx("dsf.candidate.none") : `${jnPlaceText(i)} · ${S.res.eff[i] >= 0 ? txPct(S.res.eff[i]) : tx("val.na")}`;
  if (k === "weights") return S.profile === "custom" ? tx("dsf.weights.custom") : tx("profile." + S.profile);
  return tx("dsf." + k + ".sum");
}
function dsfRows(tid, i) {
  const ctx = jnCtx(tid), D = ENG.detail(S.A, S.critIds, i, ctx.tv, S.weights, ctx.ranges), th = S.app.thresholds;
  const st = s => s == null || s !== s ? "na" : s >= th.match ? "similar" : s >= th.partial ? "partial" : "different";
  return D.rows.map(r => ({ c: r.c, e: r.e, t: r.t, s: r.s == null ? null : r.s, w: r.w, k: st(r.s) }));
}
function dsfStep(k) {
  const tid = S.targetId, i = dsfCand();
  if (k === "target") {
    const T = dsfTargets(), opt = t => `<option value="${esc(t)}"${t === tid ? " selected" : ""}>${esc(jnTNameText(t))}</option>`;
    return `<p class="note">${esc(tx("dsf.target.p"))}</p>
      <div class="ds-seg" role="group" aria-label="${esc(tx("dsf.target.quick"))}"><button type="button" data-dsftgt="mars_jezero" aria-pressed="${tid === "mars_jezero"}">${esc(tx("body.mars"))} · ${esc(jnTNameText("mars_jezero"))}</button><button type="button" data-dsftgt="moon_south_pole" aria-pressed="${tid === "moon_south_pole"}">${esc(tx("body.moon"))} · ${esc(jnTNameText("moon_south_pole"))}</button></div>
      <label class="xt-field ds-adv-field"><span>${esc(tx("dsf.target.all"))}</span><select data-dsftgtsel><optgroup label="${esc(tx("body.mars"))}">${T.mars.map(opt).join("")}</optgroup><optgroup label="${esc(tx("body.moon"))}">${T.moon.map(opt).join("")}</optgroup></select></label>
      ${tid === "cross" ? `<p class="jn-note">${esc(tx("dsf.target.cross_note"))}</p>` : ""}`;
  }
  if (tid === "cross") return `<p class="jn-note">${esc(tx("dsf.target.cross_note"))}</p>`;
  if (!S.res) return `<p class="note">${esc(tx("dsf.search_first"))}</p><button type="button" class="btn-primary" data-dsfsearch>${esc(tx("ds.hero.explore"))}</button>`;
  if (k === "candidate") {
    const top = Array.from(S.res.distinct.slice(0, 20));
    if (i != null && !top.includes(i)) top.unshift(i);
    return `<p class="note">${esc(tx("dsf.candidate.p"))}</p>
      <label class="xt-field"><span>${esc(tx("dsf.candidate.label"))}</span><select data-dsfcand>${top.map((c, k2) => `<option value="${c}"${c === i ? " selected" : ""}>${esc(txInt(k2 + 1))}. ${esc(jnPlaceText(c))} · ${esc(S.res.eff[c] >= 0 ? txPct(S.res.eff[c]) : tx("val.na"))}</option>`).join("")}</select></label>
      <p class="note small">${esc(tx("dsf.candidate.globe"))}</p>`;
  }
  if (i == null) return `<p class="note">${esc(tx("dsf.candidate.none"))}</p>`;
  if (k === "compare") {
    const rows = dsfRows(tid, i);
    let ext = "";
    if (typeof xtHas === "function" && xtHas(tid)) { const T = xtTarget(tid); ext = XC().rows(xtStack(), i, T.tv, T.ranges, XT.earth).map(r => `<tr class="ds-adv"><th scope="row">${xtDimName(r.c)}</th><td class="n">${r.e == null ? "–" : xtK(r.e)}</td><td class="n">${r.t == null ? esc(tx("ext.th.na")) : xtK(r.t)}</td><td class="n">${r.s == null || r.state === "na" || r.state === "unknown" ? "–" : esc(txNum(r.s, 2))}</td><td>${esc(r.state === "na" ? tx("ext.th.na") : r.state === "unknown" ? tx("ext.th.unknown") : tx("state." + xtState(r.s)))}</td></tr>`).join(""); }
    const j = DSF.cmp2 != null && DSF.cmp2 !== i && S.res.eff[DSF.cmp2] >= 0 ? DSF.cmp2 : null, rows2 = j != null ? Object.fromEntries(dsfRows(tid, j).map(r => [r.c, r])) : null;
    const st = (S.T[tid].status || {}), crit = c => S.app.criteria.find(x => x.id === c) || {};
    const src = c => { let ids = crit(c).earth_source; if (typeof ids === "string") { try { ids = JSON.parse(ids.replace(/'/g, '"')); } catch (e) { ids = [ids]; } } return (ids || []).map(id => S.app.datasets.find(d => d.id === id)).filter(Boolean); };
    const others = Array.from(S.res.distinct.slice(0, 20)).filter(c => c !== i);
    return `<p class="note">${esc(tx("dsf.compare.p"))} ${dsGlossBtn()}</p>${dsGloss()}
      <label class="xt-field ds-cmp2"><span>${esc(tx("dsf.compare.with"))}</span><select data-dsfcmp2><option value="">${esc(tx("dsf.compare.none"))}</option>${others.map(c => `<option value="${c}"${c === j ? " selected" : ""}>${esc(jnPlaceText(c))} · ${esc(txPct(S.res.eff[c]))}</option>`).join("")}</select></label>
      <div class="tbl-wrap"><table class="t xt-t ds-cmp" data-dsfcmp><thead><tr><th scope="col">${esc(tx("ext.rep.c.crit"))}</th><th scope="col" class="n">${esc(tx("ext.rep.c.earth"))}</th><th scope="col" class="n">${esc(tx("ext.rep.c.target"))}</th><th scope="col" class="n">${esc(tx("ext.rep.c.s"))}</th><th scope="col">${esc(tx("ext.rep.c.state"))}</th>${j != null ? `<th scope="col" class="n" data-dsfcol2>${esc(jnPlaceText(j))}</th>` : ""}<th scope="col" class="ds-adv">${esc(tx("dsf.compare.kind"))}</th><th scope="col" class="ds-adv">${esc(tx("dsf.compare.source"))}</th></tr></thead>
      <tbody>${rows.map(r => `<tr data-dsfrow="${r.c}" data-dsfk="${r.k}"><th scope="row">${esc(tx("crit." + r.c + ".s"))}</th><td class="n">${jnVal(r.c, r.e)}</td><td class="n">${jnVal(r.c, r.t)}</td><td class="n">${r.s == null ? "–" : esc(txNum(r.s, 2))}<span class="ds-st-in ${r.k}">${esc(tx("state." + (r.k === "na" ? "na" : r.k)))}</span></td><td><span class="ds-state ${r.k}">${esc(tx("state." + (r.k === "na" ? "na" : r.k)))}</span></td>${j != null ? `<td class="n" data-dsfc2="${rows2[r.c] ? rows2[r.c].k : "na"}">${rows2[r.c] && rows2[r.c].s != null ? esc(txNum(rows2[r.c].s, 2)) : "–"}</td>` : ""}<td class="ds-adv"><span class="ds-ev ${String(st[r.c] || "").toLowerCase().replace("/", "")}">${esc(txHas("status." + st[r.c]) ? tx("status." + st[r.c]) : (st[r.c] || "–"))}</span></td><td class="ds-adv meta">${src(r.c).map(d => keep(d.dataset) + (d.resolution ? " · " + keep(d.resolution) : "")).join("; ") || "–"}</td></tr>`).join("")}${ext}</tbody></table></div>
      <p class="note small">${esc(tx("dsf.compare.thr"))}${ext ? " " + esc(tx("dsf.compare.ext")) : ""} ${esc(tx("dsa.note"))}</p>`;
  }
  if (k === "weights") {
    return `<p class="note">${esc(tx("dsf.weights.p"))}</p>
      <div class="ds-seg ds-wrap" role="group" aria-label="${esc(tx("dsf.weights.profiles"))}">${Object.keys(S.app.profiles).map(pid => `<button type="button" data-dsfprof="${pid}" aria-pressed="${S.profile === pid}">${esc(tx("profile." + pid))}</button>`).join("")}</div>
      <p class="note small">${esc(tx("dsf.weights.console"))}</p>
      <button type="button" class="btn-ghost btn-sm" data-dsfweights>${esc(tx("dsf.weights.show"))}</button>`;
  }
  if (k === "gaps") {
    const rows = dsfRows(tid, i), weak = rows.filter(r => r.k === "different"), part = rows.filter(r => r.k === "partial");
    const L = JE.lens(jnCtx(tid), i, S.weights), miss = jnMissingItems(jnCtx(tid), L);
    return `<h4 class="xt-h">${esc(tx("dsf.gaps.diff"))}</h4><ul class="xt-list" data-dsfdiff>${weak.length || part.length ? weak.concat(part).map(r => `<li>${esc(tx("crit." + r.c + ".s"))}: ${esc(tx("state." + r.k))} (s = ${esc(txNum(r.s, 2))})</li>`).join("") : `<li>${esc(tx("ds.sum.no_weak"))}</li>`}</ul>
      <h4 class="xt-h">${esc(tx("dsf.gaps.missing"))}</h4><ul class="xt-list" data-dsfmiss>${miss.map(m => `<li>${jnMissingText(m)}</li>`).join("") || `<li>${esc(tx("dsf.gaps.none"))}</li>`}</ul>
      <p class="note small">${esc(tx("dsf.gaps.never_zero"))}</p>`;
  }
  if (k === "evidence") {
    const T = S.T[tid], ds = S.app.datasets;
    return `<p class="note">${esc(tx("dsf.evidence.p"))}</p>
      <h4 class="xt-h">${esc(tx("dsf.evidence.earth"))}</h4><ul class="xt-list" data-dsfev>${ds.map(d => `<li>${keep(d.dataset)} <span class="meta">${keep(d.provider)} · ${keep(d.version || "")} · ${keep(d.resolution || "")}</span></li>`).join("")}</ul>
      <h4 class="xt-h">${esc(tx("dsf.evidence.target"))}</h4><ul class="xt-list">${(T.sources || []).map(s => `<li>${keep(s)}</li>`).join("") || `<li>${esc(tx("val.na"))}</li>`}</ul>
      <div class="ds-seg"><button type="button" data-dsfdo="trace">${esc(tx("dsf.evidence.trace"))}</button><button type="button" data-dsfdo="graph">${esc(tx("dsf.evidence.graph"))}</button></div>`;
  }
  if (k === "interpret") {
    const card = typeof dsSummary === "function" ? dsSummary(i, tid) : "";
    const ops = typeof xcOps === "function" ? xcOps(i, tid) : [];
    const procs = (XD && XD.processes ? XD.processes.processes : []).filter(P => P.status !== "no_data" && P.rule).filter(P => { try { const r = xtProcEval(P); return r && r.hitSet ? r.hitSet.has(i) : false; } catch (e) { return false; } });
    return `${card}
      <h4 class="xt-h">${esc(tx("dsf.interpret.ops"))}</h4><ul class="xt-list" data-dsfops>${ops.map(o => `<li><b>${esc(tx("ext.op." + o.id + ".name"))}</b>: <span class="ds-state ${o.k === "cannot" ? "na" : o.k}">${esc(o.k === "cannot" ? tx("ext.cx.cannot") : tx("state." + o.k))}</span></li>`).join("")}</ul>
      <h4 class="xt-h">${esc(tx("dsf.interpret.procs"))}</h4><ul class="xt-list" data-dsfprocs>${procs.length ? procs.map(P => `<li>${esc(tx("ext.proc." + P.id + ".name"))} <span class="meta">${esc(tx(P.status === "data" ? "ext.proc.st.data" : "ext.proc.st.indirect"))}</span></li>`).join("") : `<li>${esc(tx("dsf.interpret.noprocs"))}</li>`}</ul>
      <p class="jn-note">${esc(tx("ext.cx.not_cert"))}</p>`;
  }
  if (k === "reproduce") {
    const rec = { algorithm: S.app.algorithm_version, target: tid, cell: S.cell[i], weights: S.weights, stack_sha256: S.app.stack.sha256 };
    return `<p class="note">${esc(tx("dsf.repro.p"))}</p>
      <pre class="ds-pre" data-dsfrec>${esc(JSON.stringify(rec, null, 1))}</pre>
      <div class="ds-seg"><button type="button" data-dsfdo="repro">${esc(tx("dsf.repro.open"))}</button><button type="button" data-dsfdo="report">${esc(tx("dsf.repro.report"))}</button></div>`;
  }
  return "";
}
function dsfHTML() {
  const open = DSF.steps[DSF.step - 1];
  return `<section class="sec ds-flow" data-i18n-done data-dsflow aria-labelledby="dsf-title">
    <h2 id="dsf-title" class="ds-flow-title">${esc(tx("dsf.title"))}</h2><p class="ds-flow-intro">${esc(tx("dsf.intro"))}</p>
    <ol class="ds-steps">${DSF.steps.map((k, n) => { const on = k === open;
      return `<li class="ds-step${on ? " on" : ""}" data-dsfstep="${k}"><button type="button" class="ds-step-h" data-dsfgo="${n + 1}" aria-expanded="${on}" aria-controls="dsf-b-${k}"><span class="ds-step-n">${esc(txInt(n + 1))}</span><span class="ds-step-t">${esc(tx("dsf." + k + ".t"))}</span><span class="ds-step-s">${esc(dsfSummary(k))}</span></button>
        ${on ? `<div class="ds-step-b" id="dsf-b-${k}">${dsfStep(k)}<div class="ds-step-nav">${n > 0 ? `<button type="button" class="btn-ghost btn-sm" data-dsfgo="${n}">${esc(tx("dsf.prev"))}</button>` : ""}${n < DSF.steps.length - 1 ? `<button type="button" class="btn-primary btn-sm" data-dsfgo="${n + 2}">${esc(tx("dsf.next"))}: ${esc(tx("dsf." + DSF.steps[n + 1] + ".t"))}</button>` : ""}</div></div>` : ""}</li>`; }).join("")}</ol>
    <h2 class="ds-flow-title ds-mods">${esc(tx("dsf.modules"))}</h2><p class="ds-flow-intro">${esc(tx("dsf.modules_p"))}</p>${dsLegalLinks()}</section>`;
}
{ const f = viewLab; viewLab = function () { let h = f.apply(this, arguments); try { h = dsfHTML() + h; } catch (e) { console.error(e); } return h; }; }
function dsfRerender(focusSel) { if (S.tab !== "lab") return; renderLeft(); if (focusSel) { const n = document.querySelector(focusSel); if (n) n.focus(); } }
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("[data-dsfgo],[data-dsftgt],[data-dsfprof],[data-dsfweights],[data-dsfdo],[data-dsfsearch]"); if (!t) return;
  if (t.dataset.dsfgo) { DSF.step = Math.max(1, Math.min(DSF.steps.length, +t.dataset.dsfgo)); dsfRerender(`[data-dsfgo="${DSF.step}"].ds-step-h`); }
  else if (t.dataset.dsftgt) { setTarget(t.dataset.dsftgt); dsfRerender(`[data-dsftgt="${t.dataset.dsftgt}"]`); }
  else if (t.dataset.dsfprof) { applyProfile(t.dataset.dsfprof); dsfRerender(`[data-dsfprof="${t.dataset.dsfprof}"]`); }
  else if (t.dataset.dsfweights != null) { dsSetMode("advanced"); const c = document.getElementById("console"); if (c) { c.classList.add("open"); renderConsole(); c.scrollIntoView({ block: "nearest" }); const s = c.querySelector("input[type=range]"); if (s) s.focus(); } }
  else if (t.dataset.dsfsearch != null) { runSearch(); setTimeout(() => dsfRerender(), 0); }
  else if (t.dataset.dsfdo) {
    const i = dsfCand(); if (i != null && S.selected !== i) select(i);
    const a = t.dataset.dsfdo;
    if (a === "trace") showTrace(); else if (a === "repro") showReproduce();
    else if (a === "report" && typeof xtRepDownload === "function") { JN.i = i; JN.tid = S.targetId; JN.pid = S.profile in S.app.profiles ? S.profile : "general"; xtRepDownload("detailed"); }
    else if (a === "graph") { L.mod = "graph"; labRender(); }
  }
});
document.addEventListener("change", e => {
  const t = e.target; if (!t.dataset) return;
  if (t.dataset.dsftgtsel != null) { setTarget(t.value); dsfRerender("[data-dsftgtsel]"); }
  else if (t.dataset.dsfcand != null) { select(+t.value); dsfRerender("[data-dsfcand]"); }
  else if (t.dataset.dsfcmp2 != null) { DSF.cmp2 = t.value === "" ? null : +t.value; dsfRerender("[data-dsfcmp2]"); }
});

/* plain-language glossary, opened on request */
const DS_GLOSS = ["analogue", "similarity", "aridity", "roughness", "thermal", "proxy", "coverage"];
function dsGlossBtn() { return `<button type="button" class="ds-gloss-btn" data-dsgloss aria-expanded="${!!DSF.gloss}" aria-controls="ds-gloss">${esc(tx("ds.gl.open"))}</button>`; }
function dsGloss() { return DSF.gloss ? `<dl class="ds-gloss" id="ds-gloss" data-i18n-done>${DS_GLOSS.map(k => `<dt>${esc(tx("ds.gl." + k + ".t"))}</dt><dd>${esc(tx("ds.gl." + k + ".d"))}</dd>`).join("")}</dl>` : ""; }
document.addEventListener("click", e => { const g = e.target.closest && e.target.closest("[data-dsgloss]"); if (g) { DSF.gloss = !DSF.gloss; if (S.tab === "lab") dsfRerender("[data-dsgloss]"); } });
