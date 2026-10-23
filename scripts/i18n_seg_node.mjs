// Load the segment translator's pure functions (key building, identifier detection) into Node, for the tests and
// the catalogue tools. The browser-only parts are never called here.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export function loadSeg() {
  const src = fs.readFileSync(path.join(ROOT, "app/frontend/phase4/i18n_60_seg.js"), "utf8");
  const stub = `const txLocale = () => "en", tx = k => k, txHas = () => false, esc = s => s, txNum = (x, d) => x.toFixed(d), txInt = x => String(x), txList = a => a.join(", "); const I18N = { lang: "en", langs: {}, dict: { en: {} } };`;
  const f = new Function(stub + src + "\nreturn { i18gResidue, i18gAuto, i18gKey, i18gKeyText, i18gNameKey, i18gSetNames, i18gSiteLabel, I18G, I18G_SKEL, I18G_NUM, I18G_CODES };");
  return f();
}
