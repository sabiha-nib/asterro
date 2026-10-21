/* ===== ASTERRO · Discovery Journey — a story-led way in, for people who are not planetary scientists =====
 * One accessible full-screen dialog (focus trap, Esc returns focus) with:
 *   Discoveries   story cards computed live from the bundled, checksum-verified data (never pre-written results)
 *   Reveal        a staged 7-step explanation of one Earth place against one target
 *   Lens          similar / partly similar / different / unknown / not compared, for a switchable objective
 *   Change my mind, Missing pieces, Trust, Other worlds, Through time, Passport, Team of places
 * All numbers come from AsterroJourney (journey_engine.js) over the unchanged baseline engine; this file only
 * chooses words (via tx) and draws. Nothing here alters a baseline score, weight, range, ranking or view. */
const JE = window.AsterroJourney;
const JN = { open: false, view: "home", i: null, tid: "mars_jezero", pid: "general", w: null, sec: "reveal", step: 0, opener: null,
  cm: new Map(), stories: null, storyKey: null, busy: false, lastFocus: null };
const JN_SECS = ["reveal", "lens", "change", "missing", "trust", "worlds", "time", "passport"];
/* journey screens; later modules (missions, portfolio, journal) register theirs here */
const JN_VIEWS = { home: { title: "home.title", render: () => jnHome() }, team: { title: "team.title", render: () => jnTeamView() }, place: { title: null, render: () => jnPlaceView() } };
const JN_GLYPH = { similar: "≈", partial: "~", different: "✕", unknown: "?", na: "—", off: "○" };

/* ---------------------------------------------------------------- context and cached computations */
function jnEarthSource() { return Object.fromEntries(S.app.criteria.map(c => [c.id, c.earth_source.slice()])); }
function jnSources() { const o = {}; for (const c of S.app.criteria) for (const s of c.earth_source) (o[s] = o[s] || []).push(c.id); return o; }
function jnCtx(tid) {
  const T = S.T[tid];
  return { tid, A: S.A, critIds: S.critIds, cell: S.cell, lat: S.lat, lon: S.lon, tv: T.variables, status: T.status || {}, ranges: a4RangesFor(tid),
    thr: S.app.thresholds, profiles: S.app.profiles, sources: jnSources(), earthSource: jnEarthSource(), sep: S.app.thresholds.distinct_sep_km,
    config: a4IsNew(tid) ? "explore-target-v1" : "legacy-baseline-v1", effFor: w => simFor(tid, w).eff };
}
function jnTargets() { return TARGET_IDS.concat(typeof A4X !== "undefined" ? A4X.ids : []).filter(id => S.T[id]); }
function jnTName(tid) { return txHas("tname." + tid) ? esc(tx("tname." + tid)) : keep(TNAME[tid] || S.T[tid].name); }
function jnTNameText(tid) { return txHas("tname." + tid) ? tx("tname." + tid) : (TNAME[tid] || S.T[tid].name); }
function jnBody(tid) { const b = (S.T[tid].body || "").toLowerCase(); return tx("body." + (b === "moon" ? "moon" : "mars")); }
function jnPlace(i) { const p = placeName(i); return p.primary === "Unlabelled land cell" ? esc(tx("place.unlabelled")) : keep(p.primary) + (p.secondary ? ", " + keep(p.secondary) : ""); }
function jnPlaceText(i) { const p = placeName(i); return p.primary === "Unlabelled land cell" ? tx("place.unlabelled") : placeStr(i); }
function jnCrit(c) { return esc(tx("crit." + c)); }
function jnVal(c, v) { if (v == null || v !== v) return esc(tx("val.na")); const cr = S.crit.find(x => x.id === c); const u = unitOf(c); return esc(txNum(+v, cr ? cr.fmt : 2)) + (u ? " " + keep(u) : ""); }
function jnPts(x) { return esc(txNum(100 * x, 1)); }
function jnProfileName(pid) { return pid === "custom" ? esc(tx("profile.custom")) : esc(tx("profile." + pid)); }
function jnDataset(id) { const d = S.app.datasets.find(x => x.id === id); return d ? d : { id, dataset: id, url: "" }; }
function jnDsName(id) { return keep({ nasa_power: "NASA POWER", modis_aqua_lst: "MODIS Aqua LST (MYD11C3)", gmted2010: "USGS GMTED2010" }[id] || jnDataset(id).dataset); }
function jnW() { return JN.pid === "custom" ? { ...JN.w } : { ...S.app.profiles[JN.pid].weights }; }
function jnKey(...a) { return a.join("|"); }

/* ---------------------------------------------------------------- open / close / focus */
function jnShell() {
  let d = $("#jn"); if (d) return d;
  d = document.createElement("div"); d.id = "jn"; d.className = "jn"; d.hidden = true;
  d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "jn-title");
  d.innerHTML = `<div class="jn-card"><div class="jn-head" id="jn-head"></div><div class="jn-body" id="jn-body" tabindex="-1"></div></div><div class="sr-only" aria-live="polite" id="jn-live"></div>`;
  $("#app").appendChild(d);
  d.addEventListener("click", jnClick);
  d.addEventListener("change", jnChange);

  return d;
}
function jnOpen(view = "home", o = {}) {
  if (!S.A || !S.A.cell) return;
  const d = jnShell();
  if (!JN.open) JN.opener = document.activeElement;
  JN.open = true; JN.view = view;
  if (o.i != null) JN.i = o.i;
  if (o.tid) JN.tid = o.tid;
  if (o.pid) { JN.pid = o.pid; if (o.pid === "custom") JN.w = { ...S.weights }; }
  if (o.sec) JN.sec = o.sec;
  if (o.step != null) JN.step = o.step;
  if (!d.dataset.rot && window.GLOBE) { d.dataset.rot = GLOBE.autoRotate ? "1" : "0"; GLOBE.autoRotate = false; }   // a still globe behind the dialog: no redraw per frame
  d.hidden = false; document.body.classList.add("jn-on");
  jnRender();
  setTimeout(() => { const t = $("#jn-title"); (t || $("#jn-body")).focus(); }, 0);
}
function jnClose() {
  const d = $("#jn"); if (!d || d.hidden) return;
  d.hidden = true; JN.open = false; document.body.classList.remove("jn-on");
  if (window.GLOBE && d.dataset.rot === "1" && !S.searched) GLOBE.autoRotate = true;
  delete d.dataset.rot;
  const o = JN.opener; JN.opener = null;
  if (o && document.contains(o) && o.focus) o.focus();
}
function jnFocusables() { return $$("#jn button:not([disabled]), #jn select, #jn a[href], #jn [tabindex]:not([tabindex='-1']), #jn summary").filter(e => e.offsetParent !== null || e === document.activeElement); }
function jnKeys(e) {
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); jnClose(); return; }
  if (e.key === "Tab") {
    const f = jnFocusables(); if (!f.length) return;
    const a = f[0], z = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === a || !$("#jn").contains(document.activeElement))) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    return;
  }
  if (JN.view === "place" && JN.sec === "reveal" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;
    e.preventDefault(); jnStep(e.key === "ArrowRight" ? 1 : -1);
  }
}
function jnLive(msg) { const a = $("#jn-live"); if (a) { a.textContent = ""; setTimeout(() => a.textContent = msg, 30); } }

/* ---------------------------------------------------------------- rendering */
function jnBadge() {
  const off = typeof navigator !== "undefined" && navigator.onLine === false;
  const ok = S.hashOK === true;
  return `<span class="jn-badge ${ok ? "ok" : ""}" title="${esc(tx("badge.title", { sha: S.app.stack.sha256.slice(0, 12) }))}">${ok ? "✓ " : ""}${esc(tx(off ? (ok ? "badge.offline" : "badge.offline_plain") : ok ? "badge.verified" : "badge.bundled"))}</span>`;
}
function jnHead() {
  const back = JN.view === "home" ? "" : `<button class="jn-back" data-jn="home" aria-label="${esc(tx("nav.back_home"))}">‹ <span>${esc(tx("nav.discoveries"))}</span></button>`;
  const title = JN.view === "place" ? null : tx((JN_VIEWS[JN.view] || {}).title || "home.title");
  return `${back}<div class="jn-htxt">${title ? `<h2 id="jn-title" tabindex="-1">${esc(title)}</h2>` : `<h2 id="jn-title" tabindex="-1">${jnPlace(JN.i)}</h2>`}${jnBadge()}</div>
    ${i18nSelect("jn-lang", "jn-langsel")}<button class="jn-x" data-jn="close" aria-label="${esc(tx("nav.close"))}">×</button>`;
}
/* re-rendering replaces the dialog's content (registry arrival, finished tests, language switch): keep keyboard
 * focus on the same control, or on the title when that control no longer exists */
