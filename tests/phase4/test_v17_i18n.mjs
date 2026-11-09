// V17 catalogues (Node). Run: node tests/phase4/test_v17_i18n.mjs
// i18n_85_v17_en.js is the source; i18n_86–89_v17_<lang>.js must have exactly its keys and {placeholders}, clash with no
// earlier key, leave nothing in English, keep dataset names, follow French typography, and cover every key the V17
// code uses (literal keys and the dynamic families built from the V17 documents).
import fs from "node:fs";
import vm from "node:vm";
const root = new URL("../..", import.meta.url).pathname, P = root + "app/frontend/phase4/";
let fails = 0, n = 0;
const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };

const I18N = { dict: {}, meta: {} };
const ctx = vm.createContext({ I18N, i18nRegister: (l, m, d) => { I18N.dict[l] = { ...d }; I18N.meta[l] = m; } });
for (const f of fs.readdirSync(P).filter(f => /^i18n_\d\d_[a-z]{2}\.js$/.test(f)).sort()) vm.runInContext(fs.readFileSync(P + f, "utf8"), ctx);
vm.runInContext(fs.readFileSync(P + "i18n_79_extend.js", "utf8"), ctx);
for (const f of fs.readdirSync(P).filter(f => /^i18n_8\d_ext_[a-z]{2}\.js$/.test(f)).sort()) vm.runInContext(fs.readFileSync(P + f, "utf8"), ctx);
const before = Object.fromEntries(Object.entries(I18N.dict).map(([l, d]) => [l, new Set(Object.keys(d))]));
const files = fs.readdirSync(P).filter(f => /^i18n_8\d_v17_[a-z]{2}\.js$/.test(f)).sort();
check(JSON.stringify(files) === JSON.stringify(["i18n_85_v17_en.js", "i18n_86_v17_bn.js", "i18n_87_v17_es.js", "i18n_88_v17_fr.js", "i18n_89_v17_de.js"]), `five V17 catalogues: ${files.join(", ")}`);
const cat = {};
const capture = vm.createContext({ i18nExtend: (l, d) => { cat[l] = d; } });
for (const f of files) { vm.runInContext(fs.readFileSync(P + f, "utf8"), capture); vm.runInContext(fs.readFileSync(P + f, "utf8"), ctx); }
check(Array.isArray(I18N.clash) && I18N.clash.length === 0, `no V17 key overwrites an earlier key (${(I18N.clash || []).slice(0, 4)})`);
const EN = cat.en, keys = Object.keys(EN);
check(keys.length > 350 && keys.every(k => !before.en.has(k)), `English V17 source: ${keys.length} new keys`);
const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(",");
// identical to English is allowed only for symbols, units, names and words spelled the same
const SAME = /^(v17\.unit\.|v17\.col\.var$|v17\.reg\.source$|v17\.lim\.(biology|cond|regolith)$|v17\.cls\.(plateau|arid|humid)$|v17\.dom\.catalogue$|v17\.body\.mars$|v17\.pat\.w\.(polar|warm|arid|humid)$|v17\.layer\.btn$|v17\.mod\.validation$|v17\.kind\.qualitative$|v17\.pat\.name$|v17\.dom\.multispectral$|v17\.mstatus\.(available|partial)$)/;
for (const l of ["bn", "es", "fr", "de"]) {
  const d = cat[l], k2 = Object.keys(d);
  const miss = keys.filter(k => !(k in d)), extra = k2.filter(k => !(k in EN));
  check(!miss.length && !extra.length, `${l}: same key set as English (missing ${miss.slice(0, 4)}, extra ${extra.slice(0, 4)})`);
  const bad = keys.filter(k => k in d && ph(d[k]) !== ph(EN[k]));
  check(!bad.length, `${l}: every string has the English placeholders (${bad.slice(0, 4)})`);
  const same = keys.filter(k => d[k] === EN[k] && /[a-z]{3}/.test(EN[k]) && !SAME.test(k));
  check(!same.length, `${l}: no string left in English (${same.slice(0, 6)})`);
  check(["v17.layer.src.freeze_months", "v17.layer.src.precip_cv"].every(k => d[k].includes("NASA POWER")) && d["v17.layer.src.lst_dr_iav_k"].includes("MODIS") && d["v17.layer.src.landform_class"].includes("GMTED2010") && d["v17.pat.agree"].includes("Köppen–Geiger"), `${l}: dataset and classification names kept`);
  for (const k of ["v17.nov.not_importance", "v17.sp.unavailable", "v17.jr.rule", "v17.reg.never", "v17.pat.limits", "v17.sp.wrong_meaning"]) if (!(d[k] && d[k].length > 20)) check(false, `${l}: honesty statement ${k}`);
}
check(true, "honesty statements present in every language (novelty is not importance, no invented result, points never change a result, no unverified integration, patterns are not identifications)");
const latin = Object.values(cat.bn).filter(v => /[a-z]{4}/.test(v.replace(/ASTERRO|NASA POWER|NASA GIBS|GIBS|MODIS Aqua|MODIS|MERRA-2|GMTED2010|Köppen–Geiger|Bagnouls–Gaussen|P\/PET|UNEP|V17|\{\w+\}/g, "")));
check(/\p{Script=Bengali}/u.test(Object.values(cat.bn).join("")) && !latin.length, `Bengali: no untranslated Latin words (${latin.slice(0, 3)})`);
const frBad = Object.entries(cat.fr).filter(([, v]) => / [?!:;»]|\d %|« |\} %/.test(v));
check(!frBad.length, `French: no ordinary space before ? ! : ; % » (${frBad.slice(0, 3).map(x => x[0])})`);

