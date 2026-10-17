// Phase III atlas engine tests (Node). Run: node tests/phase3/test_atlas_engine.mjs
// Real data: public/data/stack.bin and public/data/phase3/atlas.json. Synthetic arrays are test inputs only.
import fs from "node:fs";
import { createRequire } from "node:module";
import { ENG, LAB, load, root } from "../phase2/_load.mjs";
const require = createRequire(import.meta.url);
const ATL = require(root + "app/frontend/phase3/atlas_engine.js");

let fails = 0, n = 0;
const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };
const throws = (f, msg) => { let t = false; try { f(); } catch (e) { t = true; } check(t, msg); };
const D = load(), crit = D.crit, cell = D.A.cell;
const atlas = JSON.parse(fs.readFileSync(root + "public/data/phase3/atlas.json"));
const T = Object.fromEntries(atlas.targets.map(t => [t.id, t]));
const W0 = D.app.profiles.general.weights;

// ---------------------------------------------------------------- 1 catalogue integrity
check(atlas.targets.length === 33 && atlas.targets.filter(t => t.body === "Mars").length === 18 && atlas.targets.filter(t => t.body === "Moon").length === 15, "catalogue: 33 targets (18 Mars windows, 15 Moon)");
check(atlas.stack_sha256 === D.app.stack.sha256, "atlas built for this predictor stack");
check(atlas.targets.every(t => crit.every(c => ATL.STATUS.includes(t.status[c]))), "every criterion of every target has a status from the vocabulary");
check(atlas.targets.every(t => crit.every(c => (t.status[c] === "DIRECT" || t.status[c] === "PROXY") === (t.values[c] != null))), "a value exists exactly when the status is DIRECT or PROXY (no value behind MISSING/INCOMPATIBLE)");
check(atlas.targets.every(t => t.readiness_v1.direct === crit.filter(c => t.status[c] === "DIRECT").length), "readiness counts DIRECT criteria only (proxies never count)");
check(atlas.targets.every(t => t.readiness_v1.level === (t.readiness_v1.direct === 0 ? 1 : t.readiness_v1.direct < 3 ? 2 : (crit.some(c => t.status[c] === "UNVALIDATED") ? 3 : 4))), "Phase III readiness v1 level follows the documented rule (kept as readiness_v1)");
check(atlas.targets.every(t => t.readiness.model === "3.0.0" && t.readiness.checks.length === 12), "Phase IV readiness model 3 carries its 12 explicit checks");
check(atlas.targets.every(t => { const L = t.readiness.level; return [1, 2, 3, 4].every(k => (k <= L) === t.readiness.checks.filter(c => c.level <= k).every(c => c.passed)); }), "readiness level = highest level whose checks (and all lower checks) pass");
check(atlas.targets.every(t => t.readiness.level !== 4 || t.readiness.checks.find(c => c.id === "L4.offline_regeneration").passed), "every L4 target passed the offline regeneration at build time");
for (const id of ["mars_jezero", "moon_south_pole"]) check(crit.every(c => Object.is(T[id].values[c], D.targets[id].variables[c] ?? null)), `${id}: atlas values identical to the unchanged baseline target`);
const nonBase = atlas.targets.filter(t => !t.baseline);
check(nonBase.every(t => !crit.every(c => t.values[c] === T.mars_jezero.values[c]) && !crit.every(c => t.values[c] === T.moon_south_pole.values[c])), "no non-baseline fingerprint copies a baseline fingerprint");
check(nonBase.filter(t => t.body === "Mars" && t.id !== "mars_gale_curiosity").every(t => t.status.lst_diurnal_range === "MISSING" && t.values.lst_diurnal_range == null), "Mars targets without a thermal product: LST MISSING, never filled");
check(atlas.targets.filter(t => t.body === "Moon").every(t => t.status.annual_temperature_range === "INCOMPATIBLE"), "Moon: annual air-temperature range INCOMPATIBLE (no atmosphere)");
check(T.moon_reiner_gamma.status.lst_diurnal_range === "MISSING", "Reiner Gamma: no valid Diviner GCP bins → MISSING (no interpolation)");
for (const id of ["mars_jezero", "moon_south_pole"]) check(Object.values(T[id].reproduce_check).every(v => v.abs_diff < 0.01), `${id}: Phase III pipeline reproduces the baseline window values (|Δ| < rounding)`);

