/* ===== Design layer: welcoming landing, plain-language summary, Simple / Advanced view =====
 * Presentation only. Every number comes from the existing engine (S.res, JE.lens); nothing here changes a score.
 *   - Landing: one clear promise and three ways in (Explore Earth · Discover an analogue · Compare with the Moon or
 *     Mars). They trigger the existing actions; the original buttons stay on the page as quieter links.
 *   - Explore: a plain-language card for the selected place (how similar, strongest similarities, important
 *     differences, where every Earth analogue falls short), with the full analysis one click away.
 *   - Simple / Advanced: Simple (the default) keeps every weight slider but hides the technical detail around it
 *     (status tags, share of weight, target / Earth position track); Advanced shows everything, as before. The choice
 *     is remembered in this browser.
 *   - Terms of Service and Privacy Policy: linked from the landing, the weight console (every view), the Atlas and the
 *     Research Laboratory; they open in a dialog and by address (#terms, #privacy).
 *   - Typography rules: the interface uses no em dash and no checkmark (a filled dot marks a passed check). Rendered text, placeholders, titles and labels are normalised to
 *     an en dash when they are drawn (catalogues and protected baseline sources keep their text). */
const DS = { KEY: "asterro.view.v1", mode: "simple" };
try { const m = localStorage.getItem(DS.KEY); if (m === "advanced" || m === "simple") DS.mode = m; } catch (e) { /* storage unavailable: default view */ }
function dsApplyMode() { document.documentElement.classList.toggle("ds-simple", DS.mode === "simple"); document.documentElement.classList.toggle("ds-advanced", DS.mode === "advanced"); }
function dsSetMode(m) {
  DS.mode = m === "advanced" ? "advanced" : "simple";
  try { localStorage.setItem(DS.KEY, DS.mode); } catch (e) { }
  dsApplyMode(); if (typeof renderConsole === "function" && S.searched) renderConsole();
}
dsApplyMode();
function dsModeHTML() {
  return `<div class="ds-mode" role="group" aria-label="${esc(tx("ds.mode.label"))}" title="${esc(tx("ds.mode.hint"))}" data-i18n-done>${["simple", "advanced"].map(m => `<button type="button" data-dsmode="${m}" aria-pressed="${DS.mode === m}">${esc(tx("ds.mode." + m))}</button>`).join("")}</div>`;
}
{ const f = renderConsole; renderConsole = function () {
  const r = f.apply(this, arguments);
  try { const side = document.querySelector("#console .profiles"); if (side && !side.querySelector(".ds-mode")) side.insertAdjacentHTML("afterbegin", dsModeHTML()); } catch (e) { console.error(e); }
  return r;
}; }

/* ---------------------------------------------------------------- landing */
function dsHero() {
  const hero = document.getElementById("hero"); if (!hero) return;
  const h1 = hero.querySelector("h1"), tgt = hero.querySelector(".hero-targets"); if (!h1 || !tgt) return;
  let lede = hero.querySelector(".ds-lede");
  if (!lede) { lede = document.createElement("p"); lede.className = "ds-lede"; lede.setAttribute("data-i18n-done", ""); h1.insertAdjacentElement("afterend", lede); }
  lede.textContent = tx("ds.hero.lede");
  let acts = hero.querySelector(".ds-actions");
  if (!acts) { acts = document.createElement("div"); acts.className = "ds-actions"; acts.setAttribute("role", "group"); acts.setAttribute("data-i18n-done", ""); tgt.insertAdjacentElement("beforebegin", acts); }
  acts.setAttribute("aria-label", tx("ds.hero.ways"));
  acts.innerHTML = ["explore", "discover", "compare"].map((a, k) => `<button type="button" class="ds-act" data-dsact="${a}"><span class="ds-num" aria-hidden="true">${esc(txInt(k + 1))}</span><b>${esc(tx("ds.hero." + a))}</b><span>${esc(tx("ds.hero." + a + "_d"))}</span></button>`).join("");
  let lg = hero.querySelector(".ds-legal"); if (lg) lg.remove();
  const facts = hero.querySelector(".hero-facts"); if (facts) facts.insertAdjacentHTML("afterend", dsLegalLinks());
}
function dsAfterSearch(fn) { if (S.searched) return fn(); const t0 = Date.now(), iv = setInterval(() => { if (S.searched || Date.now() - t0 > 60000) { clearInterval(iv); if (S.searched) fn(); } }, 120); }
document.addEventListener("click", e => {
  const m = e.target.closest && e.target.closest("[data-dsmode]"); if (m) { dsSetMode(m.dataset.dsmode); return; }
  const a = e.target.closest && e.target.closest("[data-dsact]"); if (a) {
    const k = a.dataset.dsact;
    if (k === "explore") document.getElementById("hero-search").click();
    else if (k === "discover") (document.getElementById("hero-reveal") || document.getElementById("hero-journey")).click();
    else if (k === "compare") { document.getElementById("hero-search").click(); dsAfterSearch(() => setTab("compare")); }
    return;
  }
  const s = e.target.closest && e.target.closest("[data-dswhy]"); if (s) { const i = +s.dataset.dswhy; jnOpen("place", { i, tid: S.targetId, pid: S.profile === "custom" ? "custom" : S.profile, sec: "reveal", step: 0 }); }
});
document.addEventListener("asterro:lang", () => { try { dsHero(); } catch (e) { console.error(e); } });
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => dsHero()); else setTimeout(dsHero, 0);

