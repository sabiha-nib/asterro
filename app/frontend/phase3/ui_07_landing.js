/* ===== Phase III · Landing-Site Intelligence Explorer =====
 * Exploratory terrain and environmental assessment of a target's 55.6 km window from the measured
 * 926.6 m grids. It is NOT a landing-site certification and produces no safety score: thresholds
 * are user-chosen, every result is labelled with the resolution that limits it. */
const AT_LS_LABEL = "Exploratory terrain and environmental assessment.";
A3.ls = { maxSlope: 5, useThermal: false, dtLo: "", dtHi: "" };
A3_VIEWS.landing = function () {
  const t = atT(A3.active); if (!t) return `<div class="sec"><div class="empty">Choose a target.</div></div>`;
  const G = A3.grids && A3.grids[t.id];
  let h = `<div class="sec"><h3 class="ttl">Landing-site intelligence explorer</h3><div class="lab-banner"><b>EXPLORATORY</b>${esc(AT_LS_LABEL)} Not a landing-site certification. No safety score is computed.</div>
    <div class="lab-form"><label class="wide">Target${atTargetPicker(t.id, "at-active", x => !!x.terrain)}</label>
      <label>Slope threshold (°, your choice)<input type="number" min="0.5" max="45" step="0.5" value="${A3.ls.maxSlope}" data-a3in="ls-slope"></label>
      ${G && G.dT ? `<label class="ck"><input type="checkbox" data-a3in="ls-th" ${A3.ls.useThermal ? "checked" : ""}> also require ΔT within</label><label>ΔT min (K)<input type="number" value="${esc(A3.ls.dtLo)}" data-a3in="ls-lo"></label><label>ΔT max (K)<input type="number" value="${esc(A3.ls.dtHi)}" data-a3in="ls-hi"></label>` : ""}</div></div>`;
  if (!G) { if (!A3.gridErr) atGrids(); return h + `<div class="sec"><p class="meta">${A3.gridErr ? esc(A3.gridErr) : "Loading window grids…"}</p></div>`; }
  let mask = null;
  if (A3.ls.useThermal && G.dT) {
    const lo = A3.ls.dtLo === "" ? -Infinity : +A3.ls.dtLo, hi = A3.ls.dtHi === "" ? Infinity : +A3.ls.dtHi;
    mask = new Uint8Array(3600); for (let k = 0; k < 3600; k++) mask[k] = G.dT[k] === G.dT[k] && G.dT[k] >= lo && G.dT[k] <= hi ? 1 : 0;
  }
  const W = ATL.windowClasses(G.slope, { maxSlope: A3.ls.maxSlope, mask });
  const sel = new Float32Array(3600).fill(NaN); W.largestCells.forEach(k => sel[k] = 1);
  const okm = new Float32Array(3600); for (let k = 0; k < 3600; k++) okm[k] = G.slope[k] === G.slope[k] ? (G.slope[k] <= A3.ls.maxSlope && (!mask || mask[k]) ? 1 : 0) : NaN;
  h += `<div class="sec"><div class="lbl">${esc(t.name)} · 60 × 60 bins of 926.6 m</div><div class="hg-row">
      <figure class="hg">${atRaster("at-ls-hs", G.z, "hill", 2.8)}<figcaption class="meta">Shaded relief</figcaption></figure>
      <figure class="hg">${atRaster("at-ls-sl", G.slope, "slope", 2.8)}<figcaption class="meta">Slope</figcaption></figure>
      <figure class="hg">${atRaster("at-ls-ok", okm, "dT", 2.8)}<figcaption class="meta">Bins meeting your condition (bright)</figcaption></figure>
      <figure class="hg">${atRaster("at-ls-cc", sel, "dT", 2.8)}<figcaption class="meta">Largest connected area</figcaption></figure></div>
    <div class="grid2">${W.fracLe.map(f => `<div class="kv"><span>bins with slope ≤ ${f.deg}°</span><b>${pct(f.frac)}</b></div>`).join("")}
      <div class="kv"><span>separate areas meeting the condition</span><b>${W.components}</b></div><div class="kv"><span>largest connected area</span><b>${nfmt(W.largestKm2)} km² (${W.largestCells.length} bins)</b></div></div>
    <div class="callout">Resolution limit: each bin is 926.6 m, so slopes are averaged over ~1 km baselines; hazards at the scale of a lander (boulders, metre-scale slopes, craters < 1 km) are invisible here. Use this to compare windows, not to choose a landing point.</div></div>`;
  // compare across targets of the same body
  const same = A3.atlas.targets.filter(o => o.body === t.body && A3.grids[o.id]);
  h += `<div class="sec"><div class="lbl">Same threshold across ${t.body} targets</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Target</th><th class="n">bins ≤ ${A3.ls.maxSlope}°</th><th class="n">largest connected km²</th><th class="n">mean slope</th></tr></thead><tbody>
    ${same.map(o => { const w2 = ATL.windowClasses(A3.grids[o.id].slope, { maxSlope: A3.ls.maxSlope }), f = w2.valid ? w2.fracLe.find(x => x.deg >= A3.ls.maxSlope) : null;
      let n = 0; for (const v of A3.grids[o.id].slope) if (v === v && v <= A3.ls.maxSlope) n++;
      return `<tr class="${o.id === t.id ? "hl" : ""}"><td><button class="lnk" data-a3="ls-t" data-id="${o.id}">${esc(o.name)}</button></td><td class="n">${pct(n / w2.valid)}</td><td class="n">${nfmt(w2.largestKm2)}</td><td class="n">${f2(o.values.slope)}°</td></tr>`; }).join("")}</tbody></table></div></div>
    <div class="sec">${claimsBlock([
      LAB.claim({ id: "ls.window", category: "DERIVED", text: `Slope classes and connected areas of the ${t.name} window at 926.6 m bins.`, method: "Horn slope of the binned DEM; 4-connected components of bins meeting the user's condition.", provenance: ["dataset:dem_" + t.body.toLowerCase()], limitations: ["~1 km resolution; no lander-scale hazard information."] }),
      LAB.claim({ id: "ls.notsafety", category: "UNAVAILABLE", text: "Landing safety, certification and hazard probability are not assessed by ASTERRO.", completeness: "none" })])}</div>`;
  return h;
};
A3_ACTIONS["ls-t"] = a => { A3.active = a.dataset.id; atRender(); };
Object.assign(A3_INPUTS, {
  "ls-slope"(a) { const v = +a.value; if (v > 0 && v <= 45) { A3.ls.maxSlope = v; atRender(); } },
  "ls-th"(a) { A3.ls.useThermal = a.checked; atRender(); },
  "ls-lo"(a) { A3.ls.dtLo = a.value; atRender(); },
  "ls-hi"(a) { A3.ls.dtHi = a.value; atRender(); },
});
