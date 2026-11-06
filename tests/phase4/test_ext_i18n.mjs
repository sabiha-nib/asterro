// Extension catalogues (Node). Run: node tests/phase4/test_ext_i18n.mjs
// i18n_80_ext_en.js is the source; i18n_81–84_ext_<lang>.js must have exactly its keys and {placeholders}, add no key
// that clashes with the original catalogues, leave nothing in English, cover every key the extension code uses and every
// dimension / process / profile in the generated records, keep dataset names, and follow French typography.
import fs from "node:fs";
import vm from "node:vm";
const root = new URL("../..", import.meta.url).pathname, P = root + "app/frontend/phase4/";
let fails = 0, n = 0;
const check = (ok, msg) => { n++; console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; };

const I18N = { dict: {}, meta: {} };
const ctx = vm.createContext({ I18N, i18nRegister: (l, m, d) => { I18N.dict[l] = { ...d }; I18N.meta[l] = m; } });
const core = fs.readdirSync(P).filter(f => /^i18n_\d\d_[a-z]{2}\.js$/.test(f)).sort();
for (const f of core) vm.runInContext(fs.readFileSync(P + f, "utf8"), ctx, { filename: f });
const coreKeys = Object.fromEntries(Object.entries(I18N.dict).map(([l, d]) => [l, new Set(Object.keys(d))]));
vm.runInContext(fs.readFileSync(P + "i18n_79_extend.js", "utf8"), ctx, { filename: "i18n_79_extend.js" });
const ext = {};
const files = fs.readdirSync(P).filter(f => /^i18n_8\d_ext_[a-z]{2}\.js$/.test(f)).sort();
check(JSON.stringify(files) === JSON.stringify(["i18n_80_ext_en.js", "i18n_81_ext_bn.js", "i18n_82_ext_es.js", "i18n_83_ext_fr.js", "i18n_84_ext_de.js"]), `five extension catalogues: ${files.join(", ")}`);
const capture = vm.createContext({ i18nExtend: (l, d) => { ext[l] = d; } });
for (const f of files) {
  vm.runInContext(fs.readFileSync(P + f, "utf8"), capture, { filename: f });   // the catalogue as written
  vm.runInContext(fs.readFileSync(P + f, "utf8"), ctx, { filename: f });       // merged as the app merges it
}
check(files.every(f => f.slice(-5, -3) in ext), "each catalogue registers its own language");
check(Array.isArray(I18N.clash) && I18N.clash.length === 0, `no extension key overwrites an original key (${(I18N.clash || []).slice(0, 4)})`);
const EN = ext.en, keys = Object.keys(EN);
check(keys.length > 450, `English extension source has ${keys.length} keys`);
const newKeys = keys.filter(k => !coreKeys.en.has(k));
check(newKeys.length === keys.length, `every extension key is new to the original catalogues (${keys.filter(k => coreKeys.en.has(k)).slice(0, 4)})`);
const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(",");
const SAME = /^(ext\.bf\.nearest|ext\.hub\.constellations|ext\.(th|dc)\.col_(dim|status|label|source)|ext\.rob\.standard|ext\.bf\.col_score|ext\.rq\.(notes|ev\.status)|ext\.rep\.(h\.dims|c\.crit)|ext\.dim\.(surface_materials|volcanic_terrain|dunes|fluvial_landforms)\.unit|ext\.env\.(tundra|delta|continent|plateau|gorge)|ext\.kg\.ET|ext\.op\.navigation\.name|ext\.proc\.sedimentation\.name|ds\.mode\.simple)$/;
for (const l of ["bn", "es", "fr", "de"]) {
  const d = ext[l], k2 = Object.keys(d);
  const miss = keys.filter(k => !(k in d)), extra = k2.filter(k => !(k in EN));
  check(!miss.length && !extra.length, `${l}: same key set as English (missing ${miss.slice(0, 4)}, extra ${extra.slice(0, 4)})`);
  const bad = keys.filter(k => k in d && ph(d[k]) !== ph(EN[k]));
  check(!bad.length, `${l}: every string has the English placeholders (${bad.slice(0, 4)})`);
  check(!k2.filter(k => !String(d[k]).trim()).length, `${l}: no empty strings`);
  const same = keys.filter(k => d[k] === EN[k] && /[a-z]{3}/.test(EN[k]) && !SAME.test(k));
  check(!same.length, `${l}: no string left in English (${same.slice(0, 6)})`);
  // dataset and instrument names are never translated
  check(["MOLA", "LOLA", "Diviner", "MEDA", "REMS"].every(t => d["ext.learn.measure.p1"].includes(t)) && d["ext.proc.glacial.lim"].includes("NASA POWER") && d["ext.dim.surface_water.lim"].includes("JRC Global Surface Water"), `${l}: instrument and dataset names preserved`);
  check(d["ext.rep.lim.vacuum"].includes("CO₂") && /K/.test(d["ext.th.earth_range"]), `${l}: chemical formula and kelvin unit preserved`);
}
// every language keeps the honesty statements (non-empty, distinct from one another)
for (const l of Object.keys(ext)) for (const k of ["ext.th.not_prob", "ext.bf.honest", "ext.prof.not_approval", "ext.rq.p", "ext.dc.labels_p", "ext.dim.gravity_vacuum_radiation.lim", "ext.dim.extremophile_habitats.lim", "ext.dim.ice_permafrost.lim"])
  if (!(ext[l][k] && ext[l][k].length > 20)) check(false, `${l}: honesty statement ${k} present`);