function jnFocusKey() {
  const a = document.activeElement, d = $("#jn"); if (!a || !d || !d.contains(a)) return null;
  if (a.id) return "#" + CSS.escape(a.id);
  for (const n of ["data-jn", "data-jnsec", "data-jnstep", "data-jnpid", "data-jnin"]) {
    const v = a.getAttribute(n); if (v == null) continue;
    const i = a.getAttribute("data-i");
    return `[${n}="${CSS.escape(v)}"]` + (i != null ? `[data-i="${CSS.escape(i)}"]` : "");
  }
  return "#jn-title";
}
function jnRender() {
  const d = $("#jn"); if (!d || d.hidden) return;
  const fk = jnFocusKey();
  try { jnRenderInner(d); }
  finally {
    if (fk) { let t = null; try { t = d.querySelector(fk); } catch (e) { t = null; } (t || $("#jn-title") || $("#jn-body")).focus({ preventScroll: true }); }
  }
}
function jnRenderInner(d) {
  d.dataset.view = JN.view;
  if (JN.liveLang !== I18N.lang) { const lv = $("#jn-live"); if (lv) lv.textContent = ""; JN.liveLang = I18N.lang; }
  $("#jn-head").innerHTML = jnHead();
  let h = "";
  try { h = (JN_VIEWS[JN.view] || JN_VIEWS.home).render(); }
  catch (err) { console.error(err); h = `<div class="jn-pad"><p class="jn-callout">${esc(tx("err.compute"))} <span class="meta">${esc(err.message)}</span></p></div>`; }
  $("#jn-body").innerHTML = h;
  if (JN.view === "place" && JN.sec === "change" && !JN.cm.has(jnCmKey())) jnRunChange();
}

/* ---------------------------------------------------------------- Discoveries (home) */
function jnStories() {
  const key = jnKey(S.app.stack.sha256, typeof A4X !== "undefined" ? A4X.ids.length : 0);
  if (JN.stories && JN.storyKey === key) return JN.stories;
  const W = S.app.profiles.general.weights, out = [];
  const top = tid => { const c = jnCtx(tid), eff = c.effFor(W), L = JE.leaders(eff, c, 1)[0], ln = JE.lens(c, L, W); return { tid, i: L, score: eff[L], ln }; };
  out.push({ id: "mars_top", ...top("mars_jezero") });
  out.push({ id: "moon_top", ...top("moon_south_pole") });
  const cj = jnCtx("mars_jezero"), C = JE.ceiling(cj, "lst_diurnal_range");
  out.push({ id: "thermal", tid: "mars_jezero", i: C.bestCell, C });
  const tm = JE.team(cj, W);
  out.push({ id: "team", tid: "mars_jezero", team: tm, i: tm.members.length ? tm.members[0].i : null });
  if (typeof A4X !== "undefined" && A4X.ids.includes("moon_shackleton")) out.push({ id: "shackleton", ...top("moon_shackleton") });
  JN.stories = out; JN.storyKey = key;
  return out;
}
function jnCard(s) {
  const body = (S.T[s.tid].body || "").toLowerCase() === "moon" ? "moon" : "mars";
  const kick = `${esc(jnBody(s.tid))} · ${jnTName(s.tid)}`;
  let h = "", p = "", act = `<button class="jn-btn" data-jn="why" data-i="${s.i}" data-tid="${s.tid}" data-pid="general">${esc(tx("story.explore_why"))}</button>`;
  if (s.id === "mars_top" || s.id === "moon_top" || s.id === "shackleton") {
    h = txH("story.top.h", {}, { place: jnPlace(s.i), target: jnTName(s.tid) });
    p = esc(tx("story.top.p", { similar: txInt(s.ln.groups.similar.length), compared: txInt(s.ln.compared), score: txPct(s.score) }));
    if (s.id === "shackleton") p += ` <span class="jn-note">${esc(tx("story.shackleton.note"))}</span>`;
  } else if (s.id === "thermal") {
    h = esc(tx("story.thermal.h", { target: jnTNameText(s.tid) }));
    p = txH("story.thermal.p", { t: txNum(s.C.target, 1), e: txNum(s.C.earthMax, 1) }, { place: jnPlace(s.i) }) + " " + esc(tx("story.thermal.p2", { s: txNum(s.C.bestS, 2) }));
  } else if (s.id === "team") {
    const T = s.team;
    h = esc(tx("story.team.h"));
    p = esc(tx("story.team.p", { n: txInt(T.criteria.length), k: txInt(T.members.length), m: txInt(T.covered.length) }));
    if (T.unmatchable.length) p += " " + esc(tx("story.team.p_none", { list: txList(T.unmatchable.map(c => tx("crit." + c + ".s"))) }));
    act = `<button class="jn-btn" data-jn="team" data-tid="${s.tid}">${esc(tx("story.see_team"))}</button>`;
  }
  return `<article class="jn-story b-${body}" data-story="${s.id}"><p class="jn-kick">${kick}</p><h3>${h}</h3><p>${p}</p><div class="jn-act">${act}</div></article>`;
}
function jnHome() {
  const st = jnStories();
  const sel = S.selected ?? S.picked;
  const yours = sel != null ? `<article class="jn-story b-earth" data-story="yours"><p class="jn-kick">${esc(tx("story.yours.kick"))}</p><h3>${jnPlace(sel)}</h3><p>${esc(tx("story.yours.p"))}</p><div class="jn-act"><button class="jn-btn" data-jn="why" data-i="${sel}" data-tid="${S.targetId === "cross" ? "mars_jezero" : S.targetId}" data-pid="${S.profile === "custom" ? "custom" : S.profile}">${esc(tx("story.explore_why"))}</button></div></article>` : "";
  const regNote = (typeof A4 !== "undefined" && !A4.reg && !A4.err) ? `<p class="jn-note">${esc(tx("home.loading_registry"))}</p>` : "";
  return `<div class="jn-pad jn-home"><p class="jn-eyebrow">${esc(tx("home.eyebrow"))}</p><p class="jn-lead">${esc(tx("home.lead"))}</p>
    <div class="jn-stories">${yours}${st.map(jnCard).join("")}</div>${regNote}
    <h3 class="jn-h jn-further">${esc(tx("home.further"))}</h3>
    <div class="jn-tiles">${["missions", "portfolio", "journal"].map(v => `<button class="jn-tile" data-jn="view" data-view="${v}"><b>${esc(tx(v + ".title"))}</b><span>${esc(tx(v + ".tile"))}</span></button>`).join("")}</div>
    <p class="jn-fine">${esc(tx("home.fine"))}</p>${jnReviewNote()}</div>`;
}
function jnReviewNote() { return I18N.lang === "en" ? "" : `<p class="jn-fine jn-review">${esc(tx("lang.review_note"))}</p>`; }

/* ---------------------------------------------------------------- one place */
function jnLens(tid = JN.tid, w = jnW()) { return JE.lens(jnCtx(tid), JN.i, w); }
function jnPlaceView() {
  const i = JN.i, tid = JN.tid, w = jnW(), ctx = jnCtx(tid), eff = ctx.effFor(w), L = JE.lens(ctx, i, w);
  const r = JE.rank(eff, S.cell, i), lead = JE.leadPos(eff, ctx, i, 10), n = JE.nEligible(eff);
  const tsel = `<label class="jn-field"><span>${esc(tx("place.target"))}</span><select data-jnin="tid">${jnTargets().map(id => `<option value="${id}"${id === tid ? " selected" : ""}>${esc(jnBody(id))} · ${esc(jnTNameText(id))}</option>`).join("")}</select></label>`;
  const psel = `<label class="jn-field"><span>${esc(tx("place.objective"))}</span><select data-jnin="pid">${Object.keys(S.app.profiles).map(p => `<option value="${p}"${p === JN.pid ? " selected" : ""}>${jnProfileName(p)}</option>`).join("")}${JN.w ? `<option value="custom"${JN.pid === "custom" ? " selected" : ""}>${jnProfileName("custom")}</option>` : ""}</select></label>`;
  const score = `<div class="jn-score"><b>${esc(txPct(eff[i]))}</b><span>${esc(tx("place.score_label"))}</span></div>`;
  const where = `<p class="jn-where">${esc(txLL(S.lat[i], S.lon[i]))} · ${esc(tx("place.cell", { id: txInt(S.cell[i]) }))} · ${esc(r == null ? tx("place.not_eligible") : tx("place.rank", { r: txInt(r), n: txInt(n) }))}${lead ? " · " + esc(tx("place.leading", { k: txInt(lead) })) : ""}</p>`;
  const nav = `<div class="jn-tabs" role="tablist" aria-label="${esc(tx("aria.sections"))}">${JN_SECS.map(s => `<button role="tab" id="jn-tab-${s}" aria-selected="${s === JN.sec}" aria-controls="jn-panel" data-jnsec="${s}">${esc(tx("sec." + s))}</button>`).join("")}</div>`;
  const panel = { reveal: jnReveal, lens: jnLensView, change: jnChangeView, missing: jnMissingView, trust: jnTrustView, worlds: jnWorldsView, time: jnTimeView, passport: jnPassportView }[JN.sec](ctx, L, eff);
  return `<div class="jn-pad"><div class="jn-placehead"><div>${where}<div class="jn-ctrls">${tsel}${psel}</div></div>${score}</div>${nav}
    <section id="jn-panel" role="tabpanel" aria-labelledby="jn-tab-${JN.sec}" class="jn-panel">${panel}</section>
    <div class="jn-foot"><button class="jn-lnk" data-jn="globe">${esc(tx("place.show_globe"))}</button><span class="jn-fine">${esc(tx("place.fine"))}</span></div>${jnReviewNote()}</div>`;
}

