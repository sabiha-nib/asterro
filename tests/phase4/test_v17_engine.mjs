// V17 discovery engine (Node). Run: node tests/phase4/test_v17_engine.mjs
// app/frontend/phase4/engine_v17.js over the embedded V17 documents (data_v17.js) and the real stack (stack.bin) with
// the unchanged baseline engine: decoding, modules, diversity methods, Surprise me modes, challenges, report.
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E = require("../../app/frontend/engine.js");
const V17 = require("../../app/frontend/phase4/engine_v17.js");
const root = new URL("../..", import.meta.url).pathname;
let fails = 0, n = 0;
const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };

const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(root + "app/frontend/phase4/data_v17.js", "utf8") + "\nthis.D = ASTERRO_V17;", ctx);
const D = ctx.D;
const info = JSON.parse(fs.readFileSync(root + "data/metadata/stack_build.json"));
const buf = fs.readFileSync(root + "public/data/stack.bin");
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const TY = { float32: Float32Array, uint32: Uint32Array, int16: Int16Array };
const A = {};
for (const L of info.layout) A[L.name] = new TY[L.dtype](ab, L.offset, L.length);
const N = A.cell.length;
const lat = new Float64Array(N), lon = new Float64Array(N);
for (let i = 0; i < N; i++) { lat[i] = -90 + 0.5 * Math.floor(A.cell[i] / 576); lon[i] = -180 + 0.625 * (A.cell[i] % 576); }
const app = JSON.parse(fs.readFileSync(root + "public/data/app.json")), targets = JSON.parse(fs.readFileSync(root + "public/data/targets.json"));
const CRIT = app.criteria.map(c => c.id), thr = app.thresholds;
const T = Object.fromEntries((Array.isArray(targets) ? targets : targets.targets).map(t => [t.id, t]));
const W = Object.fromEntries(CRIT.map(c => [c, 1]));
const field = tid => E.similarity(A, CRIT, T[tid].variables, W, app.ranges, thr.min_coverage);
const rowsFor = tid => i => E.detail(A, CRIT, i, T[tid].variables, W, app.ranges).rows.map(r => ({ c: r.c, e: r.e, t: r.t, s: r.s == null || r.s !== r.s ? null : r.s }));

const V = V17.create(D, N);
check(V.VERSION === "tai-v17-discovery-1.0.0", "engine version");
let threw = false; try { V17.create(D, N - 1); } catch (e) { threw = true; }
check(threw, "a cube built for another stack is refused");

// decoding: missing stays null, never 0
let nullAr = 0, zeroAr = 0;
for (let i = 0; i < N; i++) { const a = A.aridity[i]; const c = V.cls("aridity_class", i); if (a !== a) { if (c === null) nullAr++; } else if (c === null) zeroAr++; }
check(nullAr > 10000 && zeroAr === 0, `aridity zone is null exactly where aridity is missing (${nullAr} null)`);
const fz = []; for (let i = 0; i < N; i++) fz.push(V.val("freeze_months", i));
check(fz.every(x => x != null && x >= 0 && x <= 12 && Number.isInteger(x)), "freeze months decode to whole months 0-12");
let pnBad = 0; for (let i = 0; i < N; i++) { const p = V.val("polar_night_months", i); if (p > 0 && Math.abs(lat[i]) < 65) pnBad++; }
check(pnBad === 0, "no polar night equatorward of 65 deg");

// novelty and patterns
const cls = {}; for (let i = 0; i < N; i++) { const c = V.novelty(i).cls; cls[c] = (cls[c] || 0) + 1; }
check(Object.entries(D.patterns.novelty.counts).every(([k, v]) => (cls[k] || 0) === v), "novelty classes decode to the published counts");
let insuffOk = true; for (let i = 0; i < N; i++) { const miss = CRIT.some(c => { const x = A[c][i]; return x !== x; }); if (miss !== (V.novelty(i).cls === "insufficient")) { insuffOk = false; break; } }
check(insuffOk, "novelty is 'insufficient' exactly where a baseline condition is missing");
const hid = D.patterns.ml.hidden_cells;
check(hid.length > 0 && hid.every(i => V.pattern(i) && V.pattern(i).hidden), `${hid.length} hidden-combination cells flagged`);

// modules
const sel = field("mars_jezero"), order = []; for (let i = 0; i < N; i++) if (sel.eff[i] >= 0) order.push(i);
order.sort((a, b) => (sel.eff[b] - sel.eff[a]) || (A.cell[a] - A.cell[b]));
const top = order[0];
const mods = V.modules(top, { A, gentle5: () => 0.5, noon: () => 60, ops: () => [{ id: "x", mean: 0.9, k: "similar" }] });
check(mods.length === 10, "ten domain modules");
check(mods.filter(m => m.status === "blocked").every(m => m.rows.length === 0 && m.completeness === null && m.blocked.length > 0), "blocked modules give no values and name what blocks them");
const th = mods.find(m => m.id === "thermal");
check(th.rows.find(r => r.var === "lst_diurnal_range").value === A.lst_diurnal_range[top] && th.evidence.direct >= 1, "thermal module reads the stack values and counts direct evidence");
const hc = mods.find(m => m.id === "hydro_cryo");
check(hc.rows.some(r => r.kind === "proxy") && hc.rows.find(r => r.var === "maat_below_zero").kind === "proxy", "freeze-thaw and permafrost-climate indicators are labelled proxies");
const missI = (() => { for (let i = 0; i < N; i++) if (A.aridity[i] !== A.aridity[i]) return i; })();
const hm = V.module("hydro_cryo", missI, { A });
check(hm.rows.find(r => r.var === "aridity_class").value === null && hm.completeness < 1, "a missing input lowers completeness instead of becoming zero");

