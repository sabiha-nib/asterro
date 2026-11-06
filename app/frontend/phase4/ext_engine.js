/* ===== ASTERRO · extended fingerprint engine (browser + Node), exposed as AsterroExt =====
 * Configuration explore-ext-thermal-v1 = the UNCHANGED baseline similarity (TAIEngine.similarity, tai-sim-1.0.0) applied
 * to nine criteria: the six baseline criteria with exactly the baseline's target values and ranges, plus three
 * thermal-extremes criteria (tai-ext-thermal-1.0.0, public/data/ext/thermal_ext.json):
 *   surface_temp_day      surface temperature at ~13:30 local solar time   [K]
 *   surface_temp_night    surface temperature at ~01:30 local solar time   [K]
 *   mean_air_temperature  mean near-surface air temperature                [K]  (Moon: not applicable)
 * Ranges of the new criteria: [min, max] over valid Earth cells and the target's value (explore-target-v1 rule).
 * With the three new weights at 0 the result is the baseline field value for value (tested against the Python
 * reference, src/ext/engine.py). Nothing here is learned, sampled or estimated. */
(function (root) {
  "use strict";
  const EXT = ["surface_temp_day", "surface_temp_night", "mean_air_temperature"];
  const CONFIG = "explore-ext-thermal-v1";

  /* the nine-criterion Earth stack over valid cells (the three new arrays are stack auxiliaries already shipped) */
  function stack(A, base) {
    const st = {};
    for (const c of base) st[c] = A[c];
    st.surface_temp_day = A.lst_day_k;
    st.surface_temp_night = A.lst_night_k;
    const n = A.t2m_mean_c.length, air = new Float64Array(n);
    for (let i = 0; i < n; i++) air[i] = A.t2m_mean_c[i] + 273.15;
    st.mean_air_temperature = air;
    return st;
  }
  function earthRange(arr) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < arr.length; i++) { const x = arr[i]; if (x - x !== 0) continue; if (x < lo) lo = x; if (x > hi) hi = x; }
    return [lo, hi];
  }
  /* target vector and ranges: six baseline values and ranges as given; three new from the thermal document */
  function target(tv6, ranges6, ext, st) {
    const tv = { ...tv6 }, rg = { ...ranges6 };
    for (const c of EXT) {
      const v = ext && ext[c] != null ? +ext[c] : null;
      tv[c] = v;
      const [lo, hi] = earthRange(st[c]);
      rg[c] = v == null ? [lo, hi] : [Math.min(lo, v), Math.max(hi, v)];
    }
    return { tv, ranges: rg };
  }
  function field(E, st, crit, tv, w, ranges, cell, lat, lon, n = 20, sep = 300) {
    const res = E.similarity(st, crit, tv, w, ranges);
    const o = E.order(res.eff, cell);
    return { res, eff: res.eff, order: o, sites: E.distinctSites(o, lat, lon, n, sep) };
  }
  /* one Earth cell against one target on the three new criteria: values, similarity, where Earth stops */
  function rows(st, i, tv, ranges, earth) {
    return EXT.map(c => {
      const e0 = st[c][i], e = e0 - e0 === 0 ? +e0 : null, t = tv[c];
      const r = { c, e, t, lo: ranges[c][0], hi: ranges[c][1], earthMin: earth[c][0], earthMax: earth[c][1] };
      if (t == null) { r.state = "na"; return r; }
      if (e == null) { r.state = "unknown"; return r; }
      r.d = Math.abs(e - t) / (ranges[c][1] - ranges[c][0]);
      const s = 1 - r.d; r.s = s < 0 ? 0 : (s > 1 ? 1 : s);
      r.diff = e - t;
      r.outside = t < earth[c][0] ? "below" : (t > earth[c][1] ? "above" : null);
      r.gap = r.outside === "below" ? earth[c][0] - t : (r.outside === "above" ? t - earth[c][1] : 0);
      return r;
    });
  }
  /* the Earth cell whose value is closest to the target's, and by how much it misses */
  function closest(arr, t, cell) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < arr.length; i++) { const x = arr[i]; if (x - x !== 0) continue; const d = Math.abs(x - t); if (d < bd || (d === bd && cell[i] < cell[best])) { bd = d; best = i; } }
    return { i: best, diff: best < 0 ? null : arr[best] - t };
  }
  /* robustness: the same field ranked under other coverage thresholds (an experiment; the baseline keeps 0.80) */
  function coverageSweep(E, res, cell, lat, lon, thresholds, n = 10, sep = 300) {
    return thresholds.map(thr => {
      const eff = new Float64Array(res.final.length);
      let k = 0;
      for (let i = 0; i < eff.length; i++) { const ok = res.coverage[i] >= thr - 1e-12 && res.final[i] === res.final[i]; eff[i] = ok ? res.final[i] : -1; if (ok) k++; }
      const o = E.order(eff, cell);
      return { thr, eligible: k, sites: E.distinctSites(o, lat, lon, n, sep), eff };
    });
  }
  /* a deterministic configuration identifier (FNV-1a 64-bit over the canonical JSON); an identifier, not a signature */
  function canon(x) {
    if (Array.isArray(x)) return "[" + x.map(canon).join(",") + "]";
    if (x && typeof x === "object") return "{" + Object.keys(x).sort().map(k => JSON.stringify(k) + ":" + canon(x[k])).join(",") + "}";
    return JSON.stringify(x);
  }
  function configId(obj) {
    const s = canon(obj); let h = 0xcbf29ce484222325n; const P = 0x100000001b3n, M = (1n << 64n) - 1n;
    for (let i = 0; i < s.length; i++) { h ^= BigInt(s.charCodeAt(i)); h = (h * P) & M; }
    return "cfg-" + h.toString(16).padStart(16, "0");
  }
  const api = { EXT, CONFIG, stack, earthRange, target, field, rows, closest, coverageSweep, canon, configId };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.AsterroExt = api;
})(typeof window !== "undefined" ? window : globalThis);
