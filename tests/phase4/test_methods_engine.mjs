// Mismatch Signature + Method Arena engine tests (Node). Run: node tests/phase4/test_methods_engine.mjs [--write-fixture]
// Synthetic arrays are known-answer test inputs only; everything else runs on the real predictor stack.
import fs from "node:fs";
import { createRequire } from "node:module";
import { ENG, load, root } from "../phase2/_load.mjs";
const require = createRequire(import.meta.url);
const M = require(root + "app/frontend/phase4/methods_engine.js");

let fails = 0, n = 0;
const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };
const throws = (f, msg) => { let t = false; try { f(); } catch (e) { t = true; } check(t, msg); };
const D = load(), crit = D.crit, cell = D.A.cell, W0 = D.app.profiles.general.weights, thr = D.app.thresholds;
const reg = JSON.parse(fs.readFileSync(root + "public/data/registry.json")), RT = Object.fromEntries(reg.targets.map(t => [t.id, t]));
const regV = t => Object.fromEntries(crit.map(c => [c, ["DIRECT", "PROXY"].includes(t.fingerprint.criterion_status[c]) ? t.fingerprint.variables[c] : null]));
const CASES = { mars_jezero: [D.targets.mars_jezero.variables, D.ranges], moon_south_pole: [D.targets.moon_south_pole.variables, D.ranges],
  moon_shackleton: [regV(RT.moon_shackleton), RT.moon_shackleton.scoring.explore_ranges], mars_gale_curiosity: [regV(RT.mars_gale_curiosity), RT.mars_gale_curiosity.scoring.explore_ranges] };

