// Phase II engine tests (Node). Run: node tests/phase2/test_lab_engine.mjs
// Real data: public/data/stack.bin (baseline bundle). Synthetic arrays are test inputs only.
import fs from "node:fs";
import { ENG, LAB, load, root } from "./_load.mjs";

let fails = 0, n = 0;
const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };
const throws = (f, msg) => { let t = false; try { f(); } catch (e) { t = true; } check(t, msg); };
const D = load(), crit = D.crit, cell = D.A.cell;
const W0 = D.app.profiles.general.weights;

// ---------------------------------------------------------------- 1 baseline bit-parity of the experimental path
for (const tid of ["mars_jezero", "moon_south_pole"]) {
  const tv = D.targets[tid].variables, P = LAB.prepare(D.A, crit, tv, D.ranges);
  for (const [nm, w] of Object.entries(D.app.profiles).map(([k, p]) => [k, p.weights]).concat([["custom", { aridity: 0, annual_temperature_range: 2.5, elevation: 1, slope: 3, surface_roughness: 0.5, lst_diurnal_range: 1 }]])) {
    const a = ENG.similarity(D.A, crit, tv, w, D.ranges).eff, b = LAB.fieldScore(P, w).eff;
    let diff = 0; for (let i = 0; i < D.n; i++) if (!Object.is(a[i], b[i])) diff++;
    check(diff === 0, `${tid}/${nm}: fieldScore bitwise = baseline engine (${diff} differences)`);
  }
}
{
  const PJ = LAB.prepare(D.A, crit, D.targets.mars_jezero.variables, D.ranges), PM = LAB.prepare(D.A, crit, D.targets.moon_south_pole.variables, D.ranges);
  const a = ENG.similarity(D.A, crit, D.targets.mars_jezero.variables, W0, D.ranges).eff, b = ENG.similarity(D.A, crit, D.targets.moon_south_pole.variables, W0, D.ranges).eff;
  const x = LAB.effFor([PJ, PM], W0); let diff = 0;
  for (let i = 0; i < D.n; i++) { const want = (a[i] < 0 || b[i] < 0) ? -1 : Math.min(a[i], b[i]); if (!Object.is(want, x[i])) diff++; }
  check(diff === 0, "cross-planet experimental field = min rule of baseline fields");
}
// the reference fixtures produced by the Python engine are still reproduced (baseline untouched)
for (const tid of ["mars_jezero", "moon_south_pole"]) {
  const ref = JSON.parse(fs.readFileSync(root + "tests/fixtures/reference.json"));
  const P = LAB.prepare(D.A, crit, D.targets[tid].variables, ref.ranges), eff = LAB.fieldScore(P, Object.fromEntries(crit.map(c => [c, 1]))).eff;
  const py = new Float64Array(fs.readFileSync(root + `tests/fixtures/ref_${tid}.f64`).buffer.slice(0));
  let diff = 0; for (let i = 0; i < D.n; i++) if (eff[i] !== py[i]) diff++;
  check(diff === 0, `${tid}: experimental path reproduces the Python baseline fixture bit-for-bit`);
}

// ---------------------------------------------------------------- 2 exact candidate ranks
{
  const tv = D.targets.mars_jezero.variables, eff = ENG.similarity(D.A, crit, tv, W0, D.ranges).eff;
  const r = ENG.ranksFromOrder(ENG.order(eff, cell)), o = ENG.order(eff, cell);
  const cand = [o[0], o[1], o[19], o[500], o[12345], o[D.n - 1]];
  const rk = LAB.candidateRanks(eff, cell, cand);
  check(cand.every((i, q) => rk[q] === r[i]), "candidateRanks equals full-sort ranks (incl. last/ineligible)");
  const e2 = new Float64Array([0.5, 0.9, 0.5, 0.5, -1, 0.9]), c2 = new Uint32Array([40, 12, 5, 33, 2, 7]);
  const want = ENG.ranksFromOrder(ENG.order(e2, c2)), got = LAB.candidateRanks(e2, c2, [0, 1, 2, 3, 4, 5]);
  check(Array.from(got).join() === Array.from(want).join(), "candidateRanks tie-break: score desc, then cell id asc");
}

