/* ASTERRO V19 data extension engine (tai-v19-data-2.0.0). Browser and Node.
 *
 * Reads the environmental cube written by src/v19x/cube.py (public/data/v19/env/cube.bin + cube.json): one Int16
 * array per variable, aligned with the app's valid land cells. A stored -32768 is missing and is returned as null,
 * never as 0. The original six-dimensional engine is not used or changed here.
 *
 * DOMAINS groups the variables into seven data-layer domains. Each domain carries the statement of what its data
 * cannot say (not_said), shown with it. Nothing is combined into a score.
 * verify(manifest, buffer, cellSha) checks byte length, SHA-256 and the cell order before a copy is used.
 * analyse(i) records the values, the datasets that produced them, the domains without data and the cube hash, so a
 * stored analysis can be traced and reproduced.
 */
(function (root) {
  "use strict";
  const VERSION = "tai-v19-data-2.0.0";
  const DOMAINS = [
    { id: "wind_atmosphere", vars: ["wind_ws10m", "wind_ws10m_maxmonth", "wind_ws50m", "wind_ws10m_max", "wind_dir_from", "wind_steadiness", "ps_kpa", "rh2m", "cloud_amt", "sw_dwn"], not_said: "wind_not_dust" },
    { id: "aerosol_dust", vars: ["dust_sfc_ugm3", "dust_sfc_maxmonth", "dust_top_bin_months", "aod550_ceres", "aod_misr_mean", "aod_misr_months"], not_said: "aod_not_surface" },
    { id: "water_soil", vars: ["water_mask_frac", "lc_water", "gwettop", "gwetroot"], not_said: "water_not_resource" },
    { id: "snow_ice", vars: ["snodp_cm", "snodp_maxmonth", "frsno", "frsno_months50", "snow_detected_maxmonth", "snow_detected_months50", "lc_snowice"], not_said: "snow_lower_bound" },
    { id: "surface_cover", vars: ["lc_dominant", "lc_barren", "lc_vegetated", "lc_urban", "albedo"], not_said: "class_not_mineral" },
    { id: "vegetation", vars: ["evi_mean", "evi_max", "evi_months"], not_said: "evi_not_life" },
    { id: "volcanic", vars: ["volc_nearest_km", "volc_holo_100km", "volc_pleis_100km"], not_said: "proximity_not_hazard" }
  ];

  function create(man, buffer) {
    if (!man || !buffer) throw new Error("cube manifest and data are required");
    if (buffer.byteLength !== man.bytes) throw new Error("cube size " + buffer.byteLength + " differs from the manifest " + man.bytes);
    const n = man.n, V = {};
    for (const v of man.variables) V[v.id] = { meta: v, arr: new Int16Array(buffer, v.offset, n) };
    function value(id, i) {
      const x = V[id]; if (!x || i == null || i < 0 || i >= n) return null;
      const q = x.arr[i]; return q === man.nodata ? null : q * x.meta.scale + (x.meta.add || 0);
    }
    function lowerBound(m, i) {
      if (m.lower_bound) return true;
      const w = m.lower_bound_where && /^(\w+) > (\d+(?:\.\d+)?)$/.exec(m.lower_bound_where);
      if (w) { const x = value(w[1], i); return x != null && x > +w[2]; }
      return false;
    }
    function row(id, i) {
      const x = V[id]; if (!x) return null; const m = x.meta, v = value(id, i);
      return { id, value: v, units: m.units, label: m.label, kind: m.kind, datasets: m.datasets || [], resolution: m.resolution, period: m.period,
               lower_bound: v != null && lowerBound(m, i), cls: m.classes && v != null ? m.classes[String(Math.round(v))] || null : null, agency: m.agency, note: m.note || null };
    }
    function domains(i) {
      return DOMAINS.map(d => {
        const rows = d.vars.map(id => row(id, i)).filter(Boolean), have = rows.filter(r => r.value != null).length;
        return { id: d.id, rows, have, n: rows.length, state: !rows.length ? "not_built" : have === 0 ? "no_data" : have === rows.length ? "complete" : "partial", not_said: d.not_said };
      });
    }
    function analyse(i, opts) {
      const ds = domains(i), used = new Set(), values = {};
      for (const d of ds) for (const r of d.rows) { values[r.id] = r.value; if (r.value != null) r.datasets.forEach(x => used.add(x)); }
      return { version: VERSION, i, cube_sha256: man.sha256, cube_version: man.version, source: (opts && opts.source) || null, retrieved: (opts && opts.retrieved) || null,
               created: (opts && opts.now) || new Date().toISOString(), values, datasets_used: Array.from(used).sort(),
               domains_unavailable: ds.filter(d => d.have === 0).map(d => d.id), lower_bounds: ds.flatMap(d => d.rows.filter(r => r.lower_bound).map(r => r.id)) };
    }
    return { n, version: man.version, value, row, domains, analyse, variables: man.variables.map(v => v.id) };
  }

  function subtle() {
    if (typeof crypto !== "undefined" && crypto.subtle) return crypto.subtle;
    if (typeof require === "function") return require("node:crypto").webcrypto.subtle;
    throw new Error("no SubtleCrypto");
  }
  async function sha256Hex(buffer) {
    const h = await subtle().digest("SHA-256", buffer);
    return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  /* why: "size" | "hash" | "cells" | "manifest" */
  async function verify(man, buffer, cellSha) {
    if (!man || !man.sha256 || !Array.isArray(man.variables)) return { ok: false, why: "manifest" };
    if (!buffer || buffer.byteLength !== man.bytes) return { ok: false, why: "size" };
    if ((await sha256Hex(buffer)) !== man.sha256) return { ok: false, why: "hash" };
    if (cellSha && man.cell_order_sha256 && cellSha !== man.cell_order_sha256) return { ok: false, why: "cells" };
    return { ok: true, why: null };
  }
  function sameAnalysis(a, b) {
    return !!(a && b) && a.cube_sha256 === b.cube_sha256 && JSON.stringify(a.values) === JSON.stringify(b.values);
  }

  const api = { VERSION, DOMAINS, create, verify, sha256Hex, sameAnalysis };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.AsterroV19X = api;
})(typeof self !== "undefined" ? self : this);
