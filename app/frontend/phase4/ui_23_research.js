/* ===== Candidate research queue and report editions =====
 * Research queue: places saved for further investigation, each with a research status, the data completeness
 * computed now from the engine, notes, open questions and a dated history. Statuses describe the user's work, never
 * a scientific verdict: no status says "confirmed" or "validated" (ASTERRO validates nothing). Stored in this browser
 * only (localStorage "asterro.research.v1"); export / import as a file; there is no server.
 * Report editions: concise, detailed, comparative, mission-profile and multi-site Markdown reports, written in the
 * active language from the engine's own numbers. References are the dataset and target records, never invented. */
const RQ = { KEY: "asterro.research.v1", ok: true, items: [], idx: null, msg: null, confirm: null };
const RQ_ST = ["to_investigate", "data_incomplete", "under_review", "set_aside"];
(function rqLoad() {
  try { const r = localStorage.getItem(RQ.KEY); if (r) { const o = JSON.parse(r); if (o && Array.isArray(o.items)) RQ.items = o.items.filter(x => x && typeof x.cell === "number" && typeof x.tid === "string"); } }
  catch (e) { RQ.ok = false; }
})();
function rqSave() { try { localStorage.setItem(RQ.KEY, JSON.stringify({ schema: "asterro.research/1", items: RQ.items })); } catch (e) { RQ.ok = false; } }
function rqIndex(cellId) { if (!RQ.idx) { RQ.idx = new Map(); for (let i = 0; i < S.n; i++) RQ.idx.set(S.cell[i], i); } return RQ.idx.get(cellId); }
function rqFind(cellId, tid) { return RQ.items.find(x => x.cell === cellId && x.tid === tid); }
function rqEvent(it, ev, detail) { it.history.push({ utc: new Date().toISOString(), event: ev, detail: detail || null }); if (it.history.length > 60) it.history.shift(); }
function rqAdd(i, tid, pid) {
  const c = S.cell[i]; let it = rqFind(c, tid);
  if (!it) { it = { id: "rq-" + c + "-" + tid, cell: c, tid, pid, status: "to_investigate", notes: "", questions: [], added_utc: new Date().toISOString(), history: [] }; rqEvent(it, "added", pid); RQ.items.push(it); rqSave(); }
  return it;
}
/* data completeness now, from the engine: weight coverage and conditions compared (never stored as a verdict) */
function rqCompleteness(it) {
  const i = rqIndex(it.cell); if (i == null || !S.T[it.tid]) return null;
  const w = it.pid && S.app.profiles[it.pid] ? S.app.profiles[it.pid].weights : S.weights, ctx = jnCtx(it.tid), L = JE.lens(ctx, i, w), eff = ctx.effFor(w);
  return { i, cov: L.coverage, compared: L.compared, active: L.rows.filter(r => r.t != null && r.w > 0).length, score: eff[i], rank: JE.rank(eff, S.cell, i) };
}
function rqView() {
  const rows = RQ.items.map(it => {
    const c = rqCompleteness(it), q = it.questions.map((x, k) => `<li>${esc(x)} <button class="jn-lnk" data-rq="qdel" data-id="${esc(it.id)}" data-k="${k}" aria-label="${esc(tx("ext.rq.qdel"))}">×</button></li>`).join("");
    return `<li class="rq-item" data-rqid="${esc(it.id)}"><div class="rq-head"><b>${c ? jnPlace(c.i) : esc(tx("ext.rq.cell", { id: txInt(it.cell) }))}</b> <span class="meta">${esc(jnBody(it.tid))} · ${esc(jnTNameText(it.tid))}</span></div>
      <div class="rq-meta">${c ? esc(tx("ext.rq.complete", { p: txPct(c.cov, 0), k: txInt(c.compared), n: txInt(c.active) })) + " · " + esc(c.rank == null ? tx("place.not_eligible") : tx("ext.rq.score", { s: txPct(c.score), r: txInt(c.rank) })) : ""} · <span class="xt-st na">${esc(tx("ext.rq.not_validated"))}</span></div>
      <div class="rq-ctl"><label class="xt-field"><span>${esc(tx("ext.rq.status"))}</span><select data-rqst="${esc(it.id)}">${RQ_ST.map(s => `<option value="${s}"${it.status === s ? " selected" : ""}>${esc(tx("ext.rq.st." + s))}</option>`).join("")}</select></label>
        <button class="jn-btn ghost" data-rq="open" data-id="${esc(it.id)}">${esc(tx("ext.rq.open"))}</button>
        ${RQ.confirm === it.id ? `<span role="group" aria-label="${esc(tx("ext.rq.remove_q"))}">${esc(tx("ext.rq.remove_q"))} <button class="jn-lnk" data-rq="del" data-id="${esc(it.id)}">${esc(tx("ext.rq.yes"))}</button> <button class="jn-lnk" data-rq="nodel">${esc(tx("ext.rq.no"))}</button></span>` : `<button class="jn-lnk" data-rq="ask" data-id="${esc(it.id)}">${esc(tx("ext.rq.remove"))}</button>`}</div>
      <label class="rq-notes"><span>${esc(tx("ext.rq.notes"))}</span><textarea data-rqnotes="${esc(it.id)}" rows="2" maxlength="2000">${esc(it.notes)}</textarea></label>
      <div class="rq-q"><span>${esc(tx("ext.rq.questions"))}</span><ul>${q}</ul><form data-rqq="${esc(it.id)}"><input type="text" maxlength="300" aria-label="${esc(tx("ext.rq.qadd"))}" placeholder="${esc(tx("ext.rq.qph"))}"><button class="jn-lnk" type="submit">${esc(tx("ext.rq.qadd"))}</button></form></div>
      <details class="rq-hist"><summary>${esc(tx("ext.rq.history", { n: txInt(it.history.length) }))}</summary><ul>${it.history.slice().reverse().map(h => `<li><span class="meta">${esc(txDate(new Date(h.utc)))}</span> ${esc(tx("ext.rq.ev." + h.event, { d: h.detail == null ? "" : String(h.detail) }))}</li>`).join("")}</ul></details></li>`;
  }).join("");
  return `<div class="jn-pad"><h2 class="jn-h2" id="jn-title">${esc(tx("ext.rq.title"))}</h2><p class="jn-lead">${esc(tx("ext.rq.p"))}</p>
    ${RQ.items.length ? `<ul class="rq-list">${rows}</ul>` : `<p class="jn-note" data-rqempty>${esc(tx("ext.rq.empty"))}</p>`}
    <p class="jn-note">${esc(tx(RQ.ok ? "ext.rq.stored" : "ext.rq.unavailable"))} <button class="jn-lnk" data-rq="export">${esc(tx("ext.rq.export"))}</button> · <label class="jn-lnk">${esc(tx("ext.rq.import"))}<input type="file" accept="application/json,.json" data-rqimp class="sr-only"></label>
    ${RQ.items.length ? ` · <button class="jn-lnk" data-rq="report">${esc(tx("ext.rep.multi"))}</button>` : ""}</p>${RQ.msg ? `<p class="jn-note" role="status">${esc(RQ.msg)}</p>` : ""}
    <div class="jn-act"><button class="jn-btn ghost" data-jn="view" data-view="journal">${esc(tx("ext.rq.to_journal"))}</button></div></div>`;
}
if (typeof JN_VIEWS !== "undefined") JN_VIEWS.queue = { title: "ext.rq.title", render: () => rqView() };

