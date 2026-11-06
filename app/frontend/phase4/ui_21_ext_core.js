/* ===== Extension core: the extended fingerprint in the interface =====
 * The baseline score (tai-sim-1.0.0, six criteria) is never changed. The extension adds three thermal-extremes
 * criteria (tai-ext-thermal-1.0.0: surface temperature by day and by night at the satellite overpass times, mean
 * near-surface air temperature) and scores them with the SAME formula in a separately named configuration,
 * explore-ext-thermal-v1, whose every run carries a configuration identifier and can be exported and replayed.
 * Values come from ASTERRO_EXT (data_ext.js, generated from retained inputs by scripts/build_ext.py). */
const XT = { stack: null, earth: null, cache: new Map(), hub: "constellations", proc: null, prof: "landing_site", profW: {}, w3: { surface_temp_day: 1, surface_temp_night: 1, mean_air_temperature: 1 }, tid: null, sweep: false, bfN: 100 };
const XD = typeof ASTERRO_EXT !== "undefined" ? ASTERRO_EXT : null;
const XC = () => (typeof AsterroExt !== "undefined" ? AsterroExt : null);

function xtStack() {
  if (!XT.stack) {
    XT.stack = XC().stack(S.A, S.critIds);
    XT.earth = Object.fromEntries(XC().EXT.map(c => [c, XC().earthRange(XT.stack[c])]));
  }
  return XT.stack;
}
function xtHas(tid) { return !!(XD && XD.thermal.targets[tid] && S.T[tid]); }
function xtTargets() { return XD ? Object.keys(XD.thermal.targets).filter(id => S.T[id]) : []; }
function xtCrit() { return S.critIds.concat(XC().EXT); }
function xtTarget(tid) {
  const ctx = jnCtx(tid), tv6 = Object.fromEntries(S.critIds.map(c => [c, ctx.tv[c] == null ? null : ctx.tv[c]]));
  return XC().target(tv6, ctx.ranges, XD.thermal.targets[tid], xtStack());
}
/* weights over nine criteria: six from a baseline profile (or the current weights) and three of the extension */
function xtWeights(base6, w3) { const w = {}; for (const c of S.critIds) w[c] = +(base6[c] || 0); for (const c of XC().EXT) w[c] = +(w3[c] || 0); return w; }
function xtField(tid, w) {
  const key = tid + "|" + JSON.stringify(w);
  if (XT.cache.has(key)) return XT.cache.get(key);
  const T = xtTarget(tid);
  const f = XC().field(ENG, xtStack(), xtCrit(), T.tv, w, T.ranges, S.cell, S.lat, S.lon, 20, S.app.thresholds.distinct_sep_km);
  f.T = T; f.w = w; f.tid = tid;
  f.config = { configuration: XC().CONFIG, algorithm: S.app.algorithm_version, extension: XD.thermal.version, target: tid, weights: w,
    ranges: T.ranges, min_coverage: 0.8, separation_km: S.app.thresholds.distinct_sep_km, stack_sha256: S.app.stack.sha256, thermal_sha256: XD.sha256.thermal_ext };
  f.id = XC().configId(f.config);
  if (XT.cache.size > 24) XT.cache.delete(XT.cache.keys().next().value);
  XT.cache.set(key, f);
  return f;
}
/* temperatures are shown in kelvin with the Celsius value beside them */
function xtK(v) { return v == null || v !== v ? esc(tx("val.na")) : `${esc(txNum(v, 1))} K <span class="meta">(${esc(txNum(v - 273.15, 1))} °C)</span>`; }
function xtDimName(c) { return esc(tx("ext.dim." + c + ".name")); }
function xtState(s) { return s >= S.app.thresholds.match ? "similar" : s >= S.app.thresholds.partial ? "partial" : "different"; }

