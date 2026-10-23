// Build the English route catalogue from a harvest (developer tool).
//   node scripts/i18n_catalogue.mjs [build/i18n/harvest.json] [build/i18n/catalogue_en.json]
// Keys are recomputed here from each harvested segment's text with the runtime translator's own functions
// (i18n_60_seg.js) and the application's name dictionary (build/i18n/names.json, dumped from the running app), so
// the catalogue always matches the runtime's keys. Identifier-only keys, constellation names (composed at runtime)
// and site labels with a cut name are left out, exactly as the runtime handles them without a catalogue entry.
import fs from "node:fs";
import { loadSeg } from "./i18n_seg_node.mjs";
const G = loadSeg();
const inp = process.argv[2] || "build/i18n/harvest.json", out = process.argv[3] || "build/i18n/catalogue_en.json";
{ const N = new Map(JSON.parse(fs.readFileSync("build/i18n/names.json", "utf8"))); N._fixed = true; G.i18gSetNames(N); }
const DESC = /^(?:(\d\d) )?(Cold|Temperate|Hot) (?:(hyper-arid|arid|semi-arid|dry sub-humid|humid) )?(high-altitude )?(plains|rolling terrain|rugged terrain)$/;
const H = JSON.parse(fs.readFileSync(inp, "utf8"));
const cat = {}; let skipped = 0;
for (const v of Object.values(H)) {
  const { key } = G.i18gKeyText(v.text);
  if (!/\p{L}/u.test(key.replace(G.I18G_SKEL, ""))) { skipped++; continue; }
  const nk = G.i18gNameKey(key), ck = nk ? nk.key : key;
  if (G.i18gAuto(key) || G.i18gAuto(ck) || DESC.test(v.text) || G.i18gSiteLabel(ck)) { skipped++; continue; }
  const e = cat[ck] || (cat[ck] = { text: v.text, routes: new Set(), quote: false, attr: v.attr || null });
  for (const r of v.routes) e.routes.add(r);
  e.quote = e.quote || !!v.quote;
}
if (!cat.pick) cat.pick = { text: "pick", routes: new Set(["lab/robust"]), quote: false, attr: null };   // the label of a selected place outside the leading sites
const keys = Object.keys(cat).sort();
let words = 0; for (const k of keys) words += k.split(/\s+/).length;
const byRoute = {}; for (const k of keys) for (const r of cat[k].routes) { const t = r.split("/")[0]; byRoute[t] = (byRoute[t] || 0) + 1; }
console.log(JSON.stringify({ keys: keys.length, skipped, words, byRoute }));
fs.writeFileSync(out, JSON.stringify(keys.map(k => ({ key: k, text: cat[k].text, routes: [...cat[k].routes].sort(), quote: cat[k].quote || undefined, attr: cat[k].attr || undefined })), null, 1));
