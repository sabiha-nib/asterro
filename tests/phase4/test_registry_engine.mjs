// Phase IV registry engine tests (Node). Run: node tests/phase4/test_registry_engine.mjs
// Real data: public/data/stack.bin, public/data/registry.json, public/data/phase3/atlas.json.
// Reference cases below are TEST INPUTS for the metric arithmetic only (never presented as validation).
import fs from "node:fs";
import { createRequire } from "node:module";
import { ENG, LAB, load, root } from "../phase2/_load.mjs";
const require = createRequire(import.meta.url);
const REG = require(root + "app/frontend/phase4/registry_engine.js");
const ATL = require(root + "app/frontend/phase3/atlas_engine.js");

let fails = 0, n = 0;
const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };
const D = load(), crit = D.crit, cell = D.A.cell, W0 = D.app.profiles.general.weights;
const R = JSON.parse(fs.readFileSync(root + "public/data/registry.json"));
const atlas = JSON.parse(fs.readFileSync(root + "public/data/phase3/atlas.json"));
const IX = REG.index(R);
const T = IX.targets;

// ---------------------------------------------------------------- 1 registry + hierarchy
check(R.targets.length === 33 && R.regions.length === 20 && R.locations.length === 69, "registry: 33 analytical targets, 20 regions, 69 locations");
check(R.locations.every(l => IX.regions[l.region] && IX.regions[l.region].body === l.body), "every location sits in a region of its own body");
check(R.targets.every(t => IX.locations[t.location.id] && IX.locations[t.location.id].target_ids.includes(t.id)), "every target refers to exactly the location that lists it");
check(R.locations.filter(l => !l.target_ids.length).every(l => l.readiness.level === 1), "catalogue-only locations are L1 (catalogued)");
{
  const c = REG.counts(IX);
  check(c.targetsByLevel[4] === 16 && c.targetsByLevel[2] === 17 && c.scoring === 16, `readiness: 16 L4 + 17 L2 targets, 16 scoring-enabled (${c.targetsByLevel})`);
}
check(atlas.targets.every(t => t.readiness.level === T[t.id].readiness.level), "atlas.json and registry.json carry the same readiness (published parity)");

// ---------------------------------------------------------------- 2 search with aliases, prefixes, diacritics
const top = q => (REG.search(IX, q)[0] || {}).id;
check(top("Gale Crater") === "mars:gale", "alias 'Gale Crater' → Gale");
check(top("gale") === "mars:gale", "exact name first: 'gale'");
check(top("schrodinger") === "moon:schrodinger", "diacritics folded: 'schrodinger' → Schrödinger");
check(top("jez") === "mars:jezero", "prefix: 'jez' → Jezero");
check(REG.search(IX, "apollo 15").some(h => h.id === "moon:apollo15_site"), "words: 'apollo 15' finds the landing site");
check(REG.search(IX, "curiosity").some(h => h.id === "mars:gale"), "mission/target words: 'curiosity' finds Gale");
check(REG.search(IX, "zzqx").length === 0, "no match → empty list (no fuzzy invention)");
check(JSON.stringify(REG.search(IX, "mons")) === JSON.stringify(REG.search(IX, "mons")), "search is deterministic");

// ---------------------------------------------------------------- 3 filters + sorting
check(REG.filterLocations(IX, { body: "moon" }).every(l => l.body === "moon"), "body filter");
check(REG.filterLocations(IX, { minLevel: 4 }).length === 16, "minimum readiness 4 → 16 locations");
check(REG.filterLocations(IX, { dataset: "rems" }).map(l => l.id).join() === "mars:gale", "dataset filter: REMS → Gale only");
check(REG.filterLocations(IX, { mission: "apollo15" }).some(l => l.id === "moon:apollo15_site"), "mission filter");
check(REG.filterLocations(IX, { level: 1 }).every(l => !l.target_ids.length), "level filter 1 → catalogued entries only");
{
  const s = REG.sortLocations(R.locations, "readiness");
  check(s.every((l, k) => !k || s[k - 1].readiness.level >= l.readiness.level), "sort by readiness (desc, stable tie-break)");
}

