/* ===== ASTERRO V19 planetary intelligence domains (tai-v19-domains-1.0.0) =====
 * Runs in the browser and in Node (tests). Pure: every function receives what it needs.
 *   DOMAINS      sixteen independently versioned scientific domains. Each lists its per-cell inputs (ids of the V18
 *                variable registry, which carries units, evidence kind, dataset, resolution and period), the registry
 *                sources that would extend it, its method, limits and validation plan.
 *   domainState  available / partial / blocked, decided from the registry states of the domain's own sources:
 *                a domain with no integrated input is "blocked" and never shows a number.
 *   evaluate     a domain at one cell: the input values (missing stays missing), the blocked sources with their states.
 *   MEASURES     nine analytical measures kept separate (never combined into one score).
 *   measures     the nine measures for one cell and target, each with its basis or the reason it cannot be computed.
 *   interpret    why a candidate ranked: supporting and contradicting dimensions, direct versus proxy evidence, missing
 *                data, plausible applications and what needs field investigation.
 *   PROFILES     fourteen objective profiles; a profile is evaluated only when every essential input is available,
 *                and then shows its inputs and existing measures: it introduces no new composite score.
 *   POINT        domains whose evidence exists only at sampled cells (V19 site samples: Macrostrat map units, GVP
 *                Holocene volcanoes, GBIF records). At any other cell such a domain is "not sampled" and shows nothing.
 *   material     Earth map classes beside published target observations, each with its evidence class; never scored,
 *                because a regional map class and an orbital spectrum are not the same kind of measurement.
 * Nothing here writes into the baseline engine (tai-sim-1.0.0) or the V17/V18 products. */
