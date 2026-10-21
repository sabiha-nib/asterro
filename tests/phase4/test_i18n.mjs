// Interface-language tests (Node). Run: node tests/phase4/test_i18n.mjs
// Every language has exactly the English key set, the same {placeholders}, no empty or untranslated strings,
// every key the code uses exists, protected scientific terms survive, and Intl formats numbers per locale.
import fs from "node:fs";
import vm from "node:vm";
const root = new URL("../..", import.meta.url).pathname, P = root + "app/frontend/phase4/";
let fails = 0, n = 0;
const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };

const reg = {}, meta = {};
const ctx = vm.createContext({ i18nRegister: (l, m, d) => { reg[l] = d; meta[l] = m; } });
const files = fs.readdirSync(P).filter(f => /^i18n_\d\d_[a-z]{2}\.js$/.test(f)).sort();
for (const f of files) vm.runInContext(fs.readFileSync(P + f, "utf8"), ctx, { filename: f });
const langs = Object.keys(reg);
check(JSON.stringify(langs.sort()) === JSON.stringify(["bn", "en", "es", "fr"]), `four languages registered: ${langs.join(", ")}`);
const EN = reg.en, keys = Object.keys(EN);
check(keys.length > 250, `English source has ${keys.length} keys`);
const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(",");
for (const l of ["bn", "es", "fr"]) {
  const d = reg[l], k2 = Object.keys(d);
  const miss = keys.filter(k => !(k in d)), extra = k2.filter(k => !(k in EN));
  check(!miss.length && !extra.length, `${l}: same key set as English (missing ${miss.slice(0, 4)}, extra ${extra.slice(0, 4)})`);
  const bad = keys.filter(k => k in d && ph(d[k]) !== ph(EN[k]));
  check(!bad.length, `${l}: every string has the English placeholders (${bad.slice(0, 4)})`);
  const empty = k2.filter(k => !String(d[k]).trim());
  check(!empty.length, `${l}: no empty strings (${empty.slice(0, 4)})`);
  // identical to English is allowed only for codes, names and terms that are the same in that language
  const SAME = /^(tab\.atlas|chrome\.group\.mars|geo\.[nse]|body\.mars|tab\.data|tname\.cross|state\.similar|tab\.lab|crit\.(slope|elevation)(\.short|\.s)?|passport\.json|crit\.\w+\.short|lens\.score|sec\.lens|trust\.sources|reveal\.costs|tab\.(explore|trajectory)|sec\.passport|.*\.s)$/;
  const same = keys.filter(k => d[k] === EN[k] && EN[k].length > 3 && !SAME.test(k) && !/^[A-Z0-9 ·.\-–/()]+$/.test(EN[k]));
  check(!same.length, `${l}: no string left in English (${same.slice(0, 6)})`);
  check(meta[l].status === "draft-unreviewed" && /Claude/.test(d["lang.review_note"]), `${l}: marked as not yet reviewed by native speakers, and the interface says so`);
}
check(meta.en.status === "source", "English is the source language");
// protected terms: dataset / product names and units are never translated
for (const l of langs) {
  const d = reg[l];
  check(/NASA POWER/.test(d["hero.facts"]) && /GMTED2010/.test(d["hero.facts"]) && /MODIS/.test(d["hero.facts"]) && /Diviner/.test(d["hero.facts"]), `${l}: dataset names preserved in the landing facts`);
  check(/explore-target-v1/.test(d["story.shackleton.note"]) && /P\/PET/.test(d["crit.aridity.plain"]) && / K\b| K /.test(d["story.thermal.p"] + " "), `${l}: configuration ids, P/PET and units preserved`);
  check(/NASA/.test(d["trust.scope.body"]) && /NASA/.test(d["passport.disclaimer"]), `${l}: the no-endorsement statement is present`);
}
// English source keeps the baseline strings exactly (the default interface is unchanged)
check(EN["hero.facts"].replace("{n}", "76,781") === "76,781 valid land cells · 6 criteria from NASA POWER, MODIS & GMTED2010 · targets built from MEDA, MOLA, LOLA & Diviner · every score deterministic and traceable", "English landing facts equal the baseline sentence character for character");
check(["Explore", "Compare", "Scenarios", "Discover", "Data", "Method"].every((t, k) => EN["tab." + ["explore", "compare", "scenarios", "discover", "data", "method"][k]] === t) && EN["cta.search"] === "Search Earth", "English tab and button labels equal the baseline labels");
// every key the code uses exists; dynamic key families are complete
const src = ["ui_14_journey.js", "i18n_00_core.js"].map(f => fs.readFileSync(P + f, "utf8")).join("\n");
const used = [...src.matchAll(/tx[H]?\("([a-z_]+(?:\.[A-Za-z_/0-9]+)+)"(?!\s*\+)/g)].map(m => m[1]);
const lit = used.filter(k => !k.endsWith("."));
const absent = [...new Set(lit)].filter(k => !(k in EN));
check(!absent.length, `all ${new Set(lit).size} literal keys used by the code exist (${absent.slice(0, 5)})`);
const app = JSON.parse(fs.readFileSync(root + "public/data/app.json"));
const fam = [];
for (const c of app.criteria) for (const s of ["", ".short", ".plain", ".s"]) fam.push("crit." + c.id + s);
for (const p of Object.keys(app.profiles)) fam.push("profile." + p, "profile." + p + ".why");
for (const s of ["similar", "partial", "different", "unknown", "na", "off"]) fam.push("state." + s);
for (const s of ["DIRECT", "PROXY", "N/A", "MISSING"]) fam.push("status." + s);
for (const s of ["reveal", "lens", "change", "missing", "trust", "worlds", "time", "passport"]) fam.push("sec." + s);
for (let k = 1; k <= 7; k++) fam.push("reveal.s" + k);
for (const s of ["close", "partial", "weak", "none"]) fam.push("summary.level." + s);
for (const s of ["all", "most", "half", "few", "untested"]) fam.push("summary.robust." + s);
for (const s of ["gap", "caution", "info"]) fam.push("missing.sev." + s);
for (const s of ["target_na", "earth_missing", "target_proxy", "structural.above", "structural.below", "structural.none", "thin_coverage", "partial_coverage", "source_dependence", "proxy_dependence", "resolution", "resolution.notarget", "temporal", "not_measured"]) fam.push("missing." + s);
for (const s of ["measurements", "coverage", "limits", "robustness", "reproducibility", "sources", "scope"]) fam.push("trust." + s);
for (const s of ["stable", "variable", "none"]) fam.push("time.cls." + s);
for (const s of ["mars", "moon", "both"]) fam.push("body." + s);
for (const s of ["mars_jezero", "moon_south_pole", "cross", "moon_shackleton"]) fam.push("tname." + s);
for (const s of ["explore", "compare", "scenarios", "discover", "data", "method", "lab", "trajectory", "atlas"]) fam.push("tab." + s);
for (const s of ["n", "s", "e", "w"]) fam.push("geo." + s);
for (const s of ["verified", "bundled", "offline", "offline_plain"]) fam.push("badge." + s);
const famMiss = fam.filter(k => !(k in EN));
check(!famMiss.length, `all ${fam.length} keys of the dynamic families exist (${famMiss.slice(0, 5)})`);
// the journey engine and the methods engine use the same codes the interface names
const J = (await import("node:module")).createRequire(import.meta.url)(root + "app/frontend/phase4/journey_engine.js");
check(J.STATES.every(s => ("state." + s) in EN), "every lens state of the engine has a label");
// Intl number formatting per locale (what txNum / txPct do)
const f = (loc, x, d) => new Intl.NumberFormat(loc, { minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
check(f(meta.fr.locale, 84.99, 1) === "85,0" && f(meta.es.locale, 75.871, 1) === "75,9", "French and Spanish use a decimal comma");
check(f(meta.bn.locale, 85.0, 1) === "৮৫.০", `Bengali uses Bengali digits (${f(meta.bn.locale, 85.0, 1)})`);
check(f(meta.en.locale, 76781, 0) === "76,781", "English groups thousands with a comma");
check(meta.fr.pct === " " && meta.es.pct === " " && meta.bn.pct === "" && meta.en.pct === "", "percent sign spacing follows each language's convention");
// French typography: a (narrow) no-break space before ? ! : ;
const frBad = Object.entries(reg.fr).filter(([k, v]) => / [?!:;]/.test(v));
check(!frBad.length, `French: no ordinary space before ? ! : ; (${frBad.slice(0, 3).map(x => x[0])})`);
console.log(`\n${n - fails}/${n} i18n checks passed`);
process.exit(fails ? 1 : 0);
