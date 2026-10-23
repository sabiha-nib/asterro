/* ===== Interface languages for the research routes — hooks =====
 * Translates, in the active language, whatever the research routes draw: the left panel on every tab except Explore
 * (Explore is covered by ui_99_i18n_dom.js), and the Trace / Report / Reproduce sheet. A MutationObserver catches
 * every render, including the asynchronous ones (progress bars, lazy data loads, worker results), so no module needs
 * to know about languages. Our own DOM changes are taken back from the observer's queue and never re-translated. */
const I18R = { obs: null };
function i18rRoots() {
  const r = [];
  const left = document.getElementById("left");
  if (left && typeof S !== "undefined" && S.tab !== "explore") r.push(left);
  const sh = document.getElementById("sheet"); if (sh) r.push(sh);
  return r;
}
function i18rInScope(n) {
  const e = n && (n.nodeType === 1 ? n : n.parentElement); if (!e) return null;
  for (const r of i18rRoots()) if (r.contains(e)) return e;
  return null;
}
function i18rKeepFocus(fn) {
  const a = document.activeElement, s = a && "selectionStart" in a ? [a.selectionStart, a.selectionEnd] : null;
  fn();
  if (a && a !== document.activeElement && a.isConnected) { try { a.focus({ preventScroll: true }); if (s) a.setSelectionRange(s[0], s[1]); } catch (e) { } }
}
function i18rAll() {
  i18rKeepFocus(() => { for (const r of i18rRoots()) i18gTranslate(r); });
  if (I18R.obs) I18R.obs.takeRecords();
}
function i18rObserve() {
  if (I18R.obs || typeof MutationObserver === "undefined") return;
  I18R.obs = new MutationObserver(muts => {
    if (I18N.lang === "en" || I18G.busy) return;
    const targets = new Set();
    for (const m of muts) { const e = i18rInScope(m.target); if (e) targets.add(m.type === "characterData" ? e.parentElement || e : e); }
    if (!targets.size) return;
    const list = [...targets].filter(t => ![...targets].some(o => o !== t && o.contains(t)));
    I18G.busy = true;
    try { i18rKeepFocus(() => { for (const t of list) if (t.isConnected) i18gWalk(t, i18gRoute()); }); }
    catch (e) { console.error(e); }
    finally { I18G.busy = false; I18R.obs.takeRecords(); }
  });
  for (const id of ["left", "sheet"]) { const e = document.getElementById(id); if (e) I18R.obs.observe(e, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: I18G_ATTRS }); }
}
document.addEventListener("asterro:lang", () => { try { i18rObserve(); i18rAll(); } catch (e) { console.error(e); } });
{ const f = setTab; setTab = function () { const r = f.apply(this, arguments); try { i18rAll(); } catch (e) { console.error(e); } return r; }; }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", i18rObserve); else i18rObserve();