(function (root) {
  "use strict";
  const VERSION = "tai-v19-domains-1.1.0";
  const INTEGRATED = new Set(["integrated_validated", "integrated_awaiting_validation"]);
  const D = (id, v, o) => ({ id, version: `tai-v19-dom-${id}-${v}`, ...o });
  const DOMAINS = [
    D("terrain", "1.0.0", { inputs: ["elevation", "slope", "surface_roughness", "gentle_le5", "landform_class"], extends: ["nasadem", "srtm", "copernicus_dem", "aster_gdem"],
      planet: ["mola", "lola", "dem_mars", "dem_moon"], method: "cell means and spreads of GMTED2010 30-arc-second elevations; Phase III sub-cell slope shares", res: "0.5° × 0.625° cell", period: "static",
      limits: "Craters, scarps, dunes and channels are not resolved at cell scale; aspect needs a finer DEM.", validation: "unit/range checks; sub-cell product reproduced; landform thresholds documented (provisional)" }),
    D("geology", "0.2.0", { inputs: [], extends: ["macrostrat_units", "gvp_holocene", "usgs_sgmc"], planet: ["usgs_mars_geology", "usgs_moon_geology"],
      method: "Macrostrat map units at the cell centre with source map and scale; Smithsonian GVP Holocene volcanoes within 100 km of the cell centre (sampled cells only)", res: "map scale of each source (1:5M 'small', coarser 'tiny'); volcano summit points", period: "static / catalogue 2026-11-10",
      limits: "A regional geological map is not a field survey; rock type is never inferred from climate or terrain; only 16 cells are sampled.", validation: "query-box and age-order checks; repeat fetches agree; full validation needs a byte-verified download over all cells" }),
    D("mineralogy", "0.1.0", { inputs: [], extends: ["aster_l2", "usgs_mrds", "landsat", "sentinel2"], planet: ["crism_mtrdr", "crism"],
      method: "spectral indices as possible mineral-group associations (when acquired)", res: "15–30 m (sensor)", period: "per scene",
      limits: "A spectral index indicates a possible mineral group; it does not identify a mineral.", validation: "published spectral libraries and site mineralogy (pending data)" }),
    D("surface_materials", "0.1.0", { inputs: [], extends: ["esa_worldcover", "soilgrids"], planet: [],
      method: "land-cover class shares and soil properties per cell (when acquired)", res: "10–250 m aggregated to cells", period: "2021 / static",
      limits: "Land cover and modelled soils describe the top surface only.", validation: "published product accuracies (pending data)" }),
    D("thermal", "1.0.0", { inputs: ["lst_day_k", "lst_night_k", "lst_diurnal_range", "lst_dr_iav_k"], extends: ["modis_lst_hdf", "viirs", "ecostress"], planet: ["diviner", "diviner_gcp", "diviner_polar", "meda", "rems", "themis", "tes_thermal_inertia"],
      method: "MODIS Aqua monthly LST climatology 2016–2025 decoded from GIBS; yearly diurnal ranges", res: "0.5° × 0.625° cell", period: "2016–2025",
      limits: "Overpass times (≈ 13:30, 01:30) are not daily extremes; thermal inertia is not estimated.", validation: "decoding quantisation 0.6 K; interannual SD needs ≥ 5 years (open question: decoding validation)" }),
    D("illumination", "1.0.0", { inputs: ["toa_annual_wm2", "polar_night_months"], extends: [], planet: ["lola_illumination"],
      method: "top-of-atmosphere insolation (POWER TOA) and polar-night months", res: "1° by latitude", period: "2001–2020",
      limits: "No terrain shadowing, clouds or ground irradiance; lunar permanent shadow is not represented.", validation: "polar night only near or beyond the polar circles; tropical TOA maximum" }),
    D("hydrology", "1.0.0", { inputs: ["precip_mm_yr", "aridity_index_raw", "aridity_class", "dry_months", "precip_cv"], extends: ["jrc_gsw"], planet: [],
      method: "MERRA-2 rainfall and PET via POWER; UNEP aridity zones; dry-month and seasonality indices", res: "0.5° × 0.625° cell", period: "2001–2020",
      limits: "No observed surface-water history: former lakes and present water bodies are not detected.", validation: "UNEP thresholds; missing P/PET stays missing" }),
    D("cryosphere", "1.0.0", { inputs: ["freeze_months", "ft_air_months", "lst_freeze_thaw"], extends: ["modis_snow", "rgi7", "rgi_glaciers", "esa_cci_permafrost"], planet: ["diviner_polar"],
      method: "air-temperature freeze months and freeze–thaw proxy; MODIS day/night 0 °C crossing", res: "0.5° × 0.625° cell", period: "2001–2020 / 2016–2025",
      limits: "Air temperature is not ground temperature; no snow, glacier or permafrost observation.", validation: "freeze months 12 implies MAAT < 0 °C; proxies labelled" }),
    D("atmosphere", "1.0.0", { inputs: ["t2m_mean_c", "annual_temperature_range"], extends: ["power_wind", "era5", "merra2", "mcs_climatology", "mcs"], planet: ["meda", "rems"],
      method: "MERRA-2 2 m air temperature climatology via POWER", res: "0.5° × 0.625° cell", period: "2001–2020",
      limits: "Earth's air is ≈ 100 times denser than Mars's; wind and pressure regimes are not reproduced.", validation: "grid identity with the retained climatology" }),
    D("dust_aeolian", "0.1.0", { inputs: [], extends: ["power_wind", "gibs_modis_aod", "merra2_aer", "modis_aerosol", "merra2_aerosol", "merra2_wind", "calipso"], planet: ["mcs_climatology"],
      method: "wind climatology and column aerosol optical depth (when acquired)", res: "0.5° × 0.625° cell", period: "2001–2020",
      limits: "Aerosol optical depth describes the air column, not dust settled on the ground; Earth wind does not reproduce Martian atmospheric behaviour.", validation: "pending data" }),
    D("biology", "0.2.0", { inputs: [], extends: ["gbif_extremophiles", "gbif", "modis_vegetation", "esa_worldcover"], planet: [],
      method: "GBIF record counts inside the cell (all, Archaea, Bacteria) and up to three Archaea records with their dataset (sampled cells only)", res: "points inside the 0.5° × 0.625° cell", period: "per record",
      limits: "Presence records are not habitability; nothing is inferred from imagery or from similarity.", validation: "taxon resolution, counts, sampling-bias note (pending data)" }),
    D("subsurface", "0.2.0", { inputs: [], extends: ["wikidata_caves", "cave_inventories"], planet: [],
      method: "documented caves and lava tubes with their references (when acquired)", res: "points", period: "inventory date",
      limits: "Inventories are incomplete; cave geometry is never estimated.", validation: "spot checks; share of entries with references (pending data)" }),
    D("processes", "1.0.0", { inputs: ["ft_air_months", "lst_diurnal_range", "aridity_class", "dry_months"], extends: ["jrc_gsw", "power_wind", "macrostrat_units"], planet: [],
      method: "environmental conditions associated with frost weathering, thermal stress and arid weathering", res: "0.5° × 0.625° cell", period: "2001–2025",
      limits: "These are conditions under which processes can act, not observations of the processes themselves.", validation: "inputs re-derived from retained climatologies" }),
    D("robotic_ops", "1.0.0", { inputs: ["slope", "surface_roughness", "gentle_le5", "lst_diurnal_range"], ops: ["landing", "rover_mobility", "navigation", "robotic_operations", "instrument_deployment", "subsurface_exploration"], extends: [], planet: [],
      method: "existing operation rules (operations.json): mean similarity of each operation's conditions", res: "0.5° × 0.625° cell", period: "as inputs",
      limits: "Ranks environments for rehearsal; never judges safety, access, permits or mission readiness.", validation: "operation means equal the existing rules" }),
    D("human_ops", "1.0.0", { inputs: ["slope", "t2m_mean_c", "lst_diurnal_range", "annual_temperature_range"], ops: ["eva_training", "habitat_operations", "construction"], extends: [], planet: [],
      method: "existing operation rules (operations.json)", res: "0.5° × 0.625° cell", period: "as inputs",
      limits: "Gravity, vacuum and radiation are not reproduced at any Earth site.", validation: "operation means equal the existing rules" }),
    D("resources", "0.1.0", { inputs: [], ops: ["resource_prospecting"], extends: ["macrostrat_units", "usgs_mrds", "aster_l2", "esa_cci_permafrost"], planet: [],
      method: "rehearsal of prospecting methods only (when geology, mineral or ice evidence is acquired)", res: "—", period: "—",
      limits: "No resource evidence is held; environmental indicators never imply accessible resources.", validation: "pending data" }),
  ];
  const BYID = Object.fromEntries(DOMAINS.map(d => [d.id, d]));

  const POINT = { geology: ["macrostrat_units", "gvp_holocene"], biology: ["gbif_extremophiles"] };
  /* registry: { id: { state } } (the V19 registry) */
  function domainState(d, reg, vars) {
    const have = d.inputs.filter(v => vars[v] && vars[v].src.every(s => reg[s] && INTEGRATED.has(reg[s].state)));
    const ext = d.extends.map(id => ({ id, state: reg[id] ? reg[id].state : "not_investigated" }));
    const extIn = ext.filter(e => INTEGRATED.has(e.state));
    const pending = ext.filter(e => !INTEGRATED.has(e.state));
    /* a domain with no per-cell input shows something only through site samples (POINT); otherwise it stays blocked
       even when one of its extension sources is integrated, because nothing in ASTERRO reads that source for it */
    const state = !have.length && !(extIn.length && POINT[d.id]) ? "blocked" : pending.length ? "partial" : "available";
    return { state, inputs: have, pending, integratedExtensions: extIn };
  }

  /* c: per-cell accessor as in V18 (c.A, c.val, c.cls ...); vars: V18 VARS by id */
  /* sample: the V19 site-sample record for this cell, or null */
  function evaluate(d, c, reg, vars, sample) {
    const st = domainState(d, reg, vars);
    if (st.state === "blocked") return { id: d.id, version: d.version, state: "blocked", rows: [], pending: st.pending };
    if (POINT[d.id]) {
      const live = POINT[d.id].filter(id => reg[id] && INTEGRATED.has(reg[id].state));
      if (!live.length) return { id: d.id, version: d.version, state: "blocked", rows: [], pending: st.pending };
      if (!sample) return { id: d.id, version: d.version, state: "not_sampled", rows: [], pending: st.pending, sources: live };
      return { id: d.id, version: d.version, state: "sampled", rows: [], pending: st.pending, sources: live, point: sample };
    }
    const rows = st.inputs.map(v => { let value = null; try { value = vars[v].get(c); } catch (e) { value = null; }
      if (typeof value === "number" && !isFinite(value)) value = null;
      return { id: v, value, unit: vars[v].unit, kind: vars[v].kind, src: vars[v].src, res: vars[v].res, period: vars[v].period }; });
    const have = rows.filter(r => r.value != null).length;
    return { id: d.id, version: d.version, state: st.state, rows, completeness: rows.length ? have / rows.length : null, pending: st.pending };
  }

  /* Earth evidence behind each baseline criterion: observation-based (measured, or derived from measurements) or model
     (reanalysis). Target evidence comes from the target's own status (DIRECT or PROXY). */
  const EARTH_KIND = { elevation: "observation", slope: "observation", surface_roughness: "observation", lst_diurnal_range: "observation",
    aridity: "model", annual_temperature_range: "model" };
  const observed = (c, tkind) => EARTH_KIND[c] === "observation" && tkind[c] === "DIRECT";
  /* ---------------------------------------------------------------- nine separate measures */
  /* "why" codes: unranked, no_geology, no_mineralogy, shown_not_scored, process_conditions_only, no_ops,
     nothing_compared, incomplete, not_distinct. "basis" is the English method note (reports, Research mode). */
  const MEASURES = ["environmental_similarity", "geological_relevance", "mineralogical_relevance", "process_relevance",
    "operational_relevance", "data_completeness", "evidence_strength", "novelty", "spatial_diversity"];
  /* ctx: { eff, cov, rows (ENG.detail rows: c, s, w), tkind (target status per criterion: DIRECT or PROXY),
            procHits (ids of processes whose data rule matches, V17), ops (xcOps rows), novelty ({cls, uniq}), distinctKm (km to the
            nearest other distinct top candidate, or null), domains (evaluate() per domain id) } */
  function measures(ctx) {
    const out = {};
    out.environmental_similarity = ctx.eff >= 0 ? { value: ctx.eff, basis: "baseline engine tai-sim-1.0.0, not a probability" } : { value: null, why: "unranked" };
    const gs = ctx.domains.geology.state;
    out.geological_relevance = { value: null, why: gs === "blocked" ? "no_geology" : gs === "not_sampled" ? "not_sampled" : "shown_not_scored" };
    out.mineralogical_relevance = { value: null, why: ctx.domains.mineralogy.state === "blocked" ? "no_mineralogy" : "shown_not_scored" };
    /* process and operational relevance keep the V17 definitions (same names must mean the same thing) */
    out.process_relevance = ctx.procHits ? { value: ctx.procHits.length, list: ctx.procHits, basis: "number of documented processes whose data rule matches this place (existing process rules, V17 definition)" } : { value: null, why: "process_conditions_only" };
    const ops = (ctx.ops || []).filter(o => o.mean != null).sort((a, b) => b.mean - a.mean);
    out.operational_relevance = ops.length ? { value: ops[0].mean, best: ops[0].id, mean: ops.reduce((a, o) => a + o.mean, 0) / ops.length, n: ops.length, of: (ctx.ops || []).length, basis: "best operation by mean similarity of its conditions (V17 definition); the mean over assessable operations is shown beside it" } : { value: null, why: "no_ops" };
    out.data_completeness = { value: ctx.cov, basis: "share of the weighted dimensions with values on both sides; not scientific confidence" };
    let wd = 0, wt = 0;
    for (const r of ctx.rows || []) { if (!(r.s >= 0) || !(r.w > 0)) continue; wt += r.w; if (observed(r.c, ctx.tkind)) wd += r.w; }
    out.evidence_strength = wt > 0 ? { value: wd / wt, basis: "share of compared weight that is measured, or derived from measurements, on both sides; the rest relies on reanalysis on Earth or a proxy target value" } : { value: null, why: "nothing_compared" };
    out.novelty = ctx.novelty ? { value: ctx.novelty.uniq, cls: ctx.novelty.cls, basis: "V17 rarity percentile; novelty is not importance, and missing data never raise it" } : { value: null, why: "incomplete" };
    out.spatial_diversity = ctx.distinctKm != null ? { value: ctx.distinctKm, unit: "km", basis: "distance to the nearest other distinct top-20 candidate" } : { value: null, why: "not_distinct" };
    return out;
  }

  /* ---------------------------------------------------------------- candidate interpretation */
  function interpret(ctx) {
    const thr = ctx.thr, rows = (ctx.rows || []).filter(r => r.w > 0);
    const sup = [], con = [], partial = [], missing = [], direct = [], proxy = [];
    for (const r of rows) {
      if (!(r.s >= 0)) { missing.push(r.c); continue; }
      (r.s >= thr.match ? sup : r.s >= thr.partial ? partial : con).push(r.c);
      (observed(r.c, ctx.tkind) ? direct : proxy).push(r.c);
    }
    const drivers = rows.filter(r => r.s >= 0).map(r => ({ c: r.c, contrib: r.w * r.s })).sort((a, b) => b.contrib - a.contrib).slice(0, 3).map(x => x.c);
    const apps = (ctx.ops || []).filter(o => o.mean != null && o.mean >= thr.match).map(o => o.id);
    const field = [];
    for (const id of ["geology", "mineralogy", "surface_materials", "biology", "subsurface", "dust_aeolian"]) if (ctx.domains[id] && (ctx.domains[id].state === "blocked" || ctx.domains[id].state === "not_sampled")) field.push(id);
    return { rank: ctx.rank, ranked: ctx.ranked, drivers, supporting: sup, partial, contradicting: con, missing, direct, proxy, applications: apps, field };
  }

  /* ---------------------------------------------------------------- objective profiles */
  const P = (id, essential, ops, extra) => ({ id, version: `tai-v19-prof-${id}-1.0.0`, essential, ops: ops || [], extra: extra || [] });
  const PROFILES = [
    P("geological_fieldwork", ["geology"], ["geological_fieldwork"]),
    P("mineralogical_investigation", ["mineralogy"]),
    P("polar_exploration", ["illumination", "cryosphere", "thermal"], [], ["polar_night_months", "freeze_months", "lst_night_k"]),
    P("illumination_research", ["illumination"], [], ["toa_annual_wm2", "polar_night_months"]),
    P("dust_aeolian", ["dust_aeolian"]),
    P("ice_volatiles", ["cryosphere", "resources"]),
    P("subsurface_exploration", ["subsurface"], ["subsurface_exploration"]),
    P("rover_mobility", ["terrain", "robotic_ops"], ["rover_mobility", "navigation"], ["slope", "surface_roughness", "gentle_le5"]),
    P("landing_terrain", ["terrain"], ["landing"], ["slope", "surface_roughness", "gentle_le5"]),
    P("instrument_deployment", ["thermal", "robotic_ops"], ["instrument_deployment"], ["lst_diurnal_range", "aridity_class"]),
    P("habitat_research", ["thermal", "atmosphere", "human_ops"], ["habitat_operations"], ["annual_temperature_range", "lst_night_k", "t2m_mean_c"]),
    P("construction_research", ["terrain", "surface_materials"], ["construction"]),
    P("resource_investigation", ["resources", "geology"], ["resource_prospecting"]),
    P("astrobiology_field", ["biology"]),
  ];
  function profileState(p, states) {
    const missing = p.essential.filter(id => !states[id] || states[id] === "blocked" || states[id] === "not_sampled");
    return { id: p.id, version: p.version, computable: !missing.length, missing };
  }

  /* ---------------------------------------------------------------- site samples and material evidence */
  function sampleFor(samples, cell) { return samples ? samples.sites.find(s => s.cell === cell) || null : null; }
  /* Earth: map classes (geologic_map) and volcanoes (catalogue); target: published observations (orbital_spectral,
     in_situ, geologic_map). The rows are listed side by side with comparable=false: no similarity is computed. */
  function material(site, tid, literature) {
    const earth = site ? site.geology.units.map(u => ({ side: "earth", kind: "geologic_map", text: u.name, lith: u.lith, cls: u.lith_class, scale: u.scale, source: u.source,
      age: [u.t_age_ma, u.b_age_ma] })) : [];
    if (site && site.volcanoes.n) earth.push({ side: "earth", kind: "catalogue", volcanoes: site.volcanoes.n, radius: site.volcanoes.radius_km });
    const target = (literature || []).filter(l => l.target === tid).map(l => ({ side: "target", kind: l.kind, text: l.finding, source: l.citation, id: l.id }));
    return { earth, target, comparable: false, sampled: !!site };
  }

  const api = { VERSION, EARTH_KIND, DOMAINS, BYID, MEASURES, PROFILES, INTEGRATED, POINT, domainState, evaluate, measures, interpret, profileState, sampleFor, material };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.AsterroV19 = api;
})(typeof window !== "undefined" ? window : globalThis);