// ---------------------------------------------------------------- 2 baseline parity of the atlas scoring path
for (const id of ["mars_jezero", "moon_south_pole"]) {
  for (const [nm, p] of Object.entries(D.app.profiles)) {
    const P = ATL.prepareTarget(D.A, crit, T[id], D.ranges, { includeProxy: true });
    const a = ENG.similarity(D.A, crit, D.targets[id].variables, p.weights, D.ranges).eff, b = ATL.scoreTarget(P, p.weights).eff;
    let diff = 0; for (let i = 0; i < D.n; i++) if (!Object.is(a[i], b[i])) diff++;
    check(diff === 0, `${id}/${nm}: atlas path with proxies + baseline table = baseline engine bitwise (${diff})`);
  }
}
{
  const o = ENG.order(ENG.similarity(D.A, crit, D.targets.mars_jezero.variables, W0, D.ranges).eff, cell);
  const want = ENG.distinctSites(o, D.lat, D.lon, 20, 300);
  const got = ATL.candidates({ A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, t: T.mars_jezero, ranges: D.ranges, w: W0, includeProxy: true }).top;
  check(want.join() === got.join(), "atlas distinct candidates = baseline distinct sites for Jezero (baseline configuration)");
}

// ---------------------------------------------------------------- 3 JS ≡ Python reference (atlas table, general profile, DIRECT only)
for (const [id, ref] of Object.entries(atlas.reference)) {
  const rg = ATL.rangesFor("target", { A: D.A, critIds: crit, atlas, baselineRanges: D.ranges, tv: ATL.targetVector(T[id], crit) });
  check(crit.every(c => rg[c][0] === ref.ranges[c][0] && rg[c][1] === ref.ranges[c][1]), `${id}: JS per-target table = Python per-target table`);
  const R = ATL.candidates({ A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, t: T[id], ranges: rg, w: W0 });
  const ok = R.eligible && R.top.length === ref.top.length && R.top.every((i, k) => i === ref.top[k].index && Math.abs(R.eff[i] - ref.top[k].score) < 1e-12) && R.nEligible === ref.eligible;
  check(ok, `${id}: JS candidates = Python reference (${ref.criteria.length} criteria)`);
}

// ---------------------------------------------------------------- 4 eligibility, missing values, proxies
{
  const L1 = { ...T.mars_elysium_planitia, status: Object.fromEntries(crit.map(c => [c, c === "aridity" || c === "elevation" ? "PROXY" : "MISSING"])), readiness: { level: 1 } };
  const r = ATL.candidates({ A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, t: L1, ranges: atlas.normalisation.ranges, w: W0 });
  check(!r.eligible && r.mode === "none", "L1 target never enters a ranking");
  check(ATL.eligibility(T.mars_elysium_planitia, crit).mode === "partial-terrain", "terrain-only target (L2) is labelled partial");
  const L0 = { ...T.mars_elysium_planitia, readiness: { model: "3.0.0", level: 1 } };
  check(!ATL.candidates({ A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, t: L0, ranges: atlas.normalisation.ranges, w: W0 }).eligible, "L1 catalogued entry (model 3) never enters a ranking");
  check(ATL.eligibility(T.moon_shackleton, crit).mode === "full" && T.moon_shackleton.readiness.level === 4, "L4 target: full comparison");
  const tv = ATL.targetVector(T.mars_elysium_planitia, crit);
  check(tv.lst_diurnal_range === null && tv.aridity === null && tv.slope != null, "target vector: MISSING and PROXY are not scored by default");
  check(ATL.targetVector(T.mars_elysium_planitia, crit, { includeProxy: true }).aridity === 0, "proxies only on explicit request");
  // a missing Earth value is never a match
  const A2 = { ...D.A, slope: Float32Array.from(D.A.slope) }; const k = 1234; A2.slope[k] = NaN;
  const P = ATL.prepareTarget(A2, crit, T.mars_elysium_planitia, atlas.normalisation.ranges);
  const ex = ATL.explain(P, W0, k, A2, atlas.normalisation.ranges).find(x => x.criterion === "slope");
  check(ex.similarity === null && ex.contribution === null, "missing Earth value → no similarity, no contribution");
  const F = ATL.scoreTarget(P, W0); check(F.coverage[k] < 0.8 && F.eff[k] === -1, "cell missing half the active weight is ineligible (coverage rule)");
}