/* ---------- Reveal: 7 steps ---------- */
function jnStep(d) {
  const k = clamp(JN.step + d, 0, 6); if (k === JN.step) return;
  JN.step = k; jnRender();
  const h = $("#jn-step-h"); if (h) h.focus();
  jnLive(tx("reveal.step_of", { k: txInt(k + 1), n: txInt(7) }) + ": " + tx("reveal.s" + (k + 1)));
}
function jnRowsTable(rows, cols) {
  return `<table class="jn-t"><tbody>${rows.map(r => `<tr>${cols.map(f => f(r)).join("")}</tr>`).join("")}</tbody></table>`;
}
function jnStatusChip(st) { return st ? `<span class="jn-st st-${esc(st.toLowerCase().replace(/[^a-z]/g, ""))}">${esc(tx("status." + st))}</span>` : ""; }
function jnStateChip(st) { return `<span class="jn-sc s-${st}"><b aria-hidden="true">${JN_GLYPH[st]}</b>${esc(tx("state." + st))}</span>`; }
function jnReveal(ctx, L) {
  const w = jnW(), obj = JE.objectives(ctx, JN.i, 10), steps = JE.reveal(ctx, JN.i, w, { lens: L, objectives: obj, profile: JN.pid, change: JN.cm.get(jnCmKey()) || null });
  const k = JN.step, s = steps[k];
  let body = "";
  if (s.id === "earth") {
    body = `<p>${esc(tx("reveal.earth.p"))}</p>` + jnRowsTable(L.rows, [r => `<th scope="row">${jnCrit(r.c)}<small>${esc(tx("crit." + r.c + ".plain"))}</small></th>`, r => `<td class="n">${jnVal(r.c, r.e)}</td>`]);
  } else if (s.id === "target") {
    body = `<p>${esc(tx("reveal.target.p", { target: jnTNameText(JN.tid) }))}</p>` + jnRowsTable(L.rows, [r => `<th scope="row">${jnCrit(r.c)}</th>`, r => `<td class="n">${jnVal(r.c, r.t)}</td>`, r => `<td>${jnStatusChip(r.status)}</td>`]);
  } else if (s.id === "agree") {
    body = s.rows.length ? `<p>${esc(tx("reveal.agree.p", { k: txInt(s.rows.length), n: txInt(L.compared) }))}</p>` + jnRowsTable(s.rows, [r => `<th scope="row">${jnStateChip(r.state)} ${jnCrit(r.c)}</th>`, r => `<td class="n">${jnVal(r.c, r.e)} <span class="meta">${esc(tx("reveal.vs"))}</span> ${jnVal(r.c, r.t)}</td>`, r => `<td class="n">s = ${esc(txNum(r.s, 2))}</td>`])
      : `<p>${esc(tx("reveal.agree.none"))}</p>`;
  } else if (s.id === "differ") {
    body = s.rows.length ? `<p>${esc(tx("reveal.differ.p"))}</p>` + jnRowsTable(s.rows, [r => `<th scope="row">${jnStateChip(r.state)} ${jnCrit(r.c)}</th>`, r => `<td>${esc(tx(r.dir === "higher" ? "reveal.earth_higher" : "reveal.earth_lower"))}: ${jnVal(r.c, r.e)} <span class="meta">${esc(tx("reveal.vs"))}</span> ${jnVal(r.c, r.t)}</td>`, r => `<td class="n">${esc(tx("reveal.costs", { pts: txNum(100 * r.loss, 1) }))}</td>`])
      : `<p>${esc(tx("reveal.differ.none"))}</p>`;
    if (s.unknown.length) body += `<p class="jn-note">${esc(tx("reveal.unknown", { list: txList(s.unknown.map(c => tx("crit." + c + ".s"))) }))}</p>`;
    if (s.na.length) body += `<p class="jn-note">${esc(tx("reveal.na", { list: txList(s.na.map(c => tx("crit." + c + ".s"))) }))}</p>`;
  } else if (s.id === "evidence") {
    const T = S.T[JN.tid];
    body = `<p>${esc(tx("reveal.evidence.p"))}</p>` + jnRowsTable(s.earth, [r => `<th scope="row">${jnCrit(r.c)}</th>`, r => `<td>${r.sources.map(jnDsName).join(", ")}</td>`, r => `<td>${jnStatusChip(r.status)}</td>`]) +
      `<p class="jn-note">${esc(tx("reveal.evidence.target"))} ${T.sources.map((x, k) => T.source_urls[k] ? `<a href="${esc(T.source_urls[k])}" target="_blank" rel="noopener">${keep(x)}</a>` : keep(x)).join(" · ")}</p>`;
  } else if (s.id === "objective") {
    const a = s.alt;
    if (a && a.current && a.best) {
      body = `<p>${esc(tx("reveal.objective.p", { profile: tx("profile." + JN.pid), r: txInt(a.current.rank) }))}</p>`;
      body += `<p>${esc(tx("reveal.objective.best", { profile: tx("profile." + a.best.pid), r: txInt(a.best.rank) }))} ${a.worst && a.worst.pid !== a.best.pid ? esc(tx("reveal.objective.worst", { profile: tx("profile." + a.worst.pid), r: txInt(a.worst.rank) })) : ""}</p>`;
    } else body = `<p>${esc(tx("reveal.objective.custom"))}</p>`;
    body += jnObjTable(obj) + `<p><button class="jn-lnk" data-jnsec="lens">${esc(tx("reveal.open_lens"))}</button></p>`;
  } else if (s.id === "summary") {
    body = `<p class="jn-verdict">${jnSummaryText(s.summary, L)}</p><p class="jn-note">${esc(tx("summary.scope"))}</p>
      <div class="jn-act"><button class="jn-btn" data-jnsec="passport">${esc(tx("sec.passport"))}</button><button class="jn-btn ghost" data-jnsec="change">${esc(tx("sec.change"))}</button><button class="jn-btn ghost" data-jnsec="missing">${esc(tx("sec.missing"))}</button></div>`;
  }
  const dots = steps.map((x, j) => `<button class="jn-dot${j === k ? " on" : ""}${j < k ? " done" : ""}" data-jnstep="${j}" aria-label="${esc(tx("reveal.step_of", { k: txInt(j + 1), n: txInt(7) }) + ": " + tx("reveal.s" + (j + 1)))}"${j === k ? ' aria-current="step"' : ""}></button>`).join("");
  return `<div class="jn-reveal"><div class="jn-dots">${dots}</div>
    <div class="jn-stepcard jn-in" data-step="${s.id}"><p class="jn-kick">${esc(tx("reveal.step_of", { k: txInt(k + 1), n: txInt(7) }))}</p><h3 id="jn-step-h" tabindex="-1">${esc(tx("reveal.s" + (k + 1)))}</h3>${body}</div>
    <div class="jn-stepnav"><button class="jn-btn ghost" data-jn="prev"${k === 0 ? " disabled" : ""}>‹ ${esc(tx("reveal.back"))}</button>
    <span class="jn-hint">${esc(tx("reveal.keys"))}</span>
    ${k < 6 ? `<button class="jn-lnk" data-jn="skip">${esc(tx("reveal.skip"))}</button><button class="jn-btn" data-jn="next">${esc(tx("reveal.next"))} ›</button>` : `<button class="jn-btn" data-jnstep="0">${esc(tx("reveal.again"))}</button>`}</div></div>`;
}
function jnSummaryText(sm, L) {
  const lvl = tx("summary.level." + sm.level, { similar: txInt(sm.similar), compared: txInt(sm.compared), score: txPct(L.score) });
  const rob = sm.robust ? " " + tx("summary.robust." + sm.robust) : " " + tx("summary.robust.untested");
  return esc(lvl + rob);
}
function jnObjTable(obj) {
  return `<div class="jn-scroll"><table class="jn-t jn-obj"><thead><tr><th>${esc(tx("lens.objective"))}</th><th class="n">${esc(tx("lens.score"))}</th><th class="n">${esc(tx("lens.rank"))}</th><th>${esc(tx("lens.costs_most"))}</th></tr></thead><tbody>${obj.map(o => `<tr${o.pid === JN.pid ? ' class="on"' : ""}><th scope="row">${jnProfileName(o.pid)}</th><td class="n">${esc(txPct(o.score))}</td><td class="n">${esc(txRank(o.rank))}${o.lead ? ` <span class="jn-leadk">${esc(tx("lens.leading", { k: txInt(o.lead) }))}</span>` : ""}</td><td>${o.costs.map(c => jnCrit(c)).join(", ") || "—"}</td></tr>`).join("")}</tbody></table></div>`;
}

