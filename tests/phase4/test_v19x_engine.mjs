// V19 data extension engine (Node). Run: node tests/phase4/test_v19x_engine.mjs
// Decoding (missing never zero), integrity (size, SHA-256, cell order), domains and what they cannot say, analyses
// with their datasets and unavailable domains, reproducibility, and the Atacama facts.
import fs from "node:fs";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const X = require("../../app/frontend/phase4/engine_v19x.js");
const root = new URL("../..", import.meta.url).pathname;
let fails = 0, n = 0;
const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };
const man = JSON.parse(fs.readFileSync(root + "public/data/v19/env/cube.json")), raw = fs.readFileSync(root + "public/data/v19/env/cube.bin");
const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
const info = JSON.parse(fs.readFileSync(root + "data/metadata/stack_build.json")), sb = fs.readFileSync(root + "public/data/stack.bin");
const sab = sb.buffer.slice(sb.byteOffset, sb.byteOffset + sb.byteLength), L = info.layout.find(x => x.name === "cell"), cell = new Uint32Array(sab, L.offset, L.length);
const cellSha = crypto.createHash("sha256").update(Buffer.from(new Int32Array(cell).buffer)).digest("hex");

const v = await X.verify(man, buf, cellSha);
check(v.ok, "the published cube passes its integrity check (size, SHA-256, cell order)");
const bad = new Uint8Array(buf.slice(0)); bad[123] ^= 255;
check((await X.verify(man, bad.buffer, cellSha)).why === "hash", "a corrupted byte is refused (hash)");
check((await X.verify(man, buf.slice(0, buf.byteLength - 2), cellSha)).why === "size", "a truncated copy is refused (size)");
check((await X.verify(man, buf, "0".repeat(64))).why === "cells", "a cube for another cell order is refused (cells)");
check((await X.verify({}, buf, cellSha)).why === "manifest", "a manifest without a hash is refused");
let threw = false; try { X.create(man, buf.slice(0, 10)); } catch (e) { threw = true; } check(threw, "create() refuses data of the wrong size");

const C = X.create(man, buf), N = man.n;
check(C.n === cell.length, `the cube covers every valid land cell (${C.n})`);
const ia = Array.from(cell).indexOf(76787);
check(C.value("volc_holo_100km", ia) === 15 && C.value("lc_dominant", ia) === 16, "Atacama: 15 Holocene volcanoes within 100 km, dominant land cover Barren");
let nod = 0, nul = 0; const vi = man.variables.findIndex(x => x.id === "evi_mean"), arr = new Int16Array(buf, man.variables[vi].offset, N);
for (let i = 0; i < N; i++) { if (arr[i] === man.nodata) { nod++; if (C.value("evi_mean", i) === null) nul++; } }
check(nod > 0 && nod === nul, `missing values decode to null, never 0 (${nod} missing EVI cells)`);
check(C.value("nope", 0) === null && C.value("wind_ws10m", -1) === null && C.value("wind_ws10m", N) === null, "unknown variables and out-of-range cells give null");

const D = C.domains(ia);
check(D.length === 7 && D.every(d => d.not_said && d.n === d.rows.length), "seven domains, each with its statement of what it cannot say");
check(D.every(d => d.rows.every(r => r.datasets.length && r.kind && r.resolution && r.period)), "every value carries its datasets, evidence kind, resolution and period");
const lc = D.find(d => d.id === "surface_cover").rows.find(r => r.id === "lc_dominant");
check(lc.cls === "Barren", "the land-cover class is named from the manifest");
const sn = D.find(d => d.id === "snow_ice").rows.find(r => r.id === "snow_detected_maxmonth");
check(!sn || sn.value == null || sn.lower_bound === true, "MODIS-detected snow is always flagged as a lower bound");
// a dust cell with months in the open top bin is a lower bound
const di = man.variables.findIndex(x => x.id === "dust_top_bin_months"), dtop = new Int16Array(buf, man.variables[di].offset, N);
let j = -1; for (let i = 0; i < N; i++) if (dtop[i] > 0 && dtop[i] !== man.nodata) { j = i; break; }
check(j >= 0 && C.row("dust_sfc_maxmonth", j).lower_bound === true && C.row("dust_sfc_maxmonth", ia).lower_bound === false, "dust is a lower bound only where the open top bin was reached");

const A = C.analyse(ia, { source: "server", now: "2026-11-10T00:00:00Z" });
check(A.cube_sha256 === man.sha256 && A.datasets_used.length >= 5 && A.datasets_used.includes("gvp_holocene"), `the analysis records the cube hash and the ${A.datasets_used.length} datasets used`);
check(Array.isArray(A.domains_unavailable), "the analysis lists the domains without data");
const B = X.create(man, buf.slice(0)).analyse(ia, { source: "offline_store", now: "2026-11-11T00:00:00Z" });
check(X.sameAnalysis(A, B), "re-running the analysis from another copy of the cube reproduces the values exactly");
const ant = (() => { for (let i = 0; i < N; i++) if (cell[i] < 576 * 20) return i; return -1; })();
const AA = C.analyse(ant, {});
check(AA.domains_unavailable.includes("vegetation"), "an Antarctic cell has no vegetation data and says so");
console.log(`${n - fails}/${n} V19 data extension engine checks passed`);
process.exit(fails ? 1 : 0);
