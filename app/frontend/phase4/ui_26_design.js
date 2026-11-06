/* ===== Design layer: welcoming landing, plain-language summary, Simple / Advanced view =====
 * Presentation only. Every number comes from the existing engine (S.res, JE.lens); nothing here changes a score.
 *   - Landing: one clear promise and three ways in (Explore Earth · Discover an analogue · Compare with the Moon or
 *     Mars). They trigger the existing actions; the original buttons stay on the page as quieter links.
 *   - Explore: a plain-language card for the selected place (how similar, strongest similarities, important
 *     differences, where every Earth analogue falls short), with the full analysis one click away.
 *   - Simple / Advanced: Simple (the default) keeps every weight slider but hides the technical detail around it
 *     (status tags, share of weight, target / Earth position track); Advanced shows everything, as before. The choice
 *     is remembered in this browser. */
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
  const ico = { explore: "◐", discover: "✦", compare: "⇄" };
  acts.innerHTML = ["explore", "discover", "compare"].map(a => `<button type="button" class="ds-act" data-dsact="${a}"><span class="ds-ico" aria-hidden="true">${ico[a]}</span><b>${esc(tx("ds.hero." + a))}</b><span>${esc(tx("ds.hero." + a + "_d"))}</span></button>`).join("");
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
