// Real example analyses for docs/v17/EXAMPLES.md, computed with the unchanged engine and the V17 products.
//   node scripts/v17_examples.mjs
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E = require("../app/frontend/engine.js"), V17 = require("../app/frontend/phase4/engine_v17.js");
const root = new URL("..", import.meta.url).pathname;
const c = vm.createContext({}); vm.runInContext(fs.readFileSync(root + "app/frontend/phase4/data_v17.js", "utf8") + "\nthis.D = ASTERRO_V17;", c);
const D = c.D, info = JSON.parse(fs.readFileSync(root + "data/metadata/stack_build.json")), buf = fs.readFileSync(root + "public/data/stack.bin");
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), TY = { float32: Float32Array, uint32: Uint32Array, int16: Int16Array }, A = {};
for (const L of info.layout) A[L.name] = new TY[L.dtype](ab, L.offset, L.length);
const N = A.cell.length, lat = new Float64Array(N), lon = new Float64Array(N);
for (let i = 0; i < N; i++) { lat[i] = -90 + 0.5 * Math.floor(A.cell[i] / 576); lon[i] = -180 + 0.625 * (A.cell[i] % 576); }
const app = JSON.parse(fs.readFileSync(root + "public/data/app.json")), T = Object.fromEntries(JSON.parse(fs.readFileSync(root + "public/data/targets.json")).targets.map(t => [t.id, t]));
const labels = JSON.parse(fs.readFileSync(root + "public/data/labels.json"));
const CRIT = app.criteria.map(x => x.id), W = Object.fromEntries(CRIT.map(x => [x, 1])), thr = app.thresholds;
const V = V17.create(D, N);
const place = i => { const r = A.region ? A.region[i] : -1, k = A.country ? A.country[i] : -1; return [r >= 0 ? labels.region[r] : null, k >= 0 ? labels.country[k] : null].filter(Boolean).join(", ") || "unlabelled land cell"; };
const out = [];
for (const [mode, tid] of [["mars_unexpected", "mars_jezero"], ["polar", "moon_south_pole"], ["one_dimension", "mars_jezero"], ["hidden", "mars_jezero"]]) {
  const f = E.similarity(A, CRIT, T[tid].variables, W, app.ranges);
  const rows = i => E.detail(A, CRIT, i, T[tid].variables, W, app.ranges).rows.map(r => ({ c: r.c, e: r.e, t: r.t, s: r.s == null || r.s !== r.s ? null : r.s }));
  const card = V.surprise(mode, { n: N, lat, lon, eff: f.eff, A, rows, thr, draw: 0, tid, coverage: i => f.coverage[i] });
  const i = card.i, mods = V.modules(i, { A });
  out.push({ mode, target: tid, target_name: T[tid].name, status: T[tid].status, cell: A.cell[i], place: place(i), lat: lat[i], lon: lon[i], eff: card.eff, coverage: f.coverage[i], pool: card.pool,
    rows: card.rows, match: card.match.map(r => r.c), part: card.part.map(r => r.c), diff: card.diff.map(r => r.c), missing: card.miss.map(r => r.c), novelty: card.novelty, pattern: card.pattern,
    modules: mods.filter(m => m.status !== "blocked").map(m => ({ id: m.id, values: Object.fromEntries(m.rows.map(r => [r.var, r.value])), evidence: m.evidence })), blocked: mods.filter(m => m.status === "blocked").map(m => m.id) });
}
fs.writeFileSync(root + "docs/v17/examples.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.map(o => [o.mode, o.place, o.target, +o.eff.toFixed(3), o.novelty.cls]), null, 0));
