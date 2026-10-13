/* ===== Phase II · Scientific Reproducibility Vault =====
 * Extends (does not replace) "Reproduce this result". Records are stored only in this browser
 * (localStorage, when available) and can be exported as self-describing JSON packages. */
L.vault = { a: null, b: null, msg: {}, importText: "" };
const REPLAYABLE = { robustness: "browser + Python", ablation: "browser + Python", requirements: "browser" };

async function verifyRecord(r) {
  const issues = [], ok = [];
  const cfg = { schema: r.schema, module: r.module, baseline: r.baseline, params: r.params };
  const id = (await LAB.sha256Hex(LAB.canonical(cfg))).slice(0, 16);
  (id === r.id ? ok : issues).push(id === r.id ? "Configuration hash matches record id." : `Configuration hash ${id} ≠ record id ${r.id} (record edited or corrupted).`);
  const oh = await LAB.sha256Hex(LAB.canonical(r.outputs));
  (oh === r.outputs_sha256 ? ok : issues).push(oh === r.outputs_sha256 ? "Stored outputs match their checksum." : "Stored outputs do not match their checksum.");
  const b = r.baseline || {};
  if (b.predictor_stack && b.predictor_stack.sha256 !== S.app.stack.sha256) issues.push(`Missing dependency: record needs predictor stack ${b.predictor_stack.sha256.slice(0, 12)}…; this app has ${S.app.stack.sha256.slice(0, 12)}…. Replay impossible here.`);
  else ok.push("Predictor stack available (SHA-256 matches).");
  if (b.algorithm_version !== S.app.algorithm_version) issues.push(`Algorithm version ${b.algorithm_version} ≠ ${S.app.algorithm_version}.`); else ok.push("Algorithm version matches.");
  if (b.phase2_version !== LAB.VERSION) issues.push(`Phase II version ${b.phase2_version} ≠ ${LAB.VERSION}; results may differ.`); else ok.push("Phase II version matches.");
  if (!REPLAYABLE[r.module]) issues.push(`Deterministic replay is not implemented for module “${r.module}”; re-run the module with the recorded parameters instead.`);
  return { ok, issues };
}
async function replayRecord(r) {
  const b = r.baseline;
  if (b.predictor_stack.sha256 !== S.app.stack.sha256) return { status: "BLOCKED", text: "Required predictor stack not available." };
  const toIdx = cells => cells.map(c => S.index[c]);
  let out;
  if (r.module === "robustness") {
    const cand = toIdx(r.params.candidates); if (cand.some(i => i < 0)) return { status: "BLOCKED", text: "A candidate cell is not in this stack." };
    L.busy = { label: "Replaying " + r.id, done: 0, total: 1, cancel: false }; labRender();
    const X = await robustCompute(b.target, b.weights, cand, r.params, (d, t) => { L.busy.done = d; L.busy.total = t; busyUpdate(); return !L.busy.cancel; });
    L.busy = null; if (!X) return { status: "CANCELLED", text: "Replay cancelled." };
    out = X.outputs;
  } else if (r.module === "ablation") out = ablationCompute(b.target, b.weights).outputs;
  else if (r.module === "requirements") {
    if (!L.ctx) await labCtx(); const reg = registry(), ctx = reqCtx(), cand = toIdx(r.params.candidates);
    out = { matrix: cand.map((i, k) => { const row = r.params.requirements.map(q => LAB.evaluateRequirement(q, i, reg, ctx)); return { cell: r.params.candidates[k], status: row.map(x => x.status), values: row.map(x => x.value) }; }) };
  } else return { status: "UNSUPPORTED", text: "Replay not implemented for this module." };
  const h = await LAB.sha256Hex(LAB.canonical(out));
  return h === r.outputs_sha256 ? { status: "REPRODUCED", text: "Replay reproduced the stored outputs exactly (SHA-256 " + h.slice(0, 16) + "…)." }
    : { status: "DIFFERS", text: "Replay outputs differ from the record (" + h.slice(0, 12) + "… vs " + r.outputs_sha256.slice(0, 12) + "…)." };
}
function diffObj(a, b, path = "", out = []) {
  if (LAB.canonical(a) === LAB.canonical(b)) return out;
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diffObj(a[k], b[k], path ? path + "." + k : k, out);
  } else out.push({ path, a: LAB.canonical(a), b: LAB.canonical(b) });
  return out;
}
function packageFor(r) {
  return JSON.stringify({ ...r, package: { schema: "asterro.experiment-package/1",
    instructions: ["1. Obtain the ASTERRO repository at the algorithm version in baseline.algorithm_version.",
      "2. Check that public/data/stack.bin has SHA-256 baseline.predictor_stack.sha256.",
      "3. Replay: python scripts/replay_experiment.py <this file> (robustness, ablation), or Lab → Vault → Import → Replay in the browser.",
      "4. A replay is reproduced when the canonical-JSON SHA-256 of the recomputed outputs equals outputs_sha256."],
    contains: "configuration, metadata, outputs and checksums only — no source data, no credentials" } }, null, 1);
}
LAB_VIEWS.vault = function () {
  const recs = L.records.slice().reverse();
  let storeOK = true; try { localStorage.setItem("asterro.test", "1"); localStorage.removeItem("asterro.test"); } catch (e) { storeOK = false; }
  let h = `<div class="sec"><h3 class="ttl">Scientific reproducibility vault</h3>
    <p class="note">Every Lab experiment is recorded with its full configuration (baseline target, weights, profile, normalisation, rules, data checksums, software versions), parameters, outputs and limitations. Records can be verified, replayed, compared and exported.</p>
    <p class="note small">Storage: ${storeOK ? "this browser only (localStorage) — export packages to keep or share them" : "<b>browser storage unavailable</b> — records exist only until this page is closed; export them"}. ${recs.length} record${recs.length === 1 ? "" : "s"}.</p></div>`;
  h += `<div class="sec"><div class="lbl">Records</div>${recs.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>ID</th><th>Module</th><th>Target · profile</th><th>Created (UTC)</th><th>Replay</th><th></th></tr></thead><tbody>
    ${recs.map(r => { const m = L.vault.msg[r.id]; return `<tr${L.vault.a === r.id || L.vault.b === r.id ? ' class="hl"' : ""}><td class="meta">${r.id}</td><td>${esc(r.module)}</td><td class="meta">${esc(r.baseline.target)} · ${esc(r.baseline.profile_label || r.baseline.profile)}</td><td class="meta">${esc(r.created_utc.replace("T", " ").slice(0, 19))}</td><td class="meta">${esc(REPLAYABLE[r.module] || "re-run module")}</td>
      <td><span class="row"><button class="btn-sm" data-lab="v-verify" data-id="${r.id}">Verify</button>${REPLAYABLE[r.module] ? `<button class="btn-sm" data-lab="v-replay" data-id="${r.id}">Replay</button>` : ""}<button class="btn-sm" data-lab="v-export" data-id="${r.id}">Export</button><button class="btn-sm" data-lab="v-pick" data-id="${r.id}">Compare</button></span>
      ${m ? `<div class="vault-msg">${m}</div>` : ""}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty">No records yet. Run an experiment in any Lab module.</div>`}</div>`;
  const A = L.records.find(r => r.id === L.vault.a), B = L.records.find(r => r.id === L.vault.b);
  if (A && B) {
    const dc = diffObj({ baseline: A.baseline, params: A.params }, { baseline: B.baseline, params: B.params });
    let outCmp = "";
    if (A.module === "robustness" && B.module === "robustness") {
      const mapB = new Map(B.outputs.cells.map((c, k) => [c, B.outputs.stats[k]]));
      outCmp = `<div class="tbl-wrap"><table class="t"><thead><tr><th>Cell</th><th>${A.id}</th><th>${B.id}</th></tr></thead><tbody>${A.outputs.cells.map((c, k) => { const sb = mapB.get(c), sa = A.outputs.stats[k]; return `<tr><td class="meta">${c}</td><td>${clsTag(sa.cls)} <span class="meta">med #${sa.median}</span></td><td>${sb ? clsTag(sb.cls) + ` <span class="meta">med #${sb.median}</span>` : '<span class="meta">not in B</span>'}</td></tr>`; }).join("")}</tbody></table></div>`;
    } else outCmp = `<p class="note small">Outputs ${A.outputs_sha256 === B.outputs_sha256 ? "are identical" : "differ"} (SHA-256 ${A.outputs_sha256.slice(0, 12)}… vs ${B.outputs_sha256.slice(0, 12)}…).</p>`;
    h += `<div class="sec"><div class="lbl">Baseline vs experiment · ${A.id} (${esc(A.module)}) ↔ ${B.id} (${esc(B.module)})<button class="btn-sm" data-lab="v-clear">Clear</button></div>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>Configuration field</th><th>${A.id}</th><th>${B.id}</th></tr></thead><tbody>${dc.length ? dc.slice(0, 40).map(d => `<tr><td class="meta">${esc(d.path)}</td><td class="meta">${esc(d.a.slice(0, 80))}</td><td class="meta">${esc(d.b.slice(0, 80))}</td></tr>`).join("") : `<tr><td colspan="3" class="meta">Configurations identical.</td></tr>`}</tbody></table></div>${outCmp}</div>`;
  } else if (A) h += `<div class="sec"><p class="note small">Selected ${A.id} for comparison — choose a second record.</p></div>`;
  const hist = {}; for (const r of L.records) (hist[r.module] = hist[r.module] || []).push(r);
  h += `<div class="sec"><div class="lbl">Configuration history</div>${Object.entries(hist).map(([m, rs]) => `<div class="cap">${esc(m)}</div><ol class="lab-ol">${rs.map((r, k) => { const d = k ? diffObj({ b: rs[k - 1].baseline.weights, t: rs[k - 1].baseline.target, p: rs[k - 1].params }, { b: r.baseline.weights, t: r.baseline.target, p: r.params }) : [];
      return `<li><span class="meta">${r.id} · ${esc(r.created_utc.slice(0, 19))}</span> ${k ? (d.length ? "changed: " + esc(d.map(x => x.path.replace(/^b\./, "weight ").replace(/^p\./, "").replace(/^t$/, "target")).slice(0, 6).join(", ")) : "same configuration") : "first record"}</li>`; }).join("")}</ol>`).join("") || `<p class="meta">—</p>`}</div>
    <div class="sec"><div class="lbl">Import a record or package</div><textarea class="lab-ta" rows="4" data-labin="v-imp" placeholder="Paste exported JSON">${esc(L.vault.importText)}</textarea><div class="row"><button class="btn-sm" data-lab="v-import">Import & verify</button>${L.vault.importMsg ? `<span class="meta">${esc(L.vault.importMsg)}</span>` : ""}</div></div>`;
  return h;
};
function fmtVerify(v) { return v.ok.map(x => `<span class="c-match">✓</span> ${esc(x)}`).concat(v.issues.map(x => `<span class="c-mismatch">✕</span> ${esc(x)}`)).join("<br>"); }
LAB_ACTIONS["v-verify"] = async a => { const r = L.records.find(x => x.id === a.dataset.id); L.vault.msg[r.id] = fmtVerify(await verifyRecord(r)); labRender(); };
LAB_ACTIONS["v-replay"] = async a => { const r = L.records.find(x => x.id === a.dataset.id); const v = await replayRecord(r); L.vault.msg[r.id] = `<span class="${v.status === "REPRODUCED" ? "c-match" : "c-mismatch"}">${v.status}</span> ${esc(v.text)}`; labRender(); };
LAB_ACTIONS["v-export"] = a => { const r = L.records.find(x => x.id === a.dataset.id); showExport("Experiment package " + r.id, packageFor(r), `asterro-experiment-${r.id}.json`); };
LAB_ACTIONS["v-pick"] = a => { const id = a.dataset.id; if (!L.vault.a || L.vault.b) { L.vault.a = id; L.vault.b = null; } else if (id !== L.vault.a) L.vault.b = id; labRender(); };
LAB_ACTIONS["v-clear"] = () => { L.vault.a = L.vault.b = null; labRender(); };
LAB_INPUTS["v-imp"] = a => { L.vault.importText = a.value; };
LAB_ACTIONS["v-import"] = async () => {
  let r; try { r = JSON.parse(L.vault.importText); } catch (e) { L.vault.importMsg = "Not valid JSON."; labRender(); return; }
  if (!r || r.schema !== "asterro.experiment/1" || !r.id) { L.vault.importMsg = "Not an ASTERRO experiment record."; labRender(); return; }
  delete r.package; const v = await verifyRecord(r);
  L.records = L.records.filter(x => x.id !== r.id); L.records.push(r); vaultSave();
  L.vault.msg[r.id] = fmtVerify(v); L.vault.importMsg = `Imported ${r.id}: ${v.issues.length ? v.issues.length + " issue(s)" : "verified"}.`; labRender();
};