/* ---------- Planetary Difference Lens ---------- */
function jnLensSVG(L) {
  const narrow = innerWidth < 600, rows = L.rows, W = narrow ? 360 : 640, rh = narrow ? 40 : 46, x0 = narrow ? 104 : 210, x1 = W - (narrow ? 52 : 70), H = rows.length * rh + 26, thr = S.app.thresholds;   // phone: a narrower drawing keeps the labels at reading size
  const sx = v => x0 + (x1 - x0) * clamp(v, 0, 1);
  let g = `<text x="${x0}" y="14" class="ax">${esc(tx("lens.axis_min"))}</text><text x="${x1}" y="14" class="ax" text-anchor="end">${esc(tx("lens.axis_max"))}</text>`;
  rows.forEach((r, k) => {
    const y = 26 + k * rh, cy = y + 18, R = ctxRange(r.c), tn = r.t == null ? null : (r.t - R[0]) / (R[1] - R[0]), en = r.e == null ? null : (r.e - R[0]) / (R[1] - R[0]);
    g += `<g class="lr s-${r.state}"><text x="0" y="${cy + 4}" class="lab"><tspan class="gl">${JN_GLYPH[r.state]}</tspan> ${esc(tx("crit." + r.c + ".short"))}</text>`;
    g += `<line x1="${x0}" x2="${x1}" y1="${cy}" y2="${cy}" class="trk"/>`;
    if (tn != null && r.w > 0) { const a = sx(tn - (1 - thr.match)), b = sx(tn + (1 - thr.match)); g += `<rect x="${a.toFixed(1)}" y="${cy - 7}" width="${(b - a).toFixed(1)}" height="14" class="zone"/>`; }
    if (tn != null) g += `<path d="M${sx(tn).toFixed(1)} ${cy - 8} l7 8 l-7 8 l-7 -8z" class="tm"/>`;
    if (en != null) g += `<circle cx="${sx(en).toFixed(1)}" cy="${cy}" r="6" class="em"/>`;
    g += `<text x="${W}" y="${cy + 4}" class="val" text-anchor="end">${r.s == null ? esc(tx("state." + r.state)) : "s " + esc(txNum(r.s, 2))}</text></g>`;
  });
  return `<figure class="jn-fig"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tx("lens.svg_label"))}">${g}</svg>
    <figcaption><span class="lg"><i class="em"></i>${esc(tx("lens.leg_earth"))}</span><span class="lg"><i class="tm"></i>${esc(tx("lens.leg_target"))}</span><span class="lg"><i class="zone"></i>${esc(tx("lens.leg_zone"))}</span></figcaption></figure>`;
}
function ctxRange(c) { return a4RangesFor(JN.tid)[c]; }
function jnLensView(ctx, L, eff) {
  const groups = ["similar", "partial", "different", "unknown", "na", "off"].filter(g => L.groups[g].length);
  const matter = L.matter.filter(c => L.rows.find(r => r.c === c).state !== "similar").slice(0, 2);
  const r = JE.rank(eff, S.cell, JN.i), lead = JE.leadPos(eff, ctx, JN.i, 10);
  const pick = `<div class="jn-seg" role="radiogroup" aria-label="${esc(tx("lens.objective"))}">${Object.keys(S.app.profiles).map(p => `<button role="radio" aria-checked="${p === JN.pid}" data-jnpid="${p}">${jnProfileName(p)}</button>`).join("")}</div>`;
  const rationale = JN.pid !== "custom" ? `<p class="jn-note">${esc(tx("profile." + JN.pid + ".why"))}</p>` : "";
  return `<h3 class="jn-h">${esc(tx("lens.title"))}</h3><p>${esc(tx("lens.p"))}</p>${pick}${rationale}
    <p class="jn-verdict">${esc(tx("lens.under", { profile: tx(JN.pid === "custom" ? "profile.custom" : "profile." + JN.pid), score: txPct(L.score), r: r == null ? "—" : txInt(r) }))}${lead ? " " + esc(tx("lens.leading_long", { k: txInt(lead) })) : ""}</p>
    ${jnLensSVG(L)}
    <div class="jn-groups">${groups.map(g => `<div class="jn-grp g-${g}"><h4>${jnStateChip(g)} <span class="meta">${esc(txInt(L.groups[g].length))}</span></h4><p>${L.groups[g].map(c => jnCrit(c)).join(", ")}</p></div>`).join("")}</div>
    <h4 class="jn-h4">${esc(tx("lens.matters", { profile: tx(JN.pid === "custom" ? "profile.custom" : "profile." + JN.pid) }))}</h4>
    ${matter.length ? `<ul class="jn-ul">${matter.map(c => { const row = L.rows.find(x => x.c === c); return `<li>${jnCrit(c)}: ${esc(tx("lens.costs", { pts: txNum(100 * row.loss, 1), w: txNum(row.w, 1) }))}</li>`; }).join("")}</ul>` : `<p>${esc(tx("lens.matters_none"))}</p>`}
    <p class="jn-note">${esc(tx("lens.loss_note"))}</p>`;
}

/* ---------- What would change my mind? ---------- */
function jnCmKey() { return jnKey(JN.tid, JN.i, JSON.stringify(jnW())); }
function jnRunChange() {
  if (JN.busy) return; JN.busy = true;
  const key = jnCmKey(), tid = JN.tid, i = JN.i, w = jnW();
  setTimeout(() => {
    try { JN.cm.set(key, JE.changeMind(jnCtx(tid), i, w, 10)); if (JN.cm.size > 12) JN.cm.delete(JN.cm.keys().next().value); }
    catch (e) { console.error(e); JN.cm.set(key, { error: e.message }); }
    JN.busy = false;
    if (JN.open && JN.view === "place" && jnCmKey() === key) { jnRender(); jnLive(tx("change.done")); }
  }, 30);
}
function jnAltLabel(a) {
  if (a.kind === "profile") return tx("change.alt.profile", { profile: tx("profile." + a.id) });
  if (a.kind === "drop_source") return tx("change.alt.drop_source");
  if (a.kind === "drop_proxy") return tx("change.alt.drop_proxy", { list: txList(a.id.split("+").map(c => tx("crit." + c + ".s"))) });
  return tx("change.alt.drop_criterion", { criterion: tx("crit." + a.id + ".s") });
}
function jnAltLabelHTML(a) { return a.kind === "drop_source" ? txH("change.alt.drop_source", {}, { source: jnDsName(a.id) }) : esc(jnAltLabel(a)); }
function jnChanges(a) { return a.changes.map(x => `${esc(tx("crit." + x.c + ".short"))} ${esc(txNum(x.from, 1))} → ${esc(txNum(x.to, 1))}`).join(" · "); }
function jnAltRow(a) {
  const res = !a.eligible ? tx("change.res.ineligible") : a.lead ? tx("change.res.leading", { k: txInt(a.lead), r: txInt(a.rank) }) : tx("change.res.rank", { r: txInt(a.rank) });
  return `<li class="jn-alt ${a.holds ? "holds" : "breaks"}" data-alt="${esc(a.kind + ":" + a.id)}"><span class="jn-mark" aria-hidden="true">${a.holds ? "✓" : "✕"}</span><div><b>${jnAltLabelHTML(a)}</b><span class="sr-only">${esc(tx(a.holds ? "change.holds_sr" : "change.breaks_sr"))}</span><div class="meta">${esc(tx("change.weights_changed"))} ${jnChanges(a)}</div></div><span class="jn-res">${esc(res)}</span></li>`;
}
function jnChangeView() {
  const R = JN.cm.get(jnCmKey());
  if (!R) return `<h3 class="jn-h">${esc(tx("change.title"))}</h3><p class="jn-busy" role="status">${esc(tx("change.running"))}</p>`;
  if (R.error) return `<p class="jn-callout">${esc(tx("err.compute"))} ${esc(R.error)}</p>`;
  const b = R.base, br = R.alternatives.filter(a => !a.holds), ok = R.alternatives.filter(a => a.holds);
  const concl = txH(R.conclusion === "leading" ? "change.concl.leading" : "change.concl.rank", { k: txInt(b.lead), r: txInt(b.rank), target: jnTNameText(JN.tid) }, { place: jnPlace(JN.i) });
  return `<h3 class="jn-h">${esc(tx("change.title"))}</h3><p>${esc(tx("change.p"))}</p>
    <div class="jn-concl"><span class="meta">${esc(tx("change.tested"))}</span><p>${concl}</p></div>
    <div class="jn-robust rb-${R.robustness.label}" data-robust="${R.robustness.label}"><b>${esc(tx("robust." + R.robustness.label))}</b><span>${esc(tx("robust.detail", { h: txInt(R.robustness.hold), n: txInt(R.robustness.tested) }))}</span></div>
    <details class="jn-det"><summary>${esc(tx("robust.rule_t"))}</summary><p class="jn-note">${esc(tx("robust.rule"))}</p></details>
    <p class="jn-verdict">${esc(tx(R.nHold === R.nAlternatives ? "change.verdict.all" : "change.verdict.some", { h: txInt(R.nHold), n: txInt(R.nAlternatives), lo: txInt(R.bestRank), hi: txInt(R.worstRank) }))}</p>
    <p class="jn-note" data-ties="${R.nearTies.length}">${R.nearTies.length ? txH("robust.ties", { k: txInt(R.nearTies.length) }, { list: R.nearTies.slice(0, 4).map(t => jnPlace(t.i) + " (" + esc((t.delta >= 0 ? "+" : "−") + txNum(Math.abs(100 * t.delta), 2)) + ")").join(", ") }) : esc(tx("robust.no_ties"))}</p>
    ${br.length ? `<h4 class="jn-h4">${esc(tx("change.would"))}</h4><ul class="jn-alts">${br.map(jnAltRow).join("")}</ul>` : `<p>${esc(tx("change.none_breaks"))}</p>`}
    ${ok.length ? `<details class="jn-det"><summary>${esc(tx("change.would_not", { n: txInt(ok.length) }))}</summary><ul class="jn-alts">${ok.map(jnAltRow).join("")}</ul></details>` : ""}
    <p class="jn-note">${esc(tx("change.note"))}</p>`;
}

