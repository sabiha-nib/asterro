/* ===== Phase III · Global Environmental Extremes Explorer =====
 * Explainable discovery over the Earth predictor stack: environmental regimes (tercile codes),
 * robust outliers (median / MAD), single-criterion extremes, target-specific discovery and
 * diversity. Nothing is assigned by fame or by name: every cell is described by its values only. */
A3.ext = { crit: ["aridity", "annual_temperature_range", "slope", "surface_roughness", "lst_diurnal_range"], z: 3, sort: "lst_diurnal_range", dir: "max", regime: null };
function atExtZ() {
  const k = A3.ext.crit.join(",");
  if (!A3._extZ || A3._extZ.k !== k) A3._extZ = { k, ...ATL.robustZ(S.A, A3.ext.crit), R: ATL.regimes(S.A, A3.ext.crit) };
  return A3._extZ;
}
A3_VIEWS.extremes = function () {
  const E = A3.ext, Z = atExtZ();
  // single-criterion extremes (distinct sites)
  const c = E.sort, key = new Float64Array(S.n);
  for (let i = 0; i < S.n; i++) { const v = S.A[c][i]; key[i] = v - v === 0 ? (E.dir === "max" ? v : -v) : -Infinity; }
  let lo = Infinity; for (const v of key) if (Number.isFinite(v) && v < lo) lo = v;
  const eff = key.map(v => Number.isFinite(v) ? v - lo : -1);
  const top = ATL.distinct(eff, S.cell, S.lat, S.lon, 12, 300);
  // multivariate robust outliers: max |z| over chosen criteria
  const out = [];
  for (let i = 0; i < S.n; i++) {
    let m = 0, arg = null, nOk = 0;
    for (const cc of E.crit) { const z = Z.Z[cc][i]; if (z !== z) continue; nOk++; if (Math.abs(z) > m) { m = Math.abs(z); arg = cc; } }
    if (nOk === E.crit.length && m >= E.z) out.push({ i, m, arg });
  }
  out.sort((a, b) => b.m - a.m || S.cell[a.i] - S.cell[b.i]);
  const oEff = new Float64Array(S.n).fill(-1); out.forEach(o => oEff[o.i] = o.m);
  const oTop = ATL.distinct(oEff, S.cell, S.lat, S.lon, 12, 300);
  // regimes
  const counts = [...Z.R.count.entries()].filter(([k]) => !k.includes("?")).sort((a, b) => b[1] - a[1]);
  const rare = counts.slice().sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 8);
  let h = `<div class="sec"><h3 class="ttl">Global environmental extremes</h3>${atBanner("discovery")}
    <p class="note">Where on Earth are the environmental extremes and rare combinations, independent of any target? Cells are described only by their values; regimes are tercile codes (L / M / H per criterion), outliers are robust z-scores. No place is selected by reputation.</p>
    <fieldset class="lab-picks"><legend class="meta">Criteria</legend>${S.critIds.filter(x => x !== "elevation").map(x => `<label class="ck"><input type="checkbox" data-a3in="ext-c" value="${x}" ${E.crit.includes(x) ? "checked" : ""}>${esc(labelOf(x))}</label>`).join("")}</fieldset></div>
    <div class="sec"><div class="lbl">Single-criterion extremes</div><div class="lab-form"><label>Criterion<select data-a3in="ext-s">${S.critIds.map(x => `<option value="${x}" ${x === c ? "selected" : ""}>${esc(labelOf(x))}</option>`).join("")}</select></label>
      <span class="toggles">${["max", "min"].map(d => `<button aria-pressed="${E.dir === d}" data-a3="ext-dir" data-d="${d}">${d === "max" ? "highest" : "lowest"}</button>`).join("")}</span></div>
      ${atEarthMap("at-ext", top.map((i, k) => ({ i, label: k + 1, title: `${placeStr(i)} · ${atVal(c, S.A[c][i])}` })))}
      <ol class="at-rank">${top.map(i => `<li>${esc(placeStr(i))} <b>${atVal(c, S.A[c][i])}</b> <span class="meta">${atFmtLL(S.lat[i], S.lon[i])}</span></li>`).join("")}</ol>
      <p class="note small">Distinct sites ≥ 300 km apart. Earth range: ${atVal(c, ATL.earthRange(S.A, c)[0])} … ${atVal(c, ATL.earthRange(S.A, c)[1])}.</p></div>
    <div class="sec"><div class="lbl">Multivariate outliers · max |robust z| ≥ <input type="number" step="0.5" min="1" max="10" value="${E.z}" data-a3in="ext-z" aria-label="z threshold" style="width:60px"></div>
      <p class="meta">${nfmt(out.length)} cells (with all chosen criteria present) exceed the threshold. z = (x − median) / (1.4826 · MAD).</p>
      <ol class="at-rank">${oTop.map(i => { const o = out.find(x => x.i === i); return `<li>${esc(placeStr(i))} <b>|z| ${o.m.toFixed(1)}</b> <span class="meta">driven by ${esc(labelOf(o.arg))} = ${atVal(o.arg, S.A[o.arg][i])}</span></li>`; }).join("")}</ol></div>
    <div class="sec"><div class="lbl">Environmental regimes · ${counts.length} occupied of ${Math.pow(3, E.crit.length)} possible</div>
      <p class="note small">Code order: ${E.crit.map(shortOf).join(" · ")}. Tercile cut points: ${E.crit.map(x => `${shortOf(x)} ${atVal(x, Z.R.cuts[x][0])} / ${atVal(x, Z.R.cuts[x][1])}`).join("; ")}.</p>
      <div class="grid2"><div><div class="meta">Most common</div><ol class="at-rank">${counts.slice(0, 8).map(([k, n]) => `<li><button class="lnk mono" data-a3="ext-r" data-r="${k}">${k}</button> <b>${nfmt(n)}</b> cells</li>`).join("")}</ol></div>
      <div><div class="meta">Rarest (diversity)</div><ol class="at-rank">${rare.map(([k, n]) => `<li><button class="lnk mono" data-a3="ext-r" data-r="${k}">${k}</button> <b>${nfmt(n)}</b> cells</li>`).join("")}</ol></div></div>
      ${E.regime ? (() => { const idx = []; for (let i = 0; i < S.n; i++) if (Z.R.code[i] === E.regime) idx.push(i);
        const ef = new Float64Array(S.n).fill(-1); idx.forEach(i => ef[i] = 1 - S.cell[i] / 1e6); const tp = ATL.distinct(ef, S.cell, S.lat, S.lon, 10, 300);
        return `<p class="note small">Regime <b class="mono">${esc(E.regime)}</b>: ${nfmt(idx.length)} cells; up to 10 distinct examples (ordered by cell id, not by any quality).</p>${atEarthMap("at-reg", tp.map((i, k) => ({ i, label: k + 1, title: placeStr(i) })))}`; })() : ""}</div>`;
  // target-specific discovery
  const t = atT(A3.active);
  if (t) {
    const tv = ATL.targetVector(t, S.critIds), off = ATL.outsideEarth(S.A, S.critIds, tv);
    h += `<div class="sec"><div class="lbl">Target-specific discovery · ${esc(t.name)}</div>${off.length ? `<p class="note">${off.map(o => `${esc(labelOf(o.criterion))}: the target (${atVal(o.criterion, o.target)}) lies ${o.side} Earth's entire range by ${atVal(o.criterion, o.gap)}`).join("; ")}. The Earth cells closest on this criterion are the extremes listed above.</p>`
      : `<p class="note">Every directly comparable criterion of this target lies inside Earth's range.</p>`}
      <p class="note small">Change the active target in the Target or Workflow view.</p></div>`;
  }
  return h;
};
Object.assign(A3_ACTIONS, {
  "ext-dir"(a) { A3.ext.dir = a.dataset.d; atRender(); },
  "ext-r"(a) { A3.ext.regime = a.dataset.r; atRender(); },
});
Object.assign(A3_INPUTS, {
  "ext-c"(a) { const s = new Set(A3.ext.crit); a.checked ? s.add(a.value) : s.delete(a.value); A3.ext.crit = S.critIds.filter(c => s.has(c)); if (!A3.ext.crit.length) A3.ext.crit = ["slope"]; A3.ext.regime = null; atRender(); },
  "ext-s"(a) { A3.ext.sort = a.value; atRender(); },
  "ext-z"(a) { const v = +a.value; if (v >= 1 && v <= 10) { A3.ext.z = v; atRender(); } },
});