// ---------------------------------------------------------------- 3 designs and bounds
{
  const act = crit.slice();
  const F = LAB.designFactorial(W0, act, crit);
  check(F.length === 729 && F.some(d => crit.every(c => d.w[c] === W0[c])), "factorial: 3^6 configs, includes the baseline");
  check(F.every(d => crit.every(c => d.w[c] > 0)), "factorial never removes a criterion");
  const O = LAB.designOAT(W0, act, crit); check(O.length === 12 && O.every(d => Object.keys(d.factors).length === 1), "OAT: one weight changed per config");
  const S1 = LAB.designSampled(W0, act, crit, 50, 7), S2 = LAB.designSampled(W0, act, crit, 50, 7), S3 = LAB.designSampled(W0, act, crit, 50, 8);
  check(LAB.canonical(S1) === LAB.canonical(S2) && LAB.canonical(S1) !== LAB.canonical(S3), "seeded sampler: same seed → identical, new seed → different");
  check(S1.every(d => crit.every(c => d.w[c] >= W0[c] / 2 - 1e-12 && d.w[c] <= W0[c] * 2 + 1e-12)), "sampled weights within ×2^±logRange");
  throws(() => LAB.designSampled(W0, act, crit, 5, 1), "samples below documented bound rejected");
  throws(() => LAB.designSampled(W0, act, crit, 50, -1), "negative seed rejected");
  throws(() => LAB.designFactorial(W0, act, crit, [0, 1]), "factor outside bounds rejected");
  throws(() => LAB.fieldScore(LAB.prepare(D.A, crit, D.targets.mars_jezero.variables, D.ranges), { ...W0, slope: NaN }), "NaN weight rejected");
  throws(() => LAB.fieldScore(LAB.prepare(D.A, crit, D.targets.mars_jezero.variables, D.ranges), { ...W0, slope: -1 }), "negative weight rejected");
  throws(() => LAB.fieldScore(LAB.prepare(D.A, crit, D.targets.mars_jezero.variables, D.ranges), Object.fromEntries(crit.map(c => [c, 0]))), "all-zero weights rejected");
}

// ---------------------------------------------------------------- 4 rank statistics + classification
{
  const run = { ranks: [Int32Array.from({ length: 20 }, () => 3), Int32Array.from({ length: 20 }, (_, q) => q < 12 ? 2 : 5000), Int32Array.from({ length: 20 }, (_, q) => q < 3 ? 1 : 9000)],
    nElig: Int32Array.from({ length: 20 }, () => 10000), baseRanks: [3, 2, 1] };
  const st = LAB.rankStats(run, { topPct: 1, topN: 20, stableFrac: 0.95, moderateFrac: 0.5 });
  check(st[0].cls === "STABLE" && st[1].cls === "MODERATELY_SENSITIVE" && st[2].cls === "HIGHLY_SENSITIVE", "classification thresholds applied as documented");
  check(st[1].median === 2 && st[1].p75 === 5000 && st[1].min === 2 && st[1].max === 5000, "nearest-rank quantiles");
  const st2 = LAB.rankStats(run, { coverage: [1, 0.8, 1] }); check(st2[1].cls === "INSUFFICIENT_EVIDENCE", "missing criterion (coverage < 1) → insufficient evidence");
  const short = { ranks: [Int32Array.from([1, 1, 1])], nElig: Int32Array.from([100, 100, 100]), baseRanks: [1] };
  check(LAB.rankStats(short)[0].cls === "INSUFFICIENT_EVIDENCE", "< 10 configurations → insufficient evidence");
  throws(() => LAB.rankStats(run, { stableFrac: 0.5 }), "stable threshold outside bounds rejected");
  throws(() => LAB.rankStats(run, { stableFrac: 0.9, moderateFrac: 0.9 }), "moderate ≥ stable rejected");
  const fl = LAB.pairFlips(run), f01 = fl.find(f => f.a === 0 && f.b === 1); check(fl[0].a === 0 && fl[0].b === 2 && Math.abs(fl[0].frac - 0.85) < 1e-12 && Math.abs(f01.frac - 0.4) < 1e-12, "pair flips counted against the baseline order");
}

// ---------------------------------------------------------------- 5 Pareto
{
  const pts = [{ id: "a", v: [1, 0] }, { id: "b", v: [0, 1] }, { id: "c", v: [0.5, 0.5] }, { id: "d", v: [0.4, 0.4] }, { id: "e", v: [1, 0] }, { id: "f", v: [NaN, 1] }];
  const P = LAB.pareto(pts);
  check(P.front.sort().join() === "a,b,c,e" && P.notEvaluable.join() === "f" && P.evaluated === 5, "Pareto: dominated removed, duplicates kept, NaN not evaluable");
}