/* ---------- Find the missing piece ---------- */
function jnMissingItems(ctx, L) {
  const i = JN.i, [dy, dx] = cellDims(i);
  return JE.missing(ctx, i, jnW(), { lens: L, change: JN.cm.get(jnCmKey()) || null, modisCoverage: S.A.modis_coverage ? S.A.modis_coverage[i] : null, cellKm: [dy, dx], targetWindowKm: (S.T[JN.tid].location || {}).window_km || null });
}
function jnMissingText(m) {
  const v = { criterion: m.c ? tx("crit." + m.c + ".s") : "", status: m.status ? tx("status." + m.status) : "", t: m.target != null ? txNum(m.target, 1) : "", lo: m.earthMin != null ? txNum(m.earthMin, 1) : "", hi: m.earthMax != null ? txNum(m.earthMax, 1) : "", s: m.bestS != null ? txNum(m.bestS, 2) : "",
    pct: m.value != null ? txPct(m.value, 0) : "", r: m.rank != null ? txInt(m.rank) : "—", list: m.criteria ? txList(m.criteria.map(c => tx("crit." + c + ".s"))) : "",
    km: m.km ? txNum(m.km[0], 0) + " × " + txNum(m.km[1], 0) : "", tkm: m.targetKm ? txNum(m.targetKm, 1) : "", unit: m.c ? unitOf(m.c) : "" };
  let key = "missing." + m.kind; if (m.kind === "structural") key += m.outside ? "." + m.outside : ".none";
  if (m.kind === "resolution" && !m.targetKm) key += ".notarget";
  return txH(key, v, { source: m.source ? jnDsName(m.source) : "" });
}
function jnMissingLink(m) {
  const L = m.link || {};
  if (L.type === "dataset") return L.ids.map(id => { const d = jnDataset(id); return d.url ? `<a class="jn-lnk" href="${esc(d.url)}" target="_blank" rel="noopener">${jnDsName(id)} ↗</a>` : jnDsName(id); }).join(" ");
  if (L.type === "sensitivity") return `<button class="jn-lnk" data-jnsec="change" data-alt="${esc(L.alternative)}">${esc(tx("missing.see_change"))}</button>`;
  if (L.type === "target_sources") { const meth = m.c ? String((S.T[JN.tid].methodology || {})[m.c] || "") : ""; return `${meth ? `<span class="jn-meth">${esc(tx("missing.method"))} ${keep(meth.length > 220 ? meth.slice(0, 217) + "…" : meth)}</span>` : ""}<button class="jn-lnk" data-jnsec="trust">${esc(tx("missing.see_target"))}</button>`; }
  return `<button class="jn-lnk" data-jnsec="trust">${esc(tx("missing.see_rule"))}</button>`;
}
function jnMissingView(ctx, L) {
  const items = jnMissingItems(ctx, L), cmDone = JN.cm.has(jnCmKey());
  const sev = { gap: "✕", caution: "!", info: "i" };
  return `<h3 class="jn-h">${esc(tx("missing.title"))}</h3><p>${esc(tx("missing.p"))}</p>${jnCoverageMeter(ctx, L)}
    <ul class="jn-check">${items.map(m => `<li class="sev-${m.severity}" data-miss="${esc(m.id)}"><span class="jn-sev" aria-hidden="true">${sev[m.severity]}</span><div><span class="jn-sevl">${esc(tx("missing.sev." + m.severity))}</span><p>${jnMissingText(m)}</p><div class="jn-links">${jnMissingLink(m)}</div></div></li>`).join("")}</ul>
    ${cmDone ? "" : `<p class="jn-note">${esc(tx("missing.run_change"))} <button class="jn-lnk" data-jnsec="change">${esc(tx("sec.change"))}</button></p>`}`;
}

/* the share of the active weight that has an Earth value here, against the 80 % ranking rule; and the same for the
 * leading sites, so poor similarity and "cannot be evaluated" are never confused */
function jnCoverageMeter(ctx, L) {
  const act = L.rows.filter(r => r.t != null && r.w > 0), tot = act.reduce((t, r) => t + r.w, 0), cov = L.coverage, ok = cov >= 0.8 - 1e-12;
  const eff = ctx.effFor(jnW()), lead = JE.leaders(eff, ctx, 10), full = lead.filter(j => JE.lens(ctx, j, jnW()).coverage >= 1 - 1e-12).length;
  return `<div class="jn-cov" data-cov="${cov.toFixed(4)}"><div class="jn-covh"><b>${esc(tx("cov.title"))}</b><span class="${ok ? "ok" : "no"}">${esc(tx(ok ? "cov.ranked" : "cov.not_ranked", { p: txPct(cov, 0) }))}</span></div>
    <div class="jn-covbar" role="img" aria-label="${esc(tx("cov.aria", { p: txPct(cov, 0) }))}"><i style="width:${(100 * clamp(cov, 0, 1)).toFixed(1)}%"></i><b style="left:80%" title="${esc(tx("cov.rule"))}"></b></div>
    <ul class="jn-covl">${act.map(r => `<li class="${r.e == null ? "gap" : ""}"><span aria-hidden="true">${r.e == null ? "✕" : "✓"}</span>${jnCrit(r.c)} <span class="meta">${esc(txPct(r.w / tot, 0))} ${esc(tx("cov.of_weight"))}${r.e == null ? " · " + esc(tx("cov.missing")) : ""}</span></li>`).join("")}</ul>
    <p class="jn-note">${esc(tx(ok ? "cov.note_ok" : "cov.note_no"))} ${esc(tx("cov.leaders", { k: txInt(full), n: txInt(lead.length) }))}</p></div>`;
}
/* ---------- Science Trust View ---------- */
function jnTrustView(ctx, L) {
  const i = JN.i, T = S.T[JN.tid], cm = JN.cm.get(jnCmKey()) || null;
  const tr = JE.trust(ctx, i, jnW(), { lens: L, change: cm && !cm.error ? cm : null, modisCoverage: S.A.modis_coverage ? S.A.modis_coverage[i] : null, landFraction: S.A.gmted_land_fraction ? S.A.gmted_land_fraction[i] : null, stackSha: S.app.stack.sha256, stackVerified: S.hashOK === true, targetSources: T.sources });
  const row = (id, sum, body) => `<details class="jn-trow" data-trust="${id}"><summary><span class="jn-tk">${esc(tx("trust." + id))}</span><span class="jn-tv">${sum}</span></summary><div class="jn-tb">${body}</div></details>`;
  const R = Object.fromEntries(tr.rows.map(r => [r.id, r]));
  const m = R.measurements, c = R.coverage, l = R.limits, rb = R.robustness, rp = R.reproducibility, so = R.sources;
  return `<h3 class="jn-h">${esc(tx("trust.title"))}</h3><p>${esc(tx("trust.p"))}</p>
    ${row("measurements", esc(tx("trust.measurements.sum", { d: txInt(m.direct), p: txInt(m.proxy), n: txInt(m.active) })), `<p>${esc(tx("trust.measurements.body"))}</p>${jnRowsTable(L.rows.filter(r => r.t != null), [r => `<th scope="row">${jnCrit(r.c)}</th>`, r => `<td>${jnStatusChip(r.status)}</td>`, r => `<td class="meta">${keep(String((T.methodology || {})[r.c] || "").slice(0, 160))}</td>`])}<p class="jn-note">${esc(tx("trust.method_en"))}</p>`)}
    ${row("coverage", esc(tx("trust.coverage.sum", { pct: txPct(c.value, 0) })), `<p>${esc(tx("trust.coverage.body", { modis: txPct(c.modis, 0), land: txPct(c.land, 0) }))}</p>${c.missing.length ? `<p>${esc(tx("trust.coverage.missing", { list: txList(c.missing.map(x => tx("crit." + x + ".s"))) }))}</p>` : ""}`)}
    ${row("limits", esc(l.structural.length ? tx("trust.limits.sum_some", { list: txList(l.structural.map(x => tx("crit." + x + ".s"))) }) : tx("trust.limits.sum_none")), `<p>${esc(tx("trust.limits.body"))}</p>`)}
    ${row("robustness", esc(rb.available ? tx("trust.robustness.sum", { h: txInt(rb.hold), n: txInt(rb.total) }) : tx("trust.robustness.sum_na")), `<p>${esc(tx("trust.robustness.body"))}</p>${rb.available ? "" : `<button class="jn-lnk" data-jnsec="change">${esc(tx("sec.change"))}</button>`}`)}
    ${row("reproducibility", `${keep(rp.algorithm)} · ${keep(rp.config || "")}`, `<p>${esc(tx("trust.reproducibility.body", { sha: rp.stack.slice(0, 16) }))} ${rp.verified ? "✓ " + esc(tx("trust.verified")) : esc(tx("trust.not_verified"))}</p>`)}
    ${row("sources", so.earth.map(jnDsName).join(", "), `<p>${esc(tx("trust.sources.body"))}</p><ul class="jn-ul">${so.earth.map(id => { const d = jnDataset(id); return `<li>${jnDsName(id)} — ${keep(d.version || "")} ${d.url ? `<a class="jn-lnk" href="${esc(d.url)}" target="_blank" rel="noopener">↗</a>` : ""}</li>`; }).join("")}${T.sources.map((x, k) => `<li>${keep(x)} ${T.source_urls[k] ? `<a class="jn-lnk" href="${esc(T.source_urls[k])}" target="_blank" rel="noopener">↗</a>` : ""}</li>`).join("")}</ul>`)}
    ${row("calculation", esc(tx("trust.calc.sum", { s: txPct(JE.calculation(ctx, i, jnW()).score, 2) })), jnCalcTable(ctx, i))}
    ${row("scope", esc(tx("trust.scope.sum")), `<p>${esc(tx("trust.scope.body"))}</p>`)}
    <p class="jn-note">${esc(tx("trust.no_score"))}</p>`;
}

