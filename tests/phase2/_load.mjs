// Shared loader for Phase II Node tests: real predictor stack, targets, app registry.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export const root = new URL("../..", import.meta.url).pathname;
export const ENG = require(root + "app/frontend/engine.js");
export const LAB = require(root + "app/frontend/phase2/lab_engine.js");
export function load() {
  const info = JSON.parse(fs.readFileSync(root + "data/metadata/stack_build.json"));
  const buf = fs.readFileSync(root + "public/data/stack.bin");
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const T = { float32: Float32Array, uint32: Uint32Array, int16: Int16Array }, A = {};
  for (const L of info.layout) A[L.name] = new T[L.dtype](ab, L.offset, L.length);
  const app = JSON.parse(fs.readFileSync(root + "public/data/app.json"));
  const targets = Object.fromEntries(JSON.parse(fs.readFileSync(root + "data/targets.json")).targets.map(t => [t.id, t]));
  const n = A.cell.length, lat = new Float64Array(n), lon = new Float64Array(n), index = new Int32Array(361 * 576).fill(-1);
  for (let i = 0; i < n; i++) { const c = A.cell[i]; lat[i] = -90 + 0.5 * Math.floor(c / 576); lon[i] = -180 + 0.625 * (c % 576); index[c] = i; }
  return { A, app, targets, n, lat, lon, index, crit: app.criteria.map(c => c.id), ranges: app.ranges };
}