// every key the V17 code uses exists
const ALL = { ...I18N.dict.en };
const code = ["ui_29_v17.js", "ui_30_surprise.js"].map(f => fs.readFileSync(P + f, "utf8")).join("\n");
const lit = [...new Set([...code.matchAll(/tx(?:Has)?\("([a-z_0-9]+(?:\.[A-Za-z_0-9]+)+)"\s*(?=[,)])/g)].map(m => m[1]))];
const absent = lit.filter(k => !(k in ALL));
check(lit.length > 120 && !absent.length, `all ${lit.length} literal keys used by the V17 code exist (${absent.slice(0, 5)})`);
const dctx = vm.createContext({});
vm.runInContext(fs.readFileSync(P + "data_v17.js", "utf8") + "\nthis.D = ASTERRO_V17;", dctx);
const D = dctx.D, fam = [];
for (const m of D.modules.modules) { fam.push("v17.mod." + m.id, "v17.modq." + m.id, "v17.mstatus." + m.status); for (const i of m.inputs) fam.push("v17.var." + i.var, "v17.unit." + i.var, "v17.kind." + i.kind); }
for (const s of D.registry.states) fam.push("v17.state." + s.id);
for (const s of D.registry.sources) { fam.push("v17.dom." + (s.domain || "other"), "v17.body." + s.body.replace("+", "_")); }
for (const c of D.patterns.novelty.classes) fam.push("v17.nov.cls." + c, "v17.nov.def." + c, "v17.cls." + c);
for (const nm of D.patterns.ml.names) for (const w of nm) fam.push("v17.pat.w." + w);
for (const [v, cl] of Object.entries(D.cube.classes)) for (const c of cl) fam.push("v17.cls." + c);
for (const it of D.limits.items) { fam.push("v17.lim." + it.id, "v17.lim.site_" + it.earth_site); for (const b of ["earth", "moon", "mars"]) if (it[b].value == null) fam.push(`v17.lim.q.${it.id}.${b}`); }
for (const m of ["mars_unexpected", "moon_unexpected", "thermal_unusual", "polar", "hidden", "underrepresented", "one_dimension", "geology", "water_history", "dust_wind", "subsurface"]) fam.push("v17.sp.mode." + m, "v17.sp.mode_p." + m);
for (const c of ["terrain_not_thermal", "arid_rough", "seasonal_rain", "polar_compare", "single_dimension", "beyond_famous", "shared_process"]) fam.push("v17.ch." + c, `v17.ch.${c}.how`, "v17.ch.r." + c);
for (const v of ["freeze_months", "ft_air_months", "dry_months", "precip_cv", "polar_night_months", "toa_annual_wm2", "lst_dr_iav_k", "aridity_class", "landform_class", "uniqueness", "anomaly"]) fam.push("v17.var." + v, "v17.unit." + v, "v17.layer.src." + v, "v17.layer.lim." + v);
for (const k of ["mismatch", "meaning", "uncertainty", "reproducibility", "questions"]) fam.push("v17.pts." + k, "v17.badge." + k);
for (let k = 0; k < 5; k++) fam.push("v17.lv." + k);
for (const h of ["surprise", "domains", "novelty", "patterns"]) fam.push("ext.hub." + h);
for (const k of ["env", "process", "ops", "complete", "evidence"]) fam.push("v17.sep." + k);
for (const k of ["baseline", "km", "mmr", "region"]) fam.push("v17.div." + k, `v17.div.${k}_p`);
for (const k of ["beginner", "scientific", "advanced"]) fam.push("v17.sp.lvl." + k);
for (const k of ["prob", "sim", "safe"]) fam.push("v17.sp.q2." + k);
const famMiss = [...new Set(fam)].filter(k => !(k in EN) && !(k in ALL));
check(!famMiss.length, `all ${new Set(fam).size} keys of the dynamic families exist (${famMiss.slice(0, 6)})`);

console.log(`\n${n - fails}/${n} V17 i18n checks passed`);
process.exit(fails ? 1 : 0);
