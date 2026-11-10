// Top distinct candidates (General analogue, equal weights, 300 km rule) for every target with a fingerprint,
// computed with the unchanged engine. Output: data/v19/x/candidate_cells.json (cell ids and roles).
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E = require("../../app/frontend/engine.js");
const root = new URL("../..", import.meta.url).pathname;
const info = JSON.parse(fs.readFileSync(root + "data/metadata/stack_build.json")), buf = fs.readFileSync(root + "public/data/stack.bin");
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), TY = { float32: Float32Array, uint32: Uint32Array, int16: Int16Array }, A = {};
for (const x of info.layout) A[x.name] = new TY[x.dtype](ab, x.offset, x.length);
const N = A.cell.length, lat = new Float64Array(N), lon = new Float64Array(N);
for (let i = 0; i < N; i++) { lat[i] = -90 + 0.5 * Math.floor(A.cell[i] / 576); lon[i] = -180 + 0.625 * (A.cell[i] % 576); }
const app = JSON.parse(fs.readFileSync(root + "public/data/app.json")), T = JSON.parse(fs.readFileSync(root + "public/data/targets.json")).targets;
const CRIT = app.criteria.map(x => x.id), W = Object.fromEntries(CRIT.map(x => [x, 1]));
const K = +(process.argv[2] || 10), out = {};
for (const t of T) {
  if (!t.variables) continue;
  let r; try { r = E.similarity(A, CRIT, t.variables, W, app.ranges); } catch (e) { continue; }
  const eff = r.eff || r; const o = E.order(eff, A.cell); const ks = E.distinctSites(o, lat, lon, K, 300);
  for (const [k, i] of ks.entries()) { const c = A.cell[i]; (out[c] = out[c] || { cell: c, lat: lat[i], lon: lon[i], roles: [] }).roles.push(t.id + "#" + (k + 1)); }
}
const cells = Object.values(out).sort((a, b) => a.cell - b.cell);
fs.mkdirSync(root + "data/v19/x", { recursive: true });
fs.writeFileSync(root + "data/v19/x/candidate_cells.json", JSON.stringify({ schema: "asterro.v19x.candidate_cells/1", rule: "top " + K + " distinct candidates per target, General analogue, equal weights, 300 km separation, engine " + E.ALGORITHM_VERSION, n: cells.length, cells }, null, 0));
console.log(cells.length, "cells from", T.filter(t => t.variables).length, "targets");
