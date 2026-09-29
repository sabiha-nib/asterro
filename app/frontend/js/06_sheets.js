/* ===== 06 sheets: trace, reproduce, report ===== */
let sheetOpener = null;
function openSheet(title, body, actions = "") {
  if ($("#sheet").hidden) sheetOpener = document.activeElement;
  $("#sheet-title").textContent = title; $("#sheet-body").innerHTML = body; $("#sheet-actions").innerHTML = actions;
  $("#sheet").hidden = false; $("#sheet-close").focus();
}
function closeSheet() {
  if ($("#sheet").hidden) return;
  $("#sheet").hidden = true;
  if (sheetOpener && document.contains(sheetOpener)) sheetOpener.focus();
  sheetOpener = null;
}
document.addEventListener("keydown", e => {           // keep keyboard focus inside the open dialog
  const sh = $("#sheet"); if (sh.hidden || e.key !== "Tab") return;
  const f = $$("button, a[href], input, [tabindex]:not([tabindex='-1'])", sh).filter(x => !x.disabled && x.offsetParent !== null);
  if (!f.length) return;
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
});
async function copyText(txt, btn) {
  try { await navigator.clipboard.writeText(txt); if (btn) { const o = btn.textContent; btn.textContent = "Copied"; setTimeout(() => btn.textContent = o, 1400); } }
  catch (e) { const pre = $("#sheet-body pre"); if (pre) { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } if (btn) btn.textContent = "Press ⌘/Ctrl-C"; }
}
function needSel() { const i = S.selected ?? S.picked ?? (S.res && S.res.distinct[0]); return i; }
function srcFor(c) { const id = S.crit.find(x => x.id === c).earth_source[0]; return S.app.datasets.find(d => d.id === id); }

