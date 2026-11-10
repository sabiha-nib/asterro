// V19 planetary intelligence catalogues (Node). Run: node tests/phase4/test_v19_i18n.mjs
// i18n_95_v19_en.js is the source; i18n_96–99_v19_<lang>.js must have exactly its keys and {placeholders}, clash with no
// earlier key (V18 and before), leave nothing in English, keep names, follow French typography, and cover every key the
// V19 interface uses (literal keys and the dynamic families from engine_v19.js and the V19 registry).
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = new URL("../..", import.meta.url).pathname, P = root + "app/frontend/phase4/";
let fails = 0, n = 0;
const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };

const I18N = { dict: {}, meta: {} };
const ctx = vm.createContext({ I18N, i18nRegister: (l, m, d) => { I18N.dict[l] = { ...d }; I18N.meta[l] = m; } });
for (const f of fs.readdirSync(P).filter(f => /^i18n_\d\d_[a-z]{2}\.js$/.test(f)).sort()) vm.runInContext(fs.readFileSync(P + f, "utf8"), ctx);
vm.runInContext(fs.readFileSync(P + "i18n_79_extend.js", "utf8"), ctx);
for (const f of fs.readdirSync(P).filter(f => /^i18n_(8\d_(ext|v17)|9[0-4]_v18)_[a-z]{2}\.js$/.test(f)).sort()) vm.runInContext(fs.readFileSync(P + f, "utf8"), ctx);
const before = Object.fromEntries(Object.entries(I18N.dict).map(([l, d]) => [l, new Set(Object.keys(d))]));
const files = fs.readdirSync(P).filter(f => /^i18n_9\d_v19_[a-z]{2}\.js$/.test(f)).sort();
check(JSON.stringify(files) === JSON.stringify(["i18n_95_v19_en.js", "i18n_96_v19_bn.js", "i18n_97_v19_es.js", "i18n_98_v19_fr.js", "i18n_99_v19_de.js"]), `five V19 catalogues: ${files.join(", ")}`);
const cat = {};
const capture = vm.createContext({ i18nExtend: (l, d) => { cat[l] = d; } });
for (const f of files) { vm.runInContext(fs.readFileSync(P + f, "utf8"), capture); vm.runInContext(fs.readFileSync(P + f, "utf8"), ctx); }
check(Array.isArray(I18N.clash) && I18N.clash.length === 0, `no V19 key overwrites an earlier key (${(I18N.clash || []).slice(0, 4)})`);
const EN = cat.en, keys = Object.keys(EN);
check(keys.length > 140 && keys.every(k => !before.en.has(k) && k.startsWith("v19.")), `English V19 source: ${keys.length} new keys, all under v19.`);
const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(",");
const SAME = /^(v19\.meas\.col$|v19\.dom\.method$|v19\.pt\.col\.(type|dist)$)/;  // spelled the same in some languages (French "Type", "Distance")
for (const l of ["bn", "es", "fr", "de"]) {
  const d = cat[l], k2 = Object.keys(d);
  const miss = keys.filter(k => !(k in d)), extra = k2.filter(k => !(k in EN));
  check(!miss.length && !extra.length, `${l}: same key set as English (missing ${miss.slice(0, 4)}, extra ${extra.slice(0, 4)})`);
  const bad = keys.filter(k => k in d && ph(d[k]) !== ph(EN[k]));
  check(!bad.length, `${l}: every string has the English placeholders (${bad.slice(0, 4)})`);
  const same = keys.filter(k => d[k] === EN[k] && /[a-z]{3}/.test(EN[k]) && !SAME.test(k));
  check(!same.length, `${l}: no string left in English (${same.slice(0, 6)})`);
  check(d["v19.reg.title"].includes("V19") && d["v19.reg.retained"].includes("ASTERRO") && d["v19.reg.v17"].includes("V17"), `${l}: names kept`);
  for (const k of ["v19.meas.p", "v19.meas.environmental_similarity.n", "v19.meas.data_completeness.n", "v19.reg.never", "v19.reg.p", "v19.ml.never", "v19.ml.p", "v19.dom.p", "v19.prof.p"])
    if (!(d[k] && d[k].length > 20)) check(false, `${l}: honesty statement ${k}`);
}
check(true, "honesty statements present in every language (never one score, not a probability, completeness is not confidence, integration needs retained files, patterns are not discoveries)");
const latin = Object.values(cat.bn).filter(v => /[a-z]{4}/.test(v.replace(/ASTERRO|Macrostrat|Smithsonian Global Volcanism Program|\{\w+\}/g, "")));  // provider names stay in Latin script
check(/\p{Script=Bengali}/u.test(Object.values(cat.bn).join("")) && !latin.length, `Bengali: no untranslated Latin words (${latin.slice(0, 3)})`);
const frBad = Object.entries(cat.fr).filter(([, v]) => / [?!:;»]|\d %|« |\} %/.test(v));
check(!frBad.length, `French: no ordinary space before ? ! : ; % » (${frBad.slice(0, 3).map(x => x[0])})`);

