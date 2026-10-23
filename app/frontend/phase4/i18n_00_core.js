/* ===== ASTERRO · interface languages (English, বাংলা, Español, Français, Deutsch) — core =====
 * tx(key, vars) looks a key up in the active language and falls back to English; every fallback is recorded in
 * I18N.missing so tests can prove a screen has no untranslated strings. Placeholders are {name}. Numbers and dates
 * use Intl with the language's locale (Bengali digits for বাংলা, decimal comma for French and Spanish).
 * Scientific identifiers stay as they are in every language: dataset and product names, instrument names, units,
 * algorithm and schema versions, criterion codes, and place names from Natural Earth.
 * Translation status: the bn / es / fr strings were written by Claude (an AI model) for this project and have NOT
 * yet been reviewed by native speakers (status: docs/i18n/TRANSLATION_REGISTER.md). They are complete, not placeholders.
 * Language never changes a number: scores, ranks, weights and exports are computed before any text is chosen. */
const I18N = { lang: "en", langs: {}, dict: {}, missing: new Set(), KEY: "asterro.lang", fontLoaded: false };
function i18nRegister(lang, meta, dict) { I18N.langs[lang] = meta; I18N.dict[lang] = dict; }
function i18nFill(s, vars) { return vars ? s.replace(/\{(\w+)\}/g, (m, k) => vars[k] != null ? String(vars[k]) : m) : s; }
function tx(key, vars) {
  const d = I18N.dict[I18N.lang], en = I18N.dict.en || {};
  let s = d && d[key];
  if (s == null) { if (I18N.lang !== "en") I18N.missing.add(I18N.lang + ":" + key); s = en[key]; }
  if (s == null) { I18N.missing.add("en:" + key); return key; }
  return i18nFill(s, vars);
}
function txHas(key) { return !!(I18N.dict.en && I18N.dict.en[key] != null); }
function txLocale() { return (I18N.langs[I18N.lang] || {}).locale || "en-GB"; }
const _txNF = new Map();
function txNum(x, d = 0, opt = {}) {
  if (x == null || x !== x) return "—";
  const k = txLocale() + "|" + d + "|" + JSON.stringify(opt);
  if (!_txNF.has(k)) _txNF.set(k, new Intl.NumberFormat(txLocale(), { minimumFractionDigits: d, maximumFractionDigits: d, ...opt }));
  return _txNF.get(k).format(x);
}
function txInt(x) { return x == null || x !== x ? "—" : txNum(x, 0, { useGrouping: true }); }
function txPct(x, d = 1) { return x == null || x !== x || x < 0 ? "—" : txNum(100 * x, d) + ((I18N.langs[I18N.lang] || {}).pct || "") + "%"; }
function txRank(r) { return r == null ? "—" : "#" + txInt(r); }
function txDate(d) { try { return new Intl.DateTimeFormat(txLocale(), { year: "numeric", month: "long", day: "numeric" }).format(d); } catch (e) { return d.toISOString().slice(0, 10); } }
function txLL(lat, lon) { return `${txNum(Math.abs(lat), 2)}°${tx(lat >= 0 ? "geo.n" : "geo.s")} ${txNum(Math.abs(lon), 2)}°${tx(lon >= 0 ? "geo.e" : "geo.w")}`; }
function txList(arr) {
  if (!arr.length) return "";
  try { return new Intl.ListFormat(txLocale(), { style: "long", type: "conjunction" }).format(arr); } catch (e) { return arr.join(", "); }
}
/* translated text with HTML fragments (already escaped / built) substituted for some placeholders */
function txH(key, vars = {}, html = {}) { return esc(tx(key, vars)).replace(/\{(\w+)\}/g, (m, k) => html[k] != null ? html[k] : m); }
/* a term kept verbatim in every language (dataset / place / unit names); excluded from the leftover-English test */
function keep(s) { return `<span class="i18n-keep" translate="no">${esc(s)}</span>`; }

