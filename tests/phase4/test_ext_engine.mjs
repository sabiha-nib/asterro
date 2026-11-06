// Extended fingerprint (explore-ext-thermal-v1) tests (Node). Run: node tests/phase4/test_ext_engine.mjs
// The browser port (app/frontend/phase4/ext_engine.js) against the Python reference (src/ext/engine.py, fixture written
// by scripts/export_ext_reference.py); the thermal document against the published baseline; invariants.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E = require("../../app/frontend/engine.js");
const X = require("../../app/frontend/phase4/ext_engine.js");
const root = new URL("../..", import.meta.url).pathname;
let fails = 0, n = 0;
const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };

const info = JSON.parse(fs.readFileSync(root + "data/metadata/stack_build.json"));
const buf = fs.readFileSync(root + "public/data/stack.bin");
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const TY = { float32: Float32Array, uint32: Uint32Array, int16: Int16Array };
const A = {};
for (const L of info.layout) A[L.name] = new TY[L.dtype](ab, L.offset, L.length);
const BASE = ["aridity", "annual_temperature_range", "elevation", "slope", "surface_roughness", "lst_diurnal_range"];
const CRIT = BASE.concat(X.EXT);
const cell = A.cell, N = cell.length, lat = new Float64Array(N), lon = new Float64Array(N);
for (let i = 0; i < N; i++) { lat[i] = -90 + 0.5 * Math.floor(cell[i] / 576); lon[i] = -180 + 0.625 * (cell[i] % 576); }
const st = X.stack(A, BASE);
const doc = JSON.parse(fs.readFileSync(root + "public/data/ext/thermal_ext.json"));
const ref = JSON.parse(fs.readFileSync(root + "tests/fixtures/ext_reference.json"));

// ---- thermal document: honest construction
check(doc.version === "tai-ext-thermal-1.0.0" && doc.dims.join() === X.EXT.join(), "thermal document: version tai-ext-thermal-1.0.0, three criteria");
const ids = Object.keys(doc.targets);
check(ids.length >= 16, `thermal values for the ${ids.length} targets whose day–night range is a direct measurement`);
const drBad = ids.filter(id => { const t = doc.targets[id]; return Math.abs((t.surface_temp_day - t.surface_temp_night) - t.published_lst_diurnal_range) > 1e-3; });
check(!drBad.length, `day − night reproduces every target's published lst_diurnal_range (≤ 0.001 K; ${drBad})`);
const moonAir = ids.filter(id => id.startsWith("moon_")).every(id => doc.targets[id].mean_air_temperature === null && doc.targets[id].status.mean_air_temperature === "N/A");
check(moonAir, "Moon: mean air temperature is NOT APPLICABLE (null, status N/A) — never 0, never estimated");
check(ids.filter(id => id.startsWith("mars_")).every(id => doc.targets[id].mean_air_temperature > 150 && doc.targets[id].mean_air_temperature < 260), "Mars air temperatures are physically plausible (150–260 K)");
for (const c of X.EXT) { const [lo, hi] = X.earthRange(st[c]); check(Math.abs(lo - doc.earth_range[c].min) < 1e-6 && Math.abs(hi - doc.earth_range[c].max) < 1e-6, `Earth range of ${c} [${lo.toFixed(1)}, ${hi.toFixed(1)}] K equals the document's`); }

