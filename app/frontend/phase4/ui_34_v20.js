/* ===== ASTERRO V20 interface layer =====
 * Adds, without removing anything:
 *   - an immersive opening: the two-word title, no tab bar until the person starts (the tabs keep their ids, order and
 *     behaviour and return as soon as a view is opened);
 *   - the logo always returns Home;
 *   - grouped navigation (Discover, Analyze, Plan, Evidence, Data and Trust) in an accessible dialog that works as a
 *     drawer on phones; every destination calls an existing view or function;
 *   - Settings: Terms, Privacy, Scientific Disclaimer, language, accessibility, appearance, data and offline, location
 *     privacy, About and versions;
 *   - USGS MRDS mineral-occurrence context in Local Impact (src/v20/mrds.py; a catalogue, labelled "not NASA").
 * Nothing here changes a score, weight, threshold, ranking or dataset of the engine. */
const V20 = { version: "asterro-v20-ui-1.0.0", opener: null, open: null, msg: null, cache: null, mrds: null, mrdsErr: null, mrdsLoading: null,
  prefs: { still: false, large: false, contrast: false }, KEY: "asterro.v20.prefs" };
const V20_NAV = [
  ["discover", ["home", "globe", "discovery", "targets", "atlas"]],
  ["analyze", ["lab", "local", "compare", "lens", "character", "robust"]],
  ["plan", ["portfolio", "trajectory", "profiles", "scenarios"]],
  ["evidence", ["passport", "trace", "reproduce", "reports", "journal"]],
  ["trust", ["catalogue", "sources", "gaps", "trustc", "method"]],
];
const V20_LANGS = [["en", "English"], ["bn", "বাংলা"], ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"]];
const V20_ICON = {
  menu: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12"/></svg>',
  settings: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.4"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/></svg>',
};

/* ---------------------------------------------------------------- preferences (this browser only) */
try { const p = JSON.parse(localStorage.getItem(V20.KEY) || "null"); if (p && typeof p === "object") Object.assign(V20.prefs, p); } catch (e) { /* storage unavailable */ }
function v20SavePrefs() { try { localStorage.setItem(V20.KEY, JSON.stringify(V20.prefs)); } catch (e) { } }
function v20ApplyPrefs() {
  const h = document.documentElement;
  h.classList.toggle("v20-large", !!V20.prefs.large); h.classList.toggle("v20-contrast", !!V20.prefs.contrast);
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (window.GLOBE && (V20.prefs.still || reduce)) GLOBE.autoRotate = false;
}

/* ---------------------------------------------------------------- helpers */
function v20T(k, o) { return tx("v20." + k, o); }
function v20I() { return S.selected != null ? S.selected : (S.res && S.res.distinct ? S.res.distinct[0] : null); }
function v20Need(fn) { if (S.searched) return fn(); if (typeof runSearch === "function") runSearch(); dsAfterSearch(fn); }
function v20Scroll(sel) { setTimeout(() => { const n = document.querySelector(sel), L = document.querySelector("#left"); if (n && L) L.scrollTop += n.getBoundingClientRect().top - L.getBoundingClientRect().top - 8; }, 60); }
function v20JnClose() { if (typeof JN !== "undefined" && JN.open && typeof jnClose === "function") jnClose(); }

/* ---------------------------------------------------------------- destinations: each calls an existing view */
const V20_GO = {
  home: () => v20Home(),
  globe: () => v20Need(() => { v20JnClose(); setTab("explore"); setProj(0); }),
  discovery: () => v20Need(() => { v20JnClose(); setTab("discover"); }),
  targets: () => v20Need(() => { v20JnClose(); if (typeof A3 !== "undefined") A3.view = "catalog"; setTab("atlas"); }),
  atlas: () => v20Need(() => { v20JnClose(); if (typeof A3 !== "undefined" && A3.view === "catalog") A3.view = "home"; setTab("atlas"); }),
  lab: () => v20Need(() => { v20JnClose(); setTab("lab"); }),
  local: () => v20Need(() => { v20JnClose(); setTab("local"); }),
  compare: () => v20Need(() => { v20JnClose(); setTab("compare"); }),
  lens: () => v20Need(() => jnOpen("place", { i: v20I(), sec: "lens" })),
  character: () => v20Need(() => { v20JnClose(); v7Open("domains", v20I()); }),
  robust: () => v20Need(() => { v20JnClose(); if (typeof L !== "undefined") L.mod = "robust"; setTab("lab"); }),
  portfolio: () => v20Need(() => jnOpen("portfolio")),
  trajectory: () => v20Need(() => { v20JnClose(); setTab("trajectory"); }),
  profiles: () => v20Need(() => jnOpen("missions")),
  scenarios: () => v20Need(() => { v20JnClose(); setTab("scenarios"); }),
  passport: () => v20Need(() => jnOpen("place", { i: v20I(), sec: "passport" })),
  trace: () => v20Need(() => { v20JnClose(); select(v20I()); showTrace(); }),
  reproduce: () => v20Need(() => { v20JnClose(); select(v20I()); showReproduce(); }),
  reports: () => v20Need(() => { v20JnClose(); if (typeof DSF !== "undefined") DSF.step = DSF.steps.indexOf("reproduce") + 1; setTab("lab"); v20Scroll(".ds-flow"); }),
  journal: () => v20Need(() => jnOpen("journal")),
  catalogue: () => { v20JnClose(); setTab("data"); },
  sources: () => { v20JnClose(); setTab("data"); v20Scroll("[data-v9registry]"); },
  gaps: () => { v20JnClose(); if (typeof V9X !== "undefined") V9X.filter.state = "BLOCKED"; setTab("data"); v20Scroll("[data-v9xf='state']"); },
  trustc: () => v20Need(() => jnOpen("place", { i: v20I(), sec: "trust" })),
  method: () => { v20JnClose(); setTab("method"); },
};
function v20Current() {
  const app = document.getElementById("app");
  if (app && app.classList.contains("is-hero")) return "home";
  if (typeof JN !== "undefined" && JN.open) return { portfolio: "portfolio", missions: "profiles", journal: "journal" }[JN.view] || (JN.view === "place" ? { lens: "lens", passport: "passport", trust: "trustc" }[JN.sec] : null);
  return { explore: "globe", discover: "discovery", atlas: "atlas", lab: "lab", local: "local", compare: "compare", trajectory: "trajectory", scenarios: "scenarios", data: "catalogue", method: "method" }[S.tab] || null;
}

/* ---------------------------------------------------------------- Home (the logo) */
function v20Home() {
  v20Close(); v20JnClose();
  if (typeof dsLegalClose === "function") dsLegalClose();
  const app = document.getElementById("app"); if (!app) return;
  app.classList.add("is-hero");
  try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { }
  window.dispatchEvent(new Event("resize"));
  const h = document.querySelector("#hero h1"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
}

/* ---------------------------------------------------------------- header: title, logo, utilities, glass */
function v20Title() {
  const h = document.querySelector("#hero h1"); if (!h) return;
  h.classList.add("v20-title"); h.setAttribute("data-i18n-done", "");
  h.innerHTML = `${esc(v20T("hero.a"))} <span class="v20-serif">${esc(v20T("hero.b"))}</span>`;
}
function v20Header() {
  const bar = document.querySelector("header.bar"); if (!bar) return;
  const brand = bar.querySelector(".brand");
  if (brand) { brand.setAttribute("role", "link"); brand.setAttribute("tabindex", "0"); brand.setAttribute("aria-label", v20T("home")); brand.dataset.v20home = "1"; }
  let u = bar.querySelector(".v20-util");
  if (!u) { u = document.createElement("div"); u.className = "v20-util"; u.setAttribute("data-i18n-done", ""); if (brand) brand.insertAdjacentElement("afterend", u); else bar.prepend(u); }
  u.innerHTML = `<button type="button" id="v20-menu" data-glass aria-haspopup="dialog" aria-controls="v20-nav" aria-expanded="${V20.open === "nav"}">${V20_ICON.menu}<span class="v20-lbl">${esc(v20T("menu"))}</span></button>`
    + `<button type="button" id="v20-settings" data-glass aria-haspopup="dialog" aria-controls="v20-set" aria-expanded="${V20.open === "set"}">${V20_ICON.settings}<span class="v20-lbl">${esc(v20T("settings"))}</span></button>`;
  for (const n of document.querySelectorAll(".vp-top .seg, #legend")) n.setAttribute("data-glass", "");
}

/* ---------------------------------------------------------------- dialogs (navigation, settings) */
function v20Dialog(id, label) {
  let d = document.getElementById(id);
  if (!d) {
    d = document.createElement("div"); d.id = id; d.hidden = true; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    d.setAttribute("aria-labelledby", id + "-title"); d.setAttribute("data-i18n-done", ""); document.body.appendChild(d);
  }
  return d;
}
function v20NavHTML() {
  const cur = v20Current();
  return `<div class="v20-sheet" data-glass><div class="v20-sheet-h"><h2 id="v20-nav-title" tabindex="-1">${esc(v20T("nav.title"))}</h2><button type="button" class="v20-close" data-v20close>${esc(v20T("close"))}</button></div>
    <nav class="v20-groups" aria-label="${esc(v20T("nav.aria"))}">${V20_NAV.map(([g, items]) => `<section class="v20-group" data-v20group="${g}"><h3 id="v20-g-${g}">${esc(v20T("g." + g))}</h3><ul aria-labelledby="v20-g-${g}">${items.map(k => `<li><button type="button" class="v20-go" data-v20go="${k}"${cur === k ? ' aria-current="page"' : ""}><b>${esc(v20T("d." + k))}</b><span>${esc(v20T("d." + k + "_d"))}</span></button></li>`).join("")}</ul></section>`).join("")}</nav>
    <p class="v20-note">${esc(v20T("nav.note"))}</p></div>`;
}
function v20Kv(rows) { return `<dl class="v20-kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`; }
function v20SetHTML() {
  const lang = (typeof I18N !== "undefined" && I18N.lang) || "en", P = V20.prefs;
  const seg = (attr, opts) => `<div class="v20-row" role="group">${opts.map(([v, lab, on]) => `<button type="button" ${attr}="${v}" aria-pressed="${!!on}">${esc(lab)}</button>`).join("")}</div>`;
  const X = typeof V9X !== "undefined" ? V9X : null, man = X && X.man;
  const sw = typeof navigator !== "undefined" && navigator.serviceWorker && navigator.serviceWorker.controller;
  const saved = typeof liSaved === "function" ? liSaved().length : 0;
  const ret = X && typeof v9xRetrieved === "function" ? v9xRetrieved() : null;
  const msg = V20.msg ? `<p class="v20-msg${V20.msg.bad ? " bad" : ""}" role="status">${esc(V20.msg.t)}</p>` : `<p class="v20-msg" role="status"></p>`;
  return `<div class="v20-sheet" data-glass><div class="v20-sheet-h"><h2 id="v20-set-title" tabindex="-1">${esc(v20T("set.title"))}</h2><button type="button" class="v20-close" data-v20close>${esc(v20T("close"))}</button></div>
  <section class="v20-set-sec" data-v20sec="legal"><h3>${esc(v20T("set.legal"))}</h3><div class="v20-row"><button type="button" class="v20-link" data-v20legal="terms">${esc(v20T("set.terms"))}</button><button type="button" class="v20-link" data-v20legal="privacy">${esc(v20T("set.privacy"))}</button><button type="button" class="v20-link" data-v20legal="disclaimer">${esc(v20T("set.disclaimer"))}</button></div></section>
  <section class="v20-set-sec" data-v20sec="lang"><h3>${esc(v20T("set.lang"))}</h3>${seg("data-v20lang", V20_LANGS.map(([l, n]) => [l, n, l === lang]))}<p>${esc(v20T("set.lang_note"))}</p></section>
  <section class="v20-set-sec" data-v20sec="access"><h3>${esc(v20T("set.access"))}</h3>
    <p>${esc(v20T("set.motion"))}</p>${seg("data-v20still", [["0", v20T("set.motion_on"), !P.still], ["1", v20T("set.motion_off"), P.still]])}
    <p>${esc(v20T("set.text"))}</p>${seg("data-v20large", [["0", v20T("set.text_std"), !P.large], ["1", v20T("set.text_lg"), P.large]])}
    <p>${esc(v20T("set.access_note"))}</p></section>
  <section class="v20-set-sec" data-v20sec="appear"><h3>${esc(v20T("set.appear"))}</h3>
    <p>${esc(v20T("set.mode"))}</p>${typeof DS !== "undefined" ? seg("data-v20mode", [["simple", tx("ds.mode.simple"), DS.mode !== "advanced"], ["advanced", tx("ds.mode.advanced"), DS.mode === "advanced"]]) : ""}
    <p>${esc(v20T("set.contrast"))}</p>${seg("data-v20contrast", [["0", v20T("set.contrast_std"), !P.contrast], ["1", v20T("set.contrast_hi"), P.contrast]])}</section>
  <section class="v20-set-sec" data-v20sec="data"><h3>${esc(v20T("set.data"))}</h3>
    ${v20Kv([[v20T("set.d_src"), esc(v20T("set.d_src_" + (X && X.src ? X.src : "none")))], [v20T("set.d_hash"), man ? `<span class="hash">${esc(man.sha256.slice(0, 16))}…</span>` : esc(v20T("set.v_none"))],
      [v20T("set.d_stored"), esc(X && X.stored ? String(X.stored).slice(0, 10) : v20T("set.v_none"))], [v20T("set.d_queried"), esc(ret || v20T("set.v_none"))],
      [v20T("set.d_net"), esc(v20T(navigator.onLine ? "set.d_online" : "set.d_offline"))], [v20T("set.d_sw"), esc(v20T(sw ? "set.d_sw_on" : "set.d_sw_off"))]])}
    <div class="v20-row">${man ? `<button type="button" data-v20do="verify">${esc(v20T("set.d_verify"))}</button><button type="button" data-v20do="refresh">${esc(v20T("set.d_refresh"))}</button>` : `<button type="button" data-v20do="load">${esc(v20T("set.d_load"))}</button>`}</div>
    ${msg}<p>${esc(v20T("set.d_note"))}</p></section>
  <section class="v20-set-sec" data-v20sec="loc"><h3>${esc(v20T("set.loc"))}</h3><p>${esc(v20T("set.loc_p"))}</p><p>${esc(v20T("set.loc_saved", { n: txInt(saved) }))}</p>
    <div class="v20-row"><button type="button" data-v20do="forget"${saved ? "" : " disabled"}>${esc(v20T("set.loc_forget"))}</button></div></section>
  <section class="v20-set-sec" data-v20sec="about"><h3>${esc(v20T("set.about"))}</h3><p>${esc(v20T("set.about_p"))}</p>
    ${v20Kv([[v20T("set.v_ui"), esc(V20.version)], [v20T("set.v_engine"), esc((S.app && S.app.algorithm_version) || v20T("set.v_none"))], [v20T("set.v_data"), esc((man && man.version) || "tai-v19-data-2.0.0")], [v20T("set.v_cache"), esc(V20.cache || v20T("set.v_none"))]])}</section></div>`;
}
function v20Render() {
  if (V20.open === "nav") { const d = v20Dialog("v20-nav"); d.innerHTML = v20NavHTML(); }
  if (V20.open === "set") { const d = v20Dialog("v20-set"); const f = document.activeElement && document.activeElement.closest && document.activeElement.closest("#v20-set") ? v20FocusKey(document.activeElement) : null; d.innerHTML = v20SetHTML(); if (f) { const n = d.querySelector(f); if (n) n.focus(); } }
  v20Header();
}
function v20FocusKey(n) { for (const a of ["data-v20lang", "data-v20still", "data-v20large", "data-v20mode", "data-v20contrast", "data-v20do", "data-v20legal"]) if (n.hasAttribute(a)) return `[${a}="${n.getAttribute(a)}"]`; return null; }
function v20OpenSheet(which) {
  v20Close(true); v20JnClose();
  V20.opener = document.activeElement; V20.open = which;
  const d = v20Dialog(which === "nav" ? "v20-nav" : "v20-set");
  if (which === "set" && !V20.cache && typeof caches !== "undefined") caches.keys().then(k => { const c = k.filter(x => x.startsWith("asterro-")).sort().pop(); V20.cache = c ? c.replace("asterro-", "") : null; if (V20.open === "set") v20Render(); }).catch(() => { });
  v20Render(); d.hidden = false; document.body.classList.add("v20-lock");
  setTimeout(() => { const t = document.getElementById(which === "nav" ? "v20-nav-title" : "v20-set-title"); if (t) t.focus(); }, 0);
}
function v20Close(silent) {
  const was = V20.open; if (!was) return;
  for (const id of ["v20-nav", "v20-set"]) { const d = document.getElementById(id); if (d) d.hidden = true; }
  V20.open = null; V20.msg = null; document.body.classList.remove("v20-lock"); v20Header();
  if (!silent) { const o = V20.opener && V20.opener !== document.body && document.contains(V20.opener) && V20.opener.offsetParent !== null ? V20.opener : document.getElementById(was === "nav" ? "v20-menu" : "v20-settings"); if (o && o.focus) o.focus(); }
  V20.opener = null;
}

/* ---------------------------------------------------------------- Scientific Disclaimer (in the legal dialog) */
{ const f = typeof dsLegalOpen === "function" ? dsLegalOpen : null; if (f) dsLegalOpen = function (kind) {
  if (kind !== "disclaimer") return f.apply(this, arguments);
  let d = document.getElementById("ds-legal-dlg");
  if (!d) { d = document.createElement("div"); d.id = "ds-legal-dlg"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "ds-legal-title"); d.setAttribute("data-i18n-done", ""); document.body.appendChild(d); }
  DS.legalOpener = DS.legalOpener || document.activeElement; DS.legal = kind;
  const S4 = [["s1", tx("ui.disclaimer")], ["s2", v20T("dis.s2.p")], ["s3", v20T("dis.s3.p")], ["s4", v20T("dis.s4.p")]];
  d.innerHTML = `<div class="ds-legal-box" data-dslegalbox="disclaimer"><div class="ds-legal-head"><div><h2 id="ds-legal-title" tabindex="-1">${esc(v20T("dis.title"))}</h2><p class="meta">${esc(tx("ds.legal.updated"))}</p></div>
    <button type="button" class="btn-ghost btn-sm" data-dslegalclose>${esc(tx("ds.legal.close"))}</button></div>
    ${S4.map(([k, p]) => `<h3>${esc(v20T("dis." + k + ".h"))}</h3><p>${esc(p)}</p>`).join("")}
    <p class="meta"><a href="#terms" data-dslegal="terms">${esc(tx("ds.legal.terms"))}</a> · <a href="#privacy" data-dslegal="privacy">${esc(tx("ds.legal.privacy"))}</a></p></div>`;
  d.hidden = false; if (typeof dsNoEmDash === "function") dsNoEmDash(d);
  setTimeout(() => { const t = document.getElementById("ds-legal-title"); if (t) t.focus(); }, 0);
}; }

/* ---------------------------------------------------------------- Local Impact: USGS MRDS context */
function v20MrdsLoad() {
  if (V20.mrds || V20.mrdsLoading) return V20.mrdsLoading;
  V20.mrdsErr = null;
  V20.mrdsLoading = fetch("data/v20/mrds.json").then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(j => { if (!j || !j.cells || !j.nearest_table) throw new Error("format"); V20.mrds = j; })
    .catch(e => { V20.mrdsErr = String(e.message || e); }).finally(() => { V20.mrdsLoading = null; const n = document.querySelector("[data-v20mrds]"); if (n && typeof LI !== "undefined" && LI.i != null) n.innerHTML = v20MrdsHTML(LI.i); });   // in place: focus and scroll stay where they are
  return V20.mrdsLoading;
}
function v20MrdsHTML(i) {
  const head = `<div class="lbl">${esc(v20T("mrds.h"))}</div><p class="meta">${keep(v20T("mrds.src"))} · <span class="v9x-ag other">${esc(v20T("mrds.not_nasa"))}</span></p>`;
  const M = V20.mrds;
  if (!M) { if (!V20.mrdsErr) v20MrdsLoad(); return head + `<p class="meta" role="status">${esc(v20T(V20.mrdsErr ? "mrds.error" : "mrds.loading"))}</p>`; }
  const r = Math.round(M.radius_km), c = M.cells[String(S.cell[i])];
  const pct = (M.country_share[0] || [0, 0, 0])[2];
  let body;
  if (!c) body = `<p>${esc(v20T("mrds.none", { r: txInt(r) }))}</p>`;
  else {
    const t = M.nearest_table[c[3]] || [];
    body = v20Kv([[v20T("mrds.n", { r: txInt(r) }), esc(txInt(c[0]))], [v20T("mrds.prod"), esc(txInt(c[1]))],
      [v20T("mrds.near"), esc(v20T("mrds.near_v", { name: t[1] || t[0], com: t[2] || "–", stat: t[3] || "–", country: t[4] || "–", d: txNum(c[2], 1) }))],
      [v20T("mrds.top"), c[4].map(k => keep(M.commodities[k])).join(", ") || "–"]]);
  }
  return head + body + `<p class="meta">${esc(v20T("mrds.lim", { pct: Math.round(pct) }))}</p><p class="meta">${esc(v20T("mrds.meta", { date: M.file_date, q: M.retrieved, sha: M.raw_sha256.slice(0, 16) + "…" }))}</p>`;
}
{ const f = viewLocal; viewLocal = function () {
  let h = f.apply(this, arguments);
  try {
    if (typeof LI !== "undefined" && LI.i != null) {
      // inside the data-layer section (the section order of Local Impact stays as V19x left it)
      const blk = `<div class="v20-mrds" data-v20mrds data-i18n-done>${v20MrdsHTML(LI.i)}</div>`;
      const a = h.indexOf('<section class="sec li-sec" data-lisec="v19x"'), z = a >= 0 ? h.indexOf("</section>", a) : -1;
      if (z >= 0) h = h.slice(0, z) + blk + h.slice(z);
      else { const k = h.indexOf('<section class="sec li-sec" data-lisec="report"'); const sec = `<section class="sec li-sec" data-i18n-done>${blk}</section>`; h = k >= 0 ? h.slice(0, k) + sec + h.slice(k) : h + sec; }
    }
  } catch (e) { console.error(e); }
  return h;
}; }

/* ---------------------------------------------------------------- events */
document.addEventListener("click", e => {
  const t = e.target; if (!t || !t.closest) return;
  if (t.closest("[data-v20home]")) { e.preventDefault(); v20Home(); return; }
  if (t.closest("#v20-menu")) { V20.open === "nav" ? v20Close() : v20OpenSheet("nav"); return; }
  if (t.closest("#v20-settings")) { V20.open === "set" ? v20Close() : v20OpenSheet("set"); return; }
  if (t.closest("[data-v20close]") || t.id === "v20-nav" || t.id === "v20-set") { v20Close(); return; }
  const g = t.closest("[data-v20go]"); if (g) { const k = g.dataset.v20go; v20Close(true); try { V20_GO[k](); } catch (err) { console.error(err); } return; }
  const lg = t.closest("[data-v20legal]"); if (lg) { const k = lg.dataset.v20legal, op = document.getElementById("v20-settings"); v20Close(true); if (typeof DS !== "undefined") DS.legalOpener = op; dsLegalOpen(k); return; }
  const P = V20.prefs, b = t.closest("button"); if (!b || !b.closest("#v20-set")) return;
  if (b.dataset.v20lang) { setLang(b.dataset.v20lang); v20Render(); return; }
  if (b.dataset.v20still) { P.still = b.dataset.v20still === "1"; if (window.GLOBE) GLOBE.autoRotate = !P.still && !(matchMedia("(prefers-reduced-motion: reduce)").matches); v20SavePrefs(); v20Render(); return; }
  if (b.dataset.v20large) { P.large = b.dataset.v20large === "1"; v20SavePrefs(); v20ApplyPrefs(); v20Render(); return; }
  if (b.dataset.v20contrast) { P.contrast = b.dataset.v20contrast === "1"; v20SavePrefs(); v20ApplyPrefs(); v20Render(); return; }
  if (b.dataset.v20mode) { dsSetMode(b.dataset.v20mode); v20Render(); return; }
  const k = b.dataset.v20do; if (!k) return;
  const say = (key, bad) => { V20.msg = { t: tx(key), bad: !!bad }; v20Render(); };
  if (k === "forget") { liStore([]); if (typeof LI !== "undefined") LI.results = null; say("v20.set.loc_done"); }
  else if (k === "load") { v9xLoad().then(() => { V20.msg = null; v20Render(); }); }
  else if (k === "refresh") { const old = V9X.man && V9X.man.sha256; V9X.err = null; v9xLoad(true).then(() => say("v19x.msg." + (V9X.src === "server" ? (V9X.man.sha256 === old ? "same" : "updated") : (V9X.online ? "failed" : "offline")), V9X.src !== "server")); }
  else if (k === "verify") { v9xGet("cube").then(async r => { if (!r) return say("v19x.msg.nostore", true); const v = await AsterroV19X.verify(r.manifest, r.buffer, V9X.cellSha || await v9xCellSha()); say("v19x.msg." + (v.ok ? "verify_ok" : "verify_bad"), !v.ok); }); }
});
document.addEventListener("keydown", e => {
  if (e.target && e.target.dataset && e.target.dataset.v20home && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); v20Home(); return; }
  if (!V20.open) return;
  const d = document.getElementById(V20.open === "nav" ? "v20-nav" : "v20-set"); if (!d || d.hidden) return;
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); v20Close(); return; }
  if (e.key === "Tab") {
    const f = [...d.querySelectorAll("button:not([disabled]),a[href],[tabindex='-1'],select,input")].filter(n => n.offsetParent !== null || n === document.activeElement);
    if (!f.length) return; const a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }
}, true);
window.addEventListener("hashchange", () => { if (location.hash === "#disclaimer") dsLegalOpen("disclaimer"); });


