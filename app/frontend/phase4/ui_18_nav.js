/* ===== Header navigation that fits every language and width =====
 * The nine views keep their tab buttons, ids, order and behaviour, and every tab stays visible and clickable. When
 * the labels of the active language do not fit beside the brand, targets, language control and search, the tab bar
 * moves to its own full-width row under them (the layout the baseline already uses below 1180 px); if a row is still
 * too narrow (phones), the tabs wrap onto a second line. Nothing scrolls sideways and no label is shortened.
 * Re-measured on resize, on a language switch and when the header's contents change (the Atlas quick-switch appears
 * after the registry loads). */
const NAV = { ro: null, row: false, raf: 0 };
function navFit() {
  const bar = document.querySelector("header.bar"), nav = bar && bar.querySelector("nav.tabs"); if (!nav) return;
  const wide = window.matchMedia("(min-width: 1181px)").matches;
  bar.classList.remove("nav-row");
  NAV.row = false;
  if (wide && nav.scrollWidth > nav.clientWidth + 1) { bar.classList.add("nav-row"); NAV.row = true; }
  const app = document.getElementById("app"); if (app) app.classList.toggle("nav-row2", NAV.row);
  bar.dataset.navRows = String(navRows(nav));
}
function navRows(nav) { const tops = new Set([...nav.querySelectorAll("button[data-tab]")].map(b => Math.round(b.getBoundingClientRect().top))); return tops.size; }
function navSchedule() { if (NAV.raf) return; NAV.raf = requestAnimationFrame(() => { NAV.raf = 0; navFit(); }); }
(function navBoot() {
  const go = () => {
    const bar = document.querySelector("header.bar"); if (!bar) return;
    if (typeof ResizeObserver !== "undefined") { NAV.ro = new ResizeObserver(navSchedule); NAV.ro.observe(bar); for (const c of bar.children) NAV.ro.observe(c); }
    if (typeof MutationObserver !== "undefined") new MutationObserver(navSchedule).observe(bar, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", navSchedule);
    document.addEventListener("asterro:lang", navSchedule);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(navSchedule);
    navFit();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else setTimeout(go, 0);
})();
/* arrow keys move between tabs (the baseline has no tab-bar key handling; Enter / Space activate, as before) */
document.addEventListener("keydown", e => {
  const t = e.target; if (!t || !t.matches || !t.matches("nav.tabs button[data-tab]") || (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End")) return;
  const all = [...document.querySelectorAll("nav.tabs button[data-tab]")], i = all.indexOf(t);
  const n = e.key === "Home" ? all[0] : e.key === "End" ? all[all.length - 1] : all[(i + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
  if (n && n !== t) { e.preventDefault(); n.focus(); }
});
/* the header language control: ISO code for the Latin-script languages, the language's own name for বাংলা (no
 * abbreviation of a script the reader may not expect); the full native name is the control's label and tooltip */
{ const f = i18nHeader; i18nHeader = function () { const r = f.apply(this, arguments); try { const w = document.getElementById("i18n-hdr"), c = w && w.querySelector(".i18n-code"); const m = I18N.langs[I18N.lang] || {}; if (c) { c.textContent = I18N.lang === "bn" ? m.name : (m.code || I18N.lang.toUpperCase()); c.setAttribute("lang", m.htmlLang || I18N.lang); } const s = w && w.querySelector("select"); if (s) s.setAttribute("aria-label", tx("lang.label") + ": " + (m.name || "")); } catch (e) { } return r; }; }
try { i18nHeader(); } catch (e) { }
/* a toast written in the previous language is not left on screen after a language switch */
document.addEventListener("asterro:lang", () => { const t = document.getElementById("jl-toast"); if (t) { clearTimeout(t._h); t.classList.remove("on"); } });
/* below 1181 px the expedition chip joins the globe controls' row (it wraps with them) instead of floating over them */
function navChipPlace() {
  const c = document.getElementById("jl-chip"), top = document.querySelector("#viewport .vp-top"), vp = document.getElementById("viewport"); if (!c || !top || !vp) return;
  const narrow = window.matchMedia("(max-width: 1180px)").matches;
  if (narrow) { if (c.parentElement !== top) top.appendChild(c); return; }
  if (c.parentElement !== vp) vp.appendChild(c);
  // wide screens: the chip floats at the top right unless the (wrapped) controls reach it — then it joins their row
  const r = c.getBoundingClientRect(), hit = [...top.querySelectorAll("button, select")].some(b => { const q = b.getBoundingClientRect(); return q.width && r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom; });
  if (hit) { top.appendChild(c); c.classList.add("in-row"); } else c.classList.remove("in-row");
}
document.addEventListener("asterro:lang", () => requestAnimationFrame(() => { try { navChipPlace(); } catch (e) { } }));
if (typeof jlChip === "function") { const f = jlChip; jlChip = function () { const r = f.apply(this, arguments); try { navChipPlace(); } catch (e) { } return r; }; }
window.addEventListener("resize", () => { try { navChipPlace(); } catch (e) { } });
