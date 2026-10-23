/* ===== Interface languages for the research routes — segment translator =====
 * The research routes (Compare, Scenarios, Discover, Data, Method, Lab, Trajectory, Atlas) and the Trace / Report /
 * Reproduce sheets are rendered in English by their own modules, several of which are protected files. After they
 * render, this layer translates their text in place, one *segment* at a time:
 *
 *   a segment = a run of text and inline elements between two block-level boundaries.
 *   Its key is the English text with every inline element written {0}, {1}…, every number {n0}, {n1}… and, when the
 *   exact key is not catalogued, every known proper name {p0}, {p1}… (place, target, location, dataset, mission).
 *
 * The catalogues (i18n_7x_routes_*.js) map that English key to a translation that carries the same placeholders.
 * Inline elements are moved, never re-created, so their listeners, ids and focus survive; numbers are re-formatted
 * for the locale (Bengali digits, decimal commas); country names are localised through the browser's CLDR data
 * (Intl.DisplayNames) from an ISO 3166 code, and only when the code's CLDR English name is the Natural Earth name or
 * a recorded alias — other place names stay as Natural Earth writes them.
 * Text quoted from source records (target method notes, dataset limitations, licences, citations) is translated
 * with the English original kept beside it, labelled, in a disclosure.
 * Nothing here reads or changes a score: it only rewrites text after the modules have drawn it. Exports, records and
 * reproductions are produced from the data, not from the page, and stay English and byte-identical. */
const I18G = { cat: {}, names: null, nameRx: null, quotes: null, miss: new Map(), runs: new WeakMap(), done: new WeakSet(), busy: false, n: 0 };
function i18nRoutes(lang, dict) { I18G.cat[lang] = Object.assign(I18G.cat[lang] || {}, dict); }
/* plural-aware lookup for keyed strings: key.one / key.other / key.few / key.many / key.two / key.zero */
function txP(key, n, vars = {}) {
  let cat = "other"; try { cat = new Intl.PluralRules(txLocale()).select(n); } catch (e) { }
  const k = txHas(key + "." + cat) || (I18N.dict[I18N.lang] || {})[key + "." + cat] != null ? key + "." + cat : key + ".other";
  return tx(k, Object.assign({ n: txInt(n) }, vars));
}

const I18G_BLOCK = new Set(["DIV", "P", "LI", "UL", "OL", "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH", "H1", "H2", "H3", "H4", "H5", "H6",
  "SECTION", "ARTICLE", "NAV", "HEADER", "FOOTER", "ASIDE", "MAIN", "DL", "DT", "DD", "FIGURE", "FIGCAPTION", "CAPTION", "BLOCKQUOTE", "FORM",
  "FIELDSET", "LEGEND", "DETAILS", "SUMMARY", "OPTION", "OPTGROUP", "svg", "g", "text", "foreignObject", "HR"]);
const I18G_SKIP = new Set(["SCRIPT", "STYLE", "PRE", "CODE", "TEXTAREA", "KBD", "SAMP", "CANVAS", "IMG", "INPUT", "title", "desc", "path", "rect", "circle", "line", "polyline", "polygon", "ellipse"]);
const I18G_ATTRS = ["title", "aria-label", "placeholder", "alt", "aria-valuetext", "aria-description", "label"];
/* a number token: not part of a word, a version, an id or a date */
const I18G_NUM = /(?<![\p{L}\p{N}_.{\-:@]|[\p{L}\p{N}]-)(?:(\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?)?)|([−+\-]?)((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:e[+−\-]?\d+)?))(?![\p{L}\p{N}_}]|\.\d|[\-:]\d|,\d{3})/gu;
/* a run of three or more sign tokens (a pattern such as "+ − ≈ ≈ −−") is a value, not words */
const I18G_SYM = /(?<!\S)[+−≈=]+(?:\s+[+−≈=]+){2,}(?!\S)/gu;
const I18G_SKEL = /\{(n|p)?(\d+)\}/g;