// ---------------------------------------------------------------- 4 quick actions (disabled with reason)
{
  const l0 = R.locations.find(l => !l.target_ids.length), qa = REG.quickActions(IX, l0);
  check(qa.filter(a => !["collection", "provenance"].includes(a.id)).every(a => !a.enabled && a.reason), "L1 catalogued location: analytical actions disabled, each with a reason");
  const qe = REG.quickActions(IX, IX.locations["mars:elysium_planitia"]);
  check(qe.find(a => a.id === "analogues").enabled && !qe.find(a => a.id === "validation").enabled, "L2 location: partial analogues enabled; validation disabled with reason");
  const qg = REG.quickActions(IX, IX.locations["mars:gale"], { exploreIds: ["mars_gale_curiosity"] });
  check(qg.every(a => a.enabled), "L4 location registered in Explore: every action enabled");
}

// ---------------------------------------------------------------- 5 compatibility + aggregates
{
  const C = REG.compatibility([T.mars_gale_curiosity, T.moon_shackleton], crit);
  check(C.sharedDirect.join() === "slope,surface_roughness,lst_diurnal_range", "Gale × Shackleton: shared DIRECT = slope, roughness, LST");
  check(C.criteria.find(c => c.criterion === "annual_temperature_range").class === "not-applicable", "annual range: N/A on the Moon → not applicable");
  check(C.criteria.find(c => c.criterion === "lst_diurnal_range").sourceDiffers && C.criteria.find(c => c.criterion === "lst_diurnal_range").scaleDiffers, "LST: different sources and spatial support are flagged");
  check(!REG.aggregatePlan(IX, ["mars_gale_curiosity"], "minimum", crit).ok, "aggregate needs ≥ 2 targets");
  check(!REG.aggregatePlan(IX, ["mars_gale_curiosity", "moon_shackleton"], "sum", crit).ok, "unsupported aggregate is blocked");
  const fakeIX = { ...IX, targets: { ...IX.targets, a: { ...T.mars_elysium_planitia, id: "a", fingerprint: { ...T.mars_elysium_planitia.fingerprint, criterion_status: { ...T.mars_elysium_planitia.fingerprint.criterion_status, slope: "MISSING", surface_roughness: "MISSING" } } } } };
  const p = REG.aggregatePlan(fakeIX, ["a", "moon_shackleton"], "minimum", crit);
  check(!p.ok && /share no DIRECT/.test(p.reason), "no shared DIRECT criterion → aggregate blocked (never compared silently)");
  const pm = REG.aggregatePlan(IX, ["mars_gale_curiosity", "moon_shackleton"], "mean", crit);
  check(pm.ok && pm.excluded.includes("annual_temperature_range") && pm.config === "atlas-direct-v1", "mean: allowed on shared DIRECT only, exclusions listed");
}
// legacy cross-planet regression: bitwise = baseline engine min rule
{
  const r = REG.aggregate({ IX, A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, targetIds: ["mars_jezero", "moon_south_pole"], kind: "minimum", w: W0, legacyRanges: D.ranges });
  const a = ENG.similarity(D.A, crit, D.targets.mars_jezero.variables, W0, D.ranges).eff, b = ENG.similarity(D.A, crit, D.targets.moon_south_pole.variables, W0, D.ranges).eff;
  let diff = 0; for (let i = 0; i < D.n; i++) { const want = (a[i] < 0 || b[i] < 0) ? -1 : Math.min(a[i], b[i]); if (!Object.is(want, r.eff[i])) diff++; }
  check(r.plan.legacy === "legacy_cross_planet" && r.plan.config === "legacy-baseline-v1", "Jezero + South Pole + minimum → legacy experiment configuration");
  check(diff === 0, `legacy cross-planet aggregate bitwise = baseline min rule (${diff} differences)`);
  const order = ENG.order(r.eff, cell), dist = ENG.distinctSites(order, D.lat, D.lon, 20, 300);
  check(JSON.stringify(dist) === JSON.stringify(r.top.map(x => x.i)), "legacy cross-planet distinct sites identical to the baseline");
}
{
  const r = REG.aggregate({ IX, A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, targetIds: ["mars_gale_curiosity", "moon_shackleton"], kind: "pareto", w: W0 });
  const F = r.perTarget, f = r.front;
  const dominated = f.some(i => f.some(j => j !== i && F.every(x => x[j] >= x[i]) && F.some(x => x[j] > x[i])));
  check(f.length > 0 && !dominated, `Pareto front: ${f.length} cells, none dominated by another front cell`);
  let bad = 0; for (let i = 0; i < D.n; i += 97) { if (!F.every(x => x[i] >= 0) || f.includes(i)) continue; if (!f.some(j => F.every(x => x[j] >= x[i]))) bad++; }
  check(bad === 0, "every sampled non-front cell is weakly dominated by a front cell");
  const r3 = REG.aggregate({ IX, A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, targetIds: ["mars_gale_curiosity", "moon_shackleton", "moon_cabeus"], kind: "minimum", w: W0 });
  let ok3 = true; for (let i = 0; i < D.n; i += 53) { const v = r3.perTarget.some(x => x[i] < 0) ? -1 : Math.min(...r3.perTarget.map(x => x[i])); if (!Object.is(v, r3.eff[i])) ok3 = false; }
  check(ok3 && r3.plan.criteria.length === 3, "three-target minimum on the shared DIRECT criteria");
  const pc = REG.aggregate({ IX, A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, targetIds: ["mars_gale_curiosity", "moon_shackleton"], kind: "per_criterion", w: W0 });
  check(Object.keys(pc.perCrit).join() === "slope,surface_roughness,lst_diurnal_range" && pc.eff === null, "per-criterion aggregate: one field per shared DIRECT criterion, no summed score");
  // the atlas-direct-v1 single-target field equals the Phase III atlas engine with 'target' normalisation
  const t3 = atlas.targets.find(t => t.id === "moon_shackleton");
  const ranges = ATL.rangesFor("target", { A: D.A, critIds: crit, tv: ATL.targetVector(t3, crit) });
  const e3 = ATL.scoreTarget(ATL.prepareTarget(D.A, crit, t3, ranges), W0).eff;
  let d3 = 0; for (let i = 0; i < D.n; i++) if (!Object.is(e3[i], pc.perTarget[1][i])) d3++;
  check(d3 === 0, `registry DIRECT-only field for Shackleton bitwise = Phase III atlas engine (${d3} differences)`);
}

