/* ===== Phase III · Research Copilot Workspace and Provenance =====
 * Copilot: the deterministic core answers only questions whose answer is a lookup in the evidence
 * index built from the atlas (values, statuses, readiness, provenance); anything else returns
 * "I cannot determine that from the available evidence." An OPTIONAL language-model mode (the
 * viewer's own Claude, via the artifact `sample` capability) may rephrase evidence; its answer is
 * shown only if it cites existing evidence ids, is screened by the Phase II guardrails, and is
 * labelled as drafted text. It never computes or changes a score. */
function atEvidenceIndex() {
  if (A3._evi) return A3._evi;
  const out = [];
  for (const t of A3.atlas.targets) {
    const first = t.name.split(" (")[0].split(" — ")[0].split(" / ")[0].toLowerCase(), g = t.anchor.gazetteer;
    const aliases = [...new Set([t.name.toLowerCase(), first, first.replace(/ crater$| basin$| region$/, ""), g && g.name.toLowerCase(), g && g.clean_name.toLowerCase()].filter(a => a && a.length > 3))];
    for (const c of S.critIds) {
      const s = t.status[c];
      out.push({ id: `${t.id}.${c}`, kind: "value", aliases, target: t.id, targetName: t.name.split(" (")[0], criterion: c, status: s,
        text: `${t.name}: ${labelOf(c)} ${s === "DIRECT" || s === "PROXY" ? "= " + atVal(c, t.values[c]) + " " : ""}(${s}; ${t.status_reason[c] || ""}).` });
    }
    out.push({ id: `${t.id}.readiness`, kind: "readiness", aliases, target: t.id, targetName: t.name.split(" (")[0], criterion: null, status: null,
      text: `${t.name} has readiness L${t.readiness.level} (${t.readiness.label}): ${t.readiness.direct} directly comparable criteria.` });
    out.push({ id: `${t.id}.location`, kind: "location", aliases, target: t.id, targetName: t.name.split(" (")[0], criterion: null, status: null,
      text: `${t.name} is at ${atFmtLL(t.anchor.lat, t.anchor.lon)} (${t.anchor.type}; ${t.anchor.source || "catalogue"}).` });
  }
  return (A3._evi = out);
}
let atSample;   // undefined = unresolved, null = unavailable
async function atSampleFn() {
  if (atSample === undefined) { try { atSample = window.claude && typeof window.claude.use === "function" ? await window.claude.use("sample") : null; } catch (e) { atSample = null; } }
  return atSample;
}
A3_VIEWS.copilot = function () {
  const C = A3.copilot;
  if (atSample === undefined) atSampleFn().then(atRender);
  return `<div class="sec"><h3 class="ttl">Research copilot workspace</h3>${atBanner("evidence-grounded assistant")}
    <p class="note">Ask about targets, values, statuses, readiness, gaps or locations. The deterministic core answers only from the evidence index (${atEvidenceIndex().length} entries) and cites every entry it used; it cannot compute scores, assess safety, cost or habitability, and says so.</p>
    <div class="lab-form"><label class="wide">Question<input type="text" data-a3in="cp-q" value="${esc(C.q)}" placeholder="e.g. What thermal evidence exists for Shackleton?"></label>
      <button class="btn-sm" data-a3="cp-ask">Ask (deterministic)</button>${atSample ? `<button class="btn-sm" data-a3="cp-llm">Ask with Claude (uses your usage)</button>` : ""}</div>
    <p class="meta">${atSample ? "Optional language-model mode available in this viewer." : "Language-model mode is not available here; the deterministic core is fully functional."}</p>
    <div class="row">${["What is missing for Elysium Planitia?", "What is the readiness of Gale Crater / Curiosity?", "What thermal evidence exists for Shackleton?", "Is Shackleton safe to land?"].map(q => `<button class="lnk small" data-a3="cp-ex" data-q="${esc(q)}">${esc(q)}</button>`).join(" · ")}</div></div>
    <div class="sec">${C.log.slice().reverse().map(m => `<div class="cp-turn"><div class="meta"><b>Q</b> ${esc(m.q)} <span class="tag">${esc(m.mode)}</span></div><div class="ev-text">${esc(m.a)}</div>
      ${m.cites && m.cites.length ? `<div class="meta">Evidence: ${m.cites.map(esc).join(" · ")}</div>` : ""}${m.flags && m.flags.length ? `<div class="meta st-u">Guardrail flags: ${m.flags.map(f => esc(f.match + " → " + f.prefer)).join("; ")}</div>` : ""}</div>`).join("") || `<p class="meta">No questions yet.</p>`}</div>`;
};
Object.assign(A3_ACTIONS, {
  "cp-ex"(a) { A3.copilot.q = a.dataset.q; A3_ACTIONS["cp-ask"](); },
  "cp-ask"() {
    const q = A3.copilot.q.trim(); if (!q) return;
    const r = ATL.copilotAnswer(q, atEvidenceIndex());
    A3.copilot.log.push({ q, a: r.text, cites: r.cites, mode: "deterministic", flags: LAB.reviewText(r.text) }); atRender();
  },
  async "cp-llm"() {
    const q = A3.copilot.q.trim(); if (!q || !atSample) return;
    const det = ATL.copilotAnswer(q, atEvidenceIndex());
    const ev = (det.cites.length ? atEvidenceIndex().filter(e => det.cites.includes(e.id)) : atEvidenceIndex().filter(e => e.kind === "readiness")).slice(0, 60);
    const entry = { q, a: "Thinking…", cites: [], mode: "language-model draft", flags: [] }; A3.copilot.log.push(entry); atRender();
    const prompt = `You answer questions about a planetary analogue atlas using ONLY the evidence entries below. Rules: cite the ids you use in square brackets, e.g. [moon_shackleton.slope]; never state a number that is not in an entry; never assess safety, certification, habitability, cost, travel or permits; if the entries do not answer the question, reply exactly: "${ATL.CANNOT}". Keep the answer under 120 words.\n\nQUESTION: ${q}\n\nEVIDENCE:\n${ev.map(e => `[${e.id}] ${e.text}`).join("\n")}`;
    try {
      const { text } = await atSample(prompt, { modelTier: "quick" });
      const ids = [...text.matchAll(/\[([a-z0-9_]+\.[a-z_]+)\]/g)].map(m => m[1]), valid = new Set(atEvidenceIndex().map(e => e.id));
      const ok = ids.length && ids.every(id => valid.has(id));
      entry.a = ok || text.trim().startsWith(ATL.CANNOT) ? text.trim() : ATL.CANNOT + " (The drafted answer did not cite valid evidence and was discarded.)";
      entry.cites = ok ? [...new Set(ids)] : []; entry.flags = LAB.reviewText(entry.a);
    } catch (e) { entry.a = e && e.code === "not_granted" ? "Language-model mode was not allowed; use the deterministic answer." : "Language-model mode failed (" + (e && e.code || "error") + "); the deterministic answer is unaffected."; if (e && e.code === "not_granted") atSample = null; }
    atRender();
  },
});
A3_INPUTS["cp-q"] = a => { A3.copilot.q = a.value; };

