/* ===== Phase IV · Mismatch Explorer =====
 * For one target and one Earth cell: every criterion is classified deterministically as agreement, partial
 * agreement, mismatch, proxy, proxy excluded, missing (target), missing (Earth), not applicable or excluded by
 * weight, with the values, the similarity, and the scale / temporal difference between the target measurement
 * and the Earth cell value. Over the target's top candidates, the classes are tabulated per criterion. */
const A4_MM_ORDER = ["agreement", "partial", "mismatch", "proxy", "proxy_excluded", "missing_target", "missing_earth", "incompatible", "excluded_weight"];
const A4_MM_CSS = { agreement: "st-d", partial: "st-p", mismatch: "p4-bad", proxy: "st-p", proxy_excluded: "st-x", missing_target: "st-u", missing_earth: "st-u", incompatible: "st-x", excluded_weight: "st-x" };
function a4MmRanges(t) {
  const fp = t.fingerprint, tv = Object.fromEntries(S.critIds.map(c => [c, fp.criterion_status[c] === "DIRECT" || (A4.mm.proxy && fp.criterion_status[c] === "PROXY") ? fp.variables[c] : null]));
  return RG.earthUnionRanges(S.A, S.critIds, tv);
}
function a4MmCands(t) {
  const at = atT(t.id); if (!at) return [];
  const save = A3.includeProxy, saveN = A3.norm; A3.includeProxy = A4.mm.proxy; A3.norm = "target";
  try { const r = atCands(at, 20); return r.eligible ? r.top : []; } finally { A3.includeProxy = save; A3.norm = saveN; }
}
A3_VIEWS.mmx = function () {
  const need = a4Need(); if (need) return need;
  const tid = A4.mm.target && a4T(A4.mm.target) ? A4.mm.target : (a4T(A3.active) ? A3.active : "mars_gale_curiosity");
  A4.mm.target = tid;
  const t = a4T(tid), w = atWeights(), ranges = a4MmRanges(t), cands = t.readiness.level >= 2 ? a4MmCands(t) : [];
  let i = A4.mm.cell; if (i == null || !(i >= 0)) i = cands.length ? cands[0] : (S.selected != null ? S.selected : null);
  const [dy, dx] = i != null ? cellDims(i) : [55.6, 69.5], cellKm = `0.5° × 0.625° (${dy.toFixed(0)} × ${dx.toFixed(0)} km)`;
  let h = `<div class="sec"><h3 class="ttl">Mismatch Explorer</h3>${a4Banner("per-criterion agreement")}
    <p class="note">Why does an Earth cell resemble — or fail to resemble — a target? Every criterion gets one deterministic class. A missing value is never a match, and a criterion the target lacks is never scored.</p>
    <div class="lab-form"><label>Target${atTargetPicker(tid, "mmt", x => x.readiness.level >= 2)}</label>
      <label>Earth cell<select data-a4in="mmc"><option value="">choose…</option>${cands.map((k, n) => `<option value="${k}" ${k === i ? "selected" : ""}>#${n + 1} ${esc(placeStr(k))}</option>`).join("")}${S.selected != null && !cands.includes(S.selected) ? `<option value="${S.selected}" ${S.selected === i ? "selected" : ""}>Explore selection: ${esc(placeStr(S.selected))}</option>` : ""}</select></label>
      <label class="ck"><input type="checkbox" data-a4in="mmp" ${A4.mm.proxy ? "checked" : ""}> include proxy criteria</label>${a4ProfileSel()}</div>
    <p class="meta small">Ranges: Earth ∪ this target (${A4.mm.proxy ? "DIRECT + PROXY" : "DIRECT only"}) · thresholds: agreement ≥ ${S.app.thresholds.match}, partial ≥ ${S.app.thresholds.partial} (baseline classes).</p></div>`;
  if (i == null) return h + `<div class="sec"><div class="empty">${t.readiness.level < 2 ? "This target has no analytical data." : "Select an Earth cell."}</div></div>`;
  const mm = RG.mismatch({ t, i, A: S.A, critIds: S.critIds, w, ranges, includeProxy: A4.mm.proxy, thresholds: S.app.thresholds, cellKm });
  /* score and per-criterion contributions under the same vector, ranges and weights (traceable to the table) */
  const tvS = RG.scenarioVector(t, A4.mm.proxy), PS = LAB.prepare(S.A, S.critIds, tvS, ranges), FS = LAB.fieldScore(PS, w), ctb = RG.contributions(PS, w, i);
  h += `<div class="sec"><div class="row" style="justify-content:space-between;align-items:flex-end"><div><div class="lbl">Score under this configuration</div><div class="big" style="color:var(--accent)">${fmtPct(FS.eff[i])}</div><div class="meta small">coverage ${(100 * FS.coverage[i]).toFixed(0)} % of active weight · atlas comparison score (not the baseline Analogue Score)</div></div>
    <button class="btn-sm" data-a4="mmsave" data-i="${i}">Save this Earth cell to a collection</button></div>${a4MmChart(mm, ctb)}</div>`;
  h += `<div class="sec"><div class="lbl">${esc(t.name)} × ${esc(placeStr(i))}</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th><th>Status</th><th class="n">Earth</th><th class="n">Target</th><th class="n">s</th><th class="n">contribution</th><th>Class</th><th>Explanation</th></tr></thead><tbody>
    ${mm.map(m => `<tr><td>${esc(labelOf(m.criterion))}</td><td>${esc(m.status)}</td><td class="n">${m.earth == null ? "—" : atVal(m.criterion, m.earth)}</td><td class="n">${m.target == null ? "—" : atVal(m.criterion, m.target)}</td><td class="n">${m.similarity == null ? "—" : m.similarity.toFixed(3)}</td><td class="n">${ctb[m.criterion] == null ? "—" : (100 * ctb[m.criterion]).toFixed(1) + " pts"}</td>
      <td><span class="tag ${A4_MM_CSS[m.class]}">${esc(m.class.replace(/_/g, " "))}</span></td><td class="small">${esc(m.text)}${m.scale ? `<br><span class="meta">Scale: ${esc(m.scale)}</span>` : ""}${m.scaleWarning ? `<br><b>${esc(m.scaleWarning)}</b>` : ""}</td></tr>`).join("")}</tbody></table></div></div>`;
  if (cands.length) {
    const tab = S.critIds.map(c => { const o = {}; for (const k of cands) { const m = RG.mismatch({ t, i: k, A: S.A, critIds: [c], w, ranges, includeProxy: A4.mm.proxy, thresholds: S.app.thresholds, cellKm })[0]; o[m.class] = (o[m.class] || 0) + 1; } return [c, o]; });
    const used = A4_MM_ORDER.filter(k => tab.some(([, o]) => o[k]));
    h += `<div class="sec"><div class="lbl">Classes over the top ${cands.length} distinct candidates</div><div class="tbl-wrap"><table class="t"><caption class="sr-only">Count of candidates in each class per criterion</caption><thead><tr><th>Criterion</th>${used.map(k => `<th class="n">${esc(k.replace(/_/g, " "))}</th>`).join("")}</tr></thead><tbody>
      ${tab.map(([c, o]) => `<tr><td>${esc(labelOf(c))}</td>${used.map(k => `<td class="n ${o[k] ? A4_MM_CSS[k] : ""}">${o[k] || ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <dl class="p4-dl">${used.map(k => `<dt>${esc(k.replace(/_/g, " "))}</dt><dd>${esc(RG.MM_CLASSES[k])}</dd>`).join("")}</dl></div>`;
  }
  return h;
};
function a4MmChart(mm, ctb) {
  const W = 520, bh = 20, H = mm.length * (bh + 8) + 26, x0 = 150, sx = v => x0 + v * (W - x0 - 70);
  const th = S.app.thresholds;
  return `<figure class="p4-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="mm-t mm-d"><title id="mm-t">Criterion similarity and class</title>
    <desc id="mm-d">${mm.map(m => `${labelOf(m.criterion)}: ${m.similarity == null ? m.class.replace(/_/g, " ") : "s " + m.similarity.toFixed(2) + ", " + m.class}`).join("; ")}</desc>
    <line x1="${sx(th.partial)}" x2="${sx(th.partial)}" y1="14" y2="${H - 6}" class="grat"/><line x1="${sx(th.match)}" x2="${sx(th.match)}" y1="14" y2="${H - 6}" class="grat"/>
    <text x="${sx(th.partial)}" y="10" text-anchor="middle" class="ax">partial ${th.partial}</text><text x="${sx(th.match)}" y="10" text-anchor="middle" class="ax">match ${th.match}</text>
    ${mm.map((m, k) => { const y = 18 + k * (bh + 8); return `<text x="0" y="${y + 14}" class="ax">${esc(shortOf(m.criterion))}</text>${m.similarity == null
      ? `<rect x="${x0}" y="${y}" width="${W - x0 - 70}" height="${bh}" class="p4-na"/><text x="${x0 + 6}" y="${y + 14}" class="ax">${esc(m.class.replace(/_/g, " "))} — not compared</text>`
      : `<rect x="${x0}" y="${y}" width="${(sx(m.similarity) - x0).toFixed(1)}" height="${bh}" class="p4-b-${m.class}"/><text x="${(sx(m.similarity) + 5).toFixed(1)}" y="${y + 14}" class="ax">${m.similarity.toFixed(2)}${ctb[m.criterion] != null ? " · " + (100 * ctb[m.criterion]).toFixed(1) + " pts" : ""}</text>`}`; }).join("")}</svg>
    <figcaption class="meta small">Bar = criterion similarity s (0–1); label = its contribution to the score. Hatched rows are not compared, and never count as a match.</figcaption></figure>`;
}
A4_ACTIONS.mmsave = function (a) {
  const i = +a.dataset.i, t = a4T(A4.mm.target);
  a4SaveItem({ kind: "earth_cell", cell: S.cell[i], lat: S.lat[i], lon: S.lon[i], place: placeStr(i), target: t.id, note: `Mismatch Explorer · ${A4.mm.proxy ? "with" : "without"} proxies · profile ${S.app.profiles[A3.profile].label}`,
    snapshot: RG.snapshot(A4.ix, [t.id], { profile: A3.profile, weights: atWeights(), include_proxy: A4.mm.proxy, algorithm: S.app.algorithm_version }) });
};
Object.assign(A4_INPUTS, {
  mmc(a) { A4.mm.cell = a.value === "" ? null : +a.value; atRender(); },
  mmp(a) { A4.mm.proxy = a.checked; A4.mm.cell = null; atRender(); },
});
A3_INPUTS.mmt = function (a) { A4.mm.target = a.value; A4.mm.cell = null; atRender(); };
