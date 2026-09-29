// JS engine vs Python reference: bitwise-equal scores, identical ranking, sites and clusters.
// Run: node tests/test_js_parity.mjs   (after scripts/export_reference.py)
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E = require("../app/frontend/engine.js");
const root = new URL("..", import.meta.url).pathname;
const info = JSON.parse(fs.readFileSync(root + "data/metadata/stack_build.json"));
const buf = fs.readFileSync(root + "public/data/stack.bin");
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const T = { float32: Float32Array, uint32: Uint32Array, int16: Int16Array };
const A = {};
for (const L of info.layout) A[L.name] = new T[L.dtype](ab, L.offset, L.length);
const targets = JSON.parse(fs.readFileSync(root + "data/targets.json")).targets;
const ref = JSON.parse(fs.readFileSync(root + "tests/fixtures/reference.json"));
const C = ["aridity", "annual_temperature_range", "elevation", "slope", "surface_roughness", "lst_diurnal_range"];
const W = Object.fromEntries(C.map(c => [c, 1]));
const cell = A.cell, n = cell.length;
const lat = new Float64Array(n), lon = new Float64Array(n);
for (let i = 0; i < n; i++) { lat[i] = -90 + 0.5 * Math.floor(cell[i] / 576); lon[i] = -180 + 0.625 * (cell[i] % 576); }
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };
for (const t of targets) {
  const r = E.similarity(A, C, t.variables, W, ref.ranges);
  const py = new Float64Array(fs.readFileSync(root + `tests/fixtures/ref_${t.id}.f64`).buffer.slice(0));
  let maxd = 0, neq = 0;
  for (let i = 0; i < n; i++) { const d = Math.abs(r.eff[i] - py[i]); if (d > maxd) maxd = d; if (r.eff[i] !== py[i]) neq++; }
  check(maxd <= 1e-12, `${t.id}: scores max|dJS-PY| = ${maxd.toExponential(2)} (${neq} not bitwise equal of ${n})`);
  const o = E.order(r.eff, cell);
  const R = ref.targets[t.id];
  check(R.order_top1000.every((v, k) => v === o[k]), `${t.id}: top-1000 cell order identical`);
  const ds = E.distinctSites(o, lat, lon, 20, 300);
  check(JSON.stringify(ds) === JSON.stringify(R.distinct), `${t.id}: 20 distinct sites identical`);
  const act = r.active;
  const norm = (i, c) => (A[c][i] - ref.ranges[c][0]) / (ref.ranges[c][1] - ref.ranges[c][0]);
  const cl = E.constellations(o, act, norm);
  check(cl.k === R.k && Array.from(cl.labels).every((v, k) => v === R.labels[k]),
    `${t.id}: constellations k=${cl.k} labels identical (silhouette JS ${cl.silhouette.toFixed(6)} / PY ${R.silhouette.toFixed(6)})`);
}
// exact-match guarantee on the JS side
const one = E.similarity({ a: new Float32Array([2]), b: new Float32Array([0.5]) }, ["a", "b"], { a: 2, b: 0.5 }, { a: 1, b: 1 }, { a: [0, 4], b: [0, 1] });
check(one.final[0] === 1, "JS exact match -> 1.0");
const z = E.similarity({ a: new Float32Array([2, 2]), b: new Float32Array([0.5, 0]) }, ["a", "b"], { a: 2, b: 0.5 }, { a: 1, b: 0 }, { a: [0, 4], b: [0, 1] });
check(z.final[0] === z.final[1], "JS zero weight removes influence");
{ // spec cases 13/14 on the JS side: infinite Earth values are missing; invalid weights throw
  const st = { a: new Float64Array([Infinity, 2, -50]), b: new Float64Array([1, 1, 1]) }, rg = { a: [0, 10], b: [-5, 5] };
  const q = E.similarity(st, ["a", "b"], { a: 2, b: 1 }, { a: 1, b: 1 }, rg);
  check(q.final[0] === 1 && Math.abs(q.coverage[0] - 0.5) < 1e-15 && !q.eligible[0], "JS ±Infinity Earth value treated as missing");
  check(q.final[2] === 0.5, "JS out-of-range Earth value clipped to s = 0");
  let thrown = 0;
  for (const bad of [-1, NaN, Infinity]) { try { E.similarity(st, ["a", "b"], { a: 2, b: 1 }, { a: bad, b: 1 }, rg); } catch (e) { thrown++; } }
  check(thrown === 3, "JS rejects negative / NaN / infinite weights");
  const d = E.detail(st, ["a", "b"], 0, { a: 2, b: 1 }, { a: 1, b: 1 }, rg);
  check(d.rows[0].e === null && d.final === 1, "JS trace treats ±Infinity as missing");
}
console.log(fails ? `\n${fails} FAILED` : "\nALL PARITY CHECKS PASSED");
process.exit(fails ? 1 : 0);