function jnCalcTable(ctx, i) {
  const C = JE.calculation(ctx, i, jnW()), f = (x, d) => x == null ? "—" : esc(txNum(x, d));
  return `<p class="jn-formula i18n-keep" translate="no">d<sub>c</sub> = |e<sub>c</sub> − t<sub>c</sub>| / (max<sub>c</sub> − min<sub>c</sub>) · s<sub>c</sub> = clip(1 − d<sub>c</sub>, 0, 1) · k<sub>c</sub> = w<sub>c</sub>·s<sub>c</sub> / Σw · S = Σk<sub>c</sub></p>
    <div class="jn-scroll"><table class="jn-t jn-calc"><thead><tr><th>${esc(tx("calc.c"))}</th><th class="n i18n-keep">e</th><th class="n i18n-keep">t</th><th class="n i18n-keep">d</th><th class="n i18n-keep">s</th><th class="n i18n-keep">w</th><th class="n i18n-keep">k</th></tr></thead><tbody>
    ${C.rows.map(r => `<tr${r.k == null ? ' class="off"' : ""}><th scope="row">${esc(tx("crit." + r.c + ".short"))}</th><td class="n">${r.e == null ? esc(tx("val.na")) : f(r.e, 3)}</td><td class="n">${r.t == null ? "N/A" : f(r.t, 3)}</td><td class="n">${f(r.d, 4)}</td><td class="n">${f(r.s, 4)}</td><td class="n">${f(r.w, 2)}</td><td class="n">${f(r.k, 4)}</td></tr>`).join("")}
    <tr class="sum"><th scope="row">Σ</th><td></td><td></td><td></td><td></td><td class="n">${f(C.wsum, 2)}</td><td class="n">${f(C.sumK, 4)}</td></tr></tbody></table></div>
    <p class="jn-note">${esc(tx("calc.notes", { cov: txPct(C.coverage, 0), tot: txNum(C.totalW, 2), ws: txNum(C.wsum, 2) }))}</p>`;
}
/* ---------- Other worlds: one Earth place against every scoring target ---------- */
function jnWorldsView() {
  const w = jnW(), ids = jnTargets();
  const rows = ids.map(tid => { const c = jnCtx(tid), eff = c.effFor(w), L = JE.lens(c, JN.i, w); return { tid, score: eff[JN.i] >= 0 ? eff[JN.i] : null, rank: JE.rank(eff, S.cell, JN.i), n: JE.nEligible(eff), L, config: c.config }; })
    .sort((a, b) => ((a.rank ?? 1e9) - (b.rank ?? 1e9)) || (a.tid < b.tid ? -1 : 1));
  const regMsg = typeof A4 !== "undefined" && !A4.reg ? `<p class="jn-note">${esc(tx(A4.err ? "worlds.registry_err" : "home.loading_registry"))}</p>` : "";
  return `<h3 class="jn-h">${esc(tx("worlds.title"))}</h3><p>${esc(tx("worlds.p", { n: txInt(rows.length) }))}</p>${regMsg}
    <ul class="jn-worlds">${rows.map(r => `<li${r.tid === JN.tid ? ' class="on"' : ""}><button class="jn-wbtn" data-jn="settid" data-tid="${r.tid}" aria-label="${esc(tx("worlds.open", { target: jnTNameText(r.tid) }))}"><span class="jn-wb">${esc(jnBody(r.tid))}</span><span class="jn-wn">${jnTName(r.tid)}</span>
      <span class="jn-wbar"><i style="width:${(100 * clamp(r.score || 0, 0, 1)).toFixed(1)}%"></i></span><span class="jn-ws">${esc(txPct(r.score))}</span><span class="jn-wr">${esc(txRank(r.rank))}</span></button>
      <div class="jn-wmeta">${esc(tx("worlds.compared", { k: txInt(r.L.compared), n: txInt(S.critIds.length) }))}${r.L.groups.na.length ? " · " + esc(tx("worlds.not_compared", { list: txList(r.L.groups.na.map(c => tx("crit." + c + ".s"))) })) : ""} · ${keep(r.config)}</div></li>`).join("")}</ul>
    <p class="jn-note">${esc(tx("worlds.note"))}</p>`;
}

/* ---------- Through time (where yearly data exist) ---------- */
function jnTimeView() {
  const tid = JN.tid, w = jnW();
  const ev = a4With(tid, () => evolution(tid, JN.i, w));
  const pts = ev.series.filter(o => o.score != null && o.score >= 0);
  if (!pts.length) return `<h3 class="jn-h">${esc(tx("time.title"))}</h3><p>${esc(tx("time.none"))}</p>`;
  const W = innerWidth < 600 ? 360 : 620, H = 200, x0 = 46, x1 = W - 12, y0 = 20, y1 = H - 34, sc = pts.map(p => p.score), lo = Math.min(...sc), hi = Math.max(...sc), pad = Math.max(0.01, (hi - lo) * 0.25);
  const a = lo - pad, b = hi + pad, n = ev.series.length;
  const sx = k => x0 + (x1 - x0) * (n === 1 ? 0.5 : k / (n - 1)), sy = v => y1 - (y1 - y0) * (v - a) / (b - a);
  let g = `<line x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}" class="trk"/>`, d = "";
  ev.series.forEach((o, k) => { g += `<text x="${sx(k).toFixed(1)}" y="${H - 14}" class="ax" text-anchor="middle">${esc(txNum(o.year, 0, { useGrouping: false }))}</text>`; if (o.score != null && o.score >= 0) { d += (d ? "L" : "M") + sx(k).toFixed(1) + " " + sy(o.score).toFixed(1); g += `<circle cx="${sx(k).toFixed(1)}" cy="${sy(o.score).toFixed(1)}" r="3.5" class="em"><title>${esc(txNum(o.year, 0, { useGrouping: false }))}: ${esc(txPct(o.score))} · ${esc(txNum(o.lst, 1))} K</title></circle>`; } });
  g += `<text x="${x0 - 6}" y="${sy(hi).toFixed(1)}" class="ax" text-anchor="end">${esc(txPct(hi))}</text><text x="${x0 - 6}" y="${(sy(lo) + 4).toFixed(1)}" class="ax" text-anchor="end">${esc(txPct(lo))}</text>`;
  const cls = ev.cls === "STABLE ANALOGUE" ? "stable" : ev.cls === "VARIABLE ANALOGUE" ? "variable" : "none";
  return `<h3 class="jn-h">${esc(tx("time.title"))}</h3><p>${esc(tx("time.p"))}</p>
    <figure class="jn-fig"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tx("time.svg", { n: txInt(pts.length) }))}"><path d="${d}" class="ln"/>${g}</svg></figure>
    <p class="jn-verdict">${esc(tx("time.cls." + cls, { pts: ev.rangePts == null ? "—" : txNum(ev.rangePts, 1), thr: txNum(S.app.thresholds.evolution_stable_pts, 1), years: txInt(ev.years) }))}</p>
    <p class="jn-note">${esc(tx("time.note"))}</p>`;
}

