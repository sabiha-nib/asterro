/* ===== Journey screens: Same Earth, Different Mission · Portfolio · Exploration Journal =====
 * Missions: the leading distinct sites under two declared profiles, what stays, enters and leaves, and the exact
 *   per-criterion change of one site's contributions (AsterroJourney.missions; Σ Δk = ΔS).
 * Portfolio: a set of places the user chooses, compared criterion by criterion (AsterroJourney.portfolio). It is a
 *   comparison, not an optimisation; the greedy "team" is offered only as a labelled suggestion.
 * Journal: a 10-step expedition, eight achievements and four challenges. An achievement unlocks only when the real
 *   action has happened (recorded by the hooks at the end of this file); challenge answers are computed from the
 *   data (AsterroJourney.challenges). Progress lives in this browser only (localStorage, optional). */
const MS = { a: "general", b: "rover", focus: null };
const PF = { sel: [] };
const JL = Object.assign({ marks: {}, unlocked: {}, ch: {} }, (() => { try { return JSON.parse(localStorage.getItem("asterro.journal.v1") || "{}"); } catch (e) { return {}; } })());
function jlSave() { try { localStorage.setItem("asterro.journal.v1", JSON.stringify({ marks: JL.marks, unlocked: JL.unlocked, ch: JL.ch })); } catch (e) { /* storage unavailable: progress lasts this visit */ } }

/* ---------------------------------------------------------------- Same Earth, Different Mission */
function msView() {
  const tid = JN.tid, ctx = jnCtx(tid), P = S.app.profiles;
  const M = JE.missions(ctx, P[MS.a].weights, P[MS.b].weights, 10, MS.focus != null ? MS.focus : null);
  if (MS.a !== MS.b) jlMark("missions"), jlMark("profile");
  const sel = (k) => `<label class="jn-field"><span>${esc(tx(k === "a" ? "missions.a" : "missions.b"))}</span><select data-msin="${k}">${Object.keys(P).map(p => `<option value="${p}"${p === MS[k] ? " selected" : ""}>${jnProfileName(p)}</option>`).join("")}</select></label>`;
  const tsel = `<label class="jn-field"><span>${esc(tx("place.target"))}</span><select data-jnin="tid">${jnTargets().map(id => `<option value="${id}"${id === tid ? " selected" : ""}>${esc(jnBody(id))} · ${esc(jnTNameText(id))}</option>`).join("")}</select></label>`;
  const list = (rows, other) => `<ol class="ms-list">${rows.map((r, k) => `<li class="${r.leadOther ? "stay" : "out"}${r.i === M.focus.i ? " on" : ""}"><button class="ms-site" data-ms="focus" data-i="${r.i}" aria-pressed="${r.i === M.focus.i}"><span class="ms-k">${esc(txInt(k + 1))}</span><span class="ms-n">${jnPlace(r.i)}</span><span class="ms-s">${esc(txPct(r.score))}</span><span class="ms-o">${esc(r.leadOther ? tx("missions.also", { k: txInt(r.leadOther), p: tx("profile." + other) }) : tx("missions.not_in", { r: r.rankOther == null ? "—" : txInt(r.rankOther), p: tx("profile." + other) }))}</span></button></li>`).join("")}</ol>`;
  const F = M.focus, con = F.contrib.filter(x => Math.abs(x.delta) > 1e-12).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const why = con.slice(0, 2).map(x => tx(x.delta < 0 ? "missions.lost" : "missions.gained", { c: tx("crit." + x.c + ".s"), pts: txNum(Math.abs(100 * x.delta), 1) }));
  return `<div class="jn-pad"><p class="jn-lead">${esc(tx("missions.p"))}</p><div class="jn-ctrls">${tsel}${sel("a")}${sel("b")}</div>
    <p class="jn-note">${esc(tx("missions.weights"))} ${M.changes.length ? M.changes.map(x => `${esc(tx("crit." + x.c + ".short"))} ${esc(txNum(x.from, 1))} → ${esc(txNum(x.to, 1))}`).join(" · ") : esc(tx("missions.same"))}</p>
    <p class="jn-verdict" data-both="${M.both.length}">${esc(tx("missions.verdict", { k: txInt(M.both.length), n: txInt(M.K), a: tx("profile." + MS.a), b: tx("profile." + MS.b) }))}</p>
    <div class="ms-cols"><section><h4 class="jn-h4">${jnProfileName(MS.a)}</h4>${list(M.A, MS.b)}</section><section><h4 class="jn-h4">${jnProfileName(MS.b)}</h4>${list(M.B, MS.a)}</section></div>
    <div class="ms-focus" data-sum="${F.sumDelta.toFixed(9)}"><h4 class="jn-h4">${jnPlace(F.i)}</h4>
      <p>${esc(tx("missions.focus", { a: tx("profile." + MS.a), b: tx("profile." + MS.b), ra: F.rankA == null ? "—" : txInt(F.rankA), rb: F.rankB == null ? "—" : txInt(F.rankB), sa: txPct(F.scoreA), sb: txPct(F.scoreB) }))}${why.length ? " " + esc(tx("missions.because", { list: txList(why) })) : ""}</p>
      <div class="jn-scroll"><table class="jn-t"><thead><tr><th>${esc(tx("calc.c"))}</th><th class="n">w (${esc(tx("profile." + MS.a))})</th><th class="n">w (${esc(tx("profile." + MS.b))})</th><th class="n">${esc(tx("missions.dk"))}</th></tr></thead><tbody>
      ${F.contrib.map(x => `<tr><th scope="row">${jnCrit(x.c)}</th><td class="n">${esc(txNum(x.wA, 1))}</td><td class="n">${esc(txNum(x.wB, 1))}</td><td class="n">${esc((x.delta >= 0 ? "+" : "−") + txNum(Math.abs(100 * x.delta), 2))}</td></tr>`).join("")}
      <tr class="sum"><th scope="row">Σ</th><td></td><td></td><td class="n">${esc((F.sumDelta >= 0 ? "+" : "−") + txNum(Math.abs(100 * F.sumDelta), 2))}</td></tr></tbody></table></div>
      <p class="jn-note">${esc(tx("missions.note"))}</p></div>${jnReviewNote()}</div>`;
}

