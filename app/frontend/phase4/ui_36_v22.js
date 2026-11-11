/* ===== ASTERRO V20.3 application shell (presentation only) =====
 * - one persistent deep-navy sidebar: the logo (Home), five sections, the selected section's own submenu only, and
 *   Settings / About at the bottom; it collapses to a rail on desktop, is a rail with a flyout submenu on tablets and a
 *   drawer on phones. The ten view buttons (nav.tabs, ids and text unchanged) live inside the submenus.
 * - five section workspaces: Discover is the globe itself; Analyze, Plan, Evidence and Data & Trust open their own
 *   dashboards built from the engine's current results and the published records (nothing invented).
 * - views without a geographic task (Lab, Compare, Scenarios, Data, Method) use the full workspace without the globe.
 * - the destination picker becomes a map-led explorer on each body's own shaded relief (MOLA / LOLA basemaps).
 * - the globe's base imagery (NASA Blue Marble) is shown in its natural colours; the similarity field is unchanged.
 * No score, weight, threshold, target, dataset, route or stored record is changed here. */
const V22 = { sec: "discover", dash: null, drawer: false, flyout: false, pick: null, KEY: "asterro.v22.side",
  collapsed: (() => { try { return localStorage.getItem("asterro.v22.side") === "collapsed"; } catch (e) { return false; } })() };
const V22_SEC = {
  discover: [["go", "home"], ["tab", "explore"], ["tab", "discover"], ["go", "targets"], ["tab", "atlas"]],
  analyze: [["tab", "lab"], ["tab", "local"], ["tab", "compare"], ["go", "lens"], ["go", "character"], ["go", "robust"]],
  plan: [["go", "portfolio"], ["tab", "trajectory"], ["go", "profiles"], ["tab", "scenarios"]],
  evidence: [["go", "passport"], ["go", "trace"], ["go", "reproduce"], ["go", "reports"], ["go", "journal"]],
  trust: [["tab", "data"], ["go", "sources"], ["go", "gaps"], ["go", "trustc"], ["tab", "method"]],
};
const V22_TABLBL = { explore: "globe", discover: "discovery", atlas: "atlas", lab: "lab", local: "local", compare: "compare", trajectory: "trajectory", scenarios: "scenarios", data: "catalogue", method: "method" };
const V22_SOLO = ["lab", "scenarios", "data", "method"];
const V22_GO_SEC = { lens: "analyze", character: "analyze", robust: "analyze", portfolio: "plan", profiles: "plan", passport: "evidence", trace: "evidence", reproduce: "evidence", reports: "evidence", journal: "evidence", sources: "trust", gaps: "trust", trustc: "trust", targets: "discover", home: "discover", globe: "discover", discovery: "discover", atlas: "discover" };
function v22T(k, o) { return tx("v22." + k, o); }
function v22SecOf(t) { for (const [s, items] of Object.entries(V22_SEC)) if (items.some(([k, id]) => k === "tab" && id === t)) return s; return null; }
function v22Mode() { const w = innerWidth; return w <= 760 ? "phone" : w <= 1180 ? "tablet" : "desktop"; }