function i18nFont(lang) {
  if (lang !== "bn" || I18N.fontLoaded) return;
  I18N.fontLoaded = true;   // Bengali glyphs: Noto Sans Bengali from Google Fonts when online; otherwise the system's Bengali font
  try {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.id = "i18n-font-bn";
    l.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
  } catch (e) { /* offline: system font fallback */ }
}
function setLang(lang, opts = {}) {
  if (!I18N.dict[lang]) lang = "en";
  const changed = lang !== I18N.lang;
  I18N.lang = lang;
  document.documentElement.lang = (I18N.langs[lang] || {}).htmlLang || lang;
  document.documentElement.dataset.lang = lang;
  i18nFont(lang);
  if (!opts.noStore) { try { localStorage.setItem(I18N.KEY, lang); } catch (e) { /* storage unavailable: choice lasts this visit */ } }
  for (const s of document.querySelectorAll("select[data-i18n-lang]")) s.value = lang;
  i18nChrome();
  if (changed || opts.force) document.dispatchEvent(new CustomEvent("asterro:lang", { detail: { lang } }));
}
function i18nInitial() {
  let q = null; try { q = new URLSearchParams(location.search).get("lang"); } catch (e) { }
  if (q && I18N.dict[q]) return q;
  try { const s = localStorage.getItem(I18N.KEY); if (s && I18N.dict[s]) return s; } catch (e) { }
  return "en";
}
function i18nSelect(id, extraClass = "") {
  return `<label class="i18n-sel ${extraClass}"><span class="sr-only">${esc(tx("lang.label"))}</span><select id="${id}" data-i18n-lang aria-label="${esc(tx("lang.label"))}">${Object.entries(I18N.langs).map(([k, m]) => `<option value="${k}" lang="${m.htmlLang || k}"${k === I18N.lang ? " selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label>`;
}

/* ---------- the chrome: header, landing, and the English-only notice for research views ---------- */
const I18N_TABS = ["explore", "compare", "scenarios", "discover", "data", "method", "lab", "trajectory", "atlas"];
function i18nChrome() {
  if (typeof document === "undefined" || !document.getElementById("app")) return;
  for (const b of document.querySelectorAll(".tabs button[data-tab]")) { const k = "tab." + b.dataset.tab; if (txHas(k)) b.textContent = tx(k); if (b.title && txHas(k + ".t")) b.title = tx(k + ".t"); }
  const br = document.querySelector(".brand"); if (br) br.setAttribute("aria-label", tx("aria.brand"));
  const tb = (id, body, name) => { const b = document.getElementById(id); if (b) b.innerHTML = `<i>${esc(tx(body))}</i>${esc(tx(name))}`; };
  tb("tgt-mars", "body.mars", "tname.mars_jezero"); tb("tgt-moon", "body.moon", "tname.moon_south_pole"); tb("tgt-cross", "body.both", "tname.cross");
  const set = (id, k) => { const e = document.getElementById(id); if (e) e.textContent = tx(k); };
  set("btn-search", "cta.search"); set("hero-search", "cta.search"); set("hero-science", "cta.science"); set("hero-atlas", "cta.atlas"); set("hero-journey", "cta.journey");
  const hero = document.getElementById("hero");
  if (hero) {
    const q = s => hero.querySelector(s);
    if (q(".eyebrow")) q(".eyebrow").textContent = tx("hero.eyebrow");
    if (q("h1")) q("h1").innerHTML = esc(tx("hero.title1")) + "<br>" + esc(tx("hero.title2"));
    if (q(".sub")) q(".sub").textContent = tx("hero.sub");
    const ht = (id, body, name, where, alt) => { const b = document.getElementById(id); if (!b) return; const sp = b.querySelector("span"); if (sp) sp.innerHTML = `<i>${esc(tx(body))}</i><b>${esc(tx(name))}</b><em>${where}</em>`; const im = b.querySelector("img"); if (im) im.alt = tx(alt); };
    ht("ht-mars", "body.mars", "tname.mars_jezero", esc(txLL(18.38, 77.58)), "hero.alt_mars");
    ht("ht-moon", "body.moon", "tname.moon_south_pole", `${esc(txNum(90, 0))}°${esc(tx("geo.s"))} · ${keep("Shackleton")}`, "hero.alt_moon");
    const tg = hero.querySelector(".hero-targets"); if (tg) tg.setAttribute("aria-label", tx("hero.choose_world"));
    i18nFacts();
  }
  const nav = document.querySelector("nav.tabs"); if (nav) nav.setAttribute("aria-label", tx("aria.tabs"));
  const tc = document.querySelector(".target-ctl"); if (tc) tc.setAttribute("aria-label", tx("aria.target"));
  i18nHeroRow();
  i18nAtlasCtl();
  i18nHeader();
  i18nNotice();
}
/* the quick-switch beside the target buttons (Phase IV): its prompt and group labels; target names stay as registered */
function i18nAtlasCtl() {
  const sel = document.getElementById("tc-atlas-sel"); if (!sel) return;
  const o = sel.querySelector('option[value=""]'), n = sel.querySelectorAll("option").length - 1;
  if (o && I18N.lang !== "en") o.textContent = tx("chrome.more_targets", { n: txInt(n) });
  for (const g of sel.querySelectorAll("optgroup")) { if (!g.dataset.en) g.dataset.en = g.label; g.label = I18N.lang === "en" ? g.dataset.en : tx("chrome.group." + g.dataset.en.toLowerCase()); }
  sel.setAttribute("aria-label", tx("chrome.more_targets_aria"));
}
if (typeof a4ExploreControl === "function") { const _i18nA4C = a4ExploreControl; a4ExploreControl = function () { const r = _i18nA4C.apply(this, arguments); try { i18nAtlasCtl(); } catch (e) { } return r; }; }
/* the landing facts line is written by the baseline boot after the data load; localise it once it appears
 * (English output is the baseline sentence, character for character) */
function i18nFacts() {
  const f = document.getElementById("hero-facts");
  if (!f || typeof S === "undefined" || !S.n) return;
  if (!(f.dataset.i18n || /valid land cells/.test(f.textContent))) return;
  const s = tx("hero.facts", { n: I18N.lang === "en" ? S.n.toLocaleString() : txInt(S.n) });
  if (f.textContent !== s) f.textContent = s;
  f.dataset.i18n = "1";
}
(function i18nFactsWatch() {
  const f = document.getElementById("hero-facts"); if (!f || typeof MutationObserver === "undefined") return;
  new MutationObserver(() => { if (I18N.lang !== "en" || f.dataset.i18n) i18nFacts(); }).observe(f, { childList: true, characterData: true, subtree: true });
})();
/* The research views used to stay in English behind a localised notice. They are now translated (i18n_60_seg.js with
 * the route catalogues i18n_7x_routes_*.js), so the notice is gone; the function remains so older callers keep working
 * and removes any notice left in the page. */
function i18nNotice() { const n = document.getElementById("i18n-notice"); if (n) n.remove(); }
const _i18nRenderLeft = renderLeft;
renderLeft = function () { const r = _i18nRenderLeft.apply(this, arguments); try { i18nNotice(); } catch (e) { } return r; };

/* where the language can be chosen: a compact control in the header (always visible), a row of languages on the
 * landing screen, and the journey dialog's header. The weight console carries no language control. */
function i18nHeroRow() {
  const hero = document.getElementById("hero"); if (!hero) return;
  let r = document.getElementById("hero-lang");
  if (!r) { r = document.createElement("div"); r.id = "hero-lang"; r.className = "hero-lang"; r.setAttribute("role", "group"); hero.insertBefore(r, hero.firstChild); }
  r.setAttribute("aria-label", tx("lang.label"));
  r.innerHTML = Object.entries(I18N.langs).map(([k, m]) => `<button type="button" data-i18n-set="${k}" lang="${m.htmlLang || k}" aria-pressed="${k === I18N.lang}">${esc(m.name)}</button>`).join("");
}
const I18N_GLOBE = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" stroke-width="1.2"/><ellipse cx="8" cy="8" rx="2.7" ry="6.4" fill="none" stroke="currentColor" stroke-width="1"/><path d="M1.8 6h12.4M1.8 10h12.4" stroke="currentColor" stroke-width="1" fill="none"/></svg>`;
function i18nHeader() {
  const sb = document.getElementById("btn-search"); if (!sb) return;
  let w = document.getElementById("i18n-hdr");
  if (!w) { w = document.createElement("label"); w.id = "i18n-hdr"; w.className = "i18n-hdr"; sb.insertAdjacentElement("beforebegin", w); }
  const m = I18N.langs[I18N.lang] || {};
  w.title = tx("lang.label") + ": " + (m.name || "");
  w.innerHTML = `${I18N_GLOBE}<span class="i18n-code" aria-hidden="true">${esc(m.code || I18N.lang.toUpperCase())}</span><select id="lang-sel" data-i18n-lang aria-label="${esc(tx("lang.label"))}">${Object.entries(I18N.langs).map(([k, x]) => `<option value="${k}" lang="${x.htmlLang || k}"${k === I18N.lang ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>`;
}
(function i18nBoot() {
  const go = () => {
    document.addEventListener("change", e => { if (e.target && e.target.matches && e.target.matches("select[data-i18n-lang]")) { const id = e.target.id; setLang(e.target.value); const n = id && document.getElementById(id); if (n) n.focus(); } });
    document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-i18n-set]"); if (b) { setLang(b.dataset.i18nSet); const n = document.querySelector(`[data-i18n-set="${b.dataset.i18nSet}"]`); if (n) n.focus(); } });
    setLang(i18nInitial(), { noStore: true, force: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else setTimeout(go, 0);
})();
