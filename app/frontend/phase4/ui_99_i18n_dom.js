/* ===== Interface languages for the globe workspace (baseline views) — loads last, so its wrappers are outermost =====
 * The baseline views (js/04_views.js, 05_console.js, 07_main.js) are protected files and stay byte-identical. They
 * render English HTML; after each render this layer replaces known English phrases with the active language, from a
 * catalogue of exact phrases (keys "ui.*", whose English text is the baseline text character for character) and a
 * small set of templates for the strings that carry numbers or names. Numbers are re-formatted for the locale.
 * Covered: the globe controls, legend, status line, readout, the ranking rail, the weight console and the Explore
 * panel. Place names (Natural Earth), registry target names and target method notes (source records) stay as they are.
 * Nothing here reads or changes a score: it only rewrites text after the baseline has drawn it. */
const I18D = { phrase: null, elem: null };
function i18dBuild() {
  if (I18D.phrase && I18D.phrase._lang === "built") return;
  const en = I18N.dict.en, P = new Map();
  for (const [k, v] of Object.entries(en)) if (k.startsWith("ui.") && !k.startsWith("ui.rx.") && !k.startsWith("ui.el.")) P.set(v, k);
  for (const c of S.crit) P.set(c.label, "ui.lab." + c.id);
  for (const [pid, p] of Object.entries(S.app.profiles)) { P.set(p.label, "profile." + pid); P.set(p.rationale, "ui.why." + pid); }
  for (const t of ["mars_jezero", "moon_south_pole", "cross", "moon_shackleton"]) if (TNAME[t]) P.set(TNAME[t], "tname." + t);
  P.set("Shackleton Crater", "tname.moon_shackleton");
  const E = new Map(); for (const [k, v] of Object.entries(en)) if (k.startsWith("ui.el.")) E.set(v, k);
  P._lang = "built"; I18D.phrase = P; I18D.elem = E;
}
const I18D_CODE = () => Object.fromEntries(S.crit.map(c => [c.short, c.id]));
function i18dNum(s) {                     // "4,739" / "0.124" / "-6.9" → locale format with the same decimals
  const m = /^(−|-)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/.exec(s); if (!m) return null;
  const v = (m[1] ? -1 : 1) * parseFloat(m[2].replace(/,/g, "") + (m[3] ? "." + m[3] : ""));
  return txNum(v, m[3] ? m[3].length : 0, { useGrouping: m[2].includes(",") || Math.abs(v) >= 10000 });
}
function i18dPct(s) { const m = /^(\d+(?:\.(\d+))?)%$/.exec(s); return m ? txNum(parseFloat(m[1]), m[2] ? m[2].length : 0) + ((I18N.langs[I18N.lang] || {}).pct || "") + "%" : null; }
function i18dLL(s) {                       // "22.50°S 67.50°W"
  const m = /^(\d+(?:\.\d+)?)°([NS]) (\d+(?:\.\d+)?)°([EW])$/.exec(s); if (!m) return null;
  return txLL((m[2] === "S" ? -1 : 1) * +m[1], (m[4] === "W" ? -1 : 1) * +m[3]);
}
/* "Region, Country" → the country through CLDR when its ISO code is recorded (i18n_65_places.js); regions stay */
function i18dPlaceStr(s) { return typeof i18gPlace === "function" ? s.split(", ").map(x => i18gPlace(x)).join(", ") : s; }
function i18dT(s) { const k = I18D.phrase.get(s); return k ? tx(k) : null; }
function i18dName(s) { return i18dT(s) ?? s; }          // a profile / target / criterion label, or a proper name kept as is
function i18dDesc(s) {                    // constellation names from TAIEngine.describe
  const m = /^(?:(\d\d) )?(Cold|Temperate|Hot) (?:(hyper-arid|arid|semi-arid|dry sub-humid|humid) )?(high-altitude )?(plains|rolling terrain|rugged terrain)$/.exec(s); if (!m) return null;
  const r = tx("ui.desc.compose", { t: tx("ui.desc." + m[2].toLowerCase()), a: m[3] ? tx("ui.desc." + m[3].replace(/[ -]/g, "_")) : "", h: m[4] ? tx("ui.desc.high") : "", r: tx("ui.desc." + m[5].replace(" ", "_")) }).replace(/\s+/g, " ").trim();
  return (m[1] ? m[1] + " " : "") + r;
}
function i18dRx(s) {
  let m;
  if ((m = /^(\d+) distinct sites ≥ (\d+) km apart · ([\d,]+) ranked · under (.+)$/.exec(s))) return tx("ui.rx.rail_meta", { d: txInt(+m[1]), km: txInt(+m[2]), n: txInt(+m[3].replace(/,/g, "")), p: i18dName(m[4]) });
  if ((m = /^Top (\d+) distinct sites \(≥ (\d+) km apart\) of ([\d,]+) ranked cells; Analogue Score under (.+)$/.exec(s))) return tx("ui.rx.rail_title", { d: txInt(+m[1]), km: txInt(+m[2]), n: txInt(+m[3].replace(/,/g, "")), p: i18dName(m[4]) });
  if ((m = /^(.*?)\s*·\s*(\d+\.\d+°[NS] \d+\.\d+°[EW]) · cell #(\d+)$/.exec(s))) return (m[1] ? i18dPlaceStr(m[1]) + " · " : "· ") + i18dLL(m[2]) + " · " + tx("ui.rx.cell_rank", { r: txInt(+m[3]) });
  if ((m = /^(.*?)\s*·\s*(\d+\.\d+°[NS] \d+\.\d+°[EW]) · under (.+)$/.exec(s))) return (m[1] ? i18dPlaceStr(m[1]) + " · " : "· ") + i18dLL(m[2]) + " · " + tx("ui.rx.under", { p: i18dName(m[3]) });
  if ((m = /^(\d+\.\d+°[NS] \d+\.\d+°[EW]) · ([\d.]+) km window$/.exec(s))) return i18dLL(m[1]) + " · " + tx("ui.rx.window", { km: txNum(+m[2], 1) });
  if ((m = /^([\d,]+) valid Earth cells · 0\.5° × 0\.625° · field computed in this browser in (\d+) ms · (\S+)(.*)$/.exec(s))) return tx("ui.rx.status", { n: txInt(+m[1].replace(/,/g, "")), ms: txInt(+m[2]), alg: m[3] }) + i18dStatusExtra(m[4]);
  if ((m = /^Comparing ([\d,]+) Earth cells…$/.exec(s))) return tx("ui.rx.comparing", { n: txInt(+m[1].replace(/,/g, "")) });
  if ((m = /^Analogue #(\d+)$/.exec(s))) return tx("ui.rx.analogue_k", { k: m[1] });
  if ((m = /^cell rank #([\d,]+|—) \/ ([\d,]+)$/.exec(s))) return tx("ui.rx.rank_of", { r: m[1] === "—" ? "—" : txInt(+m[1].replace(/,/g, "")), n: txInt(+m[2].replace(/,/g, "")) });
  if ((m = /^(\d+) of (\d+) active$/.exec(s))) return tx("ui.rx.k_of_n_active", { k: txInt(+m[1]), n: txInt(+m[2]) });
  if ((m = /^0\.5° × 0\.625° \(([\d.]+) × ([\d.]+) km\)$/.exec(s))) return tx("ui.rx.res", { a: txNum(+m[1], 1), b: txNum(+m[2], 1) });
  if ((m = /^(.+) — DATA NOT AVAILABLE \(scored on remaining criteria\)$/.exec(s))) return tx("ui.rx.missing_here", { list: txList(m[1].split(", ").map(i18dName)) });
  if ((m = /^Similarity field · (.+)$/.exec(s))) return tx("ui.rx.field", { t: i18dName(m[1]) });
  if ((m = /^Relative-rank change · (.+) → (.+)$/.exec(s))) return tx("ui.rx.rrc", { a: i18dName(m[1]), b: i18dName(m[2]) });
  if ((m = /^([+−-])25 pct-pts$/.exec(s))) return tx("ui.rx.pctpts", { s: m[1], n: txInt(25) });
  if ((m = /^(\d+)% of weight$/.exec(s))) return tx("ui.rx.of_weight", { p: txInt(+m[1]) });
  if ((m = /^([A-Z-]+) (\d+)%$/.exec(s)) && I18D_CODE()[m[1]]) return tx("crit." + I18D_CODE()[m[1]] + ".short") + " " + i18dPct(m[2] + "%");
  if ((m = /^weight (\d+\.\d\d)(, not applicable to this target)?$/.exec(s))) return tx("ui.rx.weight_vt", { w: txNum(+m[1], 2) }) + (m[2] ? tx("ui.rx.weight_na") : "");
  if ((m = /^Cross-planet score is the lower of the two \((.+)\)\.$/.exec(s))) return tx("ui.rx.cross_lower", { p: i18dPct(m[1]) || m[1] });
  if ((m = /^Not applicable to this target: (.+)\.$/.exec(s))) return tx("ui.rx.not_applicable", { list: txList(m[1].split(", ").map(i18dName)) });
  if ((m = /^Weights ([▾▴])$/.exec(s))) return tx("ui.weights") + " " + m[1];
  return null;
}
function i18dStatusExtra(x) {
  if (!x) return "";
  let m;
  if ((m = /^ · (\d+) analogue constellations among the top (\d+) cells$/.exec(x))) return " · " + tx("ui.rx.constellations", { k: txInt(+m[1]), n: txInt(+m[2]) });
  if ((m = /^ · fingerprint of (.+) applied to all ([\d,]+) cells — revealing from lowest to highest similarity$/.exec(x))) return " · " + tx("ui.rx.revealing", { t: i18dName(m[1]), n: txInt(+m[2].replace(/,/g, "")) });
  return x;
}
/* one string → its translation, or null when it is a name, a code or unknown */
function i18dString(s) {
  const t = s.trim(); if (!t) return null;
  const out = i18dT(t) ?? i18dRx(t) ?? i18dDesc(t) ?? i18dPct(t) ?? i18dLL(t) ?? (I18D_CODE()[t] ? tx("crit." + I18D_CODE()[t] + ".short") : null) ?? i18dNum(t);
  return out == null || out === t ? null : s.replace(t, out);
}
const I18D_ATTRS = ["title", "aria-label", "alt", "aria-valuetext"];
function i18nDom(root) {
  if (!root || !I18N.dict.en || typeof S === "undefined" || !S.app) return;
  i18dBuild();
  const en = I18N.lang === "en";
  /* whole elements whose text is one sentence split by inline markup */
  for (const e of root.querySelectorAll("p, .empty, div.meta")) {
    if (e.closest(".i18n-keep,#jn")) continue;
    if (en) { if (e.__enHTML != null && e.__lang !== "en") { e.innerHTML = e.__enHTML; e.__lang = "en"; } continue; }
    const src = e.__enHTML != null ? e.__enText : e.textContent.replace(/\s+/g, " ").trim();
    const html = i18dElem(src, e); if (html == null) continue;
    if (e.__enHTML == null) { e.__enHTML = e.innerHTML; e.__enText = src; }
    e.innerHTML = html; e.__lang = I18N.lang;
  }
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; const nodes = [];
  while ((n = w.nextNode())) nodes.push(n);
  for (const x of nodes) {
    const p = x.parentElement; if (!p || p.closest(".i18n-keep,script,style,#jn,select[data-i18n-lang]")) continue;
    if (en) { if (x.__en != null) { x.nodeValue = x.__en; x.__en = null; } continue; }
    const src = x.__en != null ? x.__en : x.nodeValue, out = i18dString(src);
    if (out == null) { if (x.__en != null) { x.nodeValue = x.__en; x.__en = null; } continue; }   // same as English here (e.g. "Globe" in French): put the English back, never keep another language's text
    if (x.__en == null) x.__en = src;
    x.nodeValue = out;
  }
  const els = [root, ...root.querySelectorAll(I18D_ATTRS.map(a => `[${a}]`).join(","))];
  for (const e of els) {
    if (!e.getAttribute || e.closest("#jn,.i18n-keep")) continue;
    e.__enA = e.__enA || {};
    for (const a of I18D_ATTRS) {
      if (!e.hasAttribute(a)) continue;
      if (en) { if (e.__enA[a] != null) { e.setAttribute(a, e.__enA[a]); delete e.__enA[a]; } continue; }
      const src = e.__enA[a] != null ? e.__enA[a] : e.getAttribute(a), out = i18dString(src);
      if (out == null) { if (e.__enA[a] != null) { e.setAttribute(a, e.__enA[a]); delete e.__enA[a]; } continue; }
      if (e.__enA[a] == null) e.__enA[a] = src;
      e.setAttribute(a, out);
    }
  }
}
function i18dElem(src, e) {
  const k = I18D.elem.get(src); if (k) return esc(tx(k));
  let m;
  if ((m = /^━ (.+?)\s+┅ selected Earth cell · radius = position in normalization range\.$/.exec(src))) return `<span style="color:var(--accent)">━</span> ${esc(i18dName(m[1]))} &nbsp; <span style="color:var(--ink)">┅</span> ${esc(tx("ui.fp_sel"))} · ${esc(tx("ui.fp_radius"))}`;
  if ((m = /^━ (.+?) · radius = position in normalization range\.$/.exec(src))) return `<span style="color:var(--accent)">━</span> ${esc(i18dName(m[1]))} · ${esc(tx("ui.fp_radius"))}`;
  if (/^Bars: this cell's values within Earth's normalization range \(data only\)\. ━ target level\.$/.test(src)) return `${esc(tx("ui.dna_note"))} <span style="color:var(--accent)">━</span> ${esc(tx("ui.target_level"))}`;
  if (/^Score = min\(SJezero, SSouth Pole\)/.test(src)) return esc(tx("ui.el_cross_note"));
  return null;
}
/* ---------- hooks: re-translate after every baseline render ---------- */
function i18dScope() { return ["#right", "#legend", "#status", "#console", ".vp-top", "#readout", "#markers", "#sheet-close", "#globe"].map(s => $(s)).filter(Boolean); }
function i18dAll() { for (const r of i18dScope()) i18nDom(r); if (S.tab === "explore" || I18N.lang === "en") i18nDom($("#left")); }
const i18dWrap = (f, scope) => function () { const r = f.apply(this, arguments); try { i18nDom($(scope)); } catch (e) { console.error(e); } return r; };
renderRight = i18dWrap(renderRight, "#right");
renderLegend = i18dWrap(renderLegend, "#legend");
renderStatus = i18dWrap(renderStatus, "#status");
updateConsoleNumbers = i18dWrap(updateConsoleNumbers, "#console");
/* the console is first drawn right after the data load; the static globe controls are translated at the same time */
{ const f = renderConsole; renderConsole = function () { const r = f.apply(this, arguments); try { i18nDom($("#console")); i18nDom($(".vp-top")); i18nDom($("#globe")); } catch (e) { console.error(e); } return r; }; }
{ const f = renderLeft; renderLeft = function () { const r = f.apply(this, arguments); try { if (S.tab === "explore" || I18N.lang === "en") i18nDom($("#left")); } catch (e) { console.error(e); } return r; }; }
{ const f = hover; hover = function (x, y) { const r = f.apply(this, arguments); try { if (I18N.lang !== "en") i18dReadout(x, y); } catch (e) { } return r; }; }
function i18dReadout(x, y) {
  const r = $("#readout"); if (x == null || !S.searched || !r.innerHTML) return;
  const ll = GLOBE.unproject(x, y); if (!ll) return;
  const i = nearestCell(ll.lat, ll.lon);
  if (i < 0 || ENG.haversine(ll.lat, ll.lon, S.lat[i], S.lon[i]) > 60) { r.innerHTML = `${esc(txLL(ll.lat, ll.lon))} · ${esc(tx("ui.no_land"))}`; return; }
  r.innerHTML = `<b>${keep(i18dPlaceStr(placeStr(i)))}</b><br>${esc(txLL(S.lat[i], S.lon[i]))} · ${esc(tx("ui.similarity_l"))} <b>${esc(txPct(S.res.eff[i]))}</b> · ${esc(tx("ui.rank_l"))} ${esc(txRank(S.res.rank[i] || null))}`;
}
{ const f = announce; announce = function (msg) { let m, s = msg;
  if (I18N.lang !== "en" && typeof msg === "string") {
    if ((m = /^Search complete\. #1 (.+) at (.+)\. Select it to open its analogue DNA\.$/.exec(msg))) s = tx("ui.ann.search", { place: m[1], p: i18dPct(m[2]) || m[2] });
    else if ((m = /^(.+): #1 (.+) at (\S+)\.$/.exec(msg))) s = tx("ui.ann.target", { t: i18dName(m[1]), place: m[2], p: i18dPct(m[3]) || m[3] });
  }
  return f.call(this, s); }; }
/* a language switch re-renders the same state (target, selection, weights, tab, layer) and translates it again */
document.addEventListener("asterro:lang", () => { try { if (S.res && S.searched) renderAll(); if (S.app) renderConsole(); i18dAll(); } catch (e) { console.error(e); } });