function traceHTML(i) {
  const tids = S.targetId === "cross" ? TARGET_IDS : [S.targetId], R = S.res, [dy, dx] = cellDims(i), c = S.cell[i];
  let h = `<div class="flow"><div><b>1 · Target</b>${tids.map(t => TNAME[t]).join(" + ")}</div><div><b>2 · Earth data</b>POWER · MODIS · GMTED2010</div><div><b>3 · Normalize</b>ranges</div><div><b>4 · Weights</b>${esc(currentLabel())}</div><div><b>5 · Result</b>${fmtPct(R.eff[i], 2)}</div></div>`;
  h += `<h3>Earth cell</h3><div class="grid2"><div class="kv"><span>Location</span><b>${esc(placeStr(i))}</b></div><div class="kv"><span>Cell id (row·576 + col)</span><b>${c} (row ${Math.floor(c / 576)}, col ${c % 576})</b></div>
    <div class="kv"><span>Centre</span><b>${fmtLat(S.lat[i])} ${fmtLon(S.lon[i])}</b></div><div class="kv"><span>Bounds</span><b>${(S.lat[i] - .25).toFixed(2)}…${(S.lat[i] + .25).toFixed(2)}°, ${(S.lon[i] - .3125).toFixed(4)}…${(S.lon[i] + .3125).toFixed(4)}°</b></div>
    <div class="kv"><span>Size</span><b>${dy.toFixed(1)} × ${dx.toFixed(1)} km · ${Math.round(cellArea(i)).toLocaleString()} km²</b></div><div class="kv"><span>Cell rank</span><b>#${R.rank[i]?.toLocaleString()} of ${R.nElig.toLocaleString()}</b></div></div>`;
  h += `<h3>Raw Earth values & sources</h3><div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th><th class="n">Value</th><th>Dataset</th></tr></thead><tbody>
    ${S.critIds.map(k => `<tr><td>${esc(labelOf(k))}</td><td class="n">${fmtVal(k, S.A[k][i])} ${unitOf(k)}</td><td class="meta">${esc(srcFor(k).provider)} — ${esc(srcFor(k).dataset.split(";")[0])}</td></tr>`).join("")}
    <tr><td class="meta">aux · precipitation / PET</td><td class="n">${S.A.precip_mm_yr[i].toFixed(0)} / ${S.A.pet_mm_yr[i].toFixed(0)} mm yr⁻¹</td><td class="meta">POWER PRECTOTCORR; Hargreaves-FAO56 · raw P/PET = ${S.A.aridity_index_raw[i] === S.A.aridity_index_raw[i] ? S.A.aridity_index_raw[i].toFixed(3) : "undefined"}</td></tr>
    <tr><td class="meta">aux · MODIS day / night LST</td><td class="n">${S.A.lst_day_k[i].toFixed(1)} / ${S.A.lst_night_k[i].toFixed(1)} K</td><td class="meta">MYD11C3 via GIBS, ${S.app.stack.years[0]}–${S.app.stack.years.at(-1)}</td></tr>
    <tr><td class="meta">aux · mean T2M</td><td class="n">${S.A.t2m_mean_c[i].toFixed(1)} °C</td><td class="meta">POWER T2M 2001–2020</td></tr></tbody></table></div>`;
  for (const t of tids) {
    const d = detailFor(t, i);
    h += `<h3>${esc(TNAME[t])} — normalization, similarity, weights, contributions</h3><div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th><th class="n">Earth e</th><th class="n">Target t</th><th class="n">Range</th><th class="n">e norm.</th><th class="n">t norm.</th><th class="n">d</th><th class="n">s</th><th class="n">w</th><th class="n">k = w·s/Σw</th></tr></thead><tbody>
      ${d.rows.map(r => `<tr${r.active ? "" : ' style="opacity:.45"'}><td>${esc(shortOf(r.c))}${r.active ? "" : ' <span class="meta">excluded</span>'} ${compTag(t, r.c)}</td><td class="n">${fmtVal(r.c, r.e)}</td><td class="n">${r.t == null ? "N/A" : fmtVal(r.c, r.t)}</td><td class="n">${r.lo.toFixed(2)}…${r.hi.toFixed(2)}</td>
        <td class="n">${r.en != null ? r.en.toFixed(4) : "—"}</td><td class="n">${r.tn != null ? r.tn.toFixed(4) : "—"}</td><td class="n">${r.d != null ? r.d.toFixed(4) : "—"}</td><td class="n">${r.s != null ? r.s.toFixed(4) : "—"}</td><td class="n">${r.w.toFixed(2)}</td><td class="n">${r.k != null ? r.k.toFixed(4) : "—"}</td></tr>`).join("")}</tbody></table></div>
      <div class="formula">S = ${d.rows.filter(r => r.k != null).map(r => r.k.toFixed(4)).join(" + ")} = <b>${d.final.toFixed(4)}</b>  (${fmtPct(d.final, 2)})   ·   Σw = ${d.wsum.toFixed(2)}, weight coverage ${fmtPct(d.coverage, 0)}</div>`;
  }
  if (S.targetId === "cross") h += `<p class="note">Cross-planet score = min(${tids.map(t => detailFor(t, i).final.toFixed(4)).join(", ")}) = <b>${R.eff[i].toFixed(4)}</b>.</p>`;
  h += `<h3>Target sources</h3>${tids.map(t => `<p class="note small"><b>${esc(TNAME[t])}:</b> ${S.T[t].sources.map((s, k) => `<a href="${esc(S.T[t].source_urls[k])}" target="_blank" rel="noopener" style="color:var(--earth)">${esc(s)}</a>`).join(" · ")}</p>`).join("")}`;
  return h;
}
function reproConfig(i) {
  const R = S.res, A = S.app;
  return {
    product: "ASTERRO — Planetary Analogue Intelligence", created_utc: new Date().toISOString(),
    target: R.tid, target_name: TNAME[R.tid], target_ids: R.tid === "cross" ? TARGET_IDS.slice() : [R.tid],
    target_status: Object.fromEntries((R.tid === "cross" ? TARGET_IDS : [R.tid]).map(t => [t, S.T[t].status || null])),
    weights: Object.fromEntries(S.critIds.map(c => [c, +S.weights[c]])), profile: S.profile, profile_label: currentLabel(),
    active_criteria: R.active,
    algorithm_version: A.algorithm_version,
    rules: { formula: "S = sum_c w_c*clip(1-|e_c-t_c|/(max_c-min_c),0,1) / sum_c w_c over active criteria with a finite Earth value",
             min_coverage: A.thresholds.min_coverage, coverage_definition: "sum of weights with a finite Earth value / sum of active weights; ranked if >= min_coverage",
             tie_break: "score descending, then cell_id ascending", distinct_sep_km: A.thresholds.distinct_sep_km,
             distinct_method: "greedy over ranked cells, haversine R=6371.0088 km", cross_planet: "min",
             normalization: "min-max over all valid Earth cells union all target values (fixed; independent of the selected target)",
             valid_cell: "GMTED2010 land fraction >= 0.5 AND MODIS LST diurnal range finite AND NASA POWER T2M finite",
             match_threshold: A.thresholds.match, partial_threshold: A.thresholds.partial },
    normalization_ranges: S.ranges, grid_resolution: "0.5 deg lat x 0.625 deg lon (NASA POWER / MERRA-2 native), cell centres",
    dataset_versions: Object.fromEntries(A.datasets.filter(d => !d.role.startsWith("Context")).map(d => [d.id, d.version])),
    predictor_stack: { sha256: A.stack.sha256, n_cells: A.stack.n_cells, file_hashes: A.file_hashes },
    targets_version: "targets.json 1.0.0",
    selected_cell: i == null ? null : { cell_id: S.cell[i], lat: S.lat[i], lon: S.lon[i], location: placeStr(i), expected_score: +R.eff[i].toFixed(12), expected_rank: R.rank[i] },
    expected_top3: R.distinct.slice(0, 3).map(k => ({ cell_id: S.cell[k], score: +R.eff[k].toFixed(12) })),
    reproduce_with: "python -m scripts.reproduce reproduce.json",
  };
}
function showTrace() { const i = needSel(); if (i == null) return; openSheet("Trace result", traceHTML(i), `<button class="btn-sm" id="to-repro">Reproduce</button>`); $("#to-repro").onclick = showReproduce; }
function showReproduce() {
  const i = needSel(), txt = JSON.stringify(reproConfig(i), null, 2);
  openSheet("Reproduce this result", `<p class="note" style="margin:0 0 10px">This configuration, the published predictor stack (SHA-256 above) and <span class="mono">scripts/reproduce.py</span> regenerate the same scores to the last bit. The browser and the Python reference engine share one algorithm and are tested for bitwise parity.</p><pre class="code">${esc(txt)}</pre>`,
    `<button class="btn-sm" id="copy-json">Copy JSON</button>`);
  $("#copy-json").onclick = e => copyText(txt, e.target);
}
function reportMD(i) {
  const R = S.res, tids = R.tid === "cross" ? TARGET_IDS : [R.tid], q = dataQuality(i, R.tid);
  const L = [];
  L.push(`# ANALOGUE ANALYSIS REPORT`, ``, `**Target:** ${tids.map(t => TNAME[t]).join(" + ")}  `, `**Earth location:** ${placeStr(i)}  `,
    `**Coordinates (cell centre):** ${fmtLat(S.lat[i])} ${fmtLon(S.lon[i])} · cell ${S.cell[i]} · 0.5° × 0.625°  `,
    `**Similarity:** ${fmtPct(R.eff[i], 2)} · cell rank #${R.rank[i]} of ${R.nElig}  `, `**Weights:** ${currentLabel()} — ${S.critIds.map(c => `${shortOf(c)} ${(+S.weights[c]).toFixed(2)}`).join(", ")}`, ``);
  for (const t of tids) {
    const d = detailFor(t, i);
    L.push(`## Criterion breakdown — ${TNAME[t]}`, ``, `| Criterion | Earth | Target | s | w | contribution | class |`, `|---|---:|---:|---:|---:|---:|---|`);
    for (const r of d.rows) L.push(`| ${labelOf(r.c)} | ${fmtVal(r.c, r.e)} ${unitOf(r.c)} | ${r.t == null ? "N/A" : fmtVal(r.c, r.t)} | ${r.s != null ? r.s.toFixed(3) : "—"} | ${r.w.toFixed(2)} | ${r.k != null ? (100 * r.k).toFixed(2) + " pts" : "—"} | ${r.s != null ? ENG.classify(r.s) : (r.t == null ? "NOT APPLICABLE" : "excluded")} |`);
    const mm = d.rows.filter(r => r.s != null && ENG.classify(r.s) === "MISMATCH").map(r => labelOf(r.c));
    L.push(``, `**Mismatches:** ${mm.length ? mm.join(", ") : "none"}  `, `**Final:** ${d.final.toFixed(4)}`, ``);
  }
  L.push(`## Data quality indicator`, ``, `- Weight coverage: ${fmtPct(q.coverage, 0)}`, `- MODIS month coverage: ${fmtPct(q.modis, 0)}`, `- GMTED land fraction: ${fmtPct(q.land, 0)}`,
    `- Proxy variables in use: ${q.proxies} of ${q.active}`, `- Spatial resolution: ${q.res}`, `- Missing: ${q.missing.length ? q.missing.map(labelOf).join(", ") : "none"}`, ``);
  L.push(`## Sources`, ``); for (const d of S.app.datasets) L.push(`- ${d.provider} — ${d.dataset} (${d.version}). ${d.url}`);
  L.push(``, `## Methodology`, ``, `d = |e − t| / (max − min); s = clip(1 − d, 0, 1); S = Σ w·s / Σ w. Normalization ranges: min–max over valid Earth cells ∪ targets. Algorithm ${S.app.algorithm_version}.`, ``);
  L.push(`## Limitations`, ``); for (const t of tids) for (const l of S.T[t].limitations) L.push(`- ${l}`);
  L.push(``, `> This system identifies environmental analogues using selected measurable variables. A high similarity score does not establish geological equivalence, engineering suitability, habitability, safety, or mission-site certification.`, ``);
  L.push(`## Reproduction configuration`, ``, "```json", JSON.stringify(reproConfig(i), null, 2), "```");
  return L.join("\n");
}
function showReport() {
  const i = needSel(); if (i == null) return;
  const md = reportMD(i), R = S.res, tids = R.tid === "cross" ? TARGET_IDS : [R.tid];
  let h = `<div class="row" style="justify-content:space-between;align-items:flex-end"><div><div class="body-tag">${TBODY[R.tid]} · ${esc(tids.map(t => TNAME[t]).join(" + "))}</div><h3 class="ttl" style="font-size:26px;margin-top:4px">${esc(placeStr(i))}</h3><div class="meta">${fmtLat(S.lat[i])} ${fmtLon(S.lon[i])} · cell ${S.cell[i]} · ${esc(currentLabel())}</div></div><div class="big" style="color:var(--accent)">${fmtPct(R.eff[i])}<small>ANALOGUE SCORE</small></div></div>`;
  if (R.tid !== "cross") { const d = detailFor(R.tid, i); h += `<h3>Fingerprint</h3><div style="max-width:380px">${radialSVG(d.rows, true)}</div><h3>Match / mismatch</h3>${matchBlock(d.rows)}<h3>Criterion breakdown</h3>${contribTable(d, "Weighted contributions")}`; }
  else h += `<h3>Similarity to each target</h3>${crossSiteBlock(i)}`;
  h += `<h3>Data quality</h3>${qualityBlock(i, R.tid)}<h3>Limitations</h3><ul class="note">${tids.flatMap(t => S.T[t].limitations).map(l => `<li>${esc(l)}</li>`).join("")}</ul>
    <div class="callout">This system identifies environmental analogues using selected measurable variables. A high similarity score does not establish geological equivalence, engineering suitability, habitability, safety, or mission-site certification.</div>
    <h3>Markdown export</h3><pre class="code">${esc(md)}</pre>`;
  openSheet("Analogue analysis report", h, `<button class="btn-sm" id="copy-md">Copy as Markdown</button>`);
  $("#copy-md").onclick = e => copyText(md, e.target);
}
