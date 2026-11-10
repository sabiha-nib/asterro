// V18 Local Impact engine (Node). Run: node tests/phase4/test_v18_local.mjs
// app/frontend/phase4/engine_v18.js on the real stack, the V17 products and the unchanged baseline engine:
// coordinate parsing, locating a point, radii, the local profile (missing never zero), neighbourhood, discoveries
// with evidence inside the radius, comparison categories, coordinate precision and the report.
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E = require("../../app/frontend/engine.js"), L = require("../../app/frontend/phase4/engine_v18.js"), V17 = require("../../app/frontend/phase4/engine_v17.js");
const root = new URL("../..", import.meta.url).pathname;
let fails = 0, n = 0;
const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };
const c = vm.createContext({}); vm.runInContext(fs.readFileSync(root + "app/frontend/phase4/data_v17.js", "utf8") + "\nthis.D = ASTERRO_V17;", c);
const D = c.D, info = JSON.parse(fs.readFileSync(root + "data/metadata/stack_build.json")), buf = fs.readFileSync(root + "public/data/stack.bin");
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), TY = { float32: Float32Array, uint32: Uint32Array, int16: Int16Array }, A = {};
for (const x of info.layout) A[x.name] = new TY[x.dtype](ab, x.offset, x.length);
const N = A.cell.length, lat = new Float64Array(N), lon = new Float64Array(N);
for (let i = 0; i < N; i++) { lat[i] = -90 + 0.5 * Math.floor(A.cell[i] / 576); lon[i] = -180 + 0.625 * (A.cell[i] % 576); }
const G = { n: N, lat, lon }, V = V17.create(D, N);
const app = JSON.parse(fs.readFileSync(root + "public/data/app.json")), T = Object.fromEntries(JSON.parse(fs.readFileSync(root + "public/data/targets.json")).targets.map(t => [t.id, t]));
const CRIT = app.criteria.map(x => x.id), W = Object.fromEntries(CRIT.map(x => [x, 1])), thr = app.thresholds;
const LAY = ["elevation", "slope", "surface_roughness", "lst_day_k", "lst_night_k", "lst_diurnal_range", "annual_temperature_range", "t2m_mean_c", "precip_mm_yr", "aridity_index_raw", "aridity"];
const at = i => { const o = { A: {} }; for (const k of LAY) o.A[k] = A[k][i]; o.val = v => V.val(v, i); o.cls = v => V.cls(v, i); o.pattern = V.pattern(i); o.novelty = V.novelty(i); o.regionIdx = A.region[i]; o.region = A.region[i] >= 0 ? "r" + A.region[i] : null; o.regionCls = "Desert"; return o; };
const rowsFor = (tid, i) => E.detail(A, CRIT, i, T[tid].variables, W, app.ranges).rows.map(r => ({ c: r.c, e: r.e, t: r.t, s: r.s == null || r.s !== r.s ? null : r.s }));

