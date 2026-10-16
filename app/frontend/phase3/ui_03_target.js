/* ===== Phase III · Target detail (fingerprint, statuses, provenance, previews, uncertainty) ===== */
function atThermalBlock(t) {
  const th = t.thermal; if (!th) return "";
  if (th.source === "diviner_polar") {
    return `<div class="sec"><div class="lbl">Thermal evidence · Diviner polar hourly maps</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Season</th><th class="n">mean ΔT</th><th class="n">median</th><th class="n">p10–p90</th><th class="n">T(13–14 h)</th><th class="n">T(01–02 h)</th><th class="n">valid bins</th></tr></thead><tbody>
      ${["summer", "winter"].map(s => { const d = th.seasons[s]; return `<tr><td>${s}</td><td class="n">${f1(d.mean_dT_K)} K</td><td class="n">${f1(d.median_dT_K)}</td><td class="n">${f1(d.p10_dT_K)}–${f1(d.p90_dT_K)}</td><td class="n">${f1(d.mean_T14_K)}</td><td class="n">${f1(d.mean_T02_K)}</td><td class="n">${nfmt(d.bins_valid)} / ${nfmt(d.bins_total)}</td></tr>`; }).join("")}
      </tbody></table></div><p class="note small">Fingerprint value = mean of the two seasonal window means. The two seasons differ by ${f1(Math.abs(th.seasons.summer.mean_dT_K - th.seasons.winter.mean_dT_K))} K — a measured, not modelled, indication of seasonal sensitivity. Bins are 240 m; the map shows them averaged to 926.6 m.</p></div>`;
  }
  if (th.source === "diviner_gcp") {
    const P = th.primary;
    return `<div class="sec"><div class="lbl">Thermal evidence · Diviner Global Cumulative Products</div><div class="grid2">
      <div class="kv"><span>0.5° bins inside the window</span><b>${P.bins_in_window}</b></div><div class="kv"><span>bins with ≥2 of 4 valid quarter-hours at both local times</span><b>${P.bins_used}</b></div>
      <div class="kv"><span>T(13–14 h) / T(01–02 h)</span><b>${f1(P.mean_T14_K)} / ${f1(P.mean_T02_K)} K</b></div><div class="kv"><span>bin ΔT range</span><b>${f1(P.min_bin_dT_K)}–${f1(P.max_bin_dT_K)} K</b></div></div>
      ${th.ring && th.ring.length ? `<p class="note small">Ring windows: ${th.ring.map(r => r.lst_diurnal_range_K == null ? "no valid bins" : f1(r.lst_diurnal_range_K) + " K").join(" · ")}</p>` : ""}
      <p class="note small">Cumulative average of all seasons (2009–2015). Bins are coarse relative to the window, so the value describes the window only approximately.</p></div>`;
  }
  if (th.source === "rems") {
    const P = th.primary, Q = th.strict;
    return `<div class="sec"><div class="lbl">Thermal evidence · MSL REMS (${th.sols_with_data} sols)</div>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>Ls bin</th><th class="n">sols</th><th class="n">ground ΔT (13–14 − 01–02 LTST)</th><th class="n">air diurnal mean</th></tr></thead><tbody>
      ${P.bins.map(b => `<tr><td>${b.ls_bin[0]}–${b.ls_bin[1]}°</td><td class="n">${b.ground_dr_sols}</td><td class="n">${f1(b.ground_dr_K)} K</td><td class="n">${f1(b.air_diurnal_mean_K)} K</td></tr>`).join("")}
      </tbody></table></div>
      <div class="grid2"><div class="kv"><span>Primary filter → ΔT / annual range</span><b>${f2(P.lst_diurnal_range_K)} / ${f2(P.annual_temperature_range_K)} K</b></div>
      <div class="kv"><span>Strict filter (sensitivity) → ΔT / annual range</span><b>${f2(Q.lst_diurnal_range_K)} / ${f2(Q.annual_temperature_range_K)} K</b></div>
      <div class="kv"><span>GTS long-term uncertainty, hours 13 / 1</span><b>${th.ground_uncertainty_K.map(f2).join(" / ")} K</b></div>
      <div class="kv"><span>Ls check (Mars24 at Curiosity landing)</span><b>${f2(th.ls_check.curiosity_landing)}° (published ≈ ${th.ls_check.published_landing_ls}°)</b></div></div>
      <p class="note small">The same aggregation code as the Jezero baseline (MEDA). Differences: REMS ground temperature sensor and boom ambient estimate vs MEDA TIRS and ATS; Mars year 31–32 vs 36; a single rover location.</p></div>`;
  }
  return "";
}
function atTerrainBlock(t) {
  const tr = t.terrain; if (!tr) return `<div class="sec"><div class="callout">No terrain window for this target.</div></div>`;
  const G = A3.grids && A3.grids[t.id];
  const pre = G ? `<div class="hg-row"><figure class="hg">${atRaster("at-hs-" + t.id, G.z, "hill")}<figcaption class="meta">Shaded relief (926.6 m bins)</figcaption></figure>
      <figure class="hg">${atRaster("at-sl-" + t.id, G.slope, "slope")}<figcaption class="meta">Horn slope, 0–30°+</figcaption></figure>
      ${G.dT ? `<figure class="hg">${atRaster("at-dt-" + t.id, G.dT, "dT")}<figcaption class="meta">Diviner ΔT per bin</figcaption></figure>` : ""}</div>`
    : `<p class="meta">${A3.gridErr ? "Window grids unavailable: " + esc(A3.gridErr) : "Loading window grids…"}</p>`;
  if (!G && !A3.gridErr) atGrids();
  const het = tr.heterogeneity;
  return `<div class="sec"><div class="lbl">Terrain window · 55.6 × 55.6 km · ${esc(tr.read_mode)}</div>${pre}
    <div class="grid2"><div class="kv"><span>Bins filled</span><b>${tr.bins_filled} / ${tr.bins_total}</b></div><div class="kv"><span>Slope p90</span><b>${f2(tr.slope_p90_deg)}°</b></div>
    <div class="kv"><span>Elevation in window (product datum)</span><b>${nfmt(tr.elevation_min_m)} … ${nfmt(tr.elevation_max_m)} m</b></div><div class="kv"><span>Window grid SHA-256</span><b class="mono">${tr.grid_sha256.slice(0, 16)}…</b></div></div>
    <p class="note small">${esc(tr.datum_note)} North up; window centred on ${atFmtLL(tr.center[0], tr.center[1])}.</p>
    ${het ? `<div class="lbl">Between-location heterogeneity · ${het.slope_deg.n + 1} windows</div><div class="tbl-wrap"><table class="t"><thead><tr><th></th><th class="n">centre</th><th class="n">ring mean</th><th class="n">ring SD</th><th class="n">ring min–max</th></tr></thead><tbody>
      <tr><td>Slope (°)</td><td class="n">${f2(t.values.slope)}</td><td class="n">${f2(het.slope_deg.mean)}</td><td class="n">${f2(het.slope_deg.sd)}</td><td class="n">${f2(het.slope_deg.min)}–${f2(het.slope_deg.max)}</td></tr>
      <tr><td>Roughness (m)</td><td class="n">${f1(t.values.surface_roughness)}</td><td class="n">${f1(het.surface_roughness_m.mean)}</td><td class="n">${f1(het.surface_roughness_m.sd)}</td><td class="n">${f1(het.surface_roughness_m.min)}–${f1(het.surface_roughness_m.max)}</td></tr></tbody></table></div>
      <p class="note small">${esc(het.method)}; ring radius ${nfmt(het.radius_km)} km. The fingerprint uses the centre window only; the ring shows how representative it is.</p>` :
      (t.heterogeneity_note ? `<p class="note small">${esc(t.heterogeneity_note)}</p>` : (t.kind === "named_feature" ? `<p class="note small">Single window: between-location variability within this feature was not sampled.</p>` : ""))}</div>`;
}
A3_VIEWS.target = function () {
  const t = atT(A3.active); if (!t) return `<div class="sec"><div class="empty">Choose a target.</div></div>`;
  const g = t.anchor.gazetteer, eg = ATL.eligibility(t, S.critIds);
  const tv = ATL.targetVector(t, S.critIds), out = ATL.outsideEarth(S.A, S.critIds, tv);
  const miss = ATL.missingEvidence(t, S.critIds, atWeights());
  let h = `<div class="sec"><div class="row"><h3 class="ttl">${esc(t.name)}</h3>${atLevel(t)}</div>${atBanner("target record")}
    <div class="lab-form"><label class="wide">Target${atTargetPicker(t.id)}</label></div>
    <p class="note">${esc(t.context)}</p>
    <div class="row">${atKind(t.kind)}${t.baseline ? '<span class="tag at-base">baseline target — definition and values unchanged</span>' : ""}</div>
    <div class="grid2"><div class="kv"><span>Location</span><b>${atFmtLL(t.anchor.lat, t.anchor.lon)}</b></div><div class="kv"><span>Anchor</span><b>${esc(t.anchor.type)}</b></div>
    ${g ? `<div class="kv"><span>Gazetteer feature</span><b>${esc(g.name)} · ${esc(g.type)} · ${esc(g.approval)}</b></div><div class="kv"><span>Feature diameter</span><b>${g.diameter_km ? nfmt(g.diameter_km) + " km" : "—"}</b></div>` : ""}</div>
    <p class="note small">Source: ${esc((t.anchor.source || "—").replace(g ? g.link : "\u0000", "").trim())}${g ? ` · <a href="${esc(g.link)}" target="_blank" rel="noopener">${esc(g.link)}</a>` : ""}${t.anchor.secondary_source ? " · <b>secondary source — not checked against the mission archive</b>" : ""}</p></div>
    <div class="sec"><div class="lbl">Fingerprint · status of every criterion</div>${atFingerprint(t)}
    <div class="callout ${eg.ok ? "" : "warn"}">${esc(eg.reason)}</div>
    ${out.length ? `<p class="note small"><b>Outside Earth's range:</b> ${out.map(o => `${esc(labelOf(o.criterion))} ${atVal(o.criterion, o.target)} is ${o.side} every Earth cell (${o.side === "above" ? "max " + atVal(o.criterion, o.earthMax) : "min " + atVal(o.criterion, o.earthMin)})`).join("; ")}. No Earth cell can match this dimension closely.</p>` : ""}</div>`;
  if (t.reproduce_check) {
    h += `<div class="sec"><div class="lbl">Reproducibility check against the baseline target</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th><th class="n">baseline</th><th class="n">recomputed by the Phase III pipeline</th><th class="n">|Δ|</th></tr></thead><tbody>
      ${Object.entries(t.reproduce_check).map(([c, v]) => `<tr><td>${esc(labelOf(c))}</td><td class="n">${f3(v.baseline)}</td><td class="n">${f3(v.recomputed)}</td><td class="n">${v.abs_diff.toExponential(1)}</td></tr>`).join("")}</tbody></table></div>
      <p class="note small">The atlas keeps the baseline values for this target; the recomputation demonstrates that the shared pipeline reproduces them.</p></div>`;
  }
  h += atTerrainBlock(t) + atThermalBlock(t);
  h += `<div class="sec"><div class="lbl">Missing evidence</div>${miss.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Dimension</th><th>Status</th><th class="n">weight share (${esc(S.app.profiles[A3.profile].label)})</th><th>What would close it</th></tr></thead><tbody>
    ${miss.map(m => `<tr><td>${esc(m.criterion === "heterogeneity" ? "Within-feature heterogeneity" : labelOf(m.criterion))}</td><td>${atStatus(m.status)}</td><td class="n">${pct(m.weightShare)}</td><td class="meta">${esc(m.action)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="meta">No gap among the six criteria.</p>`}</div>
    <div class="sec"><div class="row"><button class="btn-sm" data-a3="go" data-to="workflow">Start workflow</button><button class="btn-sm" data-a3="toggle" data-id="${t.id}">${A3.sel.includes(t.id) ? "Remove from comparison" : "Add to comparison"}</button>
      <button class="btn-sm" data-a3="go" data-to="landing">Terrain explorer</button><button class="btn-sm" data-a3="go" data-to="mismatch">Mismatch map</button></div>
    ${claimsBlock(atClaims(t), "Evidence record")}</div>`;
  return h;
};
