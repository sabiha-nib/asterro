/* ===== Phase IV · Readiness & Provenance Center =====
 * Counts by readiness level (accessible chart + table), every record's checks, dataset records, the offline
 * regeneration result, and a machine-readable export (asterro.provenance-export/1) for any filter. */
function a4LevelChart(c) {
  const max = Math.max(1, ...c.byLevel, ...c.targetsByLevel), W = 360, bh = 16;
  const rows = [1, 2, 3, 4].map(k => `<g transform="translate(0,${(k - 1) * 2 * (bh + 6)})"><text x="0" y="${bh - 3}" class="ax">L${k}</text>
    <rect x="28" y="0" width="${(W - 80) * c.byLevel[k] / max}" height="${bh}" class="bar-l lvlf-${k}"/><text x="${34 + (W - 80) * c.byLevel[k] / max}" y="${bh - 3}" class="ax">${c.byLevel[k]} locations</text>
    <rect x="28" y="${bh + 2}" width="${(W - 80) * c.targetsByLevel[k] / max}" height="${bh}" class="bar-t lvlf-${k}"/><text x="${34 + (W - 80) * c.targetsByLevel[k] / max}" y="${2 * bh - 1}" class="ax">${c.targetsByLevel[k]} targets</text></g>`).join("");
  return `<figure class="p4-chart"><svg viewBox="0 0 ${W} ${4 * 2 * (bh + 6)}" role="img" aria-labelledby="lc-t lc-d"><title id="lc-t">Readiness levels</title><desc id="lc-d">${[1, 2, 3, 4].map(k => `L${k}: ${c.byLevel[k]} locations, ${c.targetsByLevel[k]} targets`).join("; ")}</desc>${rows}</svg>
    <figcaption class="meta small">Upper bar: locations (a location takes the best level of its targets). Lower bar: analytical targets. The table below carries the same numbers.</figcaption></figure>`;
}
A3_VIEWS.readiness = function () {
  const need = a4Need(); if (need) return need;
  const R = A4.reg, c = RG.counts(A4.ix), P = A4.prov;
  const lv = P.level === "" ? null : +P.level;
  const ts = R.targets.filter(t => lv == null || t.readiness.level === lv), ls = R.locations.filter(l => lv == null || l.readiness.level === lv);
  const focus = P.focus && (a4T(P.focus) || a4L(P.focus));
  let h = `<div class="sec"><h3 class="ttl">Readiness &amp; provenance</h3>${a4Banner("data readiness, checks and sources")}
    <p class="note">Readiness model ${esc(R.readiness_model.version)}: a record's level is the highest level whose checks — and every lower level's checks — pass. It describes data completeness and reproducibility, never scientific validity or mission safety.</p>
    <div class="grid2">${a4LevelChart(c)}<div class="tbl-wrap"><table class="t"><thead><tr><th>Level</th><th>Meaning</th><th class="n">Locations</th><th class="n">Targets</th></tr></thead><tbody>
      ${[1, 2, 3, 4].map(k => `<tr><td><span class="lvl lvl-${k}">L${k}</span></td><td class="small"><b>${esc(R.readiness_model.levels[k].label)}</b><br>${esc(R.readiness_model.levels[k].definition)}</td><td class="n">${c.byLevel[k]}</td><td class="n">${c.targetsByLevel[k]}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="lab-form"><label>Level<select data-a4in="provl"><option value="">all</option>${[1, 2, 3, 4].map(k => `<option value="${k}" ${String(P.level) === String(k) ? "selected" : ""}>L${k}</option>`).join("")}</select></label>
      <label>Export<select data-a4in="provk">${[["all", "targets + locations"], ["targets", "targets"], ["locations", "locations"]].map(([v, t]) => `<option value="${v}" ${P.kind === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <button class="btn-sm" data-a4="provexp">Export JSON (${P.kind === "locations" ? 0 : ts.length} targets, ${P.kind === "targets" ? 0 : ls.length} locations)</button></div></div>`;
  if (focus) h += `<div class="sec p4-focus"><div class="lbl">Focused record</div>${a4Record(focus, true)}</div>`;
  h += `<div class="sec"><div class="lbl">Analytical targets${lv == null ? "" : " at L" + lv} (${ts.length})</div>${ts.map(t => a4Record(t, false)).join("") || `<p class="meta">None at this level.</p>`}</div>
    <div class="sec"><div class="lbl">Checks used by the model</div><div class="tbl-wrap"><table class="t"><tbody>${R.readiness_model.checks.map(x => `<tr><td><span class="lvl lvl-${x.level}">L${x.level}</span></td><td class="mono small">${esc(x.id)}</td><td class="small">${esc(x.requirement)}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="sec"><div class="lbl">Dataset records (${R.datasets.length})</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Dataset</th><th>Provider · product · version</th><th>Resolution</th><th>Coverage · units · no-data</th><th>Licence</th><th>Retrieval · checksums</th></tr></thead><tbody>
      ${R.datasets.map(d => `<tr><td class="mono small">${esc(d.id)}</td><td class="small"><b>${esc(d.provider)}</b><br>${esc(d.product_id)} · ${esc(String(d.version).slice(0, 80))}<br><a href="${esc(d.url)}" target="_blank" rel="noopener">source ↗</a></td><td class="small">${esc(d.original_resolution)}<br><span class="meta">${esc(d.processing_resolution)}</span></td><td class="small">${esc(d.spatial_coverage || "—")}<br>${esc(d.temporal_coverage || "—")}<br><span class="meta">${esc(d.units || "—")} · no-data ${esc(d.nodata || "—")}</span></td><td class="small">${esc(d.license)}</td>
        <td class="small">${esc(d.retrieval_status)}${d.retrieved ? "<br>" + esc(d.retrieved) : "<br><span class=\"p4-bad\">retrieval date not recorded</span>"}<br><span class="meta">${esc(typeof d.checksums === "string" ? d.checksums : d.checksums ? JSON.stringify(d.checksums).slice(0, 120) : "no checksum recorded")}</span>${d.limitations ? `<br><span class="meta">Limitations: ${esc(String(d.limitations).slice(0, 200))}</span>` : ""}</td></tr>`).join("")}</tbody></table></div></div>
    ${a4OfflinePanel()}`;
  return h;
};
function a4Record(r, open) {
  const isT = r.record_type === "analytical_target";
  const rg = isT ? r.validation.regeneration : null;
  return `<details class="p4-rec" ${open ? "open" : ""}><summary><b>${esc(r.name)}</b> ${a4Level(r)} <span class="meta">${esc(r.record_type.replace("_", " "))}${isT ? " · " + esc(r.fingerprint.version) : ""}</span></summary>
    <ul class="p4-checks">${(r.readiness.checks || []).map(c => `<li class="${c.passed ? "ok" : "no"}"><b>${c.passed ? "✓" : "✗"} ${esc(c.id)}</b> — ${esc(c.detail)}</li>`).join("")}</ul>
    ${isT ? `<p class="small">Datasets: ${r.datasets.map(esc).join(", ")} · fingerprint SHA-256 <span class="mono">${esc(r.fingerprint.content_sha256.slice(0, 16))}…</span></p>
      <div class="tbl-wrap"><table class="t"><caption class="sr-only">Derivation of each criterion of ${esc(r.name)}</caption><thead><tr><th>Criterion</th><th>Status</th><th class="n">Value</th><th>From</th><th>Support</th><th class="n">regenerated |Δ|</th></tr></thead><tbody>
        ${S.critIds.map(c => { const fp = r.fingerprint, x = rg.criteria[c]; return `<tr><td>${esc(shortOf(c))}</td><td>${esc(fp.criterion_status[c])}</td><td class="n">${fp.variables[c] == null ? "—" : atVal(c, fp.variables[c])}</td><td class="small">${(fp.provenance[c] || []).map(esc).join(", ") || (fp.criterion_status[c] === "PROXY" ? "rule" : "—")}</td><td class="small">${esc(fp.spatial_support[c] || fp.missingness[c] || "—")}</td><td class="n">${x ? (x.abs_diff == null ? "failed" : x.abs_diff.toExponential(1)) : "—"}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="small">Offline regeneration: <b class="${rg.passed ? "st-d" : "st-m"}">${esc(rg.summary)}</b>${Object.entries(rg.criteria).map(([c, x]) => ` · ${esc(shortOf(c))} |Δ| ${x.abs_diff == null ? "—" : x.abs_diff.toExponential(1)} (tol ${x.tolerance})`).join("")}</p>
      <p class="small">Scripts: ${Object.entries(r.provenance.scripts).map(([p, h]) => `<span class="mono">${esc(p)}</span> <span class="meta">${esc(h.slice(0, 10))}…</span>`).join(" · ")}</p>
      <p class="small">Scoring: ${r.scoring.earth_analogue_enabled ? "enabled — " + esc(r.scoring.configs.join(", ")) : "exploratory partial only — " + esc(r.scoring.reason)}</p>
      <p class="small meta">${esc(r.validation.scientific_validation)}</p>` : `<p class="small">Source: ${r.source.url ? `<a href="${esc(r.source.url)}" target="_blank" rel="noopener">${esc(r.source.type)}</a>` : esc(r.source.type)} · ${esc(r.source.reference || "")}</p>`}</details>`;
}
Object.assign(A4_ACTIONS, {
  provexp() { const lv = A4.prov.level === "" ? null : +A4.prov.level; a4Download(`asterro_provenance${lv == null ? "" : "_L" + lv}.json`, Object.assign(RG.provenanceExport(A4.ix, { level: lv, kind: A4.prov.kind }), { exported_utc: a4Now() })); },
});
Object.assign(A4_INPUTS, {
  provl(a) { A4.prov.level = a.value; A4.prov.focus = null; atRender(); },
  provk(a) { A4.prov.kind = a.value; atRender(); },
});
