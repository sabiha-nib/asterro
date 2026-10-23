// Check a route translation file against the English catalogue.
//   node scripts/i18n_check_routes.mjs <lang> [file ...]
// Each file is a JSON object {englishKey: translation}. Reports: keys not in the catalogue, catalogue keys missing,
// placeholder mismatches ({0} {n0} {p0} must appear exactly as often as in the key), empty translations, and
// translations identical to English that contain ordinary English words (likely untranslated).
import fs from "node:fs";
const [lang, ...files] = process.argv.slice(2);
const C = JSON.parse(fs.readFileSync("build/i18n/catalogue_en.json", "utf8"));
const want = new Set(C.map(c => c.key));
const T = {};
for (const f of files) Object.assign(T, JSON.parse(fs.readFileSync(f, "utf8")));
const ph = s => (s.match(/\{(?:n|p)?\d+\}/g) || []).sort().join(" ");
const bad = [], extra = [], same = [];
for (const [k, v] of Object.entries(T)) {
  if (!want.has(k)) { extra.push(k); continue; }
  if (typeof v !== "string" || !v.trim()) bad.push(["empty", k]);
  else if (ph(k) !== ph(v)) bad.push(["placeholders", k, v]);
  else if (lang !== "en" && v === k && /\b(the|and|of|is|are|with|for|not|no|from|this|that|to|in|on|by|at|or)\b/i.test(k)) same.push(k);
}
const missing = [...want].filter(k => !(k in T));
console.log(JSON.stringify({ lang, translated: Object.keys(T).length - extra.length, catalogue: want.size, missing: missing.length, extra: extra.length, problems: bad.length, identicalEnglish: same.length }));
for (const b of bad.slice(0, 40)) console.log("PROBLEM", JSON.stringify(b));
for (const s of same.slice(0, 20)) console.log("SAME", JSON.stringify(s));
if (process.argv.includes("--missing")) for (const m of missing.slice(0, 50)) console.log("MISSING", JSON.stringify(m));
process.exitCode = bad.length ? 1 : 0;
