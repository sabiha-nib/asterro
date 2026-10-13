/* ===== Phase II · Analogue Robustness Laboratory ===== */
L.robustCfg = { design: "factorial", samples: 300, seed: 20261013, logRange: 1, topPct: 1, topN: 20, stableFrac: 0.95, moderateFrac: 0.5 };

function busyUpdate() {
  const b = $(".lab-busy"); if (!b || !L.busy) { labRender(); return; }
  b.querySelector(".fill").style.width = (100 * L.busy.done / L.busy.total).toFixed(1) + "%";
  b.querySelector(".meta").textContent = `${L.busy.label} · ${L.busy.done}/${L.busy.total}`;
}
function buildDesign(cfg, baseW, act) {
  if (cfg.design === "oat") return { name: "One-at-a-time ×½ / ×2", design: LAB.designOAT(baseW, act, S.critIds, [0.5, 2]),
    description: `Each active criterion's weight multiplied by 0.5 and by 2, one at a time (${act.length * 2} configurations).` };
  if (cfg.design === "factorial") return { name: "Full factorial ×{½, 1, 2}", design: LAB.designFactorial(baseW, act, S.critIds, [0.5, 1, 2]),
    description: `Every combination of the multipliers 0.5, 1 and 2 on the ${act.length} active weights (3^${act.length} = ${Math.pow(3, act.length)} configurations, deterministic enumeration; includes the baseline).` };
  return { name: `Seeded sample n = ${cfg.samples}`, design: LAB.designSampled(baseW, act, S.critIds, cfg.samples, cfg.seed, cfg.logRange),
    description: `${cfg.samples} configurations; each active weight multiplied by 2^u, u ~ Uniform(−${cfg.logRange}, ${cfg.logRange}) independently (mulberry32, seed ${cfg.seed}). A sample frequency is not a real-world probability.` };
}

/* Pure computation (also used by the Vault replay). */
async function robustCompute(tid, baseW, cand, cfg, onProgress) {
  const act = activeFor(tid, baseW), Ps = PsFor(tid), D = buildDesign(cfg, baseW, act), oat = LAB.designOAT(baseW, act, S.critIds, [0.5, 2]);
  const total = D.design.length + oat.length;
  const run = await LAB.runDesign({ Ps, cell: S.cell, cand, baseW, design: D.design, onProgress: d => onProgress ? onProgress(d, total) : true });
  if (run.cancelled) return null;
  const orun = await LAB.runDesign({ Ps, cell: S.cell, cand, baseW, design: oat, onProgress: d => onProgress ? onProgress(D.design.length + d, total) : true });
  if (orun.cancelled) return null;
  const cov = cand.map(i => coverageOf(tid, i, baseW));
  const st = LAB.rankStats(run, { topPct: cfg.topPct, topN: cfg.topN, stableFrac: cfg.stableFrac, moderateFrac: cfg.moderateFrac, coverage: cov });
  const sens = LAB.oatSensitivity(orun, oat), flips = LAB.pairFlips(run);
  const outputs = { cells: cand.map(i => S.cell[i]), stats: st.map(x => ({ ...x })), drivers: sens.map(x => x.driver),
    oat: sens.map(x => x.list.map(e => ({ c: e.criterion, r: e.ranks, m: e.maxAbsLog2 }))), nConfigs: D.design.length };
  return { act, D, oat, run, orun, st, sens, flips, outputs, total };
}
function robustValidate(cfg) {
  LAB.inBounds("topPct", cfg.topPct); LAB.inBounds("topN", cfg.topN); LAB.inBounds("stableFrac", cfg.stableFrac); LAB.inBounds("moderateFrac", cfg.moderateFrac);
  if (cfg.design === "sampled") { LAB.inBounds("samples", cfg.samples); LAB.inBounds("logRange", cfg.logRange); if (!Number.isInteger(cfg.seed) || cfg.seed < 0) throw new Error("seed must be a non-negative integer"); }
  if (cfg.moderateFrac >= cfg.stableFrac) throw new Error("moderate threshold must be below the stable threshold");
  if (!["oat", "factorial", "sampled"].includes(cfg.design)) throw new Error("unknown design " + cfg.design);
}
async function runRobustness() {
  if (L.busy) return;
  const cfg = { ...L.robustCfg };
  try { robustValidate(cfg); } catch (e) { L.res.robustErr = e.message; labRender(); return; }
  L.res.robustErr = null;
  const tid = S.targetId, baseW = { ...S.weights }, cand = candSet();
  const sel = labSel(); if (sel != null && !cand.includes(sel)) cand.push(sel);
  const t0 = performance.now();
  L.busy = { label: "Robustness experiment", done: 0, total: 1, cancel: false }; labRender();
  const X = await robustCompute(tid, baseW, cand, cfg, (d, tot) => { L.busy.done = d; L.busy.total = tot; busyUpdate(); return !L.busy.cancel; });
  const ms = performance.now() - t0; L.busy = null;
  if (!X) { L.res.robustErr = "Cancelled — no partial result is reported."; labRender(); return; }
  const { act, D, oat, run, orun, st, sens, flips, outputs } = X;
  const claims = [
    LAB.claim({ id: "robust.stability", category: "DERIVED", text: `Rank statistics of ${cand.length} candidates across ${D.design.length} weight configurations (${D.name}).`,
      method: "Each configuration re-scores all " + S.n.toLocaleString() + " cells with the baseline formula; candidate ranks are exact (score desc, cell id asc).",
      provenance: ["predictor stack " + S.app.stack.sha256.slice(0, 12) + "…", "targets.json"], assumptions: [D.description],
      limitations: ["Robust under the TESTED weight space only; other methodological choices (normalisation, criteria set, targets) are not varied.", "Robustness is not scientific validation."] }),
    LAB.claim({ id: "robust.classification", category: "INFERRED", text: `Classification: stable if within the top ${cfg.topPct}% of eligible cells in ≥ ${pct(cfg.stableFrac)} of configurations; moderately sensitive if ≥ ${pct(cfg.moderateFrac)}; otherwise highly sensitive; insufficient evidence if < 10 configurations or weight coverage < 100 %.`,
      method: "Threshold rule on the fraction of configurations (user-adjustable within documented bounds).", completeness: "complete" }),
    LAB.claim({ id: "robust.validation", category: "UNVALIDATED", text: "No candidate's analogue value has been validated against field studies or expert-selected analogue sites.", completeness: "partial" }),
  ];
  const rec = await makeRecord("robustness", { design: cfg.design, samples: cfg.samples, seed: cfg.seed, logRange: cfg.logRange, topPct: cfg.topPct, topN: cfg.topN,
    stableFrac: cfg.stableFrac, moderateFrac: cfg.moderateFrac, candidates: cand.map(i => S.cell[i]) }, outputs,
    { claims, limitations: claims[0].limitations, replay: "browser + python (scripts/replay_experiment.py)" });
  L.res.robust = { key: baseKey(), tid, cand, st, sens, flips, run, D, cfg, ms, act, claims, rec, oat, orun };
  labRender();
}