/* ---------- Earth Analogue Passport ---------- */
function jnPassportData(ctx, L) {
  const i = JN.i, w = jnW(), eff = ctx.effFor(w), T = S.T[JN.tid], cm = JN.cm.get(jnCmKey()) || null, p = placeName(i);
  return JE.passport(ctx, i, w, { lens: L, created: new Date().toISOString(), place: p.primary, country: p.secondary, targetName: T.name, body: T.body, fingerprint: T.fingerprint_sha256 || null,
    profile: JN.pid, rank: JE.rank(eff, S.cell, i), nEligible: JE.nEligible(eff), lead: JE.leadPos(eff, ctx, i, 10), change: cm && !cm.error ? cm : null,
    missing: jnMissingItems(ctx, L), earthDatasets: Array.from(new Set(L.rows.flatMap(r => ctx.earthSource[r.c]))).map(id => { const d = jnDataset(id); return { id, dataset: d.dataset, version: d.version, url: d.url }; }),
    targetSources: T.sources.map((s, k) => ({ name: s, url: T.source_urls[k] || null })), stackSha: S.app.stack.sha256 });
}
function jnPassportView(ctx, L) {
  const P = jnPassportData(ctx, L), re = JE.rescore(P), same = re != null && Math.abs(re - P.result.analogue_score) < 1e-9;
  JN.passport = P;
  const chips = L.rows.map(r => `<li class="s-${r.state}"><b aria-hidden="true">${JN_GLYPH[r.state]}</b><span>${esc(tx("crit." + r.c + ".short"))}</span><em>${esc(tx("state." + r.state))}</em></li>`).join("");
  return `<h3 class="jn-h">${esc(tx("passport.title"))}</h3><p>${esc(tx("passport.p"))}</p>
    <div class="jn-pass" id="jn-pass"><div class="jn-pass-top"><span class="jn-pass-brand">ASTERRO</span><span>${esc(tx("passport.kicker"))}</span></div>
      <h4>${jnPlace(JN.i)}</h4><p class="jn-where">${esc(txLL(S.lat[JN.i], S.lon[JN.i]))} · ${esc(tx("place.cell", { id: txInt(S.cell[JN.i]) }))}</p>
      <div class="jn-pass-mid"><div><span class="meta">${esc(tx("passport.analogue_of"))}</span><b>${esc(jnBody(JN.tid))} · ${jnTName(JN.tid)}</b></div><div class="jn-score"><b>${esc(txPct(P.result.analogue_score))}</b><span>${esc(tx("place.score_label"))}</span></div></div>
      <ul class="jn-pchips">${chips}</ul>
      <p class="jn-pfine">${esc(tx("passport.config", { profile: tx(JN.pid === "custom" ? "profile.custom" : "profile." + JN.pid), rank: P.result.cell_rank == null ? "—" : txInt(P.result.cell_rank), n: txInt(P.result.eligible_cells) }))} · ${keep(P.target.scoring_config)} · ${keep(P.generator.algorithm)} · ${keep("stack " + P.reproducibility.predictor_stack_sha256.slice(0, 12))}</p>
      <p class="jn-pfine">${esc(tx("passport.disclaimer"))}</p></div>
    <p class="jn-note">${esc(tx(same ? "passport.rescore_ok" : "passport.rescore_bad", { s: txPct(re, 4) }))}</p>
    <div class="jn-act"><button class="jn-btn" data-jn="pjson">${esc(tx("passport.json"))}</button><button class="jn-btn ghost" data-jn="ppng">${esc(tx("passport.png"))}</button><button class="jn-btn ghost" data-jn="pprint">${esc(tx("passport.print"))}</button><button class="jn-btn ghost" data-jn="psave">${esc(tx("passport.save"))}</button></div>
    <p class="jn-note" id="jn-pmsg" role="status"></p>`;
}
function jnDownload(name, blob) {
  const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 1500);
}
function jnFileBase() { return `asterro-passport-${S.cell[JN.i]}-${JN.tid}`; }
function jnPassportJSON() { const P = JN.passport; if (!P) return; jnDownload(jnFileBase() + ".json", new Blob([JSON.stringify(P, null, 2)], { type: "application/json" })); jnMsg(tx("passport.saved_json")); }
function jnPassportPNG() {
  const P = JN.passport; if (!P) return;
  const c = document.createElement("canvas"), W = 1200, H = 675; c.width = W; c.height = H;
  const g = c.getContext("2d"), css = getComputedStyle(document.documentElement);
  const col = n => (css.getPropertyValue(n) || "").trim() || "#E6E9EC";
  const F = (wgt, px) => `${wgt} ${px}px "Instrument Sans", "Noto Sans Bengali", system-ui, sans-serif`;
  const accent = (S.T[JN.tid].body || "").toLowerCase() === "moon" ? col("--moon") : col("--mars");
  g.fillStyle = "#090B0E"; g.fillRect(0, 0, W, H);
  g.fillStyle = accent; g.fillRect(0, 0, 10, H);
  g.fillStyle = "#A4AEB9"; g.font = F(600, 22); g.fillText("ASTERRO · " + tx("passport.kicker"), 60, 70);
  g.fillStyle = "#E6E9EC"; g.font = F(700, 56); g.fillText(jnPlaceText(JN.i).slice(0, 44), 60, 160);
  g.fillStyle = "#A4AEB9"; g.font = F(500, 24); g.fillText(`${txLL(S.lat[JN.i], S.lon[JN.i])} · ${tx("place.cell", { id: txInt(S.cell[JN.i]) })}`, 60, 205);
  g.fillStyle = "#A4AEB9"; g.font = F(500, 22); g.fillText(tx("passport.analogue_of"), 60, 280);
  g.fillStyle = "#E6E9EC"; g.font = F(700, 34); g.fillText(`${jnBody(JN.tid)} · ${jnTNameText(JN.tid)}`.slice(0, 48), 60, 325);
  g.fillStyle = accent; g.font = F(700, 96); g.textAlign = "right"; g.fillText(txPct(P.result.analogue_score), W - 60, 330);
  g.fillStyle = "#A4AEB9"; g.font = F(500, 20); g.fillText(tx("place.score_label"), W - 60, 365); g.textAlign = "left";
  const sc = { similar: "#8CC08F", partial: "#D8B45B", different: "#D9705F", unknown: "#A4AEB9", na: "#6C7783", off: "#6C7783" };
  P.criteria.forEach((r, k) => {
    const x = 60 + k * 182, y = 420;
    g.strokeStyle = sc[r.state]; g.lineWidth = 2; g.strokeRect(x, y, 168, 96);
    g.fillStyle = sc[r.state]; g.font = F(700, 30); g.fillText(JN_GLYPH[r.state], x + 14, y + 40);
    g.fillStyle = "#E6E9EC"; g.font = F(600, 19); g.fillText(tx("crit." + r.id + ".short").slice(0, 16), x + 14, y + 66);
    g.fillStyle = "#A4AEB9"; g.font = F(500, 16); g.fillText(tx("state." + r.state).slice(0, 20), x + 14, y + 86);
  });
  g.fillStyle = "#A4AEB9"; g.font = F(500, 17);
  g.fillText(`${tx("passport.config", { profile: tx(JN.pid === "custom" ? "profile.custom" : "profile." + JN.pid), rank: P.result.cell_rank == null ? "—" : txInt(P.result.cell_rank), n: txInt(P.result.eligible_cells) })} · ${P.target.scoring_config} · ${P.generator.algorithm}`.slice(0, 120), 60, 570);
  g.fillText(`${P.schema} · stack ${P.reproducibility.predictor_stack_sha256.slice(0, 16)} · ${P.created.slice(0, 10)}`, 60, 600);
  g.fillStyle = "#6C7783"; g.font = F(500, 15); g.fillText(tx("passport.disclaimer_short"), 60, 635);
  c.toBlob(b => { if (b) { jnDownload(jnFileBase() + ".png", b); jnMsg(tx("passport.saved_png")); } }, "image/png");
}
function jnPassportPrint() { document.body.classList.add("jn-printing"); const done = () => { document.body.classList.remove("jn-printing"); window.removeEventListener("afterprint", done); }; window.addEventListener("afterprint", done); try { window.print(); } catch (e) { } setTimeout(done, 1500); }
async function jnPassportSave() {
  const P = JN.passport; if (!P) return;
  const reg = await a4Load();
  if (!reg || !A4.ix) { jnMsg(tx("passport.save_unavailable")); return; }
  const i = JN.i, tid = JN.tid, w = jnW();
  jnClose();
  a4SaveItem({ kind: "earth_cell", cell: S.cell[i], lat: S.lat[i], lon: S.lon[i], place: placeStr(i), target: A4.ix.targets[tid] ? tid : undefined,
    note: `Analogue Passport · ${S.app.profiles[JN.pid] ? S.app.profiles[JN.pid].label : "custom weights"} · score ${(100 * P.result.analogue_score).toFixed(1)}%`,
    snapshot: RG.snapshot(A4.ix, A4.ix.targets[tid] ? [tid] : [], { profile: JN.pid, weights: w, algorithm: S.app.algorithm_version, scoring_config: P.target.scoring_config, passport_schema: P.schema }) });
  setTab("atlas");
}
function jnMsg(m) { const e = $("#jn-pmsg"); if (e) e.textContent = m; jnLive(m); }