/* ---------- Provenance, compatibility and normalisation registry ---------- */
A3_VIEWS.provenance = function () {
  const A = A3.atlas;
  const fld = ["dataset", "product_id", "provider", "url", "doi", "version", "retrieved", "period", "crs", "resolution", "units", "processing", "quality_flags", "checksum", "license", "limitations"];
  const show = v => v == null ? "—" : typeof v === "object" ? JSON.stringify(v).slice(0, 400) : String(v);
  return `<div class="sec"><h3 class="ttl">Provenance and compatibility</h3>${atBanner("registry")}
    <p class="note">Atlas ${esc(A.version)} · built ${esc(A.built_utc)} · predictor stack ${esc(A.stack_sha256.slice(0, 16))}… · schema ${esc(A.schema)}</p></div>
    <div class="sec"><div class="lbl">Datasets (${Object.keys(A.datasets).length})</div>${Object.entries(A.datasets).map(([k, d]) => `<details class="lab-ev"><summary>${esc(k)} · ${esc(d.dataset)}</summary><dl class="at-dl">${fld.map(f => `<dt>${f}</dt><dd>${esc(show(d[f]))}</dd>`).join("")}</dl></details>`).join("")}</div>
    <div class="sec"><div class="lbl">Variable compatibility registry</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th><th>Earth definition</th><th>Planetary definition</th><th>Verdict</th></tr></thead><tbody>
      ${S.critIds.map(c => { const r = A.compatibility[c]; return `<tr><td>${esc(labelOf(c))}</td><td class="meta">${esc(r.earth)}</td><td class="meta">${esc(r.planet)}</td><td><span class="tag">${esc(r.verdict)}</span><div class="meta small">${esc(r.why)}</div></td></tr>`; }).join("")}</tbody></table></div>
      <div class="lbl">Recorded incompatible products</div><ul class="lab-ul">${A.incompatible_examples.map(x => `<li><b>${esc(x.product)}</b>: ${esc(x.reason)}</li>`).join("")}</ul></div>
    <div class="sec"><div class="lbl">Fingerprint statuses</div><div class="tbl-wrap"><table class="t"><tbody>${Object.entries(A.statuses).map(([k, v]) => `<tr><td>${atStatus(k)}</td><td class="meta">${esc(v)}</td><td class="n">${A.targets.reduce((n, t) => n + S.critIds.filter(c => t.status[c] === k).length, 0)}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="sec"><div class="lbl">Normalisation tables · ${esc(A.normalisation.id)}</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th><th class="n">baseline [min, max]</th><th class="n">atlas [min, max]</th></tr></thead><tbody>
      ${S.critIds.map(c => `<tr><td>${esc(labelOf(c))}</td><td class="n">${f3(A.normalisation.baseline_ranges[c][0])} … ${f3(A.normalisation.baseline_ranges[c][1])}</td><td class="n">${f3(A.normalisation.ranges[c][0])} … ${f3(A.normalisation.ranges[c][1])}</td></tr>`).join("")}</tbody></table></div>
      <p class="note small">${esc(A.normalisation.method)}. ${esc(A.normalisation.note)}</p></div>
    <div class="sec"><div class="lbl">Data files</div><div class="tbl-wrap"><table class="t"><tbody>${Object.entries(A.files).map(([k, f]) => `<tr><td>${esc(k)}</td><td class="mono">${esc(f.file)}</td><td class="mono meta">${esc((f.sha256 || "").slice(0, 16))}…</td><td class="meta">${esc(f.note || f.use || "")}</td></tr>`).join("")}</tbody></table></div>
      ${A.files.subcell ? `<p class="note small">Sub-cell check: mean slope recomputed from the histogram pass equals the baseline cell slope for ${nfmt(A.files.subcell.check.cells_compared)} cells (max |Δ| ${A.files.subcell.check.max_abs_diff_mean_slope_vs_baseline}).</p>` : ""}</div>`;
};
