/* ===== Phase II · Observation Value Engine =====
 * Formal value-of-information analysis needs a decision, utilities, an uncertainty model and a
 * likelihood model for how observations would update beliefs. ASTERRO has none of these, so this
 * module performs a transparent QUALITATIVE evidence-priority analysis grounded in the
 * Robustness Laboratory's recorded outputs. It never reports information gain or value. */
const VOI_CONDITIONS = [
  ["A clearly defined decision or research objective", false, "Objectives are free text in the Planner; no decision rule or alternatives are formalised."],
  ["A defined uncertainty model", false, "Only measured variability, a decoding bound and alternative statistics exist (Uncertainty explorer); no probability distributions."],
  ["A defined set of possible observations", true, "Finer-scale terrain (sub-cell DEM), in-situ thermal measurements, longer temporal records."],
  ["A model of how observations change beliefs or decisions", false, "No likelihood model links new data to rankings."],
  ["A measurable outcome or decision utility", false, "None defined."],
  ["Explicit assumptions and limitations", true, "Documented here and in docs/phase2/METHODS.md."],
];
const OBS_FOR = {
  slope: { obs: "Higher-resolution slope (e.g. sub-cell DEM distribution)", why: "Earth slope is one cell mean of 926.6 m slopes; the within-cell distribution was not retained.", test: "Obtain a finer DEM for both areas, recompute the slope distribution, and check whether the two sites keep their order." },
  surface_roughness: { obs: "Sub-cell roughness / terrain distribution", why: "Roughness is one SD over a ~55 km cell.", test: "Compute roughness at several window sizes from a finer DEM for both areas." },
  lst_diurnal_range: { obs: "In-situ or higher-resolution thermal observations at matched local times", why: "MODIS values are colour-map decoded (0.6 K bins) and aggregated; target values are rover point or 240 m window statistics.", test: "Compare MODIS science-file (HDF) values or field radiometry for both areas; check sensitivity of the order to ±0.6 K." },
  annual_temperature_range: { obs: "Multi-year air-temperature records", why: "Earth uses a 20-year climatology without interannual values; Mars covers one year.", test: "Recompute the range per year for both areas and see whether the order is stable." },
  aridity: { obs: "None that resolves a proxy target", why: "The target aridity is 0 by definition; more Earth data cannot make the proxy a measurement.", test: "Run the ablation without aridity to see whether the order depends on it." },
  elevation: { obs: "None that resolves a proxy target", why: "The elevation target is a 'thin atmosphere' proxy.", test: "Run the ablation without elevation; consider pressure data as a separate (unscored) check." },
};
LAB_VIEWS.obsval = function () {
  if (!S.res) return `<div class="sec"><div class="empty">Run the search first.</div></div>`;
  const R = L.res.robust && L.res.robust.key === baseKey() ? L.res.robust : null;
  let h = `<div class="sec"><h3 class="ttl">Observation value engine</h3>
    <p class="note">Which additional measurements could best help distinguish candidates whose order is ambiguous? Recommendations are derived from recorded analyses and say what would test them.</p>
    <div class="lbl" style="margin-top:12px">Conditions for formal value-of-information analysis</div><div class="tbl-wrap"><table class="t"><tbody>
    ${VOI_CONDITIONS.map(([t, ok, n]) => `<tr><td>${ok ? '<span class="rq c-match"><b>✓</b> met</span>' : '<span class="rq c-mismatch"><b>✕</b> not met</span>'}</td><td>${esc(t)}<div class="meta">${esc(n)}</div></td></tr>`).join("")}
    </tbody></table></div><div class="callout">Formal VOI is <b>blocked</b> (4 of 6 conditions unmet). A qualitative evidence-priority analysis is given instead; no expected information gain, value or probability is reported.</div></div>`;
  if (!R) return h + `<div class="sec"><div class="empty">Run an experiment in the <button class="lnk" data-lab="goto" data-to="robust">Robustness Laboratory</button> for the current configuration first; the disagreement analysis uses its recorded outputs.</div></div>`;
  const tid = S.targetId, flips = R.flips.filter(f => f.frac >= 0.2).slice(0, 8), act = R.act;
  const sA = (c, i) => simC(c, i);
  const recs = flips.map(f => {
    const a = R.cand[f.a], b = R.cand[f.b];
    const oatFlip = {}; R.oat.forEach((d, q) => { const ab = R.orun.ranks[f.a][q] < R.orun.ranks[f.b][q], base = R.run.baseRanks[f.a] < R.run.baseRanks[f.b]; if (ab !== base) oatFlip[d.criterion] = (oatFlip[d.criterion] || 0) + 1; });
    const contrib = act.map(c => { const da = sA(c, a), db = sA(c, b); return { c, ds: da - db, wds: (+S.weights[c]) * (da - db), flipsOAT: oatFlip[c] || 0 }; }).filter(x => x.ds === x.ds);
    contrib.sort((x, y) => (y.flipsOAT - x.flipsOAT) || (Math.abs(y.wds) - Math.abs(x.wds)));
    const drv = contrib[0], O = OBS_FOR[drv.c], st = (tid === "cross" ? targetsFor(tid).map(t => S.T[t].status[drv.c]).join("/") : S.T[tid].status[drv.c]);
    return { f, a, b, drv, contrib, O, st,
      text: `${O.obs} may help distinguish ${candShort(a)} and ${candShort(b)}: their order flips in ${pct(f.frac)} of the ${R.D.design.length} tested weightings, and ${labelOf(drv.c).toLowerCase()} ${drv.flipsOAT ? `alone reverses it in ${drv.flipsOAT} of 2 one-at-a-time tests` : "shows the largest weighted similarity difference"} (Δs = ${drv.ds >= 0 ? "+" : ""}${drv.ds.toFixed(3)}).` };
  });
  h += `<div class="sec"><div class="lbl">Candidate disagreement · pairs whose order flips in ≥ 20 % of configurations</div>
    ${recs.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Pair (baseline order)</th><th class="n">Flip</th><th>Driving criterion</th><th>Status</th></tr></thead><tbody>${recs.map(r => `<tr><td><button class="lnk" data-lab="sel" data-i="${r.a}">${siteNo(r.a)}</button> ${esc(candShort(r.a).slice(0, 16))} vs <button class="lnk" data-lab="sel" data-i="${r.b}">${siteNo(r.b)}</button> ${esc(candShort(r.b).slice(0, 16))}</td><td class="n">${pct(r.f.frac)}</td><td>${esc(labelOf(r.drv.c))}</td><td><span class="tag ${r.st.includes("PROXY") ? "proxy" : "direct"}">${esc(r.st)}</span></td></tr>`).join("")}</tbody></table></div>` : `<p class="note small">No candidate pair flips in ≥ 20 % of the tested configurations (${esc(R.D.name)}); the evidence does not single out a measurement that would change the order.</p>`}</div>`;
  if (recs.length) h += `<div class="sec"><div class="lbl">Recommendations and audit</div>${recs.map((r, k) => `<div class="fm-card"><div class="fm-h">O${k + 1} · ${esc(r.O.obs)}</div><p class="note">${esc(r.text)}</p><dl>
      <dt>Why this evidence is weak now</dt><dd>${esc(r.O.why)}</dd><dt>Generated from</dt><dd>Robustness record ${R.rec.id} (pair ${siteNo(r.a)}/${siteNo(r.b)}, ${r.f.flips}/${R.D.design.length} flips; one-at-a-time flips by criterion: ${r.contrib.map(x => `${shortOf(x.c)} ${x.flipsOAT}`).join(", ")})</dd>
      <dt>Evidence needed to test it</dt><dd>${esc(r.O.test)}</dd><dt>Category</dt><dd>${evTag("INFERRED")} heuristic priority; not a value-of-information estimate</dd></dl></div>`).join("")}</div>`;
  return h;
};