// ---------------------------------------------------------------- 6 explore ranges: registry claim = browser recomputation
{
  let bad = [];
  for (const t of R.targets) {
    if (t.readiness.level < 3) continue;
    const want = t.legacy ? D.ranges : REG.earthUnionRanges(D.A, crit, Object.fromEntries(crit.map(c => [c, t.fingerprint.variables[c]])));
    if (JSON.stringify(want) !== JSON.stringify(t.scoring.explore_ranges)) bad.push(t.id);
  }
  check(!bad.length, "explore-target-v1 ranges in the registry = Earth ∪ target recomputed from the stack (" + (bad.join() || "all equal") + ")");
}

// ---------------------------------------------------------------- 7 validation workspace
{
  const P = LAB.prepare(D.A, crit, Object.fromEntries(crit.map(c => [c, T.mars_gale_curiosity.fingerprint.variables[c]])), T.mars_gale_curiosity.scoring.explore_ranges);
  const eff = LAB.fieldScore(P, W0).eff, ord = ENG.order(eff, cell);
  const at = i => ({ lat: D.lat[i], lon: D.lon[i] });
  const few = [0, 1, 2].map(k => ({ name: "case" + k, label: "positive", citation: "test input", ...at(ord[k * 100]) }));
  const m1 = REG.validationMetrics({ eff, cell, cases: few, idxMap: D.index });
  check(m1.recall[10] === null && m1.precision[10] === null && m1.sufficiency.length === 2, "< 5 positive cases → Recall@k and Precision@k withheld, with the reason");
  check(m1.rows[0].rank === 1 && m1.rows[1].rank === 101, "case ranks follow the baseline tie-break");
  const pos = [0, 5, 20, 80, 400].map((k, j) => ({ name: "p" + j, label: "positive", citation: "test input", ...at(ord[k]) }));
  const neg = [3, 30, 600, 900, 2000].map((k, j) => ({ name: "n" + j, label: "negative", citation: "test input", ...at(ord[k]) }));
  const m2 = REG.validationMetrics({ eff, cell, cases: [...pos, ...neg], idxMap: D.index, ks: [10, 100, 500] });
  check(m2.recall[10] === 2 / 5 && m2.recall[100] === 4 / 5 && m2.recall[500] === 1, "Recall@k arithmetic (2/5, 4/5, 5/5)");
  check(m2.precision[10] === 2 / 3 && m2.precision[100] === 4 / 6, "labelled Precision@k over labelled cases only (2/3, 4/6)");
  const bad = REG.validationMetrics({ eff, cell, idxMap: D.index, cases: [
    { name: "ocean", label: "positive", citation: "x", lat: 0, lon: -140 }, { name: "nocite", label: "positive", citation: "", lat: D.lat[ord[0]], lon: D.lon[ord[0]] },
    { name: "synthetic", label: "positive", citation: "x", source: "synthetic-fixture", lat: D.lat[ord[0]], lon: D.lon[ord[0]] }] });
  check(bad.rows.length === 0 && bad.rejected.length === 3 && bad.rejected[2].errors.some(e => /synthetic/.test(e)), "ocean cell, uncited and synthetic cases are rejected, with reasons");
  const ws = REG.weightSensitivity({ P, w: W0, cell, cases: pos, idxMap: D.index });
  check(ws.rows.length === 2 * P.applicable.filter(c => W0[c] > 0).length && ws.base[0] === 1, "weight sensitivity: every active weight × {0.5, 2}");
  check(REG.holdoutCheck().applicable === false, "holdout analysis declared not meaningful (no fitted parameters)");
  const rec = REG.validationRecord({ target: "mars_gale_curiosity", config: "explore-target-v1", w: W0, profile: "general", ranges: P.ranges, metrics: m2, cases: [...pos, ...neg], stackSha: D.app.stack.sha256, createdUtc: "2026-01-01T00:00:00Z" });
  check(rec.schema === "asterro.validation/1" && !rec.synthetic && /not a claim of scientific validation/.test(rec.statement), "validation record: schema, statement makes no validation claim");
  const recS = REG.validationRecord({ target: "x", config: "y", w: W0, profile: "general", ranges: {}, metrics: bad, cases: [{ source: "synthetic-fixture" }], stackSha: "", createdUtc: "" });
  check(recS.synthetic && /TEST FIXTURE/.test(recS.statement), "record containing synthetic cases is labelled TEST FIXTURE — not validation");
}

