/* ===== Phase IV · Scenario Lab (planetary counterfactual laboratory, reproducible) =====
 * Up to four scenarios for one target — weighting profile or custom weights, proxy inclusion, normalisation rule —
 * computed side by side: top distinct sites per scenario, a rank-change chart over the union of their top 10,
 * candidates robust across every scenario (rank ≤ 100 in all), and the per-criterion contribution breakdown of a
 * chosen cell. Every set is exported as asterro.scenario-set/1 (recorded ranges and expected sites) and replays in
 * the browser and in Python (scripts/replay_scenario.py). Changing a weight changes the question asked, never the
 * environment; this is mathematical sensitivity, not real-world uncertainty. */
A4.scn = { target: null, list: null, res: null, cell: null, msg: null };
const A4_NORMS = { earth_union_target: "Earth ∪ target (default)", earth_only: "Earth only (target clipped)" };
function a4ScnDefault() {
  const P = S.app.profiles;
  return [
    { id: "s1", label: P.general.label, profile: "general", weights: { ...P.general.weights }, include_proxy: false, normalisation: "earth_union_target" },
    { id: "s2", label: P.thermal.label, profile: "thermal", weights: { ...P.thermal.weights }, include_proxy: false, normalisation: "earth_union_target" },
    { id: "s3", label: P.general.label + " · with proxies", profile: "general", weights: { ...P.general.weights }, include_proxy: true, normalisation: "earth_union_target" },
  ];
}
function a4ScnRun() {
  const t0 = performance.now();
  try {
    A4.scn.res = RG.runScenarios({ IX: A4.ix, A: S.A, cell: S.cell, lat: S.lat, lon: S.lon, critIds: S.critIds, targetId: A4.scn.target,
      scenarios: A4.scn.list.map(s => ({ id: s.id, label: s.label, weights: s.weights, include_proxy: s.include_proxy, normalisation: s.normalisation })),
      algorithm: S.app.algorithm_version, createdUtc: a4Now() });
    A4.scn.res.ms = performance.now() - t0; A4.scn.cell = A4.scn.res.runs[0].top[0]; A4.scn.msg = null;
    announce(`${A4.scn.list.length} scenarios computed; ${A4.scn.res.robust.length} candidates robust across all.`);
  } catch (e) { A4.scn.res = null; A4.scn.msg = { ok: false, text: e.message }; }
  atRender();
}
function a4RankChart(res) {
  const R = res, n = R.runs.length, U = R.union, W = 560, H = 24 + U.length * 18, x = k => 150 + k * ((W - 260) / Math.max(1, n - 1)), cap = 200;
  const y = rk => 16 + (rk == null || rk > cap ? cap : rk - 1) / (cap - 1) * (H - 32);
  const lines = U.map((i, u) => {
    const pts = R.ranks.map((rk, k) => [x(k), y(rk[u])]), rob = R.robust.includes(i);
    return `<g class="p4-rl${rob ? " rob" : ""}"><polyline points="${pts.map(p => p.map(v => v.toFixed(1)).join(",")).join(" ")}"/>${pts.map((p, k) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6"><title>${esc(placeStr(i))} · ${esc(R.runs[k].sc.label)}: rank ${R.ranks[k][u] ?? "ineligible"}</title></circle>`).join("")}
      <text x="${(x(n - 1) + 8).toFixed(1)}" y="${(pts[n - 1][1] + 3).toFixed(1)}">${esc(placeStr(i).slice(0, 26))}</text></g>`;
  }).join("");
  return `<figure class="p4-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="rk-t rk-d"><title id="rk-t">Rank of each candidate under each scenario</title><desc id="rk-d">Lines join a candidate's rank across scenarios (top is rank 1; ranks beyond ${cap} drawn at the bottom). The table below gives the same ranks.</desc>
    ${R.runs.map((r, k) => `<text x="${x(k).toFixed(1)}" y="10" text-anchor="middle" class="ax">${esc(r.sc.id)}</text><line x1="${x(k)}" x2="${x(k)}" y1="14" y2="${H - 14}" class="grat"/>`).join("")}
    <text x="4" y="20" class="ax">rank 1</text><text x="4" y="${H - 16}" class="ax">≥ ${cap}</text>${lines}</svg>
    <figcaption class="meta small">Highlighted: robust candidates (rank ≤ 100 in every scenario). Sensitivity of the ranking to analytical choices — not uncertainty in the environment.</figcaption></figure>`;
}
A3_VIEWS.scen4 = function () {
  const need = a4Need(); if (need) return need;
  const S4 = A4.scn;
  if (!S4.target || !a4T(S4.target) || a4T(S4.target).readiness.level < 2) S4.target = a4T(A3.active) && a4T(A3.active).readiness.level >= 2 ? A3.active : "mars_gale_curiosity";
  if (!S4.list) S4.list = a4ScnDefault();
  const t = a4T(S4.target), R = S4.res && S4.res.config.target === t.id ? S4.res : null;
  let h = `<div class="sec"><h3 class="ttl">Scenario Lab</h3>${a4Banner("reproducible counterfactual scenarios")}
    <p class="note">Ask what changes when the analytical question changes: weights, proxy inclusion, normalisation. Every scenario is computed with the unchanged baseline formula; the set can be exported and replayed exactly. Weights express research priorities — they do not change the environment.</p>
    <div class="lab-form"><label>Target${atTargetPicker(t.id, "scnt", x => x.readiness.level >= 2)}</label><span class="meta small">${a4Level(t)} ${t.readiness.level < 3 ? "· partial comparison (DIRECT criteria only, plus proxies if included)" : ""}</span></div></div>
  <div class="sec"><div class="lbl">Scenarios (${S4.list.length} of 4)</div><div class="p4-scn">${S4.list.map((s, k) => `<fieldset class="p4-sc"><legend>${esc(s.id)}</legend>
      <label>Label<input data-a4in="scnlab" data-k="${k}" value="${esc(s.label)}" maxlength="60"></label>
      <label>Profile<select data-a4in="scnprof" data-k="${k}">${Object.entries(S.app.profiles).map(([p, P]) => `<option value="${p}" ${s.profile === p ? "selected" : ""}>${esc(P.label)}</option>`).join("")}<option value="custom" ${s.profile === "custom" ? "selected" : ""}>custom</option></select></label>
      <div class="p4-w">${S.critIds.map(c => `<label title="${esc(labelOf(c))}">${esc(shortOf(c))}<input type="number" min="0" max="5" step="0.25" data-a4in="scnw" data-k="${k}" data-c="${c}" value="${(+s.weights[c]).toFixed(2)}" aria-label="${esc(labelOf(c))} weight, scenario ${esc(s.id)}"></label>`).join("")}</div>
      <label class="ck"><input type="checkbox" data-a4in="scnpx" data-k="${k}" ${s.include_proxy ? "checked" : ""}> include proxies</label>
      <label>Normalisation<select data-a4in="scnnorm" data-k="${k}">${Object.entries(A4_NORMS).map(([v, l]) => `<option value="${v}" ${s.normalisation === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      ${S4.list.length > 1 ? `<button class="lnk small" data-a4="scnrm" data-k="${k}">remove</button>` : ""}</fieldset>`).join("")}</div>
    <div class="row"><button class="btn-sm" data-a4="scnadd" ${S4.list.length >= 4 ? "disabled" : ""}>Add scenario</button><button class="btn-primary p4-run" data-a4="scnrun">Compute scenarios</button>
      <button class="btn-sm" data-a4="scnexp" ${R ? "" : "disabled"}>Export set (JSON)</button><label class="btn-sm p4-file">Replay a set<input type="file" accept=".json,application/json" data-a4in="scnimp" class="sr-only"></label>
      <button class="btn-sm" data-a4="scnsave" ${R ? "" : "disabled"}>Save to collection</button></div>
    ${S4.msg ? `<p class="small ${S4.msg.ok ? "st-d" : "p4-bad"}" role="status">${esc(S4.msg.text)}</p>` : ""}</div>`;
  if (!R) return h;
  const top = 10;
  h += `<div class="sec"><div class="lbl">Top distinct sites per scenario · ${R.ms.toFixed(0)} ms</div><div class="p4-scols">${R.runs.map(r => `<div><b>${esc(r.sc.id)} · ${esc(r.sc.label)}</b><div class="meta small">${r.active.map(shortOf).join(", ")} · ${esc(A4_NORMS[r.sc.normalisation])}</div>
      <ol class="lab-ul small">${r.top.slice(0, top).map(i => `<li><button class="lnk" data-a4="scncell" data-i="${i}">${esc(placeStr(i))}</button> ${fmtPct(r.eff[i])}${R.robust.includes(i) ? ' <span class="tag st-d">robust</span>' : ""}</li>`).join("")}</ol></div>`).join("")}</div></div>
    <div class="sec"><div class="lbl">Rank changes across scenarios</div>${a4RankChart(R)}
      <div class="tbl-wrap"><table class="t"><thead><tr><th>Candidate</th>${R.runs.map(r => `<th class="n">${esc(r.sc.id)}</th>`).join("")}<th class="n">spread</th></tr></thead><tbody>${R.union.map((i, u) => { const rk = R.ranks.map(x => x[u]); const f = rk.filter(v => v != null); return `<tr><td>${esc(placeStr(i))}</td>${rk.map(v => `<td class="n">${v ?? "—"}</td>`).join("")}<td class="n">${f.length === rk.length ? Math.max(...f) - Math.min(...f) : "—"}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="meta small">${R.robust.length} of ${R.union.length} candidates are robust (rank ≤ 100 in every scenario).</p></div>`;
  const i = S4.cell;
  if (i != null) {
    const C = R.runs.map(r => RG.contributions(r.P, r.sc.weights, i));
    h += `<div class="sec"><div class="lbl">Contribution breakdown · ${esc(placeStr(i))}</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th>${R.runs.map(r => `<th class="n">${esc(r.sc.id)} k = w·s/Σw</th>`).join("")}</tr></thead><tbody>
      ${S.critIds.map(c => `<tr><td>${esc(labelOf(c))}</td>${C.map(ct => `<td class="n">${ct[c] == null ? (c in ct ? "no Earth value" : "excluded") : (100 * ct[c]).toFixed(1) + " pts"}</td>`).join("")}</tr>`).join("")}
      <tr><td><b>Score</b></td>${R.runs.map(r => `<td class="n"><b>${fmtPct(r.eff[i])}</b></td>`).join("")}</tr></tbody></table></div>
      <p class="meta small">Excluded = weight 0, criterion not DIRECT, or proxy not included. A contribution is a share of the similarity score, not a physical quantity.</p></div>`;
  }
  return h;
};
function a4ScnSet(k, f) { const s = A4.scn.list[+k]; f(s); A4.scn.res = null; }
Object.assign(A4_ACTIONS, {
  scnadd() { const n = A4.scn.list.length + 1, P = S.app.profiles.general; A4.scn.list.push({ id: "s" + n, label: "Scenario " + n, profile: "general", weights: { ...P.weights }, include_proxy: false, normalisation: "earth_union_target" }); A4.scn.res = null; atRender(); },
  scnrm(a) { A4.scn.list.splice(+a.dataset.k, 1); A4.scn.list.forEach((s, k) => s.id = "s" + (k + 1)); A4.scn.res = null; atRender(); },
  scnrun() { a4ScnRun(); },
  scncell(a) { A4.scn.cell = +a.dataset.i; atRender(); },
  scnexp() { a4Download(`asterro_scenarios_${A4.scn.res.config.target}.json`, A4.scn.res.config); },
  scnsave() { const c = A4.scn.res.config; a4SaveItem({ kind: "scenario_set", label: `${c.scenarios.length} scenarios · ${a4T(c.target).name}`, config: c, snapshot: RG.snapshot(A4.ix, [c.target]) }); },
});
Object.assign(A4_INPUTS, {
  scnlab(a) { A4.scn.list[+a.dataset.k].label = a.value.slice(0, 60); A4.scn.res = null; },
  scnprof(a) { a4ScnSet(a.dataset.k, s => { s.profile = a.value; if (a.value !== "custom") { s.weights = { ...S.app.profiles[a.value].weights }; s.label = S.app.profiles[a.value].label + (s.include_proxy ? " · with proxies" : ""); } }); atRender(); },
  scnw(a) { const v = +a.value; if (!(v >= 0 && v <= 5)) { A4.scn.msg = { ok: false, text: "Weights must be between 0 and 5." }; atRender(); return; } a4ScnSet(a.dataset.k, s => { s.weights[a.dataset.c] = v; s.profile = "custom"; }); atRender(); },
  scnpx(a) { a4ScnSet(a.dataset.k, s => { s.include_proxy = a.checked; }); atRender(); },
  scnnorm(a) { a4ScnSet(a.dataset.k, s => { s.normalisation = a.value; }); atRender(); },
  async scnimp(a) {
    const f = a.files && a.files[0]; if (!f) return;
    let cfg; try { cfg = JSON.parse(await f.text()); } catch (e) { A4.scn.msg = { ok: false, text: "Not valid JSON: " + e.message }; atRender(); return; }
    const r = RG.replayScenarios({ IX: A4.ix, A: S.A, cell: S.cell, lat: S.lat, lon: S.lon, critIds: S.critIds, config: cfg });
    A4.scn.msg = { ok: r.ok, text: (r.ok ? "REPRODUCED in this browser: " : "NOT REPRODUCED: ") + r.msgs.join(" · ") };
    if (r.ok) { A4.scn.target = cfg.target; A4.scn.list = cfg.scenarios.map(s => ({ id: s.id, label: s.label, profile: "custom", weights: s.weights, include_proxy: s.include_proxy, normalisation: s.normalisation })); const keep = A4.scn.msg; a4ScnRun(); A4.scn.msg = keep; }
    atRender();
  },
});
A3_INPUTS.scnt = function (a) { A4.scn.target = a.value; A4.scn.res = null; atRender(); };