// ---------------------------------------------------------------- 6 evidence protocol + canonical JSON
{
  throws(() => LAB.claim({ id: "x", text: "t", category: "PROBABLE" }), "claim: unknown category rejected");
  throws(() => LAB.claim({ id: "x", text: "t", category: "MEASURED" }), "claim: MEASURED without provenance rejected");
  throws(() => LAB.claim({ id: "x", text: "t", category: "DERIVED" }), "claim: DERIVED without method rejected");
  throws(() => LAB.claim({ id: "x", text: "t", category: "UNAVAILABLE", completeness: "complete" }), "claim: UNAVAILABLE must have completeness none");
  const c = LAB.claim({ id: "x", text: "t", category: "MEASURED", provenance: ["MODIS"] }); check(Object.isFrozen(c) && c.completeness === "complete", "claim frozen with defaults");
  check(LAB.canonical({ b: 1, a: [2, NaN, Infinity], c: { y: 1, x: null } }) === '{"a":[2,null,null],"b":1,"c":{"x":null,"y":1}}', "canonical JSON: sorted keys, non-finite → null");
}

// ---------------------------------------------------------------- 7 requirements — missing data never a match
{
  const reg = { slope: { field: "slope", label: "Slope", unit: "°", fmt: 2, statistic: "cell mean", dataset: "GMTED", resolution: "cell", years: null, temporal: "static", get: (A, i) => A.slope[i] },
    lst_diurnal_range: { field: "lst_diurnal_range", label: "LST", unit: "K", fmt: 2, statistic: "mean", dataset: "MODIS", resolution: "cell", years: 10, temporal: "2016–2025", get: (A, i) => A.lst_diurnal_range[i] } };
  const A = { slope: new Float64Array([1, 1.5, NaN, 9]), lst_diurnal_range: new Float64Array([30, 30, 30, 30]) };
  const ctx = { A, cell: new Uint32Array([0, 1, 2, 3]), index: Int32Array.from({ length: 361 * 576 }, (_, k) => k < 4 ? k : -1), cellAreaKm2: () => 1000, cellSizeKm: () => [55, 69] };
  const ev = (q, i) => LAB.evaluateRequirement({ variable: "slope", op: "<=", value: 5, ...q }, i, reg, ctx).status;
  check(ev({}, 0) === "MEETS" && ev({}, 3) === "FAILS" && ev({}, 2) === "CANNOT", "requirement: meets / fails / missing → cannot evaluate");
  check(ev({ requiredResolutionKm: 1 }, 0) === "PARTIAL" && ev({ requiredResolutionKm: 1 }, 2) === "CANNOT", "required resolution finer than data → partial; missing stays cannot");
  check(ev({ requiredYears: 5 }, 0) === "PARTIAL", "temporal requirement on a static variable → partial");
  check(LAB.evaluateRequirement({ variable: "lst_diurnal_range", op: ">=", value: 20, requiredYears: 20 }, 0, reg, ctx).status === "PARTIAL", "record shorter than required → partial");
  check(ev({ minAreaKm2: 1500 }, 0) === "MEETS" && ev({ minAreaKm2: 2500 }, 0) === "FAILS", "contiguous area condition (cells 0–1 qualify; missing cell 2 breaks the region)");
  throws(() => LAB.validateRequirement({ variable: "slope", op: "between", value: [5, 1] }, reg), "between with lo > hi rejected");
  throws(() => LAB.validateRequirement({ variable: "gravity", op: "<=", value: 1 }, reg), "unknown variable rejected");
}

