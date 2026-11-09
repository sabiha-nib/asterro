/* ===== V17: Surprise me, a scientific discovery game on real data =====
 * Discovery modes draw real Earth cells from the unchanged engine's similarity field and the V17 products
 * (AsterroV17.surprise). Every card states what was found, where, for which target, why it is surprising, which
 * measurements support it, what matches and what does not, the sources, how reliable the evidence is and what
 * would need investigating next, at three levels (beginner, scientific, advanced).
 * Points reward interpretation (reading what a score means), spotting mismatches, reading uncertainty, reproducing
 * a result and asking questions. They never reward a high score and never change a result. Stored only in this
 * browser (localStorage "asterro.v17.play.v1"). */
const SP = { mode: "mars_unexpected", draw: 0, card: null, level: "beginner", busy: false, chk: {} };
const SP_KEY = "asterro.v17.play.v1";
const SP_BADGES = { mismatch: 3, meaning: 3, uncertainty: 3, reproducibility: 2, questions: 3 };
const SP_LEVELS = [0, 3, 8, 15, 25];
function spLoad() { try { return JSON.parse(localStorage.getItem(SP_KEY)) || null; } catch (e) { return null; } }
function spState() { if (!SP.st) SP.st = spLoad() || { pts: { mismatch: 0, meaning: 0, uncertainty: 0, reproducibility: 0, questions: 0 }, done: {}, answered: {}, journal: [], challenges: {} }; return SP.st; }
function spSave() { try { localStorage.setItem(SP_KEY, JSON.stringify(spState())); } catch (e) { } }
function v7Award(k) { const s = spState(); s.pts[k] = (s.pts[k] || 0) + 1; spSave(); }
function spLevel() { const p = spState().pts, t = Object.values(p).reduce((a, b) => a + b, 0); let L = 0; for (let k = 0; k < SP_LEVELS.length; k++) if (t >= SP_LEVELS[k]) L = k; return { L, t }; }
function spTidFor(mode) {
  const body = (AsterroV17 && v7() ? v7().MODE_DEF[mode].body : "any");
  if (body === "mars") return v7Body(v7Tid()) === "mars" ? v7Tid() : "mars_jezero";
  if (body === "moon") return v7Body(v7Tid()) === "moon" ? v7Tid() : "moon_south_pole";
  return v7Tid();
}
function spCtx(tid) {
  const eff = S.res && S.res.tid === tid ? S.res.eff : simFor(tid, S.weights).eff;
  return { n: S.n, lat: S.lat, lon: S.lon, eff, A: S.A, rows: i => v7Rows(tid, i), thr: S.app.thresholds, draw: SP.draw, tid, coverage: i => v7Cov(tid, i), processHits: v7ProcHits };
}
function spDraw() {
  const V = v7(); if (!V) return;
  const tid = spTidFor(SP.mode);
  SP.card = V.surprise(SP.mode, spCtx(tid)); SP.level = "beginner"; SP.chk = {};
}
function spCrit(c) { return tx("crit." + c); }
function spWhy(c) {
  const w = c.why || {}, nv = c.novelty || {};
  if (c.mode === "mars_unexpected" || c.mode === "moon_unexpected") return tx("v17.sp.why.top", { p: txPct(c.eff), t: txPct(w.threshold), km: txInt(nv.km || 0), u: txInt(nv.uniq || 0) });
  if (c.mode === "thermal_unusual") return tx("v17.sp.why.thermal", { v: txNum(S.A.lst_diurnal_range[c.i], 1), t: txNum(w.threshold, 1) });
  if (c.mode === "polar") return tx("v17.sp.why.polar", { pn: txInt(v7().val("polar_night_months", c.i)), fz: txInt(v7().val("freeze_months", c.i)) });
  if (c.mode === "hidden") return tx("v17.sp.why.hidden", { a: txInt(c.pattern ? c.pattern.anomaly : 0) });
  if (c.mode === "underrepresented") return tx("v17.sp.why.sparse", { km: txInt(nv.km || 0) });
  if (c.mode === "one_dimension") return tx("v17.sp.why.one", { c: c.match.length ? spCrit(c.match[0].c) : "–" });
  return "";
}
function spRowsTable(c) {
  const st = (S.T[c.tid].status || {}), crit = id => S.app.criteria.find(x => x.id === id) || {};
  return `<div class="tbl-wrap"><table class="t xt-t ds-cmp" data-spt><thead><tr><th scope="col">${esc(tx("ext.rep.c.crit"))}</th><th scope="col" class="n">${esc(tx("ext.rep.c.earth"))}</th><th scope="col" class="n">${esc(tx("ext.rep.c.target"))}</th><th scope="col" class="n">${esc(tx("ext.rep.c.s"))}</th><th scope="col">${esc(tx("dsf.compare.kind"))}</th></tr></thead><tbody>
    ${c.rows.map(r => `<tr><th scope="row">${esc(spCrit(r.c))}</th><td class="n">${jnVal(r.c, r.e)}</td><td class="n">${jnVal(r.c, r.t)}</td><td class="n">${r.s == null ? "–" : esc(txNum(r.s, 2))}</td><td><span class="ds-ev ${String(st[r.c] || "").toLowerCase().replace("/", "")}">${esc(txHas("status." + st[r.c]) ? tx("status." + st[r.c]) : (st[r.c] || "–"))}</span></td></tr>`).join("")}</tbody></table></div>`;
}
function spCard() {
  const c = SP.card, V = v7(); if (!c) return "";
  if (c.unavailable) return `<div class="v7-card" data-spcard="unavailable"><h4 class="xt-h">${esc(tx("v17.sp.mode." + c.mode))}</h4><p class="note">${esc(tx("v17.sp.unavailable"))}</p><ul class="xt-list">${c.blocked.map(b => `<li>${keep(b.id)} · ${v7State(b.state)}</li>`).join("")}</ul></div>`;
  if (c.empty) return `<div class="v7-card" data-spcard="empty"><p class="note">${esc(tx("v17.sp.empty"))}</p></div>`;
  const i = c.i, tid = c.tid, place = jnPlace(i), alike = c.match.map(r => spCrit(r.c)), differs = c.diff.map(r => spCrit(r.c));
  const st = S.T[tid].status || {}, nProxy = S.critIds.filter(k => st[k] === "PROXY").length;
  const key = `${c.mode}:${S.cell[i]}:${tid}`, ans = spState().answered[key] || {};
  const lvl = ["beginner", "scientific", "advanced"].map(l => `<button type="button" data-splevel="${l}" aria-pressed="${SP.level === l}">${esc(tx("v17.sp.lvl." + l))}</button>`).join("");
  let body = "";
  if (SP.level === "beginner") {
    body = `<p class="ds-sum-l">${esc(tx("v17.sp.beg", { place: jnPlaceText(i), p: txPct(c.eff), t: jnTNameText(tid) }))}</p>
      <p class="note">${esc(alike.length ? tx("v17.sp.beg_alike", { a: alike.join(", ") }) : tx("v17.sp.beg_noalike"))} ${esc(differs.length ? tx("v17.sp.beg_diff", { d: differs.join(", ") }) : "")}</p>
      <p class="note small">${esc(tx("dsa.note"))}</p>`;
  } else if (SP.level === "scientific") {
    body = spRowsTable(c) + `<ul class="xt-list"><li>${esc(tx("v17.sp.cov", { c: txPct(c.coverage, 0) }))}</li><li>${esc(tx("dsa.evidence", { d: txInt(S.critIds.filter(k => st[k] === "DIRECT").length), p: txInt(nProxy) }))}</li>
      <li>${esc(tx("v17.nov.class"))}: ${esc(tx("v17.nov.cls." + c.novelty.cls))}${c.novelty.uniq != null ? " · " + esc(tx("v17.sp.nov_v", { u: txInt(c.novelty.uniq), e: txInt(c.novelty.env), km: txInt(c.novelty.km) })) : ""}</li>
      ${c.pattern ? `<li>${esc(tx("v17.pat.cluster", { k: txInt(c.pattern.cluster + 1) }))} · ${esc(c.pattern.name.map(w => tx("v17.pat.w." + w)).join(" · "))} · ${esc(tx("v17.sp.anom", { a: txInt(c.pattern.anomaly) }))}</li>` : ""}</ul>`;
  } else {
    const repro = { engine: S.app.algorithm_version, discovery: c.version, mode: c.mode, draw: c.draw, target: tid, cell: S.cell[i], lat: c.lat, lon: c.lon, weights: { ...S.weights }, profile: S.profile, ranges: jnCtx(tid).ranges, v17_sha256: V17D.sha256 };
    body = spRowsTable(c) + `<ul class="xt-list" lang="en">${S.critIds.map(k => { const cr = S.app.criteria.find(x => x.id === k) || {}; return `<li>${keep(k)}: ${keep(cr.unit || "")}; Earth source ${keep(String(cr.earth_source || "–"))}; target status ${keep(st[k] || "–")}</li>`; }).join("")}
      <li>missing conditions: ${c.miss.length ? c.miss.map(r => keep(r.c)).join(", ") : "none"}</li></ul>
      <pre class="ds-pre" data-sprepro>${esc(JSON.stringify(repro, null, 1))}</pre>
      <button type="button" class="btn-ghost btn-sm" data-spdo="repro">${esc(tx("v17.sp.save_repro"))}</button>`;
  }
  const further = V.modules(i, v7Ctx(i)).filter(m => m.status === "blocked").map(m => tx("v17.mod." + m.id));
  const crs = c.rows.filter(r => r.s != null);
  const quiz = `<div class="v7-quiz" data-spquiz><h4 class="xt-h">${esc(tx("v17.sp.quiz"))}</h4>
    <p class="note">${esc(tx("v17.sp.q1"))}</p><div class="ds-seg ds-wrap">${crs.map(r => `<button type="button" data-spq1="${r.c}" aria-pressed="${ans.q1 === r.c}">${esc(spCrit(r.c))}</button>`).join("")}</div>${ans.q1 ? `<p class="note small" data-spa1>${esc(ans.q1ok ? tx("v17.sp.right") : tx("v17.sp.wrong_diff", { c: spCrit(V.mostDifferent(c.rows)) }))}</p>` : ""}
    <p class="note">${esc(tx("v17.sp.q2"))}</p><div class="ds-seg ds-wrap">${["prob", "sim", "safe"].map(k => `<button type="button" data-spq2="${k}" aria-pressed="${ans.q2 === k}">${esc(tx("v17.sp.q2." + k))}</button>`).join("")}</div>${ans.q2 ? `<p class="note small" data-spa2>${esc(ans.q2 === "sim" ? tx("v17.sp.right") : tx("v17.sp.wrong_meaning"))}</p>` : ""}
    <p class="note">${esc(tx("v17.sp.q3"))}</p><div class="ds-seg ds-wrap">${[0, 1, 2, 3, 4, 5, 6].map(k => `<button type="button" data-spq3="${k}" aria-pressed="${ans.q3 === k}">${esc(txInt(k))}</button>`).join("")}</div>${ans.q3 != null ? `<p class="note small" data-spa3>${esc(ans.q3 === nProxy ? tx("v17.sp.right") : tx("v17.sp.wrong_proxy", { n: txInt(nProxy) }))}</p>` : ""}
    <label class="xt-field v7-q"><span>${esc(tx("v17.sp.ask"))}</span><textarea rows="2" maxlength="400" data-spask>${esc(ans.question || "")}</textarea></label><button type="button" class="btn-ghost btn-sm" data-spdo="ask">${esc(tx("v17.sp.ask_save"))}</button></div>`;
  return `<article class="v7-card" data-spcard="${S.cell[i]}" data-spmode="${c.mode}">
    <p class="dsa-k">${esc(tx("v17.sp.mode." + c.mode))} · ${esc(tx("v17.sp.draw", { k: txInt(c.draw + 1), n: txInt(c.pool) }))}</p>
    <h4 class="v7-h">${place}</h4><p class="meta">${esc(txLL(c.lat, c.lon))} · ${esc(tx("v17.sp.for", { t: jnTNameText(tid) }))} · ${esc(txPct(c.eff))}</p>
    <p class="note"><b>${esc(tx("v17.sp.why"))}</b> ${esc(spWhy(c))}</p>
    <div class="ds-seg" role="group" aria-label="${esc(tx("v17.sp.lvl"))}">${lvl}</div>${body}
    <p class="note small"><b>${esc(tx("v17.sp.next"))}</b> ${esc(further.length ? tx("v17.sp.next_v", { m: further.join(", ") }) : tx("v17.sp.next_none"))}</p>
    <div class="dsa-act"><button type="button" class="btn-primary btn-sm" data-spdo="evidence">${esc(tx("v17.sp.inspect"))}</button><button type="button" class="btn-ghost btn-sm" data-spdo="globe">${esc(tx("v17.sp.globe"))}</button><button type="button" class="btn-ghost btn-sm" data-spdo="save">${esc(tx("v17.sp.save"))}</button><button type="button" class="btn-ghost btn-sm" data-spdo="next">${esc(tx("v17.sp.another"))}</button></div>
    ${quiz}</article>`;
}
function spChallenges() {
  const V = v7(), s = spState();
  return `<h4 class="xt-h">${esc(tx("v17.ch.title"))}</h4><p class="note small">${esc(tx("v17.ch.p"))}</p><ol class="v7-ch" data-spch>${V.CHALLENGES.map(id => {
    const r = SP.chk[id], done = s.challenges[id];
    return `<li data-spchid="${id}"><b>${esc(tx("v17.ch." + id))}</b>${done ? ` <span class="v7-ms available">${esc(tx("v17.ch.done"))}</span>` : ""}<br><span class="note small">${esc(tx("v17.ch." + id + ".how"))}</span>
      <br><button type="button" class="btn-ghost btn-sm" data-spcheck="${id}">${esc(tx("v17.ch.check"))}</button>${r ? ` <span class="note small" data-spres="${id}">${esc(r)}</span>` : ""}</li>`; }).join("")}</ol>`;
}
function spJournal() {
  const s = spState(), lv = spLevel();
  const badges = Object.entries(SP_BADGES).filter(([k, n]) => (s.pts[k] || 0) >= n).map(([k]) => tx("v17.badge." + k));
  return `<h4 class="xt-h">${esc(tx("v17.jr.title"))}</h4><p class="note" data-splevelv="${lv.L}">${esc(tx("v17.jr.level", { l: tx("v17.lv." + lv.L), t: txInt(lv.t) }))}</p>
    <ul class="xt-list">${Object.keys(SP_BADGES).map(k => `<li>${esc(tx("v17.pts." + k))}: ${esc(txInt(s.pts[k] || 0))}</li>`).join("")}</ul>
    <p class="note small">${esc(badges.length ? tx("v17.jr.badges", { b: badges.join(", ") }) : tx("v17.jr.nobadges"))}</p>
    ${s.journal.length ? `<ol class="xt-list" data-spjournal>${s.journal.slice(-10).reverse().map(j => `<li>${esc(tx("v17.sp.mode." + j.mode))} · ${esc(j.place)} · ${esc(jnTNameText(j.tid))} · ${esc(txPct(j.eff))}${j.question ? " · “" + esc(j.question) + "”" : ""}</li>`).join("")}</ol>` : `<p class="note small">${esc(tx("v17.jr.empty"))}</p>`}
    <p class="note small">${esc(tx("v17.jr.rule"))}</p>`;
}
function v7HubSurprise() {
  const V = v7(); if (!V) return `<div class="sec"><p class="note">${esc(tx("v17.na"))}</p></div>`;
  const modes = V.MODES.map(m => `<button type="button" data-spmode="${m}" aria-pressed="${SP.mode === m}"${V.MODE_DEF[m].need.length ? ' class="v7-off"' : ""}>${esc(tx("v17.sp.mode." + m))}</button>`).join("");
  return `<div class="sec" data-v7surprise><h3>${esc(tx("v17.sp.title"))}</h3><p class="note">${esc(tx("v17.sp.p"))}</p>
    <div class="ds-seg ds-wrap" role="group" aria-label="${esc(tx("v17.sp.modes"))}">${modes}</div>
    <p class="note small">${esc(tx("v17.sp.mode_p." + SP.mode))}</p>
    <button type="button" class="btn-primary" data-spdo="draw">${esc(tx(SP.card ? "v17.sp.another" : "v17.sp.go"))}</button>
    <div class="v7-cardwrap">${spCard()}</div></div>
    <div class="sec">${spChallenges()}</div><div class="sec">${spJournal()}</div>`;
}
function spRe(sel) { renderLeft(); if (sel) { const n = document.querySelector(sel); if (n) n.focus(); } }
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("[data-spmode],[data-spdo],[data-splevel],[data-spq1],[data-spq2],[data-spq3],[data-spcheck]"); if (!t || S.tab !== "discover") return;
  const s = spState(), c = SP.card, key = c && c.i != null ? `${c.mode}:${S.cell[c.i]}:${c.tid}` : null, ans = key ? (s.answered[key] = s.answered[key] || {}) : null;
  if (t.dataset.spmode) { SP.mode = t.dataset.spmode; SP.card = null; SP.draw = 0; return spRe(`[data-spmode="${SP.mode}"]`); }
  if (t.dataset.splevel) { SP.level = t.dataset.splevel; return spRe(`[data-splevel="${SP.level}"]`); }
  if (t.dataset.spq1 && ans && !ans.q1) { ans.q1 = t.dataset.spq1; ans.q1ok = ans.q1 === v7().mostDifferent(c.rows); if (ans.q1ok) v7Award("mismatch"); spSave(); return spRe("[data-spa1]"); }
  if (t.dataset.spq2 && ans && !ans.q2) { ans.q2 = t.dataset.spq2; if (ans.q2 === "sim") v7Award("meaning"); spSave(); return spRe("[data-spa2]"); }
  if (t.dataset.spq3 != null && ans && ans.q3 == null) { ans.q3 = +t.dataset.spq3; const st = S.T[c.tid].status || {}; if (ans.q3 === S.critIds.filter(k => st[k] === "PROXY").length) v7Award("uncertainty"); spSave(); return spRe("[data-spa3]"); }
  if (t.dataset.spcheck) {
    const id = t.dataset.spcheck, V = v7(), i = S.selected;
    if (i == null) { SP.chk[id] = tx("v17.ch.pick"); return spRe(`[data-spcheck="${id}"]`); }
    const body = V.CHALLENGE_DEF[id].body, tid = body === "mars" ? (v7Body(v7Tid()) === "mars" ? v7Tid() : "mars_jezero") : body === "moon" ? (v7Body(v7Tid()) === "moon" ? v7Tid() : "moon_south_pole") : v7Tid();
    const r = V.challenge(id, i, spCtx(tid));
    SP.chk[id] = (r.ok ? tx("v17.ch.ok", { p: jnPlaceText(i) }) : tx("v17.ch.no", { p: jnPlaceText(i) })) + " " + tx("v17.ch.r." + id, Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "number" ? txNum(v, 2) : Array.isArray(v) ? v.map(x => tx("ext.proc." + x + ".name")).join(", ") : typeof v === "string" ? tx("v17.cls." + v) : ""])));
    if (r.ok && !s.challenges[id]) { s.challenges[id] = { cell: S.cell[i], tid, when: new Date().toISOString() }; spSave(); }
    return spRe(`[data-spcheck="${id}"]`);
  }
  const a = t.dataset.spdo;
  if (a === "draw" || a === "next") { if (a === "next" || (SP.card && SP.card.i != null)) SP.draw++; spDraw(); return spRe("[data-spcard]"); }
  if (!c || c.i == null) return;
  if (a === "evidence") { if (S.targetId !== c.tid) setTarget(c.tid); select(c.i); setTab("lab"); DSF.step = 3; renderLeft(); return; }
  if (a === "globe") { if (S.targetId !== c.tid) setTarget(c.tid); setTab("atlas"); select(c.i, true); return; }
  if (a === "save") { s.journal.push({ mode: c.mode, cell: S.cell[c.i], tid: c.tid, eff: c.eff, place: jnPlaceText(c.i), draw: c.draw, version: c.version, when: new Date().toISOString(), question: (ans && ans.question) || null }); spSave(); return spRe("[data-spjournal]"); }
  if (a === "ask") { const q = (document.querySelector("[data-spask]") || {}).value || ""; if (ans && q.trim().length >= 20 && !ans.question) { ans.question = q.trim(); v7Award("questions"); spSave(); } else if (ans) { ans.question = q.trim() || ans.question; spSave(); } return spRe("[data-spask]"); }
  if (a === "repro") { const pre = document.querySelector("[data-sprepro]"); if (pre && typeof xtDownload === "function") { xtDownload(`asterro-discovery-${c.mode}-cell${S.cell[c.i]}.json`, JSON.parse(pre.textContent)); if (!ans.repro) { ans.repro = true; v7Award("reproducibility"); spSave(); } } return spRe("[data-spdo=repro]"); }
});