/* ---------------------------------------------------------------- Portfolio */
function pfView() {
  const tid = JN.tid, ctx = jnCtx(tid), w = jnW(), eff = ctx.effFor(w), L = JE.leaders(eff, ctx, 20);
  PF.sel = PF.sel.filter(i => eff[i] >= 0);
  const tsel = `<label class="jn-field"><span>${esc(tx("place.target"))}</span><select data-jnin="tid">${jnTargets().map(id => `<option value="${id}"${id === tid ? " selected" : ""}>${esc(jnBody(id))} · ${esc(jnTNameText(id))}</option>`).join("")}</select></label>`;
  const pick = `<ul class="pf-pick">${L.map((i, k) => `<li><button class="pf-c" data-pf="toggle" data-i="${i}" aria-pressed="${PF.sel.includes(i)}"><span class="ms-k">${esc(txInt(k + 1))}</span><span class="ms-n">${jnPlace(i)}</span><span class="ms-s">${esc(txPct(eff[i]))}</span></button></li>`).join("")}</ul>`;
  let body = `<p class="jn-note">${esc(tx("portfolio.pick_more"))}</p>`;
  if (PF.sel.length >= 2) {
    jlMark("portfolio");
    const R = JE.portfolio(ctx, PF.sel, w);
    const cell = (s, c) => { const r = s.rows.find(x => x.c === c); return `<td class="n s-${r.state}"><span aria-hidden="true">${JN_GLYPH[r.state]}</span> ${r.s == null ? esc(tx("state." + r.state)) : esc(txNum(r.s, 2))}</td>`; };
    body = `<div class="jn-scroll"><table class="jn-t pf-t"><thead><tr><th>${esc(tx("calc.c"))}</th>${R.sites.map(s => `<th class="n">${jnPlace(s.i)}</th>`).join("")}<th>${esc(tx("portfolio.best"))}</th></tr></thead><tbody>
      ${R.per.map(p => `<tr><th scope="row">${jnCrit(p.c)}</th>${R.sites.map(s => cell(s, p.c)).join("")}<td>${p.best != null ? jnPlace(p.best) : "—"}</td></tr>`).join("")}
      <tr class="sum"><th scope="row">${esc(tx("lens.score"))}</th>${R.sites.map(s => `<td class="n">${esc(txPct(s.score))}</td>`).join("")}<td></td></tr>
      <tr><th scope="row">${esc(tx("cov.title"))}</th>${R.sites.map(s => `<td class="n">${esc(txPct(s.coverage, 0))}</td>`).join("")}<td></td></tr></tbody></table></div>
      <ul class="jn-ul">
        <li>${esc(tx("portfolio.covered", { k: txInt(R.covered.length), n: txInt(R.criteria.length) }))}${R.covered.length ? ": " + esc(txList(R.covered.map(c => tx("crit." + c + ".s")))) : ""}.</li>
        <li>${R.uncovered.length ? esc(tx("portfolio.uncovered", { list: txList(R.uncovered.map(c => tx("crit." + c + ".s"))) })) : esc(tx("portfolio.all_covered"))}</li>
        <li>${R.overlap.length ? esc(tx("portfolio.overlap", { list: txList(R.overlap.map(c => tx("crit." + c + ".s"))) })) : esc(tx("portfolio.no_overlap"))}</li>
        ${R.contributions.map(x => `<li>${jnPlace(x.i)}: ${x.unique.length ? esc(tx("portfolio.unique", { list: txList(x.unique.map(c => tx("crit." + c + ".s"))) })) : esc(tx("portfolio.no_unique"))}</li>`).join("")}
        <li>${esc(tx("portfolio.dist", { km: txInt(Math.round(R.minKm)) }))}</li></ul>`;
  }
  return `<div class="jn-pad"><p class="jn-lead">${esc(tx("portfolio.p"))}</p><div class="jn-ctrls">${tsel}</div>
    <div class="jn-act"><button class="jn-btn ghost" data-pf="team">${esc(tx("portfolio.use_team"))}</button><button class="jn-btn ghost" data-pf="clear"${PF.sel.length ? "" : " disabled"}>${esc(tx("portfolio.clear"))}</button></div>
    <div class="pf-grid"><section><h4 class="jn-h4">${esc(tx("portfolio.leaders", { n: txInt(L.length) }))}</h4>${pick}</section><section class="pf-res"><h4 class="jn-h4">${esc(tx("portfolio.compare", { k: txInt(PF.sel.length) }))}</h4>${body}</section></div>
    <p class="jn-note">${esc(tx("portfolio.note"))}</p>${jnReviewNote()}</div>`;
}

