/* ===== Phase II · Planetary Uncertainty Explorer =====
 * Only uncertainty that the data can support is quantified; every range is labelled by its basis
 * (measured variability, documented decoding bound, or alternative target statistic). None is a
 * statistical confidence interval, and no probability is attached to any range. */
L.unc = { tgt: null };

/* score of ONE cell with optional overrides of the Earth value and/or the target value (baseline formula) */
function scoreCell(i, tid, w, earthOv = {}, targetOv = {}) {
  const st = {}; for (const c of S.critIds) st[c] = new Float64Array([c in earthOv ? earthOv[c] : S.A[c][i]]);
  const tv = { ...S.T[tid].variables, ...targetOv };
  return ENG.similarity(st, S.critIds, tv, w, S.ranges).eff[0];
}
function simOne(c, e, t) { const R = S.ranges[c], s = 1 - Math.abs(e - t) / (R[1] - R[0]); return s < 0 ? 0 : (s > 1 ? 1 : s); }
function yearlyLST(i) {
  const Y = S.app.stack.years, a = S.A.lst_diurnal_range_yearly;
  return Y.map((y, k) => { const raw = a[k * S.n + i]; return { year: y, v: raw === -32768 ? NaN : raw * 0.01 }; });
}
function uncertaintyRows(i, tid, w) {
  const T = S.T[tid], base = scoreCell(i, tid, w), rows = [], ctx = L.ctx;
  const ptsOf = s => s < 0 ? null : 100 * (s - base);
  const rangeFrom = (vals) => { const v = vals.filter(x => x != null); return v.length ? [Math.min(...v), Math.max(...v)] : null; };
  const add = (c, side, source, kind, detail, scores, category, basis) => rows.push({ c, side, source, kind, detail, pts: scores ? rangeFrom(scores.map(ptsOf)) : null, category, basis });
  const e = c => S.A[c][i];
  // --- thermal
  const c = "lst_diurnal_range";
  if (T.variables[c] != null) {
    const yr = yearlyLST(i), fin = yr.filter(y => y.v === y.v);
    if (fin.length) {
      const st = LAB.stats(fin.map(y => y.v));
      add(c, "Earth", "Interannual variability (MODIS 2016–2025)", "measured variability",
        `${fin.length} yearly values: mean ${st.mean.toFixed(2)} K, SD ${st.sd.toFixed(2)} K, range ${st.min.toFixed(2)}–${st.max.toFixed(2)} K (climatology ${e(c).toFixed(2)} K)`,
        fin.map(y => scoreCell(i, tid, w, { [c]: y.v })), "MEASURED", "Each year's value substituted for the climatology; all else fixed.");
    } else add(c, "Earth", "Interannual variability", "unquantified", "No yearly values for this cell.", null, "UNAVAILABLE", "—");
    const q = ctx ? ctx.modis_quantisation_K : 0.6;
    add(c, "Earth", "GIBS colour-map decoding bound", "documented bound",
      `Each pixel decoded to its ${q} K bin midpoint (±${(q / 2).toFixed(1)} K); worst case on day − night = ±${q.toFixed(1)} K`,
      [scoreCell(i, tid, w, { [c]: e(c) - q }), scoreCell(i, tid, w, { [c]: e(c) + q })], "DERIVED", "Deterministic worst-case bound, not a statistical error.");
    add(c, "Earth", "Missing observations", "qualitative", `MODIS pixel-month coverage ${pct(S.A.modis_coverage[i])}; the effect of gaps on the mean is not modelled.`, null, "UNAVAILABLE", "—");
    if (tid === "mars_jezero") {
      const bins = T.raw_reference.meda_bins.map(b => b.ground_dr_K).filter(Number.isFinite);
      add(c, "Target", "Seasonal (12 Ls bins, MEDA TIRS)", "alternative target statistic",
        `Ls-bin day−night values ${Math.min(...bins).toFixed(1)}–${Math.max(...bins).toFixed(1)} K (target = equal-weight mean ${T.variables[c].toFixed(2)} K)`,
        bins.map(v => scoreCell(i, tid, w, {}, { [c]: v })), "DERIVED", "Target replaced by each Ls-bin value in turn.");
      if (ctx) { const m = ctx.meda_ground.dT_per_sol; add(c, "Target", "Sol-to-sol variability (MEDA TIRS)", "measured variability",
        `${ctx.meda_ground.sols} sols: SD ${m.sd.toFixed(1)} K, p10–p90 ${m.p10.toFixed(1)}–${m.p90.toFixed(1)} K`,
        [scoreCell(i, tid, w, {}, { [c]: m.p10 }), scoreCell(i, tid, w, {}, { [c]: m.p90 })], "MEASURED", "Target replaced by the per-sol 10th and 90th percentiles."); }
    } else {
      const d = T.raw_reference.diviner;
      add(c, "Target", "Season (Diviner summer vs winter)", "alternative target statistic",
        `Summer ${d.summer.mean_dT_K.toFixed(1)} K, winter ${d.winter.mean_dT_K.toFixed(1)} K (target = mean ${T.variables[c].toFixed(2)} K)`,
        [scoreCell(i, tid, w, {}, { [c]: d.summer.mean_dT_K }), scoreCell(i, tid, w, {}, { [c]: d.winter.mean_dT_K })], "DERIVED", "Target replaced by each season's window mean.");
      add(c, "Target", "Within-window spread (Diviner)", "qualitative", `Summer p10–p90 ${d.summer.p10_dT_K.toFixed(0)}…${d.summer.p90_dT_K.toFixed(0)} K: shadowed and sunlit terrain averaged together.`, null, "MEASURED", "Reported, not propagated (a 55 km mean is compared).");
    }
    add(c, "Both", "Cross-instrument comparison", "qualitative", "MODIS split-window LST vs " + (tid === "mars_jezero" ? "MEDA TIRS" : "Diviner bolometric") + " temperature: related but not identical retrievals.", null, "ASSUMED", "Comparability assumed; difference not quantified.");
  }
  // --- annual temperature range
  if (T.variables.annual_temperature_range != null) {
    add("annual_temperature_range", "Earth", "Interannual variability", "unquantified", "POWER 2001–2020 monthly climatology only; year-to-year values not ingested.", null, "UNAVAILABLE", "—");
    add("annual_temperature_range", "Target", "Single Mars year", "unquantified", "MEDA ATS covers one Mars year (12 Ls bins); inter-annual variability unknown.", null, "UNAVAILABLE", "—");
  } else add("annual_temperature_range", "Target", "Not applicable", "n/a", "No near-surface air on the Moon; criterion excluded (never filled).", null, "UNAVAILABLE", "—");
  // --- terrain
  for (const k of ["slope", "surface_roughness"]) {
    const W = LAB.windowAnalysis({ i, r: 1, cell: S.cell, index: S.index, A: S.A, crits: [k], lat: S.lat, lon: S.lon, tvs: {}, ranges: S.ranges }).perCrit[k].stats;
    add(k, "Earth", "Spatial aggregation (3×3 neighbouring cells)", "context", `SD between adjacent cell means ${W.sd === W.sd ? W.sd.toFixed(2) : "—"} ${unitOf(k)} (n = ${W.n}); within-cell spread not retained.`, null, "DERIVED", "Context only; not an error of the cell value.");
    add(k, "Earth", "GMTED2010 vertical accuracy", "unquantified", "Product accuracy not ingested; not propagated.", null, "UNAVAILABLE", "—");
    if (ctx && k === "slope") { const tw = ctx.target_windows[tid].slope_deg; add(k, "Target", "Window statistic (mean vs median of 926.6 m bins)", "alternative target statistic",
      `Mean ${tw.mean.toFixed(2)}° (used) vs median ${tw.median.toFixed(2)}°; bin SD ${tw.sd.toFixed(2)}°`, [scoreCell(i, tid, w, {}, { slope: tw.median })], "DERIVED", "Target replaced by the window median."); }
  }
  // --- proxies
  for (const k of ["aridity", "elevation"]) if (T.variables[k] != null)
    add(k, "Target", "Proxy definition", "assumption", T.proxy_method[k], null, "ASSUMED", "A modelling choice, not a measurement; its uncertainty is not a statistical quantity.");
  add("aridity", "Earth", "PET method (Hargreaves–FAO56)", "assumption", "Alternative PET formulations not computed; aridity undefined where PET = 0.", null, "ASSUMED", "—");
  return { base, rows };
}
function envelope(i, tid, w) {
  const T = S.T[tid], c = "lst_diurnal_range"; if (T.variables[c] == null) return null;
  const earth = [S.A[c][i], ...yearlyLST(i).map(y => y.v).filter(v => v === v)];
  const tgt = [T.variables[c]];
  if (tid === "mars_jezero") tgt.push(...T.raw_reference.meda_bins.map(b => b.ground_dr_K)); else tgt.push(T.raw_reference.diviner.summer.mean_dT_K, T.raw_reference.diviner.winter.mean_dT_K);
  const slopeAlt = L.ctx ? [T.variables.slope, L.ctx.target_windows[tid].slope_deg.median] : [T.variables.slope];
  let lo = Infinity, hi = -Infinity, n = 0;
  for (const a of earth) for (const b of tgt) for (const sl of slopeAlt) { const s = scoreCell(i, tid, w, { [c]: a }, { [c]: b, slope: sl }); if (s >= 0) { lo = Math.min(lo, s); hi = Math.max(hi, s); n++; } }
  return { lo, hi, n, base: scoreCell(i, tid, w) };
}
LAB_VIEWS.uncert = function () {
  if (!S.res) return `<div class="sec"><div class="empty">Run the search first.</div></div>`;
  const i = labSel(); if (i == null) return `<div class="sec"><div class="empty">Select a site.</div></div>`;
  const tid = S.targetId === "cross" ? (L.unc.tgt || TARGET_IDS[0]) : S.targetId, w = S.weights;
  const U = uncertaintyRows(i, tid, w), E = envelope(i, tid, w);
  const byC = {}; for (const r of U.rows) (byC[r.c] = byC[r.c] || []).push(r);
  const assess = c => { const rs = byC[c] || []; if (S.T[tid].variables[c] == null) return ["N/A", ""]; if (S.T[tid].proxy_flags[c]) return ["Proxy — not characterisable", "c-partial"];
    const qE = rs.some(r => r.side === "Earth" && r.pts), qT = rs.some(r => r.side === "Target" && r.pts);
    return qE && qT ? ["Partially characterised (both sides)", "c-match"] : (qE || qT) ? ["Partially characterised (one side)", "c-partial"] : ["Not characterised", "c-mismatch"]; };
  const bar = p => { if (!p) return `<span class="meta">not quantified</span>`; const sc = 6; const X = v => 50 + Math.max(-50, Math.min(50, v * sc)); return `<svg width="120" height="12" role="img" aria-label="score change ${p[0].toFixed(2)} to ${p[1].toFixed(2)} points"><line x1="60" x2="60" y1="0" y2="12" stroke="var(--line-2)"/><rect x="${10 + X(p[0])}" y="3" width="${Math.max(2, X(p[1]) - X(p[0]))}" height="6" fill="var(--accent)" opacity=".7" rx="1"/></svg> <span class="meta">${p[0] >= 0 ? "+" : ""}${p[0].toFixed(2)} … ${p[1] >= 0 ? "+" : ""}${p[1].toFixed(2)} pts</span>`; };
  let h = `<div class="sec"><h3 class="ttl">Planetary uncertainty explorer</h3>${experimentBanner("analysis")}
    <p class="note">How much could the comparison for <b>${esc(candShort(i))}</b> move if a documented alternative value were used, and which uncertainties cannot be quantified with the data at hand? Baseline Analogue Score ${fmtPct(U.base, 2)} (${esc(TNAME[tid])}, ${esc(currentLabel())}).</p>
    ${S.targetId === "cross" ? `<div class="toggles">${TARGET_IDS.map(t => `<button aria-pressed="${t === tid}" data-lab="unc-t" data-t="${t}">${esc(TNAME[t])}</button>`).join("")}</div>` : ""}</div>`;
  if (E) h += `<div class="sec"><div class="lbl">Sensitivity envelope over documented alternatives</div><div class="bfaf"><div class="b"><span>LOW</span><b>${fmtPct(E.lo, 1)}</b></div><div class="arr">↔</div><div class="b"><span>BASELINE</span><b>${fmtPct(E.base, 1)}</b></div><div class="arr">↔</div><div class="b"><span>HIGH</span><b>${fmtPct(E.hi, 1)}</b></div></div>
    <p class="note small">Min/max of the score over ${E.n} combinations of: Earth thermal value (climatology or any single year) × target thermal value (reference or any ${tid === "mars_jezero" ? "Ls bin" : "season"}) × target slope statistic (mean or median). This is <b>not a confidence interval</b> and carries no probability; it shows how far documented alternative choices move the score.</p></div>`;
  h += `<div class="sec"><div class="lbl">Sources by criterion</div>`;
  for (const c of S.critIds) {
    const a = assess(c);
    h += `<div class="unc-c"><div class="row" style="justify-content:space-between"><b>${esc(labelOf(c))}</b><span class="rq ${a[1]}">${esc(a[0])}</span></div>
      <div class="tbl-wrap"><table class="t"><tbody>${(byC[c] || []).map(r => `<tr><td style="width:62px" class="meta">${r.side}</td><td>${esc(r.source)}<div class="meta">${esc(r.detail)}</div></td><td>${evTag(r.category)}</td><td style="width:220px">${bar(r.pts)}</td></tr>`).join("") || `<tr><td class="meta">No source recorded.</td></tr>`}</tbody></table></div></div>`;
  }
  const rob = L.res.robust && L.res.robust.key === baseKey() ? L.res.robust : null, q = rob ? rob.cand.indexOf(i) : -1;
  h += `<div class="unc-c"><div class="row" style="justify-content:space-between"><b>Weights</b><span class="rq">${q >= 0 ? "Quantified (rank)" : "Run the Robustness Laboratory"}</span></div>
    <p class="note small">${q >= 0 ? `Cell rank across ${rob.D.design.length} weight configurations: median #${rob.st[q].median}, range #${rob.st[q].min}–#${rob.st[q].max} (${esc(rob.D.name)}).` : "Weight sensitivity is analysed there; it is a modelling choice, not measurement error."}</p></div></div>`;
  const claims = [
    LAB.claim({ id: "unc.envelope", category: "DERIVED", text: "Score ranges are recomputed with the baseline formula after substituting documented alternative inputs.", method: "Substitution of measured yearly / seasonal / per-sol values, documented decoding bound, or alternative window statistic.", provenance: ["MODIS yearly (stack)", "MEDA bins & sols", "Diviner seasons", "MOLA/LOLA window bins"], limitations: ["No probability model: ranges are not confidence intervals.", "Unquantified sources are listed, not estimated."] }),
    LAB.claim({ id: "unc.unquantified", category: "UNAVAILABLE", text: "Instrument accuracy of POWER, GMTED2010 and MODIS, and Earth interannual temperature-range variability, are not available in this build." }),
  ];
  return h + `<div class="sec">${claimsBlock(claims)}</div>`;
};
LAB_ACTIONS["unc-t"] = a => { L.unc.tgt = a.dataset.t; labRender(); };
