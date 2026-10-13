/* ===== Phase II · Planetary Evidence Graph =====
 * A provenance graph assembled ONLY from records the application actually holds: app.json
 * (datasets, criteria → earth_source), targets.json (values, status, methodology, sources),
 * the provenance manifest (raw files, scripts, checksums, verified / unverified lists), the
 * baseline breakdown of the selected cell, and vault records. No link is inferred from names. */
L.graph = { focus: "lst_diurnal_range", node: null, tgt: null };
const NODE_TYPES = ["Planetary target", "Environmental criterion", "Source dataset", "Dataset version", "Measurement", "Earth candidate",
  "Scoring configuration", "Analytical experiment", "Derived metric", "Evidence gap", "Research finding", "Reproducibility artifact"];
const UNKNOWN = "unknown";

function evBuildGraph(i, tid, focus) {
  const N = new Map(), E = [], ctx = L.ctx, man = ctx && ctx.manifest;
  const node = (id, type, label, meta = {}) => { if (!N.has(id)) N.set(id, { id, type, label, meta }); return id; };
  const edge = (from, to, type) => { if (N.has(from) && N.has(to)) E.push({ from, to, type }); };
  const T = S.T[tid], w = S.weights, det = ENG.detail(S.A, S.critIds, i, T.variables, w, S.ranges);
  const crits = focus === "all" ? S.critIds : [focus];
  const dsMeta = d => ({ provider: d.provider || UNKNOWN, product: d.dataset || UNKNOWN, version: d.version || UNKNOWN, url: d.url || UNKNOWN,
    temporal: d.temporal || UNKNOWN, resolution: d.resolution || UNKNOWN, units: d.units || UNKNOWN, license: d.license || UNKNOWN, processing: d.processing || UNKNOWN,
    "acquisition / retrieval date": d.id === "nasa_power" ? S.app.stack.retrieved.power : d.id === "modis_aqua_lst" ? S.app.stack.retrieved.modis : d.id === "gmted2010" ? S.app.stack.retrieved.gmted : UNKNOWN });
  const DS = Object.fromEntries(S.app.datasets.map(d => [d.id, d]));
  const tg = node("tgt:" + tid, "Planetary target", T.name, { body: T.body, location: `${T.location.lat}°, ${T.location.lon_east}°E`, window_km: T.location.window_km, note: T.location.note });
  const cand = node("cell:" + i, "Earth candidate", candShort(i), { cell_id: S.cell[i], centre: `${fmtLat(S.lat[i])} ${fmtLon(S.lon[i])}`, size_km: cellDims(i).map(x => x.toFixed(1)).join(" × ") });
  const stk = node("art:stack", "Reproducibility artifact", "Predictor stack (stack.bin)", { sha256: S.app.stack.sha256, bytes: S.app.stack.bytes, cells: S.app.stack.n_cells, verified_in_browser: S.hashOK === true ? "yes" : S.hashOK === false ? "MISMATCH" : "not checked" });
  const cfg = node("cfg", "Scoring configuration", currentLabel(), { weights: S.critIds.map(c => `${shortOf(c)} ${(+w[c]).toFixed(2)}`).join(", "), min_coverage: ENG.MIN_COVERAGE, algorithm: S.app.algorithm_version, normalization: "min–max over Earth ∪ targets (fixed)" });
  const res = node("res", "Research finding", `Baseline Analogue Score ${fmtPct(det.final, 2)}`, { target: T.name, rank: S.res.tid === tid ? "#" + S.res.rank[i] : "see target", coverage: pct(det.coverage), interpretation: T.interpretation });
  const repro = node("art:repro", "Reproducibility artifact", "Reproduce record + scripts/reproduce.py", { procedure: "python -m scripts.reproduce reproduce.json — verifies stack SHA-256, score, rank and top-3 distinct sites" });
  edge(cand, tg, "Compared against"); edge(res, cfg, "Depends on"); edge(res, repro, "Reproduced by"); edge(repro, stk, "Depends on");
  if (man) for (const f of man.raw_inputs) {
    const rid = node("raw:" + f.file, "Dataset version", f.file, { sha256: f.sha256 || UNKNOWN, bytes: f.bytes ?? UNKNOWN, produced_by: f.produced_by, script_sha256: f.script_sha256 });
    for (const d of f.datasets) if (DS[d]) { const dn = node("ds:" + d, "Source dataset", DS[d].provider.split(" - ")[0].split(";")[0], dsMeta(DS[d])); edge(rid, dn, "Derived from"); }
  }
  for (const c of crits) {
    const row = det.rows.find(r => r.c === c), cr = S.crit.find(x => x.id === c), st = T.status[c];
    const cn = node("crit:" + c, "Environmental criterion", labelOf(c), { unit: unitOf(c) || "index", weight: (+w[c]).toFixed(2), range: S.ranges[c].map(v => (+v).toFixed(3)).join(" … ") });
    for (const d of cr.earth_source) { if (!DS[d]) continue; node("ds:" + d, "Source dataset", DS[d].provider.split(" - ")[0].split(";")[0], dsMeta(DS[d])); edge(cn, "ds:" + d, "Measured by"); }
    const em = node("m:earth:" + c, "Measurement", `Earth ${shortOf(c)} = ${row.e == null ? "missing" : fmtVal(c, row.e) + " " + unitOf(c)}`, { value: row.e ?? "missing (NaN)", statistic: (ctx && ctx.catalog.requirement_variables[c] || {}).statistic || cr.label, category: row.e == null ? "UNAVAILABLE" : "MEASURED/DERIVED cell statistic" });
    edge(em, cand, "Measured by"); edge(em, stk, "Derived from");
    for (const d of cr.earth_source) edge(em, "ds:" + d, "Measured by");
    if (man) for (const f of man.raw_inputs) if (f.datasets.some(d => cr.earth_source.includes(d))) edge(stk, "raw:" + f.file, "Derived from");
    const tvNode = node("m:tgt:" + c, "Measurement", `${T.name} ${shortOf(c)} = ${T.variables[c] == null ? "N/A" : fmtVal(c, T.variables[c]) + " " + unitOf(c)}`, { value: T.variables[c] ?? "null (not applicable)", status: st, comparison: T.comparison[c], method: T.methodology[c] });
    edge(tvNode, tg, "Measured by");
    const mc = man && man.criteria.find(x => x.id === c);
    if (mc) for (const s of mc.targets[tid].sources) { const dn = node("ds:" + s.id, "Source dataset", DS[s.id] ? DS[s.id].provider.split(" - ")[0].split(";")[0] : s.id, DS[s.id] ? dsMeta(DS[s.id]) : { dataset: s.dataset, url: s.url }); edge(tvNode, dn, "Derived from"); }
    if (st !== "DIRECT") { const g = node("gap:" + c, "Evidence gap", st === "PROXY" ? `${shortOf(c)} target is a PROXY` : `${shortOf(c)} not applicable`, { status: st, rule: T.proxy_method[c] || T.methodology[c] }); edge(tvNode, g, "Limited by"); }
    if (row.active && row.s != null) {
      const sm = node("d:s:" + c, "Derived metric", `s(${shortOf(c)}) = ${row.s.toFixed(3)}`, { formula: "clip(1 − |e − t| / (max − min), 0, 1)", d: row.d.toFixed(4) });
      const km = node("d:k:" + c, "Derived metric", `contribution ${(100 * row.k).toFixed(1)} pts`, { formula: "w · s / Σw", w: row.w });
      edge(em, tvNode, "Compared against"); edge(sm, em, "Derived from"); edge(sm, tvNode, "Derived from"); edge(sm, cn, "Depends on");
      edge(km, sm, "Derived from"); edge(km, cfg, "Affected by"); edge(km, res, "Contributes to");
    } else if (row.active) { const g = node("gap:e:" + c, "Evidence gap", `Earth ${shortOf(c)} missing`, { effect: "criterion dropped; score renormalised; coverage " + pct(det.coverage) }); edge(em, g, "Limited by"); edge(res, g, "Limited by"); }
    if (c === "lst_diurnal_range" && tid === "moon_south_pole") {
      const d = T.raw_reference.diviner;
      const a = node("m:div:s", "Measurement", `Diviner summer ΔT ${d.summer.mean_dT_K.toFixed(1)} K`, { bins_valid: d.summer.bins_valid }), b = node("m:div:w", "Measurement", `Diviner winter ΔT ${d.winter.mean_dT_K.toFixed(1)} K`, { bins_valid: d.winter.bins_valid });
      edge(a, b, "Conflicts with"); edge(tvNode, a, "Derived from"); edge(tvNode, b, "Derived from");
    }
    if (c === "lst_diurnal_range" && tid === "mars_jezero") {
      const bins = T.raw_reference.meda_bins.map(b => b.ground_dr_K);
      const a = node("m:meda:lo", "Measurement", `MEDA Ls-bin ΔT min ${Math.min(...bins).toFixed(1)} K`, {}), b = node("m:meda:hi", "Measurement", `MEDA Ls-bin ΔT max ${Math.max(...bins).toFixed(1)} K`, {});
      edge(a, b, "Conflicts with"); edge(tvNode, a, "Derived from"); edge(tvNode, b, "Derived from");
    }
  }
  if (man) man.unverified.forEach((u, k) => { const g = node("gap:u" + k, "Evidence gap", "Unverified: " + u.split(";")[0].slice(0, 60), { statement: u }); edge(res, g, "Limited by"); });
  for (const r of L.records.filter(r => r.baseline && r.baseline.target === S.targetId && LAB.canonical(r.baseline.weights) === LAB.canonical(S.weights)).slice(-4)) {
    const x = node("exp:" + r.id, "Analytical experiment", `${r.module} · ${r.id}`, { created: r.created_utc, outputs_sha256: r.outputs_sha256.slice(0, 16) + "…", replay: r.replay });
    edge(x, cfg, "Depends on"); edge(x, "art:stack", "Depends on"); edge(x, node("art:vault", "Reproducibility artifact", "Vault record / replay", { procedure: "Lab → Vault → Replay; python scripts/replay_experiment.py <record.json>" }), "Reproduced by");
  }
  const rob = L.res.robust && L.res.robust.key === baseKey() && L.res.robust.tid === S.targetId ? L.res.robust : null, q = rob ? rob.cand.indexOf(i) : -1;
  if (q >= 0) {
    const f = node("find:robust", "Research finding", LAB.CLASS_LABEL[rob.st[q].cls], { median_rank: rob.st[q].median, range: `#${rob.st[q].min}–#${rob.st[q].max}`, configurations: rob.D.design.length, design: rob.D.name });
    const x = node("exp:" + rob.rec.id, "Analytical experiment", `robustness · ${rob.rec.id}`, { created: rob.rec.created_utc, outputs_sha256: rob.rec.outputs_sha256.slice(0, 16) + "…", replay: rob.rec.replay });
    edge(f, x, "Supported by"); edge(x, cfg, "Depends on"); edge(x, stk, "Depends on");
  }
  return { nodes: [...N.values()], edges: E };
}
function evGraphLayout(G) {
  const col = { "Source dataset": 0, "Dataset version": 1, "Reproducibility artifact": 1, "Planetary target": 2, "Earth candidate": 2, "Environmental criterion": 2,
    "Measurement": 3, "Scoring configuration": 3, "Derived metric": 4, "Analytical experiment": 4, "Research finding": 5, "Evidence gap": 5 };
  const cols = [[], [], [], [], [], []]; for (const n of G.nodes) cols[col[n.type]].push(n);
  const W = 740, colW = W / 6, rowH = 30, H = Math.max(...cols.map(c => c.length)) * rowH + 30, pos = {};
  cols.forEach((c, k) => c.forEach((n, q) => { pos[n.id] = { x: k * colW + 4, y: 20 + q * rowH * (H - 30) / Math.max(1, c.length * rowH) + 0 }; }));
  return { W, H, colW, pos };
}
const NODE_COL = { "Source dataset": "var(--earth)", "Dataset version": "var(--earth)", "Measurement": "var(--ink-2)", "Planetary target": "var(--accent)", "Earth candidate": "var(--ink)",
  "Environmental criterion": "var(--ink-2)", "Scoring configuration": "var(--ink-3)", "Derived metric": "var(--accent)", "Research finding": "var(--match)", "Evidence gap": "var(--mismatch)",
  "Analytical experiment": "var(--partial)", "Reproducibility artifact": "var(--ink-3)" };
