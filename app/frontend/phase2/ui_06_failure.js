/* ===== Phase II · Analogue Failure-Mode Laboratory ===== */
L.fm = { tgt: null, activity: "rover_mobility", tau: 0.5, strongCrit: null, strong: 0.98 };

function lossRows(i, tid, w) {
  const d = ENG.detail(S.A, S.critIds, i, S.T[tid].variables, w, S.ranges);
  return d.rows.filter(r => r.active).map(r => ({ c: r.c, e: r.e, t: r.t, s: r.s, d: r.d, w: r.w,
    loss: r.s == null ? null : 100 * r.w * (1 - r.s) / d.wsum, missing: r.s == null })).sort((a, b) => (b.loss ?? -1) - (a.loss ?? -1));
}
function topPctLimit(eff, p) { return Math.max(1, Math.floor(LAB.countEligible(eff) * p / 100)); }
function rankArray(eff) { return ENG.ranksFromOrder(ENG.order(eff, S.cell)); }

function runCounterexamples() {
  const tid = S.targetId, R = S.res, w = { ...S.weights }, act = activeFor(tid, w);
  const t0 = performance.now(), pool = Array.from(R.order.slice(0, 800));
  const sc = (c, i) => simC(c, i);
  const a = pool.map(i => ({ i, min: Math.min(...act.map(c => { const v = sc(c, i); return v === v ? v : Infinity; })), worst: act.reduce((b, c) => { const v = sc(c, i); return v === v && (b == null || v < sc(b, i)) ? c : b; }, null) }))
    .filter(x => x.min < L.fm.tau).sort((x, y) => R.eff[y.i] - R.eff[x.i]);
  const sc_c = L.fm.strongCrit && act.includes(L.fm.strongCrit) ? L.fm.strongCrit : act[0], hiLim = Math.floor(R.nElig * 0.10);
  const b = []; for (let k = 800; k < hiLim; k++) { const i = R.order[k], v = sc(sc_c, i); if (v >= L.fm.strong) b.push({ i, v, rank: k + 1 }); }
  b.sort((x, y) => y.v - x.v || x.rank - y.rank);
  // profile flips
  const Ps = PsFor(tid), prof = Object.entries(S.app.profiles), ranks = {};
  for (const [pid, p] of prof) { try { ranks[pid] = rankArray(LAB.effFor(Ps, p.weights)); } catch (e) { ranks[pid] = null; } }
  const n1 = Math.floor(R.nElig * 0.01), n10 = Math.floor(R.nElig * 0.10), flips = [];
  for (const [p1] of prof) for (const [p2] of prof) {
    if (p1 === p2 || !ranks[p1] || !ranks[p2]) continue;
    let cnt = 0, ex = null;
    for (let i = 0; i < S.n; i++) if (ranks[p1][i] <= n1 && ranks[p2][i] > n10) { cnt++; if (ex == null || ranks[p1][i] < ranks[p1][ex]) ex = i; }
    if (cnt) flips.push({ p1, p2, cnt, ex });
  }
  flips.sort((x, y) => y.cnt - x.cnt);
  // proxy dependence
  const prox = act.filter(c => targetsFor(tid).some(t => S.T[t].proxy_flags[c]));
  let pd = null;
  if (prox.length && prox.length < act.length) {
    const w2 = { ...w }; for (const c of prox) w2[c] = 0;
    const r2 = rankArray(LAB.effFor(Ps, w2)), lim1 = topPctLimit(R.eff, 1), lim10 = topPctLimit(R.eff, 10), list = [];
    for (let i = 0; i < S.n; i++) if (R.rank[i] <= lim1 && r2[i] > lim10) list.push({ i, r0: R.rank[i], r1: r2[i] });
    list.sort((x, y) => x.r0 - y.r0);
    pd = { prox, list, lim1, lim10 };
  }
  L.res.fm = { key: baseKey(), tid, a, b, sc_c, flips, pd, ms: performance.now() - t0, n1, n10, hiLim };
  makeRecord("counterexamples", { tau: L.fm.tau, strongCrit: sc_c, strong: L.fm.strong },
    { highButMismatch: a.length, strongSingle: b.length, profileFlips: flips.map(f => [f.p1, f.p2, f.cnt]), proxyDependent: pd ? pd.list.length : null }).then(r => { L.res.fm.rec = r; labRender(); });
  labRender();
}
function failureCard(o) {
  return `<div class="fm-card"><div class="fm-h">${esc(o.title)}</div><dl>
    <dt>Mismatch</dt><dd>${o.what}</dd><dt>Evidence</dt><dd>${o.evidence}</dd><dt>Why it may matter</dt><dd>${o.why}</dd>
    <dt>Missing information</dt><dd>${o.missing}</dd><dt>Investigate next</dt><dd>${o.next}</dd></dl></div>`;
}
LAB_VIEWS.failure = function () {
  if (!S.res) return `<div class="sec"><div class="empty">Run the search first.</div></div>`;
  const i = labSel(); if (i == null) return `<div class="sec"><div class="empty">Select a site.</div></div>`;
  const tid = S.targetId === "cross" ? (L.fm.tgt || TARGET_IDS[0]) : S.targetId, T = S.T[tid], w = S.weights, ctx = L.ctx;
  const rows = lossRows(i, tid, w), score = scoreCell(i, tid, w);
  let h = `<div class="sec"><h3 class="ttl">Analogue failure-mode laboratory</h3>${experimentBanner("analysis")}
    <p class="note">How could the apparent match of <b>${esc(candShort(i))}</b> (${fmtPct(score, 1)} to ${esc(TNAME[tid])}) mislead a particular research objective? This exposes limitations; it does not certify or score risk.</p>
    ${S.targetId === "cross" ? `<div class="toggles">${TARGET_IDS.map(t => `<button aria-pressed="${t === tid}" data-lab="fm-t" data-t="${t}">${esc(TNAME[t])}</button>`).join("")}</div>` : ""}</div>
    <div class="sec"><div class="lbl">Criterion failure analysis — score points lost to each mismatch</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th><th class="n">Earth</th><th class="n">Target</th><th class="n">s</th><th class="n">Points lost</th><th>Direction</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${esc(labelOf(r.c))} ${T.proxy_flags[r.c] ? '<span class="tag proxy">PROXY</span>' : ""}</td><td class="n">${r.e == null ? "missing" : fmtVal(r.c, r.e) + " " + unitOf(r.c)}</td><td class="n">${fmtVal(r.c, r.t)} ${unitOf(r.c)}</td><td class="n">${r.s == null ? "—" : r.s.toFixed(3)}</td><td class="n">${r.loss == null ? "excluded" : r.loss.toFixed(1)}</td><td class="meta">${r.e == null ? "no Earth value — dropped and renormalised" : r.e > r.t ? "Earth higher than target" : r.e < r.t ? "Earth lower than target" : "equal"}</td></tr>`).join("")}
    </tbody></table></div><p class="note small">Points lost = 100 · wᶜ(1 − sᶜ)/Σw; they sum with the score to 100 (when no value is missing).</p></div>`;
  // missing factors
  const lst = (k) => S.A[k][i];
  const absRow = () => {
    if (!ctx) return "loading…";
    if (tid === "mars_jezero") { const m = ctx.meda_ground; return `Earth MODIS day ${lst("lst_day_k").toFixed(1)} K / night ${lst("lst_night_k").toFixed(1)} K · Mars MEDA ground 13–14 h ${m.t13_mean_K.toFixed(1)} K / 01–02 h ${m.t01_mean_K.toFixed(1)} K (${m.sols} sols) · night difference ${(lst("lst_night_k") - m.t01_mean_K).toFixed(1)} K`; }
    const d = T.raw_reference.diviner; return `Earth MODIS day ${lst("lst_day_k").toFixed(1)} K / night ${lst("lst_night_k").toFixed(1)} K · Moon Diviner T(13–14 h) summer ${d.summer.mean_T14_K.toFixed(1)} / winter ${d.winter.mean_T14_K.toFixed(1)} K, T(01–02 h) ${d.summer.mean_T02_K.toFixed(1)} / ${d.winter.mean_T02_K.toFixed(1)} K · night difference ≥ ${(lst("lst_night_k") - Math.max(d.summer.mean_T02_K, d.winter.mean_T02_K)).toFixed(0)} K`;
  };
  const mf = ctx ? ctx.catalog.missing_factors : [];
  h += `<div class="sec"><div class="lbl">Planetary differences outside the six-criterion model</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Factor</th><th>Status</th><th>Evidence in this build</th></tr></thead><tbody>
    ${mf.map(f => `<tr><td>${esc(f.label)}</td><td>${f.status === "UNMODELED" ? evTag("UNAVAILABLE") + ' <span class="meta">unmodelled</span>' : f.status === "PARTIAL" ? '<span class="tag proxy">PROXY ONLY</span>' : evTag("MEASURED")}</td>
      <td class="meta">${f.id === "absolute_temperature" ? esc(absRow()) : f.id === "pressure" && tid === "mars_jezero" ? `Mars MEDA median ${T.raw_reference.meda_median_pressure_Pa.toFixed(0)} Pa; Earth pressure not in stack. ${esc(f.note)}` : esc(f.note)}</td></tr>`).join("") || `<tr><td class="meta">${L.ctxErr ? esc(L.ctxErr) : "Loading catalogue…"}</td></tr>`}</tbody></table></div></div>`;
  // mission-contextual
  if (ctx) {
    const A = ctx.catalog.activities[L.fm.activity], sim = Object.fromEntries(rows.map(r => [r.c, r]));
    h += `<div class="sec"><div class="lbl">Mission-contextual limitations<select data-labin="fm-act">${Object.entries(ctx.catalog.activities).map(([k, a]) => `<option value="${k}"${k === L.fm.activity ? " selected" : ""}>${esc(a.label)}</option>`).join("")}</select></div>
      <p class="note small">Editorial review checklist (src/phase2/catalog.py): which modelled criteria and unmodelled factors a researcher should review for this activity. It contains no thresholds and makes no suitability, safety, habitability or certification judgement.</p>
      <div class="grid2"><div><div class="cap">Modelled criteria to review</div><ul class="lab-ul">${A.criteria.map(c => `<li>${esc(labelOf(c))}: ${T.variables[c] == null ? "N/A for this target" : sim[c] && sim[c].s != null ? `s = ${sim[c].s.toFixed(3)} (${ENG.classify(sim[c].s)})${T.proxy_flags[c] ? " · PROXY" : ""}` : "no Earth value"}</li>`).join("")}</ul></div>
      <div><div class="cap">Unmodelled factors to review</div><ul class="lab-ul">${A.factors.map(f => { const F = mf.find(x => x.id === f); return `<li>${esc(F.label)} — ${F.status === "UNMODELED" ? "not evaluated" : F.status === "PARTIAL" ? "proxy only" : "see table above"}</li>`; }).join("")}</ul></div></div></div>`;
  }
  // failure cards for the top two losses
  const cards = rows.filter(r => r.loss != null && r.loss > 0).slice(0, 2).map(r => failureCard({
    title: `${labelOf(r.c)} — ${r.loss.toFixed(1)} points lost`,
    what: `Earth ${fmtVal(r.c, r.e)} ${unitOf(r.c)} vs target ${fmtVal(r.c, r.t)} ${unitOf(r.c)} (normalised difference ${r.d.toFixed(3)}, similarity ${r.s.toFixed(3)}).`,
    evidence: `${esc(S.app.datasets.find(d => d.id === S.crit.find(x => x.id === r.c).earth_source[0]).dataset.split(";")[0])}; target: ${esc(T.methodology[r.c].slice(0, 160))}…`,
    why: T.proxy_flags[r.c] ? "The target side is a proxy definition, so the mismatch reflects a modelling choice rather than a measured planetary difference." : "Activities sensitive to this variable would meet conditions that differ from the target environment.",
    missing: r.c === "lst_diurnal_range" ? "Absolute temperature level, illumination and sub-cell thermal variability are not compared." : r.c === "slope" || r.c === "surface_roughness" ? "Sub-cell terrain distribution of the Earth cell (not retained)." : "Interannual variability and finer-scale structure.",
    next: T.proxy_flags[r.c] ? `Re-run the Robustness ablation without ${labelOf(r.c)} to see how much of the rank depends on this proxy.` : `Inspect the Spatial atlas and Uncertainty explorer for ${labelOf(r.c)}; obtain finer-scale data for the area before relying on it for a study sensitive to this variable.` }));
  if (cards.length) h += `<div class="sec"><div class="lbl">Largest mismatches explained</div>${cards.join("")}</div>`;
  // counterexamples
  const C = L.res.fm, act = activeFor(S.targetId);
  h += `<div class="sec"><div class="lbl">Counterexample discovery (whole field)<button class="btn-sm" data-lab="fm-run">Search</button></div>
    <div class="lab-form"><label>Major-mismatch threshold s &lt; <input type="number" min="0.1" max="0.9" step="0.05" value="${L.fm.tau}" data-labin="fm" data-k="tau"></label>
    <label>Strong single match on <select data-labin="fm-crit">${act.map(c => `<option value="${c}"${c === L.fm.strongCrit ? " selected" : ""}>${esc(shortOf(c))}</option>`).join("")}</select></label>
    <label>s ≥ <input type="number" min="0.8" max="1" step="0.01" value="${L.fm.strong}" data-labin="fm" data-k="strong"></label></div>`;
  if (C) {
    const ex = (list, f) => list.slice(0, 5).map(x => `<li><button class="lnk" data-lab="sel" data-i="${x.i}">${esc(candShort(x.i))}</button> <span class="meta">${f(x)}</span></li>`).join("");
    h += `${staleNote(C)}<div class="fm-grid">
      <div><div class="cap">High overall similarity, major criterion mismatch</div><p class="note small">${C.a.length} of the top 800 cells have s &lt; ${L.fm.tau} on at least one active criterion${C.a.length ? " — worst criterion: " + Object.entries(C.a.reduce((m, x) => (m[x.worst] = (m[x.worst] || 0) + 1, m), {})).sort((p, q) => q[1] - p[1]).map(([c, n]) => `${shortOf(c)} ${n}`).join(", ") : ""}.</p><ol class="lab-ol">${ex(C.a, x => `${fmtPct(S.res.eff[x.i])} · worst ${shortOf(x.worst)} s = ${x.min.toFixed(2)}`)}</ol></div>
      <div><div class="cap">Lower overall similarity, strong match on ${esc(shortOf(C.sc_c))}</div><p class="note small">${C.b.length} cells ranked 801–${C.hiLim.toLocaleString()} have s ≥ ${L.fm.strong}.</p><ol class="lab-ol">${ex(C.b, x => `rank #${x.rank.toLocaleString()} · s = ${x.v.toFixed(3)}`)}</ol></div>
      <div><div class="cap">Similar under one profile, not another</div><p class="note small">Cells in the top 1% (${C.n1.toLocaleString()}) under one mission profile but outside the top 10% under another.</p><ul class="lab-ul">${C.flips.slice(0, 5).map(f => `<li>${esc(S.app.profiles[f.p1].label)} → ${esc(S.app.profiles[f.p2].label)}: ${f.cnt.toLocaleString()} cells · e.g. <button class="lnk" data-lab="sel" data-i="${f.ex}">${esc(candShort(f.ex))}</button></li>`).join("") || "<li>none</li>"}</ul></div>
      <div><div class="cap">Depends on proxy criteria</div>${C.pd ? `<p class="note small">${C.pd.list.length} cells in the baseline top 1% fall outside the top 10% when the proxy criteria (${C.pd.prox.map(shortOf).join(", ")}) are given weight 0.</p><ol class="lab-ol">${ex(C.pd.list, x => `baseline #${x.r0.toLocaleString()} → #${x.r1.toLocaleString()}`)}</ol>` : `<p class="note small">Not applicable (no active proxy, or only proxies active).</p>`}</div></div>
      <p class="note small">${(C.ms / 1000).toFixed(1)} s${C.rec ? " · record " + C.rec.id : ""}. Cross mode uses the minimum of the two targets' criterion similarities.</p>`;
  }
  const claims = [LAB.claim({ id: "fm.losses", category: "DERIVED", text: "Points lost per criterion decompose the baseline score exactly.", method: "100·w(1−s)/Σw from the baseline breakdown (TAIEngine.detail).", provenance: ["predictor stack", "targets.json"] }),
    LAB.claim({ id: "fm.factors", category: "UNAVAILABLE", text: "Gravity, composition, radiation, geology, day length, dust, illumination and subsurface conditions are not evaluated." }),
    LAB.claim({ id: "fm.activity", category: "ASSUMED", text: "The activity checklist is an editorial mapping, not a rule.", limitations: ["Contains no thresholds; not a suitability or safety judgement."] })];
  return h + `</div><div class="sec">${claimsBlock(claims)}</div>`;
};
LAB_ACTIONS["fm-t"] = a => { L.fm.tgt = a.dataset.t; labRender(); };
LAB_ACTIONS["fm-run"] = () => runCounterexamples();
LAB_INPUTS.fm = a => { L.fm[a.dataset.k] = +a.value; };
LAB_INPUTS["fm-crit"] = a => { L.fm.strongCrit = a.value; };
LAB_INPUTS["fm-act"] = a => { L.fm.activity = a.value; labRender(); };