// ---------------------------------------------------------------- 8 mismatch explorer
{
  const t = T.moon_shackleton, ranges = t.scoring.explore_ranges, i = 1000;
  const mm = REG.mismatch({ t, i, A: D.A, critIds: crit, w: W0, ranges, thresholds: D.app.thresholds, cellKm: "0.5° × 0.625°" });
  const cls = Object.fromEntries(mm.map(m => [m.criterion, m.class]));
  check(cls.annual_temperature_range === "incompatible" && cls.aridity === "proxy_excluded" && cls.elevation === "proxy_excluded", "Shackleton: N/A → incompatible; proxies excluded by default");
  check(["agreement", "partial", "mismatch", "missing_earth"].includes(cls.slope), "terrain criterion gets a measured class");
  const mm2 = REG.mismatch({ t: T.mars_elysium_planitia, i, A: D.A, critIds: crit, w: W0, ranges: D.ranges, thresholds: D.app.thresholds, cellKm: "x" });
  check(mm2.find(m => m.criterion === "lst_diurnal_range").class === "missing_target", "Elysium: missing thermal → missing_target (never a match)");
  const g = REG.mismatch({ t: T.mars_gale_curiosity, i, A: D.A, critIds: crit, w: W0, ranges: D.ranges, thresholds: D.app.thresholds, cellKm: "x" });
  check(!!g.find(m => m.criterion === "lst_diurnal_range").scaleWarning, "Gale REMS: point-vs-cell scale difference stated");
  check(JSON.stringify(mm) === JSON.stringify(REG.mismatch({ t, i, A: D.A, critIds: crit, w: W0, ranges, thresholds: D.app.thresholds, cellKm: "0.5° × 0.625°" })), "mismatch explanations are deterministic");
}