/* the place view gains "Add to research queue" and the report editions (in the Passport section) */
{ const f = jnPlaceView; jnPlaceView = function () {
  let h = f.apply(this, arguments);
  try {
    const it = rqFind(S.cell[JN.i], JN.tid);
    const btn = it ? `<button class="jn-lnk" data-jn="view" data-view="queue" data-rqin>${esc(tx("ext.rq.in_queue"))}</button>` : `<button class="jn-lnk" data-rq="add">${esc(tx("ext.rq.add"))}</button>`;
    h = h.replace('<div class="jn-foot">', `<div class="jn-foot">${btn} `);
  } catch (e) { console.error(e); }
  return h;
}; }
{ const f = jnPassportView; jnPassportView = function () {
  let h = f.apply(this, arguments);
  try { h += `<div class="xt-box" data-xreports><h4 class="xt-h">${esc(tx("ext.rep.title"))}</h4><p class="jn-note">${esc(tx("ext.rep.p"))}</p><div class="jn-act">${["concise", "detailed", "comparative", "profiles"].map(k => `<button class="jn-btn ghost" data-xrep="${k}">${esc(tx("ext.rep." + k))}</button>`).join("")}</div></div>`; } catch (e) { console.error(e); }
  return h;
}; }
/* the journal links to the queue */
if (typeof jlView === "function") { const f = jlView; jlView = function () { let h = f.apply(this, arguments); try { h = h.replace(/<\/div>\s*$/, `<p class="jn-note"><button class="jn-btn ghost" data-jn="view" data-view="queue">${esc(tx("ext.rq.title"))} (${esc(txInt(RQ.items.length))})</button></p></div>`); } catch (e) { } return h; }; JN_VIEWS.journal.render = jlView; }

