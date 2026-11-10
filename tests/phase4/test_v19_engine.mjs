// V19 planetary intelligence engine (Node). Run: node tests/phase4/test_v19_engine.mjs
// app/frontend/phase4/engine_v19.js on the real stack, the V17 products, the V18 variable registry and the V19 registry:
// sixteen versioned domains, blocked domains never show a value, missing stays missing, nine separate measures (never
// combined), measures consistent with the engine, interpretation partitions, objective profiles gated by data.
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E = require("../../app/frontend/engine.js"), L = require("../../app/frontend/phase4/engine_v18.js"), V17 = require("../../app/frontend/phase4/engine_v17.js"), V19 = require("../../app/frontend/phase4/engine_v19.js");
const root = new URL("../..", import.meta.url).pathname;
let fails = 0, n = 0;
const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };
const c = vm.createContext({});
vm.runInContext(fs.readFileSync(root + "app/frontend/phase4/data_v17.js", "utf8") + "\n" + fs.readFileSync(root + "app/frontend/phase4/data_v19.js", "utf8") + "\nthis.D = ASTERRO_V17; this.D19 = ASTERRO_V19;", c);
const D = c.D, D19 = c.D19, info = JSON.parse(fs.readFileSync(root + "data/metadata/stack_build.json")), buf = fs.readFileSync(root + "public/data/stack.bin");
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), TY = { float32: Float32Array, uint32: Uint32Array, int16: Int16Array }, A = {};
for (const x of info.layout) A[x.name] = new TY[x.dtype](ab, x.offset, x.length);
const N = A.cell.length, V = V17.create(D, N);
const app = JSON.parse(fs.readFileSync(root + "public/data/app.json")), T = Object.fromEntries(JSON.parse(fs.readFileSync(root + "public/data/targets.json")).targets.map(t => [t.id, t]));
const CRIT = app.criteria.map(x => x.id), W = Object.fromEntries(CRIT.map(x => [x, 1])), thr = app.thresholds;
const LAY = ["elevation", "slope", "surface_roughness", "lst_day_k", "lst_night_k", "lst_diurnal_range", "annual_temperature_range", "t2m_mean_c", "precip_mm_yr", "aridity_index_raw", "aridity"];
const at = i => { const o = { A: {} }; for (const k of LAY) o.A[k] = A[k][i]; o.val = v => V.val(v, i); o.cls = v => V.cls(v, i); o.slopeShare5 = null; o.koppen = null; o.region = null; return o; };
const VARS = Object.fromEntries(L.VARS.map(v => [v.id, v]));
const RANK = ["integrated_validated", "integrated_awaiting_validation", "processing", "acquired_awaiting_processing", "awaiting_credentials", "provider_unavailable", "access_blocked", "unsuitable", "not_investigated"];
const REG = {}; for (const s of D19.registry.sources) { const id = s.id.replace(/@v19$/, ""); if (!REG[id] || RANK.indexOf(s.state) < RANK.indexOf(REG[id].state)) REG[id] = s; }

// domains
check(V19.DOMAINS.length === 16 && new Set(V19.DOMAINS.map(d => d.id)).size === 16 && new Set(V19.DOMAINS.map(d => d.version)).size === 16, "sixteen domains, each independently versioned");
check(V19.DOMAINS.every(d => d.method && d.limits && d.validation && d.res && d.period && Array.isArray(d.extends) && Array.isArray(d.planet)), "every domain documents method, resolution, period, limits, validation and its sources");
check(V19.DOMAINS.every(d => d.inputs.every(v => VARS[v])), "every domain input is a variable of the V18 registry (units, evidence kind, dataset, resolution, period)");
const states = Object.fromEntries(V19.DOMAINS.map(d => [d.id, V19.domainState(d, REG, VARS).state]));
const blockedNow = Object.entries(states).filter(([, s]) => s === "blocked").map(([k]) => k).sort().join();
check(blockedNow === "dust_aeolian,mineralogy,resources,subsurface,surface_materials", `domains without integrated data are blocked (${blockedNow})`);
check(states.geology === "partial" && states.biology === "partial", "geology and biology have integrated site-sample sources (partial: other sources still pending)");
const i0 = Array.from(A.cell).indexOf(76787);  // Atacama cell
let leak = 0, filled = 0;
for (const d of V19.DOMAINS) { const ev = V19.evaluate(d, at(i0), REG, VARS); if (ev.state === "blocked" && ev.rows.length) leak++; }
check(leak === 0, "a blocked domain never returns a value");
let nanCell = -1; for (let i = 0; i < N; i++) if (V.val("lst_dr_iav_k", i) == null) { nanCell = i; break; }
const th = V19.evaluate(V19.BYID.thermal, at(nanCell), REG, VARS);
check(nanCell >= 0 && th.rows.find(r => r.id === "lst_dr_iav_k").value === null && th.completeness < 1, `missing stays missing (cell ${A.cell[nanCell]}: interannual LST variability null, completeness ${th.completeness.toFixed(2)})`);
for (let i = 0; i < N; i += 97) for (const id of ["thermal", "hydrology", "terrain"]) for (const r of V19.evaluate(V19.BYID[id], at(i), REG, VARS).rows) if (r.value === 0 && VARS[r.id].get(at(i)) == null) filled++;
check(filled === 0, "no missing value is ever turned into zero (sample of 792 cells × 3 domains)");