// ---------------------------------------------------------------- 1 baseline is the unchanged engine
for (const [tid, [tv, R]] of Object.entries(CASES)) {
  const a = ENG.similarity(D.A, crit, tv, W0, R).eff, b = M.score("baseline", { A: D.A, critIds: crit, tv, w: W0, ranges: R });
  let d = 0; for (let i = 0; i < D.n; i++) if (!Object.is(a[i], b[i])) d++;
  check(d === 0, `${tid}: arena "baseline" = baseline engine bit for bit (${d} differences)`);
}
// ---------------------------------------------------------------- 2 known-answer and property tests (synthetic inputs)
{
  const A = { x: Float32Array.from([0, 1, 2, 3]), y: Float32Array.from([10, NaN, 30, 40]) }, R = { x: [0, 3], y: [10, 40] };
  const q = M.score("quantile", { A, critIds: ["x"], tv: { x: 1 }, w: { x: 1 }, ranges: R });
  check(Math.abs(q[3] - 0.5) < 1e-15 && q[1] === 1, "quantile known answer: F(1)=0.375, F(3)=0.875 → s=0.5; exact match → 1");
  const qs = M.score("quantile", { A, critIds: ["x"], tv: { x: 99 }, w: { x: 1 }, ranges: R });
  check(Math.abs(qs[3] - 0.875) < 1e-15 && Math.abs(qs[0] - 0.125) < 1e-15, "quantile: a target above every Earth value maps to F = 1 (mid-rank F(3) = 7/8 → s = 0.875; F(0) = 1/8 → s = 0.125)");
  const mn = M.score("minimum", { A, critIds: ["x", "y"], tv: { x: 0, y: 40 }, w: { x: 1, y: 1 }, ranges: R });
  check(mn[0] === 0 && mn[3] === 0 && Math.abs(mn[2] - 1 / 3) < 1e-12, "minimum known answer: S = min_c s_c");
  const st = M.score("strict", { A, critIds: ["x", "y"], tv: { x: 0, y: 40 }, w: { x: 1, y: 1 }, ranges: R }), bl = M.score("baseline", { A, critIds: ["x", "y"], tv: { x: 0, y: 40 }, w: { x: 1, y: 1 }, ranges: R });
  check(st[1] === -1 && bl[1] === -1, "missing Earth value: coverage 50 % < 80 % → ineligible in baseline and strict (never scored as 0)");
  const A3 = { x: Float32Array.from([0, 1, 2]), y: Float32Array.from([5, NaN, 5]), z: Float32Array.from([1, 1, 1]), u: Float32Array.from([2, 2, 2]), v: Float32Array.from([3, 3, 3]) };
  const R3 = { x: [0, 2], y: [0, 10], z: [0, 2], u: [0, 4], v: [0, 6] }, w3 = { x: 1, y: 1, z: 1, u: 1, v: 1 }, t3 = { x: 0, y: 5, z: 1, u: 2, v: 3 };
  const b3 = M.score("baseline", { A: A3, critIds: Object.keys(A3), tv: t3, w: w3, ranges: R3 }), s3 = M.score("strict", { A: A3, critIds: Object.keys(A3), tv: t3, w: w3, ranges: R3 });
  check(b3[1] >= 0 && s3[1] === -1 && s3[0] === b3[0], "strict: coverage 80 % is eligible in baseline, ineligible in strict; full-coverage cells are identical");
  throws(() => M.score("minimum", { A: { x: Float32Array.from([1, 1]) }, critIds: ["x"], tv: { x: 1 }, w: { x: 1 }, ranges: { x: [1, 1] } }), "degenerate (constant) normalisation range is refused, not divided by zero");
  throws(() => M.score("quantile", { A, critIds: ["x"], tv: { x: 1 }, w: { x: -1 }, ranges: R }), "negative weight refused");
  throws(() => M.score("nope", { A, critIds: ["x"], tv: { x: 1 }, w: { x: 1 }, ranges: R }), "unknown method refused");
}
{
  const [tv, R] = CASES.mars_jezero;
  // monotone transform invariance: quantile scores do not change under a monotone re-expression of a criterion; the baseline does
  // float64 keeps the re-expression strictly monotone (float32 would merge distinct values into ties)
  const A2 = { ...D.A, surface_roughness: Float64Array.from(D.A.surface_roughness, v => v - v === 0 ? Math.log1p(v) : v) };
  const tv2 = { ...tv, surface_roughness: Math.log1p(tv.surface_roughness) }, R2 = { ...R, surface_roughness: [Math.log1p(R.surface_roughness[0]), Math.log1p(R.surface_roughness[1])] };
  const q1 = M.score("quantile", { A: D.A, critIds: crit, tv, w: W0, ranges: R }), q2 = M.score("quantile", { A: A2, critIds: crit, tv: tv2, w: W0, ranges: R2 });
  const b1 = M.score("baseline", { A: D.A, critIds: crit, tv, w: W0, ranges: R }), b2 = M.score("baseline", { A: A2, critIds: crit, tv: tv2, w: W0, ranges: R2 });
  let dq = 0, db = 0; for (let i = 0; i < D.n; i++) { if (Math.abs(q1[i] - q2[i]) > 1e-12) dq++; if (Math.abs(b1[i] - b2[i]) > 1e-9) db++; }
  check(dq === 0 && db > 1000, `quantile is invariant to a monotone (log) re-expression of roughness (${dq} changes); the baseline is not (${db} changes)`);
  const mn = M.score("minimum", { A: D.A, critIds: crit, tv, w: W0, ranges: R });
  let viol = 0; for (let i = 0; i < D.n; i++) if (mn[i] >= 0 && b1[i] >= 0 && mn[i] > b1[i] + 1e-12) viol++;
  check(viol === 0, "minimum ≤ baseline weighted mean for every cell");
  const w0 = { ...W0, elevation: 0 }, wz = { ...W0, elevation: 0 }; const A4 = { ...D.A, elevation: Float32Array.from(D.A.elevation, v => v * 3 + 7) };
  let dz = 0; for (const m of ["baseline", "quantile", "minimum", "strict"]) { const a = M.score(m, { A: D.A, critIds: crit, tv, w: w0, ranges: R }), b = M.score(m, { A: A4, critIds: crit, tv, w: wz, ranges: R }); for (let i = 0; i < D.n; i++) if (!Object.is(a[i], b[i])) dz++; }
  check(dz === 0, "a zero-weight criterion has no influence under any method (its data were altered: 0 changes)");
  const s1 = M.score("strict", { A: D.A, critIds: crit, tv, w: W0, ranges: R });
  let sub = true, eq = true; for (let i = 0; i < D.n; i++) { if (s1[i] >= 0 && !(b1[i] >= 0)) sub = false; if (s1[i] >= 0 && !Object.is(s1[i], b1[i])) eq = false; }
  check(sub && eq, "strict-eligible ⊆ baseline-eligible, with identical scores where eligible");
}
// ---------------------------------------------------------------- 3 rank agreement
{
  const e = Float64Array.from([0.1, 0.5, 0.9, 0.3]), c = Int32Array.from([0, 1, 2, 3]);
  check(M.spearman(e, e, c).rho === 1 && M.spearman(e, Float64Array.from(e, x => 1 - x), c).rho === -1, "Spearman: identical → 1, reversed → −1");
}
// ---------------------------------------------------------------- 4 arena on real targets
const fixture = { methods: Object.keys(M.METHODS), cases: {} };
for (const tid of ["mars_jezero", "moon_shackleton"]) {
  const [tv, R] = CASES[tid], t0 = Date.now();
  const AR = M.arena({ A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, tv, w: W0, ranges: R });
  const ms = Date.now() - t0;
  check(AR.pairs.length === 6 && AR.pairs.every(p => p.rho == null || (p.rho >= -1 && p.rho <= 1)), `${tid}: arena compares 4 methods pairwise (6 pairs, ρ in [−1, 1]); ${ms} ms`);
  check(AR.leaders.every(l => l.ranks.baseline === AR.results.baseline.rank[l.i]), `${tid}: leader ranks are the engine's ranks`);
  check(AR.robust.every(i => AR.methods.every(m => AR.results[m].rank[i] > 0 && AR.results[m].rank[i] <= 100)), `${tid}: method-robust sites are in the top 100 under every method (${AR.robust.length} distinct sites from ${AR.robustPool} cells)`);
  const AR2 = M.arena({ A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, tv, w: W0, ranges: R });
  check(JSON.stringify(AR2.pairs) === JSON.stringify(AR.pairs) && JSON.stringify(AR2.robust) === JSON.stringify(AR.robust), `${tid}: arena is deterministic`);
  fixture.cases[tid] = { weights: W0, ranges: R, target: tv, methods: Object.fromEntries(AR.methods.map(m => [m, { n_eligible: AR.results[m].nEligible, top: AR.results[m].top.slice(0, 10).map(i => ({ cell_id: cell[i], score: +AR.results[m].eff[i].toFixed(12) })) }])),
    pairs: AR.pairs.map(p => ({ a: p.a, b: p.b, rho: p.rho, leading_overlap: p.leadingOverlap })) };
  console.log("INFO", tid, AR.pairs.map(p => `${p.a}/${p.b} ρ=${p.rho.toFixed(3)} overlap ${p.leadingOverlap}/10`).join(" · "));
}
// ---------------------------------------------------------------- 5 signatures
{
  check(M.code(0.15, thr) === "≈" && M.code(0.1500001, thr) === "+" && M.code(-0.4, thr) === "−" && M.code(-0.41, thr) === "−−" && M.code(null, thr) === "?", "signature codes follow the baseline match / partial thresholds (|δ| 0.15 / 0.40)");
  const [tv, R] = CASES.mars_jezero, eff = ENG.similarity(D.A, crit, tv, W0, R).eff;
  const F = M.families({ A: D.A, critIds: crit, tv, w: W0, ranges: R, eff, cell, lat: D.lat, lon: D.lon, thr });
  check(F.families.reduce((t, f) => t + f.size, 0) === F.nEligible, `families partition every eligible cell exactly (${F.nFamilies} families over ${F.nEligible} cells)`);
  let okK = true; for (const f of F.families.slice(0, 15)) for (const i of f.cells.slice(0, 40)) if (M.keyOf(M.signatureOf(D.A, crit, tv, W0, R, i, thr)) !== f.key) okK = false;
  check(okK, "every sampled member's own signature equals its family key");
  check(F.families.every(f => f.cells.every(i => eff[i] <= f.bestScore)), "family best = highest score in the family");
  check(F.families[0].best === ENG.distinctSites(ENG.order(eff, cell), D.lat, D.lon, 1, 300)[0], "the family of the overall #1 site is listed first");
  const C = M.ceiling({ A: D.A, critIds: crit, tv, w: W0, ranges: R, thr });
  const lst = C.find(x => x.criterion === "lst_diurnal_range");
  check(lst && lst.outside === "above" && lst.target > lst.earthMax, `Jezero ceiling: LST diurnal range ${lst.target} K lies above every valid Earth cell (max ${lst.earthMax.toFixed(2)} K)`);
  const i0 = F.families[0].best, SW = M.sameWay({ A: D.A, critIds: crit, tv, w: W0, ranges: R, eff, cell, lat: D.lat, lon: D.lon, thr, i: i0 });
  check(SW.sameFamily.every(j => M.keyOf(M.signatureOf(D.A, crit, tv, W0, R, j, thr)) === SW.key) && SW.sameFamily.every(j => M.haversine(D.lat[i0], D.lon[i0], D.lat[j], D.lon[j]) >= 300), "“fails the same way”: same signature, ≥ 300 km from the selected site");
  check(SW.nearest.every((x, k) => k === 0 || SW.nearest[k - 1].distance <= x.distance), "nearest signatures sorted by δ-distance");
  const ex = F.families.slice(0, 5).map(f => ({ key: f.key, size: f.size, best_cell: cell[f.best], best: +f.bestScore.toFixed(12) }));
  fixture.signature = { target: "mars_jezero", criteria: F.criteria, n_eligible: F.nEligible, n_families: F.nFamilies, top: ex, ceiling: C.map(x => ({ criterion: x.criterion, best_s: +x.bestS.toFixed(12), cells_match: x.cellsMatch, outside: x.outside })) };
  console.log("INFO Jezero families:", F.nFamilies, "top:", ex.map(f => `${f.key} (${f.size})`).join(" ; "));
  console.log("INFO Jezero ceiling:", C.map(x => `${x.criterion}: best s ${x.bestS.toFixed(3)}, ${x.cellsMatch} match`).join(" · "));
}
// ---------------------------------------------------------------- 6 data counterfactual: leave one source out
{
  const [tv, R] = CASES.mars_jezero, SRC = Object.fromEntries(Object.entries(D.app.criteria.reduce((o, c) => { for (const s of c.earth_source) (o[s] = o[s] || []).push(c.id); return o; }, {})));
  const X = M.dropSource({ A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, tv, w: W0, ranges: R, sources: SRC });
  const g = X.results.find(r => r.source === "gmted2010");
  const ref = ENG.similarity(D.A, crit, tv, { ...W0, elevation: 0, slope: 0, surface_roughness: 0 }, R).eff;
  const refTop = ENG.distinctSites(ENG.order(ref, cell), D.lat, D.lon, 10, 300);
  check(g && JSON.stringify(g.top) === JSON.stringify(refTop), "drop GMTED2010 = baseline engine with elevation, slope and roughness weighted 0 (identical leading sites)");
  check(X.results.every(r => r.blocked || r.skipped || (r.kept >= 0 && r.kept <= 10 && r.leaders.length === 10)), "every source result reports kept leaders and their ranks before/after");
  const Xs = M.dropSource({ A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, tv: { ...tv }, w: { aridity: 0, annual_temperature_range: 0, elevation: 0, slope: 0, surface_roughness: 0, lst_diurnal_range: 1 }, ranges: R, sources: SRC });
  check(Xs.results.find(r => r.source === "modis_aqua_lst").blocked && Xs.results.find(r => r.source === "nasa_power").skipped, "dropping the only active source is blocked; a source with no active criterion is skipped");
  fixture.drop_source = { target: "mars_jezero", results: X.results.map(r => ({ source: r.source, kept: r.kept ?? null, same_top1: r.sameTop1 ?? null, top: (r.top || []).map(i => cell[i]) })) };
  console.log("INFO Jezero drop-source:", X.results.map(r => `${r.source}: ${r.kept}/10 kept, #1 ${r.sameTop1 ? "same" : "changes"}`).join(" · "));
}
if (process.argv.includes("--write-fixture")) { fs.writeFileSync(root + "tests/phase4/fixtures/methods_reference.json", JSON.stringify(fixture, null, 1)); console.log("fixture written"); }
else {
  const fx = JSON.parse(fs.readFileSync(root + "tests/phase4/fixtures/methods_reference.json"));
  check(JSON.stringify(fx.cases) === JSON.stringify(fixture.cases) && JSON.stringify(fx.signature) === JSON.stringify(fixture.signature) && JSON.stringify(fx.drop_source) === JSON.stringify(fixture.drop_source), "committed fixture = engine output now (deterministic)");
}
console.log(`\n${n - fails}/${n} method / signature engine checks passed`);
if (fails) process.exit(1);
