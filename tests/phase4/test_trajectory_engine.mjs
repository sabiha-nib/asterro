// Discovery Trajectory engine tests (Node). Run: node tests/phase4/test_trajectory_engine.mjs [--write-fixture]
// States are produced by the unchanged baseline engine (ENG.similarity / order / distinctSites) on the real stack.
import fs from "node:fs";
import { createRequire } from "node:module";
import { ENG, load, root } from "../phase2/_load.mjs";
const require = createRequire(import.meta.url);
const TJ = require(root + "app/frontend/phase4/trajectory_engine.js");

let fails = 0, n = 0;
const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };
const D = load(), crit = D.crit, cell = D.A.cell, P = D.app.profiles;
const reg = JSON.parse(fs.readFileSync(root + "public/data/registry.json"));
const RT = Object.fromEntries(reg.targets.map(t => [t.id, t]));
const regVars = t => Object.fromEntries(crit.map(c => [c, ["DIRECT", "PROXY"].includes(t.fingerprint.criterion_status[c]) ? t.fingerprint.variables[c] : null]));
const tv = tid => tid in D.targets ? D.targets[tid].variables : regVars(RT[tid]);
const rangesOf = tid => tid in D.targets || tid === "cross" ? D.ranges : RT[tid].scoring.explore_ranges;
let seq = 0;
function state(tid, w, profile, label) {
  let eff;
  if (tid === "cross") {
    const a = ENG.similarity(D.A, crit, D.targets.mars_jezero.variables, w, D.ranges).eff, b = ENG.similarity(D.A, crit, D.targets.moon_south_pole.variables, w, D.ranges).eff;
    eff = new Float64Array(D.n); for (let i = 0; i < D.n; i++) eff[i] = a[i] < 0 || b[i] < 0 ? -1 : Math.min(a[i], b[i]);
  } else eff = ENG.similarity(D.A, crit, tv(tid), w, rangesOf(tid)).eff;
  const o = ENG.order(eff, cell);
  return { id: "s" + (++seq), tid, weights: { ...w }, profile, label, config: tid === "cross" ? "legacy-cross-planet" : tid in D.targets ? "legacy-baseline-v1" : "explore-target-v1",
    ranges: rangesOf(tid), eff, rank: ENG.ranksFromOrder(o), distinct: ENG.distinctSites(o, D.lat, D.lon, 20, 300), cellIds: cell };
}
const g = P.general.weights;
const S = [state("mars_jezero", g, "general", "Start"), state("mars_jezero", { ...g, lst_diurnal_range: 3 }, "custom", "THERM 1 → 3"),
  state("mars_jezero", { ...g, lst_diurnal_range: 3, elevation: 0 }, "custom", "ELEV 1 → 0"), state("mars_jezero", P.rover.weights, "rover", "Rover profile")];