/* the three new criteria for one Earth cell against one target: values, similarity, and where Earth stops */
function xtThermalBlock(i, tid) {
  if (!XD || !XC()) return "";
  if (!xtHas(tid)) return `<div class="xt-box" data-xt="none"><h4 class="xt-h">${esc(tx("ext.th.title"))}</h4><p class="jn-note">${esc(tx("ext.th.no_target"))}</p></div>`;
  const st = xtStack(), T = xtTarget(tid), R = XC().rows(st, i, T.tv, T.ranges, XT.earth);
  const rows = R.map(r => {
    let state, note = "";
    if (r.state === "na") { state = `<span class="xt-st na">${esc(tx("ext.th.na"))}</span>`; note = esc(tx("ext.th.na_moon")); }
    else if (r.state === "unknown") state = `<span class="xt-st unknown">${esc(tx("ext.th.unknown"))}</span>`;
    else {
      const k = xtState(r.s);
      state = `<span class="xt-st ${k}">${esc(tx("state." + k))} · s = ${esc(txNum(r.s, 2))}</span>`;
      if (r.outside) {
        const cl = XC().closest(st[r.c], r.t, S.cell);
        note = esc(tx("ext.th.outside_" + r.outside, { gap: txNum(r.gap, r.gap < 0.1 ? 2 : 1), lim: txNum(r.outside === "below" ? r.earthMin : r.earthMax, r.gap < 0.1 ? 2 : 1) }))
          + (cl.i >= 0 ? ` <button class="jn-lnk" data-xtsel="${cl.i}">${esc(tx("ext.th.closest"))}: ${jnPlace(cl.i)}</button>` : "");
      }
    }
    return `<tr data-xtrow="${r.c}"><th scope="row">${xtDimName(r.c)}</th><td>${xtK(r.e)}</td><td>${xtK(r.t)}</td><td>${r.diff == null ? "—" : esc((r.diff > 0 ? "+" : "") + txNum(r.diff, 1)) + " K"}</td><td>${state}${note ? `<div class="xt-note">${note}</div>` : ""}</td></tr>`;
  }).join("");
  return `<div class="xt-box" data-xt="${esc(tid)}"><h4 class="xt-h">${esc(tx("ext.th.title"))} <span class="xt-ver">${keep(XD.thermal.version)}</span></h4>
    <p class="jn-note">${esc(tx("ext.th.p"))}</p>
    <div class="tbl-wrap"><table class="xt-t"><thead><tr><th scope="col">${esc(tx("ext.th.col_dim"))}</th><th scope="col">${esc(tx("ext.th.col_earth"))}</th><th scope="col">${esc(tx("ext.th.col_target"))}</th><th scope="col">${esc(tx("ext.th.col_diff"))}</th><th scope="col">${esc(tx("ext.th.col_state"))}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="jn-note">${esc(tx("ext.th.not_in_score"))}</p></div>`;
}
/* the difference lens of the journey gains the three new criteria (outside the baseline score, labelled) */
if (typeof jnLensView === "function") { const f = jnLensView; jnLensView = function (ctx, L, eff) { let h = f.apply(this, arguments); try { h += xtThermalBlock(JN.i, JN.tid); } catch (e) { console.error(e); } return h; }; }
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-xtsel]"); if (!b) return;
  const i = +b.dataset.xtsel; if (!(i >= 0)) return;
  if (typeof JN !== "undefined" && JN.open) { JN.i = i; jnRender(); return; }
  select(i, true);
});

/* a replayable record of an extended run (configuration, identifier, leading sites with their scores) */
function xtRecord(f, label) {
  return { schema: "asterro.ext-run/1", label, configuration_id: f.id, created_utc: new Date().toISOString(), config: f.config,
    target_values: f.T.tv, leading_sites: f.sites.slice(0, 20).map((i, k) => ({ rank: k + 1, cell: S.cell[i], lat: S.lat[i], lon: S.lon[i], place: placeStr(i), score: f.eff[i], coverage: f.res.coverage[i] })),
    note: "Extended fingerprint explore-ext-thermal-v1: the unchanged baseline formula over nine criteria. Not the baseline Analogue Score; a similarity, not a probability." };
}
function xtDownload(name, obj) { const b = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }), u = URL.createObjectURL(b), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); }