// ---- parity with the Python reference
for (const k of ref.cases) {
  const tv6 = Object.fromEntries(BASE.map(c => [c, k.tv[c]])), r6 = Object.fromEntries(BASE.map(c => [c, k.ranges[c]]));
  const T = X.target(tv6, r6, doc.targets[k.tid], st);
  const rOk = CRIT.every(c => Math.abs(T.ranges[c][0] - k.ranges[c][0]) < 1e-9 && Math.abs(T.ranges[c][1] - k.ranges[c][1]) < 1e-9) && X.EXT.every(c => (T.tv[c] ?? null) === (k.tv[c] ?? null));
  check(rOk, `${k.tid}: nine target values and ranges equal the Python reference`);
  const f = X.field(E, st, CRIT, T.tv, k.weights, T.ranges, cell, lat, lon, 20, 300);
  check(JSON.stringify(f.sites) === JSON.stringify(k.sites), `${k.tid}: 20 distinct sites identical to Python`);
  const md = Math.max(...k.sites.map((i, j) => Math.abs(f.eff[i] - k.eff_sites[j])));
  check(md <= 1e-12, `${k.tid}: scores at those sites equal (max |Δ| ${md.toExponential(1)})`);
  check(k.order_top200.every((v, j) => v === f.order[j]), `${k.tid}: top-200 cell order identical`);
  let ne = 0, sum = 0; for (let i = 0; i < N; i++) if (f.eff[i] >= 0) { ne++; sum += f.eff[i]; }
  check(ne === k.n_eligible && Math.abs(sum - k.eff_sum) < 1e-6, `${k.tid}: ${ne} eligible cells, score sum equal`);
  check(JSON.stringify(f.res.active) === JSON.stringify(k.active), `${k.tid}: active criteria ${f.res.active.length} (${k.tid.startsWith("moon_") ? "air temperature excluded: not applicable" : "all nine"})`);
}
check(ref.zero_ext_equals_baseline, "Python: with the three new weights at 0 the extended field IS the baseline field");
{ // the same on the JS side
  const k = ref.cases[0], tv6 = Object.fromEntries(BASE.map(c => [c, k.tv[c]])), r6 = Object.fromEntries(BASE.map(c => [c, k.ranges[c]]));
  const T = X.target(tv6, r6, doc.targets[k.tid], st), w = Object.fromEntries(BASE.map(c => [c, 1]));
  const a = E.similarity(st, CRIT, T.tv, { ...w, surface_temp_day: 0, surface_temp_night: 0, mean_air_temperature: 0 }, T.ranges);
  const b = E.similarity(A, BASE, tv6, w, r6);
  let same = true; for (let i = 0; i < N; i++) if (a.eff[i] !== b.eff[i]) { same = false; break; }
  check(same, "JS: with the three new weights at 0 the extended field equals the baseline field bit for bit");
  // rows: where Earth stops
  const top = ref.cases[0].sites[0], R = X.rows(st, top, T.tv, T.ranges, Object.fromEntries(X.EXT.map(c => [c, X.earthRange(st[c])])));
  const night = R.find(r => r.c === "surface_temp_night");
  check(night.outside === "below" && night.gap > 10, `Jezero night surface temperature (${night.t.toFixed(1)} K) lies below every Earth cell — a ${night.gap.toFixed(1)} K gap, reported, not hidden`);
  const cl = X.closest(st.mean_air_temperature, T.tv.mean_air_temperature, cell);
  check(cl.i >= 0 && Math.abs(cl.diff) < 1, `closest Earth air temperature to Jezero's ${T.tv.mean_air_temperature.toFixed(2)} K: ${(T.tv.mean_air_temperature + cl.diff).toFixed(2)} K at cell #${cell[cl.i]}`);
  // coverage sweep
  const sw = X.coverageSweep(E, a, cell, lat, lon, [0.6, 0.8, 1.0], 10, 300);
  check(sw.length === 3 && sw[0].eligible >= sw[1].eligible && sw[1].eligible >= sw[2].eligible, `coverage sweep: eligible cells fall as the threshold rises (${sw.map(s => s.eligible).join(" ≥ ")})`);
  const base08 = E.distinctSites(E.order(a.eff, cell), lat, lon, 10, 300);
  check(JSON.stringify(sw[1].sites) === JSON.stringify(base08), "coverage sweep at 0.80 reproduces the standard ranking");
}
// ---- configuration identifiers
const c1 = X.configId({ a: 1, b: [1, 2] }), c2 = X.configId({ b: [1, 2], a: 1 }), c3 = X.configId({ a: 1, b: [2, 1] });
check(c1 === c2 && c1 !== c3 && /^cfg-[0-9a-f]{16}$/.test(c1), `configuration identifiers are deterministic and key-order independent (${c1})`);

console.log(`\n${n - fails}/${n} extension checks passed`);
process.exitCode = fails ? 1 : 0;