/* ---------- Team of Earth places ---------- */
function jnTeamView() {
  const tid = JN.tid, w = jnW(), ctx = jnCtx(tid), T = JE.team(ctx, w);
  const tsel = `<label class="jn-field"><span>${esc(tx("place.target"))}</span><select data-jnin="tid">${jnTargets().map(id => `<option value="${id}"${id === tid ? " selected" : ""}>${esc(jnBody(id))} · ${esc(jnTNameText(id))}</option>`).join("")}</select></label>`;
  return `<div class="jn-pad"><p class="jn-lead">${esc(tx("team.p", { target: jnTNameText(tid) }))}</p><div class="jn-ctrls">${tsel}</div>
    <p class="jn-verdict">${esc(tx("team.verdict", { k: txInt(T.members.length), m: txInt(T.covered.length), n: txInt(T.criteria.length) }))}</p>
    <ol class="jn-team">${T.members.map(m => `<li><div><b>${jnPlace(m.i)}</b><div class="meta">${esc(txLL(S.lat[m.i], S.lon[m.i]))} · ${esc(tx("team.score", { s: txPct(m.score) }))}</div>
      <p>${esc(tx("team.adds", { list: txList(m.adds.map(c => tx("crit." + c + ".s"))) }))}${m.matches.length > m.adds.length ? " " + esc(tx("team.also", { list: txList(m.matches.filter(c => !m.adds.includes(c)).map(c => tx("crit." + c + ".s"))) })) : ""}</p></div>
      <button class="jn-btn ghost" data-jn="why" data-i="${m.i}" data-tid="${tid}" data-pid="${JN.pid}">${esc(tx("story.explore_why"))}</button></li>`).join("")}</ol>
    ${T.unmatchable.length ? `<p class="jn-callout">${esc(tx("team.unmatchable", { list: txList(T.unmatchable.map(c => tx("crit." + c + ".s"))) }))}</p>` : ""}
    ${T.uncovered.filter(c => !T.unmatchable.includes(c)).length ? `<p class="jn-note">${esc(tx("team.uncovered"))}</p>` : ""}
    <p class="jn-note">${esc(tx("team.note"))}</p>${jnReviewNote()}</div>`;
}

/* ---------------------------------------------------------------- events */
function jnClick(e) {
  const b = e.target.closest("[data-jn],[data-jnsec],[data-jnstep],[data-jnpid]"); if (!b || b.disabled) return;
  if (b.dataset.jnsec) { JN.sec = b.dataset.jnsec; if (JN.sec === "reveal" && b.closest(".jn-tabs")) JN.step = JN.step || 0; jnRender(); const t = $("#jn-tab-" + JN.sec); if (t) t.focus(); if (b.dataset.alt) { const r = $(`[data-alt="${CSS.escape(b.dataset.alt)}"]`); if (r) r.classList.add("flash"); } return; }
  if (b.dataset.jnstep != null) { JN.step = +b.dataset.jnstep; jnRender(); const h = $("#jn-step-h"); if (h) h.focus(); return; }
  if (b.dataset.jnpid) { JN.pid = b.dataset.jnpid; jnRender(); const r = $(`[data-jnpid="${JN.pid}"]`); if (r) r.focus(); jnLive(tx("lens.switched", { profile: tx("profile." + JN.pid) })); return; }
  const a = b.dataset.jn;
  if (a === "close") jnClose();
  else if (a === "home") { JN.view = "home"; jnRender(); $("#jn-title").focus(); }
  else if (a === "why") { jnOpen("place", { i: +b.dataset.i, tid: b.dataset.tid, pid: b.dataset.pid || "general", sec: "reveal", step: 0 }); }
  else if (a === "view") { JN.view = b.dataset.view; if (b.dataset.tid) JN.tid = b.dataset.tid; jnRender(); $("#jn-title").focus(); if (typeof jlMark === "function") jlMark("view:" + JN.view); }
  else if (a === "team") { JN.tid = b.dataset.tid || JN.tid; JN.pid = "general"; JN.view = "team"; jnRender(); $("#jn-title").focus(); }
  else if (a === "next") jnStep(1); else if (a === "prev") jnStep(-1);
  else if (a === "skip") { JN.step = 6; jnRender(); const h = $("#jn-step-h"); if (h) h.focus(); }
  else if (a === "settid") { JN.tid = b.dataset.tid; jnRender(); jnLive(tx("place.target_set", { target: jnTNameText(JN.tid) })); }
  else if (a === "globe") jnShowOnGlobe();
  else if (a === "pjson") jnPassportJSON(); else if (a === "ppng") jnPassportPNG(); else if (a === "pprint") jnPassportPrint(); else if (a === "psave") jnPassportSave();
}
function jnChange(e) {
  const s = e.target.closest("[data-jnin]"); if (!s) return;
  if (s.dataset.jnin === "tid") { JN.tid = s.value; jnRender(); const n = $(`[data-jnin="tid"]`); if (n) n.focus(); jnLive(tx("place.target_set", { target: jnTNameText(JN.tid) })); }
  else if (s.dataset.jnin === "pid") { JN.pid = s.value; jnRender(); const n = $(`[data-jnin="pid"]`); if (n) n.focus(); jnLive(tx("lens.switched", { profile: tx(JN.pid === "custom" ? "profile.custom" : "profile." + JN.pid) })); }
}
function jnShowOnGlobe() {
  const i = JN.i, tid = JN.tid; jnClose();
  if (S.targetId !== tid) setTarget(tid);
  const go = () => { setTab("explore"); select(i, true); };
  if (!S.searched) runSearch().then(go); else go();
}
document.addEventListener("click", e => { const o = e.target.closest("[data-jn-open]"); if (!o) return; const v = o.dataset.jnOpen;
  if (v === "home") jnOpen("home"); else if (v === "place") { const i = S.selected ?? S.picked; if (i != null) jnOpen("place", { i, tid: S.targetId === "cross" ? "mars_jezero" : S.targetId, pid: S.profile === "custom" ? "custom" : S.profile, sec: "reveal", step: 0 }); } });
document.addEventListener("keydown", e => { if (JN.open) jnKeys(e); }, true);
document.addEventListener("asterro:lang", () => { if (JN.open) { const f = document.activeElement && document.activeElement.id; jnRender(); const t = f && document.getElementById(f); (t || $("#jn-title")).focus(); } });
/* a registry load adds targets (Shackleton story, Other worlds); refresh an open journey */
if (typeof a4Load === "function") { const _jnA4Load = a4Load; a4Load = async function () { const r = await _jnA4Load.apply(this, arguments); if (JN.open) { JN.stories = null; jnRender(); } return r; }; }

/* ---------------------------------------------------------------- entry points (additive) */
(function jnEntry() {
  const hs = $("#hero-search");
  if (hs && !$("#hero-journey")) {
    const b = document.createElement("button"); b.className = "btn-ghost btn-discover"; b.id = "hero-journey"; b.textContent = tx("cta.journey");
    b.setAttribute("data-jn-open", "home"); hs.insertAdjacentElement("beforebegin", b);
  }
})();
/* right panel: "Explain this place" beside Trace / Report for a selected cell */
const _jnSelectedHeader = selectedHeader;
selectedHeader = function (i) {
  const h = _jnSelectedHeader.apply(this, arguments);
  return h.replace(`<button class="btn-sm" data-act="trace">Trace result</button>`, `<button class="btn-sm jn-explain" data-jn-open="place">${esc(tx("cta.explain"))}</button><button class="btn-sm" data-act="trace">Trace result</button>`);
};
/* Discover tab: a door into the guided discoveries */
const _jnViewDiscover = viewDiscover;
viewDiscover = function () { return `<div class="sec"><div class="callout jn-door"><b>${esc(tx("door.title"))}</b> ${esc(tx("door.p"))} <button class="btn-sm" data-jn-open="home">${esc(tx("cta.journey"))}</button></div></div>` + _jnViewDiscover.apply(this, arguments); };
