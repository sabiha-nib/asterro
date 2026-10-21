/* ===== Globe first: an explorable landing globe, the narrated Analogue Reveal, and two data layers =====
 * 1. Landing: on wide screens the globe behind the landing text can be dragged and zoomed at once, and clicking a
 *    land cell starts the search and opens that place (pointer events pass through the empty part of the landing).
 * 2. "Where on Earth should we look?" — a non-modal card over the globe that narrates the real search in eight steps
 *    (target · fingerprint · qualifying cells · strongest candidate · score and coverage · closest matches · largest
 *    differences · why it ranked there). Every number is read from the unchanged engine after it has run
 *    (S.res, detailFor, AsterroJourney.lens). It can be paused, stepped, skipped; with reduced motion it shows
 *    every step at once and the camera does not animate its narration.
 * 3. Layers: "Coverage" paints, per cell, the share of the active weight that has NO Earth value (cells missing
 *    20 % or more are not ranked — the baseline 80 % rule); "Dimension" paints the per-criterion similarity s for one
 *    chosen dimension. Both are drawn with the existing shader and texture; the baseline layers are untouched. */
const RV = { on: false, step: 0, timer: null, paused: false, data: null, tid: null };
const RV_N = 8;
/* ---------------------------------------------------------------- 1 landing globe */
{ const f = pick; pick = function (ll) {
  if (!S.searched && S.res && $("#app").classList.contains("is-hero")) {
    const i = nearestCell(ll.lat, ll.lon);
    if (i < 0 || ENG.haversine(ll.lat, ll.lon, S.lat[i], S.lon[i]) > 60) { announce(tx("globe.no_land")); return; }
    runSearch().then(() => { S.picked = i; select(i, true); if (S.tab !== "explore") setTab("explore"); announce(tx("globe.picked", { place: placeStr(i), p: txPct(S.res.eff[i]) })); });
    return;
  }
  return f.apply(this, arguments);
}; }
/* ---------------------------------------------------------------- 2 the narrated reveal */
function rvData(tid) {
  const R = S.res, i = R.distinct[0], i2 = R.distinct[1], c = jnCtx(tid), w = { ...S.weights }, L = JE.lens(c, i, w);
  const sim = L.rows.filter(r => r.s != null).sort((a, b) => (b.s - a.s) || (S.critIds.indexOf(a.c) - S.critIds.indexOf(b.c)));
  const diff = L.rows.filter(r => r.loss != null && r.state !== "similar").sort((a, b) => b.loss - a.loss);
  let ties = 0; for (const j of R.distinct.slice(1)) if (R.eff[i] - R.eff[j] < 0.01) ties++;
  return { tid, i, i2, score: R.eff[i], score2: i2 != null ? R.eff[i2] : null, nElig: R.nElig, n: S.n, cov: L.coverage, rows: L.rows, sim, diff, loss: 1 - R.eff[i], ties, profile: S.profile };
}
function rvCard() {
  let c = $("#rv"); if (c) return c;
  c = document.createElement("section"); c.id = "rv"; c.className = "rv"; c.hidden = true;
  c.setAttribute("aria-labelledby", "rv-q");
  $("#viewport").appendChild(c);
  c.addEventListener("click", e => { const b = e.target.closest("[data-rv]"); if (!b) return; rvAct(b.dataset.rv); });
  return c;
}
function rvStart(tid) {
  if (!S.res) return;
  if (tid && tid !== S.targetId) setTarget(tid);
  if (S.targetId === "cross") setTarget("mars_jezero");
  clearTimeout(RV.timer); RV.on = true; RV.step = 0; RV.paused = false; RV.data = null; RV.tid = S.targetId;
  rvCard().hidden = false; rvRender();
  const go = () => { RV.data = rvData(RV.tid); if (REDUCED) { RV.step = RV_N - 1; RV.expand = true; rvRender(); } else rvAuto(); if (typeof jlMark === "function") jlMark("reveal"); };
  RV.expand = REDUCED;
  if (!S.searched) { RV.step = 0; rvRender(); setTimeout(() => { if (RV.on) { RV.step = 1; rvRender(); } }, REDUCED ? 0 : 1300); runSearch().then(() => { RV.step = Math.max(RV.step, 2); go(); }); }
  else { setTab("explore"); RV.step = 2; go(); }
}
function rvAuto() {
  clearTimeout(RV.timer); if (RV.paused || !RV.on) return;
  rvRender();
  if (RV.step < RV_N - 1) RV.timer = setTimeout(() => { RV.step++; rvAuto(); }, RV.step < 3 ? 1600 : 2400);
}
function rvAct(a) {
  if (a === "close") { RV.on = false; clearTimeout(RV.timer); const c = $("#rv"); c.hidden = true; c.innerHTML = ""; return; }
  if (a === "pause") { RV.paused = !RV.paused; if (!RV.paused) rvAuto(); else { clearTimeout(RV.timer); rvRender(); } return; }
  if (!RV.data) return;
  if (a === "next") { RV.paused = true; clearTimeout(RV.timer); RV.step = Math.min(RV_N - 1, RV.step + 1); rvRender(); }
  else if (a === "prev") { RV.paused = true; clearTimeout(RV.timer); RV.step = Math.max(0, RV.step - 1); rvRender(); }
  else if (a === "expand") { RV.expand = !RV.expand; if (RV.expand) { RV.paused = true; clearTimeout(RV.timer); RV.step = RV_N - 1; } rvRender(); }
  else if (a === "analyse") jnOpen("place", { i: RV.data.i, tid: RV.data.tid, pid: S.profile === "custom" ? "custom" : S.profile, sec: "lens" });
  else if (a === "test") jnOpen("place", { i: RV.data.i, tid: RV.data.tid, pid: S.profile === "custom" ? "custom" : S.profile, sec: "change" });
  else if (a === "passport") jnOpen("place", { i: RV.data.i, tid: RV.data.tid, pid: S.profile === "custom" ? "custom" : S.profile, sec: "passport" });
  const f = $(`#rv [data-rv="${a}"]`); if (f && !f.disabled) f.focus();
}
function rvLine(k) {
  const D = RV.data, tid = RV.tid, T = S.T[tid];
  if (k === 0) return txH("rv.s1", { where: txLL(T.location.lat, T.location.lon_east), km: txNum(T.location.window_km, 1) }, { t: `${esc(jnBody(tid))} · ${jnTName(tid)}` });
  if (k === 1) { const comp = S.critIds.filter(c => T.variables[c] != null); return esc(tx("rv.s2", { n: txInt(comp.length), list: txList(comp.map(c => tx("crit." + c + ".s"))) })); }
  if (!D) return `<span class="rv-wait">${esc(tx("rv.searching", { n: txInt(S.n) }))}</span>`;
  if (k === 2) return esc(tx("rv.s3", { k: txInt(D.nElig), n: txInt(D.n) }));
  if (k === 3) return txH("rv.s4", {}, { place: jnPlace(D.i) });
  if (k === 4) return esc(tx("rv.s5", { p: txPct(D.score), c: txPct(D.cov, 0), profile: tx(S.profile === "custom" ? "profile.custom" : "profile." + S.profile) }));
  if (k === 5) { const s = D.sim.filter(r => r.state === "similar").slice(0, 3); return s.length ? esc(tx("rv.s6", { list: txList(s.map(r => tx("crit." + r.c + ".s") + " (s = " + txNum(r.s, 2) + ")")) })) : esc(tx("rv.s6_none")); }
  if (k === 6) { const d = D.diff.slice(0, 2); return d.length ? esc(tx("rv.s7", { list: txList(d.map(r => tx("crit." + r.c + ".s") + " (" + tx("reveal.costs", { pts: txNum(100 * r.loss, 1) }) + ")")) })) : esc(tx("rv.s7_none")); }
  if (k === 7) return txH(D.score2 != null ? "rv.s8" : "rv.s8_alone", { lost: txNum(100 * D.loss, 1), n: txInt(D.nElig), p2: txPct(D.score2), gap: txNum(100 * (D.score - (D.score2 ?? 0)), 1) }, { second: D.i2 != null ? jnPlace(D.i2) : "" }) + (D.ties ? " " + esc(tx("rv.ties", { k: txInt(D.ties) })) : "");
  return "";
}
function rvRender() {
  const c = rvCard(); if (!RV.on) { c.hidden = true; return; }
  const k = RV.step;
  if (RV.data && k >= 3 && RV.flown !== RV.data.i) { RV.flown = RV.data.i; select(RV.data.i, true); }
  const items = [], done = RV.data && k === RV_N - 1;
  /* earlier steps fold to their title (one line) unless the reader expands them; the current step is always open */
  for (let j = 0; j <= k; j++) { const open = j === k || RV.expand; items.push(`<li class="${j === k ? "now" : "past"}"><span class="rv-n" aria-hidden="true">${j < k ? "✓" : txInt(j + 1)}</span><div><b>${esc(tx("rv.t" + (j + 1)))}</b>${open ? `<p>${rvLine(j)}</p>` : ""}</div></li>`); }
  c.innerHTML = `<div class="rv-head"><p class="rv-k">${esc(tx("rv.kicker"))}</p><h2 id="rv-q">${esc(tx("rv.q"))}</h2>
      <button type="button" class="rv-x" data-rv="close" aria-label="${esc(tx("nav.close"))}">×</button></div>
    <ol class="rv-steps" aria-live="polite">${items.join("")}</ol>
    <div class="rv-nav"><span class="rv-prog">${esc(tx("reveal.step_of", { k: txInt(k + 1), n: txInt(RV_N) }))}</span>
      <button type="button" class="jn-btn ghost" data-rv="prev"${!RV.data || k === 0 ? " disabled" : ""}>‹</button>
      ${done ? "" : `<button type="button" class="jn-btn ghost" data-rv="pause"${REDUCED ? " disabled" : ""}>${esc(tx(RV.paused ? "rv.play" : "rv.pause"))}</button><button type="button" class="jn-btn ghost" data-rv="next"${!RV.data ? " disabled" : ""}>›</button>`}
      <button type="button" class="jn-lnk" data-rv="expand" aria-pressed="${!!RV.expand}"${!RV.data ? " disabled" : ""}>${esc(tx(RV.expand ? "rv.fold" : "rv.show_all"))}</button></div>
    ${done ? `<div class="rv-act"><button type="button" class="jn-btn" data-rv="analyse">${esc(tx("rv.analyse"))}</button><button type="button" class="jn-btn ghost" data-rv="test">${esc(tx("rv.test"))}</button><button type="button" class="jn-btn ghost" data-rv="passport">${esc(tx("sec.passport"))}</button></div><p class="rv-fine">${esc(tx("rv.fine"))}</p>` : ""}`;
}
document.addEventListener("asterro:lang", () => { if (RV.on) rvRender(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && RV.on && !JN.open && $("#rv").contains(document.activeElement)) rvAct("close"); });
(function rvEntry() {
  const hj = $("#hero-journey") || $("#hero-search"); if (!hj || $("#hero-reveal")) return;
  const b = document.createElement("button"); b.className = "btn-ghost btn-discover"; b.id = "hero-reveal"; b.textContent = tx("cta.reveal");
  b.addEventListener("click", () => rvStart(S.targetId));
  hj.insertAdjacentElement("beforebegin", b);
  hj.classList.remove("btn-discover");
})();
/* ---------------------------------------------------------------- 3 data layers */
const GL = { dim: "lst_diurnal_range", RAMP_COV: ["#16201f", "#2a4743", "#4f8a82", "#6fb3a9", "#8fd1c4"] };
/* coverage classes, drawn with the categorical path of the existing shader (layer 1):
 *   faint teal  every weighted condition has an Earth value
 *   yellow      ranked, but part of the weight has no Earth value (excluded, not filled in)
 *   red         not ranked: less than 80 % of the weight has an Earth value */
