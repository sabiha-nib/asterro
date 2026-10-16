/* ===== Phase II · Spatial Analogue Microclimate Atlas ===== */
L.atlas = { r: 2, tgt: null };
const SUBCELL_MSG = "Sub-cell environmental characterization unavailable at the current data resolution.";

function atlasTarget() { const t = S.targetId === "cross" ? (L.atlas.tgt || TARGET_IDS[0]) : S.targetId; return t; }
function heatGrid(W, sims, r, label) {
  const n = 2 * r + 1, cs = r >= 3 ? 14 : 18, pad = 1;
  let g = "";
  W.forEach((w, q) => {
    const x = (w.dc + r) * cs, y = (r - w.dr) * cs;      // north up
    const s = sims ? sims[q] : null;
    if (w.offGrid) return;
    if (w.k < 0) { g += `<rect x="${x + pad}" y="${y + pad}" width="${cs - 2 * pad}" height="${cs - 2 * pad}" fill="url(#hatch)" stroke="var(--line)"><title>No valid land cell (ocean / missing data)</title></rect>`; return; }
    if (s == null) { g += `<rect x="${x + pad}" y="${y + pad}" width="${cs - 2 * pad}" height="${cs - 2 * pad}" fill="var(--raise)" stroke="var(--line)"><title>${esc(candShort(w.k))}: value missing</title></rect>`; return; }
    g += `<rect x="${x + pad}" y="${y + pad}" width="${cs - 2 * pad}" height="${cs - 2 * pad}" fill="var(--accent)" fill-opacity="${(0.06 + 0.9 * s * s).toFixed(3)}" stroke="${w.centre ? "var(--ink)" : "var(--line)"}" stroke-width="${w.centre ? 2 : 1}"><title>${esc(candShort(w.k))} · s = ${s.toFixed(3)}${w.centre ? " · CANDIDATE CELL (scored)" : " · context only"}</title></rect>`;
  });
  return `<figure class="hg"><svg viewBox="0 0 ${n * cs} ${n * cs}" width="${n * cs}" height="${n * cs}" role="img" aria-label="${esc(label)} similarity across the window"><defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="var(--line-2)" stroke-width="1.5"/></pattern></defs>${g}</svg><figcaption class="meta">${esc(label)}</figcaption></figure>`;
}
function histSVG(d, unit, mark, label) {
  const W = 340, H = 140, m = { l: 30, r: 8, t: 8, b: 26 }, e = d.hist.edges, c = d.hist.counts, mx = Math.max(...c);
  const X = v => m.l + (v - e[0]) / (e[e.length - 1] - e[0]) * (W - m.l - m.r), Y = v => H - m.b - v / mx * (H - m.t - m.b);
  let g = c.map((v, k) => `<rect x="${X(e[k]) + 1}" y="${Y(v)}" width="${Math.max(1, X(e[k + 1]) - X(e[k]) - 2)}" height="${H - m.b - Y(v)}" fill="var(--ink-3)" rx="1"><title>${e[k].toFixed(0)}–${e[k + 1].toFixed(0)} ${unit}: ${v} bins</title></rect>`).join("");
  g += `<line x1="${X(mark)}" x2="${X(mark)}" y1="${m.t}" y2="${H - m.b}" stroke="var(--accent)" stroke-width="2"/><text x="${X(mark) + 4}" y="${m.t + 9}" font-size="9" fill="var(--ink-2)">mean ${mark.toFixed(2)}</text>`;
  g += [e[0], (e[0] + e[e.length - 1]) / 2, e[e.length - 1]].map(v => `<text x="${X(v)}" y="${H - m.b + 12}" font-size="9" text-anchor="middle" fill="var(--ink-3)">${v.toFixed(0)}</text>`).join("");
  g += `<text x="${(m.l + W - m.r) / 2}" y="${H - 3}" font-size="9" text-anchor="middle" fill="var(--ink-2)">${esc(label)} (${unit}) — count of 926.6 m bins</text>`;
  return `<svg class="fp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} distribution">${g}</svg>`;
}
/* Phase III completion: sub-cell slope distribution (GMTED2010 30″) when the Phase III data are present. */
function atlasSubcellBlock(i) {
  if (typeof atSubcell !== "function") return `<div class="callout">${SUBCELL_MSG}</div>`;
  if (!A3.sub) { if (!A3.subErr) atSubcell().then(labRender); return A3.subErr ? `<div class="callout">${SUBCELL_MSG} (${esc(A3.subErr)})</div>` : `<p class="meta">Loading sub-cell terrain…</p>`; }
  const n = atSubVal("n", i);
  return `<div class="grid2">${[2, 5, 10, 15, 20, 30].map(x => `<div class="kv"><span>30″ pixels with slope ≤ ${x}°</span><b>${pct(atSubVal("frac_le_" + x, i))}</b></div>`).join("")}
    <div class="kv"><span>slope p10 / p50 / p90</span><b>${f1(atSubVal("p10", i))} / ${f1(atSubVal("p50", i))} / ${f1(atSubVal("p90", i))}°</b></div><div class="kv"><span>pixels</span><b>${nfmt(n)}</b></div></div>
    <p class="note small">Within-cell terrain only (GMTED2010 30″, Horn slope, the baseline pixel-to-cell mapping). ${SUBCELL_MSG.replace("characterization", "characterization of climate and thermal variables")}</p>`;
}
LAB_VIEWS.atlas = function () {
  if (!S.res) return `<div class="sec"><div class="empty">Run the search first.</div></div>`;
  const i = labSel(); if (i == null) return `<div class="sec"><div class="empty">Select a site.</div></div>`;
  const r = L.atlas.r, tid = atlasTarget(), T = S.T[tid], act = S.critIds.filter(c => T.variables[c] != null);
  const WA = LAB.windowAnalysis({ i, r, cell: S.cell, index: S.index, A: S.A, crits: S.critIds, lat: S.lat, lon: S.lon, tvs: { [tid]: T.variables }, ranges: S.ranges });
  const [dy, dx] = cellDims(i), n = 2 * r + 1;
  const ctx = L.ctx;
  let h = `<div class="sec"><h3 class="ttl">Spatial analogue microclimate atlas</h3>${experimentBanner("analysis")}
    <p class="note">Is the candidate's similarity spatially representative, or does it hide variation? <b>${esc(candShort(i))}</b> · ${fmtLat(S.lat[i])} ${fmtLon(S.lon[i])} · cell ${dy.toFixed(0)} × ${dx.toFixed(0)} km.</p>
    <div class="row"><span class="meta">Context window</span><span class="toggles">${[1, 2, 3].map(k => `<button aria-pressed="${k === r}" data-lab="atlas-r" data-r="${k}">${2 * k + 1}×${2 * k + 1}</button>`).join("")}</span>
    ${S.targetId === "cross" ? `<span class="toggles">${TARGET_IDS.map(t => `<button aria-pressed="${t === tid}" data-lab="atlas-t" data-t="${t}">${esc(TNAME[t])}</button>`).join("")}</span>` : ""}</div></div>
    <div class="sec"><div class="lbl">Sub-cell evidence</div>${atlasSubcellBlock(i)}
    <p class="note small">Each Earth value in the score is a single cell statistic. The terrain distribution above (when shown) comes from the Phase III GMTED2010 30″ histogram pass; thermal and climate values have no within-cell distribution. The neighbourhood below uses only other <b>whole cells</b>, which are context: they are not part of this cell's score footprint.</p>
    <div class="grid2"><div class="kv"><span>MODIS pixel-month coverage (this cell)</span><b>${pct(S.A.modis_coverage[i])}</b></div><div class="kv"><span>GMTED land fraction (this cell)</span><b>${pct(S.A.gmted_land_fraction[i])}</b></div></div></div>
    <div class="sec"><div class="lbl">Candidate-vs-target similarity across the ${n}×${n} window · ${esc(TNAME[tid])}</div>
    <div class="hg-row">${act.map(c => heatGrid(WA.window, WA.perCrit[c].sims[tid], r, shortOf(c))).join("")}</div>
    <p class="note small">Brightness = criterion similarity s (0 → 1) of each whole cell to the target. Outlined = the candidate (scored) cell. Hatched = no valid land cell. North up; cells ${dy.toFixed(0)} km tall.</p></div>
    <div class="sec"><div class="lbl">Window statistics (cell means, ${WA.cellsValid}/${WA.cellsTotal} cells valid)</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th><th class="n">Cell</th><th class="n">Mean</th><th class="n">Median</th><th class="n">SD</th><th class="n">IQR</th><th class="n">Min–max</th><th class="n">Valid</th><th class="n">Gradient /100 km</th></tr></thead><tbody>
    ${S.critIds.map(c => { const P = WA.perCrit[c], s = P.stats, g = P.gradient, d = S.crit.find(x => x.id === c).fmt; const F = v => v - v === 0 ? (+v).toFixed(d) : "—";
      return `<tr><td>${esc(labelOf(c))} <span class="meta">${unitOf(c)}</span></td><td class="n">${F(P.centre)}</td><td class="n">${F(s.mean)}</td><td class="n">${F(s.median)}</td><td class="n">${F(s.sd)}</td><td class="n">${F(s.iqr)}</td><td class="n">${F(s.min)}–${F(s.max)}</td><td class="n">${pct(P.validFraction)}</td><td class="n">${g ? (g.mag * 100).toFixed(d) + " @ " + g.bearingDeg.toFixed(0) + "°" : "—"}</td></tr>`; }).join("")}
    </tbody></table></div><p class="note small">Gradient = least-squares plane fitted to the valid window cells (x east, y north, km); bearing of steepest increase, clockwise from north. Percentiles: nearest-rank. These describe variation <b>between</b> ~55 km cells, not within one.</p></div>`;
  if (ctx) {
    const tw = ctx.target_windows[tid];
    h += `<div class="sec"><div class="lbl">Target window terrain distribution · ${esc(TNAME[tid])}</div>
      <div class="grid2"><div>${histSVG(tw.slope_deg, "°", tw.slope_deg.mean, "Slope")}</div><div class="kv-list">
      <div class="kv"><span>Bins</span><b>${tw.bins} × 926.6 m in a ${tw.window_km.toFixed(1)} km window</b></div>
      <div class="kv"><span>Slope median / p10–p90</span><b>${tw.slope_deg.median.toFixed(2)}° / ${tw.slope_deg.p10.toFixed(2)}–${tw.slope_deg.p90.toFixed(2)}°</b></div>
      <div class="kv"><span>Slope SD across bins</span><b>${tw.slope_deg.sd.toFixed(2)}°</b></div>
      <div class="kv"><span>Elevation range in window</span><b>${tw.elevation_m.min.toFixed(0)} … ${tw.elevation_m.max.toFixed(0)} m</b></div></div></div>
      <p class="note small">${esc(tw.note)} The Earth cell has no comparable within-cell distribution (${SUBCELL_MSG.toLowerCase()}), so only the means are compared by the score.</p></div>
      <div class="sec"><div class="lbl">Scale awareness</div><div class="tbl-wrap"><table class="t"><tbody>${ctx.catalog.scales.map(s => `<tr><td>${esc(s.item)}</td><td class="meta">${esc(s.scale)}</td></tr>`).join("")}
      <tr class="hl"><td>This Earth cell</td><td class="meta">${dy.toFixed(1)} × ${dx.toFixed(1)} km · ${Math.round(cellArea(i)).toLocaleString()} km²</td></tr></tbody></table></div>
      <div class="callout">A large region having a similar <b>mean</b> environmental fingerprint is not the same as a specific location having been characterised in enough detail for a field activity. ASTERRO supports only the first statement.</div></div>`;
  } else h += `<div class="sec"><p class="meta">${L.ctxErr ? "Phase II context unavailable: " + esc(L.ctxErr) : "Loading target-window distributions…"}</p></div>`;
  const claims = [
    LAB.claim({ id: "atlas.subcell", category: "UNAVAILABLE", text: SUBCELL_MSG.replace("characterization", "characterization of climate and thermal variables"), limitations: ["MODIS and POWER source pixels not retained after aggregation; terrain sub-cell slope distribution available from the Phase III GMTED pass."] }),
    LAB.claim({ id: "atlas.window", category: "DERIVED", text: `Window statistics over ${WA.cellsValid} valid whole cells (${n}×${n}) around the candidate.`, method: "Descriptive statistics and least-squares plane of cell-mean values.", provenance: ["predictor stack"], limitations: ["Neighbours are context only and do not enter the candidate's score."] }),
  ];
  return h + `<div class="sec">${claimsBlock(claims)}</div>`;
};
LAB_ACTIONS["atlas-r"] = a => { L.atlas.r = +a.dataset.r; labRender(); };
LAB_ACTIONS["atlas-t"] = a => { L.atlas.tgt = a.dataset.t; labRender(); };