// ---------------------------------------------------------------- 5 normalisation alternatives
{
  const t = T.moon_shackleton, tv = ATL.targetVector(t, crit);
  const Rt = ATL.rangesFor("target", { A: D.A, critIds: crit, atlas, baselineRanges: D.ranges, tv });
  const Re = ATL.rangesFor("earth", { A: D.A, critIds: crit, atlas, baselineRanges: D.ranges, tv });
  const er = ATL.earthRange(D.A, "lst_diurnal_range");
  check(Re.lst_diurnal_range[1] === er[1] && Rt.lst_diurnal_range[1] === Math.max(er[1], tv.lst_diurnal_range), "per-target table = Earth ∪ target; Earth table = Earth only");
  check(atlas.normalisation.ranges.lst_diurnal_range[1] >= Math.max(...atlas.targets.filter(x => x.status.lst_diurnal_range === "DIRECT").map(x => x.values.lst_diurnal_range)), "atlas table spans every DIRECT target value");
  const off = ATL.outsideEarth(D.A, crit, ATL.targetVector(T.moon_apollo16_descartes, crit));
  check(off.some(o => o.criterion === "lst_diurnal_range" && o.side === "above"), "equatorial lunar ΔT flagged as outside Earth's range");
}

// ---------------------------------------------------------------- 6 comparison analytics
{
  const ts = ["mars_gale_curiosity", "mars_elysium_planitia", "moon_shackleton"].map(id => T[id]);
  const Dd = ATL.distinguishing(ts, crit, atlas.normalisation.ranges);
  check(Dd.rows.find(r => r.criterion === "aridity").verdict === "NOT_DISTINGUISHING_PROXY", "proxy criterion reported as not distinguishing");
  check(Dd.rows.find(r => r.criterion === "lst_diurnal_range").missing.includes("mars_elysium_planitia"), "missing criterion listed per target");
  check(Dd.rows.find(r => r.criterion === "annual_temperature_range").incompatible.includes("moon_shackleton"), "incompatible criterion listed per target");
  const rs = ts.map(t => Object.assign(ATL.candidates({ A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, t, ranges: atlas.normalisation.ranges, w: W0 }), { targetId: t.id }));
  const SH = ATL.shared(rs.map(r => r.eff), cell, D.lat, D.lon, 10);
  check(SH.top.every(i => rs.every(r => SH.eff[i] <= r.eff[i] + 1e-15)), "shared score = minimum of the per-target scores");
  const CP = ATL.complementary(rs, cell, D.lat, D.lon);
  const idx = CP.map(c => c.index).filter(i => i != null);
  check(idx.every((i, a) => idx.every((j, b) => a === b || ATL.haversine(D.lat[i], D.lon[i], D.lat[j], D.lon[j]) >= 300)), "complementary set ≥ 300 km apart");
  const st = ATL.stability({ A: D.A, cell, critIds: crit, t: T.mars_gale_curiosity, ranges: atlas.normalisation.ranges, w: W0, cand: rs[0].top.slice(0, 5) });
  check(st.design === 81 && st.stats.length === 5 && st.stats.every(s => s.n === 81), "stability: 3^4 factorial on Gale's four DIRECT criteria");
  const mi = ATL.measurementImpact({ A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, t: T.mars_elysium_planitia, ranges: atlas.normalisation.ranges, w: W0, criterion: "lst_diurnal_range",
    scenarios: [{ label: "Jezero", value: T.mars_jezero.values.lst_diurnal_range }] });
  check(mi.scenarios.length === 1 && mi.scenarios[0].overlap >= 0 && mi.scenarios[0].overlap <= 1 && T.mars_elysium_planitia.values.lst_diurnal_range == null, "measurement impact is a scenario: the target's own value stays missing");
  const me = ATL.missingEvidence(T.mars_elysium_planitia, crit, W0);
  check(me.some(m => m.criterion === "lst_diurnal_range" && m.status === "MISSING"), "missing evidence lists the absent thermal criterion");
}

// ---------------------------------------------------------------- 7 window classes (landing-site explorer)
{
  const flat = new Float32Array(3600).fill(1); flat[0] = NaN;
  const W = ATL.windowClasses(flat, { maxSlope: 5 });
  check(W.valid === 3599 && W.components === 1 && W.largestCells.length === 3599, "flat window: one connected area of all valid bins");
  const split = new Float32Array(3600).fill(1); for (let r = 0; r < 60; r++) split[r * 60 + 30] = 40;
  const W2 = ATL.windowClasses(split, { maxSlope: 5 });
  check(W2.components === 2 && W2.largestCells.length === 30 * 60, "a steep column splits the window into two areas");
  check(Math.abs(W2.binKm2 - (ATL.BIN_M / 1000) ** 2) < 1e-12, "bin area = (926.6 m)²");
}

