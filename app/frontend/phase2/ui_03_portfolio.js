/* ===== Phase II · Multi-Objective Analogue Discovery (Pareto, diversity, portfolios) ===== */
L.mo = { pool: 800, k: 10, objectives: null, ax: null, ay: null, delta: 0.05 };

function moObjectives() {
  const act = activeFor(S.targetId);
  if (!L.mo.objectives || L.mo.objectives.some(c => !act.includes(c))) L.mo.objectives = act.slice();
  if (!L.mo.ax || !act.includes(L.mo.ax)) L.mo.ax = act[0];
  if (!L.mo.ay || !act.includes(L.mo.ay) || L.mo.ay === L.mo.ax) L.mo.ay = act.find(c => c !== L.mo.ax);
  return act;
}
/* per-criterion similarity for the current target; cross mode uses the MIN of the two targets'
 * similarities only for criteria applicable to both (documented; never a new unified score). */
function simC(c, i) {
  if (S.targetId !== "cross") { const v = prepFor(S.targetId).s[c]; return v ? v[i] : NaN; }
  const a = prepFor(TARGET_IDS[0]).s[c], b = prepFor(TARGET_IDS[1]).s[c];
  if (!a || !b) return NaN; return Math.min(a[i], b[i]);
}
function runPortfolio() {
  const act = moObjectives(), obj = L.mo.objectives, R = S.res;
  if (obj.length < 2) { L.res.mo = { err: "Choose at least two objectives." }; labRender(); return; }
  const n = Math.max(50, Math.min(3000, Math.round(L.mo.pool))), k = Math.max(3, Math.min(20, Math.round(L.mo.k)));
  const pool = Array.from(R.order.slice(0, Math.min(n, R.nElig)));
  const t0 = performance.now();
  const P = LAB.pareto(pool.map(i => ({ id: i, v: obj.map(c => simC(c, i)) })));
  const sep = S.app.thresholds.distinct_sep_km;
  const setA = R.distinct.slice(0, k);
  const minScore = R.eff[setA[setA.length - 1]];
  const setB = LAB.diversePortfolio({ pool, k, A: S.A, crits: obj, ranges: S.ranges, lat: S.lat, lon: S.lon, eff: R.eff, minScore, sep });
  const frontSorted = P.front.slice().sort((x, y) => R.eff[y] - R.eff[x] || S.cell[x] - S.cell[y]);
  const setC = []; for (const i of frontSorted) { if (setC.length >= k) break; if (setC.every(j => LAB.haversine(S.lat[i], S.lon[i], S.lat[j], S.lon[j]) >= sep)) setC.push(i); }
  const robustSt = L.res.robust && L.res.robust.key === baseKey() ? L.res.robust : null;
  const robFor = set => robustSt ? set.map(i => { const q = robustSt.cand.indexOf(i); return q >= 0 ? robustSt.st[q] : null; }).filter(Boolean) : null;
  const metrics = { A: setA, B: setB, C: setC };
  const M = Object.fromEntries(Object.entries(metrics).map(([key, set]) => [key, LAB.portfolioMetrics({ set, A: S.A, crits: obj, ranges: S.ranges, lat: S.lat, lon: S.lon, eff: R.eff, pool, redundancyDelta: L.mo.delta, robust: (() => { const r = robFor(set); return r && r.length === set.length ? r : null; })() })]));
  const why = setB.map((i, q) => {
    if (q === 0) return { i, text: "Start: highest-scoring cell of the pool." };
    const prev = setB.slice(0, q), V = LAB.normVec(S.A, i, obj, S.ranges);
    const d = Math.min(...prev.map(j => LAB.envDist(V, LAB.normVec(S.A, j, obj, S.ranges))));
    return { i, text: `Farthest remaining pool cell in normalised criterion space from those already chosen (nearest chosen at RMS distance ${d.toFixed(3)}), ≥ ${sep} km from all of them; score ${fmtPct(R.eff[i])} vs set-A mean ${fmtPct(M.A.meanScore)}.` };
  });
  const ms = performance.now() - t0;
  const claims = [
    LAB.claim({ id: "mo.pareto", category: "DERIVED", text: `${P.front.length} of ${P.evaluated} pool cells are non-dominated on {${obj.map(shortOf).join(", ")}}; ${P.notEvaluable.length} cells lack a value on at least one objective and were not evaluated.`,
      method: "a dominates b iff s_c(a) ≥ s_c(b) for every selected criterion and > for at least one (maximisation of criterion similarity).", provenance: ["predictor stack", "targets.json"],
      limitations: ["Pareto-optimal means 'not dominated', i.e. a different trade-off — not universally better.", S.targetId === "cross" ? "Cross mode: per-criterion similarity = min over the two targets for criteria defined for both." : "Pool = top " + n + " eligible cells by baseline score."] }),
    LAB.claim({ id: "mo.diverse", category: "INFERRED", text: "Set B is a greedy max–min diversity heuristic; it is not claimed to be globally optimal.",
      method: "Farthest-point selection in range-normalised criterion space (RMS over selected criteria), restricted to score ≥ the k-th baseline distinct site and ≥ distinct-site separation.", completeness: "complete" }),
  ];
  L.res.mo = { key: baseKey(), obj, pool, P, sets: metrics, M, why, ms, claims, k, n };
  makeRecord("multi_objective", { objectives: obj, pool: n, k, delta: L.mo.delta }, { front: P.front.map(i => S.cell[i]), A: setA.map(i => S.cell[i]), B: setB.map(i => S.cell[i]), C: setC.map(i => S.cell[i]) }, { claims })
    .then(r => { L.res.mo.rec = r; labRender(); });
  labRender();
}
function paretoSVG(Rm) {
  const W = 700, H = 360, m = { l: 44, r: 12, t: 12, b: 34 }, ax = L.mo.ax, ay = L.mo.ay;
  const pts = Rm.pool.map(i => [simC(ax, i), simC(ay, i), i]).filter(p => p[0] === p[0] && p[1] === p[1]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const xlo = Math.min(...xs), xhi = Math.max(...xs), ylo = Math.min(...ys), yhi = Math.max(...ys);
  const X = v => m.l + (v - xlo) / ((xhi - xlo) || 1) * (W - m.l - m.r), Y = v => H - m.b - (v - ylo) / ((yhi - ylo) || 1) * (H - m.t - m.b);
  const fr = new Set(Rm.P.front);
  let g = `<rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="none" stroke="var(--line)"/>`;
  for (const p of pts) if (!fr.has(p[2])) g += `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="2" fill="var(--ink-3)" opacity=".45"/>`;
  for (const p of pts) if (fr.has(p[2])) g += `<g class="hov" data-lab="sel" data-i="${p[2]}"><circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="9" fill="transparent"/><circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="4" fill="var(--accent)" stroke="var(--ground)" stroke-width="2"><title>${esc(candShort(p[2]))} · ${shortOf(ax)} ${p[0].toFixed(3)} · ${shortOf(ay)} ${p[1].toFixed(3)} · score ${fmtPct(S.res.eff[p[2]])}</title></circle></g>`;
  const tick = (lo, hi) => [0, 0.5, 1].map(f => lo + f * (hi - lo));
  g += tick(xlo, xhi).map(v => `<text x="${X(v)}" y="${H - m.b + 14}" font-size="9" text-anchor="middle" fill="var(--ink-3)">${v.toFixed(2)}</text>`).join("");
  g += tick(ylo, yhi).map(v => `<text x="${m.l - 6}" y="${Y(v) + 3}" font-size="9" text-anchor="end" fill="var(--ink-3)">${v.toFixed(2)}</text>`).join("");
  g += `<text x="${(m.l + W - m.r) / 2}" y="${H - 6}" font-size="10" text-anchor="middle" fill="var(--ink-2)">similarity on ${esc(labelOf(ax))} (s, 0–1)</text>`;
  g += `<text transform="translate(11 ${(m.t + H - m.b) / 2}) rotate(-90)" font-size="10" text-anchor="middle" fill="var(--ink-2)">similarity on ${esc(labelOf(ay))} (s)</text>`;
  return `<svg class="fp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pool cells by two criterion similarities; non-dominated cells highlighted">${g}</svg>`;
}
LAB_VIEWS.portfolio = function () {
  if (!S.res) return `<div class="sec"><div class="empty">Run the search first.</div></div>`;
  const act = moObjectives(), Rm = L.res.mo;
  let h = `<div class="sec"><h3 class="ttl">Multi-objective analogue discovery</h3>${experimentBanner("analysis")}
    <p class="note">Look beyond the single ranked list: which cells offer different trade-offs between criteria, and do the top sites cover distinct environments or repeat one fingerprint?</p>
    <div class="lab-form"><fieldset><legend class="meta">Objectives (criterion similarity, maximise)</legend>${act.map(c => `<label class="ck"><input type="checkbox" data-labin="mo-obj" value="${c}"${L.mo.objectives.includes(c) ? " checked" : ""}> ${esc(shortOf(c))}</label>`).join("")}</fieldset>
      <label>Pool (top cells) <input type="number" min="50" max="3000" step="50" value="${L.mo.pool}" data-labin="mo" data-k="pool"></label>
      <label>Set size k <input type="number" min="3" max="20" value="${L.mo.k}" data-labin="mo" data-k="k"></label>
      <label>Redundancy δ <input type="number" min="0.01" max="0.3" step="0.01" value="${L.mo.delta}" data-labin="mo" data-k="delta"></label>
      <button class="btn-sm on" data-lab="mo-run">Analyse</button></div>${Rm && Rm.err ? `<div class="callout">${esc(Rm.err)}</div>` : ""}</div>`;
  if (Rm && !Rm.err) {
    h += `<div class="sec">${staleNote(Rm)}<div class="lbl">Pareto front · ${Rm.P.front.length} non-dominated of ${Rm.P.evaluated}<span class="toggles">
      <select data-labin="mo-ax" aria-label="x axis">${Rm.obj.map(c => `<option value="${c}"${c === L.mo.ax ? " selected" : ""}>x: ${esc(shortOf(c))}</option>`).join("")}</select>
      <select data-labin="mo-ay" aria-label="y axis">${Rm.obj.map(c => `<option value="${c}"${c === L.mo.ay ? " selected" : ""}>y: ${esc(shortOf(c))}</option>`).join("")}</select></span></div>
      ${paretoSVG(Rm)}<p class="note small">Front computed in the full ${Rm.obj.length}-criterion space and drawn in a 2-D projection, so some front points lie inside the visible cloud. ${Rm.P.notEvaluable.length} pool cells missing a value were not evaluated (never counted as optimal).</p></div>`;
    const lab = { A: "A · baseline top-k distinct", B: "B · diverse (greedy max–min)", C: "C · Pareto-front distinct" };
    h += `<div class="sec"><div class="lbl">Portfolio comparison (k = ${Rm.k})</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Metric</th>${Object.keys(lab).map(k => `<th class="n">${lab[k]}</th>`).join("")}</tr></thead><tbody>
      ${[["Mean Analogue Score", m => fmtPct(m.meanScore)], ["Min env. distance (RMS, 0–1)", m => f3(m.envMin)], ["Mean env. distance", m => f3(m.envMean)],
         ["Min separation (km)", m => nfmt(m.geoMinKm)], ["Mean separation (km)", m => nfmt(m.geoMeanKm)], [`Redundant pairs (< ${L.mo.delta})`, m => `${m.redundantPairs}/${m.pairs}`],
         ["Missing criterion values", m => m.missingValues], ["Stable share (Robustness)", m => m.stableShare == null ? "not run" : pct(m.stableShare)]]
        .map(([nm, f]) => `<tr><td>${nm}</td>${Object.keys(lab).map(k => `<td class="n">${f(Rm.M[k])}</td>`).join("")}</tr>`).join("")}
      ${Rm.obj.map((c, q) => `<tr><td class="meta">Coverage of pool range · ${esc(shortOf(c))}</td>${Object.keys(lab).map(k => `<td class="n">${pct(Rm.M[k].coverage[q].ratio)}</td>`).join("")}</tr>`).join("")}
      </tbody></table></div><p class="note small">Coverage = spread of the set's normalised values ÷ spread across the pool, per criterion. No portfolio is called optimal: no objective function combining these metrics is defined.</p></div>
      <div class="sec"><div class="lbl">Why set B contains each site</div><ol class="lab-ol">${Rm.why.map(w => `<li><button class="lnk" data-lab="sel" data-i="${w.i}">${esc(candShort(w.i))}</button> <span class="meta">${esc(w.text)}</span></li>`).join("")}</ol>${claimsBlock(Rm.claims)}</div>`;
  }
  return h;
};
LAB_ACTIONS["mo-run"] = () => runPortfolio();
LAB_INPUTS.mo = a => { L.mo[a.dataset.k] = +a.value; };
LAB_INPUTS["mo-obj"] = a => { const s = new Set(L.mo.objectives); a.checked ? s.add(a.value) : s.delete(a.value); L.mo.objectives = S.critIds.filter(c => s.has(c)); };
LAB_INPUTS["mo-ax"] = a => { L.mo.ax = a.value; labRender(); };
LAB_INPUTS["mo-ay"] = a => { L.mo.ay = a.value; labRender(); };