function ablationCompute(tid, baseW) {
  const act = activeFor(tid, baseW);
  const rows = LAB.ablation({ ENG, Ps: PsFor(tid), cell: S.cell, lat: S.lat, lon: S.lon, baseW, act, critIds: S.critIds, nDistinct: 20, sep: S.app.thresholds.distinct_sep_km, compareTop: 1000 });
  const outputs = rows.map(r => r.error ? { removed: r.removed, error: r.error } : { removed: r.removed, top: S.cell[r.top], overlap: r.overlap, rho: r.rho,
    baselineDistinctNewRanks: r.baselineDistinctNewRanks, distinct: r.distinct.map(i => S.cell[i]) });
  return { act, rows, outputs };
}
async function runAblation() {
  if (L.busy) return;
  const tid = S.targetId, baseW = { ...S.weights };
  L.busy = { label: "Criterion ablation", done: 0, total: 1, cancel: false }; labRender();
  await new Promise(r => setTimeout(r, 20));
  const t0 = performance.now();
  const { act, rows, outputs } = ablationCompute(tid, baseW);
  const ms = performance.now() - t0; L.busy = null;
  const claims = [LAB.claim({ id: "ablation", category: "DERIVED", text: `Each active criterion removed in turn (weight 0); full re-ranking and distinct-site selection repeated (${act.length} experiments).`,
    method: "Baseline formula with one weight set to 0; overlap counts baseline top-20 distinct sites present in the experimental top-20 (exact cell match); Spearman ρ over the baseline top-1000 cells.",
    provenance: ["predictor stack " + S.app.stack.sha256.slice(0, 12) + "…"], limitations: ["An ablation is an alternative analysis, never a replacement score.", "Exact-cell overlap undercounts a site that moved to a neighbouring cell."] })];
  const rec = await makeRecord("ablation", { compareTop: 1000, nDistinct: 20 }, outputs, { claims, replay: "browser + python (scripts/replay_experiment.py)" });
  L.res.ablation = { key: baseKey(), tid, rows, ms, claims, rec, base: S.res.distinct.slice() };
  labRender();
}