/* ---------------------------------------------------------------- sidebar */
function v22Side() {
  let s = document.getElementById("v22-side");
  if (!s) {
    s = document.createElement("aside"); s.id = "v22-side"; s.setAttribute("data-i18n-done", "");
    s.innerHTML = `<div class="v22-top"><button type="button" class="v22-logo" data-v20home="1">${V21_GLYPH.home}<b>ASTERRO</b></button><button type="button" class="v22-col" id="v22-collapse"></button></div>
      <nav class="v22-secs"></nav><div id="v22-sub" role="group"></div><div class="v22-foot"></div>`;
    document.body.prepend(s);
    const tabs = document.querySelector("nav.tabs"); if (tabs) s.querySelector("#v22-sub").appendChild(tabs);
  }
  const mode = v22Mode(), sec = V22.sec;
  s.dataset.sec = sec; s.dataset.mode = mode;
  document.body.classList.toggle("v22-collapsed", mode === "desktop" && V22.collapsed);
  document.body.classList.toggle("v22-drawer", mode === "phone" && V22.drawer);
  document.body.classList.toggle("v22-flyout", mode !== "phone" && V22.flyout);
  s.querySelector(".v22-logo").setAttribute("aria-label", v20T("home"));
  const col = s.querySelector("#v22-collapse"); col.textContent = ""; col.setAttribute("aria-label", v22T(V22.collapsed ? "expand" : "collapse")); col.setAttribute("aria-expanded", String(!V22.collapsed));
  col.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${V22.collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"}"/></svg>`;
  const cur = typeof v20Current === "function" ? v20Current() : null;
  s.querySelector(".v22-secs").setAttribute("aria-label", v20T("nav.aria"));
  s.querySelector(".v22-secs").innerHTML = Object.keys(V22_SEC).map(g => `<button type="button" class="v22-sb" data-v22sec="${g}" aria-current="${g === sec}" aria-controls="v22-sub" title="${esc(v20T("g." + g))}">${V21_GLYPH[g]}<span>${esc(v20T("g." + g))}</span></button>`).join("");
  const sub = s.querySelector("#v22-sub"); sub.setAttribute("aria-label", v20T("g." + sec));
  [...sub.querySelectorAll(":scope > .v22-gen")].forEach(n => n.remove());
  const gen = (html, order) => { const d = document.createElement("div"); d.className = "v22-gen"; d.innerHTML = html; [...d.children].forEach(c => { c.style.order = order; }); sub.appendChild(d); return d; };
  gen(`<p class="v22-subt">${esc(v20T("g." + sec))}</p>`, -2);
  if (sec !== "discover") gen(`<button type="button" class="v22-it" data-v22dash="${sec}" aria-current="${V22.dash === sec}">${esc(v22T("over"))}</button>`, -1);
  V22_SEC[sec].forEach(([k, id], n) => { if (k === "go") gen(`<button type="button" class="v22-it" data-v20go="${id}" aria-current="${!V22.dash && cur === id}">${esc(v20T("d." + id))}</button>`, n); });
  for (const b of document.querySelectorAll("#v22-sub nav.tabs button[data-tab]")) {
    const t = b.dataset.tab, sc = v22SecOf(t), n = sc ? V22_SEC[sc].findIndex(([k, id]) => k === "tab" && id === t) : 99;
    b.style.order = n; b.classList.add("v22-it"); b.classList.toggle("v22-off", sc !== sec);
  }
  s.querySelector(".v22-foot").innerHTML = `<button type="button" class="v22-sb" data-v22set="set">${V21_GLYPH.settings}<span>${esc(v20T("settings"))}</span></button><button type="button" class="v22-sb" data-v22set="about"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v6M12 7.5v.5"/></svg><span>${esc(v22T("about"))}</span></button>`;
  let m = document.getElementById("v22-menu");
  if (!m) { const bar = document.querySelector("header.bar"); m = document.createElement("button"); m.type = "button"; m.id = "v22-menu"; m.setAttribute("aria-controls", "v22-side"); m.setAttribute("data-i18n-done", ""); if (bar) bar.prepend(m); }
  m.innerHTML = `${V20_ICON.menu}<span class="v20-lbl">${esc(v20T(V22.sec ? "g." + V22.sec : "menu"))}</span>`; m.setAttribute("aria-expanded", String(V22.drawer)); m.setAttribute("aria-label", v20T("menu"));
  const app = document.getElementById("app");
  setTimeout(v22Offset, 0);
  if (app) { app.classList.toggle("v22-solo", !app.classList.contains("is-hero") && !V22.dash && V22_SOLO.includes(S.tab)); app.classList.toggle("v22-dash-on", !!V22.dash); app.dataset.v22section = sec; }
}
function v22CloseFloat() { if (V22.drawer || V22.flyout) { V22.drawer = false; V22.flyout = false; v22Side(); } }

/* ---------------------------------------------------------------- dashboards (Analyze, Plan, Evidence, Data & Trust) */
function v22Dash(sec) {
  V22.sec = sec; V22.dash = sec;
  let d = document.getElementById("v22-dash");
  const stage = document.querySelector("main.stage"); if (!stage) return;
  if (!d) { d = document.createElement("section"); d.id = "v22-dash"; d.setAttribute("data-i18n-done", ""); d.setAttribute("tabindex", "-1"); stage.appendChild(d); }
  const app = document.getElementById("app"); if (app) app.classList.remove("is-hero");
  d.hidden = false; d.dataset.sec = sec; d.setAttribute("aria-labelledby", "v22-dash-h");
  if (!S.searched) { d.innerHTML = `<div class="v22-d"><p class="v22-lead" role="status">${esc(v22T("loading"))}</p></div>`; v22Side(); v20Need(() => { if (V22.dash === sec) v22Dash(sec); }); return; }
  // the search flag can be set a moment before the ranked list exists (slow first load); wait for it rather than draw an empty chart
  if (sec !== "trust" && !v22Top(1).length && (V22.wait = (V22.wait || 0) + 1) <= 40) { d.innerHTML = `<div class="v22-d"><p class="v22-lead" role="status">${esc(v22T("loading"))}</p></div>`; v22Side(); setTimeout(() => { if (V22.dash === sec) v22Dash(sec); }, 250); return; }
  V22.wait = 0;
  try { d.innerHTML = `<div class="v22-d v22-d-${sec}">${v22DashHead(sec)}${V22_DASH[sec]()}</div>`; } catch (e) { console.error(e); d.innerHTML = `<div class="v22-d"><p class="v22-lead">${esc(e.message)}</p></div>`; }
  if (typeof dsNoEmDash === "function") dsNoEmDash(d);
  v22Side(); d.scrollTop = 0;
}
function v22CloseDash() { const d = document.getElementById("v22-dash"); if (d) d.hidden = true; const was = V22.dash; V22.dash = null; if (was) try { v22Side(); } catch (e) { } }
function v22DashHead(sec) { return `<header class="v22-dh"><p class="v22-eye">${esc(v20T("g." + sec))}</p><h1 id="v22-dash-h">${esc(v22T(sec + ".a"))} <span class="v20-serif">${esc(v22T(sec + ".b"))}</span></h1><p class="v22-lead">${esc(v22T(sec + ".lead"))}</p></header>`; }
function v22Dest(sec) {
  return `<nav class="v22-dl" aria-label="${esc(v22T("dest"))}"><p class="v22-h3">${esc(v22T("dest"))}</p><ul>${V22_SEC[sec].map(([k, id]) => {
    const key = k === "tab" ? V22_TABLBL[id] : id;
    return `<li><button type="button" class="v22-row" ${k === "tab" ? `data-v22tab="${id}"` : `data-v20go="${id}"`}><b>${esc(v20T("d." + key))}</b><span>${esc(v20T("d." + key + "_d"))}</span></button></li>`;
  }).join("")}</ul></nav>`;
}
function v22Pct(x) { return txNum(100 * x, 1) + " %"; }
function v22Top(n) { return (S.res && S.res.distinct || []).slice(0, n); }
function v22TName() { return typeof jnTName === "function" ? jnTName(S.targetId === "cross" ? "mars_jezero" : S.targetId) : (TNAME[S.targetId] || S.targetId); }
const V22_DASH = {
  analyze() {
    const top = v22Top(8), mx = Math.max(...top.map(i => S.res.eff[i]), 0.0001), tid = S.targetId === "cross" ? "mars_jezero" : S.targetId, T = S.T[tid] || {};
    const bars = top.map((i, k) => `<li><button type="button" class="v22-bar" data-v22sel="${i}"><span class="v22-bn">${txInt(k + 1)}</span><span class="v22-bl">${jnPlace(i)}</span><span class="track"><span class="fill" style="width:${(100 * S.res.eff[i] / mx).toFixed(1)}%"></span></span><b>${esc(v22Pct(S.res.eff[i]))}</b></button></li>`).join("");
    const dims = S.critIds.map(c => { const st = (T.status || {})[c] || "–", w = S.weights ? S.weights[c] : null;
      return `<li><span>${esc(tx("crit." + c + ".short"))}</span><span class="v22-st v22-st-${esc(String(st).toLowerCase())}">${keep(st)}</span><span class="v22-w">${esc(v22T("weight", { w: txNum(w == null ? 1 : +w, 2) }))}</span></li>`; }).join("");
    return `<div class="v22-split"><section class="v22-panel"><h2 class="v22-h3">${esc(v22T("analyze.top"))}</h2><p class="v22-note">${esc(v22T("analyze.top_d"))}</p><ol class="v22-bars">${bars}</ol></section>
      <section class="v22-panel"><h2 class="v22-h3">${esc(v22T("analyze.dims", { t: v22TName() }))}</h2><ul class="v22-dims">${dims}</ul><p class="v22-note">${esc(v22T("analyze.dims_d"))}</p></section></div>${v22Dest("analyze")}`;
  },
  plan() {
    const tid = S.targetId === "cross" ? "mars_jezero" : S.targetId, P = S.app.profiles || {}, pids = Object.keys(P), top = v22Top(8);
    const res = pids.map(pid => { const w = P[pid].weights || P[pid]; try { return simFor(tid, w).eff; } catch (e) { return null; } });
    const head = `<tr><th scope="col">${esc(v22T("plan.site"))}</th>${pids.map(pid => `<th scope="col">${esc(tx("profile." + pid))}</th>`).join("")}</tr>`;
    const rows = top.map(i => `<tr><th scope="row">${jnPlace(i)}</th>${res.map(e => { const v = e ? e[i] : null; return `<td class="v22-hm" style="--v:${v == null ? 0 : Math.max(0, Math.min(1, v)).toFixed(3)}"><span>${v == null ? "–" : esc(txNum(100 * v, 0))}</span></td>`; }).join("")}</tr>`).join("");
    return `<div class="v22-plan"><section class="v22-panel v22-wide"><h2 class="v22-h3">${esc(v22T("plan.matrix"))}</h2><p class="v22-note">${esc(v22T("plan.matrix_d", { t: v22TName() }))}</p>
      <div class="v22-tw"><table class="v22-matrix" data-scale><thead>${head}</thead><tbody>${rows}</tbody></table></div></section>${v22Dest("plan")}</div>`;
  },
  evidence() {
    const i = v22Top(1)[0], A = S.app, man = typeof V9X !== "undefined" && V9X.man, jl = typeof JL !== "undefined" ? Object.keys(JL.marks || {}).length : 0;
    const an = typeof V9X !== "undefined" ? (V9X.analyses || []).length : 0, pl = typeof liSaved === "function" ? liSaved().length : 0;
    const hashes = Object.entries(A.file_hashes || {}).map(([f, h]) => [f, String(h).slice(0, 16) + "…"]);
    const prov = [[v22T("ev.algo"), esc(A.algorithm_version)], [v22T("ev.stack"), `<span class="hash">${esc(String(A.stack && A.stack.sha256 || "").slice(0, 16))}…</span>`], ...hashes.map(([f, h]) => [f, `<span class="hash">${esc(h)}</span>`]), [v22T("ev.cube"), man ? `<span class="hash">${esc(man.sha256.slice(0, 16))}…</span>` : esc(v20T("set.v_none"))]];
    return `<div class="v22-ev"><section class="v22-panel v22-doc"><h2 class="v22-h3">${esc(v22T("ev.preview"))}</h2>
        ${i != null ? `<p class="v22-big">${jnPlace(i)}</p><p class="v22-score">${esc(v22Pct(S.res.eff[i]))}</p><p class="v22-note">${esc(v22T("ev.preview_d", { t: v22TName() }))}</p>` : ""}
        <h2 class="v22-h3">${esc(v22T("ev.records"))}</h2><dl class="v22-kv"><dt>${esc(v22T("ev.journal"))}</dt><dd>${esc(txInt(jl))}</dd><dt>${esc(v22T("ev.analyses"))}</dt><dd>${esc(txInt(an))}</dd><dt>${esc(v22T("ev.places"))}</dt><dd>${esc(txInt(pl))}</dd></dl></section>
      <section class="v22-panel"><h2 class="v22-h3">${esc(v22T("ev.prov"))}</h2><dl class="v22-kv">${prov.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl><p class="v22-note">${esc(v22T("ev.prov_d"))}</p></section></div>${v22Dest("evidence")}`;
  },
  trust() {
    const inv = typeof V9X !== "undefined" && V9X.inv;
    if (!inv && typeof v9xInventory === "function" && !V22.invLoading) { V22.invLoading = fetch("data/v19/env/inventory.json").then(r => r.json()).then(j => { V22.inv = j; }).catch(() => { }).finally(() => { if (V22.dash === "trust") v22Dash("trust"); }); }
    const I = inv || V22.inv, A = S.app, th = A.thresholds || {};
    let invH = `<p class="v22-note" role="status">${esc(v22T("loading"))}</p>`;
    if (I) {
      const order = ["CACHED", "INTEGRATED", "REQUIRES_AUTHENTICATION", "BLOCKED", "NOT_INVESTIGATED"].filter(k => I.counts[k]);
      invH = `<div class="v22-stack" data-scale>${order.map(k => `<span class="v22-seg v22-s-${k.toLowerCase()}" style="flex:${I.counts[k]}" title="${esc(tx("v19x.st." + k))}"></span>`).join("")}</div>
        <ul class="v22-leg">${order.map(k => `<li><i class="v22-s-${k.toLowerCase()}"></i>${esc(tx("v19x.st." + k))} <b>${esc(txInt(I.counts[k]))}</b></li>`).join("")}</ul>
        <p class="v22-note">${esc(v22T("tr.nasa", { n: txInt(I.nasa), m: txInt(I.n - I.nasa), t: txInt(I.n) }))}</p>`;
    }
    const ds = (A.datasets || []).map(d => `<tr><th scope="row">${keep(d.dataset)}</th><td>${keep(d.provider)}</td><td>${keep(d.role)}</td></tr>`).join("");
    const rules = [["tr.match", txNum(th.match, 2)], ["tr.partial", txNum(th.partial, 2)], ["tr.cov", txNum(100 * (th.min_coverage != null ? th.min_coverage : 0.8), 0) + " %"], ["tr.sep", txInt(th.distinct_sep_km)]];
    return `<section class="v22-panel v22-wide"><h2 class="v22-h3">${esc(v22T("tr.inv"))}</h2>${invH}</section>
      <div class="v22-split v22-split-r"><section class="v22-panel"><h2 class="v22-h3">${esc(v22T("tr.engine"))}</h2><div class="v22-tw"><table class="v22-tbl"><tbody>${ds}</tbody></table></div></section>
      <section class="v22-panel"><h2 class="v22-h3">${esc(v22T("tr.rules"))}</h2><ul class="v22-rules">${rules.map(([k, v]) => `<li>${esc(v22T(k, { v }))}</li>`).join("")}</ul><p class="v22-note">${esc(tx("ui.disclaimer"))}</p></section></div>${v22Dest("trust")}`;
  },
};

/* ---------------------------------------------------------------- destination explorer (replaces the V20.1 card list) */
function v22BodyMap(body, ts) {
  const img = body === "Mars" ? "data/phase3/basemap_mars.png" : "data/phase3/basemap_moon.png";
  const pts = ts.map(r => { const L = r.location || {}; let lon = L.longitude_east != null ? L.longitude_east : L.lon_east, lat = L.latitude != null ? L.latitude : L.lat; if (lat == null) return ""; lon = ((lon + 180) % 360 + 360) % 360 - 180;
    return `<button type="button" class="v22-pin${V22.pick === r.id ? " on" : ""}${S.targetId === r.id ? " cur" : ""}" data-v22pick="${esc(r.id)}" style="left:${((lon + 180) / 360 * 100).toFixed(2)}%;top:${((90 - lat) / 180 * 100).toFixed(2)}%" aria-label="${esc(r.name)}"></button>`; }).join("");
  return `<div class="v22-map" data-scale><img src="${img}" alt="${esc(v22T("dp.map", { b: v21T(body === "Mars" ? "mars" : "moon") }))}">${pts}</div>`;
}
v21Render = function () {
  const d = document.getElementById("v21-dest"); if (!d) return;
  const ae = document.activeElement, refocus = ae && (ae.id === "v21-dest-title" || ae === document.body);
  const body = v21Body(), tabs = [["Mars", "mars"], ["Moon", "moon"], ["Both", "both"]];
  let main;
  if (body === "Both") main = `<div class="v22-feat v22-feat-both"><div class="v22-fimg"><img src="data/thumb_jezero_mola.png" alt=""><img src="data/thumb_southpole_lola.png" alt=""></div><div><h3>${esc(v21T("both"))}</h3><p>${esc(v21T("both_d"))}</p><div class="v21-acts"><button type="button" class="v21-go" data-v21go="cross"${S.targetId === "cross" ? ' aria-current="true"' : ""}>${esc(v21T("explore"))}</button></div></div></div>`;
  else if (!V21.reg) { if (!V21.regErr) v21RegLoad(); main = `<p class="v21-dp-note" role="status">${esc(v21T(V21.regErr ? "error" : "loading"))}</p>`; }
  else {
    const ts = V21.reg.targets.filter(r => v21BodyOf(r) === body).sort((a, b) => (b.legacy - a.legacy) || ((b.readiness || {}).level || 0) - ((a.readiness || {}).level || 0) || a.name.localeCompare(b.name));
    if (!V22.pick || !ts.some(r => r.id === V22.pick)) V22.pick = (ts.find(r => r.id === S.targetId) || ts[0] || {}).id;
    const r = ts.find(x => x.id === V22.pick) || ts[0], L = r.location || {}, lv = r.readiness || {}, ex = v21Explorable(r);
    const lat = L.latitude, lon = L.longitude_east;
    const thumb = r.id === "mars_jezero" ? "data/thumb_jezero_mola.png" : r.id === "moon_south_pole" ? "data/thumb_southpole_lola.png" : r.thumbnail;
    const cs = (r.fingerprint && r.fingerprint.criterion_status) || {};
    const list = `<ul class="v22-tl">${ts.map(t => `<li class="v21-d${t.id === r.id ? " on" : ""}"${S.targetId === t.id ? ' aria-current="true"' : ""}${v21Explorable(t) ? "" : " data-v22atlasonly"}><button type="button" data-v22pick="${esc(t.id)}" aria-pressed="${t.id === r.id}"><img src="${esc(t.id === "mars_jezero" ? "data/thumb_jezero_mola.png" : t.id === "moon_south_pole" ? "data/thumb_southpole_lola.png" : t.thumbnail)}" alt="" loading="lazy"><span><h3>${keep(t.name)}</h3><small>${esc(v21T("level", { n: txInt((t.readiness || {}).level || 0) }))}${S.targetId === t.id ? " · " + esc(v21T("current")) : ""}</small></span></button></li>`).join("")}</ul>`;
    const feat = `<article class="v22-feat" aria-live="polite"><img class="v22-fbig" src="${esc(thumb)}" alt="${esc(r.thumbnail_caption || r.name)}">
      <div class="v22-fbody"><p class="v22-eye">${esc(v21T(body === "Mars" ? "mars" : "moon"))}${r.region ? " · " + keep(r.region.name) : ""}</p><h3>${keep(r.name)}</h3>
        <p class="v21-meta">${lat != null ? esc(v21T("coords", { lat: v21T(lat < 0 ? "lat_s" : "lat_n", { v: txNum(Math.abs(lat), 2) + "°" }), lon: v21T("lon_e", { v: txNum(((lon % 360) + 360) % 360, 2) + "°" }) })) : ""}${L.window_km ? " · " + esc(v21T("window", { km: txNum(L.window_km, 1) })) : ""}</p>
        ${r.context ? `<p class="v22-ctx">${keep(r.context)}</p>` : ""}
        <p><span class="v21-lv">${esc(v21T("level", { n: txInt(lv.level || 0) }))}</span>${lv.label ? " · " + keep(lv.label) : ""}</p>
        ${Object.keys(cs).length ? `<ul class="v22-cs">${Object.entries(cs).map(([c, s]) => `<li><span>${esc(tx("crit." + c + ".short"))}</span><b class="v22-st v22-st-${esc(String(s).toLowerCase())}">${keep(s)}</b></li>`).join("")}</ul>` : ""}
        <div class="v21-acts"><button type="button" class="v21-go" data-v21go="${esc(r.id)}"${ex ? "" : " disabled"}>${esc(v21T(ex ? "explore" : "atlas_only"))}</button><button type="button" data-v21atlas="${esc(r.id)}">${esc(v21T("atlas"))}</button></div></div></article>`;
    main = `${v22BodyMap(body, ts)}<p class="v21-dp-note">${esc(v21T("count", { n: txInt(ts.length) }))} · ${esc(v21T("note"))}</p><div class="v22-dpb">${list}${feat}</div>`;
  }
  d.innerHTML = `<div class="v21-dp v22-dp" role="document" data-body="${body}"><div class="v21-dp-h"><h2 id="v21-dest-title" tabindex="-1">${esc(v21T("title_a"))} <span class="v20-serif">${esc(v21T("title_b"))}</span></h2><button type="button" class="v20-close" data-v21close>${esc(v20T("close"))}</button></div>
    <div class="v21-dp-tabs" role="tablist" aria-label="${esc(v21T("title_a") + " " + v21T("title_b"))}">${tabs.map(([b, k]) => `<button type="button" role="tab" data-v21body="${b}" aria-selected="${b === body}">${esc(v21T(k))}</button>`).join("")}</div>${main}</div>`;
  if (refocus && V21.open) { const t = document.getElementById("v21-dest-title"); if (t) t.focus(); }
};

/* ---------------------------------------------------------------- globe: natural base colours, centred canvas */
function v22Globe() {
  const G = window.GLOBE; if (!G || G._v22 || typeof FS === "undefined" || typeof VS === "undefined") return;
  const from = "vec3 b = mix(vec3(lum)*vec3(0.62,0.68,0.76), base, 0.28) * 0.36 * uBaseMix + vec3(0.012,0.016,0.022);";
  const vEnd = "gl_Position = uProj * vec4(p.x, p.y, p.z - uDist, 1.0);";
  if (!FS.includes(from) || !VS.includes(vEnd)) return;
  try {
    /* the same geometry, shifted horizontally in clip space by uOffX so the globe sits in the middle of the free canvas */
    const vs = VS.replace("uniform vec2 uPan;", "uniform vec2 uPan; uniform float uOffX;").replace(vEnd, vEnd + " gl_Position.x += uOffX * gl_Position.w;");
    G.prog = G.program(vs, FS.replace(from, "vec3 b = mix(vec3(lum)*vec3(0.70,0.78,0.88), base, 0.82) * 0.70 * uBaseMix + vec3(0.010,0.022,0.045);"));
    G.rim = G.program(vs, FS_RIM); G.lineP = G.program(vs, FS_LINE);
    G.offX = 0;
    const u0 = G.uniforms.bind(G); G.uniforms = function (p, sc) { u0(p, sc); if (p.u.uOffX) this.gl.uniform1f(p.u.uOffX, this.offX || 0); };
    const p0 = G.project.bind(G); G.project = function (lat, lon) { const r = p0(lat, lon); r.x += (this.offX || 0) * 0.5 * this.w; return r; };
    const q0 = G.unproject.bind(G); G.unproject = function (px, py) { return q0(px - (this.offX || 0) * 0.5 * this.w, py); };
    G._v22 = true; G.dirty = true; v22Offset();
  } catch (e) { console.error(e); }
}
/* desktop Discover: the ranking floats over the right of the canvas; centre the globe in the part it leaves free */
function v22Offset() {
  const G = window.GLOBE; if (!G || !G._v22) return;
  const app = document.getElementById("app"), r = document.getElementById("right"), v = document.getElementById("viewport");
  let off = 0;
  if (app && r && v && !app.classList.contains("is-hero") && v22Mode() === "desktop" && getComputedStyle(r).position === "absolute" && r.offsetParent !== null) {
    const vr = v.getBoundingClientRect(), rr = r.getBoundingClientRect();
    if (vr.width > 0 && rr.left < vr.right) off = -(vr.right - rr.left + 14) / vr.width;
  }
  if (Math.abs((G.offX || 0) - off) > 1e-4) { G.offX = off; G.dirty = true; if (typeof renderMarkers === "function") try { renderMarkers(); } catch (e) { } }
}

/* ---------------------------------------------------------------- events */
document.addEventListener("click", e => {
  const t = e.target; if (!t || !t.closest) return;
  if (t.closest("#v22-menu")) { V22.drawer = !V22.drawer; v22Side(); if (V22.drawer) { const n = document.querySelector("#v22-side [data-v22sec][aria-current=true]"); if (n) n.focus(); } return; }
  if (t.closest("#v22-collapse")) { V22.collapsed = !V22.collapsed; try { localStorage.setItem(V22.KEY, V22.collapsed ? "collapsed" : "open"); } catch (x) { } v22Side(); window.dispatchEvent(new Event("resize")); return; }
  const sb = t.closest("#v22-side [data-v22sec]");
  if (sb) {
    const s = sb.dataset.v22sec; V22.sec = s;
    if (v22Mode() !== "desktop" || V22.collapsed) { if (v22Mode() === "phone") V22.drawer = true; else V22.flyout = true; }
    if (s === "discover") { v22CloseDash(); v20JnClose(); v22Side(); v20Need(() => { if (S.tab !== "explore") setTab("explore"); else { document.getElementById("app").classList.remove("is-hero"); renderLeft(); } v22Side(); }); }
    else v22Dash(s);
    return;
  }
  const dsh = t.closest("[data-v22dash]"); if (dsh) { v22CloseFloat(); v22Dash(dsh.dataset.v22dash); return; }
  const st = t.closest("[data-v22set]"); if (st) { v22CloseFloat(); v20OpenSheet("set"); if (st.dataset.v22set === "about") setTimeout(() => { const a = document.querySelector('#v20-set [data-v20sec="about"]'); if (a) { a.scrollIntoView({ block: "start" }); a.setAttribute("tabindex", "-1"); a.focus(); } }, 40); return; }
  const tb = t.closest("[data-v22tab]"); if (tb) { const k = tb.dataset.v22tab; v22CloseDash(); v22CloseFloat(); v20Need(() => setTab(k)); return; }
  const sel = t.closest("[data-v22sel]"); if (sel) { const i = +sel.dataset.v22sel; v22CloseDash(); setTab("explore"); select(i, true); return; }
  const pk = t.closest("[data-v22pick]"); if (pk) { V22.pick = pk.dataset.v22pick; v21Render(); const n = document.querySelector(`.v22-tl [data-v22pick="${V22.pick}"]`); if (n) n.focus(); return; }
  if (t.closest("#v22-sub [data-tab], #v22-side [data-v20go], #v22-dash [data-v20go]")) { v22CloseDash(); v22CloseFloat(); }
}, true);
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && (V22.drawer || V22.flyout)) { const m = V22.drawer; v22CloseFloat(); const o = m ? document.getElementById("v22-menu") : document.querySelector("#v22-side [data-v22sec][aria-current=true]"); if (o) o.focus(); }
});
window.addEventListener("resize", () => { if (v22Mode() === "phone") V22.flyout = false; else V22.drawer = false; v22Side(); });
{ const f = setTab; setTab = function (t) { const s = v22SecOf(t); if (s) V22.sec = s; v22CloseDash(); const r = f.apply(this, arguments); try { v22Side(); } catch (x) { } return r; }; }
{ const f = renderLeft; renderLeft = function () { const r = f.apply(this, arguments); try { v22Side(); } catch (x) { } return r; }; }
{ const f = v20Home; v20Home = function () { v22CloseDash(); V22.sec = "discover"; V22.drawer = false; V22.flyout = false; const r = f.apply(this, arguments); try { v22Side(); } catch (x) { } return r; }; }
{ const f = setLang; setLang = function () { const r = f.apply(this, arguments); try { v22Side(); if (V22.dash) v22Dash(V22.dash); } catch (x) { console.error(x); } return r; }; }
{ const f = setTarget; setTarget = function () { const r = f.apply(this, arguments); try { if (V22.dash) v22Dash(V22.dash); } catch (x) { } return r; }; }
{ const f = jnOpen; jnOpen = function () { v22CloseDash(); const r = f.apply(this, arguments); try { v22Side(); } catch (x) { } return r; }; }
(function v22Boot() {
  const go = () => { v22Side(); let n = 0; const iv = setInterval(() => { v22Globe(); v22Side(); if (++n > 40 || (window.GLOBE && window.GLOBE._v22)) { v22Globe(); clearInterval(iv); } }, 250); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else setTimeout(go, 0);
})();
