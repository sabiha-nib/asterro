// Research-route translation tests (Node). Run: node tests/phase4/test_routes_i18n.mjs
// The four route catalogues carry exactly the English catalogue's keys (tests/phase4/fixtures/routes_catalogue_en.json,
// harvested from the running app by scripts/i18n_harvest.py), with the same placeholders; nothing is empty or left in
// English; Bengali entries are in Bengali script; the segment keys and identifier rules behave as documented; the
// country-name table only maps names whose CLDR English name is the Natural Earth name or a reviewed alias; and the
// terminology matches the glossary. This measures completeness and consistency — not quality, which needs a
// native-speaker review that has not taken place (docs/i18n/TRANSLATION_REGISTER.md).
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { loadSeg } from "../../scripts/i18n_seg_node.mjs";
const root = new URL("../..", import.meta.url).pathname, P = root + "app/frontend/phase4/";
let fails = 0, n = 0;
const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };

const C = JSON.parse(fs.readFileSync(root + "tests/phase4/fixtures/routes_catalogue_en.json", "utf8"));
const keys = C.map(c => c.key), want = new Set(keys);
check(keys.length > 2000 && want.size === keys.length, `English route catalogue: ${keys.length} distinct segment keys`);
const routes = new Set(C.flatMap(c => c.routes.map(r => r.split("/")[0])));
for (const r of ["compare", "scenarios", "discover", "data", "method", "lab", "trajectory", "atlas", "sheet"])
  check(routes.has(r), `the catalogue covers the ${r} route`);
const labMods = new Set(C.flatMap(c => c.routes.filter(r => r.startsWith("lab/")).map(r => r.slice(4))));
const atMods = new Set(C.flatMap(c => c.routes.filter(r => r.startsWith("atlas/")).map(r => r.slice(6))));
check(labMods.size >= 14, `all Lab modules harvested (${labMods.size}: ${[...labMods].join(", ")})`);
check(atMods.size >= 20, `Atlas modules harvested: ${atMods.size}`);