function rankStripSVG(R) {
  const W = 700, rowH = 17, top = 22, n = R.cand.length, H = top + n * rowH + 26, x0 = 150, x1 = W - 12;
  const hi = Math.max(10, ...R.st.map(s => s.max)), X = v => x0 + (Math.log10(v) / Math.log10(hi)) * (x1 - x0);
  let g = `<text x="${x0}" y="12" font-size="9" fill="var(--ink-3)">CELL RANK (log scale) — box: 25th–75th pct · line: min–max · ◆ baseline · │ median</text>`;
  R.cand.forEach((i, c) => {
    const s = R.st[c], y = top + c * rowH + rowH / 2, col = s.cls === "STABLE" ? "var(--match)" : s.cls === "MODERATELY_SENSITIVE" ? "var(--partial)" : s.cls === "HIGHLY_SENSITIVE" ? "var(--mismatch)" : "var(--ink-3)";
    g += `<g class="hov" data-lab="sel" data-i="${i}"><rect x="0" y="${y - rowH / 2}" width="${W}" height="${rowH}" fill="transparent"/><title>${esc(candShort(i))}: baseline #${s.baseline}, median #${s.median}, range #${s.min}–#${s.max}</title>
      <text x="0" y="${y + 3.5}" font-size="10" fill="var(--ink-2)">${siteNo(i)} ${esc(candShort(i).slice(0, 19))}</text>
      <line x1="${X(s.min)}" x2="${X(s.max)}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="1.5" opacity=".8"/>
      <rect x="${X(s.p25)}" y="${y - 4.5}" width="${Math.max(2, X(s.p75) - X(s.p25))}" height="9" fill="${col}" opacity=".35" rx="1"/>
      <line x1="${X(s.median)}" x2="${X(s.median)}" y1="${y - 6}" y2="${y + 6}" stroke="var(--ink)" stroke-width="2"/>
      <path d="M${X(s.baseline)},${y - 4} l4,4 l-4,4 l-4,-4z" fill="var(--ground)" stroke="var(--ink)" stroke-width="1.2"/></g>`;
  });
  g += svgAxisLog(x0, x1, H - 18, 1, hi, X);
  return `<svg class="fp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rank range of each candidate across the tested weight configurations">${g}</svg>`;
}
function sensHeat(R) {
  const crit = R.act;
  const mx = Math.max(0.5, ...R.sens.flatMap(s => s.list.map(e => e.maxAbsLog2)));
  return `<div class="tbl-wrap"><table class="t heat"><thead><tr><th>Site</th>${crit.map(c => `<th class="n" title="${esc(labelOf(c))}">${esc(shortOf(c))}</th>`).join("")}<th>Driver</th></tr></thead><tbody>
    ${R.cand.map((i, c) => { const by = Object.fromEntries(R.sens[c].list.map(e => [e.criterion, e])); return `<tr><td><button class="lnk" data-lab="sel" data-i="${i}">${siteNo(i)} ${esc(candShort(i).slice(0, 18))}</button></td>
      ${crit.map(k => { const e = by[k]; if (!e) return `<td class="n meta">—</td>`; const a = e.maxAbsLog2 / mx; return `<td class="n hc" style="--a:${(0.08 + 0.8 * a).toFixed(2)}" title="${esc(labelOf(k))}: rank #${e.ranks[0.5]} at ×½, #${e.ranks[2]} at ×2 (baseline #${R.run.baseRanks[c]})">${e.maxAbsLog2.toFixed(2)}</td>`; }).join("")}
      <td class="meta">${esc(shortOf(R.sens[c].driver) || "—")}</td></tr>`; }).join("")}</tbody></table></div>
    <p class="note small">Cell value = max |log₂(rank under ×½ or ×2 ÷ baseline rank)| for that criterion alone (1.0 = rank halved or doubled). Brighter = more sensitive. Driver = criterion with the largest value.</p>`;
}