// ---------------------------------------------------------------- 9 collections
{
  const c1 = { ...REG.newCollection("polar", "Polar windows", "2026-01-01T00:00:00Z"), items: [{ kind: "target", id: "moon_shackleton" }, { kind: "location", id: "moon:cabeus" }] };
  const doc = REG.exportCollections([c1], "2026-01-01T00:00:00Z");
  check(REG.validateCollections(doc, IX).length === 0, "exported collection validates");
  check(REG.validateCollections({ ...doc, schema: "x" }, IX).length === 1, "wrong schema rejected");
  check(REG.validateCollections({ schema: REG.COLLECTION_SCHEMA, collections: [{ ...c1, items: [{ kind: "target", id: "nope" }] }] }, IX).some(e => /unknown target/.test(e)), "unknown item rejected");
  check(REG.validateCollections({ schema: REG.COLLECTION_SCHEMA, collections: [c1, c1] }, IX).some(e => /duplicate/.test(e)), "duplicate collection id rejected");
  const same = REG.mergeCollections([c1], [c1]);
  check(same.skipped.join() === "polar" && same.collections.length === 1, "identical import skipped");
  const changed = REG.mergeCollections([c1], [{ ...c1, name: "Other" }]);
  check(changed.conflicts.length === 1 && changed.collections[0].name === "Polar windows", "conflicting import reported; existing collection NOT overwritten");
  const add = REG.mergeCollections([c1], [{ ...c1, id: "polar2" }]);
  check(add.added.join() === "polar2" && add.collections.length === 2, "new id added");
}

// ---------------------------------------------------------------- 10 provenance export
{
  const x = REG.provenanceExport(IX, { level: 2 });
  check(x.targets.length === 17 && x.targets.every(t => t.readiness.level === 2 && t.readiness.checks.length === 12), "export filtered by level, with every check");
  check(x.locations.every(l => l.readiness.level === 2) && x.datasets.every(Boolean), "export: locations filtered, datasets resolved");
  check(JSON.stringify(REG.provenanceExport(IX)) === JSON.stringify(REG.provenanceExport(IX)), "export is deterministic");
}