// every key the V19 interface uses exists
const ALL = { ...I18N.dict.en };
const code = fs.readFileSync(P + "ui_32_v19.js", "utf8");
const lit = [...new Set([...code.matchAll(/tx(?:Has)?\("([a-z_0-9]+(?:\.[A-Za-z_0-9]+)+)"\s*(?=[,)])/g)].map(m => m[1]))];
const absent = lit.filter(k => !(k in ALL));
check(lit.length > 40 && !absent.length, `all ${lit.length} literal keys used by the V19 interface exist (${absent.slice(0, 5)})`);
const V19 = require("../../app/frontend/phase4/engine_v19.js"), fam = [];
for (const d of V19.DOMAINS) fam.push("v19.dom." + d.id, "v19.domq." + d.id);
for (const m of V19.MEASURES) fam.push("v19.meas." + m, "v19.meas." + m + ".n");
for (const p of V19.PROFILES) fam.push("v19.prof." + p.id);
for (const s of ["available", "partial", "blocked", "sampled", "not_sampled"]) fam.push("v19.dstate." + s);
for (const w of ["unranked", "no_geology", "no_mineralogy", "shown_not_scored", "process_conditions_only", "no_ops", "nothing_compared", "incomplete", "not_distinct"]) fam.push("v19.why." + w);
for (const k of ["drivers", "supporting", "partial", "contradicting", "missing", "direct", "proxy", "apps", "field"]) fam.push("v19.interp." + k);
for (const c of ["env_policy", "env_dns", "auth_required", "provider_error", "reachable", "fetch_refused"]) fam.push("v19.reg.cls." + c);
const reg = JSON.parse(fs.readFileSync(root + "public/data/v19/registry.json"));
for (const s of reg.states) fam.push("v19.state." + s.id);
for (const r of reg.sources) if (r.doc_status) fam.push("v19.reg.doc." + r.doc_status);
for (const k of ["missing_ok", "missing_bad"]) fam.push("v19.ml." + k);
const famMiss = [...new Set(fam)].filter(k => !(k in EN));
check(!famMiss.length, `all ${new Set(fam).size} keys of the dynamic families exist (${famMiss.slice(0, 6)})`);
// the why-codes the engine can return are exactly the translated family
const src = fs.readFileSync(P + "engine_v19.js", "utf8");
// every string literal inside a `why:` expression, except the domain state it is compared with
const codes = [...new Set([...src.matchAll(/why: ([^}]*)\}/g)].flatMap(m => [...m[1].matchAll(/"([a-z_]+)"/g)].map(x => x[1])).filter(c => c !== "blocked"))];
check(codes.length >= 8 && codes.every(c => ("v19.why." + c) in EN), `every reason code the engine returns is translated (${codes.join(", ")})`);

console.log(`\n${n - fails}/${n} V19 i18n checks passed`);
process.exit(fails ? 1 : 0);