LAB_VIEWS.robust = function () {
  if (!S.res) return `<div class="sec"><div class="empty">Run the search first.</div></div>`;
  const c = L.robustCfg, R = L.res.robust, A = L.res.ablation, act = activeFor(S.targetId);
  const nF = Math.pow(3, act.length);
  let h = `<div class="sec"><h3 class="ttl">Analogue robustness laboratory</h3>${experimentBanner()}
    <p class="note">Is a candidate's high rank stable when the weights change within a reasonable range, or does it depend on one criterion? Candidates: the baseline top-20 distinct sites${labSel() != null && !S.res.distinct.includes(labSel()) ? " + the picked cell" : ""} for ${esc(TNAME[S.targetId])} under ${esc(currentLabel())}.</p>
    <div class="lab-form">
      <label>Design <select data-labin="robust" data-k="design"><option value="oat"${c.design === "oat" ? " selected" : ""}>One-at-a-time ×½/×2 (${act.length * 2})</option><option value="factorial"${c.design === "factorial" ? " selected" : ""}>Full factorial ×{½,1,2} (${nF})</option><option value="sampled"${c.design === "sampled" ? " selected" : ""}>Seeded random sample</option></select></label>
      ${c.design === "sampled" ? `<label>Samples <input type="number" min="10" max="2000" step="10" value="${c.samples}" data-labin="robust" data-k="samples"></label><label>Seed <input type="number" min="0" step="1" value="${c.seed}" data-labin="robust" data-k="seed"></label><label>log₂ range ± <input type="number" min="0.1" max="2" step="0.1" value="${c.logRange}" data-labin="robust" data-k="logRange"></label>` : ""}
      <label>Top % cut-off <input type="number" min="0.1" max="5" step="0.1" value="${c.topPct}" data-labin="robust" data-k="topPct"></label>
      <label>Top-N cells <input type="number" min="5" max="500" step="1" value="${c.topN}" data-labin="robust" data-k="topN"></label>
      <label>Stable ≥ <input type="number" min="0.8" max="1" step="0.01" value="${c.stableFrac}" data-labin="robust" data-k="stableFrac"></label>
      <label>Moderate ≥ <input type="number" min="0.3" max="0.95" step="0.05" value="${c.moderateFrac}" data-labin="robust" data-k="moderateFrac"></label>
      <button class="btn-sm on" data-lab="robust-run">Run experiment</button></div>
    ${L.res.robustErr ? `<div class="callout">${esc(L.res.robustErr)}</div>` : ""}</div>`;
  if (R) {
    h += `<div class="sec">${staleNote(R)}<div class="lbl">Ranking stability<span class="meta">${esc(R.D.name)} · ${R.D.design.length.toLocaleString()} configs · ${(R.ms / 1000).toFixed(1)} s · record ${R.rec.id}</span></div>
      <p class="note small">${esc(R.D.description)} Ranks are cell ranks among all eligible cells (not distinct-site positions).</p>
      ${rankStripSVG(R)}
      <div class="tbl-wrap"><table class="t"><thead><tr><th>Site</th><th class="n">Base</th><th class="n">Median</th><th class="n">IQR</th><th class="n">Range</th><th class="n">In top ${R.cfg.topPct}%</th><th class="n">In top ${R.cfg.topN}</th><th>Class</th></tr></thead><tbody>
      ${R.cand.map((i, k) => { const s = R.st[k]; return `<tr><td><button class="lnk" data-lab="sel" data-i="${i}">${siteNo(i)} ${esc(candShort(i).slice(0, 22))}</button></td><td class="n">${s.baseline}</td><td class="n">${s.median}</td><td class="n">${s.p25}–${s.p75}</td><td class="n">${s.min}–${s.max}</td><td class="n">${pct(s.fracTopPct)}</td><td class="n">${pct(s.fracTopN)}</td><td>${clsTag(s.cls)}</td></tr>`; }).join("")}
      </tbody></table></div>
      ${claimsBlock(R.claims)}</div>
      <div class="sec"><div class="lbl">Criterion sensitivity (one-at-a-time)</div>${sensHeat(R)}</div>`;
  }
  h += `<div class="sec"><div class="lbl">Criterion ablation<button class="btn-sm" data-lab="ablation-run">Run ablation</button></div>
    <p class="note small">Removes one criterion at a time from an experimental re-ranking. The baseline score keeps all criteria.</p>`;
  if (A) {
    const b1 = A.base[0];
    h += `${staleNote(A)}<div class="tbl-wrap"><table class="t"><thead><tr><th>Removed</th><th>New #1 distinct site</th><th class="n">Top-20 overlap</th><th class="n">Spearman ρ (top 1000)</th><th class="n">Baseline #01 → rank</th></tr></thead><tbody>
      ${A.rows.map(r => r.error ? `<tr><td>${esc(labelOf(r.removed))}</td><td colspan="4" class="meta">${esc(r.error)}</td></tr>` :
        `<tr><td>${esc(labelOf(r.removed))}</td><td><button class="lnk" data-lab="sel" data-i="${r.top}">${esc(candShort(r.top))}</button></td><td class="n">${r.overlap}/20</td><td class="n">${f3(r.rho)}</td><td class="n">#${r.baselineDistinctNewRanks[0].toLocaleString()}</td></tr>`).join("")}
      </tbody></table></div><p class="note small">Baseline #01 is ${esc(candShort(b1))}. ${A.rows.length} experiments in ${(A.ms / 1000).toFixed(1)} s · record ${A.rec.id}.</p>${claimsBlock(A.claims)}`;
  }
  h += `</div><div class="sec"><p class="note small">Pareto (non-dominated) analysis across criteria is in <button class="lnk" data-lab="goto" data-to="portfolio">Multi-objective</button>.</p></div>`;
  return h;
};
LAB_ACTIONS["robust-run"] = () => runRobustness();
LAB_ACTIONS["ablation-run"] = () => runAblation();
LAB_INPUTS.robust = a => {
  const k = a.dataset.k, v = k === "design" ? a.value : +a.value;
  L.robustCfg[k] = k === "seed" || k === "samples" || k === "topN" ? Math.round(v) : v; labRender();
};