document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-rq]"); if (!b || !$("#jn") || !$("#jn").contains(b)) return;
  const a = b.dataset.rq, it = b.dataset.id ? RQ.items.find(x => x.id === b.dataset.id) : null; RQ.msg = null;
  if (a === "add") { rqAdd(JN.i, JN.tid, JN.pid); if (typeof jlMark === "function") jlMark("queue"); jnRender(); const n = document.querySelector("[data-rqin]"); if (n) n.focus(); return; }
  if (a === "open" && it) { const i = rqIndex(it.cell); if (i == null) return; rqEvent(it, "reopened"); rqSave(); jnOpen("place", { i, tid: it.tid, pid: it.pid && S.app.profiles[it.pid] ? it.pid : "general", sec: "lens" }); return; }
  if (a === "ask") RQ.confirm = it && it.id;
  else if (a === "nodel") RQ.confirm = null;
  else if (a === "del" && it) { RQ.items = RQ.items.filter(x => x !== it); RQ.confirm = null; rqSave(); }
  else if (a === "qdel" && it) { const q = it.questions.splice(+b.dataset.k, 1)[0]; rqEvent(it, "question_removed", q); rqSave(); }
  else if (a === "export") { xtDownload("asterro-research-queue.json", { schema: "asterro.research/1", exported_utc: new Date().toISOString(), note: "Research queue from one browser. Statuses record the user's own work; nothing here is a validation.", items: RQ.items }); }
  else if (a === "report") { xtRepDownload("multi"); }
  jnRender();
});
document.addEventListener("change", e => {
  const t = e.target; if (!t.dataset) return;
  if (t.dataset.rqst) { const it = RQ.items.find(x => x.id === t.dataset.rqst); if (it && RQ_ST.includes(t.value)) { it.status = t.value; rqEvent(it, "status", tx("ext.rq.st." + t.value)); rqSave(); jnRender(); const n = document.querySelector(`[data-rqst="${CSS.escape(it.id)}"]`); if (n) n.focus(); } }
  else if (t.dataset.rqnotes != null) { const it = RQ.items.find(x => x.id === t.dataset.rqnotes); if (it) { it.notes = String(t.value).slice(0, 2000); rqEvent(it, "notes"); rqSave(); } }
  else if (t.matches && t.matches("[data-rqimp]") && t.files && t.files[0]) {
    const r = new FileReader(); r.onload = () => { let n = 0; try { const o = JSON.parse(String(r.result)); if (o.schema !== "asterro.research/1" || !Array.isArray(o.items)) throw 0;
      for (const x of o.items) { if (!x || typeof x.cell !== "number" || typeof x.tid !== "string" || !S.T[x.tid] || rqFind(x.cell, x.tid)) continue;
        RQ.items.push({ id: "rq-" + x.cell + "-" + x.tid, cell: x.cell, tid: x.tid, pid: S.app.profiles[x.pid] ? x.pid : "general", status: RQ_ST.includes(x.status) ? x.status : "to_investigate", notes: String(x.notes || "").slice(0, 2000), questions: (Array.isArray(x.questions) ? x.questions : []).map(q => String(q).slice(0, 300)).slice(0, 30), added_utc: typeof x.added_utc === "string" ? x.added_utc : new Date().toISOString(), history: [{ utc: new Date().toISOString(), event: "imported", detail: null }] }); n++; }
      rqSave(); RQ.msg = tx("ext.rq.imported", { n: txInt(n) }); } catch (err) { RQ.msg = tx("ext.rq.import_bad"); } jnRender(); };
    r.readAsText(t.files[0]);
  }
});
document.addEventListener("submit", e => {
  const f = e.target; if (!f.dataset || !f.dataset.rqq) return; e.preventDefault();
  const it = RQ.items.find(x => x.id === f.dataset.rqq), inp = f.querySelector("input"), v = inp && inp.value.trim();
  if (it && v) { it.questions.push(v.slice(0, 300)); rqEvent(it, "question", v.slice(0, 80)); rqSave(); jnRender(); const n = document.querySelector(`[data-rqq="${CSS.escape(it.id)}"] input`); if (n) n.focus(); }
});