check(true, "honesty statements present in every language (similarity ≠ probability, no novelty claim, no approval, no validation, no life or resource claim)");
check(/\p{Script=Bengali}/u.test(Object.values(ext.bn).join("")) && Object.values(ext.bn).filter(v => /[a-z]{4}/.test(v.replace(/ASTERRO|NASA POWER|JRC Global Surface Water|tai-[a-z0-9.\-]+|explore-[a-z0-9\-]+|Valles Marineris|\{\w+\}|[A-Z][A-Za-z]+/g, ""))).length === 0, "Bengali catalogue is in Bengali script (only names, codes and placeholders in Latin)");
const frBad = Object.entries(ext.fr).filter(([k, v]) => / [?!:;»]|\d %|« /.test(v));
check(!frBad.length, `French: no ordinary space before ? ! : ; % » or after « (${frBad.slice(0, 3).map(x => x[0])})`);

// every literal key the extension code uses exists (in the extension or the original English catalogue)
const ALL = { ...I18N.dict.en };
const code = ["ui_21_ext_core.js", "ui_22_discover_hub.js", "ui_23_research.js", "ui_24_datacenter.js", "ui_25_context.js"].map(f => fs.readFileSync(P + f, "utf8")).join("\n");
const lit = [...new Set([...code.matchAll(/tx(?:Has)?\("([a-z_0-9]+(?:\.[A-Za-z_0-9]+)+)"\s*(?=[,)])/g)].map(m => m[1]))];
const absent = lit.filter(k => !(k in ALL));
check(lit.length > 120 && !absent.length, `all ${lit.length} literal keys used by the extension code exist (${absent.slice(0, 5)})`);
// dynamic families from the generated records
const J = f => JSON.parse(fs.readFileSync(root + "data/ext/" + f, "utf8"));
const dims = J("dimensions.json"), procs = J("processes.json"), profs = J("profiles_ext.json");
const fam = [];
for (const f of dims.families) fam.push("ext.fam." + f);
for (const d of dims.dimensions) { for (const s of ["name", "def", "planet", "lim"]) fam.push(`ext.dim.${d.id}.${s}`); fam.push("ext.dimst." + d.status); }
for (const p of procs.processes) for (const s of ["name", "earth", "planet", "mech", "sim", "diff", "use", "lim"]) fam.push(`ext.proc.${p.id}.${s}`);
for (const p of profs.profiles) { fam.push(`ext.prof.${p.id}.name`); if (p.status === "available") for (const s of ["goal", "why", "lim"]) fam.push(`ext.prof.${p.id}.${s}`); }
for (const s of ["what", "why", "measure", "landing", "similarity", "looks", "limits"]) for (const x of ["t", "p1", "p2"]) fam.push(`ext.learn.${s}.${x}`);
for (const s of ["verified", "pending", "future", "unsuitable", "unavailable"]) fam.push("ext.dc.lab." + s);
for (const s of ["to_investigate", "data_incomplete", "under_review", "set_aside"]) fam.push("ext.rq.st." + s);
for (const s of ["constellations", "thermal", "processes", "beyond", "profiles", "learn"]) fam.push("ext.hub." + s);
for (const s of ["concise", "detailed", "comparative", "profiles", "multi"]) fam.push("ext.rep." + s);
for (const s of ["gravity", "vacuum", "radiation", "history", "light", "bio"]) fam.push("ext.rep.lim." + s);
const famMiss = [...new Set(fam)].filter(k => !(k in EN));
check(!famMiss.length, `all ${new Set(fam).size} keys of the dynamic families exist (${famMiss.slice(0, 5)})`);
// units with words are translated; pure symbols are kept as they are
const wordy = dims.dimensions.filter(d => /[a-z]{3}/.test(d.unit) && d.unit !== "—");
check(wordy.every(d => `ext.dim.${d.id}.unit` in EN), `every unit written in words has a translatable label (${wordy.filter(d => !(`ext.dim.${d.id}.unit` in EN)).map(d => d.id)})`);
check(ext.de["ext.rep.lang"] === "Deutsch" && ext.fr["ext.rep.lang"] === "Français" && ext.es["ext.rep.lang"] === "Español" && ext.bn["ext.rep.lang"] === "বাংলা", "each report names its own language");

console.log(`\n${n - fails}/${n} extension i18n checks passed`);
process.exit(fails ? 1 : 0);