/* ---------------------------------------------------------------- Exploration Journal */
const JL_ACH = [
  ["first_contact", m => !!m.search],
  ["fingerprint", m => S.critIds.every(c => m["dim:" + c])],
  ["beyond_top", m => Object.keys(m).filter(k => k.startsWith("cell:")).length >= 3],
  ["assumptions", m => !!(m.cm || m.missions)],
  ["evidence", m => !!(m.missing && m["trust:sources"])],
  ["repro", m => !!m.repro],
  ["cross_world", m => !!m.worlds || Object.keys(m).filter(k => k.startsWith("tgt:")).length >= 2],
  ["storyteller", m => !!m.passport_out],
];
const JL_STEPS = [
  ["target", m => !!(m.target || m.reveal)], ["fingerprint", m => !!m.fingerprint || Object.keys(m).some(k => k.startsWith("dim:"))], ["search", m => !!m.search],
  ["strongest", m => !!m.agree], ["difference", m => !!m.difference], ["profile", m => !!m.profile], ["coverage", m => !!(m.missing || m["layer:coverage"])],
  ["stability", m => !!m.cm], ["reproduce", m => !!m.repro], ["record", m => !!m.passport_out],
];
function jlMark(evt) {
  if (!evt || JL.marks[evt]) return;
  JL.marks[evt] = Date.now();
  const fresh = [];
  for (const [id, ok] of JL_ACH) if (!JL.unlocked[id] && ok(JL.marks)) { JL.unlocked[id] = Date.now(); fresh.push(id); }
  jlSave(); jlChip();
  if (fresh.length) jlToast(fresh.map(id => tx("ach." + id)).join(" · "));
}
function jlToast(msg) {
  let t = $("#jl-toast"); if (!t) { t = document.createElement("div"); t.id = "jl-toast"; t.className = "jl-toast"; t.setAttribute("role", "status"); $("#app").appendChild(t); }
  t.textContent = tx("journal.unlocked", { list: msg }); t.classList.add("on");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 4200);
}
function jlChip() {
  const vp = $("#viewport"); if (!vp) return;
  let b = $("#jl-chip"); if (!b) { b = document.createElement("button"); b.id = "jl-chip"; b.className = "jl-chip"; b.addEventListener("click", () => jnOpen("journal")); vp.appendChild(b); }
  const done = JL_STEPS.filter(([, ok]) => ok(JL.marks)).length;
  b.innerHTML = `<span aria-hidden="true">◎</span> ${esc(tx("journal.chip", { k: txInt(done), n: txInt(JL_STEPS.length) }))}`;
  b.setAttribute("aria-label", tx("journal.chip_aria", { k: txInt(done), n: txInt(JL_STEPS.length) }));
}
function jlChallenges() {
  const ctx = jnCtx("mars_jezero"), P = S.app.profiles;
  if (!JL._chal) JL._chal = JE.challenges(ctx, P.general.weights, { wExcl: P.instrument.weights, K: 20 });
  return JL._chal;
}
function jlChView() {
  const C = jlChallenges(), st = id => JL.ch[id] || {};
  const res = id => st(id).done ? `<p class="jl-res ${st(id).correct ? "ok" : "no"}" role="status">${esc(tx(st(id).correct ? "ch.correct" : "ch.wrong"))} ${st(id).why || ""}</p>` : "";
  const cand = (id, list, multi) => `<div class="jl-opts">${list.map(i => `<button class="jl-o" data-ch="${id}" data-i="${i}" aria-pressed="${(st(id).picked || []).includes(i)}">${jnPlace(i)} <span class="meta">${esc(txPct(jnCtx("mars_jezero").effFor(S.app.profiles.general.weights)[i]))}</span></button>`).join("")}</div>`;
  const top = C.top;
  let h = `<article class="jl-ch" data-chal="stronger"><h4>${esc(tx("ch.stronger.q", { c: tx("crit." + C.criterion + ".s") }))}</h4><p class="jn-note">${txH("ch.stronger.p", { s: txNum(C.s0, 3) }, { place: jnPlace(top) })}</p>${cand("stronger", C.leaders.slice(1, 12))}${res("stronger")}</article>`;
  h += `<article class="jl-ch" data-chal="costs"><h4>${txH("ch.costs.q", {}, { place: jnPlace(top) })}</h4><div class="jl-opts">${S.critIds.map(c => `<button class="jl-o" data-ch="costs" data-c="${c}" aria-pressed="${st("costs").c === c}">${jnCrit(c)}</button>`).join("")}</div>${res("costs")}</article>`;
  if (C.excluded) h += `<article class="jl-ch" data-chal="excluded"><h4>${txH("ch.excl.q", { p: tx("profile.instrument") }, { place: jnPlace(C.excluded.i) })}</h4><div class="jl-opts">${["low", "coverage", "near", "ocean"].map(o => `<button class="jl-o" data-ch="excluded" data-o="${o}" aria-pressed="${st("excluded").o === o}">${esc(tx("ch.excl." + o))}</button>`).join("")}</div>${res("excluded")}</article>`;
  h += `<article class="jl-ch" data-chal="same"><h4>${esc(tx("ch.same.q"))}</h4><p class="jn-note">${esc(tx("ch.same.p"))}</p>${cand("same", C.leaders.slice(0, 12), true)}${res("same")}</article>`;
  return h;
}
function jlAnswer(b) {
  const id = b.dataset.ch, C = jlChallenges(), s = JL.ch[id] = JL.ch[id] || {};
  const ctx = jnCtx("mars_jezero"), w = S.app.profiles.general.weights;
  const sOf = (i, c) => JE.lens(ctx, i, w).rows.find(r => r.c === c).s;
  if (id === "stronger") { const i = +b.dataset.i; s.picked = [i]; s.done = true; s.correct = C.stronger.includes(i); s.why = esc(tx("ch.stronger.why", { a: txNum(sOf(i, C.criterion), 3), b: txNum(C.s0, 3), k: txInt(C.stronger.length) })); }
  else if (id === "costs") { s.c = b.dataset.c; s.done = true; s.correct = s.c === C.costsMost; const L = JE.lens(ctx, C.top, w); s.why = esc(tx("ch.costs.why", { c: tx("crit." + C.costsMost + ".s"), pts: txNum(100 * L.rows.find(r => r.c === C.costsMost).loss, 1) })); }
  else if (id === "excluded") { s.o = b.dataset.o; s.done = true; s.correct = s.o === "coverage" && C.excluded.coverage < 0.8; s.why = esc(tx("ch.excl.why", { p: txPct(C.excluded.coverage, 0), list: txList(C.excluded.missing.map(c => tx("crit." + c + ".s"))) })); }
  else if (id === "same") {
    const i = +b.dataset.i; s.picked = (s.picked || []).includes(i) ? s.picked.filter(x => x !== i) : [...(s.picked || []), i].slice(-2);
    s.done = s.picked.length === 2;
    if (s.done) { const [a, c] = s.picked, eff = ctx.effFor(w); s.correct = C.sameScore.some(p => (p[0] === a && p[1] === c) || (p[0] === c && p[1] === a));
      s.why = esc(tx("ch.same.why", { d: txNum(Math.abs(100 * (eff[a] - eff[c])), 2), ca: tx("crit." + C.mainCost[a] + ".s"), cb: tx("crit." + C.mainCost[c] + ".s"), n: txInt(C.sameScore.length) })); }
  }
  if (s.done && s.correct) jlMark("ch:" + id);
  jlSave(); jnRender();
}
function jlView() {
  const m = JL.marks, done = JL_STEPS.filter(([, ok]) => ok(m)).length;
  return `<div class="jn-pad"><p class="jn-lead">${esc(tx("journal.p"))}</p>
    <h3 class="jn-h">${esc(tx("journal.expedition", { k: txInt(done), n: txInt(JL_STEPS.length) }))}</h3>
    <ol class="jl-steps">${JL_STEPS.map(([id, ok], k) => `<li class="${ok(m) ? "done" : ""}" data-step="${id}"><span class="jl-n" aria-hidden="true">${ok(m) ? "✓" : esc(txInt(k + 1))}</span><div><b>${esc(tx("step." + id))}</b><span>${esc(tx("step." + id + ".how"))}</span></div><span class="sr-only">${esc(tx(ok(m) ? "journal.done" : "journal.todo"))}</span></li>`).join("")}</ol>
    <h3 class="jn-h">${esc(tx("journal.achievements", { k: txInt(Object.keys(JL.unlocked).length), n: txInt(JL_ACH.length) }))}</h3>
    <ul class="jl-ach">${JL_ACH.map(([id]) => `<li class="${JL.unlocked[id] ? "on" : ""}" data-ach="${id}"><span class="jl-badge" aria-hidden="true">${JL.unlocked[id] ? "★" : "☆"}</span><div><b>${esc(tx("ach." + id))}</b><span>${esc(tx("ach." + id + ".how"))}</span>${JL.unlocked[id] ? `<span class="meta">${esc(tx("journal.on", { d: txDate(new Date(JL.unlocked[id])) }))}</span>` : `<span class="sr-only">${esc(tx("journal.locked"))}</span>`}</div></li>`).join("")}</ul>
    <h3 class="jn-h">${esc(tx("journal.challenges"))}</h3><p class="jn-note">${esc(tx("journal.ch_p"))}</p>${jlChView()}
    <p class="jn-note">${esc(tx("journal.local"))} <button class="jn-lnk" data-jl="reset">${esc(tx("journal.reset"))}</button></p>${jnReviewNote()}</div>`;
}
Object.assign(JN_VIEWS, { missions: { title: "missions.title", render: msView }, portfolio: { title: "portfolio.title", render: pfView }, journal: { title: "journal.title", render: jlView } });