// ---------------------------------------------------------------- 8 temporal statistics
{
  const ts = LAB.theilSen([1, 2, 3, 4, 5], [1, 3, 5, 7, 100]); check(Math.abs(ts.slope - 2) < 1e-12, "Theil–Sen robust to an outlier (slope 2)");
  const mk = LAB.mannKendall([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); check(mk.S === 45 && mk.p < 0.001 && Math.abs(mk.tau - 1) < 1e-12, "Mann–Kendall monotonic series");
  const mk0 = LAB.mannKendall([5, 5, 5, 5, 5]); check(mk0.S === 0 && mk0.z === 0 && mk0.p > 0.999, "Mann–Kendall constant series: no trend");
  check(LAB.mannKendall([1, NaN, 2]) === null && LAB.theilSen([1, 2], [1, 2]) === null, "insufficient points → null (no test)");
  const hm = LAB.harmonic([...Array(12)].map((_, k) => 10 + 5 * Math.cos(2 * Math.PI * (k + 0.5) / 12))); check(Math.abs(hm.amplitude - 5) < 1e-9 && Math.abs(hm.varianceExplained - 1) < 1e-9, "harmonic fit recovers amplitude");
}

// ---------------------------------------------------------------- 9 neighbourhood (context only)
{
  const i = D.index[180 * 576 + 100] >= 0 ? D.index[180 * 576 + 100] : 0;
  const W = LAB.neighbourhood({ i, r: 2, cell, index: D.index }); check(W.length === 25 && W.filter(w => w.centre).length === 1 && W.find(w => w.centre).k === i, "5×5 window centred on the candidate");
  const south = Array.from(cell).findIndex(c => Math.floor(c / 576) <= 1);
  if (south >= 0) { const Ws = LAB.neighbourhood({ i: south, r: 3, cell, index: D.index }); check(Ws.some(w => w.offGrid), "window beyond the pole marked off-grid (not wrapped)"); }
  const WA = LAB.windowAnalysis({ i, r: 1, cell, index: D.index, A: D.A, crits: crit, lat: D.lat, lon: D.lon, tvs: {}, ranges: D.ranges });
  check(WA.perCrit.slope.stats.n === WA.cellsValid && WA.perCrit.slope.centre === D.A.slope[i], "window statistics use only valid whole cells; centre value unchanged");
}

// ---------------------------------------------------------------- 10 language guardrails
{
  const f = LAB.reviewText("Scientifically identical, certified safe and NASA-approved; the best site, validated.");
  const kinds = new Set(f.map(x => x.issue.split(" ")[0])); check(f.length >= 5, `guardrails flag ${f.length} phrases`);
  check(LAB.reviewText("Similar under the selected modelled criteria; additional evidence is required.").length === 0, "guardrails accept preferred language");
}

// ---------------------------------------------------------------- 11 performance (actual dataset)
{
  const P = LAB.prepare(D.A, crit, D.targets.mars_jezero.variables, D.ranges), eff = LAB.fieldScore(P, W0).eff, o = ENG.order(eff, cell);
  const cand = ENG.distinctSites(o, D.lat, D.lon, 20, 300);
  const t0 = performance.now(); const run = LAB.runDesignSync({ Ps: [P], cell, cand, baseW: W0, design: LAB.designFactorial(W0, crit, crit) }); const ms = performance.now() - t0;
  check(run.ranks.length === 20 && run.ranks[0].length === 729, `factorial robustness on 76,781 cells × 729 configs × 20 candidates: ${(ms / 1000).toFixed(2)} s`);
  check(ms < 60000, "performance budget < 60 s in Node");
  const t1 = performance.now(); LAB.ablation({ ENG, Ps: [P], cell, lat: D.lat, lon: D.lon, baseW: W0, act: crit, critIds: crit }); console.log(`     ablation (6 full re-rankings): ${((performance.now() - t1) / 1000).toFixed(2)} s`);
}


// ---------------------------------------------------------------- 12 integration safety: no Phase II global shadows a baseline global
{
  const decl = src => { const out = new Set(); for (const line of src.split("\n")) {
    let m = line.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/) || line.match(/^class\s+([A-Za-z_$][\w$]*)/);
    if (m) { out.add(m[1]); continue; }
    m = line.match(/^(?:const|let|var)\s+(.*)$/);
    if (m) { let depth = 0, cur = "", parts = []; for (const ch of m[1]) { if ("([{".includes(ch)) depth++; if (")]}".includes(ch)) depth--; if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch; } parts.push(cur);
      for (const p of parts) { const n = p.trim().match(/^([A-Za-z_$][\w$]*)\s*=/); if (n) out.add(n[1]); } } }
    return out; };
  const dir = root + "app/frontend/js/", p2 = root + "app/frontend/phase2/";
  const base = new Set(), mine = new Set();
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".js"))) for (const x of decl(fs.readFileSync(dir + f, "utf8"))) base.add(x);
  for (const f of fs.readdirSync(p2).filter(f => f.startsWith("ui_"))) for (const x of decl(fs.readFileSync(p2 + f, "utf8"))) mine.add(x);
  const clash = [...mine].filter(x => base.has(x));
  check(clash.length === 0, `no Phase II top-level name redeclares a baseline name (${mine.size} new names${clash.length ? "; clashes: " + clash.join(", ") : ""})`);
  check(base.has("renderLeft") && !mine.has("renderLeft"), "renderLeft is wrapped by assignment, not redeclared");
}
console.log(fails ? `\n${fails}/${n} FAILED (incl. integration checks)` : `\nALL ${n} PHASE II ENGINE CHECKS PASSED`);
process.exit(fails ? 1 : 0);
