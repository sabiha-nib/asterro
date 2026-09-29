/* ===== 04 views: panels, charts, lists ===== */
const TNAME = { mars_jezero: "Jezero Crater", moon_south_pole: "Lunar South Pole", cross: "Cross-planet" };
const TBODY = { mars_jezero: "MARS", moon_south_pole: "MOON", cross: "MARS + MOON" };
const THUMB = { mars_jezero: "data/thumb_jezero_mola.png", moon_south_pole: "data/thumb_southpole_lola.png" };
const THUMB_CAP = { mars_jezero: "Scientific data · MOLA 463 m hillshade · 55.6 km window", moon_south_pole: "Scientific data · LOLA 118 m hillshade · polar stereographic" };
const GLYPH = { MATCH: "✓", PARTIAL: "△", MISMATCH: "×" };
const CLS = { MATCH: "c-match", PARTIAL: "c-partial", MISMATCH: "c-mismatch" };

function compTag(tid, c) {
  if (tid === "cross") return "";
  const t = S.T[tid], k = t.comparison[c] || "";
  if (k.startsWith("proxy")) return `<span class="tag proxy" title="${esc(t.methodology[c])}">Proxy</span>`;
  if (k.startsWith("not")) return `<span class="tag na" title="${esc(t.methodology[c])}">N/A</span>`;
  return `<span class="tag direct" title="${esc(t.methodology[c])}">Direct</span>`;
}