// ---------------------------------------------------------------- 11 scenario laboratory + contributions + snapshots
{
  const W = D.app.profiles, sc = [
    { id: "s1", label: "General · Earth ∪ target", weights: W.general.weights, include_proxy: false, normalisation: "earth_union_target" },
    { id: "s2", label: "Thermal · Earth ∪ target", weights: W.thermal.weights, include_proxy: false, normalisation: "earth_union_target" },
    { id: "s3", label: "General · with proxies", weights: W.general.weights, include_proxy: true, normalisation: "earth_union_target" },
    { id: "s4", label: "General · Earth only", weights: W.general.weights, include_proxy: false, normalisation: "earth_only" }];
  const r = REG.runScenarios({ IX, A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, targetId: "mars_gale_curiosity", scenarios: sc, algorithm: D.app.algorithm_version, createdUtc: "2026-01-01T00:00:00Z" });
  const t3 = atlas.targets.find(t => t.id === "mars_gale_curiosity");
  const e3 = ATL.scoreTarget(ATL.prepareTarget(D.A, crit, t3, ATL.rangesFor("target", { A: D.A, critIds: crit, tv: ATL.targetVector(t3, crit) })), W0).eff;
  let d = 0; for (let i = 0; i < D.n; i++) if (!Object.is(e3[i], r.runs[0].eff[i])) d++;
  check(d === 0, `scenario 'General · Earth ∪ target' bitwise = Phase III atlas default field (${d} differences)`);
  check(r.config.schema === "asterro.scenario-set/1" && r.config.scenarios.length === 4 && r.config.scenarios.every(s => s.expected_top.length === 20), "scenario set records weights, vector, ranges and expected sites");
  check(r.config.scenarios[2].target_vector.aridity === 0 && r.config.scenarios[0].target_vector.aridity === null, "proxy inclusion is explicit in the recorded target vector");
  check(r.ranks.length === 4 && r.ranks.every(rk => rk.length === r.union.length), "rank of every union candidate under every scenario");
  check(REG.replayScenarios({ IX, A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, config: r.config }).ok, "browser replay of the scenario set: identical");
  const bad = JSON.parse(JSON.stringify(r.config)); bad.scenarios[1].weights.slope = 3;
  check(!REG.replayScenarios({ IX, A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, config: bad }).ok, "tampered scenario weights → replay fails");
  let threw = false; try { REG.runScenarios({ IX, A: D.A, cell, lat: D.lat, lon: D.lon, critIds: crit, targetId: R.locations.find(l => !l.target_ids.length).id, scenarios: sc }); } catch (e) { threw = true; }
  check(threw, "scenario on a catalogued-only id is refused");
  const ct = REG.contributions(r.runs[0].P, W0, r.runs[0].top[0]), sum = Object.values(ct).reduce((a, b) => a + (b || 0), 0);
  check(Math.abs(sum - r.runs[0].eff[r.runs[0].top[0]]) < 1e-12, "criterion contributions sum to the cell score");
  fs.mkdirSync(root + "tests/phase4/fixtures", { recursive: true });
  fs.writeFileSync(root + "tests/phase4/fixtures/scenario_gale.json", JSON.stringify(r.config, null, 1));
  const snap = REG.snapshot(IX, ["mars_gale_curiosity"]);
  const col = { schema: REG.COLLECTION_SCHEMA, collections: [{ id: "rich", name: "Rich", version: 1, items: [
    { kind: "earth_cell", cell: cell[r.runs[0].top[0]], lat: D.lat[r.runs[0].top[0]], lon: D.lon[r.runs[0].top[0]], target: "mars_gale_curiosity", snapshot: snap },
    { kind: "scenario_set", config: r.config, snapshot: snap }, { kind: "comparison", config: { targets: ["mars_gale_curiosity", "moon_shackleton"], aggregate: "minimum" }, snapshot: snap },
    { kind: "reference", citation: "doi:10.0000/example", note: "test input" }] }] };
  check(REG.validateCollections(col, IX).length === 0, "collections accept Earth cells, scenario sets, comparisons and references with snapshots");
  const noSnap = JSON.parse(JSON.stringify(col)); delete noSnap.collections[0].items[0].snapshot;
  check(REG.validateCollections(noSnap, IX).some(e => /snapshot/.test(e)), "an Earth-cell item without a provenance snapshot is refused");
  check(REG.filterLocations(IX, { ftype: "Crater, craters" }).every(l => l.feature_type === "Crater, craters"), "terrain-category (feature type) filter");
}

console.log(`\n${n - fails}/${n} Phase IV registry engine checks passed`);
if (fails) process.exit(1);