// measures
const tid = "mars_jezero", tv = T[tid].variables, eff = E.similarity(A, CRIT, tv, W, app.ranges).eff;
const rows = E.detail(A, CRIT, i0, tv, W, app.ranges).rows.map(r => ({ c: r.c, s: r.s == null || r.s !== r.s ? null : r.s, w: r.w }));
const doms = Object.fromEntries(V19.DOMAINS.map(d => [d.id, V19.evaluate(d, at(i0), REG, VARS)]));
const ctx = { eff: eff[i0], cov: 1, rows, tkind: T[tid].status, procHits: ["a", "b"], ops: [{ id: "landing", mean: 0.9 }, { id: "navigation", mean: 0.7 }, { id: "resource_prospecting", mean: null }], novelty: V.novelty(i0), distinctKm: null, domains: doms, thr };
const M = V19.measures(ctx);
check(V19.MEASURES.length === 9 && Object.keys(M).sort().join() === V19.MEASURES.slice().sort().join(), "nine measures, each reported separately");
check(!("total" in M) && !("combined" in M) && !("overall" in M), "no combined score exists");
check(Math.abs(M.environmental_similarity.value - eff[i0]) < 1e-12, "environmental similarity is the unchanged engine's score");
check(M.geological_relevance.value === null && M.geological_relevance.why === "not_sampled" && M.mineralogical_relevance.why === "no_mineralogy", "geological and mineralogical relevance are not assessed without data (cell evaluated without its sample: not sampled)");
check(M.operational_relevance.value === 0.9 && M.operational_relevance.best === "landing" && Math.abs(M.operational_relevance.mean - 0.8) < 1e-12 && M.operational_relevance.n === 2 && M.operational_relevance.of === 3, "operational relevance keeps the V17 definition (best operation) and adds the mean of the assessable ones");
check(M.process_relevance.value === 2, "process relevance keeps the V17 definition (matching processes)");
const obs = rows.filter(r => r.s != null && V19.EARTH_KIND[r.c] === "observation" && T[tid].status[r.c] === "DIRECT").reduce((a, r) => a + r.w, 0) / rows.filter(r => r.s != null).reduce((a, r) => a + r.w, 0);
check(Math.abs(M.evidence_strength.value - obs) < 1e-12 && M.evidence_strength.value < 1, `evidence strength counts only weight measured (or derived from measurements) on both sides (${obs.toFixed(2)})`);
check(Object.keys(V19.EARTH_KIND).sort().join() === CRIT.slice().sort().join(), "the Earth evidence kind is declared for every baseline criterion");
check(V19.measures({ ...ctx, novelty: null }).novelty.value === null && V19.measures({ ...ctx, eff: -1 }).environmental_similarity.value === null, "no value is invented when novelty or ranking is unavailable");
// interpretation
const I = V19.interpret({ ...ctx, rank: 5, ranked: 100 });
const all = [...I.supporting, ...I.partial, ...I.contradicting, ...I.missing].sort();
check(all.join() === CRIT.slice().sort().join() && I.supporting.every(c => rows.find(r => r.c === c).s >= thr.match) && I.contradicting.every(c => rows.find(r => r.c === c).s < thr.partial), "supporting, partial, contradicting and missing partition the dimensions by the engine's thresholds");
check([...I.direct, ...I.proxy].length === all.length - I.missing.length, "every compared dimension is either measured on both sides or relies on reanalysis/proxy");
check(I.applications.join() === "landing" && I.field.includes("geology") && I.field.includes("biology"), "applications come from assessed operations; blocked domains are listed as needing field investigation");
// profiles
const cellStates = Object.fromEntries(Object.entries(doms).map(([k, v]) => [k, v.state]));
const P = V19.PROFILES.map(p => V19.profileState(p, cellStates));
check(V19.PROFILES.length === 14 && P.every(p => p.computable === p.missing.length === 0 || (p.computable && !p.missing.length) || (!p.computable && p.missing.length)), "fourteen objective profiles, each computable exactly when its essential domains have data");
check(!P.find(p => p.id === "geological_fieldwork").computable && P.find(p => p.id === "landing_terrain").computable, "at a cell without a site sample, geological fieldwork cannot be evaluated; landing terrain can");
// registry
check(D19.registry.states.length === 9 && Object.values(D19.registry.counts).reduce((a, b) => a + b, 0) === D19.registry.sources.length, "the V19 registry has nine states and every dataset is in one");

