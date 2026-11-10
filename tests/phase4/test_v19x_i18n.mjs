// V19 data extension catalogues (Node): five languages with the same keys and placeholders, no key overwriting an
// earlier catalogue, nothing left in English outside names, and every key the interface uses exists.
import fs from "node:fs";
const root = new URL("../..", import.meta.url).pathname, dir = root + "app/frontend/phase4/";
let fails = 0, n = 0; const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };
const load = f => { const t = fs.readFileSync(dir + f, "utf8"); return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); };
const files = fs.readdirSync(dir).filter(f => /^i18n_9x\d_v19x_[a-z]{2}\.js$/.test(f)).sort();
check(files.length === 5, `five V19 data-extension catalogues (${files.join(", ")})`);
const cat = Object.fromEntries(files.map(f => [f.match(/_([a-z]{2})\.js$/)[1], load(f)])), EN = cat.en, keys = Object.keys(EN);
check(keys.length > 50 && keys.every(k => k.startsWith("v19x.")), `English: ${keys.length} keys, all under v19x.`);
const earlier = new Set(); for (const f of fs.readdirSync(dir).filter(f => /^i18n_.*\.js$/.test(f) && !f.includes("v19x"))) { try { Object.keys(load(f)).forEach(k => earlier.add(k)); } catch (e) { } }
check(keys.every(k => !earlier.has(k)), "no data-extension key overwrites an earlier key");
const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(",");
const SAME = /^v19x\.(nasa|kind\.catalogue|f\.(doi|variables|docs|validation)|dom\.vegetation|st\.(INTEGRATED|PROCESSED|ACCESSIBLE)|var\.(rh2m|albedo|evi_mean|evi_max|evi_months|aod_misr_mean|aod_misr_months)|unit\.)/;
for (const l of ["bn", "es", "fr", "de"]) {
  const d = cat[l]; check(d && keys.every(k => k in d) && Object.keys(d).every(k => k in EN), `${l}: same key set as English`);
  check(keys.every(k => ph(d[k]) === ph(EN[k])), `${l}: every string keeps the English placeholders`);
  const same = keys.filter(k => d[k] === EN[k] && /[a-z]{4}/.test(EN[k].replace(/\{\w+\}|NASA|ASTERRO|GIBS|MODIS|MISR|EVI|IGBP|MERRA-2|IndexedDB|SHA-256|DOI/g, "")) && !SAME.test(k));
  check(!same.length, `${l}: no sentence left in English (${same.slice(0, 5)})`);
}
const ui = fs.readFileSync(dir + "ui_33_v19x.js", "utf8"), used = [...ui.matchAll(/tx\("(v19x\.[a-z_.]+[a-z_])"/g)].map(m => m[1]).filter(k => !/[._]$/.test(k));  // a key ending in "_" or "." is a prefix completed at run time
check(used.length > 20 && used.every(k => k in EN), `every literal key the interface uses exists (${used.filter(k => !(k in EN)).slice(0, 4)})`);
const man = JSON.parse(fs.readFileSync(root + "public/data/v19/env/cube.json"));
const missingVar = man.variables.map(v => v.id).filter(id => id !== "volc_nearest_idx" && !("v19x.var." + id in EN));
check(!missingVar.length, `every displayed cube variable has a translated name (${missingVar})`);
console.log(`${n - fails}/${n} V19 data extension i18n checks passed`);
process.exit(fails ? 1 : 0);
