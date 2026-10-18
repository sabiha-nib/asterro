/* ===== ASTERRO · Discovery Trajectory (signature interaction) =====
 * Every configuration the user settles on in Explore — a weight change, a profile, a target — is recorded with the
 * deterministic engine's own result for it (effective-score field, ranks, distinct sites). The Trajectory tab turns
 * that path into an object of study: which candidates hold, enter or leave the leading group, which assumption
 * change moved them (with the exact per-criterion score decomposition), which ones only disappear because a
 * nearby site outranks them under the 300 km rule, and which evidence would separate two close competitors.
 * Recording never alters the Explore state; a profile sweep computes extra states without touching S.weights.
 * Stability shown here is sensitivity to the explored configurations — never presented as uncertainty. */
const TJ = window.AsterroTrajectory;
const T5 = { states: [], auto: true, K: 10, sel: null, tr: null, pend: null, seq: 0, busy: null, msg: null, rival: null, level: "general" };
const T5_MAX = 12;
function t5Config(tid) { return tid === "cross" ? "legacy-cross-planet" : (typeof a4IsNew === "function" && a4IsNew(tid)) ? "explore-target-v1" : "legacy-baseline-v1"; }
function t5Name(tid) { return tid === "cross" ? "Cross-planet (Jezero × South Pole)" : TNAME[tid] || tid; }
function t5ProfileLabel(p) { return p === "custom" ? "Custom weights" : (S.app.profiles[p] || {}).label || p; }
function t5Label(prev, s) {
  if (!prev) return `Start · ${t5Name(s.tid)} · ${t5ProfileLabel(s.profile)}`;
  const ch = TJ.diffConfig(prev, s, S.critIds);
  const t = ch.find(c => c.kind === "target"); if (t) return `Target → ${t5Name(s.tid)}`;
  const ws = ch.filter(c => c.kind === "weight");
  if (s.profile !== "custom" && s.profile !== prev.profile) return `Profile → ${t5ProfileLabel(s.profile)}`;
  if (ws.length === 1) return `${shortOf(ws[0].criterion)} ${(+ws[0].from).toFixed(2)} → ${(+ws[0].to).toFixed(2)}`;
  return ws.length ? `${ws.length} weights changed` : "Same configuration";
}
function t5StateFrom(tid, w, profile, eff, rank, distinct, extra = {}) {
  return { id: "s" + (++T5.seq), tid, weights: { ...w }, profile, config: t5Config(tid), ranges: JSON.parse(JSON.stringify(typeof a4RangesFor === "function" && tid !== "cross" ? a4RangesFor(tid) : S.app.ranges)),
    eff: Float64Array.from(eff), rank: Int32Array.from(rank), distinct: distinct.slice(), cellIds: S.cell, at: new Date().toISOString(), ...extra };
}
function t5Push(s) {
  let last = T5.states[T5.states.length - 1];
  if (last && TJ.configKey(last) === TJ.configKey(s)) return false;
  /* coalesce rapid steps of the same slider (e.g. arrow keys) into one configuration: if the previous record was a
   * single-weight change on criterion c made < 1.5 s ago, and the new one is again a change of c only, replace it */
  const prev2 = T5.states[T5.states.length - 2];
  if (last && prev2 && !s.label && Date.now() - (last.t || 0) < 1500) {
    const a = TJ.diffConfig(prev2, last, S.critIds), b = TJ.diffConfig(prev2, s, S.critIds);
    if (a.length === 1 && b.length === 1 && a[0].kind === "weight" && b[0].kind === "weight" && a[0].criterion === b[0].criterion) { T5.states.pop(); last = prev2; }
  }
  s.t = Date.now();
  s.label = s.label || t5Label(last, s);
  T5.states.push(s);
  if (T5.states.length > T5_MAX) { T5.states.shift(); T5.msg = `Only the latest ${T5_MAX} configurations are kept.`; }
  T5.tr = T5.states.length >= 2 ? T5.states.length - 2 : null;
  announce(`Trajectory: recorded “${s.label}” (${T5.states.length} configurations).`);
  return true;
}
function t5RecordNow() {
  T5.pend = null;
  if (!T5.auto || !S.searched || !S.res) return;
  const R = S.res;
  if (t5Push(t5StateFrom(R.tid, R.w, S.profile, R.eff, R.rank, R.distinct)) && S.tab === "trajectory") renderLeft();
}
/* record after the result settles (drags call compute() every frame; only the settled configuration is kept) */
const _t5Compute = compute;
compute = function () {
  const r = _t5Compute.apply(this, arguments);
  clearTimeout(T5.pend); T5.pend = setTimeout(t5RecordNow, 650);
  return r;
};
/* explicit user actions are settled configurations: record them at once (the debounce only covers live drags) */
const _t5Commit = commitWeights, _t5SetTarget = setTarget;
commitWeights = function () { const r = _t5Commit.apply(this, arguments); clearTimeout(T5.pend); t5RecordNow(); return r; };
setTarget = function () { const r = _t5SetTarget.apply(this, arguments); clearTimeout(T5.pend); t5RecordNow(); return r; };
const _t5EndDrag = endDrag;
endDrag = function () { const r = _t5EndDrag.apply(this, arguments); clearTimeout(T5.pend); t5RecordNow(); return r; };
async function t5ProfileSweep() {
  if (!S.res) return;
  const tid = S.res.tid, ids = Object.keys(S.app.profiles);
  T5.busy = { done: 0, total: ids.length }; renderLeft();
  for (const pid of ids) {
    await new Promise(r => setTimeout(r, 0));
    const w = S.app.profiles[pid].weights, eff = effectiveFor(tid, w), o = ENG.order(eff, S.cell);
    t5Push(t5StateFrom(tid, w, pid, eff, ENG.ranksFromOrder(o), ENG.distinctSites(o, S.lat, S.lon, 20, S.app.thresholds.distinct_sep_km), { label: `Profile sweep · ${S.app.profiles[pid].label}` }));
    T5.busy.done++; if (S.tab === "trajectory") renderLeft();
  }
  T5.busy = null; T5.msg = `Added the ${ids.length} declared profiles for ${t5Name(tid)} (Explore unchanged).`;
  renderLeft();
}
function t5Short(i) { const p = placeName(i); return p.primary; }
function t5Where(i) { return `${placeName(i).primary} (${fmtLat(S.lat[i])} ${fmtLon(S.lon[i])})`; }