// site samples (V19.1): geology, volcanoes and biological records at sampled cells only
const SM = D19.samples, S16 = SM.sites;
check(SM && S16.length === 16 && SM.validation.checks.structure && SM.validation.checks.repeat_fetches_agree && SM.validation.checks.volcanoes_stored_once, "16 sampled cells; the acquisition checks passed (query boxes, age order, records inside cells, repeat fetches agree)");
check(S16.every(s => Array.from(A.cell).indexOf(s.cell) >= 0 && s.lat === -90 + 0.5 * Math.floor(s.cell / 576) && s.lon === -180 + 0.625 * (s.cell % 576)), "every sampled cell is a valid land cell, queried at its own centre");
const kmH = (a, b, c2, d) => { const p = Math.PI / 180, h = Math.sin((c2 - a) * p / 2) ** 2 + Math.cos(a * p) * Math.cos(c2 * p) * Math.sin((d - b) * p / 2) ** 2; return 2 * 6371.0088 * Math.asin(Math.sqrt(h)); };
let vbad = 0; for (const s of S16) { let last = -1; for (const x of s.volcanoes.near) { const v = SM.volcanoes[x.number], d = kmH(s.lat, s.lon, v.lat, v.lon); if (Math.abs(d - x.km) > 0.1 || d > SM.radius_km || d < last) vbad++; last = d; } }
check(vbad === 0, "every listed volcano lies within 100 km of its cell centre, distances recomputed, nearest first");
const sAt = V19.sampleFor(SM, 76787), geoS = V19.evaluate(V19.BYID.geology, at(i0), REG, VARS, sAt), geoN = V19.evaluate(V19.BYID.geology, at(i0 + 1), REG, VARS, V19.sampleFor(SM, A.cell[i0 + 1]));
check(sAt && geoS.state === "sampled" && geoS.point.geology.units.length === 2 && geoS.point.volcanoes.n === 15, "the Atacama cell is sampled: 2 map units, 15 Holocene volcanoes within 100 km");
check(geoN.state === "not_sampled" && !geoN.rows.length && !geoN.point, "a cell without a sample shows no geology at all (not sampled, never a zero or a guess)");
const bioS = V19.evaluate(V19.BYID.biology, at(i0), REG, VARS, sAt);
check(bioS.state === "sampled" && bioS.point.biology.archaea === 44 && bioS.point.biology.archaea_examples.every(r => r.dataset_title && r.dataset_doi), "biological records keep their dataset title and DOI (Atacama: 44 Archaea records, Brava and Tebenquiche microbial mats)");
const lsp3 = S16.find(s => s.id === "lsp3");
check(lsp3.biology.archaea_examples.every(r => r.coords_whole_degrees), "records whose coordinates are whole degrees are flagged as imprecise");
const sampledStates = Object.fromEntries(V19.DOMAINS.map(d => [d.id, V19.evaluate(d, at(i0), REG, VARS, sAt).state]));
const P2 = Object.fromEntries(V19.PROFILES.map(p => [p.id, V19.profileState(p, sampledStates)]));
check(P2.geological_fieldwork.computable && P2.astrobiology_field.computable && !P2.mineralogical_investigation.computable, "at a sampled cell geological fieldwork and astrobiology field research can be evaluated; mineralogy still cannot");
check(V19.measures({ ...ctx, domains: Object.fromEntries(V19.DOMAINS.map(d => [d.id, V19.evaluate(d, at(i0), REG, VARS, sAt)])) }).geological_relevance.value === null, "geological relevance is shown, never scored, even where map units exist");
const mat = V19.material(sAt, "mars_jezero", SM.literature), matM = V19.material(null, "moon_south_pole", SM.literature);
check(mat.comparable === false && mat.earth.some(r => r.kind === "geologic_map") && mat.target.length === 2 && mat.target.every(r => ["orbital_spectral", "in_situ"].includes(r.kind)), "material evidence: Earth map classes beside published Jezero observations, never compared");
check(!matM.earth.length && matM.target.every(r => r.source) && !matM.sampled, "material evidence for an unsampled cell lists no Earth evidence");
const R19 = Object.fromEntries(D19.registry.sources.map(s => [s.id, s]));
check(["macrostrat_units", "gvp_holocene", "gbif_extremophiles"].every(k => R19[k].state === "integrated_awaiting_validation") && ["macrostrat", "gvp_volcanoes", "gbif"].every(k => R19[k].state === "integrated_awaiting_validation" && R19[k].see),
  "the acquired sources are 'integrated, awaiting full validation' (16 cells, transcribed values); their V17 rows point to them");
check(["power_wind", "soilgrids", "wikidata_caves"].every(k => R19[k].state === "access_blocked" && R19[k].last_attempt && R19[k].last_attempt.class === "fetch_refused"), "routes refused by the fetch service are recorded with their reason, and stay blocked");

console.log(`${n - fails}/${n} V19 engine checks passed`);
process.exit(fails ? 1 : 0);