// coordinates
const P = L.parseCoords;
check(JSON.stringify(P("23.5 S, 68.2 W")) === JSON.stringify({ lat: -23.5, lon: -68.2 }) && JSON.stringify(P("-23.5, -68.2")) === JSON.stringify({ lat: -23.5, lon: -68.2 }), "coordinates with hemisphere letters or signs");
check(JSON.stringify(P("64,1 ; -21,9")) === JSON.stringify({ lat: 64.1, lon: -21.9 }), "decimal commas with a semicolon separator");
check(P("95, 10") === null && P("10, 200") === null && P("Atacama") === null && P("") === null, "invalid or non-numeric input is refused");
// locate
const a = L.locate(-23.65, -68.15, G, 60);
check(a.i != null && a.km < 40 && A.cell[a.i] === 76787, `a point in the Atacama falls in cell ${A.cell[a.i]} (${a.km.toFixed(1)} km from its centre)`);
const o = L.locate(0, -30, G, 60);
check(o.i === null && o.km > 500, `a point in the Atlantic is off the land grid (${o.km.toFixed(0)} km)`);
// radii
const counts = L.RADII.map(r => L.cellsWithin(a.i, r, G).length);
check(counts.every((x, k) => k === 0 || x >= counts[k - 1]) && counts[0] >= 1, `cell counts grow with the radius (${counts.join(", ")})`);
check(L.cellsWithin(a.i, 5000, G).length === L.cellsWithin(a.i, 500, G).length, "the radius is capped at 500 km");
check(L.cellsWithin(a.i, 250, G).every(x => x.km <= 250 && Math.abs(L.km(lat[a.i], lon[a.i], lat[x.i], lon[x.i]) - x.km) < 1e-9), "every listed cell lies within the radius");
// profile
const cells = L.cellsWithin(a.i, 250, G), ctx = { at, cells, pct: { lst90: 30 }, rowsFor, marsTid: "mars_jezero", thr };
const prof = L.profile(a.i, ctx), byId = Object.fromEntries(prof.map(r => [r.id, r]));
check(byId.elevation.value === A.elevation[a.i] && byId.lst_diurnal_range.value === A.lst_diurnal_range[a.i], "profile values equal the stack values");
check(prof.every(r => r.unit && r.src.length && r.kind && r.res && r.period), "every variable carries unit, source, measurement type, resolution and period");
check(prof.filter(r => r.completeness != null).every(r => r.completeness >= 0 && r.completeness <= 1), "completeness is a share of the cells in the radius");
const ant = L.locate(-84.5, 172.5, G, 60).i, pa = Object.fromEntries(L.profile(ant, { at, cells: [] }).map(r => [r.id, r]));
check(pa.aridity_class.value === null && pa.aridity_index_raw.value === null && pa.elevation.value != null, "where P/PET is undefined (Antarctica) the aridity values are null, not zero");
const reg = V.registry, un = L.unavailable(reg);
check(un.length >= 8 && un.every(u => u.need.length && u.need.every(x => x.state === "endpoint_unavailable" || x.state === "not_investigated")), "unavailable variables name their blocked sources and states");
// neighbourhood
const nb = L.neighbourhood(a.i, cells, { at });
check(nb.n === cells.length && nb.relief === nb.elevMax.v - nb.elevMin.v && nb.relief > 1000, `neighbourhood relief ${nb.relief.toFixed(0)} m from cell means`);
check(Object.values(nb.zones).reduce((s, x) => s + x, 0) <= cells.length && nb.regions.every(r => r.km <= 250), "zone counts and named regions stay inside the radius");
// discoveries
const disc = L.discoveries(cells, ctx, reg);
const inR = new Set(cells.map(x => x.i));
check(disc.found.length >= 1 && disc.found.every(d => d.cells.every(x => inR.has(x.i)) && d.n <= d.of), `discoveries (${disc.found.map(d => d.id).join(", ")}) cite only cells inside the radius`);
const dt = disc.found.find(d => d.id === "dry_thermal");
check(!dt || dt.cells.every(x => ["arid", "hyper_arid"].includes(V.cls("aridity_class", x.i)) && A.lst_diurnal_range[x.i] >= 30), "the dry-thermal discovery is backed by its measured values");
check(disc.blocked.length === 2 && disc.blocked.every(b => b.need.length), "discoveries that need missing data are listed as blocked");
// comparison
const cmp = L.comparison(rowsFor("mars_jezero", a.i), thr, T.mars_jezero.status);
check(cmp.rows.length === 6 && cmp.similar.length + cmp.partial.length + cmp.different.length + cmp.missing.length === 6, "every dimension falls in exactly one category");
check(cmp.proxy.every(x => T.mars_jezero.status[x] === "PROXY"), "proxy-based comparisons are identified");
const cm = L.comparison(rowsFor("moon_south_pole", ant), thr, T.moon_south_pole.status);
check(cm.missing.includes("annual_temperature_range") && cm.missing.includes("aridity"), "missing data are reported (Moon target, Antarctic cell)");
// precision
const pt = { lat: -23.65432, lon: -68.15678, cellLat: lat[a.i], cellLon: lon[a.i] };
check(L.precise(pt, "exact").lat === -23.6543 && L.precise(pt, "1deg").lat === -24 && L.precise(pt, "cell").lat === +lat[a.i].toFixed(3) && L.precise(pt, "none") === null, "coordinate precision: exact, 1 degree, cell centre, none");
// report
const md = L.report({ title: "T", versions: ["v"], when: "w", location: "L", coords: "c", scale: "s", target: "t", measurements: [{ name: "x", value: "1", unit: "m", src: "s", res: "r", period: "p", kind: "k", comp: "1" }],
  unavailable: ["u"], provenance: ["p"], similar: [], different: [], evidence: ["e"], gaps: ["g"], discoveries: [], applications: ["a"], limits: ["l"], repro: { a: 1 } });
check((md.match(/^## \d+\. /gm) || []).length === 14 && /not a probability/.test(md) && /not the exact spot/.test(md), "the local report has 14 sections and states its limits");

console.log(`\n${n - fails}/${n} V18 Local Impact checks passed`);
process.exit(fails ? 1 : 0);