/* ---------------- charts ---------------- */
function radialSVG(rows, withSite, size = 300) {
  const n = rows.length, cx = size / 2, cy = size / 2 + 4, R = size * 0.34;
  const ang = k => -Math.PI / 2 + k * 2 * Math.PI / n, P = (k, r) => [cx + Math.cos(ang(k)) * R * r, cy + Math.sin(ang(k)) * R * r];
  let s = `<svg class="fp-svg" viewBox="0 0 ${size} ${size + 8}" role="img" aria-label="Radial fingerprint of normalized criterion values">`;
  for (const q of [0.25, 0.5, 0.75, 1]) s += `<polygon points="${rows.map((_, k) => P(k, q).join(",")).join(" ")}" style="fill:none;stroke:var(--line-2);stroke-width:${q === 1 ? 1 : .6}"/>`;
  rows.forEach((r, k) => {
    const [x, y] = P(k, 1.0), [lx, ly] = P(k, 1.2);
    s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" style="stroke:var(--line-2);stroke-width:.6${r.tn == null ? ';stroke-dasharray:3 3' : ''}"/>`;
    s += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" style="fill:var(--ink-3);font-size:9.5px;letter-spacing:.08em">${shortOf(r.c)}</text>`;
  });
  const poly = (key, stroke, fill, dash) => {
    const pts = rows.map((r, k) => r[key] == null ? null : P(k, clamp(r[key], 0, 1)));
    const ok = pts.filter(Boolean);
    return `<polygon points="${ok.map(p => p.join(",")).join(" ")}" style="fill:${fill};stroke:${stroke};stroke-width:1.6;${dash ? 'stroke-dasharray:4 3;' : ''}"/>` +
      ok.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="2.6" style="fill:${stroke}"/>`).join("");
  };
  s += poly("tn", "var(--accent)", "var(--accent);fill-opacity:.1");
  if (withSite) s += poly("en", "var(--ink)", "var(--ink);fill-opacity:.05", true);
  return s + `</svg>`;
}
function barsHTML(rows, withSite, tid) {
  return rows.map(r => {
    const t = r.tn == null ? "" : `<i class="tmark" style="left:${(clamp(r.tn, 0, 1) * 100).toFixed(1)}%"></i>`;
    const e = withSite && r.en != null ? `<i class="mark" style="left:${(clamp(r.en, 0, 1) * 100).toFixed(1)}%"></i>` : "";
    const fill = withSite && r.s != null ? `<i class="fill" style="width:${(r.s * 100).toFixed(1)}%;opacity:.28"></i>` : "";
    const v = withSite ? (r.s != null ? fmtPct(r.s, 0) : "N/A") : (r.t == null ? "N/A" : fmtVal(r.c, r.t) + " " + unitOf(r.c));
    return `<div class="cb"><span class="nm" title="${esc(labelOf(r.c))}">${esc(labelOf(r.c))}</span><div class="track">${fill}${t}${e}</div><span class="v">${v}</span></div>`;
  }).join("") + `<p class="note small">◇ target position${withSite ? " · | selected Earth cell · shaded bar = criterion similarity" : ""} · scale = normalization range (min–max of Earth cells ∪ targets).</p>`;
}
function matrixHTML(rows, withSite) {
  return `<div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th><th class="n">Target</th>${withSite ? '<th class="n">Earth</th><th class="n">|Δ| norm.</th><th class="n">s</th><th></th>' : '<th class="n">Norm.</th>'}</tr></thead><tbody>` +
    rows.map(r => {
      const cls = r.s != null ? ENG.classify(r.s) : null;
      return `<tr><td>${esc(shortOf(r.c))}</td><td class="n">${r.t == null ? "N/A" : fmtVal(r.c, r.t)}</td>` +
        (withSite ? `<td class="n">${fmtVal(r.c, r.e)}</td><td class="n">${r.d != null ? r.d.toFixed(3) : "—"}</td><td class="n">${r.s != null ? r.s.toFixed(3) : "—"}</td><td class="${cls ? CLS[cls] : ''}">${cls ? GLYPH[cls] : ''}</td>`
          : `<td class="n">${r.tn == null ? "—" : r.tn.toFixed(3)}</td>`) + `</tr>`;
    }).join("") + `</tbody></table></div>`;
}
function fingerprintBlock(tid, i) {
  if (tid === "cross") return `<p class="note">Cross-planet mode combines both fingerprints. Switch to a single target to view its fingerprint.</p>`;
  const withSite = i != null;
  const rows = withSite ? detailFor(tid, i).rows : S.critIds.map(c => { const t = S.T[tid].variables[c], R = S.ranges[c]; return { c, t, tn: t == null ? null : (t - R[0]) / (R[1] - R[0]) }; });
  const m = S.fpMode;
  const body = m === "radial" ? radialSVG(rows, withSite) : m === "bars" ? barsHTML(rows, withSite, tid) : matrixHTML(rows, withSite);
  const legend = m === "radial" ? `<p class="note small"><span style="color:var(--accent)">━</span> ${esc(TNAME[tid])} ${withSite ? '&nbsp; <span style="color:var(--ink)">┅</span> selected Earth cell' : ''} · radius = position in normalization range.</p>` : "";
  return `<div class="lbl">Planetary fingerprint${withSite ? " · target vs Earth" : ""}<span class="toggles" role="group" aria-label="Fingerprint view">
    ${["radial", "bars", "matrix"].map(k => `<button data-fp="${k}" aria-pressed="${m === k}">${k}</button>`).join("")}</span></div>${body}${legend}`;
}
function dnaSVG(i, tid) {
  const groups = [["CLIMATE", ["aridity", "annual_temperature_range"]], ["TERRAIN", ["elevation", "slope", "surface_roughness"]], ["THERMAL", ["lst_diurnal_range"]]];
  const W = 344, H = 132, bw = 34, gap = 12, ggap = 20, top = 16, h = 72;
  let x = 6, s = `<svg class="fp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Analogue DNA: normalized environmental values of the selected Earth cell">`;
  for (const [g, cs] of groups) {
    const gx = x;
    for (const c of cs) {
      const v = normOf(i, c), R = S.ranges[c];
      const tv = tid !== "cross" && S.T[tid].variables[c] != null ? (S.T[tid].variables[c] - R[0]) / (R[1] - R[0]) : null;
      s += `<rect x="${x}" y="${top}" width="${bw}" height="${h}" style="fill:var(--raise)"/>`;
      if (v === v) {
        const bh = clamp(v, 0, 1) * h;
        s += `<rect x="${x}" y="${(top + h - bh).toFixed(2)}" width="${bw}" height="${bh.toFixed(2)}" style="fill:var(--ink);opacity:.82"/>`;
        for (let b = 1; b < 12; b++) s += `<line x1="${x}" x2="${x + bw}" y1="${(top + b * h / 12).toFixed(2)}" y2="${(top + b * h / 12).toFixed(2)}" style="stroke:var(--panel);stroke-width:1.4"/>`;
      } else s += `<text x="${x + bw / 2}" y="${top + h / 2}" text-anchor="middle" style="fill:var(--ink-3);font-size:9px">N/A</text>`;
      if (tv != null) s += `<line x1="${x - 3}" x2="${x + bw + 3}" y1="${top + h - clamp(tv, 0, 1) * h}" y2="${top + h - clamp(tv, 0, 1) * h}" style="stroke:var(--accent);stroke-width:2"/>`;
      s += `<text x="${x + bw / 2}" y="${top + h + 13}" text-anchor="middle" style="fill:var(--ink-2);font-size:8.5px">${shortOf(c)}</text>`;
      s += `<text x="${x + bw / 2}" y="${top + h + 25}" text-anchor="middle" style="fill:var(--ink-3);font-size:8.5px">${fmtVal(c, S.A[c][i])}</text>`;
      x += bw + gap;
    }
    s += `<text x="${gx}" y="10" style="fill:var(--ink-3);font-size:8.5px;letter-spacing:.18em">${g}</text>`;
    x += ggap - gap;
  }
  return s + `</svg><p class="note small">Bars: this cell's values within Earth's normalization range (data only). <span style="color:var(--accent)">━</span> target level.</p>`;
}
function matchBlock(rows) {
  const b = { MATCH: [], PARTIAL: [], MISMATCH: [] };
  for (const r of rows) if (r.s != null) b[ENG.classify(r.s)].push(r);
  for (const k in b) b[k].sort((x, y) => y.s - x.s);
  const col = k => `<div><h5 class="${CLS[k]}">${k}</h5><ul>${b[k].length ? b[k].map(r => `<li><b class="${CLS[k]}">${GLYPH[k]}</b><span>${esc(labelOf(r.c))} <span class="meta">${fmtPct(r.s, 0)}</span></span></li>`).join("") : '<li class="none">none</li>'}</ul></div>`;
  const na = rows.filter(r => r.s == null && r.active === false && r.t == null);
  return `<div class="lbl">Match / mismatch<span class="meta">s ≥ ${S.app.thresholds.match} ✓ · ≥ ${S.app.thresholds.partial} △</span></div><div class="mm">${col("MATCH")}${col("PARTIAL")}${col("MISMATCH")}</div>` +
    (na.length ? `<p class="note small">Not applicable to this target: ${na.map(r => esc(labelOf(r.c))).join(", ")}.</p>` : "");
}
function radarSVG(rows, size = 220) {    // mismatch radar: criterion similarity s
  const act = rows.filter(r => r.s != null), n = act.length; if (n < 3) return "";
  const cx = size / 2, cy = size / 2, R = size * 0.36, P = (k, r) => [cx + Math.cos(-Math.PI / 2 + k * 2 * Math.PI / n) * R * r, cy + Math.sin(-Math.PI / 2 + k * 2 * Math.PI / n) * R * r];
  let s = `<svg class="fp-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Mismatch radar of criterion similarities">`;
  for (const q of [S.app.thresholds.partial, S.app.thresholds.match, 1]) s += `<polygon points="${act.map((_, k) => P(k, q).join(",")).join(" ")}" style="fill:none;stroke:${q === 1 ? 'var(--line-2)' : q === S.app.thresholds.match ? 'var(--match)' : 'var(--partial)'};stroke-width:.7;stroke-dasharray:${q === 1 ? '0' : '2 3'};opacity:.8"/>`;
  s += `<polygon points="${act.map((r, k) => P(k, r.s).join(",")).join(" ")}" style="fill:var(--accent);fill-opacity:.16;stroke:var(--accent);stroke-width:1.5"/>`;
  act.forEach((r, k) => { const [x, y] = P(k, r.s), [lx, ly] = P(k, 1.22), c = ENG.classify(r.s);
    s += `<circle cx="${x}" cy="${y}" r="3" style="fill:var(--${c === 'MATCH' ? 'match' : c === 'PARTIAL' ? 'partial' : 'mismatch'})"/><text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" style="fill:var(--ink-3);font-size:9px">${shortOf(r.c)} ${GLYPH[c]}</text>`; });
  return s + `</svg>`;
}
function contribTable(det, title = "Criterion breakdown") {
  return `<div class="lbl">${title}<span class="meta">Σ contributions = score</span></div><div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th><th class="n">Earth</th><th class="n">Target</th><th class="n">s</th><th class="n">w</th><th class="n">Contrib.</th></tr></thead><tbody>` +
    det.rows.map(r => `<tr${r.active ? "" : ' style="opacity:.45"'}><td>${esc(shortOf(r.c))} <span class="meta">${unitOf(r.c)}</span></td><td class="n">${fmtVal(r.c, r.e)}</td><td class="n">${r.t == null ? "N/A" : fmtVal(r.c, r.t)}</td><td class="n">${r.s != null ? r.s.toFixed(3) : "—"}</td><td class="n">${r.w.toFixed(2)}</td><td class="n">${r.k != null ? (100 * r.k).toFixed(2) + " pts" : "—"}</td></tr>`).join("") +
    `<tr class="hl"><td><b>Final score</b></td><td></td><td></td><td></td><td class="n">${det.wsum.toFixed(2)}</td><td class="n"><b>${(100 * det.final).toFixed(2)} pts</b></td></tr></tbody></table></div>`;
}
function qualityBlock(i, tid) {
  const q = dataQuality(i, tid);
  return `<div class="lbl">Data quality indicator<span class="meta">not a statistical confidence</span></div><div class="grid2">
    <div class="kv"><span>Weight coverage</span><b>${fmtPct(q.coverage, 0)}</b></div>
    <div class="kv"><span>MODIS month coverage</span><b>${fmtPct(q.modis, 0)}</b></div>
    <div class="kv"><span>Proxy variables</span><b>${q.proxies} of ${q.active} active</b></div>
    <div class="kv"><span>GMTED land fraction</span><b>${fmtPct(q.land, 0)}</b></div>
    <div class="kv" style="grid-column:1/3"><span>Spatial resolution</span><b>${q.res}</b></div>
    ${q.missing.length ? `<div class="kv" style="grid-column:1/3"><span>Missing at this cell</span><b style="color:var(--partial)">${q.missing.map(labelOf).join(", ")} — DATA NOT AVAILABLE (scored on remaining criteria)</b></div>` : ""}
  </div>`;
}
function evolutionSVG(ev) {
  const W = 330, H = 96, L = 30, Rr = 8, T = 10, B = 22, pts = ev.series.filter(p => p.score != null && p.score >= 0);
  if (pts.length < 2) return `<p class="note">DATA NOT AVAILABLE — fewer than two valid years.</p>`;
  const ys = pts.map(p => p.score * 100), lo = Math.floor(Math.min(...ys) - 1), hi = Math.ceil(Math.max(...ys) + 1);
  const X = y => L + (y - ev.series[0].year) / (ev.series[ev.series.length - 1].year - ev.series[0].year) * (W - L - Rr), Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  let s = `<svg class="fp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Analogue evolution: yearly similarity">`;
  for (const v of [lo, (lo + hi) / 2, hi]) s += `<line x1="${L}" x2="${W - Rr}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line);stroke-width:.7"/><text x="${L - 4}" y="${Y(v) + 3}" text-anchor="end" style="fill:var(--ink-3);font-size:8.5px">${v.toFixed(0)}%</text>`;
  const path = pts.map((p, k) => (k ? "L" : "M") + X(p.year).toFixed(1) + "," + Y(p.score * 100).toFixed(1)).join("");
  s += `<path d="${path} L${X(pts[pts.length - 1].year)},${H - B} L${X(pts[0].year)},${H - B}Z" style="fill:var(--accent);opacity:.12"/><path d="${path}" style="fill:none;stroke:var(--accent);stroke-width:1.6"/>`;
  pts.forEach((p, k) => s += `<circle cx="${X(p.year)}" cy="${Y(p.score * 100)}" r="${k === pts.length - 1 ? 3.2 : 2}" style="fill:var(--accent)"/>`);
  ev.series.forEach((p, k) => { if (k % 3 === 0 || k === ev.series.length - 1) s += `<text x="${X(p.year)}" y="${H - 7}" text-anchor="middle" style="fill:var(--ink-3);font-size:8.5px">${p.year}</text>`; });
  return s + `</svg>`;
}

/* ---------------- right rail ---------------- */
function renderRight() {
  const R = S.res, box = $("#right"); if (!R) { box.innerHTML = ""; return; }
  const prevPos = new Map(); if (S.prev && S.prev.tid === R.tid) S.prev.distinct.forEach((i, k) => prevPos.set(i, k));
  let h = `<div class="rail-head"><div class="lbl" style="margin:0 0 4px">Analogue field<span class="n">${esc(TNAME[R.tid])}</span></div>
    <div class="meta" title="Top ${R.distinct.length} distinct sites (≥ ${S.app.thresholds.distinct_sep_km} km apart) of ${R.nElig.toLocaleString()} ranked cells; Analogue Score under ${esc(currentLabel())}">${R.distinct.length} distinct sites ≥ ${S.app.thresholds.distinct_sep_km} km apart · ${R.nElig.toLocaleString()} ranked · under ${esc(currentLabel())}</div></div>`;
  R.distinct.forEach((i, k) => {
    const p = placeName(i); let mv = "";
    if (S.prev && S.prev.tid === R.tid) { const pk = prevPos.get(i); mv = pk == null ? '<span class="mv up">NEW</span>' : pk > k ? `<span class="mv up">▲${pk - k}</span>` : pk < k ? `<span class="mv dn">▼${k - pk}</span>` : ""; }
    let spark = "";
    if (R.tid === "cross") spark = TARGET_IDS.map(t => `<i style="--w:${(100 * clamp(R[t === TARGET_IDS[0] ? "rJ" : "rM"].eff[i], 0, 1)).toFixed(0)}%"></i>`).join("");
    else { const d = detailFor(R.tid, i).rows.filter(r => r.s != null); spark = d.map(r => `<i title="${esc(shortOf(r.c))} ${fmtPct(r.s, 0)}" style="--w:${(100 * r.s).toFixed(0)}%"></i>`).join(""); }
    h += `<button class="site" data-cell="${i}" aria-current="${S.selected === i}" id="site-${k}"><span class="rk">#${pad2(k + 1)}</span><span class="nm">${esc(p.primary)}</span><span class="sc">${fmtPct(R.eff[i])}</span>
      <span class="sub">${esc(p.secondary || "")} · ${fmtLat(S.lat[i])} ${fmtLon(S.lon[i])} · cell #${R.rank[i]}</span>${mv}<span class="spark">${spark}</span></button>`;
  });
  h += `<button class="btn-sm rail-more" data-railmore>${box.classList.contains("open") ? "Show top 6" : "Show all 20"}</button>`;
  box.innerHTML = h;
}

/* ---------------- left panel per tab ---------------- */
function targetBlock(tid) {
  if (tid === "cross") {
    return `<div class="sec"><div class="body-tag">MARS + MOON</div><h2 class="ttl" style="margin:4px 0 6px">Cross-planet analogues</h2>
      <p class="note">Score = min(S<sub>Jezero</sub>, S<sub>South Pole</sub>): a cell ranks high only if it resembles <b>both</b> targets on the selected criteria. No cell is called universally superior — see the Pareto set in Compare.</p></div>`;
  }
  const t = S.T[tid];
  return `<div class="sec"><div class="tgt-head"><img src="${THUMB[tid]}" alt="${esc(THUMB_CAP[tid])}"><div>
    <div class="body-tag">${t.body.toUpperCase()}</div><h2 class="ttl" style="margin:3px 0 4px">${esc(t.name)}</h2>
    <div class="meta">${fmtLat(t.location.lat)} ${fmtLon(t.location.lon_east)} · ${t.location.window_km} km window</div></div></div>
    <div class="cap" style="margin-top:6px">${esc(THUMB_CAP[tid])}</div></div>`;
}
function selectedHeader(i) {
  const R = S.res, p = placeName(i), pos = R.distinct.indexOf(i);
  return `<div class="lbl">${pos >= 0 ? "Analogue #" + pad2(pos + 1) : (S.picked === i ? "Picked location · reverse search" : "Earth cell")}<span class="meta">cell rank #${R.rank[i]?.toLocaleString() ?? "—"} / ${R.nElig.toLocaleString()}</span></div>
    <h3 class="ttl">${esc(p.primary)}</h3><div class="meta" style="margin:3px 0 10px">${esc(p.secondary || "")} · ${fmtLat(S.lat[i])} ${fmtLon(S.lon[i])} · under ${esc(currentLabel())}</div>
    <div class="row" style="justify-content:space-between;align-items:flex-end"><div class="big" style="color:var(--accent)">${fmtPct(R.eff[i])}<small title="Similarity under the current weighting profile — not physical, geological or engineering equivalence">ANALOGUE SCORE</small></div>
    <div class="row"><button class="btn-sm" data-act="trace">Trace result</button><button class="btn-sm" data-act="report">Report</button></div></div>`;
}
function viewExplore() {
  const tid = S.targetId, i = S.selected;
  let h = targetBlock(tid);
  h += `<div class="sec">${fingerprintBlock(tid, i)}</div>`;
  if (i == null) {
    h += `<div class="sec"><div class="empty">${S.searched ? "Select a site from the analogue field, or click anywhere on Earth to read its planetary analogue profile." : "Press <b>Search Earth</b> to compare every valid Earth cell against this fingerprint."}</div></div>`;
    return h;
  }
  h += `<div class="sec">${selectedHeader(i)}</div>`;
  if (tid !== "cross") {
    const det = detailFor(tid, i);
    h += `<div class="sec"><div class="lbl">Analogue DNA</div>${dnaSVG(i, tid)}</div>`;
    h += `<div class="sec">${matchBlock(det.rows)}</div>`;
  } else h += `<div class="sec">${crossSiteBlock(i)}</div>`;
  h += `<div class="sec">${qualityBlock(i, tid)}</div>`;
  return h;
}
function crossSiteBlock(i) {
  const pr = profileFor(i);
  return `<div class="lbl">Similarity to each target</div>` + pr.map(p => `<div class="cb"><span class="nm">${TNAME[p.tid]}</span><div class="track"><i class="fill" style="width:${(100 * clamp(p.score, 0, 1)).toFixed(1)}%"></i></div><span class="v">${fmtPct(p.score)}</span></div>`).join("") +
    `<p class="note small">Cross-planet score is the lower of the two (${fmtPct(Math.min(pr[0].score, pr[1].score))}).</p>`;
}
function viewCompare() {
  const tid = S.targetId, i = S.selected ?? S.picked;
  let h = "";
  if (i == null) return `<div class="sec"><div class="empty">Select an analogue or click Earth to compare it against the target.</div></div>` + (tid === "cross" ? crossPlot() : "");
  h += `<div class="sec">${selectedHeader(i)}</div>`;
  if (tid !== "cross") {
    const det = detailFor(tid, i);
    h += `<div class="sec">${fingerprintBlock(tid, i)}</div><div class="sec"><div class="lbl">Mismatch radar</div>${radarSVG(det.rows)}${matchBlock(det.rows)}</div><div class="sec">${contribTable(det)}</div>`;
  }
  const pr = profileFor(i);
  h += `<div class="sec"><div class="lbl">Planetary analogue profile · reverse search</div><p class="note small" style="margin:0 0 8px">This Earth cell compared against every planetary target under the current weights.</p>
    <table class="t"><thead><tr><th>Target</th><th class="n">Similarity</th><th class="n">Rank among Earth cells</th></tr></thead><tbody>
    ${pr.map(p => `<tr><td>${TNAME[p.tid]}</td><td class="n">${fmtPct(p.score)}</td><td class="n">${p.rank ? "#" + p.rank.toLocaleString() : "not ranked"}</td></tr>`).join("")}</tbody></table></div>`;
  if (tid === "cross") h += crossPlot();
  return h;
}
function crossPlot() {
  const pf = paretoFront();
  setTimeout(() => drawScatter(pf), 0);
  return `<div class="sec"><div class="lbl">Cross-planet analogues<span class="meta">${pf.count.toLocaleString()} cells ranked for both</span></div>
    <canvas class="plot" id="xplot" width="680" height="420" aria-label="Scatter of similarity to Jezero versus similarity to the Lunar South Pole"></canvas>
    <p class="note small">Each dot is one Earth cell. Highlighted: the Pareto set — cells for which no other cell is more similar to <b>both</b> targets.</p>
    <table class="t"><thead><tr><th>Pareto cell</th><th class="n">Jezero</th><th class="n">S. Pole</th></tr></thead><tbody>
    ${pf.front.slice(0, 10).map(i => `<tr><td><button class="linkish" data-cell="${i}">${esc(placeStr(i))}</button></td><td class="n">${fmtPct(pf.a[i])}</td><td class="n">${fmtPct(pf.b[i])}</td></tr>`).join("")}</tbody></table></div>`;
}
function drawScatter(pf) {
  const cv = $("#xplot"); if (!cv) return; const g = cv.getContext("2d"), W = cv.width, H = cv.height, L = 52, B = 44, T = 14, Rr = 14;
  const lo = 0.3, hi = 0.9, X = v => L + (v - lo) / (hi - lo) * (W - L - Rr), Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const css = getComputedStyle(document.documentElement), c = k => css.getPropertyValue(k).trim();
  g.clearRect(0, 0, W, H); g.font = "20px " + c("--f-mono"); g.fillStyle = c("--ink-3"); g.strokeStyle = c("--line");
  for (let v = 0.3; v <= 0.9001; v += 0.1) { g.beginPath(); g.moveTo(X(v), T); g.lineTo(X(v), H - B); g.moveTo(L, Y(v)); g.lineTo(W - Rr, Y(v)); g.stroke(); g.fillText((v * 100).toFixed(0), X(v) - 11, H - B + 24); g.fillText((v * 100).toFixed(0), L - 34, Y(v) + 7); }
  g.fillText("Jezero similarity (%) →", W - 300, H - 4); g.save(); g.translate(16, T + 230); g.rotate(-Math.PI / 2); g.fillText("South Pole similarity (%) →", 0, 0); g.restore();
  g.fillStyle = "rgba(164,174,185,.25)";
  const step = Math.max(1, Math.floor(S.n / 30000));
  for (let i = 0; i < S.n; i += step) if (pf.a[i] >= lo && pf.b[i] >= lo) g.fillRect(X(pf.a[i]) - 1, Y(pf.b[i]) - 1, 2, 2);
  g.fillStyle = c("--cross"); g.strokeStyle = c("--cross");
  g.beginPath(); pf.front.forEach((i, k) => { k ? g.lineTo(X(pf.a[i]), Y(pf.b[i])) : g.moveTo(X(pf.a[i]), Y(pf.b[i])); }); g.stroke();
  for (const i of pf.front) { g.beginPath(); g.arc(X(pf.a[i]), Y(pf.b[i]), 5, 0, 7); g.fill(); }
}
function viewScenarios() {
  const tid = S.targetId, i = S.selected ?? (S.res ? S.res.distinct[0] : null);
  let h = `<div class="sec"><div class="lbl">Mission profile</div><p class="note small" style="margin:0 0 8px">Each profile is a documented, editorial weight vector — not fitted to data. The weights are shown in full.</p>
    <div class="tbl-wrap"><table class="t"><thead><tr><th>Profile</th>${S.critIds.map(c => `<th class="n">${shortOf(c)}</th>`).join("")}<th></th></tr></thead><tbody>
    ${Object.entries(S.app.profiles).map(([pid, p]) => `<tr${S.profile === pid ? ' class="hl"' : ""}><td title="${esc(p.rationale)}">${esc(p.label)}</td>${S.critIds.map(c => `<td class="n">${(+p.weights[c]).toFixed(1)}</td>`).join("")}<td><button class="btn-sm${S.profile === pid ? " on" : ""}" data-profile="${pid}">${S.profile === pid ? "On" : "Use"}</button></td></tr>`).join("")}
    </tbody></table></div></div>`;
  h += `<div class="sec"><div class="lbl">What if?</div><div style="display:grid;gap:8px">
    ${WHATIF.map(wf => `<div class="whatif"><q>${esc(wf.label)}</q><div class="meta">${esc(wf.desc)}</div><div><button class="btn-sm" data-whatif="${wf.id}">Apply</button></div></div>`).join("")}</div></div>`;
  h += `<div class="sec" id="why">${whyBlock()}</div>`;
  if (i != null) {
    const st = stability(tid, i);
    h += `<div class="sec"><div class="lbl">Ranking stability · ${esc(placeStr(i))}</div><table class="t"><thead><tr><th>Profile</th><th class="n">Similarity</th><th class="n">Cell rank</th></tr></thead><tbody>
      ${st.map(r => `<tr${r.pid === S.profile ? ' class="hl"' : ""}><td>${esc(r.label)}</td><td class="n">${fmtPct(r.score)}</td><td class="n">${r.rank ? "#" + r.rank.toLocaleString() : "not ranked"}</td></tr>`).join("")}</tbody></table>
      <p class="note small">Scenario-specific ranks among all ${S.res.nElig.toLocaleString()} ranked cells. No universal score is formed from them.</p></div>`;
  }
  return h;
}
function whyBlock() {
  const P = S.prev, R = S.res;
  if (!P || P.tid !== R.tid) return `<div class="lbl">Why did this move?</div><div class="empty">Change a weight, a profile or apply a What-if. The engine will show exactly which weighted contributions moved each site.</div>`;
  const i = S.selected ?? R.distinct[0];
  const before = P.tid === "cross" ? null : detailFor(R.tid, i, P.w), after = R.tid === "cross" ? null : detailFor(R.tid, i, R.w);
  const rb = P.rank[i], ra = R.rank[i];
  let h = `<div class="lbl">Why did this move?<span class="meta">${esc(P.label)} → ${esc(currentLabel())}</span></div><h3 class="ttl" style="margin-bottom:8px">${esc(placeStr(i))}</h3>
    <div class="bfaf"><div class="b"><span>BEFORE</span><b>#${rb?.toLocaleString() ?? "—"}</b></div><div class="arr">→</div><div class="b"><span>AFTER</span><b style="color:var(--accent)">#${ra?.toLocaleString() ?? "—"}</b></div>
    <div class="b" style="margin-left:auto;text-align:right"><span>SCORE</span><b style="font-size:22px">${fmtPct(P.eff[i])} → ${fmtPct(R.eff[i])}</b></div></div>`;
  if (before && after) {
    const rows = S.critIds.map(c => { const b = before.rows.find(r => r.c === c), a = after.rows.find(r => r.c === c); return { c, d: 100 * ((a.k || 0) - (b.k || 0)), wb: b.w, wa: a.w }; });
    const total = 100 * (after.final - before.final);
    h += `<table class="t" style="margin-top:10px"><thead><tr><th>Criterion</th><th class="n">Weight</th><th class="n">Contribution change</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${esc(labelOf(r.c))}</td><td class="n">${r.wb.toFixed(2)} → ${r.wa.toFixed(2)}</td><td class="n ${r.d > 0.005 ? "pos" : r.d < -0.005 ? "neg" : ""}">${fmtPts(r.d)}</td></tr>`).join("")}
      <tr class="hl"><td><b>Overall change</b></td><td></td><td class="n"><b>${fmtPts(total)}</b></td></tr></tbody></table>
      <p class="note small">Contributions are w·s / Σw. Raising one weight also dilutes every other criterion's share, which is why unchanged criteria can move.</p>`;
  }
  // biggest movers in the new top 20
  const mv = R.distinct.map((c, k) => ({ c, k, pk: P.distinct.indexOf(c) })).filter(m => m.pk !== m.k).slice(0, 5);
  if (mv.length) h += `<div class="lbl" style="margin-top:12px">Top-20 movement</div>` + mv.map(m => `<div class="meta">#${pad2(m.k + 1)} ${esc(placeStr(m.c))} — ${m.pk < 0 ? "new entry" : "was #" + pad2(m.pk + 1)}</div>`).join("");
  return h;
}
function viewDiscover() {
  const R = S.res; if (!R) return "";
  let h = `<div class="sec"><div class="lbl">Analogue constellations<span class="meta">top ${S.app.thresholds.n_candidates} cells · k-means</span></div>`;
  if (!R.clusters) h += `<div class="meta">Clustering…</div>`;
  else {
    h += `<p class="note small" style="margin:0 0 6px">k = ${R.clusters.k} chosen by silhouette (${R.clusters.silhouette.toFixed(3)}). Names are generated from cluster means with fixed thresholds (UNEP aridity classes, mean T2M, slope, elevation).</p>`;
    for (const G of R.clusters.groups) h += `<button class="cluster" data-cluster="${G.rankNo - 1}" aria-pressed="${S.clusterFocus === G.rankNo - 1}"><span class="id" style="color:${CLUSTER_COLORS[G.rankNo - 1]}">${pad2(G.rankNo)}</span>
      <span><span class="nm">${esc(G.name)}</span><br><span class="ct">${G.members.length} cells · ${Math.round(G.area).toLocaleString()} km² · mean ${fmtPct(G.stats.score)} · ${G.countries.map(c => esc(c[0])).join(", ")}</span></span>
      <span class="sw" style="background:${CLUSTER_COLORS[G.rankNo - 1]}"></span></button>`;
  }
  h += `</div><div class="sec"><div class="lbl">Planetary analogue graph</div>${graphSVG()}</div>`;
  h += `<div class="sec"><div class="lbl">Where candidates fall · latitude</div>${latHist()}</div>`;
  const i = S.selected;
  if (i != null) {
    const ev = evolution(S.targetId, i);
    h += `<div class="sec"><div class="lbl">Analogue evolution · ${esc(placeStr(i))}<span class="n">${ev.cls}</span></div>${evolutionSVG(ev)}
      <p class="note small">Only the thermal criterion varies by year (MODIS ${S.app.stack.years[0]}–${S.app.stack.years[S.app.stack.years.length - 1]}); climate and terrain use their fixed climatologies. STABLE if the yearly score range ≤ ${S.app.thresholds.evolution_stable_pts} pts (here ${ev.rangePts == null ? "—" : ev.rangePts.toFixed(2) + " pts"}).</p></div>`;
  }
  return h;
}
function graphSVG() {
  const w = S.weights, a = simFor(TARGET_IDS[0], w), b = simFor(TARGET_IDS[1], w);
  const oa = ENG.order(a.eff, S.cell), ob = ENG.order(b.eff, S.cell);
  const da = ENG.distinctSites(oa, S.lat, S.lon, 5, 300), db = ENG.distinctSites(ob, S.lat, S.lon, 5, 300);
  const nodes = Array.from(new Set([...da, ...db])).sort((x, y) => (a.eff[y] - b.eff[y]) - (a.eff[x] - b.eff[x]) || S.cell[x] - S.cell[y]);
  const W = 344, H = 40 + nodes.length * 26, xa = 22, xb = W - 22, xm = W / 2;
  let s = `<svg class="fp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Graph linking planetary targets to Earth cells by computed similarity">`;
  const ya = H / 2, yb = H / 2;
  nodes.forEach((i, k) => {
    const y = 24 + k * 26;
    for (const [x0, r] of [[xa, a], [xb, b]]) { const v = r.eff[i]; if (v < 0) continue; const wdt = 0.5 + Math.max(0, v - 0.5) * 14; s += `<path d="M${x0},${ya} C${(x0 + xm) / 2},${ya} ${(x0 + xm) / 2},${y} ${xm + (x0 < xm ? -62 : 62)},${y}" style="fill:none;stroke:${x0 < xm ? 'var(--mars)' : 'var(--moon)'};stroke-width:${wdt.toFixed(2)};opacity:${(0.25 + Math.max(0, v - 0.5) * 1.6).toFixed(2)}"/>`; }
    s += `<rect x="${xm - 62}" y="${y - 9}" width="124" height="18" rx="2" style="fill:var(--panel-2);stroke:var(--line-2)"/><text x="${xm}" y="${y + 3.5}" text-anchor="middle" style="fill:var(--ink);font-size:8.6px">${esc(placeName(i).primary.slice(0, 22))}</text>`;
    s += `<text x="${xm - 66}" y="${y + 3}" text-anchor="end" style="fill:var(--mars);font-size:8px">${(100 * a.eff[i]).toFixed(0)}</text><text x="${xm + 66}" y="${y + 3}" style="fill:var(--moon);font-size:8px">${(100 * b.eff[i]).toFixed(0)}</text>`;
  });
  s += `<circle cx="${xa}" cy="${ya}" r="9" style="fill:var(--mars)"/><text x="${xa}" y="${ya - 14}" text-anchor="middle" style="fill:var(--mars);font-size:8.5px">JEZERO</text>`;
  s += `<circle cx="${xb}" cy="${yb}" r="9" style="fill:var(--moon)"/><text x="${xb}" y="${yb - 14}" text-anchor="middle" style="fill:var(--moon);font-size:8.5px">S. POLE</text>`;
  return s + `</svg><p class="note small">Nodes: top-5 distinct sites for each target. Edge width and opacity ∝ computed similarity (% shown). Current weights.</p>`;
}
function latHist() {
  const R = S.res, cand = R.order.slice(0, S.app.thresholds.n_candidates), bins = 18, all = new Array(bins).fill(0), top = new Array(bins).fill(0);
  let area = 0; const aB = new Array(bins).fill(0);
  for (let i = 0; i < S.n; i++) { const b = clamp(Math.floor((S.lat[i] + 90) / 10), 0, bins - 1); aB[b] += cellArea(i); area += cellArea(i); }
  let tA = 0; for (const i of cand) { const b = clamp(Math.floor((S.lat[i] + 90) / 10), 0, bins - 1); top[b] += cellArea(i); tA += cellArea(i); }
  const W = 344, H = 150, L = 34, BW = (W - L - 6) / bins, mx = Math.max(...aB.map(v => v / area), ...top.map(v => v / tA));
  let s = `<svg class="fp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Latitude distribution of candidate area versus all valid land area">`;
  for (let b = 0; b < bins; b++) {
    const x = L + b * BW, h1 = aB[b] / area / mx * (H - 34), h2 = top[b] / tA / mx * (H - 34);
    s += `<rect x="${x + 1}" y="${H - 20 - h1}" width="${BW - 2}" height="${h1}" style="fill:var(--line-2)"/><rect x="${x + 3.5}" y="${H - 20 - h2}" width="${BW - 7}" height="${h2}" style="fill:var(--accent)"/>`;
    if (b % 3 === 0) s += `<text x="${x}" y="${H - 6}" style="fill:var(--ink-3);font-size:8.5px">${-90 + b * 10}°</text>`;
  }
  const empty = aB.map((v, b) => v / area > 0.02 && top[b] === 0 ? (-90 + b * 10) + "°…" + (-80 + b * 10) + "°" : null).filter(Boolean);
  return s + `</svg><p class="note small"><span style="color:var(--ink-3)">▮</span> share of valid land area &nbsp;<span style="color:var(--accent)">▮</span> share of top-${S.app.thresholds.n_candidates} candidate area. ${empty.length ? "Latitude bands with ≥2 % of land but no candidates: " + empty.join(", ") + "." : ""}</p>`;
}
function viewData() {
  const A = S.app;
  let h = `<div class="sec"><div class="lbl">Predictor stack</div><div class="grid2">
    <div class="kv"><span>Valid Earth cells</span><b>${A.stack.n_cells.toLocaleString()}</b></div><div class="kv"><span>Grid</span><b>0.5° × 0.625° (MERRA-2)</b></div>
    <div class="kv"><span>Bundle SHA-256</span><b>${A.stack.sha256.slice(0, 16)}… ${S.hashOK === true ? '<span style="color:var(--match)">✓ verified in this browser</span>' : S.hashOK === false ? '<span style="color:var(--mismatch)">× mismatch</span>' : '<span class="meta">not checked</span>'}</b></div><div class="kv"><span>Algorithm</span><b>${A.algorithm_version}</b></div>
    <div class="kv"><span>POWER retrieved</span><b>${A.stack.retrieved.power}</b></div><div class="kv"><span>MODIS retrieved</span><b>${A.stack.retrieved.modis}</b></div></div>
    <p class="note small">Valid cell = GMTED2010 land ≥ 50 % AND MODIS LST diurnal range available AND NASA POWER T2M available. The same float32 values drive the Python reference engine and this browser (bitwise-identical scores, tested).</p></div>`;
  h += `<div class="sec"><div class="lbl">Data sources</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Dataset</th><th>Role</th><th>Resolution · coverage</th><th>Processing</th><th>Terms</th></tr></thead><tbody>
    ${A.datasets.map(d => `<tr><td><b>${esc(d.provider)}</b><br><span class="meta">${esc(d.dataset)} · ${esc(d.version)}</span><br><a href="${esc(d.url)}" target="_blank" rel="noopener" class="meta" style="color:var(--earth)">source ↗</a></td><td>${esc(d.role)}</td><td class="meta">${esc(d.resolution)}<br>${esc(d.temporal)}<br>${esc(d.units)}</td><td class="meta">${esc(d.processing)}</td><td class="meta">${esc(d.license)}</td></tr>`).join("")}</tbody></table></div></div>`;
  h += `<div class="sec"><div class="lbl">Normalization ranges<span class="meta">min–max over Earth cells ∪ targets</span></div><table class="t"><thead><tr><th>Criterion</th><th class="n">Min</th><th class="n">Max</th><th>Unit</th></tr></thead><tbody>
    ${S.critIds.map(c => `<tr><td>${esc(labelOf(c))}</td><td class="n">${S.ranges[c][0].toFixed(3)}</td><td class="n">${S.ranges[c][1].toFixed(3)}</td><td class="meta">${esc(unitOf(c) || "index")}</td></tr>`).join("")}</tbody></table></div>`;
  for (const t of S.targets) {
    h += `<div class="sec"><div class="lbl">Target construction · ${esc(t.name)}</div><table class="t"><thead><tr><th>Criterion</th><th class="n">Value</th><th>Method</th></tr></thead><tbody>
      ${S.critIds.map(c => `<tr><td>${esc(shortOf(c))}<br>${compTag(t.id, c)}</td><td class="n">${t.variables[c] == null ? "N/A" : fmtVal(c, t.variables[c])}</td><td class="meta">${esc(t.methodology[c])}</td></tr>`).join("")}</tbody></table>
      <p class="note small"><b>Limitations:</b> ${t.limitations.map(esc).join(" ")}</p>
      <p class="note small"><b>Sources:</b> ${t.sources.map((s, k) => `<a href="${esc(t.source_urls[k])}" target="_blank" rel="noopener" style="color:var(--earth)">${esc(s)}</a>`).join(" · ")}</p></div>`;
  }
  h += `<div class="sec"><div class="lbl">Result tools</div><div class="row"><button class="btn-sm" data-act="trace">Trace selected result</button><button class="btn-sm" data-act="reproduce">Reproduce this result</button><button class="btn-sm" data-act="report">Analogue analysis report</button></div></div>`;
  return h;
}
function viewMethod() {
  const th = S.app.thresholds;
  return `<div class="sec"><div class="lbl">Method</div><h2 class="ttl" style="margin-bottom:8px">Compare fingerprints, not pictures.</h2>
  <p class="note">Every valid Earth cell is compared against a planetary target on measurable criteria. The result is a deterministic weighted, range-normalized similarity. No language model, learned model or generated media computes, alters, ranks or explains any number here.</p>
  <div class="flow" style="margin-top:12px"><div><b>NASA data</b>POWER · MODIS · GMTED · MOLA · LOLA · MEDA · Diviner</div><div><b>Normalize</b>|e − t| ÷ (max − min)</div><div><b>Weights</b>profile or custom</div><div><b>Similarity</b>Σ w·s ÷ Σ w</div><div><b>Result</b>rank · cluster · explain</div></div></div>
  <div class="sec"><div class="lbl">Similarity mathematics</div><div class="formula">d<sub>c</sub> = |e<sub>c</sub> − t<sub>c</sub>| / (max<sub>c</sub> − min<sub>c</sub>)
s<sub>c</sub> = clip(1 − d<sub>c</sub>, 0, 1)
k<sub>c</sub> = w<sub>c</sub> · s<sub>c</sub> / Σ w      (weighted contribution)
S   = Σ k<sub>c</sub>                (final score, 0…1)</div>
  <p class="note small">Criteria with weight 0 or a null target (not applicable) are excluded. A cell missing an Earth value is scored on the remaining criteria and its weight coverage is reported; coverage &lt; ${fmtPct(th.min_coverage, 0)} → not ranked. Exact match ⇒ S = 1.0 (tested). Ranking ties break by cell id.</p></div>
  <div class="sec"><div class="lbl">Documented rules</div><table class="t"><tbody>
    <tr><td>Match / Partial / Mismatch</td><td class="meta">s ≥ ${th.match} / s ≥ ${th.partial} / below</td></tr>
    <tr><td>Distinct sites</td><td class="meta">greedy: keep a ranked cell only if ≥ ${th.distinct_sep_km} km from every kept site</td></tr>
    <tr><td>Constellations</td><td class="meta">top ${th.n_candidates} cells; k-means, farthest-point init, k ∈ {${th.k_choices.join(", ")}} by silhouette; names from cluster means</td></tr>
    <tr><td>Cross-planet</td><td class="meta">min(S<sub>Jezero</sub>, S<sub>South Pole</sub>); Pareto set shown</td></tr>
    <tr><td>Analogue evolution</td><td class="meta">yearly MODIS LST substituted; STABLE if score range ≤ ${th.evolution_stable_pts} pts</td></tr>
    <tr><td>Elevation proxy</td><td class="meta">target = highest valid Earth cell (${S.T.mars_jezero.variables.elevation} m): rewards thinnest atmosphere</td></tr></tbody></table></div>
  <div class="sec"><div class="lbl">Scientific comparability</div><p class="note">This Earth location exhibits similar values <b>for the selected modeled variables</b>. It is never physically identical to Mars or the Moon: gravity (0.38 g / 0.17 g), atmosphere and pressure (Mars ~0.74 kPa median at Jezero from MEDA; Moon ~vacuum), radiation, geology and mineralogy, day length, and spatial scale (rover-point and 55.6 km windows vs 0.5° cells) are not modelled. Proxy criteria are labelled wherever they appear.</p>
  <div class="callout" style="margin-top:10px">This system identifies environmental analogues using selected measurable variables. A high similarity score does not establish geological equivalence, engineering suitability, habitability, safety, or mission-site certification.</div></div>
  <div class="sec"><div class="lbl">Build & media</div><p class="note small">Data ingestion ran in a Higgsfield cloud sandbox with direct access to NASA/USGS/PDS servers; every relayed file was checked by SHA-256. Higgsfield's generative media layer is intentionally not used for any scientific value. No generated imagery appears in this build: the target thumbnails are hillshades of the actual MOLA and LOLA elevation data, and the basemap is NASA Blue Marble.</p>
  <p class="note small">Application code: Apache-2.0. Third-party data remain under their providers' terms (see Data).</p></div>`;
}