function evUpstream(G, id) {
  const seen = new Set([id]), out = [], q = [id];
  /* edges point from the dependent node to its evidence, except "Contributes to" (contribution → result) */
  while (q.length) {
    const x = q.shift();
    for (const e of G.edges) {
      const nxt = e.type === "Contributes to" ? (e.to === x ? e.from : null) : (e.from === x ? e.to : (e.type === "Conflicts with" && e.to === x ? e.from : null));
      if (nxt != null && !seen.has(nxt)) { seen.add(nxt); out.push(e); q.push(nxt); }
    }
  }
  return { set: seen, edges: out };
}
function evGraphSVG(G, Ly, sel) {
  const up = sel ? evUpstream(G, sel) : null, on = id => !up || up.set.has(id);
  let g = ["Sources", "Files · artifacts", "Entities", "Values · config", "Derived · runs", "Findings · gaps"].map((t, k) => `<text x="${k * Ly.colW + 4}" y="10" font-size="8.5" fill="var(--ink-3)" letter-spacing=".1em">${t.toUpperCase()}</text>`).join("");
  for (const e of G.edges) {
    const a = Ly.pos[e.from], b = Ly.pos[e.to]; if (!a || !b) continue;
    const hl = up && up.edges.includes(e), x1 = a.x, y1 = a.y + 8, x2 = b.x + Ly.colW - 10, y2 = b.y + 8;
    const sx = x1 > x2 ? x1 : x1 + Ly.colW - 10, ex = x1 > x2 ? x2 : b.x;
    g += `<path d="M${sx},${y1} C${(sx + ex) / 2},${y1} ${(sx + ex) / 2},${y2} ${ex},${y2}" fill="none" stroke="${e.type === "Conflicts with" ? "var(--mismatch)" : e.type === "Limited by" ? "var(--partial)" : "var(--line-2)"}" stroke-width="${hl ? 1.8 : 1}" opacity="${up ? (hl ? 1 : 0.15) : 0.7}" ${e.type === "Conflicts with" ? 'stroke-dasharray="3 2"' : ""}><title>${esc(e.type)}</title></path>`;
  }
  for (const n of G.nodes) {
    const p = Ly.pos[n.id];
    g += `<g class="hov" data-lab="g-node" data-id="${esc(n.id)}" opacity="${on(n.id) ? 1 : 0.25}"><rect x="${p.x}" y="${p.y}" width="${Ly.colW - 10}" height="17" rx="2" fill="var(--panel-2)" stroke="${n.id === sel ? "var(--ink)" : NODE_COL[n.type]}" stroke-width="${n.id === sel ? 1.6 : 1}"/>
      <text x="${p.x + 4}" y="${p.y + 11.5}" font-size="8.5" fill="var(--ink)">${esc(n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label)}</text><title>${esc(n.type)}: ${esc(n.label)}</title></g>`;
  }
  return `<svg class="fp-svg" viewBox="0 0 ${Ly.W} ${Ly.H}" role="img" aria-label="Evidence graph">${g}</svg>`;
}
LAB_VIEWS.graph = function () {
  if (!S.res) return `<div class="sec"><div class="empty">Run the search first.</div></div>`;
  const i = labSel(); if (i == null) return `<div class="sec"><div class="empty">Select a site.</div></div>`;
  const tid = S.targetId === "cross" ? (L.graph.tgt || TARGET_IDS[0]) : S.targetId;
  if (!L.ctx) return `<div class="sec"><p class="meta">${L.ctxErr ? "Provenance manifest unavailable: " + esc(L.ctxErr) : "Loading provenance manifest…"}</p></div>`;
  const G = evBuildGraph(i, tid, L.graph.focus), Ly = evGraphLayout(G), sel = L.graph.node && G.nodes.find(n => n.id === L.graph.node) ? L.graph.node : "res";
  const n = G.nodes.find(x => x.id === sel), up = evUpstream(G, sel);
  let h = `<div class="sec"><h3 class="ttl">Planetary evidence graph</h3>
    <p class="note">Follow a result back to the data and calculations that support it. Built from the records the application holds; nothing is linked by name alone. Click a node to highlight its upstream lineage.</p>
    <div class="row"><span class="meta">Criterion</span><span class="toggles">${S.critIds.map(c => `<button aria-pressed="${L.graph.focus === c}" data-lab="g-focus" data-c="${c}">${esc(shortOf(c))}</button>`).join("")}<button aria-pressed="${L.graph.focus === "all"}" data-lab="g-focus" data-c="all">All</button></span>
    ${S.targetId === "cross" ? `<span class="toggles">${TARGET_IDS.map(t => `<button aria-pressed="${t === tid}" data-lab="g-t" data-t="${t}">${esc(TNAME[t])}</button>`).join("")}</span>` : ""}</div></div>
    <div class="sec">${evGraphSVG(G, Ly, sel)}<p class="note small">${G.nodes.length} nodes · ${G.edges.length} edges · red dashed = conflicting evidence · amber = limitation.</p></div>
    <div class="sec"><div class="lbl">${esc(n.type)}<span class="n">${esc(n.label)}</span></div>
    <div class="tbl-wrap"><table class="t"><tbody>${Object.entries(n.meta).map(([k, v]) => `<tr><td class="meta" style="width:150px">${esc(k)}</td><td${v === UNKNOWN ? ' class="meta"' : ""}>${esc(String(v))}</td></tr>`).join("") || `<tr><td class="meta">No metadata recorded.</td></tr>`}</tbody></table></div>
    <div class="cap" style="margin-top:10px">Upstream lineage (${up.edges.length} links)</div><ol class="lab-ol">${up.edges.map(e => `<li><button class="lnk" data-lab="g-node" data-id="${esc(e.from)}">${esc(G.nodes.find(x => x.id === e.from).label)}</button> <b>${esc(e.type.toLowerCase())}</b> <button class="lnk" data-lab="g-node" data-id="${esc(e.to)}">${esc(G.nodes.find(x => x.id === e.to).label)}</button></li>`).join("") || "<li class='meta'>No upstream evidence (a source).</li>"}</ol></div>
    <div class="sec"><div class="lbl">Node types</div><div class="chip-list">${NODE_TYPES.map(t => `<span class="tag" style="border-color:${NODE_COL[t]}">${esc(t)}</span>`).join("")}</div>
    <p class="note small">Unknown metadata is shown as “unknown”. Edge types used: measured by · derived from · compared against · contributes to · affected by · depends on · reproduced by · limited by · conflicts with · supported by.</p></div>`;
  return h;
};
LAB_ACTIONS["g-node"] = a => { L.graph.node = a.dataset.id; labRender(); };
LAB_ACTIONS["g-focus"] = a => { L.graph.focus = a.dataset.c; L.graph.node = null; labRender(); };
LAB_ACTIONS["g-t"] = a => { L.graph.tgt = a.dataset.t; L.graph.node = null; labRender(); };
