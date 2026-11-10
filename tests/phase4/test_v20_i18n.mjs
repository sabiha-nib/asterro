// V20 interface catalogues (Node): five languages with the same keys and placeholders, no key overwriting an earlier
// catalogue, nothing left in English outside names, every literal key the interface uses exists, and the hero title is
// two words in every language.
import fs from "node:fs";
const root = new URL("../..", import.meta.url).pathname, dir = root + "app/frontend/phase4/";
let fails = 0, n = 0; const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };
const load = f => { const t = fs.readFileSync(dir + f, "utf8"); return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); };
const files = fs.readdirSync(dir).filter(f => /^i18n_9y\d_v20_[a-z]{2}\.js$/.test(f)).sort();
check(files.length === 5, `five V20 catalogues (${files.join(", ")})`);
const cat = Object.fromEntries(files.map(f => [f.match(/_([a-z]{2})\.js$/)[1], load(f)])), EN = cat.en, keys = Object.keys(EN);
check(keys.length > 100 && keys.every(k => k.startsWith("v20.")), `English: ${keys.length} keys, all under v20.`);
const earlier = new Set(); for (const f of fs.readdirSync(dir).filter(f => /^i18n_.*\.js$/.test(f) && !f.includes("_v20_"))) { try { Object.keys(load(f)).forEach(k => earlier.add(k)); } catch (e) { } }
check(keys.every(k => !earlier.has(k)), "no V20 key overwrites an earlier key");
const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(",");
const SAME = /^v20\.(mrds\.src|mrds\.near_v|d\.atlas|d\.catalogue|d\.journal|d\.portfolio|d\.sources|d\.globe|menu|set\.v_ui|set\.d_online|set\.d_offline|set\.text_std|set\.contrast_std|g\.trust|nav\.title|d\.trace|set\.d_net)$/;
for (const l of ["bn", "es", "fr", "de"]) {
  const d = cat[l]; check(d && keys.every(k => k in d) && Object.keys(d).every(k => k in EN), `${l}: same key set as English`);
  check(keys.every(k => ph(d[k]) === ph(EN[k])), `${l}: every string keeps the English placeholders`);
  const same = keys.filter(k => d[k] === EN[k] && /[a-z]{4}/.test(EN[k].replace(/\{\w+\}|NASA|ASTERRO|USGS|MRDS|SHA-256|Mineral Resources Data System/g, "")) && !SAME.test(k));
  check(!same.length, `${l}: no sentence left in English (${same.slice(0, 5)})`);
}
for (const l of Object.keys(cat)) check(cat[l]["v20.hero.a"].trim().split(/\s+/).length === 1 && cat[l]["v20.hero.b"].trim().split(/\s+/).length === 1, `${l}: the hero title is two words (${cat[l]["v20.hero.a"]} ${cat[l]["v20.hero.b"]})`);
const ui = fs.readFileSync(dir + "ui_34_v20.js", "utf8");
const used = [...ui.matchAll(/v20T\("([a-z_.]+[a-z_])"/g)].map(m => "v20." + m[1]).filter(k => !/[._]$/.test(k));
check(used.length > 40 && used.every(k => k in EN), `every literal key the interface uses exists (${used.filter(k => !(k in EN)).slice(0, 4)})`);
const nav = [...ui.matchAll(/\["(discover|analyze|plan|evidence|trust)", \[([^\]]+)\]\]/g)];
const dest = nav.flatMap(m => m[2].match(/"([a-z]+)"/g).map(s => s.slice(1, -1)));
check(nav.length === 5 && dest.every(k => `v20.d.${k}` in EN && `v20.d.${k}_d` in EN) && nav.every(m => `v20.g.${m[1]}` in EN), `every group (${nav.length}) and destination (${dest.length}) has a label and a description`);
const em = keys.filter(k => Object.values(cat).some(d => /—/.test(d[k])));
check(!em.length, `no em dash in any V20 string (${em.slice(0, 3)})`);
console.log(`${n - fails}/${n} V20 i18n checks passed`);
process.exit(fails ? 1 : 0);