/* ---------------------------------------------------------------- report editions (Markdown, active language) */
function xtTxt(html) { const d = document.createElement("div"); d.innerHTML = html; return d.textContent.replace(/\s+/g, " ").trim(); }
function xtMdRow(cells) { return "| " + cells.map(c => String(c).replace(/\|/g, "\\|")).join(" | ") + " |"; }
function xtRepPlace(i, tid, pid) {
  const w = S.app.profiles[pid] ? S.app.profiles[pid].weights : S.weights, ctx = jnCtx(tid), eff = ctx.effFor(w), L = JE.lens(ctx, i, w);
  return { i, tid, pid, w, ctx, eff, L, rank: JE.rank(eff, S.cell, i), n: JE.nEligible(eff), place: jnPlaceText(i) };
}
function xtRepRepro(P) {
  return [`## ${tx("ext.rep.h.repro")}`, "", "```json", JSON.stringify({ algorithm: S.app.algorithm_version, configuration: P.ctx.config, target: P.tid, profile: P.pid, weights: P.w, cell: S.cell[P.i], lat: S.lat[P.i], lon: S.lon[P.i], stack_sha256: S.app.stack.sha256, created_utc: new Date().toISOString() }, null, 1), "```", ""];
}
function xtRepCrit(P) {
  const out = [xtMdRow([tx("ext.rep.c.crit"), tx("ext.rep.c.earth"), tx("ext.rep.c.target"), tx("ext.rep.c.s"), tx("ext.rep.c.w"), tx("ext.rep.c.state")]), xtMdRow(["---", "---:", "---:", "---:", "---:", "---"])];
  for (const r of P.L.rows) out.push(xtMdRow([tx("crit." + r.c), r.e == null ? tx("val.na") : xtTxt(jnVal(r.c, r.e)), r.t == null ? tx("val.na") : xtTxt(jnVal(r.c, r.t)), r.s == null ? "—" : txNum(r.s, 2), txNum(r.w || 0, 1), tx("state." + r.state)]));
  return out;
}
function xtRepThermal(P) {
  if (!xtHas(P.tid)) return [tx("ext.th.no_target"), ""];
  const T = xtTarget(P.tid), R = XC().rows(xtStack(), P.i, T.tv, T.ranges, XT.earth);
  const out = [xtMdRow([tx("ext.th.col_dim"), tx("ext.th.col_earth"), tx("ext.th.col_target"), tx("ext.th.col_diff"), tx("ext.th.col_state")]), xtMdRow(["---", "---:", "---:", "---:", "---"])];
  for (const r of R) out.push(xtMdRow([tx("ext.dim." + r.c + ".name"), r.e == null ? tx("val.na") : txNum(r.e, 1) + " K", r.t == null ? tx("ext.th.na") : txNum(r.t, 1) + " K", r.diff == null ? "—" : txNum(r.diff, 1) + " K",
    r.state === "na" ? tx("ext.th.na_moon") : r.state === "unknown" ? tx("ext.th.unknown") : tx("state." + xtState(r.s)) + " (s = " + txNum(r.s, 2) + ")" + (r.outside ? "; " + tx("ext.th.outside_" + r.outside, { gap: txNum(r.gap, r.gap < 0.1 ? 2 : 1), lim: txNum(r.outside === "below" ? r.earthMin : r.earthMax, r.gap < 0.1 ? 2 : 1) }) : "")]));
  return out.concat(["", tx("ext.th.not_in_score"), ""]);
}
function xtRepLimits() { return [`## ${tx("ext.rep.h.limits")}`, "", ...["gravity", "vacuum", "radiation", "history", "light", "bio"].map(k => "- " + tx("ext.rep.lim." + k)), "", "- " + tx("ext.th.not_prob"), ""]; }
function xtRepRefs(P) {
  const T = S.T[P.tid], ds = S.app.datasets.map(d => `- ${d.provider} — ${d.dataset} (${d.version}). ${d.url}${d.license ? " · " + d.license : ""}`);
  const seen = new Set(S.app.datasets.map(d => d.url)), ts = (T.sources || []).map((s, k) => [s, T.source_urls && T.source_urls[k]]).filter(([, u]) => !u || !seen.has(u)).map(([s, u]) => `- ${s}${u ? " " + u : ""}`);
  return [`## ${tx("ext.rep.h.refs")}`, "", tx("ext.rep.refs_p"), "", ...ds, ...ts, ...(xtHas(P.tid) ? ["- " + XD.thermal.version + " — " + XD.thermal.inputs.mars + "; " + XD.thermal.inputs.moon + " (SHA-256 " + XD.sha256.thermal_ext.slice(0, 16) + "…)"] : []), ""];
}
function xtRepHead(kind, P) {
  return [`# ${tx("ext.rep." + kind)} — ${P.place}`, "", `*${tx("ext.rep.generated", { d: txDate(new Date()) })} · ${S.app.algorithm_version} · ${tx("ext.rep.lang")}*`, "",
    xtMdRow([tx("ext.rep.k.place"), P.place + ` (${txLL(S.lat[P.i], S.lon[P.i])}, ${tx("place.cell", { id: txInt(S.cell[P.i]) })})`]), xtMdRow(["---", "---"]),
    xtMdRow([tx("ext.rep.k.target"), jnBody(P.tid) + " · " + jnTNameText(P.tid)]), xtMdRow([tx("ext.rep.k.profile"), xtTxt(jnProfileName(P.pid))]),
    xtMdRow([tx("place.score_label"), P.eff[P.i] >= 0 ? txPct(P.eff[P.i]) : tx("place.not_eligible")]), xtMdRow([tx("ext.rep.k.rank"), P.rank == null ? "—" : tx("place.rank", { r: txInt(P.rank), n: txInt(P.n) })]),
    xtMdRow([tx("cov.title"), txPct(P.L.coverage, 0)]), ""];
}
function xtReport(kind) {
  const P = xtRepPlace(JN.i, JN.tid, JN.pid in S.app.profiles ? JN.pid : "general");
  const act = P.L.rows.filter(r => r.s != null).sort((a, b) => b.s - a.s);
  let md = xtRepHead(kind, P);
  if (kind === "concise" || kind === "detailed") {
    md.push(`## ${tx("ext.rep.h.summary")}`, "", tx("ext.rep.summary", { place: P.place, target: jnTNameText(P.tid), k: txInt(P.L.groups.similar.length), n: txInt(P.L.compared),
      best: act.length ? tx("crit." + act[0].c + ".s") : "—", worst: act.length ? tx("crit." + act[act.length - 1].c + ".s") : "—" }), "");
  }
  if (kind === "detailed") {
    md.push(`## ${tx("ext.rep.h.question")}`, "", tx("ext.rep.question", { target: jnTNameText(P.tid), body: jnBody(P.tid) }), "");
    md.push(`## ${tx("ext.rep.h.method")}`, "", tx("ext.rep.method"), "", "`d = |e − t| / (max − min) · s = clip(1 − d) · S = Σ w·s / Σ w`", "");
  }
  md.push(`## ${tx("ext.rep.h.dims")}`, "", ...xtRepCrit(P), "");
  if (kind !== "profiles") md.push(`## ${tx("ext.th.title")} (${XD.thermal.version})`, "", ...xtRepThermal(P));
  if (kind === "detailed") {
    const miss = jnMissingItems(P.ctx, P.L).map(m => "- " + xtTxt(jnMissingText(m)));
    md.push(`## ${tx("ext.rep.h.uncert")}`, "", ...miss, "");
  }
  if (kind === "comparative") {
    const lead = JE.leaders(P.eff, P.ctx, 3).filter(j => j !== P.i).slice(0, 3), all = [P.i, ...lead];
    md.push(`## ${tx("ext.rep.h.compare")}`, "", tx("ext.rep.compare_p"), "", xtMdRow([tx("ext.rep.c.crit"), ...all.map(j => jnPlaceText(j))]), xtMdRow(["---", ...all.map(() => "---:")]));
    for (const c of S.critIds) md.push(xtMdRow([tx("crit." + c), ...all.map(j => { const r = JE.lens(P.ctx, j, P.w).rows.find(x => x.c === c); return r && r.s != null ? txNum(r.s, 2) : "—"; })]));
    md.push(xtMdRow([tx("place.score_label"), ...all.map(j => P.eff[j] >= 0 ? txPct(P.eff[j]) : "—")]), "");
  }
  if (kind === "profiles" || kind === "detailed") {
    md.push(`## ${tx("ext.rep.h.profiles")}`, "", xtMdRow([tx("ext.rep.k.profile"), tx("place.score_label"), tx("ext.rep.k.rank")]), xtMdRow(["---", "---:", "---:"]));
    for (const pid of Object.keys(S.app.profiles)) { const e = P.ctx.effFor(S.app.profiles[pid].weights), r = JE.rank(e, S.cell, P.i); md.push(xtMdRow([xtTxt(jnProfileName(pid)), e[P.i] >= 0 ? txPct(e[P.i]) : "—", r == null ? "—" : "#" + txInt(r)])); }
    if (xtHas(P.tid)) for (const p of XD.profiles_ext.profiles.filter(p => p.status === "available")) { const f = xtField(P.tid, p.weights), r = JE.rank(f.eff, S.cell, P.i); md.push(xtMdRow([tx("ext.prof." + p.id + ".name") + " (" + XC().CONFIG + ")", f.eff[P.i] >= 0 ? txPct(f.eff[P.i]) : "—", r == null ? "—" : "#" + txInt(r)])); }
    md.push("", tx("ext.prof.not_approval"), "");
  }
  md = md.concat(xtRepLimits(), xtRepRefs(P), xtRepRepro(P));
  return md.join("\n");
}
function xtReportMulti() {
  const md = [`# ${tx("ext.rep.multi")}`, "", `*${tx("ext.rep.generated", { d: txDate(new Date()) })} · ${S.app.algorithm_version}*`, "", tx("ext.rep.multi_p"), "",
    xtMdRow([tx("ext.rep.k.place"), tx("ext.rep.k.target"), tx("ext.rq.status"), tx("place.score_label"), tx("cov.title"), tx("ext.rep.c.best"), tx("ext.rep.c.worst")]), xtMdRow(["---", "---", "---", "---:", "---:", "---", "---"])];
  for (const it of RQ.items) {
    const c = rqCompleteness(it); if (!c) continue;
    const L = JE.lens(jnCtx(it.tid), c.i, S.app.profiles[it.pid] ? S.app.profiles[it.pid].weights : S.weights), act = L.rows.filter(r => r.s != null).sort((a, b) => b.s - a.s);
    md.push(xtMdRow([jnPlaceText(c.i), jnTNameText(it.tid), tx("ext.rq.st." + it.status), c.score >= 0 ? txPct(c.score) : "—", txPct(c.cov, 0), act.length ? tx("crit." + act[0].c + ".s") : "—", act.length ? tx("crit." + act[act.length - 1].c + ".s") : "—"]));
  }
  md.push("", tx("portfolio.note"), "", ...xtRepLimits());
  const rec = { algorithm: S.app.algorithm_version, stack_sha256: S.app.stack.sha256, created_utc: new Date().toISOString(),
    places: RQ.items.map(it => ({ cell: it.cell, target: it.tid, profile: it.pid, status: it.status })) };
  md.push(`## ${tx("ext.rep.h.repro")}`, "", "```json", JSON.stringify(rec, null, 1), "```", "");
  return md.join("\n");
}
function xtRepDownload(kind) {
  const md = kind === "multi" ? xtReportMulti() : xtReport(kind);
  const b = new Blob([md], { type: "text/markdown" }), u = URL.createObjectURL(b), a = document.createElement("a");
  a.href = u; a.download = `asterro-report-${kind}-${I18N.lang}.md`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000);
  if (typeof jlMark === "function") jlMark("report_" + kind);
  return md;
}
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-xrep]"); if (b) xtRepDownload(b.dataset.xrep); });