/* ---------------------------------------------------------------- events */
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-ms],[data-pf],[data-ch],[data-jl]"); if (!b || !$("#jn") || !$("#jn").contains(b)) return;
  if (b.dataset.ms === "focus") { MS.focus = +b.dataset.i; jnRender(); }
  else if (b.dataset.pf === "toggle") { const i = +b.dataset.i; PF.sel = PF.sel.includes(i) ? PF.sel.filter(x => x !== i) : [...PF.sel, i].slice(-6); jnRender(); }
  else if (b.dataset.pf === "team") { PF.sel = JE.team(jnCtx(JN.tid), jnW()).members.map(m => m.i); jnRender(); }
  else if (b.dataset.pf === "clear") { PF.sel = []; jnRender(); }
  else if (b.dataset.ch) jlAnswer(b);
  else if (b.dataset.jl === "reset") { JL.marks = {}; JL.unlocked = {}; JL.ch = {}; jlSave(); jlChip(); jnRender(); }
});
document.addEventListener("change", e => { const s = e.target.closest && e.target.closest("[data-msin]"); if (!s) return; MS[s.dataset.msin] = s.value; MS.focus = null; jnRender(); });
document.addEventListener("toggle", e => { const d = e.target; if (d && d.dataset && d.dataset.trust && d.open) jlMark("trust:" + d.dataset.trust); }, true);
/* ---------------------------------------------------------------- hooks: record real actions only */
{ const f = runSearch; runSearch = async function () { const r = await f.apply(this, arguments); if (S.res) jlMark("search"); return r; }; }
{ const f = setTarget; setTarget = function (tid) { const r = f.apply(this, arguments); if (S.res) jlMark("target"); return r; }; }
{ const f = applyProfile; applyProfile = function () { const r = f.apply(this, arguments); jlMark("profile"); return r; }; }
{ const f = select; select = function (i) { const r = f.apply(this, arguments); if (S.res && S.res.eff[i] >= 0) jlMark("cell:" + S.cell[i]); return r; }; }
{ const f = jnRender; jnRender = function () {
  const r = f.apply(this, arguments);
  try {
    if (JN.view === "place" && JN.open) {
      if (JN.sec === "reveal") { if (JN.step >= 1) jlMark("fingerprint"); if (JN.step >= 2) jlMark("agree"); if (JN.step >= 3) jlMark("difference"); }
      if (JN.sec === "lens") { jlMark("agree"); jlMark("difference"); }
      if (JN.sec === "missing") jlMark("missing");
      if (JN.sec === "worlds") jlMark("worlds");
      if (JN.sec === "change" && JN.cm.has(jnCmKey()) && !JN.cm.get(jnCmKey()).error) jlMark("cm");
      jlMark("tgt:" + JN.tid);
      if (JN.sec === "lens" && JN.pid !== (JL._pid0 = JL._pid0 || JN.pid)) jlMark("profile");
    }
  } catch (e) { }
  return r;
}; }
for (const [name, evt] of [["jnPassportPNG", "passport_out"], ["jnPassportPrint", "passport_out"], ["jnPassportSave", "passport_out"]]) {
  const f = window[name]; window[name] = function () { jlMark(evt); return f.apply(this, arguments); };
}
{ const f = jnPassportJSON; jnPassportJSON = function () { const P = JN.passport, ok = P && Math.abs((JE.rescore(P) ?? -1) - P.result.analogue_score) < 1e-9; const r = f.apply(this, arguments); jlMark("passport_out"); if (ok) jlMark("repro"); return r; }; }
{ const f = rvRender; rvRender = function () { const r = f.apply(this, arguments); if (RV.on) { if (RV.step >= 1) jlMark("fingerprint"); if (RV.data && RV.step >= 5) jlMark("agree"); if (RV.data && RV.step >= 6) jlMark("difference"); } return r; }; }
document.addEventListener("asterro:lang", () => { jlChip(); JL._chal = JL._chal; });
setTimeout(jlChip, 0);
