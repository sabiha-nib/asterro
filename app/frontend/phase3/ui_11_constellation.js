/* ===== Phase III · Knowledge Constellation =====
 * Typed nodes (dataset, target, criterion, Earth candidate) and only documented edges:
 *   dataset —provides→ target·criterion value   (atlas provenance)
 *   target —has status→ criterion               (atlas status table)
 *   target —ranks→ candidate                    (top 3 of the atlas comparison)
 * Layout is deterministic: one column per node type, rows in a fixed order. Position encodes the
 * node type and order only — distance and proximity carry no meaning. */
A3.kc = { body: "Mars", show: "status" };
A3_VIEWS.constellation = function () {
  const A = A3.atlas, ts = A.targets.filter(t => t.body === A3.kc.body);
  const ds = Object.keys(A.datasets).filter(d => ts.some(t => Object.values(t.provenance).flat().includes(d)) || (d === "gazetteer"));
  const cr = S.critIds;
  const cand = new Map();
  for (const t of ts) { const R = atCands(t, 3); if (R.eligible) R.top.forEach(i => { if (!cand.has(i)) cand.set(i, []); cand.get(i).push(t.id); }); }
  const cands = [...cand.keys()].sort((a, b) => S.cell[a] - S.cell[b]);
  const rowH = 17, W = 760, cols = [20, 210, 470, 600], H = Math.max(ds.length, ts.length, A3.kc.show === "status" ? Math.ceil(cr.length * 2.2) : cands.length) * rowH + 40;
  const Y = (k, n) => 30 + k * rowH + (H - 40 - n * rowH) / 2;
  const pos = {};
  ds.forEach((d, k) => pos["d:" + d] = [cols[0], Y(k, ds.length)]);
  ts.forEach((t, k) => pos["t:" + t.id] = [cols[1], Y(k, ts.length)]);
  cr.forEach((c, k) => pos["c:" + c] = [cols[2], Y(k * 2.2, cr.length * 2.2)]);
  cands.forEach((i, k) => pos["e:" + i] = [cols[3], Y(k, cands.length)]);
  const ST = { DIRECT: "var(--match)", PROXY: "var(--partial)", MISSING: "var(--ink-3)", INCOMPATIBLE: "var(--mismatch)", UNVALIDATED: "var(--mismatch)", DERIVED: "var(--ink)" };
  let edges = "";
  for (const t of ts) {
    const [x1, y1] = pos["t:" + t.id];
    if (A3.kc.show === "status") for (const c of cr) { const [x2, y2] = pos["c:" + c]; edges += `<path d="M${x1 + 150},${y1} C${x1 + 210},${y1} ${x2 - 60},${y2} ${x2},${y2}" stroke="${ST[t.status[c]]}" stroke-opacity="${t.status[c] === "DIRECT" ? 0.55 : 0.25}" fill="none" ${t.status[c] === "MISSING" ? 'stroke-dasharray="3 3"' : ""}><title>${esc(t.name)} — ${esc(labelOf(c))}: ${t.status[c]}</title></path>`; }
    for (const d of new Set(Object.values(t.provenance).flat())) if (pos["d:" + d]) { const [x0, y0] = pos["d:" + d]; edges += `<line x1="${x0 + 150}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="var(--earth)" stroke-opacity=".35"><title>${esc(d)} provides values for ${esc(t.name)}</title></line>`; }
    if (A3.kc.show === "cand") for (const [i, tids] of cand) if (tids.includes(t.id)) { const [x2, y2] = pos["e:" + i]; edges += `<line x1="${x1 + 150}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--accent)" stroke-opacity=".45"><title>${esc(t.name)} ranks ${esc(placeStr(i))} in its top 3</title></line>`; }
  }
  const node = (k, label, cls, title, act = "") => { const [x, y] = pos[k]; return `<g class="kc-n ${cls}" ${act}><circle cx="${x}" cy="${y}" r="4"/><text x="${x + 8}" y="${y + 3}">${esc(label.length > 24 ? label.slice(0, 23) + "…" : label)}</text><title>${esc(title)}</title></g>`; };
  const nodes = ds.map(d => node("d:" + d, d, "kd", A.datasets[d].dataset)).join("") +
    ts.map(t => node("t:" + t.id, t.name, "kt lvl-" + t.readiness.level, `${t.name} · L${t.readiness.level}`, `data-a3="pick" data-id="${t.id}" role="button" tabindex="0"`)).join("") +
    cr.map(c => node("c:" + c, labelOf(c), "kcr", A.compatibility[c].verdict + ": " + A.compatibility[c].why)).join("") +
    cands.map(i => node("e:" + i, candShort(i), "ke", placeStr(i) + " · top-3 for " + cand.get(i).map(id => atT(id).name).join(", "))).join("");
  return `<div class="sec"><h3 class="ttl">Knowledge constellation</h3>${atBanner("evidence map")}
    <p class="note">Every line is a documented relation from the atlas: provenance (dataset → target), criterion status (target → criterion) or ranking (target → Earth candidate, top 3 under the current profile and normalisation). <b>Columns encode node type; rows are a fixed order. Distance means nothing.</b></p>
    <div class="row"><span class="toggles">${["Mars", "Moon"].map(b => `<button aria-pressed="${A3.kc.body === b}" data-a3="kc-b" data-b="${b}">${b}</button>`).join("")}</span>
    <span class="toggles">${[["status", "criterion status"], ["cand", "Earth candidates"]].map(([k, v]) => `<button aria-pressed="${A3.kc.show === k}" data-a3="kc-s" data-s="${k}">${v}</button>`).join("")}</span></div></div>
    <div class="sec"><svg class="kc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Knowledge constellation for ${A3.kc.body}">
      <text x="${cols[0]}" y="14" class="kc-h">DATASETS</text><text x="${cols[1]}" y="14" class="kc-h">TARGETS</text><text x="${cols[2]}" y="14" class="kc-h">${A3.kc.show === "status" ? "CRITERIA" : ""}</text><text x="${cols[3]}" y="14" class="kc-h">${A3.kc.show === "cand" ? "EARTH CANDIDATES" : ""}</text>
      ${edges}${nodes.replace(/<g class="kc-n kcr"/g, A3.kc.show === "status" ? '<g class="kc-n kcr"' : '<g class="kc-n kcr" style="display:none"').replace(/<g class="kc-n ke"/g, A3.kc.show === "cand" ? '<g class="kc-n ke"' : '<g class="kc-n ke" style="display:none"')}</svg>
    <p class="note small">Edge colours: green DIRECT · amber PROXY · dashed grey MISSING · red INCOMPATIBLE / UNVALIDATED. Click a target to open it.</p></div>`;
};
Object.assign(A3_ACTIONS, { "kc-b"(a) { A3.kc.body = a.dataset.b; atRender(); }, "kc-s"(a) { A3.kc.show = a.dataset.s; atRender(); } });
