// Discovery Journey engine tests (Node). Run: node tests/phase4/test_journey_engine.mjs [--write-fixture]
// Everything runs on the real predictor stack; the few synthetic arrays are known-answer inputs only.
import fs from "node:fs";
import { createRequire } from "node:module";
import { ENG, load, root } from "../phase2/_load.mjs";
const require = createRequire(import.meta.url);
const J = require(root + "app/frontend/phase4/journey_engine.js");
const M = require(root + "app/frontend/phase4/methods_engine.js");

let fails = 0, n = 0;
const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };
const D = load(), crit = D.crit, thr = D.app.thresholds, P = D.app.profiles, W0 = P.general.weights;
const reg = JSON.parse(fs.readFileSync(root + "public/data/registry.json")), RT = Object.fromEntries(reg.targets.map(t => [t.id, t]));
const sources = {}; for (const c of D.app.criteria) for (const s of c.earth_source) (sources[s] = sources[s] || []).push(c.id);
const earthSource = Object.fromEntries(D.app.criteria.map(c => [c.id, c.earth_source.slice()]));
const regV = t => Object.fromEntries(crit.map(c => [c, ["DIRECT", "PROXY"].includes(t.fingerprint.criterion_status[c]) ? t.fingerprint.variables[c] : null]));
const mk = (tid, tv, status, ranges, config) => ({ tid, A: D.A, critIds: crit, cell: D.A.cell, lat: D.lat, lon: D.lon, tv, status, ranges, thr, profiles: P, sources, earthSource, sep: thr.distinct_sep_km, config });
const CTX = {
  mars_jezero: mk("mars_jezero", D.targets.mars_jezero.variables, D.targets.mars_jezero.status, D.ranges, "legacy-baseline-v1"),
  moon_south_pole: mk("moon_south_pole", D.targets.moon_south_pole.variables, D.targets.moon_south_pole.status, D.ranges, "legacy-baseline-v1"),
  moon_shackleton: mk("moon_shackleton", regV(RT.moon_shackleton), RT.moon_shackleton.fingerprint.criterion_status, RT.moon_shackleton.scoring.explore_ranges, "explore-target-v1"),
};
const cj = CTX.mars_jezero;