function renderLeft() {
  const v = { explore: viewExplore, compare: viewCompare, scenarios: viewScenarios, discover: viewDiscover, data: viewData, method: viewMethod }[S.tab];
  const box = $("#left"), top = box.scrollTop;
  box.innerHTML = S.app ? v() : "";
  box.scrollTop = top;
  $("#app").classList.toggle("wide", S.tab === "data" || S.tab === "method");
}
function renderLegend() {
  const R = S.res, L = $("#legend"); if (!R) return;
  if (S.layer === "clusters" && R.clusters) {
    L.innerHTML = `<h4>Analogue constellations</h4><div class="sw">${R.clusters.groups.map(G => `<span><i style="background:${CLUSTER_COLORS[G.rankNo - 1]}"></i>${pad2(G.rankNo)} ${esc(G.name)}</span>`).join("")}</div>`;
  } else if (S.layer === "delta") {
    L.innerHTML = S.prev && S.prev.tid === R.tid
      ? `<h4>Relative-rank change · ${esc(S.prev.label)} → ${esc(currentLabel())}</h4><div class="ramp" style="background:linear-gradient(90deg,#db6b5c,rgba(0,0,0,0) 50%,#80ccbd)"></div><div class="ticks"><span>−25 pct-pts</span><span>0</span><span>+25 pct-pts</span></div>`
      : `<h4>Relative-rank change</h4><div class="meta">No adjustment yet — change a weight or profile.</div>`;
  } else {
    L.innerHTML = `<h4>Similarity field · ${esc(TNAME[R.tid])}</h4><div class="ramp" style="background:linear-gradient(90deg,${RAMPS[R.tid].join(",")})"></div><div class="ticks"><span>${fmtPct(R.lo)}</span><span>median → max</span><span>${fmtPct(R.hi)}</span></div>`;
  }
}
function renderStatus(extra) {
  const R = S.res; if (!R) return;
  $("#status").textContent = `${S.n.toLocaleString()} valid Earth cells · 0.5° × 0.625° · field computed in this browser in ${S.computeMs.toFixed(0)} ms · ${S.app.algorithm_version}${extra ? " · " + extra : ""}`;
}
function renderMarkers() {
  const g = window.GLOBE, box = $("#markers"), R = S.res; if (!g || !R) return;
  if (!S.searched) { box.innerHTML = ""; return; }
  if (!box._built || box._key !== R.distinct.join(",") + "|" + S.selected + "|" + S.picked) {
    box._key = R.distinct.join(",") + "|" + S.selected + "|" + S.picked;
    box.innerHTML = R.distinct.map((i, k) => `<div class="mk${S.selected === i ? " sel" : ""}" data-i="${i}"><i></i><span>${pad2(k + 1)}</span></div>`).join("") +
      (S.picked != null && !R.distinct.includes(S.picked) ? `<div class="mk pick${S.selected === S.picked ? " sel" : ""}" data-i="${S.picked}"><i></i><span>PICK</span></div>` : "");
    box._built = true;
    $$(".mk", box).forEach(m => m.addEventListener("click", () => select(+m.dataset.i, true)));
  }
  for (const m of box.children) { const i = +m.dataset.i, p = g.project(S.lat[i], S.lon[i]); m.style.left = p.x + "px"; m.style.top = p.y + "px"; m.classList.toggle("back", !p.front); }
}
function renderAll(parts = ["right", "left", "legend", "status"]) {
  if (parts.includes("right")) renderRight();
  if (parts.includes("left")) renderLeft();
  if (parts.includes("legend")) renderLegend();
  if (parts.includes("status")) renderStatus();
  renderMarkers();
}
