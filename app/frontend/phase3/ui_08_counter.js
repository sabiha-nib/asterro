/* ===== Phase III · Counterfactual Laboratory =====
 * "What would change if …?" — the same target scored under alternative, explicitly labelled
 * analytical choices: normalisation table, weighting profile, proxy inclusion, criterion removal.
 * Each alternative is computed, never assumed; the default configuration is always shown beside it. */
A3.cf = { alt: "target", drop: null, profile: null, proxy: null };
function atCfRun(t, { norm, profile, proxy, drop }) {
  const w = { ...S.app.profiles[profile].weights }; if (drop) w[drop] = 0;
  const tv = ATL.targetVector(t, S.critIds, { includeProxy: proxy });
  const ranges = ATL.rangesFor(norm, { A: S.A, critIds: S.critIds, atlas: A3.atlas, baselineRanges: S.app.ranges, tv });
  try { return ATL.candidates({ A: S.A, cell: S.cell, lat: S.lat, lon: S.lon, critIds: S.critIds, t, ranges, w, n: 20, includeProxy: proxy }); }
  catch (e) { return { eligible: false, reason: e.message }; }
}
A3_VIEWS.counter = function () {
  const t = atT(A3.active); if (!t) return `<div class="sec"><div class="empty">Choose a target.</div></div>`;
  const C = A3.cf, base = { norm: A3.norm, profile: A3.profile, proxy: A3.includeProxy, drop: null };
  const alt = { norm: C.alt === "norm" ? C.normAlt || "target" : base.norm, profile: C.alt === "profile" ? C.profile || "rover" : base.profile,
    proxy: C.alt === "proxy" ? !base.proxy : base.proxy, drop: C.alt === "drop" ? C.drop || "lst_diurnal_range" : null };
  if (C.alt === "target") alt.norm = base.norm === "target" ? "atlas" : "target";
  const A0 = atCfRun(t, base), A1 = atCfRun(t, alt);
  let h = `<div class="sec"><h3 class="ttl">Counterfactual laboratory</h3>${atBanner("counterfactual")}
    <p class="note">One change at a time, computed. The left column is the current configuration; the right column is the counterfactual. Rank changes show how much a conclusion depends on an analytical choice rather than on the data.</p>
    <div class="lab-form"><label class="wide">Target${atTargetPicker(t.id)}</label>
      <label>Counterfactual<select data-a3in="cf-alt">${[["target", "swap the default table for the catalogue table (or back)"], ["norm", "another normalisation table"], ["profile", "another weighting profile"], ["proxy", "toggle proxy criteria"], ["drop", "remove one criterion"]].map(([k, v]) => `<option value="${k}" ${C.alt === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
      ${C.alt === "norm" ? `<label>Table<select data-a3in="cf-norm">${Object.entries(A3_NORM_LABEL).map(([k, v]) => `<option value="${k}" ${alt.norm === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>` : ""}
      ${C.alt === "profile" ? `<label>Profile<select data-a3in="cf-prof">${Object.entries(S.app.profiles).map(([k, p]) => `<option value="${k}" ${alt.profile === k ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select></label>` : ""}
      ${C.alt === "drop" ? `<label>Criterion<select data-a3in="cf-drop">${S.critIds.map(c => `<option value="${c}" ${alt.drop === c ? "selected" : ""}>${esc(labelOf(c))}</option>`).join("")}</select></label>` : ""}</div>${atCtxLine()}</div>`;
  const desc = x => `${A3_NORM_LABEL[x.norm]} · ${S.app.profiles[x.profile].label} · proxies ${x.proxy ? "in" : "out"}${x.drop ? " · without " + labelOf(x.drop) : ""}`;
  if (!A0.eligible || !A1.eligible) return h + `<div class="sec"><div class="callout warn">${esc(!A0.eligible ? A0.reason : A1.reason)}</div></div>`;
  const pos = new Map(A0.top.map((i, k) => [i, k]));
  const kept = A1.top.filter(i => pos.has(i)).length;
  h += `<div class="sec"><div class="grid2"><div><div class="meta">Current · ${esc(desc(base))}</div><ol class="at-rank">${A0.top.slice(0, 15).map(i => `<li>${esc(candShort(i))} <b>${fmtPct(A0.eff[i])}</b></li>`).join("")}</ol></div>
    <div><div class="meta">Counterfactual · ${esc(desc(alt))}</div><ol class="at-rank">${A1.top.slice(0, 15).map((i, k) => { const p = pos.get(i);
      return `<li>${esc(candShort(i))} <b>${fmtPct(A1.eff[i])}</b> <span class="meta">${p == null ? "new" : p === k ? "=" : (p > k ? "▲" : "▼") + Math.abs(p - k)}</span></li>`; }).join("")}</ol></div></div>
    <div class="grid2"><div class="kv"><span>top-20 sites kept</span><b>${kept} / ${A0.top.length}</b></div><div class="kv"><span>#1 unchanged</span><b>${A0.top[0] === A1.top[0] ? "yes" : "no"}</b></div>
    <div class="kv"><span>criteria scored (current → counterfactual)</span><b>${A0.active.map(shortOf).join(", ")} → ${A1.active.map(shortOf).join(", ")}</b></div></div>
    <p class="note small">${kept >= 16 ? "The candidate list is largely insensitive to this choice." : kept >= 8 ? "The candidate list partly depends on this choice; report both." : "The candidate list depends strongly on this choice; a conclusion drawn from one configuration would not be robust."}</p></div>`;
  if (alt.norm !== base.norm || C.alt === "target") {
    const r0 = A0.P ? atRangesFor(base, t) : null, r1 = atRangesFor(alt, t);
    h += `<div class="sec"><div class="lbl">Normalisation tables compared</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th><th class="n">current [min, max]</th><th class="n">counterfactual [min, max]</th></tr></thead><tbody>
      ${S.critIds.map(c => `<tr><td>${esc(labelOf(c))}</td><td class="n">${f2(r0[c][0])} … ${f2(r0[c][1])}</td><td class="n">${f2(r1[c][0])} … ${f2(r1[c][1])}</td></tr>`).join("")}</tbody></table></div>
      <p class="note small">A wider span compresses every similarity on that criterion. The catalogue table includes lunar ΔT values (~270–285 K) far above any Earth cell, which compresses the thermal criterion for every target that uses it.</p></div>`;
  }
  return h;
};
function atRangesFor(x, t) { return ATL.rangesFor(x.norm, { A: S.A, critIds: S.critIds, atlas: A3.atlas, baselineRanges: S.app.ranges, tv: ATL.targetVector(t, S.critIds, { includeProxy: x.proxy }) }); }
Object.assign(A3_INPUTS, {
  "cf-alt"(a) { A3.cf.alt = a.value; atRender(); },
  "cf-norm"(a) { A3.cf.normAlt = a.value; atRender(); },
  "cf-prof"(a) { A3.cf.profile = a.value; atRender(); },
  "cf-drop"(a) { A3.cf.drop = a.value; atRender(); },
});
