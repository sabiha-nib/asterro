/* ===== Phase III · Mismatch Cartographer =====
 * Where on Earth, and on which criterion, does a target fail to be matched — and where is the
 * question unanswerable because data are missing? Ordinary environmental differences are drawn
 * on a continuous colour ramp; missing Earth data are drawn as a hatched pattern; a criterion the
 * target lacks is not drawn at all. A missing value is never shown as a match. */
A3.mm = { crit: null };
function atMmDraw(id, t, c, ranges) {
  A3.draw.push(() => {
    const img = document.getElementById(id + "-field"); if (!img) return;
    const cv = document.createElement("canvas"); cv.width = 576; cv.height = 361;
    const g = cv.getContext("2d"), D = g.createImageData(576, 361), tv = +t.values[c], span = ranges[c][1] - ranges[c][0];
    for (let i = 0; i < S.n; i++) {
      const cl = S.cell[i], row = 360 - Math.floor(cl / 576), col = cl % 576, p = (row * 576 + col) * 4, e = S.A[c][i];
      if (e - e !== 0) {                                     // missing Earth value: hatch (distinct from any difference)
        const on = (row + col) % 3 === 0; D.data[p] = on ? 200 : 60; D.data[p + 1] = on ? 120 : 40; D.data[p + 2] = on ? 220 : 70; D.data[p + 3] = 220; continue;
      }
      const s = Math.max(0, 1 - Math.abs(e - tv) / span);    // criterion similarity (baseline formula)
      const lo = [217, 112, 95], mid = [216, 180, 91], hi = [140, 192, 143];
      const [a, b, f] = s < 0.6 ? [lo, mid, s / 0.6] : [mid, hi, (s - 0.6) / 0.4];
      for (let j = 0; j < 3; j++) D.data[p + j] = Math.round(a[j] + (b[j] - a[j]) * f);
      D.data[p + 3] = 200;
    }
    g.putImageData(D, 0, 0); img.setAttribute("href", cv.toDataURL());
  });
}
A3_VIEWS.mismatch = function () {
  const t = atT(A3.active); if (!t) return `<div class="sec"><div class="empty">Choose a target.</div></div>`;
  const direct = S.critIds.filter(c => t.status[c] === "DIRECT");
  const c = direct.includes(A3.mm.crit) ? A3.mm.crit : direct[0];
  const R = atCands(t, 20), ranges = atRanges(t);
  let h = `<div class="sec"><h3 class="ttl">Mismatch cartographer</h3>${atBanner("diagnostic map")}
    <div class="lab-form"><label class="wide">Target${atTargetPicker(t.id)}</label>
    <label>Criterion<select data-a3in="mm-c">${S.critIds.map(x => `<option value="${x}" ${x === c ? "selected" : ""} ${t.status[x] === "DIRECT" ? "" : "disabled"}>${esc(labelOf(x))}${t.status[x] === "DIRECT" ? "" : " — " + t.status[x]}</option>`).join("")}</select></label></div>`;
  if (!c) return h + `<div class="callout warn">No directly comparable criterion: nothing can be mapped.</div></div>`;
  let nMiss = 0, nMis = 0, nPart = 0, nMatch = 0; const span = ranges[c][1] - ranges[c][0];
  for (let i = 0; i < S.n; i++) { const e = S.A[c][i]; if (e - e !== 0) { nMiss++; continue; } const s = Math.max(0, 1 - Math.abs(e - t.values[c]) / span); if (s >= 0.85) nMatch++; else if (s >= 0.6) nPart++; else nMis++; }
  atMmDraw("at-mm", t, c, ranges);
  h += `<p class="note small">Colour = criterion similarity s to ${esc(t.name)} on ${esc(labelOf(c))} (${atVal(c, t.values[c])}): red s &lt; 0.60 (mismatch) → amber → green s ≥ 0.85 (match), the baseline thresholds. <b>Hatched violet = no Earth value</b> (a data gap, not a difference).</p></div>
    <div class="sec">${atEarthMap("at-mm", R.eligible ? R.top.slice(0, 10).map((i, k) => ({ i, label: k + 1, title: placeStr(i) })) : [])}
    <div class="grid2"><div class="kv"><span>match (s ≥ 0.85)</span><b>${nfmt(nMatch)} cells</b></div><div class="kv"><span>partial (0.60–0.85)</span><b>${nfmt(nPart)}</b></div>
    <div class="kv"><span>mismatch (s &lt; 0.60)</span><b>${nfmt(nMis)}</b></div><div class="kv"><span>no Earth value (data gap)</span><b>${nfmt(nMiss)}</b></div></div></div>`;
  // candidate-level mismatch profile with data-quality warnings kept separate
  if (R.eligible) {
    const w = atWeights();
    h += `<div class="sec"><div class="lbl">Top candidates: differences vs data-quality warnings</div><div class="tbl-wrap"><table class="t"><thead><tr><th>#</th><th>Candidate</th>${S.critIds.map(x => `<th class="n">${esc(shortOf(x))}</th>`).join("")}<th>Data-quality warnings</th></tr></thead><tbody>
      ${R.top.slice(0, 10).map((i, k) => { const X = ATL.explain(R.P, w, i, S.A, R.ranges), byC = Object.fromEntries(X.map(x => [x.criterion, x]));
        const warn = []; if (S.A.modis_coverage[i] < 0.9) warn.push(`MODIS coverage ${pct(S.A.modis_coverage[i])}`); if (S.A.gmted_land_fraction[i] < 0.5) warn.push(`land fraction ${pct(S.A.gmted_land_fraction[i])}`);
        X.filter(x => x.similarity == null).forEach(x => warn.push(`no Earth ${shortOf(x.criterion)}`));
        return `<tr><td>${k + 1}</td><td>${esc(candShort(i))}</td>${S.critIds.map(x => { const v = byC[x]; if (!v) return `<td class="n meta">${t.status[x] === "DIRECT" ? "w=0" : "—"}</td>`;
          if (v.similarity == null) return `<td class="n"><span class="st st-m">gap</span></td>`;
          const cls = v.similarity >= 0.85 ? "c-match" : v.similarity >= 0.6 ? "c-partial" : "c-mismatch"; return `<td class="n ${cls}">${v.similarity.toFixed(2)}</td>`; }).join("")}
          <td>${warn.length ? warn.map(x => `<span class="tag st-u">${esc(x)}</span>`).join(" ") : '<span class="meta">none</span>'}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="note small">Numbers are criterion similarities (differences). Tags in the last column are data-quality conditions, which are not differences and are never folded into the similarity. "—" = the target has no comparable value on that criterion.</p></div>`;
  }
  return h;
};
A3_INPUTS["mm-c"] = a => { A3.mm.crit = a.value; atRender(); };