/* ---------- bump chart: distinct-site position per configuration ---------- */
function t5Chart(A) {
  const avail = (($("#left") || {}).clientWidth || 760) - 52;
  const st = T5.states, K = T5.K, n = st.length, padL = 34, padR = 158, W = Math.max(avail, padL + padR + 46 * (n - 1)), top = 34, rowH = K > 10 ? 17 : 22, H = top + (K + 1.6) * rowH;
  const X = k => padL + (n === 1 ? 0 : k * (W - padL - padR) / (n - 1)), Y = p => top + (p == null ? K + 0.9 : p - 1) * rowH;
  const col = { stable: "var(--match)", entered: "var(--earth)", left: "var(--mismatch)", transient: "var(--ink-3)" };
  const dash = { stable: "", entered: "", left: "5 4", transient: "2 4" };
  const lines = A.candidates.map(c => {
    const pts = c.pos.map((p, k) => [X(k), Y(p)]), on = T5.sel === c.i;
    const d = pts.map((p, k) => (k ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const lastK = c.pos.length - 1, ly = Y(c.pos[lastK]);
    return `<g class="t5-ln ${c.class}${on ? " on" : ""}" data-t5="cand" data-i="${c.i}" tabindex="0" role="button" aria-pressed="${on}" aria-label="${esc(t5Short(c.i))}: ${c.class}, in the leading ${K} in ${c.inGroup} of ${n} configurations, cell rank ${c.bestRank ?? "—"} to ${c.worstRank ?? "—"}">
      <path d="${d}" fill="none" stroke="${col[c.class]}" stroke-width="${on ? 3.4 : c.class === "stable" ? 2.4 : 1.5}" stroke-dasharray="${dash[c.class]}"/>
      ${pts.map((p, k) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${c.pos[k] == null ? 2.2 : on ? 5 : 3.6}" fill="${c.pos[k] == null ? "var(--panel)" : col[c.class]}" stroke="${col[c.class]}"><title>${esc(t5Short(c.i))} · ${esc(st[k].label)} · ${c.pos[k] ? "site #" + c.pos[k] : c.displaced[k] != null ? "displaced by " + esc(t5Where(c.displaced[k])) + " (300 km rule)" : "outside the leading " + K}${c.ranks[k] ? " · cell rank " + c.ranks[k] : " · ineligible"}</title></circle>`).join("")}
      ${c.pos[lastK] != null || on ? `<text x="${(X(lastK) + 10).toFixed(1)}" y="${(ly + 4).toFixed(1)}" class="t5-lab">${esc(t5Short(c.i).slice(0, 26))}</text>` : ""}</g>`;
  }).join("");
  const cols = st.map((s, k) => `<g class="t5-col${T5.tr === k - 1 ? " on" : ""}"><line x1="${X(k)}" x2="${X(k)}" y1="${top - 8}" y2="${H - 6}" class="t5-grid"/>
    <text x="${X(k)}" y="${top - 14}" text-anchor="middle" class="t5-h">${k + 1}</text></g>`).join("");
  const axis = Array.from({ length: K }, (_, p) => `<text x="${padL - 10}" y="${Y(p + 1) + 4}" text-anchor="end" class="t5-ax">#${p + 1}</text>`).join("") +
    `<text x="${padL - 10}" y="${Y(null) + 4}" text-anchor="end" class="t5-ax">out</text><line x1="${padL}" x2="${W - padR + 6}" y1="${Y(null) - rowH * 0.45}" y2="${Y(null) - rowH * 0.45}" class="t5-cut"/>`;
  const trs = st.slice(1).map((s, k) => `<rect x="${X(k) + 4}" y="${top - 26}" width="${X(k + 1) - X(k) - 8}" height="${H - top + 20}" class="t5-trz${T5.tr === k ? " on" : ""}" data-t5="tr" data-k="${k}" tabindex="0" role="button" aria-label="Transition ${k + 1} to ${k + 2}: ${esc(s.label)}"><title>${esc(s.label)}</title></rect>`).join("");
  return `<figure class="t5-fig"><div class="t5-scroll"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="Discovery trajectory: position of each leading candidate across ${n} configurations">${trs}${cols}${axis}${lines}</svg></div>
    <figcaption class="meta small"><span class="t5-key stable">stable</span> in the leading ${K} in every configuration · <span class="t5-key entered">entered</span> · <span class="t5-key left">left</span> · <span class="t5-key transient">transient</span>. Columns are configurations (numbered below); y = distinct-site position (300 km rule), “out” = outside the leading ${K}. Click a band between two columns to inspect that transition, a line to inspect a candidate. Positions are computed by the engine for each configuration — nothing is interpolated.</figcaption></figure>`;
}
function t5StateList() {
  return `<ol class="t5-states">${T5.states.map((s, k) => `<li><b>${k + 1}</b> ${esc(s.label)} <span class="meta small">${esc(s.config)} · ${esc(t5ProfileLabel(s.profile))} · #1 ${esc(t5Short(s.distinct[0]))} ${fmtPct(s.eff[s.distinct[0]])}</span></li>`).join("")}</ol>`;
}
function t5Summary(A, TR) {
  const st = T5.states, n = st.length, K = T5.K, c = A.candidates;
  const leadChanges = TR.filter(t => t.topChanged).length;
  const big = TR.slice().sort((a, b) => a.overlap - b.overlap)[0];
  const disp = c.filter(x => x.displaced.some(d => d != null));
  const nS = c.filter(x => x.class === "stable").length;
  const parts = [`Across ${n} configurations, <b>${nS}</b> candidate${nS === 1 ? "" : "s"} stayed in the leading ${K} throughout, <b>${c.filter(x => x.class === "entered").length}</b> entered, <b>${c.filter(x => x.class === "left").length}</b> left and <b>${c.filter(x => x.class === "transient").length}</b> came and went.`];
  parts.push(`The #1 site changed ${leadChanges} time${leadChanges === 1 ? "" : "s"}.`);
  if (big && big.overlap < 1) parts.push(`The largest reshuffle was <b>${esc(st[TR.indexOf(big) + 1].label)}</b>: ${big.entered.length} of the leading ${K} replaced.`);
  if (disp.length) parts.push(`${disp.length} candidate${disp.length > 1 ? "s" : ""} scored high enough for the leading ${K} in at least one configuration but ${disp.length > 1 ? "were" : "was"} excluded there only by the 300 km distinct-site rule (a higher-scoring site nearby) — a separation effect, not a loss of similarity.`);
  return `<p class="t5-sum">${parts.join(" ")}</p><p class="meta small">${esc(TJ.SENS_NOTE)}</p>`;
}
function t5ChangeText(c) {
  if (c.kind === "weight") return `${labelOf(c.criterion)} weight ${(+c.from).toFixed(2)} → ${(+c.to).toFixed(2)}${c.activated ? " (criterion switched on)" : c.deactivated ? " (criterion switched off)" : ""}`;
  if (c.kind === "target") return `Target ${t5Name(c.from)} → ${t5Name(c.to)}`;
  if (c.kind === "profile") return `Profile ${t5ProfileLabel(c.from)} → ${t5ProfileLabel(c.to)}`;
  return `Scoring configuration ${c.from} → ${c.to}`;
}
function t5Detail(s, i) {
  if (s.tid === "cross") return null;
  const keep = S.ranges; S.ranges = s.ranges;
  try { return ENG.detail(S.A, S.critIds, i, S.T[s.tid].variables, s.weights, s.ranges); } finally { S.ranges = keep; }
}
function t5Transition(TR) {
  if (T5.tr == null || !TR[T5.tr]) return "";
  const t = TR[T5.tr], a = T5.states[T5.tr], b = T5.states[T5.tr + 1];
  let h = `<div class="sec t5-panel"><div class="lbl">Transition ${T5.tr + 1} → ${T5.tr + 2}<span class="n">${esc(b.label)}</span></div>
    <div class="grid2"><div><div class="cap">Assumptions that changed</div><ul class="lab-ul">${t.changes.map(c => `<li>${esc(t5ChangeText(c))}</li>`).join("") || "<li>none</li>"}</ul>
      <p class="meta small">${t.attribution === "single" ? "One assumption changed, so every rank change in this step is attributable to it." : t.attribution === "joint" ? "Several assumptions changed together; their effects are reported jointly and cannot be separated from this step alone." : ""}</p></div>
    <div><div class="cap">Leading ${T5.K}</div><p class="small">${Math.round(100 * t.overlap)} % kept · #1 ${t.topChanged ? `changed: ${esc(t5Short(a.distinct[0]))} → ${esc(t5Short(b.distinct[0]))}` : "unchanged"}</p>
      <p class="small">Entered: ${t.entered.map(i => `<button class="lnk" data-t5="cand" data-i="${i}">${esc(t5Short(i))}</button>`).join(", ") || "none"}<br>Left: ${t.left.map(i => `<button class="lnk" data-t5="cand" data-i="${i}">${esc(t5Short(i))}</button>`).join(", ") || "none"}</p></div></div>`;
  if (t.sameTarget && t.movers.length) h += `<div class="tbl-wrap"><table class="t"><caption class="sr-only">Largest cell-rank movements in this transition</caption><thead><tr><th>Candidate</th><th class="n">Cell rank before</th><th class="n">after</th><th class="n">Δ</th></tr></thead><tbody>${t.movers.map(m => `<tr><td><button class="lnk" data-t5="cand" data-i="${m.i}">${esc(t5Short(m.i))}</button></td><td class="n">${m.from ?? "—"}</td><td class="n">${m.to ?? "—"}</td><td class="n ${m.delta > 0 ? "st-d" : m.delta < 0 ? "p4-bad" : ""}">${m.delta == null ? "—" : (m.delta > 0 ? "▲" : m.delta < 0 ? "▼" : "") + Math.abs(m.delta)}</td></tr>`).join("")}</tbody></table></div>`;
  return h + `</div>`;
}
function t5Candidate(A, TR) {
  const c = A.candidates.find(x => x.i === T5.sel); if (!c) return `<div class="sec"><p class="meta">Select a candidate line (or a name in a transition) to see its evidence.</p></div>`;
  const i = c.i, st = T5.states, last = st[st.length - 1];
  let h = `<div class="sec t5-panel"><div class="lbl">Candidate<span class="n">${esc(placeStr(i))}</span></div>
    <div class="row"><span class="tag ${c.class === "stable" ? "st-d" : c.class === "left" ? "p4-bad" : ""}">${esc(c.class)}</span><span class="meta">${c.inGroup}/${st.length} configurations in the leading ${T5.K} · cell rank ${c.bestRank ?? "—"}–${c.worstRank ?? "—"} (median ${c.medianRank ?? "—"}) · score ${fmtPct(c.scoreMin)}–${fmtPct(c.scoreMax)}${c.ineligibleIn ? ` · ineligible in ${c.ineligibleIn}` : ""}</span>
    <button class="btn-sm" data-t5="fly" data-i="${i}">Show on globe</button></div>
    <div class="tbl-wrap"><table class="t"><thead><tr><th>#</th><th>Configuration</th><th class="n">Site</th><th class="n">Cell rank</th><th class="n">Score</th><th>Note</th></tr></thead><tbody>${st.map((s, k) => `<tr><td>${k + 1}</td><td class="small">${esc(s.label)}</td><td class="n">${c.pos[k] ?? "—"}</td><td class="n">${c.ranks[k] ?? "—"}</td><td class="n">${fmtPct(c.scores[k])}</td><td class="small">${c.displaced[k] != null ? `displaced by ${esc(t5Where(c.displaced[k]))} — within 300 km, higher score` : c.ranks[k] == null ? "ineligible (coverage < 80 %)" : ""}</td></tr>`).join("")}</tbody></table></div>`;
  if (T5.tr != null) {
    const a = st[T5.tr], b = st[T5.tr + 1];
    if (a.tid === b.tid && a.tid !== "cross") {
      const D = TJ.decompose(t5Detail(a, i), t5Detail(b, i));
      h += `<div class="cap">Why its score changed in transition ${T5.tr + 1} → ${T5.tr + 2}: ${D.deltaScore >= 0 ? "+" : "−"}${(100 * Math.abs(D.deltaScore)).toFixed(2)} pts = Σ per-criterion contribution changes ${D.closes ? "(exact)" : "(does not close — reported)"}</div>
        <div class="t5-bars" role="list">${D.rows.map(r => { const v = r.delta * 100, wpx = Math.min(100, Math.abs(v) * 6); return `<div role="listitem" class="t5-bar"><span>${esc(shortOf(r.criterion))}</span><i class="${v >= 0 ? "pos" : "neg"}" style="width:${wpx}%"></i><b>${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)} pts</b><span class="meta small">k ${r.kFrom == null ? "—" : (100 * r.kFrom).toFixed(1)} → ${r.kTo == null ? "—" : (100 * r.kTo).toFixed(1)} · w ${(+r.wFrom).toFixed(2)} → ${(+r.wTo).toFixed(2)}</span></div>`; }).join("")}</div>
        <p class="meta small">k<sub>c</sub> = w<sub>c</sub>·s<sub>c</sub> / Σw over criteria with an Earth value; a weight change moves every k because Σw changes. Coverage ${(100 * D.coverageFrom).toFixed(0)} % → ${(100 * D.coverageTo).toFixed(0)} %.</p>`;
    } else h += `<p class="meta small">Per-criterion decomposition is shown for transitions within one single-target configuration (this one changes the target or uses the cross-planet minimum).</p>`;
  }
  if (last.tid !== "cross") {
    const others = last.distinct.slice(0, T5.K).filter(j => j !== i), rival = others.includes(T5.rival) ? T5.rival : others[0];
    if (rival != null) {
      const sep = TJ.separating(t5Detail(last, i), t5Detail(last, rival));
      h += `<div class="cap">What separates it from <select data-t5in="rival" aria-label="Competing candidate">${others.map(j => `<option value="${j}" ${j === rival ? "selected" : ""}>${esc(t5Short(j))}</option>`).join("")}</select> (configuration ${st.length})</div>
        <div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th><th class="n">s · this</th><th class="n">s · rival</th><th class="n">gap</th><th>Status</th></tr></thead><tbody>${sep.map(r => `<tr><td>${esc(labelOf(r.criterion))}</td><td class="n">${r.sX == null ? "—" : r.sX.toFixed(3)}</td><td class="n">${r.sY == null ? "—" : r.sY.toFixed(3)}</td><td class="n">${r.gap == null ? "—" : (r.gap >= 0 ? "+" : "−") + Math.abs(r.gap).toFixed(3)}</td>
          <td class="small">${{ active: "weighted", inactive: "weight 0 — weighting it would separate them" + (r.gap != null && Math.abs(r.gap) > 0.1 ? " strongly" : ""), target_missing: "no target measurement — a compatible measurement could separate them", earth_missing: "Earth value missing for one of them" }[r.status]}</td></tr>`).join("")}</tbody></table></div>`;
    }
    h += t5Story(c, last);
  }
  return h + `</div>`;
}
function t5Story(c, s) {
  const tr = S.T[s.tid], d = t5Detail(s, c.i);
  const missingT = S.critIds.filter(k => tr.variables[k] == null).map(labelOf), prox = S.critIds.filter(k => tr.proxy_flags && tr.proxy_flags[k] && s.weights[k] > 0).map(labelOf);
  const named = { ...d, rows: d.rows.map(r => ({ ...r, c: labelOf(r.c) + (tr.proxy_flags && tr.proxy_flags[r.c] ? " [proxy]" : "") })) };
  const S1 = TJ.story({ targetName: t5Name(s.tid), candidateName: placeStr(c.i), state: { ...s, weights: Object.fromEntries(Object.entries(s.weights).map(([k, w]) => [shortOf(k), w])) }, detail: named, cand: c,
    thresholds: S.app.thresholds, missingTarget: missingT, proxies: prox, sources: (tr.sources || []).slice(0, 4), K: T5.K });
  T5._story = { s: S1, title: `${placeStr(c.i)} as an analogue of ${t5Name(s.tid)}` };
  return `<div class="t5-story" aria-label="Discovery story"><div class="lbl">Discovery story<span class="n">evidence-backed · generated from the numbers above, no language model</span></div>
    <div class="row">${S1.labels.map(l => `<span class="tag">${esc(l)}</span>`).join("")}</div>
    <dl class="t5-dl">${S1.sections.map(x => `<dt>${esc(x.h)}</dt><dd>${esc(x.t)}</dd>`).join("")}</dl>
    <div class="row"><button class="btn-sm" data-t5="storymd">Export story (Markdown)</button></div></div>`;
}
function viewTrajectory() {
  if (!S.app || !S.res) return `<div class="sec"><div class="empty">Loading…</div></div>`;
  if (!T5.states.length && S.searched && T5.auto) t5Push(t5StateFrom(S.res.tid, S.res.w, S.profile, S.res.eff, S.res.rank, S.res.distinct));
  const st = T5.states;
  let h = `<div class="sec t5-head"><div class="body-tag">SIGNATURE · DISCOVERY TRAJECTORY</div><h2 class="ttl t5-h1">How your choices reshape the analogue landscape</h2>
    <p class="note">Change weights or profiles in the console below, switch target, or add the declared profiles: each settled configuration is scored by the engine and added here. The trajectory shows which Earth candidates are robust to your choices, which depend on them, and why.</p>
    <div class="row t5-ctl"><label class="ck"><input type="checkbox" data-t5in="auto" ${T5.auto ? "checked" : ""}> record automatically</label>
      <button class="btn-sm" data-t5="rec">Record current</button><button class="btn-sm" data-t5="sweep" ${T5.busy ? "disabled" : ""}>Add declared profiles</button>
      <label>Leading group<select data-t5in="k">${[5, 10, 20].map(k => `<option value="${k}" ${T5.K === k ? "selected" : ""}>top ${k}</option>`).join("")}</select></label>
      <button class="btn-sm" data-t5="exp" ${st.length ? "" : "disabled"}>Export trajectory</button><label class="btn-sm p4-file">Import &amp; replay<input type="file" accept="application/json,.json" data-t5in="imp" class="sr-only"></label>
      <button class="btn-sm" data-t5="clear" ${st.length ? "" : "disabled"}>Clear</button></div>
    <div aria-live="polite" class="small">${T5.busy ? `Computing profile ${T5.busy.done + 1} of ${T5.busy.total}…` : T5.pend ? "Recalculating — the configuration is recorded when it settles." : ""}${T5.msg ? `<span class="meta"> ${esc(T5.msg)}</span>` : ""}</div></div>`;
  if (st.length < 2) return h + `<div class="sec"><div class="callout">${st.length ? "One configuration recorded." : "No configuration recorded yet."} Move a weight slider, pick another profile, or press “Add declared profiles” to start a trajectory.</div>${st.length ? t5StateList() : ""}</div>`;
  const A = TJ.analyse(st, { K: T5.K, lat: S.lat, lon: S.lon, sep: S.app.thresholds.distinct_sep_km }), TR = TJ.transitions(st, S.critIds, { K: T5.K });
  if (T5.sel == null || !A.candidates.some(c => c.i === T5.sel)) T5.sel = (A.candidates[0] || {}).i ?? null;
  h += `<div class="sec">${t5Summary(A, TR)}${t5Chart(A)}${t5StateList()}
    <details><summary>Data table (same numbers as the chart)</summary><div class="tbl-wrap"><table class="t"><thead><tr><th>Candidate</th><th>Class</th>${st.map((s, k) => `<th class="n">${k + 1}</th>`).join("")}</tr></thead><tbody>${A.candidates.map(c => `<tr><td>${esc(t5Short(c.i))}</td><td>${esc(c.class)}</td>${c.pos.map((p, k) => `<td class="n">${p ? "#" + p : c.ranks[k] ? "r" + c.ranks[k] : "—"}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="meta small">#n = distinct-site position; rN = cell rank when outside the leading group.</p></details></div>`;
  h += t5Transition(TR) + t5Candidate(A, TR);
  return h;
}
/* replay an imported trajectory with the engine (exact when every target and range set is available) */
function t5Replay(doc) {
  const errs = TJ.validateTrajectory(doc); if (errs.length) { T5.msg = "Import refused: " + errs.join("; "); return; }
  if (doc.predictor_stack_sha256 && doc.predictor_stack_sha256 !== S.app.stack.sha256) { T5.msg = "Import refused: the trajectory was computed on a different predictor stack."; return; }
  const out = [], notes = [];
  for (const r of doc.states) {
    if (r.target !== "cross" && !S.T[r.target]) { notes.push(`${r.label}: target ${r.target} unavailable — skipped`); continue; }
    const w = Object.fromEntries(S.critIds.map(c => [c, +r.weights[c] || 0]));
    const want = r.target === "cross" ? S.app.ranges : (typeof a4RangesFor === "function" ? a4RangesFor(r.target) : S.app.ranges);
    const exact = !r.normalization_ranges || JSON.stringify(r.normalization_ranges) === JSON.stringify(want);
    const eff = effectiveFor(r.target, w), o = ENG.order(eff, S.cell), dist = ENG.distinctSites(o, S.lat, S.lon, 20, S.app.thresholds.distinct_sep_km);
    let same = null;
    if (r.expected_sites) same = r.expected_sites.every((x, k) => dist[k] != null && S.cell[dist[k]] === x.cell_id && Math.abs(eff[dist[k]] - x.score) <= 5e-13);
    out.push(t5StateFrom(r.target, w, r.profile || "custom", eff, ENG.ranksFromOrder(o), dist, { label: r.label }));
    notes.push(`${r.label}: ${same === true ? "REPRODUCED" : same === false ? "DIFFERS from the exported sites" : "recomputed"}${exact ? "" : " (ranges differ from this build — best-effort rerun)"}`);
  }
  T5.states = out.slice(-T5_MAX); T5.tr = T5.states.length >= 2 ? 0 : null; T5.sel = null;
  T5.msg = `Replayed ${out.length} configurations. ` + notes.join(" · ");
}
function t5StoryMd() {
  const x = T5._story; if (!x) return;
  const md = [`# ${x.title}`, ``, `*${x.s.labels.join(" · ")}*`, ``, ...x.s.sections.flatMap(s => [`## ${s.h}`, ``, s.t, ``]),
    `---`, `Generated by ASTERRO from deterministic engine results (${S.app.algorithm_version}; predictor stack ${S.app.stack.sha256.slice(0, 16)}…). No language model was used. Not a safety, suitability or habitability assessment.`].join("\n");
  const blob = new Blob([md], { type: "text/markdown" }), u = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = u; a.download = "asterro_discovery_story.md"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000);
}
/* tab + rendering */
(function t5Tab() {
  const nav = $(".tabs"); if (!nav || $("#tab-trajectory")) return;
  const b = document.createElement("button"); b.setAttribute("role", "tab"); b.dataset.tab = "trajectory"; b.id = "tab-trajectory"; b.textContent = "Trajectory";
  b.title = "Discovery trajectory: how your weight and profile choices reshape the leading Earth analogues";
  const atlas = $("#tab-atlas"); atlas ? atlas.insertAdjacentElement("beforebegin", b) : nav.appendChild(b);   // wire() binds setTab to every tab button
})();
const _t5RenderLeft = renderLeft;
renderLeft = function () {
  if (S.tab !== "trajectory") return _t5RenderLeft.apply(this, arguments);
  const box = $("#left"), top = box.scrollTop;
  box.innerHTML = `<div data-p4>${viewTrajectory()}</div>`; box.scrollTop = top; $("#app").classList.add("wide");
};
document.addEventListener("click", e => {
  const a = e.target.closest("[data-t5]"); if (!a || a.disabled) return;
  const k = a.dataset.t5; e.preventDefault();
  if (k === "cand") { T5.sel = +a.dataset.i; T5.rival = null; renderLeft(); }
  else if (k === "tr") { T5.tr = +a.dataset.k; renderLeft(); }
  else if (k === "rec") { const was = T5.auto; T5.auto = true; t5RecordNow(); T5.auto = was; renderLeft(); }
  else if (k === "sweep") t5ProfileSweep();
  else if (k === "clear") { T5.states = []; T5.tr = null; T5.sel = null; T5.msg = null; renderLeft(); }
  else if (k === "fly") { select(+a.dataset.i, true); }
  else if (k === "storymd") t5StoryMd();
  else if (k === "exp") {
    const doc = TJ.exportTrajectory(T5.states, { exported_utc: new Date().toISOString(), algorithm_version: S.app.algorithm_version, predictor_stack_sha256: S.app.stack.sha256,
      registry_version: typeof A4 !== "undefined" && A4.reg ? A4.reg.registry_version : null, leading_group: T5.K }, 10);
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }), u = URL.createObjectURL(blob), l = document.createElement("a");
    l.href = u; l.download = "asterro_trajectory.json"; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000);
  }
});
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const g = e.target.closest && e.target.closest("svg [data-t5]"); if (!g) return;
  e.preventDefault(); g.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
document.addEventListener("change", async e => {
  const a = e.target.closest("[data-t5in]"); if (!a) return;
  const k = a.dataset.t5in;
  if (k === "auto") T5.auto = a.checked;
  else if (k === "k") T5.K = +a.value;
  else if (k === "rival") T5.rival = +a.value;
  else if (k === "imp") { const f = a.files && a.files[0]; if (!f) return; try { t5Replay(JSON.parse(await f.text())); } catch (err) { T5.msg = "Import refused: " + err.message; } }
  renderLeft();
});

/* accessibility fix (additive): the baseline console is rebuilt after every committed change, which dropped keyboard
 * focus from the slider after one arrow-key step. Restore focus to the same control after the rebuild. */
const _t5RenderConsole = renderConsole;
renderConsole = function () {
  const id = document.activeElement && document.activeElement.closest && document.activeElement.closest("#console") ? document.activeElement.id : null;
  const r = _t5RenderConsole.apply(this, arguments);
  if (id) { const el = document.getElementById(id); if (el) el.focus(); }
  return r;
};