function i18gKeepEl(e) {
  return e.nodeType === 1 && (I18G_SKIP.has(e.tagName) || e.classList.contains("i18n-keep") || e.classList.contains("i18g-q")
    || e.getAttribute("translate") === "no" || e.hasAttribute("data-i18n-lang") || e.hasAttribute("data-i18n-done") || e.id === "jn" || e.id === "rv");
}
/* proper names known to the application: Natural Earth countries and regions, targets, locations, datasets, missions */
function i18gNames() {
  if (I18G.names && I18G.names._fixed) return I18G.names;
  const user = i18gUserStrings(), sig = user.join("\u0001");
  if (I18G.names && I18G.names._reg === !!(typeof A4 !== "undefined" && A4.reg) && I18G.names._at === !!(typeof A3 !== "undefined" && A3.atlas) && I18G.names._user === sig) return I18G.names;
  const N = new Map(), add = (s, key = null) => { if (typeof s === "string" && s.length >= 3 && /\p{L}/u.test(s) && (key || !I18G_NOTNAME.has(s)) && !(N.get(s))) N.set(s, key); };
  for (const c of S.crit || []) add(c.label, "ui.lab." + c.id);                  // interface terms with their own keys
  for (const [pid, p] of Object.entries((S.app || {}).profiles || {})) add(p.label, "profile." + pid);
  if (S.labels) {
    for (const c of S.labels.country || []) add(c);
    for (const r of S.labels.region || []) add(r.toLowerCase().replace(/(^|[\s\-(])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bRa\.?$/, "Range"));
  }
  for (const [id, t] of Object.entries(S.T || {})) { add(t.name, typeof txHas === "function" && txHas("tname." + id) ? "tname." + id : null); add(t.short); }
  if (typeof TNAME !== "undefined") for (const [id, n] of Object.entries(TNAME)) if (id !== "cross" && typeof txHas === "function" && txHas("tname." + id)) add(n, "tname." + id);
  if (typeof A4 !== "undefined" && A4.reg) {
    const R = A4.reg;
    for (const x of R.locations || []) { add(x.name); for (const a of x.aliases || []) add(a); }
    for (const x of R.targets || []) add(x.name);
    for (const x of R.regions || []) add(x.name);
    for (const x of R.missions || []) add(x.name);
    for (const x of R.datasets || []) { add(x.product_id); add(x.provider); }
  }
  if (typeof A3 !== "undefined" && A3.atlas) for (const t of A3.atlas.targets || []) add(t.name);
  for (const u of user) if (!N.has(u)) N.set(u, null);                         // what the user typed is shown as typed
  N._reg = !!(typeof A4 !== "undefined" && A4.reg); N._at = !!(typeof A3 !== "undefined" && A3.atlas); N._user = sig;
  return i18gSetNames(N);
}
/* text the user wrote (collection names, validation case names and citations) is never translated: it is treated as a
 * name, so the sentence around it is translated and the user's words stay exactly as typed */
function i18gUserStrings() {
  const out = [];
  try { if (typeof a4Cols === "function") for (const c of a4Cols()) if (c && c.name) out.push(String(c.name)); } catch (e) { }
  try { if (typeof A4 !== "undefined" && A4.colConflicts) for (const c of A4.colConflicts) for (const x of [c.existing, c.incoming, c]) if (x && x.name) out.push(String(x.name)); } catch (e) { }
  try { if (typeof a4ValCases === "function" && typeof A4 !== "undefined" && A4.val) for (const c of a4ValCases(A4.val.target) || []) { if (c.name) out.push(String(c.name)); if (c.citation) out.push(String(c.citation)); } } catch (e) { }
  return [...new Set(out.filter(x => x.trim().length >= 3))].sort();
}
/* install a name dictionary (Map name → interface key or null); also used by the Node tools with a dumped list */
function i18gSetNames(N) {
  const list = [...N.keys()].sort((a, b) => b.length - a.length).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  I18G.nameRx = list.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${list.join("|")})(?![\\p{L}\\p{N}])`, "gu") : null;
  I18G.names = N; return N;
}
/* English words that are also names in the data (kept as words, never treated as a name) */
const I18G_NOTNAME = new Set(["Mars", "Moon", "Earth", "Both", "Custom", "General", "Science", "Rover", "Habitat", "Planetary"]);

/* the key of a run of nodes */
function i18gKey(nodes) {
  const els = []; let s = "";
  for (const n of nodes) {
    if (n.nodeType === 3) s += n.nodeValue.replace(/[{}]/g, "");
    else { s += `{${els.length}}`; els.push(n); }
  }
  const lead = /^\s*/.exec(s)[0], trail = /\s*$/.exec(s)[0];
  const body = s.replace(/\s+/g, " ").trim();
  const { key, nums } = i18gKeyText(body);
  return { key, els, nums, lead: lead ? " " : "", trail: trail ? " " : "", text: body };
}
/* body text (inline elements already written {0}, {1}…) → key with numbers and sign runs abstracted */
function i18gKeyText(body) {
  const nums = [];
  const key = body.replace(I18G_SYM, m => { nums.push({ raw: m }); return `{n${nums.length - 1}}`; })
    .replace(I18G_NUM, (m, date, sg, v) => { if (date) { nums.push({ raw: date }); return `{n${nums.length - 1}}`; } nums.push({ sg, v }); return `${sg}{n${nums.length - 1}}`; });
  return { key, nums };
}
function i18gNameKey(key) {
  i18gNames(); if (!I18G.nameRx) return null;
  const names = []; I18G.nameRx.lastIndex = 0;
  const k = key.replace(I18G.nameRx, m => { names.push(m); return `{p${names.length - 1}}`; });
  return names.length ? { key: k, names } : null;
}
function i18gFmtNum(x0) {
  if (x0.raw != null) return x0.raw;                                // ISO dates and times are record values
  const v = x0.v; if (/e/i.test(v)) return v;                       // scientific notation stays as computed
  const dec = (v.split(".")[1] || "").length, x = parseFloat(v.replace(/,/g, ""));
  return txNum(x, dec, { useGrouping: v.includes(",") });
}
/* a name placeholder's display: an interface term in the active language, a country through CLDR, else as written */
function i18gNameShow(name) {
  const key = I18G.names && I18G.names.get(name);
  if (key) return I18N.lang === "en" ? name : tx(key);
  return i18gPlace(name);
}
/* country names through CLDR (browser data), from an ISO 3166 code recorded for the Natural Earth name */
const _i18gDN = new Map();
function i18gPlace(name) {
  if (I18N.lang === "en" || typeof I18G_ISO === "undefined") return name;
  const code = I18G_ISO[name]; if (!code) return name;
  try {
    const loc = txLocale(); if (!_i18gDN.has(loc)) _i18gDN.set(loc, new Intl.DisplayNames([loc], { type: "region", fallback: "none" }));
    return _i18gDN.get(loc).of(code) || name;
  } catch (e) { return name; }
}
/* identifiers stay as they are in every language: URLs, file names, ids, hashes, versions, codes and acronyms of
 * datasets, instruments, agencies and criteria, units, formula symbols. A key whose only words are such identifiers
 * needs no catalogue entry. */
const I18G_CODES = new Set(("API ASTERRO CO2 DAAC DEM DEMs DOI EGM96 EOSDIS EPSG EROS ETag EVA FAO-56 FAO56 GCP GIBS GMT GMTED GMTED2010 GTS " +
  "Hargreaves-FAO56 IAU InSight IQR JGR JSON CSV PNG SVG PDF HTML LDEM LOLA LP LRO LST LTST MAD MB kB MEDA MERRA-2 MGS MODIS MODRDR MOLA MSL " +
  "MYD11C3 NASA NGA NSSDCA NaN PDS PDS4 PET POWER PRECTOTCORR RDR REMS RGB RMD RSM SD SHA-256 T2M TAB TAIEngine TES THEMIS TIRS UCL UCLA " +
  "UNEP URL USGS VOI WGPSN HiRISE CTX CRISM Diviner Mini-RF LROC NAC WAC LOLA ERA5 WorldClim CHELSA SRTM ASTER GDEM MSL REMS IMG PDS3 " +
  "ARID ELEV ROUGH SLOPE THERM T-RANGE DIRECT PROXY MISSING N/A L1 L2 L3 L4 II III IV ID IDs Ls UTC ISO OK SI").split(" "));
const I18G_UNIT = /(?<![\p{L}])(km²?|km\/h|m²?|mm|cm|µm|K|°C|°|ms|px|pts?|kB|MB|GB|s|h|d|sols?|W\/m²|W|mbar|Pa|hPa|yr|kg)(?![\p{L}])/gu;
function i18gResidue(key) {
  if (/^\s*[\[{]?\s*"[^"]*"\s*:/.test(key)) return " ";                    // a JSON fragment
  let s = key.replace(I18G_SKEL, " ").replace(/[\p{L}\p{N}\-]+…/gu, w => /^(Loading|Computing|Running|Searching|Checking|Building|Preparing|Comparing|Saving|Importing|Exporting|Verifying|Replaying|Rendering|Scoring)…$/.test(w) ? w : " ")
    .replace(/https?:\/\/\S+/g, " ").replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, " ")
    .replace(/"[^"]*"\s*:/g, " ").replace(/^\s*[\[{"].*":.*$/s, " ")
    .replace(/[\p{L}\p{N}_.\-]*(?:_|:(?=\S)|\/(?=\S)|\\)[\p{L}\p{N}_:\/\\.\-]*/gu, " ")
    .replace(/(?<![\p{L}\p{N}])[a-z][a-z0-9]*(?:\.[a-z0-9_]+)+(?![\p{L}\p{N}])/gu, " ")
    .replace(/(?<![\p{L}\p{N}])[LMH]{3,}(?![\p{L}\p{N}])/gu, " ")
    .replace(/(?<![\p{L}\p{N}])\p{L}+-(?=[a-f]*\d)[0-9a-f]{8,}(?![\p{L}\p{N}])/gu, " ")
    .replace(/(?<![\p{L}\p{N}])(?=[a-f]*\d)[0-9a-f]{6,}…?/gi, " ")
    .replace(/[+−\-]?\d+(?:\.\d+)?e[+−\-]?\d+/gi, " ")
    .replace(/(?<![\p{L}\p{N}])(?=[\p{L}\-.]*\p{N})[\p{L}\p{N}\-.]*\p{L}[\p{L}\p{N}\-.]*(?![\p{L}\p{N}])/gu, " ")
    .replace(/[Ͱ-Ͽ]/g, " ")
    .replace(/°[NSEW](?![\p{L}])/gu, " ");
  s = s.replace(/[\p{L}][\p{L}\p{N}\-\/]*/gu, w => I18G_CODES.has(w) || (typeof S !== "undefined" && S.crit && S.crit.some(c => c.short === w)) ? " " : w);
  s = s.replace(I18G_UNIT, " ").replace(/(?<![\p{L}])[b-zB-HJ-Z](?![\p{L}])/gu, " ");
  return s;
}
function i18gAuto(key) { return !/\p{L}/u.test(i18gResidue(key)); }
function i18gSiteLabel(key) {
  const m = /^(pick|#\{n\d+\}|\{p\d+\},) (.+)$/.exec(key); if (!m) return null;
  const words = m[2].replace(/\{p\d+\}/g, "").split(/[\s,]+/).filter(Boolean);
  return words.every(w => /^[\p{Lu}(]/u.test(w) || /^(de|del|la|las|los|el|of|and|the|du|des|di|da|do|al|von|van|y|e)$/.test(w)) ? m : null;
}
function i18gLookup(k) {
  const c = I18G.cat[I18N.lang]; if (!c) return null;
  if (c[k.key] != null) return { t: c[k.key], names: [] };
  const nk = i18gNameKey(k.key);
  if (nk && c[nk.key] != null) return { t: c[nk.key], names: nk.names };
  if (i18gAuto(k.key)) return { t: k.key, names: [], auto: true };
  { const m = i18gSiteLabel(nk ? nk.key : k.key);    // "#07 Desierto De Atac" / "pick Altiplano, Chi": a site label and a (possibly cut) name
    if (m && m[1].startsWith("{p")) return { t: nk ? nk.key : k.key, names: nk ? nk.names : [], auto: true };   // "Altiplano, Papua New G…": a place and a cut country name
    if (m && (m[1] !== "pick" || c.pick != null)) return { t: (m[1] === "pick" ? c.pick : m[1]) + " " + m[2], names: nk ? nk.names : [], prefix: true }; }
  if (!k.els.length && typeof i18dDesc === "function" && I18N.lang !== "en") {       // constellation names and workspace templates
    try { const d = i18dDesc(k.text) ?? (typeof i18dRx === "function" && typeof I18D !== "undefined" && I18D.phrase ? i18dRx(k.text) : null); if (d != null) return { t: d.replace(/[{}]/g, ""), names: [], literal: true }; } catch (e) { }
  }
  if (nk && i18gAuto(nk.key)) return { t: nk.key, names: nk.names, auto: true };
  return i18gList(k);
}
/* a comma-separated list whose items are each in the catalogue: each item is translated, the list is kept */
function i18gList(k) {
  if (k.els.length || !/, /.test(k.text) || typeof document === "undefined") return null;
  const end = /[.;]$/.test(k.text) ? k.text.slice(-1) : "", body = end ? k.text.slice(0, -1) : k.text;
  const parts = body.split(/, (?![^()]*\))/); if (parts.length < 2 || parts.length > 12) return null;
  const out = [];
  for (const p of parts) {
    const pk = i18gKey([document.createTextNode(p)]), c = I18G.cat[I18N.lang] || {};
    let h = c[pk.key] != null ? { t: c[pk.key], names: [] } : null;
    if (!h) { const nk = i18gNameKey(pk.key); if (nk && c[nk.key] != null) h = { t: c[nk.key], names: nk.names }; else if (i18gAuto(pk.key)) h = { t: pk.key, names: [], auto: true }; else if (nk && i18gAuto(nk.key)) h = { t: nk.key, names: nk.names, auto: true }; }
    if (!h) return null;
    out.push(i18gBuild(h.t, pk, h.names, h.auto).map(n => n.textContent).join("").trim());
  }
  const stop = end === "." && I18N.lang === "bn" ? "।" : end;
  return { t: out.join(", ").replace(/[{}]/g, "") + stop, names: [], literal: true };
}
/* rebuild a run from a translation: text pieces become new text nodes, {k} re-uses the original element */
function i18gBuild(t, k, names, auto) {
  const parts = []; let last = 0; const used = new Set();
  const txt = s => { if (!s) return; if (typeof parts[parts.length - 1] === "string") parts[parts.length - 1] += s; else parts.push(s); };
  t.replace(I18G_SKEL, (m, kind, i, off) => {
    txt(t.slice(last, off)); last = off + m.length; i = +i;
    if (kind === "n") { const x = k.nums[i]; txt(x ? i18gFmtNum(x) : m); }
    else if (kind === "p") txt(names[i] != null ? i18gNameShow(names[i]) : m);
    else if (k.els[i]) { parts.push(k.els[i]); used.add(i); }
    else txt(m);
    return m;
  });
  txt(t.slice(last));
  k.els.forEach((e, i) => { if (!used.has(i)) parts.push(e); });          // never drop an element (a control, a link)
  const pct = (I18N.langs[I18N.lang] || {}).pct || "";
  const out = parts.map((p, j) => {
    if (typeof p !== "string") return p;
    if (auto && I18N.lang !== "en") {
      if (pct) p = p.replace(/(\p{N})%/gu, `$1${pct}%`);
      p = p.replace(/°([NSEW])(?![\p{L}])/gu, (m, d) => "°" + tx("geo." + d.toLowerCase()));
    }
    if (j === 0 && k.lead) p = " " + p.replace(/^\s+/, "");
    if (j === parts.length - 1 && k.trail) p = p.replace(/\s+$/, "") + " ";
    return document.createTextNode(p);
  });
  if (k.lead && typeof parts[0] !== "string") out.unshift(document.createTextNode(" "));
  if (k.trail && typeof parts[parts.length - 1] !== "string") out.push(document.createTextNode(" "));
  return out;
}
function i18gQuoted(text) {
  if (!I18G.quotes) {
    const Q = new Set(), add = s => { if (typeof s === "string" && s.length > 24) Q.add(s.replace(/\s+/g, " ").trim()); };
    for (const t of Object.values(S.T || {})) for (const v of Object.values(t.methodology || {})) add(v);
    if (typeof A4 !== "undefined" && A4.reg) {
      for (const d of A4.reg.datasets || []) { add(d.license); add(d.processing); for (const l of [].concat(d.limitations || [])) add(l); }
      for (const t of A4.reg.targets || []) { for (const l of [].concat(t.limitations || [])) add(typeof l === "string" ? l : l && l.text); for (const s of [].concat(t.sources || [])) add(typeof s === "string" ? s : s && (s.citation || s.title)); }
      I18G.quotes = Q;
    } else return Q.has(text);
  }
  return I18G.quotes.has(text);
}
function i18gRun(parent, nodes, route) {
  if (!nodes.some(n => n.nodeType === 3 && /\p{L}|\d/u.test(n.nodeValue))) return;
  if (nodes.some(n => n.nodeType === 3 && I18G.done.has(n))) return;
  const k = i18gKey(nodes); if (!k.key || !(/\p{L}|\d/u.test(k.key.replace(I18G_SKEL, "")) || /\{n\d+\}/.test(k.key))) return;   // a bare number is re-formatted too
  const hit = i18gLookup(k);
  if (!hit) { if (!i18gAuto(k.key)) I18G.miss.set(k.key, route); return; }
  const before = nodes[nodes.length - 1].nextSibling;
  const orig = nodes.map(n => ({ n, v: n.nodeType === 3 ? n.nodeValue : null }));
  const built = i18gBuild(hit.t, k, hit.names, hit.auto);
  for (const n of nodes) if (n.parentNode === parent) parent.removeChild(n);
  for (const n of built) { parent.insertBefore(n, before); if (n.nodeType === 3) I18G.done.add(n); }
  let q = null;
  if (!hit.auto && i18gQuoted(k.text)) {
    q = document.createElement("details"); q.className = "i18g-q";
    q.innerHTML = `<summary>${esc(tx("q.original"))}</summary><span lang="en" translate="no">${esc(k.text)}</span>`;
    parent.insertBefore(q, before);
  }
  const rec = I18G.runs.get(parent) || []; rec.push({ orig, built, q }); I18G.runs.set(parent, rec);
  I18G.n++;
}
function i18gAttrs(e, route) {
  for (const a of I18G_ATTRS) {
    if (!e.hasAttribute(a)) continue;
    if (a === "label" && e.tagName !== "OPTGROUP" && e.tagName !== "OPTION") continue;
    e.__i18gA = e.__i18gA || {};
    const cur = e.getAttribute(a);
    if (e.__i18gA[a] && e.__i18gA[a].out === cur) continue;                // already ours
    const src = cur, t = document.createTextNode(src), k = i18gKey([t]);
    if (!/\p{L}/u.test(k.key)) continue;
    const hit = i18gLookup(k); if (!hit) { if (!i18gAuto(k.key)) I18G.miss.set(k.key, route + "@" + a); continue; }
    const out = i18gBuild(hit.t, k, hit.names, hit.auto).map(n => n.textContent).join("");
    e.__i18gA[a] = { src, out }; e.setAttribute(a, out);
  }
}
function i18gWalk(el, route) {
  if (i18gKeepEl(el)) return;
  if (el.nodeType === 1) i18gAttrs(el, route);
  let run = [];
  const flush = () => { if (run.length) i18gRun(el, run, route); run = []; };
  for (const c of [...el.childNodes]) {
    if (c.nodeType === 3) run.push(c);
    else if (c.nodeType === 1) {
      if (I18G_BLOCK.has(c.tagName)) flush();
      else run.push(c);
    }
  }
  flush();
  for (const c of [...el.children]) i18gWalk(c, route);
}
/* put every translated run back to its English nodes (before a fresh translation or when English is chosen) */
function i18gRestore(root) {
  const all = [root, ...root.querySelectorAll("*")];
  for (const p of all) {
    const rec = I18G.runs.get(p);
    if (rec) {
      for (const r of rec.reverse()) {
        if (r.q && r.q.parentNode) r.q.remove();
        const live = r.built.filter(n => n.parentNode === p); if (!live.length) continue;
        const before = live[live.length - 1].nextSibling;
        for (const n of r.built) if (n.parentNode === p) p.removeChild(n);
        for (const o of r.orig) { if (o.v != null) o.n.nodeValue = o.v; p.insertBefore(o.n, before); }
      }
      I18G.runs.delete(p);
    }
    if (p.__i18gA) { for (const [a, v] of Object.entries(p.__i18gA)) if (p.getAttribute(a) === v.out) p.setAttribute(a, v.src); p.__i18gA = null; }
  }
}
function i18gRoute() {
  if (typeof S === "undefined") return "?";
  if (S.tab === "lab" && typeof L !== "undefined") return "lab/" + L.mod;
  if (S.tab === "atlas" && typeof A3 !== "undefined") return "atlas/" + A3.view;
  return S.tab || "?";
}
function i18gTranslate(root, route) {
  if (!root || I18G.busy) return;
  I18G.busy = true;
  try {
    i18gRestore(root);
    if (I18N.lang !== "en") i18gWalk(root, route || i18gRoute());
  } finally { I18G.busy = false; }
}
/* harvest (tests and the catalogue builder): every segment key under a root, with and without names abstracted */
function i18gHarvest(root, route) {
  const out = [];
  const walk = el => {
    if (i18gKeepEl(el)) return;
    if (el.nodeType === 1) for (const a of I18G_ATTRS) if (el.hasAttribute(a) && (a !== "label" || el.tagName === "OPTGROUP")) {
      const k = i18gKey([document.createTextNode(el.getAttribute(a))]); if (/\p{L}/u.test(k.key) && !i18gAuto(k.key)) { const nk = i18gNameKey(k.key); out.push({ key: k.key, nkey: nk && nk.key, text: k.text, attr: a, route, quote: false, auto: !!(nk && i18gAuto(nk.key)) }); }
    }
    let run = [];
    const flush = () => {
      if (run.length && run.some(n => n.nodeType === 3 && /\p{L}/u.test(n.nodeValue))) {
        const k = i18gKey(run);
        if (/\p{L}/u.test(k.key.replace(I18G_SKEL, "")) && !i18gAuto(k.key)) { const nk = i18gNameKey(k.key); out.push({ key: k.key, nkey: nk && nk.key, text: k.text, route, quote: i18gQuoted(k.text), auto: !!(nk && i18gAuto(nk.key)) }); }
      }
      run = [];
    };
    for (const c of [...el.childNodes]) { if (c.nodeType === 3) run.push(c); else if (c.nodeType === 1) { if (I18G_BLOCK.has(c.tagName)) flush(); else run.push(c); } }
    flush();
    for (const c of [...el.children]) walk(c);
  };
  walk(root); return out;
}
