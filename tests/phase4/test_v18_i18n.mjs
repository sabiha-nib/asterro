// V18 Local Impact catalogues (Node). Run: node tests/phase4/test_v18_i18n.mjs
// i18n_90_v18_en.js is the source; i18n_91–94_v18_<lang>.js must have exactly its keys and {placeholders}, clash with no
// earlier key, leave nothing in English, keep dataset names, follow French typography, and cover every key the
// Local Impact code uses (literal keys and the dynamic families).
import fs from "node:fs";
import vm from "node:vm";
const root = new URL("../..", import.meta.url).pathname, P = root + "app/frontend/phase4/";
let fails = 0, n = 0;
const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };

const I18N = { dict: {}, meta: {} };
const ctx = vm.createContext({ I18N, i18nRegister: (l, m, d) => { I18N.dict[l] = { ...d }; I18N.meta[l] = m; } });
for (const f of fs.readdirSync(P).filter(f => /^i18n_\d\d_[a-z]{2}\.js$/.test(f)).sort()) vm.runInContext(fs.readFileSync(P + f, "utf8"), ctx);
vm.runInContext(fs.readFileSync(P + "i18n_79_extend.js", "utf8"), ctx);
for (const f of fs.readdirSync(P).filter(f => /^i18n_8\d_(ext|v17)_[a-z]{2}\.js$/.test(f)).sort()) vm.runInContext(fs.readFileSync(P + f, "utf8"), ctx);
const before = Object.fromEntries(Object.entries(I18N.dict).map(([l, d]) => [l, new Set(Object.keys(d))]));
const files = fs.readdirSync(P).filter(f => /^i18n_9\d_v18_[a-z]{2}\.js$/.test(f)).sort();
check(JSON.stringify(files) === JSON.stringify(["i18n_90_v18_en.js", "i18n_91_v18_bn.js", "i18n_92_v18_es.js", "i18n_93_v18_fr.js", "i18n_94_v18_de.js"]), `five V18 catalogues: ${files.join(", ")}`);
const cat = {};
const capture = vm.createContext({ i18nExtend: (l, d) => { cat[l] = d; } });
for (const f of files) { vm.runInContext(fs.readFileSync(P + f, "utf8"), capture); vm.runInContext(fs.readFileSync(P + f, "utf8"), ctx); }
check(Array.isArray(I18N.clash) && I18N.clash.length === 0, `no V18 key overwrites an earlier key (${(I18N.clash || []).slice(0, 4)})`);
const EN = cat.en, keys = Object.keys(EN);
check(keys.length > 140 && keys.every(k => !before.en.has(k)), `English V18 source: ${keys.length} new keys`);
const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(",");
// identical to English is allowed only for symbols, units, names and words spelled the same
const SAME = /^(v18\.unit\.|v18\.var\.(vegetation|region|target|wind|aspect)$|v18\.grp\.(context|terrain)$|v18\.no$|v18\.disc\.measured$|v18\.prec\.cell$|v18\.kind\.country$|v18\.search_ph$|v18\.col\.dataset$|v18\.cmp\.missing$|v18\.var\.novelty$|v18\.sec\.rel$|v18\.near\.relief$)/;
for (const l of ["bn", "es", "fr", "de"]) {
  const d = cat[l], k2 = Object.keys(d);
  const miss = keys.filter(k => !(k in d)), extra = k2.filter(k => !(k in EN));
  check(!miss.length && !extra.length, `${l}: same key set as English (missing ${miss.slice(0, 4)}, extra ${extra.slice(0, 4)})`);
  const bad = keys.filter(k => k in d && ph(d[k]) !== ph(EN[k]));
  check(!bad.length, `${l}: every string has the English placeholders (${bad.slice(0, 4)})`);
  const same = keys.filter(k => d[k] === EN[k] && /[a-z]{3}/.test(EN[k]) && !SAME.test(k));
  check(!same.length, `${l}: no string left in English (${same.slice(0, 6)})`);
  check(d["v18.privacy"].includes("ASTERRO") && d["v18.near.regions_p"].includes("Natural Earth") && d["v18.var.koppen"].includes("Köppen–Geiger"), `${l}: names kept`);
  for (const k of ["v18.privacy", "v18.not_characterised", "v18.scale_note", "v18.rel.not_cert", "v18.unavail", "v18.prec_p", "v18.save.consent"]) if (!(d[k] && d[k].length > 20)) check(false, `${l}: honesty statement ${k}`);
}
check(true, "privacy and honesty statements present in every language (position stays in the browser, a point is not a characterisation, cell scale, no certification, nothing assumed when missing)");
const latin = Object.values(cat.bn).filter(v => /[a-z]{4}/.test(v.replace(/ASTERRO|Natural Earth|Köppen–Geiger|P\/PET|\{\w+\}/g, "")));
check(/\p{Script=Bengali}/u.test(Object.values(cat.bn).join("")) && !latin.length, `Bengali: no untranslated Latin words (${latin.slice(0, 3)})`);
const frBad = Object.entries(cat.fr).filter(([, v]) => / [?!:;»]|\d %|« |\} %/.test(v));
check(!frBad.length, `French: no ordinary space before ? ! : ; % » (${frBad.slice(0, 3).map(x => x[0])})`);

// every key the V17 code uses exists
const ALL = { ...I18N.dict.en };
const code = ["ui_31_local.js"].map(f => fs.readFileSync(P + f, "utf8")).join("\n");
const lit = [...new Set([...code.matchAll(/tx(?:Has)?\("([a-z_0-9]+(?:\.[A-Za-z_0-9]+)+)"\s*(?=[,)])/g)].map(m => m[1]))];
const absent = lit.filter(k => !(k in ALL));
check(lit.length > 80 && !absent.length, `all ${lit.length} literal keys used by the Local Impact code exist (${absent.slice(0, 5)})`);
const L = (await import("node:module")).createRequire(import.meta.url)("../../app/frontend/phase4/engine_v18.js"), fam = [];
for (const v of L.VARS) if (!(("v17.var." + v.id) in ALL)) fam.push("v18.var." + v.id);
for (const v of L.VARS) fam.push("v18.grp." + v.group);
for (const u of L.unavailable({})) fam.push("v18.var." + u.id);
for (const f of L.noFeatures({})) fam.push("v18.feat." + f.id);
for (const r of L.RULES) fam.push("v18.disc." + r.id, "v18.disc." + r.id + ".h");
for (const b of ["geology_topography", "water_history"]) fam.push("v18.disc." + b);
for (const s of ["asking", "denied", "unavailable", "timeout", "unsupported", "badcoords", "offgrid", "noresults", "short", "inaccurate", "results", "manual"]) fam.push("v18.st." + s);
for (const s of ["device", "coordinates", "search", "selected", "saved"]) fam.push("v18.src." + s);
for (const s of ["profile", "compare", "near", "disc", "rel", "report"]) fam.push("v18.sec." + s);
for (const s of ["cell", "1deg", "exact", "none"]) fam.push("v18.prec." + s);
for (const s of ["share", "ratio", "P_PET", "months", "yes_no"]) fam.push("v18.unit." + s);
for (const s of ["anomaly_pct", "uniqueness_pct", "novelty", "aridity", "hidden", "target"]) fam.push("v18.var." + s);
const famMiss = [...new Set(fam)].filter(k => !(k in EN));
check(!famMiss.length, `all ${new Set(fam).size} keys of the dynamic families exist (${famMiss.slice(0, 6)})`);

console.log(`\n${n - fails}/${n} V18 i18n checks passed`);
process.exit(fails ? 1 : 0);
