/* ===== ASTERRO V20.1 interface shell (presentation only) =====
 * - a navigation rail on desktop: Home (logo), the five navigation groups, Settings; each opens the V20 navigation or
 *   Settings dialog, so every destination is still the same existing view;
 * - a destination picker for Mars and the Moon built from the published target registry (data/registry.json): real
 *   names, positions, analysis windows, readiness levels and each target's own shaded-relief thumbnail; choosing a
 *   destination calls the existing setTarget / setTab / Atlas code, nothing else;
 * - an "All destinations" button beside the target switch.
 * No score, weight, threshold, target or dataset is changed here. */
const V21 = { reg: null, regErr: null, regLoading: null, body: null, opener: null, open: false };
const V21_GLYPH = {
  home: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="6.5"/><ellipse cx="16" cy="16" rx="14" ry="5" transform="rotate(-24 16 16)" opacity=".6"/></svg>',
  discover: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 2.6 14.6 0 17M12 3.5c-2.6 2.4-2.6 14.6 0 17"/></svg>',
  analyze: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/></svg>',
  plan: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="17" r="2"/><circle cx="12" cy="8" r="2"/><circle cx="19" cy="14" r="2"/><path d="M6.4 15.6 10.6 9.4M13.6 9.2l4 3.6"/></svg>',
  evidence: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8.5L18 7v13.5H6z"/><path d="M9 11h6M9 14.5h6M9 18h4"/></svg>',
  trust: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6.5" rx="7" ry="2.8"/><path d="M5 6.5v11c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-11M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
};
function v21T(k, o) { return tx("v21." + k, o); }

/* ---------------------------------------------------------------- rail */
function v21Rail() {
  let r = document.getElementById("v21-rail");
  if (!r) { r = document.createElement("nav"); r.id = "v21-rail"; r.setAttribute("data-i18n-done", ""); document.body.prepend(r); }
  r.setAttribute("aria-label", v20T("nav.aria"));
  const cur = typeof v20Current === "function" ? v20Current() : null;
  const grp = (V20_NAV.find(([, items]) => items.includes(cur)) || [null])[0];
  r.innerHTML = `<button type="button" class="v21-rb v21-logo" data-v20home="1" aria-label="${esc(v20T("home"))}">${V21_GLYPH.home}</button>`
    + V20_NAV.map(([g]) => `<button type="button" class="v21-rb" data-v21rail="${g}" aria-current="${g === grp}" aria-haspopup="dialog">${V21_GLYPH[g]}<span>${esc(v20T("g." + g))}</span></button>`).join("")
    + `<span class="v21-sp"></span><button type="button" class="v21-rb" data-v21rail="settings" aria-haspopup="dialog">${V21_GLYPH.settings}<span>${esc(v20T("settings"))}</span></button>`;
}
function v21OpenGroup(g) {
  v20OpenSheet("nav");
  setTimeout(() => {
    const sec = document.querySelector(`#v20-nav [data-v20group="${g}"]`); if (!sec) return;
    const sh = document.querySelector("#v20-nav .v20-sheet"); if (sh) sh.scrollTop += sec.getBoundingClientRect().top - sh.getBoundingClientRect().top - 60;
    const b = sec.querySelector("[data-v20go]"); if (b) b.focus();
  }, 30);
}