/* ---------------------------------------------------------------- plain-language summary in Explore */
function dsSummary(i, tid) {
  if (i == null || tid === "cross" || !S.res || !S.T[tid] || typeof JE === "undefined") return "";
  const s = S.res.eff[i]; if (!(s >= 0)) return "";
  const L = JE.lens(jnCtx(tid), i, S.weights), rows = L.rows.filter(r => r.s != null && r.s === r.s && (S.weights[r.c] || 0) > 0);
  const th = S.app.thresholds, strong = rows.filter(r => r.s >= th.match).sort((a, b) => b.s - a.s), weak = rows.filter(r => r.s < th.partial).sort((a, b) => a.s - b.s);
  // the overall wording follows the per-condition readings (similar >= 0.85, partial >= 0.60), not a threshold on the score
  const n = rows.length, lvl = n && strong.length * 3 >= n * 2 && !weak.length ? "strong" : n && weak.length * 2 > n ? "weak" : "partial";
  const name = c => esc(tx("crit." + c + ".s"));
  const body = String(S.T[tid].body || "").toLowerCase() === "moon" ? "moon" : "mars";
  return `<div class="ds-sum" data-i18n-done data-dssum="${lvl}" aria-live="polite"><h3>${esc(tx("ds.sum.title"))}</h3>
    <p class="ds-big">${esc(tx("ds.sum.lead", { place: jnPlaceText(i), pct: txPct(s), target: jnTNameText(tid) }))}</p>
    <p>${esc(tx("ds.sum.level." + lvl))}</p>
    <div class="ds-row">${strong.slice(0, 3).map(r => `<span class="ds-pill s">${name(r.c)}</span>`).join("")}${weak.slice(0, 3).map(r => `<span class="ds-pill d">${name(r.c)}</span>`).join("")}</div>
    <p>${strong.length ? esc(tx("ds.sum.strong", { list: txList(strong.slice(0, 3).map(r => tx("crit." + r.c + ".s"))) })) : esc(tx("ds.sum.no_strong"))} ${weak.length ? esc(tx("ds.sum.weak", { list: txList(weak.slice(0, 3).map(r => tx("crit." + r.c + ".s"))) })) : esc(tx("ds.sum.no_weak"))}</p>
    <p>${esc(tx("ds.sum.limits." + body))}</p>
    <button type="button" class="btn-ghost btn-sm ds-more" data-dswhy="${i}">${esc(tx("ds.sum.why"))}</button></div>`;
}
{ const f = viewExplore; viewExplore = function () {
  let h = f.apply(this, arguments);
  try { const card = dsSummary(S.selected, S.targetId); if (card) { const k = h.indexOf('<div class="sec">'); h = k >= 0 ? h.slice(0, k) + `<div class="sec">${card}</div>` + h.slice(k) : card + h; } } catch (e) { console.error(e); }
  return h;
}; }