function glCovOf(R) {
  if (R.tid !== "cross") return R.r.coverage;
  const a = R.rJ.coverage, b = R.rM.coverage, o = new Float64Array(S.n); for (let i = 0; i < S.n; i++) o[i] = Math.min(a[i], b[i]); return o;
}
function glCoverage() {
  const g = window.GLOBE, R = S.res; if (!g || !R) return;
  const cov = glCovOf(R), d = g.fieldData; d.fill(0);
  for (let i = 0; i < S.n; i++) { const c = S.cell[i] * 4, v = cov[i] === cov[i] ? cov[i] : 0; d[c] = 255; d[c + 1] = 0; d[c + 2] = v >= 1 - 1e-12 ? 0 : v >= 0.8 - 1e-12 ? 5 : 4; d[c + 3] = 1; }
  g.lo = 0; g.hi = 1; g.ramp = GL.RAMP_COV; g.layer = 1; g.uploadField();
}
function glDimension() {
  const g = window.GLOBE, tid = S.targetId; if (!g || tid === "cross") return;
  const c0 = GL.dim, t = S.T[tid].variables[c0], Rg = a4RangesFor(tid)[c0], e = S.A[c0], d = g.fieldData; d.fill(0);
  if (t != null) for (let i = 0; i < S.n; i++) { const x = e[i]; if (x - x !== 0) continue; const s = clamp(1 - Math.abs(x - t) / (Rg[1] - Rg[0]), 0, 1), c = S.cell[i] * 4; d[c] = Math.round(s * 255); d[c + 1] = 0; d[c + 2] = 0; d[c + 3] = 1; }
  g.lo = 0; g.hi = 1; g.ramp = RAMPS[tid] || RAMPS.mars_jezero; g.uploadField();
}
/* the Dimension layer needs one target; on cross-planet it falls back to the similarity field */
function glFallback() {
  if (S.layer !== "dimension" || S.targetId !== "cross") return false;
  S.layer = "sim"; $$("[data-layer]").forEach(b => b.setAttribute("aria-pressed", b.dataset.layer === "sim"));
  if (window.GLOBE) GLOBE.layer = 0;
  return true;
}
function glPaint() { if (S.layer === "coverage") glCoverage(); else if (S.layer === "dimension") glDimension(); }
{ const f = paintField; paintField = function () { glFallback(); if (S.layer === "coverage" || S.layer === "dimension") { if (window.GLOBE) GLOBE.layer = S.layer === "coverage" ? 1 : 0; return glPaint(); } return f.apply(this, arguments); }; }
{ const f = setLayer; setLayer = function (l) {
  if (l === "coverage" || l === "dimension") {
    if (l === "dimension" && S.targetId === "cross") { announce(tx("globe.dim_cross")); return; }
    if (l === "dimension" && S.T[S.targetId].variables[GL.dim] == null) GL.dim = S.critIds.find(c => S.T[S.targetId].variables[c] != null);
    S.layer = l; $$("[data-layer]").forEach(b => b.setAttribute("aria-pressed", b.dataset.layer === l));
    GLOBE.layer = l === "coverage" ? 1 : 0; GLOBE.reveal = 1; glPaint(); GLOBE.dirty = true; renderLegend(); if (typeof jlMark === "function") jlMark("layer:" + l); return;
  }
  const was = S.layer; const r = f.apply(this, arguments);
  if (was === "coverage" || was === "dimension") { paintField(); GLOBE.dirty = true; }
  return r;
}; }
{ const f = renderLegend; renderLegend = function () {
  if (glFallback()) { paintField(); GLOBE.dirty = true; }
  if (S.layer !== "coverage" && S.layer !== "dimension") return f.apply(this, arguments);
  const L = $("#legend"), R = S.res; if (!R) return;
  if (S.layer === "coverage") {
    const cov = glCovOf(R); let full = 0, part = 0, no = 0; for (let i = 0; i < S.n; i++) { const v = cov[i]; if (v >= 1 - 1e-12) full++; else if (v >= 0.8 - 1e-12) part++; else no++; }
    const sw = (col, k, n) => `<span><i style="background:${col}"></i>${esc(tx(k))} · ${esc(txInt(n))}</span>`;
    L.innerHTML = `<h4>${esc(tx("globe.cov_title"))}</h4><div class="sw gl-sw">${sw("#4f8a82", "globe.cov_full", full)}${sw(CLUSTER_COLORS[4], "globe.cov_part", part)}${sw(CLUSTER_COLORS[3], "globe.cov_none", no)}</div>
      <p class="meta gl-note">${esc(tx("globe.cov_note"))}</p>`;
  } else {
    const tid = R.tid, opts = S.critIds.map(c => `<option value="${c}"${c === GL.dim ? " selected" : ""}${S.T[tid].variables[c] == null ? " disabled" : ""}>${esc(tx("crit." + c))}</option>`).join("");
    L.innerHTML = `<h4>${esc(tx("globe.dim_title", { t: jnTNameText(tid) }))}</h4><label class="gl-dim"><span class="sr-only">${esc(tx("globe.dim_pick"))}</span><select id="gl-dim" aria-label="${esc(tx("globe.dim_pick"))}">${opts}</select></label>
      <div class="ramp" style="background:linear-gradient(90deg,${(RAMPS[tid] || RAMPS.mars_jezero).join(",")})"></div><div class="ticks"><span>s = ${esc(txNum(0, 0))}</span><span>${esc(txNum(0.85, 2))}</span><span>s = ${esc(txNum(1, 0))}</span></div>
      <p class="meta gl-note">${esc(tx("globe.dim_note"))}</p>`;
  }
}; }
document.addEventListener("change", e => { if (e.target && e.target.id === "gl-dim") { GL.dim = e.target.value; glPaint(); GLOBE.dirty = true; renderLegend(); const s = $("#gl-dim"); if (s) s.focus(); if (typeof jlMark === "function") jlMark("dim:" + GL.dim); } });
(function glButtons() {
  const seg = $("#layer-delta") && $("#layer-delta").parentElement; if (!seg || $("#layer-coverage")) return;
  for (const [id, l, k] of [["layer-coverage", "coverage", "globe.layer_cov"], ["layer-dimension", "dimension", "globe.layer_dim"]]) {
    const b = document.createElement("button"); b.id = id; b.dataset.layer = l; b.setAttribute("aria-pressed", "false"); b.dataset.i18nKey = k; b.textContent = tx(k); seg.appendChild(b);
  }
})();
document.addEventListener("asterro:lang", () => { for (const b of $$("[data-i18n-key]")) b.textContent = tx(b.dataset.i18nKey); const r = $("#hero-reveal"); if (r) r.textContent = tx("cta.reveal"); if (S.layer === "coverage" || S.layer === "dimension") renderLegend(); });