/* ---------------------------------------------------------------- destination picker */
function v21RegLoad() {
  if (V21.reg || V21.regLoading) return V21.regLoading;
  V21.regErr = null;
  V21.regLoading = fetch("data/registry.json").then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(j => { if (!j || !Array.isArray(j.targets)) throw new Error("format"); V21.reg = j; })
    .catch(e => { V21.regErr = String(e.message || e); })
    .finally(() => { V21.regLoading = null; if (V21.open) v21Render(); });
  return V21.regLoading;
}
function v21Body() { const t = S.T && S.T[S.targetId]; return V21.body || (S.targetId === "cross" ? "Both" : t ? t.body : "Mars"); }
function v21BodyOf(r) { return r.body && typeof r.body === "object" ? r.body.name : r.body; }
function v21Explorable(r) { return r.legacy || (r.readiness && r.readiness.level >= 3); }
function v21Card(r) {
  const L = r.location || {}, lv = r.readiness || {}, cur = S.targetId === r.id;
  const thumb = r.id === "mars_jezero" ? "data/thumb_jezero_mola.png" : r.id === "moon_south_pole" ? "data/thumb_southpole_lola.png" : (r.thumbnail || "");
  const lat = L.latitude != null ? L.latitude : L.lat, lon = L.longitude_east != null ? L.longitude_east : L.lon_east;
  const ll = lat != null ? v21T("coords", { lat: v21T(lat < 0 ? "lat_s" : "lat_n", { v: txNum(Math.abs(lat), 2) + "°" }), lon: v21T("lon_e", { v: txNum(((lon % 360) + 360) % 360, 2) + "°" }) }) : "";
  const ex = v21Explorable(r);
  return `<li class="v21-d" data-v21d="${esc(r.id)}"${cur ? ' aria-current="true"' : ""}>
    ${thumb ? `<img src="${esc(thumb)}" alt="${esc(r.thumbnail_caption || r.name)}" loading="lazy">` : `<span></span>`}
    <div><h3>${keep(r.name)}</h3>
      <p class="v21-meta">${esc(ll)}${L.window_km ? " · " + esc(v21T("window", { km: txNum(L.window_km, 1) })) : ""}</p>
      <p>${lv.level != null ? `<span class="v21-lv">${esc(v21T("level", { n: txInt(lv.level) }))}</span>` : ""}${cur ? esc(v21T("current")) : ""}</p>
      <div class="v21-acts"><button type="button" class="v21-go" data-v21go="${esc(r.id)}"${ex ? "" : " disabled"}>${esc(v21T(ex ? "explore" : "atlas_only"))}</button><button type="button" data-v21atlas="${esc(r.id)}">${esc(v21T("atlas"))}</button></div></div></li>`;
}
function v21Render() {
  const d = document.getElementById("v21-dest"); if (!d) return;
  const body = v21Body(), tabs = [["Mars", "mars"], ["Moon", "moon"], ["Both", "both"]];
  let list;
  if (body === "Both") list = `<ul class="v21-dl"><li class="v21-d"${S.targetId === "cross" ? ' aria-current="true"' : ""}><img src="data/thumb_jezero_mola.png" alt=""><div><h3>${esc(v21T("both"))}</h3><p>${esc(v21T("both_d"))}</p><div class="v21-acts"><button type="button" class="v21-go" data-v21go="cross">${esc(v21T("explore"))}</button></div></div></li></ul>`;
  else if (!V21.reg) { if (!V21.regErr) v21RegLoad(); list = `<p class="v21-dp-note" role="status">${esc(v21T(V21.regErr ? "error" : "loading"))}</p>`; }
  else {
    const ts = V21.reg.targets.filter(r => v21BodyOf(r) === body).sort((a, b) => (b.legacy - a.legacy) || ((b.readiness || {}).level || 0) - ((a.readiness || {}).level || 0) || a.name.localeCompare(b.name));
    list = `<p class="v21-dp-note">${esc(v21T("count", { n: txInt(ts.length) }))}</p><ul class="v21-dl">${ts.map(v21Card).join("")}</ul>`;
  }
  const ae = document.activeElement, refocus = ae && (ae.id === "v21-dest-title" || ae === document.body);
  d.innerHTML = `<div class="v21-dp" role="document"><div class="v21-dp-h"><h2 id="v21-dest-title" tabindex="-1">${esc(v21T("title_a"))} <span class="v20-serif">${esc(v21T("title_b"))}</span></h2><button type="button" class="v20-close" data-v21close>${esc(v20T("close"))}</button></div>
    <div class="v21-dp-tabs" role="tablist" aria-label="${esc(v21T("title_a") + " " + v21T("title_b"))}">${tabs.map(([b, k]) => `<button type="button" role="tab" data-v21body="${b}" aria-selected="${b === body}">${esc(v21T(k))}</button>`).join("")}</div>
    <p class="v21-dp-note">${esc(v21T("note"))}</p>${list}</div>`;
  if (refocus && V21.open) { const t = document.getElementById("v21-dest-title"); if (t) t.focus(); }
}
function v21OpenDest() {
  if (typeof v20Close === "function") v20Close(true);
  let d = document.getElementById("v21-dest");
  if (!d) { d = document.createElement("div"); d.id = "v21-dest"; d.hidden = true; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "v21-dest-title"); d.setAttribute("data-i18n-done", ""); document.body.appendChild(d); }
  V21.opener = document.activeElement; V21.open = true; V21.body = null;
  v21Render(); d.hidden = false; document.body.classList.add("v20-lock");
  setTimeout(() => { const t = document.getElementById("v21-dest-title"); if (t) t.focus(); }, 0);
}
function v21CloseDest(silent) {
  const d = document.getElementById("v21-dest"); if (!d || d.hidden) return;
  d.hidden = true; V21.open = false; document.body.classList.remove("v20-lock");
  if (!silent) { const o = V21.opener && V21.opener !== document.body && document.contains(V21.opener) && V21.opener.offsetParent !== null ? V21.opener : document.getElementById("v21-all"); if (o) o.focus(); }
}
function v21WaitTarget(id, fn) { const t0 = Date.now(), iv = setInterval(() => { const ok = S.T && S.T[id]; if (ok || Date.now() - t0 > 30000) { clearInterval(iv); if (ok) fn(); } }, 150); }
function v21Go(id) {
  v21CloseDest(true);
  v20Need(() => {
    if (id === "cross" || TARGET_IDS.includes(id)) { setTarget(id); setTab("explore"); return; }
    v21WaitTarget(id, () => { if (typeof a4ExploreOpen === "function") a4ExploreOpen(id); else { setTarget(id); setTab("explore"); } });
  });
}
function v21Atlas(id) {
  v21CloseDest(true);
  v20Need(() => { if (typeof A3 !== "undefined") { A3.active = id; A3.view = "target"; } setTab("atlas"); });
}