/* ---------------------------------------------------------------- Terms of Service and Privacy Policy */
const DS_LEGAL = { terms: ["s1", "s2", "s3", "s4", "s5", "s6"], privacy: ["s1", "s2", "s3", "s4", "s5", "s6", "s7"] };
function dsLegalLinks() {
  return `<nav class="ds-legal" aria-label="${esc(tx("ds.legal.nav"))}" data-i18n-done><a href="#terms" data-dslegal="terms">${esc(tx("ds.legal.terms"))}</a><a href="#privacy" data-dslegal="privacy">${esc(tx("ds.legal.privacy"))}</a></nav>`;
}
function dsLegalOpen(kind) {
  if (!DS_LEGAL[kind]) return;
  let d = document.getElementById("ds-legal-dlg");
  if (!d) { d = document.createElement("div"); d.id = "ds-legal-dlg"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "ds-legal-title"); d.setAttribute("data-i18n-done", ""); document.body.appendChild(d); }
  DS.legalOpener = DS.legalOpener || document.activeElement; DS.legal = kind;
  const pre = kind === "terms" ? "ds.tos." : "ds.pp.";
  d.innerHTML = `<div class="ds-legal-box" data-dslegalbox="${kind}"><div class="ds-legal-head"><div><h2 id="ds-legal-title" tabindex="-1">${esc(tx(pre + "title"))}</h2><p class="meta">${esc(tx("ds.legal.updated"))}</p></div>
    <button type="button" class="btn-ghost btn-sm" data-dslegalclose>${esc(tx("ds.legal.close"))}</button></div>
    ${DS_LEGAL[kind].map(k => `<h3>${esc(tx(pre + k + ".h"))}</h3><p>${esc(tx(pre + k + ".p"))}</p>`).join("")}
    <p class="meta">${esc(tx("ds.legal.other"))} <a href="#${kind === "terms" ? "privacy" : "terms"}" data-dslegal="${kind === "terms" ? "privacy" : "terms"}">${esc(tx(kind === "terms" ? "ds.legal.privacy" : "ds.legal.terms"))}</a></p></div>`;
  d.hidden = false; dsNoEmDash(d);
  setTimeout(() => { const t = document.getElementById("ds-legal-title"); if (t) t.focus(); }, 0);
}
function dsLegalClose() {
  const d = document.getElementById("ds-legal-dlg"); if (!d || d.hidden) return;
  d.hidden = true; DS.legal = null;
  if (/^#(terms|privacy)$/.test(location.hash)) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { } }
  const o = DS.legalOpener; DS.legalOpener = null; if (o && o.focus) o.focus();
}
document.addEventListener("click", e => {
  const l = e.target.closest && e.target.closest("[data-dslegal]"); if (l) { e.preventDefault(); try { history.replaceState(null, "", "#" + l.dataset.dslegal); } catch (err) { } dsLegalOpen(l.dataset.dslegal); return; }
  if (e.target.closest && (e.target.closest("[data-dslegalclose]") || e.target.id === "ds-legal-dlg")) dsLegalClose();
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && DS.legal) { e.stopPropagation(); dsLegalClose(); } }, true);
function dsLegalFromHash() { const m = /^#(terms|privacy)$/.exec(location.hash); if (m) dsLegalOpen(m[1]); }
window.addEventListener("hashchange", dsLegalFromHash);
document.addEventListener("asterro:lang", () => { if (DS.legal) dsLegalOpen(DS.legal); });
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(dsLegalFromHash, 300)); else setTimeout(dsLegalFromHash, 300);
/* links in the weight console (present on every view) */
{ const f = renderConsole; renderConsole = function () {
  const r = f.apply(this, arguments);
  try { const side = document.querySelector("#console .con-side"); if (side && !side.querySelector(".ds-legal")) side.insertAdjacentHTML("beforeend", dsLegalLinks()); } catch (e) { console.error(e); }
  return r;
}; }
/* the current view on #app, for view-specific layout (Atlas: globe in the centre) */
{ const f = renderLeft; renderLeft = function () { const r = f.apply(this, arguments); try { document.getElementById("app").dataset.tab = S.tab; } catch (e) { } return r; }; }

/* ---------------------------------------------------------------- no em dash in the rendered interface */
const DS_DASH = /\s*\u2014\s*/g, DS_TICK = /[\u2713\u2714\u2611]\uFE0F?/g, DS_BAD = /[\u2014\u2713\u2714\u2611]/;
function dsDash(t) { return t.replace(DS_DASH, (m) => (/^\s/.test(m) || /\s$/.test(m)) ? " \u2013 " : "\u2013").replace(DS_TICK, "\u25CF"); }
function dsNoEmDash(root) {
  if (!root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { if (DS_BAD.test(n.nodeValue) && !(n.parentNode && /^(SCRIPT|STYLE|CODE|PRE)$/.test(n.parentNode.nodeName))) n.nodeValue = dsDash(n.nodeValue); }
  if (root.querySelectorAll) for (const el of [root, ...root.querySelectorAll("[placeholder],[title],[aria-label]")]) for (const a of ["placeholder", "title", "aria-label"]) { const v = el.getAttribute && el.getAttribute(a); if (v && DS_BAD.test(v)) el.setAttribute(a, dsDash(v)); }
}
(function () {
  // created after the route translator's observer (ui_98), so translation always sees the original text first;
  // our own edits are then taken back from the translator's queue
  const start = () => { document.title = dsDash(document.title); dsNoEmDash(document.body); new MutationObserver(ms => { for (const m of ms) { if (m.type === "attributes") { const v = m.target.getAttribute(m.attributeName); if (v && DS_BAD.test(v)) m.target.setAttribute(m.attributeName, dsDash(v)); } else if (m.type === "characterData") { const n = m.target; if (n.nodeValue && DS_BAD.test(n.nodeValue)) n.nodeValue = dsDash(n.nodeValue); } else for (const x of m.addedNodes) { if (x.nodeType === 3) { if (DS_BAD.test(x.nodeValue)) x.nodeValue = dsDash(x.nodeValue); } else if (x.nodeType === 1) dsNoEmDash(x); } } if (typeof I18R !== "undefined" && I18R.obs) I18R.obs.takeRecords(); }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label"] }); };
  const run = () => setTimeout(start, 0);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
