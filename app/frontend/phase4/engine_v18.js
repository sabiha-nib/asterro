/* ===== ASTERRO V18 · Local Impact engine (browser + Node), exposed as AsterroLocal =====
 * Turns one point on Earth into a local profile from data ASTERRO already holds, without sending the point anywhere.
 *   locate        the valid Earth cell that contains or is nearest to a point (with the distance to its centre)
 *   cellsWithin   cells whose centres lie within a radius (capped at MAX_KM)
 *   profile       every local variable with value, unit, dataset, provider, resolution, period, measurement type,
 *                 completeness and limits; variables ASTERRO does not hold are listed as unavailable, never as zero
 *   neighbourhood relief, zones, classes and Natural Earth geography regions within the radius
 *   discoveries   rule-based local findings, each with its evidence cells and values, and a separate hypothesis
 *   comparison    per-dimension comparison with a planetary target (the caller passes the unchanged engine's rows)
 *   precise       coordinates at a user-chosen precision for reports
 *   report        the local research report (Markdown)
 * Nothing here changes a score; similarities come from the baseline engine. */
(function (root) {
  "use strict";
  const VERSION = "tai-v18-local-1.0.0";
  const MAX_KM = 500, RADII = [50, 100, 250, 500], R_EARTH = 6371.0088;
  const fin = x => x != null && x === x && x !== Infinity && x !== -Infinity;
  function km(la1, lo1, la2, lo2) {
    const r = Math.PI / 180, p1 = la1 * r, p2 = la2 * r, dp = p2 - p1, dl = (lo2 - lo1) * r;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  function validPoint(lat, lon) { return fin(lat) && fin(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180; }
  /* parse "lat, lon" in decimal degrees, optionally with N/S/E/W */
  function parseCoords(s) {
    const t = String(s || "").trim().toUpperCase().replace(/[°]/g, " ");
    const m = t.match(/^([+-]?\d+(?:[.,]\d+)?)\s*([NS])?\s*[,;\s]\s*([+-]?\d+(?:[.,]\d+)?)\s*([EW])?$/);
    if (!m) return null;
    let lat = parseFloat(m[1].replace(",", ".")), lon = parseFloat(m[3].replace(",", "."));
    if (m[2] === "S") lat = -Math.abs(lat); if (m[4] === "W") lon = -Math.abs(lon);
    return validPoint(lat, lon) ? { lat, lon } : null;
  }
  /* nearest valid cell; maxKm: farther than this from every valid cell centre = not on ASTERRO's land grid */
  function locate(lat, lon, G, maxKm) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < G.n; i++) { if (Math.abs(G.lat[i] - lat) > 3) continue; const d = km(lat, lon, G.lat[i], G.lon[i]); if (d < bd) { bd = d; best = i; } }
    if (best < 0) for (let i = 0; i < G.n; i++) { const d = km(lat, lon, G.lat[i], G.lon[i]); if (d < bd) { bd = d; best = i; } }
    return bd <= (maxKm || 60) ? { i: best, km: bd } : { i: null, km: bd, nearest: best };
  }
  function cellsWithin(i0, radius, G) {
    const R = Math.min(MAX_KM, Math.max(1, radius)), la = G.lat[i0], lo = G.lon[i0], out = [], dLat = R / 111 + 0.5;
    for (let i = 0; i < G.n; i++) { if (Math.abs(G.lat[i] - la) > dLat) continue; const d = km(la, lo, G.lat[i], G.lon[i]); if (d <= R) out.push({ i, km: d }); }
    return out.sort((a, b) => a.km - b.km || a.i - b.i);
  }
  /* ---------------------------------------------------------------- variables
     src: dataset ids of the application (S.app.datasets) or of the V17 registry; kind as in the V17 modules */
  const CELL = "0.5 x 0.625 deg cell (about 55 km)";
  const VARS = [
    { id: "elevation", group: "terrain", unit: "m", src: ["gmted2010"], kind: "direct", res: CELL + ", mean of 30-arc-second pixels", period: "static (2000-era source data)", get: c => c.A.elevation },
    { id: "slope", group: "terrain", unit: "°", src: ["gmted2010"], kind: "derived", res: "Horn slope at ~926 m, cell mean", period: "static", get: c => c.A.slope },
    { id: "surface_roughness", group: "terrain", unit: "m", src: ["gmted2010"], kind: "derived", res: "SD of 30-arc-second elevations in the cell", period: "static", get: c => c.A.surface_roughness },
    { id: "gentle_le5", group: "terrain", unit: "share", src: ["gmted_subcell"], kind: "derived", res: "share of ~926 m pixels at or below 5°", period: "static", get: c => c.slopeShare5 },
    { id: "landform_class", group: "terrain", unit: "class", src: ["gmted2010"], kind: "derived", res: CELL, period: "static", get: c => c.cls("landform_class"), note: "provisional ASTERRO relief class" },
    { id: "local_relief", group: "terrain", unit: "m", src: ["gmted2010"], kind: "derived", res: "range of cell-mean elevations within the analysis radius", period: "static", get: c => c.relief, area: true },
    { id: "lst_day_k", group: "thermal", unit: "K", src: ["modis_aqua_lst"], kind: "direct", res: "0.1 deg rendering aggregated to the cell", period: "2016–2025", get: c => c.A.lst_day_k, note: "decoded from rendered imagery in 0.6 K steps; ~13:30 overpass" },
    { id: "lst_night_k", group: "thermal", unit: "K", src: ["modis_aqua_lst"], kind: "direct", res: "0.1 deg rendering aggregated to the cell", period: "2016–2025", get: c => c.A.lst_night_k, note: "~01:30 overpass" },
    { id: "lst_diurnal_range", group: "thermal", unit: "K", src: ["modis_aqua_lst"], kind: "derived", res: CELL, period: "2016–2025", get: c => c.A.lst_diurnal_range },
    { id: "lst_dr_iav_k", group: "thermal", unit: "K", src: ["modis_aqua_lst"], kind: "derived", res: CELL, period: "2016–2025", get: c => c.val("lst_dr_iav_k"), note: "needs at least 5 valid years" },
    { id: "annual_temperature_range", group: "climate", unit: "K", src: ["nasa_power"], kind: "model", res: "MERRA-2 0.5 x 0.625 deg", period: "2001–2020", get: c => c.A.annual_temperature_range, note: "air temperature, warmest minus coldest month" },
    { id: "t2m_mean_c", group: "climate", unit: "°C", src: ["nasa_power"], kind: "model", res: "MERRA-2 0.5 x 0.625 deg", period: "2001–2020", get: c => c.A.t2m_mean_c },
    { id: "precip_mm_yr", group: "climate", unit: "mm/yr", src: ["nasa_power"], kind: "model", res: "MERRA-2 0.5 x 0.625 deg", period: "2001–2020", get: c => c.A.precip_mm_yr },
    { id: "aridity_index_raw", group: "climate", unit: "P/PET", src: ["nasa_power"], kind: "derived", res: "MERRA-2 0.5 x 0.625 deg", period: "2001–2020", get: c => c.A.aridity_index_raw, note: "PET by Hargreaves; undefined where PET is not defined" },
    { id: "aridity_class", group: "climate", unit: "UNEP zone", src: ["nasa_power"], kind: "derived", res: "MERRA-2 0.5 x 0.625 deg", period: "2001–2020", get: c => c.cls("aridity_class") },
    { id: "dry_months", group: "climate", unit: "months", src: ["nasa_power"], kind: "derived", res: "MERRA-2 0.5 x 0.625 deg", period: "2001–2020", get: c => c.val("dry_months"), note: "Bagnouls–Gaussen P < 2T" },
    { id: "precip_cv", group: "climate", unit: "ratio", src: ["nasa_power"], kind: "derived", res: "MERRA-2 0.5 x 0.625 deg", period: "2001–2020", get: c => c.val("precip_cv") },
    { id: "freeze_months", group: "cold", unit: "months", src: ["nasa_power"], kind: "model", res: "MERRA-2 0.5 x 0.625 deg", period: "2001–2020", get: c => c.val("freeze_months") },
    { id: "ft_air_months", group: "cold", unit: "months", src: ["nasa_power"], kind: "proxy", res: "MERRA-2 0.5 x 0.625 deg", period: "2001–2020", get: c => c.val("ft_air_months"), note: "monthly means of daily air-temperature extremes" },
    { id: "lst_freeze_thaw", group: "cold", unit: "yes/no", src: ["modis_aqua_lst"], kind: "proxy", res: CELL, period: "2016–2025", get: c => (fin(c.A.lst_day_k) && fin(c.A.lst_night_k) ? (c.A.lst_day_k > 273.15 && c.A.lst_night_k < 273.15 ? 1 : 0) : null), note: "climatological day above, night below 0 °C" },
    { id: "polar_night_months", group: "light", unit: "months", src: ["nasa_power"], kind: "geometry", res: "1 deg by latitude", period: "2001–2020", get: c => c.val("polar_night_months") },
    { id: "toa_annual_wm2", group: "light", unit: "W/m²", src: ["nasa_power"], kind: "geometry", res: "1 deg by latitude", period: "2001–2020", get: c => c.val("toa_annual_wm2"), note: "top of atmosphere, not at the ground" },
    { id: "koppen", group: "context", unit: "class", src: ["nasa_power"], kind: "derived", res: "MERRA-2 0.5 x 0.625 deg", period: "2001–2020", get: c => c.koppen, note: "Köppen–Geiger after Peel et al. (2007)" },
    { id: "region", group: "context", unit: "name", src: ["natural_earth"], kind: "context", res: "1:50m geography regions", period: "current", get: c => c.region },
  ];
  /* what a local profile would need but ASTERRO does not hold; registry ids say why */
  const UNAVAILABLE = [
    { id: "aspect", group: "terrain", need: ["nasadem", "copernicus_dem"], why: "needs the full-resolution DEM tiles; only cell statistics are retained" },
    { id: "land_cover", group: "surface", need: ["esa_worldcover"] },
    { id: "water_occurrence", group: "water", need: ["jrc_gsw"] },
    { id: "vegetation", group: "surface", need: ["modis_vegetation"] },
    { id: "geology", group: "geology", need: ["macrostrat", "usgs_sgmc"] },
    { id: "mineral_indicators", group: "geology", need: ["aster_l2", "landsat", "sentinel2"] },
    { id: "aerosols", group: "atmosphere", need: ["modis_aerosol", "merra2_aerosol"] },
    { id: "wind", group: "atmosphere", need: ["merra2_wind", "era5"] },
    { id: "soil", group: "surface", need: ["soilgrids"] },
  ];
  /* nearby features ASTERRO cannot show (no retained source) */
  const NO_FEATURES = [
    { id: "rivers", need: ["natural_earth"], why: "the Natural Earth river layer was not retained" },
    { id: "salt_flats", need: [], why: "no source identified" },
    { id: "volcanic", need: ["gvp_volcanoes"] },
    { id: "caves", need: ["cave_inventories"] },
  ];

  function profile(i, ctx) {
    const c = ctx.at(i);
    return VARS.map(v => {
      const x = v.get(c); const value = x == null || (typeof x === "number" && !fin(x)) ? null : x;
      let comp = null;
      if (ctx.cells && ctx.cells.length && !v.area) { let have = 0; for (const { i: j } of ctx.cells) { const y = v.get(ctx.at(j)); if (y != null && !(typeof y === "number" && !fin(y))) have++; } comp = have / ctx.cells.length; }
      return { id: v.id, group: v.group, value, unit: v.unit, src: v.src, kind: v.kind, res: v.res, period: v.period, note: v.note || null, completeness: comp };
    });
  }
  function unavailable(reg) { return UNAVAILABLE.map(u => ({ ...u, need: u.need.map(id => ({ id, state: reg[id] ? reg[id].state : "not_investigated" })) })); }
  function noFeatures(reg) { return NO_FEATURES.map(u => ({ ...u, need: u.need.map(id => ({ id, state: reg[id] ? reg[id].state : "not_investigated" })) })); }

  function neighbourhood(i0, cells, ctx) {
    const elev = [], rough = [], zones = {}, forms = {}, kg = {}, regions = new Map();
    for (const { i, km: d } of cells) {
      const c = ctx.at(i);
      if (fin(c.A.elevation)) elev.push({ i, v: c.A.elevation });
      if (fin(c.A.surface_roughness)) rough.push({ i, v: c.A.surface_roughness });
      const z = c.cls("aridity_class"); if (z) zones[z] = (zones[z] || 0) + 1;
      const f = c.cls("landform_class"); if (f) forms[f] = (forms[f] || 0) + 1;
      if (c.koppen) kg[c.koppen] = (kg[c.koppen] || 0) + 1;
      if (c.regionIdx != null && c.regionIdx >= 0) { const r = regions.get(c.regionIdx) || { idx: c.regionIdx, name: c.region, cls: c.regionCls, n: 0, km: Infinity, i }; r.n++; if (d < r.km) { r.km = d; r.i = i; } regions.set(c.regionIdx, r); }
    }
    elev.sort((a, b) => a.v - b.v); rough.sort((a, b) => b.v - a.v);
    return { n: cells.length, elevMin: elev[0] || null, elevMax: elev[elev.length - 1] || null, relief: elev.length > 1 ? elev[elev.length - 1].v - elev[0].v : null,
      roughMax: rough[0] || null, zones, forms, koppen: kg, regions: Array.from(regions.values()).filter(r => r.cls !== "Continent").sort((a, b) => a.km - b.km || b.n - a.n) };
  }

  /* local discoveries: ctx.at(i) values, ctx.pct (global percentiles), ctx.rowsFor(tid, i), ctx.marsTid, ctx.thr */
  const RULES = [
    { id: "dry_thermal", test: (c, ctx) => (c.cls("aridity_class") === "hyper_arid" || c.cls("aridity_class") === "arid") && fin(c.A.lst_diurnal_range) && c.A.lst_diurnal_range >= ctx.pct.lst90,
      ev: c => ({ aridity_class: c.cls("aridity_class"), lst_diurnal_range: c.A.lst_diurnal_range }), rank: c => c.A.lst_diurnal_range },
    { id: "mars_terrain_other_seasons", test: (c, ctx, i) => { const s = sOf(ctx.rowsFor(ctx.marsTid, i)); return s.slope >= ctx.thr.match && s.surface_roughness >= ctx.thr.match && fin(s.annual_temperature_range) && s.annual_temperature_range < ctx.thr.partial; },
      ev: (c, ctx, i) => { const s = sOf(ctx.rowsFor(ctx.marsTid, i)); return { s_slope: s.slope, s_surface_roughness: s.surface_roughness, s_annual_temperature_range: s.annual_temperature_range, target: ctx.marsTid }; }, rank: (c, ctx, i) => { const s = sOf(ctx.rowsFor(ctx.marsTid, i)); return s.slope + s.surface_roughness; } },
    { id: "freeze_thaw", test: c => (c.val("ft_air_months") || 0) >= 4 || (fin(c.A.lst_day_k) && fin(c.A.lst_night_k) && c.A.lst_day_k > 273.15 && c.A.lst_night_k < 273.15),
      ev: c => ({ ft_air_months: c.val("ft_air_months"), lst_day_k: c.A.lst_day_k, lst_night_k: c.A.lst_night_k }), rank: c => (c.val("ft_air_months") || 0) },
    { id: "unusual_combination", test: c => c.pattern && c.pattern.anomaly != null && c.pattern.anomaly >= 98,
      ev: c => ({ anomaly_pct: c.pattern.anomaly, elevation: c.A.elevation, aridity: c.A.aridity, surface_roughness: c.A.surface_roughness, hidden: c.pattern.hidden }), rank: c => c.pattern.anomaly },
    { id: "rare_environment", test: c => c.novelty && c.novelty.uniq != null && c.novelty.uniq >= 98,
      ev: c => ({ uniqueness_pct: c.novelty.uniq, novelty: c.novelty.cls }), rank: c => c.novelty.uniq },
    { id: "polar_dark", test: c => (c.val("polar_night_months") || 0) >= 1,
      ev: c => ({ polar_night_months: c.val("polar_night_months"), freeze_months: c.val("freeze_months") }), rank: c => c.val("polar_night_months") },
  ];
  const BLOCKED_RULES = [{ id: "geology_topography", need: ["macrostrat", "usgs_sgmc", "gvp_volcanoes"] }, { id: "water_history", need: ["jrc_gsw"] }];
  function sOf(rows) { const o = {}; for (const r of rows) o[r.c] = fin(r.s) ? r.s : null; return o; }
  function discoveries(cells, ctx, reg) {
    const out = [];
    for (const R of RULES) {
      const hits = [];
      for (const { i, km: d } of cells) { const c = ctx.at(i); try { if (R.test(c, ctx, i)) hits.push({ i, km: d, rank: R.rank(c, ctx, i), ev: R.ev(c, ctx, i) }); } catch (e) { /* a missing value fails the rule */ } }
      if (!hits.length) continue;
      hits.sort((a, b) => (b.rank - a.rank) || (a.km - b.km) || (a.i - b.i));
      out.push({ id: R.id, n: hits.length, of: cells.length, best: hits[0], cells: hits.slice(0, 5) });
    }
    const blocked = BLOCKED_RULES.map(b => ({ id: b.id, need: b.need.map(id => ({ id, state: reg[id] ? reg[id].state : "not_investigated" })) }));
    return { found: out, blocked };
  }
  function comparison(rows, thr, status) {
    const read = s => s == null ? "na" : s >= thr.match ? "similar" : s >= thr.partial ? "partial" : "different";
    const r = rows.map(x => ({ ...x, k: read(x.s), status: (status || {})[x.c] || null }));
    return { rows: r, similar: r.filter(x => x.k === "similar").map(x => x.c), partial: r.filter(x => x.k === "partial").map(x => x.c),
      different: r.filter(x => x.k === "different").map(x => x.c), missing: r.filter(x => x.k === "na").map(x => x.c), proxy: r.filter(x => x.status === "PROXY" && x.k !== "na").map(x => x.c) };
  }
  /* coordinates at a user-chosen precision: exact (as entered, 4 decimals), cell (cell centre), 1deg, none */
  function precise(p, mode) {
    if (mode === "none") return null;
    if (mode === "exact") return { lat: +p.lat.toFixed(4), lon: +p.lon.toFixed(4) };
    if (mode === "1deg") return { lat: Math.round(p.lat), lon: Math.round(p.lon) };
    return { lat: +p.cellLat.toFixed(3), lon: +p.cellLon.toFixed(3) };
  }
  function report(r) {
    const L = [], h = (k, t) => L.push("", "## " + k + ". " + t, "");
    L.push("# " + r.title, "", "ASTERRO Local Impact report · " + r.versions.join(" · ") + " · generated " + r.when);
    h(1, "Location"); L.push(r.location);
    h(2, "Coordinates"); L.push(r.coords);
    h(3, "Analysis radius and spatial resolution"); L.push(r.scale);
    h(4, "Planetary target"); L.push(r.target);
    h(5, "Environmental measurements"); L.push("| Variable | Value | Unit | Dataset | Resolution | Period | Type | Completeness in radius |", "|---|---|---|---|---|---|---|---|");
    for (const m of r.measurements) L.push(`| ${m.name} | ${m.value} | ${m.unit} | ${m.src} | ${m.res} | ${m.period} | ${m.kind} | ${m.comp} |`);
    L.push("", "Not available in ASTERRO: " + r.unavailable.join("; ") + ".");
    h(6, "Dataset provenance"); for (const x of r.provenance) L.push("- " + x);
    h(7, "Similarities"); L.push(r.similar.length ? r.similar.map(x => "- " + x).join("\n") : "None at or above the similarity threshold.");
    h(8, "Differences"); L.push(r.different.length ? r.different.map(x => "- " + x).join("\n") : "None below the partial threshold.");
    h(9, "Evidence strength"); for (const x of r.evidence) L.push("- " + x);
    h(10, "Data gaps"); for (const x of r.gaps) L.push("- " + x);
    h(11, "Local discoveries (measured, with hypotheses to test)"); L.push(r.discoveries.length ? r.discoveries.map(x => "- " + x).join("\n") : "No local rule matched.");
    h(12, "Exploration applications"); for (const x of r.applications) L.push("- " + x);
    h(13, "Scientific limitations"); for (const x of r.limits) L.push("- " + x);
    h(14, "Calculation version and reproducibility"); L.push("```json", JSON.stringify(r.repro, null, 2), "```");
    L.push("", "_A similarity of measured conditions, not a probability, a suitability rating, a safety assessment or a certification. This report characterises the ~55 km grid cell that contains the location, not the exact spot._", "");
    return L.join("\n");
  }
  const api = { VERSION, MAX_KM, RADII, km, parseCoords, validPoint, locate, cellsWithin, profile, unavailable, noFeatures, neighbourhood, discoveries, comparison, precise, report, VARS, RULES };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.AsterroLocal = api;
})(typeof window !== "undefined" ? window : globalThis);