// ---------------------------------------------------------------- configuration diffs
{
  const d = TJ.diffConfig(S[0], S[1], crit);
  check(d.length === 1 && d[0].kind === "weight" && d[0].criterion === "lst_diurnal_range" && d[0].to === 3, "diffConfig: one weight change detected exactly");
  const d2 = TJ.diffConfig(S[1], S[2], crit);
  check(d2.some(c => c.deactivated && c.criterion === "elevation"), "diffConfig: a weight set to 0 is reported as switching the criterion off");
  check(TJ.configKey(S[0]) === TJ.configKey(state("mars_jezero", g, "general", "x")), "configKey: identical configurations share a key (no duplicate states)");
}
// ---------------------------------------------------------------- analysis
const A = TJ.analyse(S, { K: 10, lat: D.lat, lon: D.lon, sep: 300 });
{
  const U = new Set(S.flatMap(s => s.distinct.slice(0, 10)));
  check(A.candidates.length === U.size, `analyse: one track per candidate in the union of leading groups (${U.size})`);
  check(A.candidates.every(c => c.pos.every((p, k) => (p != null) === S[k].distinct.slice(0, 10).includes(c.i))), "positions equal the engine's distinct-site positions");
  check(A.candidates.every(c => c.ranks.every((r, k) => r === (S[k].eff[c.i] >= 0 ? S[k].rank[c.i] : null))), "cell ranks equal the engine's ranks (ineligible → null)");
  const cls = c => { const g2 = c.pos.map(p => p != null); return g2.every(Boolean) ? "stable" : !g2[0] && g2[3] ? "entered" : g2[0] && !g2[3] ? "left" : "transient"; };
  check(A.candidates.every(c => c.class === cls(c)), "classes follow the stated rule (stable / entered / left / transient)");
  // displaced: excluded only by the 300 km rule — its own score qualifies and a leading site within 300 km scores higher
  let okD = true, nD = 0;
  for (const c of A.candidates) c.displaced.forEach((j, k) => {
    if (j == null) return; nD++;
    const s = S[k], G = s.distinct.slice(0, 10);
    if (!(s.eff[c.i] >= s.eff[G[9]] && G.includes(j) && s.eff[j] >= s.eff[c.i] && TJ.haversine(D.lat[c.i], D.lon[c.i], D.lat[j], D.lon[j]) < 300)) okD = false;
  });
  check(okD && nD > 0, `displaced-by-neighbour flags satisfy the 300 km rule definition (${nD} cases)`);
  const alti = A.candidates.find(c => S[0].distinct[0] === c.i);
  check(alti && alti.pos[0] === 1 && alti.class !== "stable", "the general-profile #1 is not stable across these four configurations (a real, non-trivial finding)");
  check(/not measurement, data-quality or model uncertainty/.test(A.note), "the analysis labels itself as configuration sensitivity, not uncertainty");
}
// ---------------------------------------------------------------- transitions
{
  const T = TJ.transitions(S, crit, { K: 10 });
  check(T.length === 3 && T[0].attribution === "single" && T[2].attribution === "joint", "transitions: single-change steps are attributable; multi-change steps are joint");
  check(T.every((t, k) => t.entered.every(i => S[k + 1].distinct.slice(0, 10).includes(i) && !S[k].distinct.slice(0, 10).includes(i))), "entered = in the new leading group and not in the previous one");
  check(T.every(t => t.movers.every(m => m.delta == null || m.delta === m.from - m.to)), "rank deltas are exact differences of engine ranks");
}
// ---------------------------------------------------------------- exact decomposition
{
  let worst = 0, closes = true;
  for (const i of S[0].distinct.slice(0, 10)) {
    const dA = ENG.detail(D.A, crit, i, tv("mars_jezero"), S[0].weights, D.ranges), dB = ENG.detail(D.A, crit, i, tv("mars_jezero"), S[1].weights, D.ranges);
    const R = TJ.decompose(dA, dB); closes = closes && R.closes; worst = Math.max(worst, Math.abs(R.sumOfParts - R.deltaScore));
    if (Math.abs(R.deltaScore - (S[1].eff[i] - S[0].eff[i])) > 1e-12) closes = false;
  }
  check(closes, `ΔS = Σ_c Δk_c and equals the engine's score change for every leading cell (max residual ${worst.toExponential(1)})`);
  const i = S[0].distinct[0], R = TJ.decompose(ENG.detail(D.A, crit, i, tv("mars_jezero"), S[0].weights, D.ranges), ENG.detail(D.A, crit, i, tv("mars_jezero"), S[1].weights, D.ranges));
  check(R.rows[0].criterion === "lst_diurnal_range" && R.rows[0].delta > 0 && R.rows.slice(1).every(r => r.delta <= 0), "raising one weight: that criterion gains, every other contribution shrinks (Σw grows)");
}
// ---------------------------------------------------------------- separating evidence
{
  const [x, y] = S[2].distinct;
  const sep = TJ.separating(ENG.detail(D.A, crit, x, tv("mars_jezero"), S[2].weights, D.ranges), ENG.detail(D.A, crit, y, tv("mars_jezero"), S[2].weights, D.ranges));
  const el = sep.find(r => r.criterion === "elevation");
  check(el && el.status === "inactive" && el.sX != null && el.kX == null, "separating: a weight-0 criterion is still evaluated for discrimination and marked inactive (not scored)");
  check(sep.every((r, k) => k === 0 || Math.abs(sep[k - 1].gap ?? -1) >= Math.abs(r.gap ?? -1)), "separating: sorted by the size of the similarity gap");
  const sh = state("moon_shackleton", g, "general", "Shackleton");
  const sp = TJ.separating(ENG.detail(D.A, crit, sh.distinct[0], tv("moon_shackleton"), g, rangesOf("moon_shackleton")), ENG.detail(D.A, crit, sh.distinct[1], tv("moon_shackleton"), g, rangesOf("moon_shackleton")));
  check(sp.find(r => r.criterion === "annual_temperature_range").status === "target_missing", "separating: N/A target criterion is reported as a missing measurement, never as a mismatch");
}
// ---------------------------------------------------------------- story (calibrated, evidence-backed)
{
  const i = S[0].distinct[0], d = ENG.detail(D.A, crit, i, tv("mars_jezero"), g, D.ranges);
  const st = TJ.story({ targetName: "Jezero Crater", candidateName: "cell", state: S[0], detail: d, cand: A.candidates.find(c => c.i === i), thresholds: D.app.thresholds, missingTarget: [], proxies: ["aridity", "elevation"], K: 10 });
  check(st.labels.includes("Requires additional characterization") && !st.labels.some(l => /robust/i.test(l)), "story: proxies force 'requires additional characterization'; a non-stable candidate is never called robust");
  check(!st.sections.some(s => /breakthrough|safe to|suitable for|habitable|unprecedented/i.test(s.t.replace("Not a safety, suitability or habitability assessment", ""))), "story: no breakthrough, safety, suitability or habitability claims");
  const mm = d.rows.filter(r => r.s != null && r.s < D.app.thresholds.partial).map(r => r.c);
  check(JSON.stringify(st.evidence.mismatch) === JSON.stringify(mm), "story: every listed mismatch is a computed similarity below the partial threshold");
  check(Math.abs(st.evidence.final - S[0].eff[i]) < 1e-12, "story: the score quoted equals the engine's score");
}
// ---------------------------------------------------------------- export / validation
const X = [...S, state("moon_shackleton", g, "general", "Target → Shackleton"), state("cross", g, "general", "Target → cross-planet")];
const doc = TJ.exportTrajectory(X, { exported_utc: "2026-01-01T00:00:00Z", algorithm_version: D.app.algorithm_version, predictor_stack_sha256: D.app.stack.sha256, registry_version: reg.registry_version }, 10);
check(TJ.validateTrajectory(doc).length === 0 && doc.states.length === 6 && doc.states.every(s => s.expected_sites.length === 10), "export validates: 6 states × 10 expected sites");
check(TJ.validateTrajectory({ ...doc, states: [{ ...doc.states[0], weights: { slope: -1 } }] }).length > 0, "validate: a negative weight is refused");
check(TJ.validateTrajectory({ schema: "x" }).length > 0, "validate: a wrong schema is refused");
if (process.argv.includes("--write-fixture")) { fs.writeFileSync(root + "tests/phase4/fixtures/trajectory_demo.json", JSON.stringify(doc, null, 1)); console.log("fixture written"); }
else {
  const fx = JSON.parse(fs.readFileSync(root + "tests/phase4/fixtures/trajectory_demo.json"));
  check(JSON.stringify(fx.states.map(s => s.expected_sites)) === JSON.stringify(doc.states.map(s => s.expected_sites)), "committed fixture = engine output now (deterministic)");
}
console.log(`\n${n - fails}/${n} trajectory engine checks passed`);
if (fails) process.exit(1);
