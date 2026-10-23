// Assemble the research-route catalogues from translated parts (developer tool).
//   node scripts/i18n_build_routes.mjs
// Inputs: the existing catalogue file itself (it is the source of truth; edit it directly), then, overlaid on it,
//         build/i18n/out/<lang>/part_*.json and build/i18n/extra_<lang>.json (new translations, optional),
//         build/i18n/catalogue_en.json (English source keys).
// Outputs: app/frontend/phase4/i18n_7N_routes_<lang>.js  — i18nRoutes("<lang>", { "<English key>": "<translation>" })
//          tests/phase4/fixtures/routes_catalogue_en.json — the English key list the tests check coverage against.
import fs from "node:fs";
const LANGS = { bn: 71, es: 72, fr: 73, de: 74 };
const C = JSON.parse(fs.readFileSync("build/i18n/catalogue_en.json", "utf8"));
const extraEn = fs.existsSync("build/i18n/extra_en.json") ? JSON.parse(fs.readFileSync("build/i18n/extra_en.json", "utf8")) : [];
const keys = [...new Set([...C.map(c => c.key), ...extraEn.map(e => e.key)])].sort();
fs.writeFileSync("tests/phase4/fixtures/routes_catalogue_en.json", "[" +
  [...C, ...extraEn].sort((a, b) => a.key < b.key ? -1 : 1).map(c => JSON.stringify({ key: c.key, routes: c.routes, quote: c.quote || undefined, attr: c.attr || undefined })).join(",\n") + "]\n");
for (const [lang, n] of Object.entries(LANGS)) {
  const T = {}, own = `app/frontend/phase4/i18n_${n}_routes_${lang}.js`;
  if (fs.existsSync(own)) { const D = {}; new Function("i18nRoutes", fs.readFileSync(own, "utf8"))((l, d) => Object.assign(D, d)); Object.assign(T, D); }
  if (fs.existsSync(`build/i18n/out/${lang}`)) for (const f of fs.readdirSync(`build/i18n/out/${lang}`).sort()) Object.assign(T, JSON.parse(fs.readFileSync(`build/i18n/out/${lang}/${f}`, "utf8")));
  const xf = `build/i18n/extra_${lang}.json`; if (fs.existsSync(xf)) Object.assign(T, JSON.parse(fs.readFileSync(xf, "utf8")));
  const miss = keys.filter(k => T[k] == null);
  if (miss.length) { console.error(lang, "missing", miss.length, miss.slice(0, 5)); process.exitCode = 1; }
  const body = keys.filter(k => T[k] != null).map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(T[k])}`).join(",\n");
  const head = `/* ===== Research-route catalogue · ${lang} =====\n * English segment key (see i18n_60_seg.js) → translation. Maintained with scripts/i18n_build_routes.mjs (which\n * reads this file back and adds new keys); edit translations here. Written by Claude (an AI model); NOT reviewed by a native\n * speaker — review status is tracked in docs/i18n/TRANSLATION_REGISTER.md. ${keys.length} keys. */\n`;
  fs.writeFileSync(`app/frontend/phase4/i18n_${n}_routes_${lang}.js`, head + `i18nRoutes(${JSON.stringify(lang)}, {\n${body}\n});\n`);
  console.log(lang, Object.keys(T).length, "→", `i18n_${n}_routes_${lang}.js`);
}