/* ---------------------------------------------------------------- header: all destinations */
function v21Header() {
  const ctl = document.querySelector("header.bar .target-ctl"); if (!ctl) return;
  let b = document.getElementById("v21-all");
  if (!b) { b = document.createElement("button"); b.type = "button"; b.id = "v21-all"; b.className = "v21-allbtn"; b.setAttribute("aria-haspopup", "dialog"); b.setAttribute("data-i18n-done", ""); ctl.insertAdjacentElement("afterend", b); }
  b.textContent = v21T("all");
}

/* ---------------------------------------------------------------- events */
document.addEventListener("click", e => {
  const t = e.target; if (!t || !t.closest) return;
  const rb = t.closest("[data-v21rail]"); if (rb) { const g = rb.dataset.v21rail; if (g === "settings") v20OpenSheet("set"); else v21OpenGroup(g); return; }
  if (t.closest("#v21-all")) { v21OpenDest(); return; }
  if (t.closest("[data-v21close]") || t.id === "v21-dest") { v21CloseDest(); return; }
  const tb = t.closest("[data-v21body]"); if (tb) { V21.body = tb.dataset.v21body; v21Render(); const n = document.querySelector(`[data-v21body="${V21.body}"]`); if (n) n.focus(); return; }
  const go = t.closest("[data-v21go]"); if (go && !go.disabled) { v21Go(go.dataset.v21go); return; }
  const at = t.closest("[data-v21atlas]"); if (at) { v21Atlas(at.dataset.v21atlas); return; }
});
document.addEventListener("keydown", e => {
  if (!V21.open) return;
  const d = document.getElementById("v21-dest"); if (!d || d.hidden) return;
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); v21CloseDest(); return; }
  if (e.key === "Tab") {
    const f = [...d.querySelectorAll("button:not([disabled]),[tabindex='-1']")].filter(n => n.offsetParent !== null); if (!f.length) return;
    const a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }
  if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && e.target.matches && e.target.matches("[data-v21body]")) {
    const all = [...d.querySelectorAll("[data-v21body]")], i = all.indexOf(e.target), n = all[(i + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
    V21.body = n.dataset.v21body; v21Render(); const m = d.querySelector(`[data-v21body="${V21.body}"]`); if (m) m.focus(); e.preventDefault();
  }
}, true);
/* keep the rail's current group and the header button in step with the views and the language */
{ const f = renderLeft; renderLeft = function () { const r = f.apply(this, arguments); try { v21Rail(); } catch (e) { } return r; }; }
{ const f = setLang; setLang = function () { const r = f.apply(this, arguments); try { v21Rail(); v21Header(); if (V21.open) v21Render(); } catch (e) { console.error(e); } return r; }; }
{ const f = v20Home; v20Home = function () { const r = f.apply(this, arguments); try { v21Rail(); } catch (e) { } return r; }; }
(function v21Boot() {
  const go = () => { v21Rail(); v21Header(); let n = 0; const iv = setInterval(() => { v21Header(); v21Rail(); if (++n > 12) clearInterval(iv); }, 500); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else setTimeout(go, 0);
})();