// diversity
const d300 = V.diversify(order.slice(0, 4000), lat, lon, { method: "km", km: 300, n: 20 });
const minKm = Math.min(...d300.flatMap((i, a) => d300.slice(a + 1).map(j => V17.km(lat[i], lon[i], lat[j], lon[j]))));
check(d300.length === 20 && minKm >= 300, `custom-distance diversity keeps >= 300 km (${minKm.toFixed(0)} km)`);
const d1000 = V.diversify(order.slice(0, 4000), lat, lon, { method: "km", km: 1000, n: 20 });
const minK2 = Math.min(...d1000.flatMap((i, a) => d1000.slice(a + 1).map(j => V17.km(lat[i], lon[i], lat[j], lon[j]))));
check(minK2 >= 1000, `1000 km separation honoured (${minK2.toFixed(0)} km)`);
const dr = V.diversify(order.slice(0, 4000), lat, lon, { method: "region", label: i => A.country ? A.country[i] : null, n: 20 });
check(new Set(dr.map(i => A.country[i])).size === dr.length, "one per country");
const feat = i => CRIT.map(c => { const x = A[c][i], r = app.ranges[c]; return x === x ? (x - r[0]) / (r[1] - r[0]) : 0.5; });
const m1 = V.diversify(order.slice(0, 4000), lat, lon, { method: "mmr", lambda: 1, feat, score: i => sel.eff[i], n: 10 });
check(JSON.stringify(m1) === JSON.stringify(order.slice(0, 10)), "MMR with weight 1 equals the plain similarity order");
const m5 = V.diversify(order.slice(0, 4000), lat, lon, { method: "mmr", lambda: 0.5, feat, score: i => sel.eff[i], n: 10 });
const m5b = V.diversify(order.slice(0, 4000), lat, lon, { method: "mmr", lambda: 0.5, feat, score: i => sel.eff[i], n: 10 });
check(JSON.stringify(m5) === JSON.stringify(m5b) && m5[0] === order[0], "MMR is deterministic and starts from the best cell");

// Surprise me
const sctx = (tid, draw) => ({ n: N, lat, lon, eff: field(tid).eff, A, rows: rowsFor(tid), thr, draw, tid, coverage: () => 1 });
const c1 = V.surprise("mars_unexpected", sctx("mars_jezero", 0)), c1b = V.surprise("mars_unexpected", sctx("mars_jezero", 0));
check(c1 && c1.i != null && c1.i === c1b.i, "a draw is deterministic for the same draw number");
check(["outside_distinct", "outside_rare"].includes(c1.novelty.cls), "an 'unexpected' analogue is unlike and far from the listed sites");
const effJ = field("mars_jezero").eff, sortedE = Array.from(effJ).filter(x => x >= 0).sort((a, b) => a - b), p98 = sortedE[Math.floor(0.98 * (sortedE.length - 1))];
check(c1.eff >= p98, `it is in the top 2 % of cells for the target (${c1.eff.toFixed(3)} >= ${p98.toFixed(3)})`);
check(c1.match.every(r => r.s >= thr.match) && c1.diff.every(r => r.s < thr.partial), "matches and mismatches follow the thresholds");
const c2 = V.surprise("mars_unexpected", sctx("mars_jezero", 1));
check(c2.i !== c1.i, "the next draw gives another place");
const cp = V.surprise("polar", sctx("moon_south_pole", 0));
check(cp.i != null && V.val("polar_night_months", cp.i) >= 2 && V.val("freeze_months", cp.i) >= 10, "polar mode: polar night and long freezing");
const ch = V.surprise("hidden", sctx("mars_jezero", 0));
check(ch.i != null && D.patterns.ml.hidden_cells.includes(ch.i), "hidden mode draws a flagged combination");
const c1d = V.surprise("one_dimension", sctx("mars_jezero", 0));
check(c1d.i != null && c1d.match.length === 1 && c1d.part.length === 0, "one-condition mode: exactly one similar condition");
for (const m of ["geology", "water_history", "dust_wind", "subsurface"]) {
  const u = V.surprise(m, sctx("mars_jezero", 0));
  check(u.unavailable && u.blocked.length && u.blocked.every(b => b.state !== "integrated_validated"), `${m}: unavailable, with the blocking sources (no invented result)`);
}
// challenges and interpretation
const r1 = V.challenge("single_dimension", c1d.i, sctx("mars_jezero", 0));
check(r1.ok === true, "the one-condition place passes the one-question challenge");
const r2 = V.challenge("beyond_famous", c1.i, sctx("mars_jezero", 0));
check(r2.ok === true, "the unexpected analogue passes 'beyond the famous sites'");
const md = V.mostDifferent(c1.rows), lowest = c1.rows.filter(r => r.s != null).sort((a, b) => a.s - b.s)[0].c;
check(md === lowest, "the interpretation answer is the lowest similarity");

// report
const md2 = V17.report({ title: "T", question: "Q", when: "now", versions: ["a"], target: { id: "mars_jezero", name: "Jezero", body: "mars" }, place: { name: "P", coords: "0, 0", cell: 1 },
  scale: "s", sources: ["x"], dataVersions: ["v"], measurements: [{ c: "Aridity", e: 0.1, t: 0, kind: "PROXY", src: "nasa_power" }], method: ["m"], result: "r", similar: [], different: ["d"],
  uncertainty: ["u"], missing: [], relevance: ["x"], limits: ["l"], conclusion: "c", repro: { a: 1 }, refs: ["r"] });
check((md2.match(/^## \d+\. /gm) || []).length === 20, "the research report has 20 numbered sections");
check(/not a probability/.test(md2), "the report states that similarity is not a probability");

console.log(`\n${n - fails}/${n} V17 engine checks passed`);
process.exit(fails ? 1 : 0);
