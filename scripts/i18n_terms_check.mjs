// Terminology consistency of the research-route catalogues against docs/i18n/glossary.json (developer tool and test).
//   node scripts/i18n_terms_check.mjs [--json]
// For each glossary term with a short English form, every route entry whose English key contains that word is checked
// for the glossary's translation (any of its "/"-separated forms, case-insensitive, by stem). Reports, per language,
// the share of entries that use the glossary term, and the terms below 80 %. This measures consistency; it does not
// judge quality (that needs a native-speaker review, which has not happened).
import fs from "node:fs";
const G = JSON.parse(fs.readFileSync("docs/i18n/glossary.json", "utf8")).terms;
const FILES = { bn: "i18n_71_routes_bn.js", es: "i18n_72_routes_es.js", fr: "i18n_73_routes_fr.js", de: "i18n_74_routes_de.js" };
const load = f => { const D = {}; new Function("i18nRoutes", fs.readFileSync("app/frontend/phase4/" + f, "utf8"))((l, d) => Object.assign(D, d)); return D; };
// English search word → glossary entry (only single, unambiguous words; phrases are checked by their head word)
const PROBES = { "similarity": "similarity", "weight": "weight / weights", "weights": "weight / weights", "coverage": "coverage", "criterion": "criterion / criteria",
  "criteria": "criterion / criteria", "fingerprint": "fingerprint (environmental)", "provenance": "provenance", "dataset": "dataset", "datasets": "dataset",
  "uncertainty": "uncertainty", "robustness": "robustness / robust", "sensitivity": "sensitivity", "registry": "registry", "licence": "licence", "limitation": "limitation",
  "limitations": "limitation", "reproducible": "reproduce / reproducible / reproduced", "deterministic": "deterministic", "scenario": "scenario / scenario set",
  "scenarios": "scenario / scenario set", "constellation": "constellation (cluster of analogue cells)", "constellations": "constellation (cluster of analogue cells)",
  "validation": "validation / holdout", "collection": "collection (saved items)", "workflow": "workflow", "counterfactual": "counterfactual", "expedition": "expedition",
  "aridity": "aridity / seasons (annual temperature range) / elevation / slope / roughness / day–night (diurnal range)" };
const stem = s => s.toLowerCase().normalize("NFC");
const forms = (e, l) => String(e[l] || "").replace(/^keep.*$/, "").split(/\s*\/\s*|\s*\(|\)/).map(x => x.trim()).filter(x => x.length >= 3)
  .map(x => stem(x).split(/\s+/)[0].slice(0, Math.max(4, Math.min(7, x.length - 2))));
const out = {};
for (const [l, f] of Object.entries(FILES)) {
  const T = load(f), res = {};
  for (const [w, gid] of Object.entries(PROBES)) {
    const e = G.find(g => g.en === gid); if (!e) continue;
    let fs_ = forms(e, l); if (w === "aridity") fs_ = [stem(String(e[l]).split("/")[0].trim()).slice(0, 6)];
    if (!fs_.length) continue;
    const rx = new RegExp(`\\b${w}\\b`, "i");
    // the word as a word, not as part of an identifier ("registry 1.0.0", "excluded: aridity, annual_temperature_range")
    const plain = k => k.replace(/\b(registry|dataset) \d[\w.\-]*/gi, " ").replace(/[^.;:()]*\b\w+_\w+\b[^.;()]*/g, " ");
    const hits = Object.entries(T).filter(([k]) => rx.test(plain(k)));
    if (hits.length < 3) continue;
    const ok = hits.filter(([, v]) => fs_.some(x => stem(v).includes(x))).length;
    res[w] = { n: hits.length, ok, share: +(ok / hits.length).toFixed(3) };
  }
  const n = Object.values(res).reduce((a, r) => a + r.n, 0), ok = Object.values(res).reduce((a, r) => a + r.ok, 0);
  out[l] = { entriesChecked: n, consistent: ok, share: +(ok / n).toFixed(3), below80: Object.entries(res).filter(([, r]) => r.share < 0.8).map(([w, r]) => `${w} ${Math.round(100 * r.share)}% of ${r.n}`), terms: res };
}
if (process.argv.includes("--json")) console.log(JSON.stringify(out, null, 1));
else for (const [l, r] of Object.entries(out)) console.log(l, `${r.consistent}/${r.entriesChecked} (${Math.round(100 * r.share)} %) use the glossary term;`, r.below80.length ? "below 80 %: " + r.below80.join(", ") : "no term below 80 %");