// ---------------------------------------------------------------- 8 contract v2 + adapter
{
  const v1 = JSON.parse(fs.readFileSync(root + "tests/phase2/fixtures/record_ablation_mars.json"));
  const v2 = ATL.adaptV1(v1);
  check(v2.schema === ATL.CONTRACT && v2.id_v1 === v1.id && LAB.canonical(v2.context.baseline) === LAB.canonical(v1.baseline) && v2.outputs_sha256 === v1.outputs_sha256, "v1 → v2 adapter is lossless");
  check(ATL.validateV2(v2).length === 0, "adapted record validates as v2");
  throws(() => ATL.adaptV1({ schema: "x" }), "adapter rejects non-v1 input");
  check(ATL.validateV2({ schema: ATL.CONTRACT, module: "m", context: { targets: "x" }, params: {}, outputs: {}, outputs_sha256: "" }).length > 0, "v2 validation rejects malformed context");
}

// ---------------------------------------------------------------- 9 workflow boundaries + copilot
{
  const L1 = { ...T.mars_elysium_planitia, readiness: { level: 1 } };
  const st = ATL.workflowState({ target: L1 });
  check(st[0].status === "DONE" && st.slice(1).every(s => s.status === "BLOCKED"), "workflow stops at the analytical boundary for an L1 target");
  const st0 = ATL.workflowState({ target: { ...T.mars_elysium_planitia, readiness: { model: "3.0.0", level: 1 } } });
  check(st0.slice(1).every(s => s.status === "BLOCKED"), "workflow stops at the analytical boundary for an L1 catalogued entry");
  const st2 = ATL.workflowState({ target: T.mars_gale_curiosity, candidate: null });
  check(st2[1].status === "READY" && st2.slice(2).every(s => s.status === "BLOCKED"), "workflow waits for a candidate");
  const idx = atlas.targets.flatMap(t => crit.map(c => ({ id: `${t.id}.${c}`, kind: "value", target: t.id, targetName: t.name, aliases: [t.name.split(" (")[0].toLowerCase()], criterion: c, status: t.status[c], text: `${t.name} ${c} ${t.status[c]}` })));
  check(ATL.copilotAnswer("What is the weather on Jupiter tomorrow?", idx).text === ATL.CANNOT, "copilot: unanswerable question → the exact refusal sentence");
  check(ATL.copilotAnswer("Is Shackleton Crater safe to land on?", idx).text.startsWith(ATL.CANNOT), "copilot: never assesses safety");
  const a = ATL.copilotAnswer("What slope does elysium planitia have?", idx);
  check(a.cites.length === 1 && a.cites[0] === "mars_elysium_planitia.slope", "copilot cites the evidence entry it used");
}

// ---------------------------------------------------------------- 10 integration safety: no global-name clashes
{
  const names = f => { const s = fs.readFileSync(f, "utf8"), out = new Set(); for (const m of s.matchAll(/^(?:const|let|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm)) out.add(m[1]); return out; };
  const dir = d => fs.readdirSync(root + d).filter(f => f.endsWith(".js")).map(f => root + d + "/" + f);
  const base = new Set(), p2 = new Set();
  for (const f of dir("app/frontend/js")) for (const x of names(f)) base.add(x);
  for (const f of dir("app/frontend/phase2")) for (const x of names(f)) p2.add(x);
  const p3 = []; for (const f of dir("app/frontend/phase3")) for (const x of names(f)) p3.push(x);
  const clash = p3.filter(x => base.has(x) || p2.has(x));
  const dup = p3.filter((x, k) => p3.indexOf(x) !== k);
  check(clash.length === 0, `no Phase III top-level name redeclares a baseline or Phase II name (${p3.length} names; clashes: ${clash.join(",") || "none"})`);
  check(dup.length === 0, `no duplicate top-level names inside Phase III (${dup.join(",") || "none"})`);
  const core = fs.readFileSync(root + "app/frontend/phase3/ui_01_core.js", "utf8");
  check(/const _p2RenderLeft = renderLeft;/.test(core) && !/function renderLeft/.test(core), "renderLeft is wrapped, not redeclared");
}

// ---------------------------------------------------------------- 11 performance
{
  const t0 = performance.now();
  for (const t of atlas.targets) ATL.candidates({ A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, t, ranges: atlas.normalisation.ranges, w: W0 });
  const ms = performance.now() - t0;
  console.log(`INFO candidates for all ${atlas.targets.length} targets: ${ms.toFixed(0)} ms (${(ms / atlas.targets.length).toFixed(1)} ms/target)`);
  check(ms / atlas.targets.length < 500, "candidate search < 500 ms per target");
}

console.log(`\n${n - fails}/${n} Phase III engine checks passed`);
process.exit(fails ? 1 : 0);
