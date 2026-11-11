// V20.1 shell catalogues (Node): five languages, same keys and placeholders, no key overwriting an earlier catalogue,
// nothing left in English outside names, every literal key the shell uses exists.
import fs from "node:fs";
const dir = new URL("../..", import.meta.url).pathname + "app/frontend/phase4/";
let fails = 0, n = 0; const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };
const load = f => { const t = fs.readFileSync(dir + f, "utf8"); return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); };
const files = fs.readdirSync(dir).filter(f => /^i18n_9z\d_v21_[a-z]{2}\.js$/.test(f)).sort();
check(files.length === 5, `five V20.1 catalogues (${files.join(", ")})`);
const cat = Object.fromEntries(files.map(f => [f.match(/_([a-z]{2})\.js$/)[1], load(f)])), EN = cat.en, keys = Object.keys(EN);
const earlier = new Set(); for (const f of fs.readdirSync(dir).filter(f => /^i18n_.*\.js$/.test(f) && !f.includes("_v21_"))) { try { Object.keys(load(f)).forEach(k => earlier.add(k)); } catch (e) { } }
check(keys.length >= 20 && keys.every(k => k.startsWith("v21.") && !earlier.has(k)), `English: ${keys.length} keys under v21., none overwriting an earlier key`);
const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(",");
const SAME = /^v21\.(mars|coords|lat_n|lat_s|lon_e|title_b|count)$/;
for (const l of ["bn", "es", "fr", "de"]) {
  const d = cat[l];
  check(d && keys.every(k => k in d) && Object.keys(d).every(k => k in EN) && keys.every(k => ph(d[k]) === ph(EN[k])), `${l}: same keys and placeholders as English`);
  const same = keys.filter(k => d[k] === EN[k] && /[a-z]{4}/.test(EN[k].replace(/\{\w+\}/g, "")) && !SAME.test(k));
  check(!same.length, `${l}: no sentence left in English (${same.slice(0, 5)})`);
}
const ui = fs.readFileSync(dir + "ui_35_v21.js", "utf8"), used = [...ui.matchAll(/v21T\("([a-z_]+)"/g)].map(m => "v21." + m[1]);
check(used.length > 10 && used.every(k => k in EN), `every literal key the shell uses exists (${used.filter(k => !(k in EN))})`);
check(!keys.some(k => Object.values(cat).some(d => /—/.test(d[k]))), "no em dash in any V20.1 string");
console.log(`${n - fails}/${n} V20.1 i18n checks passed`);
process.exit(fails ? 1 : 0);