// ---------------------------------------------------------------- 1 fields, ranks and leading sites are the baseline's
for (const [tid, c] of Object.entries(CTX)) {
  const a = ENG.similarity(D.A, crit, c.tv, W0, c.ranges).eff, b = J.field(c, W0);
  let d = 0; for (let i = 0; i < D.n; i++) if (!Object.is(a[i], b[i])) d++;
  const ord = ENG.order(a, D.A.cell), rk = ENG.ranksFromOrder(ord), L = ENG.distinctSites(ord, D.lat, D.lon, 10, thr.distinct_sep_km);
  let rbad = 0; for (let k = 0; k < 400; k++) { const i = ord[k * 97 % D.n]; if (a[i] >= 0 && J.rank(a, D.A.cell, i) !== rk[i]) rbad++; }
  let lbad = 0; for (let k = 0; k < 2500; k += 5) { const i = ord[k]; const want = L.indexOf(i); if (J.leadPos(a, c, i, 10) !== (want < 0 ? null : want + 1)) lbad++; }
  check(d === 0 && rbad === 0 && lbad === 0, `${tid}: field = baseline bit for bit; rank and leading-site position equal the baseline sort and 300 km rule (${d}/${rbad}/${lbad} differences)`);
}
// ---------------------------------------------------------------- 2 the lens: states follow the baseline thresholds; points lost add up exactly
const effJ = J.field(cj, W0), topJ = J.leaders(effJ, cj, 10), alti = topJ[0];
{
  const L = J.lens(cj, alti, W0);
  check(Math.abs(L.score - effJ[alti]) < 1e-15 && Math.abs(L.score + L.lossTotal - 1) < 1e-12, `Σ points lost = 1 − score exactly (score ${(100 * L.score).toFixed(2)}%, loss ${(100 * L.lossTotal).toFixed(2)} pts)`);
  const ok = L.rows.every(r => r.state === (r.t == null ? "na" : !(r.w > 0) ? "off" : r.e == null ? "unknown" : r.s >= 0.85 ? "similar" : r.s >= 0.6 ? "partial" : "different"));
  check(ok && L.groups.similar.length === 4 && L.groups.different.join() === "lst_diurnal_range", `Jezero #1 (cell ${D.A.cell[alti]}): states follow s ≥ 0.85 / ≥ 0.60 — 4 similar, thermal different`);
  check(L.matter[0] === "lst_diurnal_range", "the difference that costs Jezero #1 most is the thermal criterion");
  const Ls = J.lens(CTX.moon_shackleton, alti, W0);
  check(Ls.groups.na.includes("annual_temperature_range") && Ls.rows.find(r => r.c === "annual_temperature_range").loss == null, "Shackleton: N/A criterion is 'not compared' and costs nothing (never scored as 0)");
  const w1 = { ...W0, slope: 0 }, L1 = J.lens(cj, alti, w1);
  check(L1.groups.off.includes("slope") && L1.rows.find(r => r.c === "slope").loss == null, "a criterion with weight 0 is 'not weighted' and costs nothing");
  // a cell with a missing Earth value
  let miss = -1; for (let i = 0; i < D.n; i++) if (D.A.aridity[i] !== D.A.aridity[i] && effJ[i] >= 0) { miss = i; break; }
  const Lm = J.lens(cj, miss, W0);
  check(miss >= 0 && Lm.groups.unknown.join() === "aridity" && Lm.coverage < 1 && Math.abs(Lm.score - effJ[miss]) < 1e-15 && Lm.rows.find(r => r.c === "aridity").loss == null, "missing Earth value (aridity): 'unknown here', excluded from the score (coverage 5/6), costs nothing, score = baseline");
}
// ---------------------------------------------------------------- 3 objectives
{
  const O = J.objectives(cj, alti, 10);
  check(O.length === Object.keys(P).length, "one row per declared mission profile");
  let bad = 0; for (const o of O) { const eff = ENG.similarity(D.A, crit, cj.tv, P[o.pid].weights, D.ranges).eff; if (!Object.is(o.score, eff[alti]) || o.rank !== J.rank(eff, D.A.cell, alti)) bad++; }
  check(bad === 0, "each objective's score and rank re-computed independently with that profile's weights");
  check(O.find(o => o.pid === "general").lead === 1 && O.find(o => o.pid === "rover").lead === null, "Altiplano is leading site 1 under General and not a leading site under Rover mobility");
}
// ---------------------------------------------------------------- 4 what would change my mind?
const CM = J.changeMind(cj, alti, W0, 10);
{
  check(CM.conclusion === "leading" && CM.base.lead === 1, "conclusion tested for Jezero #1: it is leading site 1");
  const kinds = new Set(CM.alternatives.map(a => a.kind));
  check(["profile", "drop_source", "drop_proxy", "drop_criterion"].every(k => kinds.has(k)) && !CM.alternatives.some(a => a.kind === "profile" && a.id === "general"), "alternatives: declared profiles (except the current one), each Earth source, the target's proxies, each criterion");
  let bad = 0;
  for (const a of CM.alternatives) {
    const w2 = { ...W0 }; for (const x of a.changes) { if (w2[x.c] !== x.from && !(w2[x.c] == null && x.from === 0)) bad++; w2[x.c] = x.to; }
    const eff = ENG.similarity(D.A, crit, cj.tv, w2, D.ranges).eff, L = ENG.distinctSites(ENG.order(eff, D.A.cell), D.lat, D.lon, 10, 300), p = L.indexOf(alti);
    if (a.rank !== J.rank(eff, D.A.cell, alti) || a.lead !== (p < 0 ? null : p + 1) || a.holds !== (p >= 0)) bad++;
  }
  check(bad === 0, `every alternative re-scored independently from its stated weight changes (${CM.alternatives.length} alternatives, ${bad} mismatches)`);
  const g = CM.alternatives.find(a => a.kind === "drop_source" && a.id === "gmted2010");
  const ds = M.dropSource({ A: D.A, cell: D.A.cell, lat: D.lat, lon: D.lon, critIds: crit, tv: cj.tv, w: W0, ranges: D.ranges, sources, K: 10 });
  const gm = ds.results.find(r => r.source === "gmted2010");
  check(g && !g.holds && !gm.top.includes(D.A.cell[alti]), "agrees with the Method Arena: without GMTED2010 Altiplano is not a leading site");
  check(CM.nHold + CM.breakers.length === CM.nAlternatives, `holds under ${CM.nHold} of ${CM.nAlternatives}; breakers listed with their kind`);
  const det1 = JSON.stringify(J.changeMind(cj, alti, W0, 10)), det2 = JSON.stringify(CM);
  check(det1 === det2, "deterministic: the same inputs give the identical report");
}
// ---------------------------------------------------------------- 5 team of places
{
  const T = J.team(cj, W0);
  check(T.unmatchable.join() === "lst_diurnal_range", "team: the thermal criterion cannot be matched anywhere on Earth (structural)");
  const C = M.ceiling({ A: D.A, critIds: crit, tv: cj.tv, w: W0, ranges: D.ranges, thr });
  check(JSON.stringify(C.filter(x => x.structural).map(x => x.criterion)) === JSON.stringify(T.unmatchable), "team's unmatchable criteria = the Method Arena's structural limits");
  let ok = true;
  for (const m of T.members) for (const c of m.matches) { const s = 1 - Math.abs(D.A[c][m.i] - cj.tv[c]) / (D.ranges[c][1] - D.ranges[c][0]); if (!(s >= thr.match) || !(effJ[m.i] >= 0)) ok = false; }
  for (let a = 0; a < T.members.length; a++) for (let b = a + 1; b < T.members.length; b++) if (ENG.haversine(D.lat[T.members[a].i], D.lon[T.members[a].i], D.lat[T.members[b].i], D.lon[T.members[b].i]) < 300) ok = false;
  const union = new Set(T.members.flatMap(m => m.adds));
  check(ok && union.size === T.covered.length && T.covered.length + T.unmatchable.length === T.criteria.length, `team of ${T.members.length}: members really match what they claim (s ≥ 0.85), are ≥ 300 km apart, and cover ${T.covered.length} of ${T.criteria.length}`);
  check(T.bestSingle.matches < T.criteria.length, `no single place matches every criterion (best single place matches ${T.bestSingle.matches})`);
  // known answer: two criteria, three cells
  const A = { x: Float32Array.from([0, 1, 0.5]), y: Float32Array.from([1, 0, 0.5]) }, c = { A, critIds: ["x", "y"], cell: Uint32Array.from([10, 11, 12]), lat: Float64Array.from([0, 0, 60]), lon: Float64Array.from([0, 90, 0]), tv: { x: 0, y: 0 }, ranges: { x: [0, 1], y: [0, 1] }, thr, sep: 300 };
  const Tk = J.team(c, { x: 1, y: 1 }, { eff: Float64Array.from([0.5, 0.5, 0.5]) });
  check(Tk.members.map(m => m.cell).join() === "10,11" && Tk.covered.length === 2, "team known answer: picks the two complementary cells, not the all-round mediocre one");
}
// ---------------------------------------------------------------- 6 missing pieces and trust
{
  const Mi = J.missing(cj, alti, W0, { change: CM, modisCoverage: D.A.modis_coverage[alti], cellKm: [55.6, 51.2], targetWindowKm: 55.6 });
  const ids = Mi.map(m => m.id);
  check(ids.includes("structural:lst_diurnal_range") && ids.includes("target_proxy:aridity") && ids.includes("target_proxy:elevation") && ids.includes("source_dependence:gmted2010"), "missing pieces for Jezero #1: thermal structural gap, both proxies, dependence on GMTED2010");
  check(Mi.every(m => m.link && m.link.type), "every missing piece links to a dataset, a sensitivity result, the target sources or the scoring rule");
  check(Mi.filter(m => m.kind === "source_dependence").every(m => CM.alternatives.find(a => a.kind + ":" + a.id === m.link.alternative && !a.holds)), "each dependence item points at an alternative that really breaks the conclusion");
  const sev = Mi.map(m => ({ gap: 0, caution: 1, info: 2 })[m.severity]);
  check(sev.every((v, k) => k === 0 || v >= sev[k - 1]), "ordered gap → caution → information");
  const Ms = J.missing(CTX.moon_shackleton, alti, W0, {});
  check(Ms.some(m => m.id === "target_na:annual_temperature_range"), "Shackleton: the N/A criterion appears as a gap");
  const Tr = J.trust(cj, alti, W0, { change: CM, stackSha: D.app.stack.sha256, stackVerified: true });
  const flat = JSON.stringify(Tr);
  check(Tr.note === "no_single_score" && !/"(trust|confidence|overall)_?score"/i.test(flat) && Tr.rows.length === 7, "trust view: seven evidence rows and no combined trust score");
  const mrow = Tr.rows.find(r => r.id === "measurements");
  check(mrow.direct === 4 && mrow.proxy === 2 && Tr.rows.find(r => r.id === "limits").structural.join() === "lst_diurnal_range", "trust rows: Jezero has 4 direct and 2 proxy values; one structural limit");
}
// ---------------------------------------------------------------- 7 reveal, summary, multi-world
{
  const O = J.objectives(cj, alti, 10), R = J.reveal(cj, alti, W0, { objectives: O, profile: "general", change: CM });
  check(R.length === 7 && R.map(s => s.id).join() === "earth,target,agree,differ,evidence,objective,summary", "reveal: seven steps in order");
  check(R[2].criteria.length === 4 && R[3].rows[0].c === "lst_diurnal_range" && R[5].alt.best.pid === "thermal" && R[5].alt.worst.pid === "rover", "reveal data: 4 agree; thermal differs most; best alternative objective Thermal testing, worst Rover mobility");
  check(R[6].summary.level === "partial" && R[6].summary.robust === (CM.nHold * 2 === CM.nAlternatives ? "half" : CM.nHold * 2 > CM.nAlternatives ? "most" : "few"), `summary is calibrated: 4 of 6 criteria agree → 'partial' (not 'close'); robustness ${CM.nHold}/${CM.nAlternatives} → '${R[6].summary.robust}'`);
  const g = (sim, comp) => ({ score: 0.9, groups: { similar: Array(sim).fill("x"), different: [], unknown: [], na: [] }, compared: comp });
  check(J.summary(g(6, 6), null, thr).level === "close" && J.summary(g(3, 6), null, thr).level === "partial" && J.summary(g(2, 6), null, thr).level === "weak" && J.summary(g(2, 6), null, thr).robust === null, "summary levels: all compared criteria agree → close; at least half → partial; fewer → weak; untested robustness stays untested");
  const rb = (h, k) => J.summary(g(6, 6), { nHold: h, nAlternatives: k }, thr).robust;
  check(rb(5, 5) === "all" && rb(4, 5) === "most" && rb(3, 6) === "half" && rb(1, 5) === "few", "robustness wording: all / most (> half) / half / few");
  const MW = J.multiWorld([cj, CTX.moon_south_pole, CTX.moon_shackleton], alti, W0);
  const se = ENG.similarity(D.A, crit, CTX.moon_shackleton.tv, W0, CTX.moon_shackleton.ranges).eff[alti];
  check(MW.length === 3 && Math.abs(MW[2].score - se) < 1e-15 && MW[2].na.includes("annual_temperature_range") && MW[2].config === "explore-target-v1", "multi-world: each target with its own ranges and config; N/A criteria listed");
}
// ---------------------------------------------------------------- 8 passport
const PS = J.passport(cj, alti, W0, { change: CM, missing: J.missing(cj, alti, W0, { change: CM }), stackSha: D.app.stack.sha256, place: "Altiplano", rank: 1, nEligible: 76781, lead: 1, profile: "general", created: "2026-01-01T00:00:00Z" });
{
  check(PS.schema === "asterro.passport/1" && PS.reproducibility.predictor_stack_sha256 === D.app.stack.sha256 && PS.generator.algorithm === ENG.ALGORITHM_VERSION, "passport: schema, stack hash and algorithm version recorded");
  check(Math.abs(J.rescore(PS) - effJ[alti]) < 1e-12, "passport re-scores from its own contents to the baseline score");
  const P2 = JSON.parse(JSON.stringify(PS)); P2.criteria.find(c => c.id === "lst_diurnal_range").weight = 0;
  const e2 = ENG.similarity(D.A, crit, cj.tv, { ...W0, lst_diurnal_range: 0 }, D.ranges).eff[alti];
  check(Math.abs(J.rescore(P2) - e2) < 1e-12, "re-scoring follows edited weights exactly (an edited passport is detectable)");
  check(/not endorsed by NASA/.test(PS.disclaimer) && /not validated/.test(PS.disclaimer), "passport carries the no-equivalence / not-validated / no-endorsement statement");
}
if (process.argv.includes("--write-fixture")) {
  fs.writeFileSync(root + "tests/phase4/fixtures/journey_reference.json", JSON.stringify({ engine: J.VERSION, stack_sha256: D.app.stack.sha256, target: "mars_jezero", weights: W0, cell_id: D.A.cell[alti], passport: PS,
    change: CM.alternatives.map(a => ({ kind: a.kind, id: a.id, changes: a.changes, rank: a.rank, lead: a.lead })) }, null, 1));
  console.log("fixture written");
}
console.log(`\n${n - fails}/${n} journey engine checks passed`);
process.exit(fails ? 1 : 0);