const ph = s => (s.match(/\{(?:n|p)?\d+\}/g) || []).sort().join(" ");
const FILES = { bn: "i18n_71_routes_bn.js", es: "i18n_72_routes_es.js", fr: "i18n_73_routes_fr.js", de: "i18n_74_routes_de.js" };
const T = {};
for (const [l, f] of Object.entries(FILES)) {
  const D = {}; vm.runInNewContext(fs.readFileSync(P + f, "utf8"), { i18nRoutes: (lang, d) => { if (lang === l) Object.assign(D, d); } }, { filename: f });
  T[l] = D;
  const k2 = Object.keys(D), miss = keys.filter(k => !(k in D)), extra = k2.filter(k => !want.has(k));
  check(!miss.length, `${l}: every catalogue key translated (${k2.length - extra.length}/${keys.length}; missing ${miss.slice(0, 3).map(s => s.slice(0, 50))})`);
  check(!extra.length, `${l}: no key outside the catalogue (${extra.slice(0, 3)})`);
  const bad = keys.filter(k => k in D && ph(D[k]) !== ph(k));
  check(!bad.length, `${l}: every translation carries exactly the key's placeholders ({0} elements, {nK} numbers, {pK} names) (${bad.slice(0, 3)})`);
  const empty = k2.filter(k => typeof D[k] !== "string" || !D[k].trim());
  check(!empty.length, `${l}: no empty translation (${empty.slice(0, 3)})`);
  const EN = /\b(the|and|which|with|this|that|from|these|those|is|are|were|been|has|have|not|only|every|each|when|where|than|into|between)\b/i;
  const same = keys.filter(k => D[k] === k && EN.test(k.replace(/\{(?:n|p)?\d+\}/g, " ")));
  check(!same.length, `${l}: no sentence left in English (${same.slice(0, 3).map(s => s.slice(0, 60))})`);
  if (l === "bn") {
    const noBn = keys.filter(k => /[a-z]{3,}/i.test(k.replace(/\{(?:n|p)?\d+\}/g, "")) && !/[\u0980-\u09FF]/.test(D[k] || ""));
    check(noBn.length <= keys.length * 0.05, `bn: entries with Latin words are rendered in Bengali script (${noBn.length} kept as identifiers, e.g. ${noBn.slice(0, 3).map(s => s.slice(0, 40))})`);
  }
  if (l === "fr") check(k2.filter(k => /\S[;:!?]/.test(D[k]) && /[;:!?]/.test(k) && !/https?:|\w:\w|[;:!?]["'»)\\]|\d:\d|src\/|"\w+":|_\w+,/.test(D[k])).length <= 3, "fr: high punctuation (; : ! ?) is preceded by a space");
}
// one key set for all four
check(new Set(Object.values(T).map(D => Object.keys(D).sort().join("\u0001"))).size === 1, "the four route catalogues have one identical key set");

// ---------------------------------------------------------------- the segment key and identifier rules
const G = loadSeg();
const kt = s => G.i18gKeyText(s).key;
check(kt("Top 20 distinct sites (≥ 300 km apart) of 76,781 ranked cells") === "Top {n0} distinct sites (≥ {n1} km apart) of {n2} ranked cells", "numbers become {nK} placeholders (grouping and decimals kept for re-formatting)");
check(kt("algorithm tai-sim-1.0.0, schema v2, MERRA-2, GMTED2010, L3") === "algorithm tai-sim-1.0.0, schema v2, MERRA-2, GMTED2010, L3", "versions, product names and readiness codes are not numbers");
for (const s of ["https://planetarynames.wr.usgs.gov/Feature/1784", "cfbe1bf5a9…", "7.9e-10", "mars_gale_curiosity.slope", "dem_moon", "SHA-256", "MOLA · LOLA · LRO", "SLOPE THERM ARID"])
  check(G.i18gAuto(G.i18gKeyText(s).key), `identifier kept as is: "${s}"`);
for (const s of ["Limitations:", "PHASE IV", "unmodelled", "Loading…", "No near-surface air-temperature record exists"])
  check(!G.i18gAuto(G.i18gKeyText(s).key), `ordinary text is translated, not treated as an identifier: "${s}"`);
{ const N = new Map(JSON.parse(fs.readFileSync(root + "tests/phase4/fixtures/i18n_names.json", "utf8"))); N._fixed = true; G.i18gSetNames(N); }
const nk = G.i18gNameKey("Window 28 km east of Shackleton Crater");
check(!!nk && /\{p0\}/.test(nk.key) && nk.names.includes("Shackleton Crater"), `known names become {pK} placeholders and are kept (${nk && nk.key})`);

// ---------------------------------------------------------------- country names through CLDR
{
  const src = fs.readFileSync(P + "i18n_65_places.js", "utf8"), ctx = {};
  vm.runInNewContext(src + "\nthis.ISO = I18G_ISO; this.ALIAS = I18G_ISO_ALIAS;", ctx);
  const dn = new Intl.DisplayNames(["en"], { type: "region" });
  const off = Object.entries(ctx.ISO).filter(([name, code]) => { const e = dn.of(code); return e !== name && ctx.ALIAS[name] !== e; });
  check(Object.keys(ctx.ISO).length > 200 && !off.length, `country table: ${Object.keys(ctx.ISO).length} Natural Earth names, each CLDR English name equals the Natural Earth name or its reviewed alias (${off.slice(0, 3)})`);
  const excluded = ["Somaliland", "N. Cyprus", "Siachen Glacier", "Indian Ocean Ter.", "Ashmore and Cartier Is.", "Palestine", "Hong Kong", "Macao"];
  check(excluded.every(x => !(x in ctx.ISO)), "names without an ISO code of their own, or framed differently by CLDR, stay as Natural Earth writes them");
  const de = new Intl.DisplayNames(["de"], { type: "region" }), bn = new Intl.DisplayNames(["bn"], { type: "region" });
  check(de.of(ctx.ISO["Bolivia"]) === "Bolivien" && /[\u0980-\u09FF]/.test(bn.of(ctx.ISO["Bolivia"])), `localised names come from CLDR (Bolivia → ${de.of(ctx.ISO["Bolivia"])}, ${bn.of(ctx.ISO["Bolivia"])})`);
}

// ---------------------------------------------------------------- terminology against the glossary
{
  const out = JSON.parse(execFileSync(process.execPath, [root + "scripts/i18n_terms_check.mjs", "--json"], { cwd: root, encoding: "utf8" }));
  for (const l of ["bn", "es", "fr", "de"]) check(out[l].share >= 0.95 && !out[l].below80.length, `${l}: ${out[l].consistent}/${out[l].entriesChecked} route entries use the glossary term (${Math.round(100 * out[l].share)} %; below 80 %: ${out[l].below80.join(", ") || "none"})`);
}
// ---------------------------------------------------------------- the review status is recorded, not claimed
{
  const reg = fs.readFileSync(root + "docs/i18n/TRANSLATION_REGISTER.md", "utf8");
  check(/not been reviewed by a native speaker|No native-speaker review/i.test(reg) && !/\breviewed and approved\b/i.test(reg), "the translation register records that no native-speaker review has taken place");
  for (const f of Object.values(FILES)) check(/NOT reviewed by a native/.test(fs.readFileSync(P + f, "utf8").slice(0, 600)), `${f} states its review status in its header`);
}
console.log(`\n${n - fails}/${n} checks passed`);
process.exitCode = fails ? 1 : 0;