/* ---------------------------------------------------------------- fonts: Helvetica and Playfair Display only
 * The baseline page links three other web fonts; the V20 tokens no longer use them, so the link is removed and the
 * Playfair Display italic used by the hero word is requested instead (Georgia is the offline fallback). The protected
 * baseline file index.src.html is not edited. */
(function v20Fonts() {
  try {
    for (const l of document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis.com"]')) if (/Big\+Shoulders|Instrument\+Sans|JetBrains\+Mono/.test(l.href)) l.remove();
    if (!document.getElementById("v20-font")) { const l = document.createElement("link"); l.id = "v20-font"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,500&display=swap"; document.head.appendChild(l); }
  } catch (e) { /* offline: Georgia fallback */ }
})();

/* ---------------------------------------------------------------- the 3D globe is the default at every width
 * The baseline switches phones (< 760 px) to the flat map once the data load. V20 keeps the globe until the person
 * chooses the map themselves; the Map button works exactly as before. */
document.addEventListener("pointerdown", e => { if (e.target && e.target.closest && e.target.closest("[data-proj]")) V20.projTouched = true; }, true);
document.addEventListener("keydown", e => { if (e.target && e.target.closest && e.target.closest("[data-proj]")) V20.projTouched = true; }, true);
{ const f = setProj; setProj = function (p) { if (p === 1 && !V20.projTouched && !S.searched && typeof innerWidth === "number" && innerWidth < 760) p = 0; return f.call(this, p); }; }

/* ---------------------------------------------------------------- phones: the atlas button scrolls to the atlas once the search has laid out
 * With the globe as the phone default the search reveal can finish later than the baseline's fixed 400 ms scroll, so
 * the panel is brought into view again when the results exist (the baseline handler still runs as before). */
document.addEventListener("click", e => {
  if (!e.target || !e.target.closest || !e.target.closest("#hero-atlas") || innerWidth > 760) return;
  const go = () => { const l = document.getElementById("left"); if (l && S.tab === "atlas") l.scrollIntoView({ block: "start" }); };
  dsAfterSearch(() => { setTimeout(go, 400); setTimeout(go, 1600); });
});

/* ---------------------------------------------------------------- language changes and boot */
{ const f = setLang; setLang = function () { const r = f.apply(this, arguments); try { v20Title(); v20Header(); if (V20.open) v20Render(); } catch (e) { console.error(e); } return r; }; }
(function v20Boot() {
  const go = () => {
    v20Title(); v20Header(); v20ApplyPrefs();
    if (location.hash === "#disclaimer") dsLegalOpen("disclaimer");
    let n = 0; const iv = setInterval(() => { v20ApplyPrefs(); v20Header(); v20Title(); if (++n > 20 || window.GLOBE) { v20ApplyPrefs(); clearInterval(iv); } }, 250);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else setTimeout(go, 0);
})();
