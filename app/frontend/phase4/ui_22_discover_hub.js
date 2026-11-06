/* ===== Discover: the discovery hub =====
 * The Discover tab keeps its constellations, graph, latitude histogram and evolution (the first view, unchanged) and
 * gains, behind one row of buttons: Temperature extremes (the extended fingerprint), Processes (Planetary Process
 * Explorer), Beyond the familiar, Mission profiles (extended) and Learn. No new top-level tab. */
const XHUB = ["constellations", "thermal", "processes", "beyond", "profiles", "learn"];
function xtHubNav() {
  return `<div class="sec" data-i18n-done><nav class="xt-hub" aria-label="${esc(tx("ext.hub.aria"))}">${XHUB.map(h => `<button type="button" data-xhub="${h}" aria-pressed="${XT.hub === h}">${esc(tx("ext.hub." + h))}</button>`).join("")}</nav></div>`;
}
{ const f = viewDiscover; viewDiscover = function () {
  if (!XD || !XC() || !S.A || !S.A.cell) return f.apply(this, arguments);
  let body;
  try {
    body = XT.hub === "constellations" ? f.apply(this, arguments)
      : `<div data-i18n-done>${({ thermal: xtHubThermal, processes: xtHubProcesses, beyond: xtHubBeyond, profiles: xtHubProfiles, learn: xtHubLearn })[XT.hub]()}</div>`;
  } catch (e) { console.error(e); body = `<div class="sec"><div class="callout">${esc(tx("ext.err", { m: e.message }))}</div></div>`; }
  return xtHubNav() + body;
}; }
function xtRerender() { if (S.tab === "discover") renderLeft(); }
function xtTidSel(id, cur) {
  return `<label class="xt-field"><span>${esc(tx("ext.target"))}</span><select data-xtin="${id}">${xtTargets().map(t => `<option value="${t}"${t === cur ? " selected" : ""}>${esc(jnBody(t))} · ${esc(jnTNameText(t))}</option>`).join("")}</select></label>`;
}
function xtCurTid() { if (!XT.tid || !xtHas(XT.tid)) XT.tid = xtHas(S.targetId) ? S.targetId : "mars_jezero"; return XT.tid; }
function xtPlaceBtn(i) { return `<button class="jn-lnk" data-xtsel="${i}">${jnPlace(i)}</button>`; }

/* ---------------------------------------------------------------- temperature extremes (extended fingerprint) */
function xtDp(g) { return g < 0.1 ? 2 : 1; }
function xtHubThermal() {
  const tid = xtCurTid(), w = xtWeights(S.weights, XT.w3), f = xtField(tid, w), T = f.T;
  const base = simFor(tid, S.weights), bo = ENG.order(base.eff, S.cell), bs = ENG.distinctSites(bo, S.lat, S.lon, 10, S.app.thresholds.distinct_sep_km);
  const brank = new Int32Array(S.n); for (let k = 0; k < bo.length; k++) brank[bo[k]] = k + 1;
  const lim = XC().EXT.map(c => {
    const t = T.tv[c], [lo, hi] = XT.earth[c];
    if (t == null) return `<li data-xtlim="${c}">${xtDimName(c)}: <span class="xt-st na">${esc(tx("ext.th.na"))}</span> <span class="meta">${esc(tx("ext.th.na_moon"))}</span></li>`;
    const out = t < lo ? "below" : t > hi ? "above" : null;
    return `<li data-xtlim="${c}" class="${out ? "out" : ""}">${xtDimName(c)}: ${esc(tx("ext.th.target_is"))} ${xtK(t)} · ${esc(tx("ext.th.earth_range", { lo: txNum(lo, 1), hi: txNum(hi, 1) }))}${out ? ` — <b>${esc(tx("ext.th.outside_" + out, { gap: txNum(out === "below" ? lo - t : t - hi, xtDp(out === "below" ? lo - t : t - hi)), lim: txNum(out === "below" ? lo : hi, xtDp(out === "below" ? lo - t : t - hi)) }))}</b>` : ""}</li>`;
  }).join("");
  const wIn = XC().EXT.map(c => `<label class="xt-w"><span>${xtDimName(c)}</span><select data-xtw="${c}" ${T.tv[c] == null ? "disabled" : ""}>${[0, 0.5, 1, 2, 3].map(v => `<option value="${v}"${+XT.w3[c] === v ? " selected" : ""}>${esc(txNum(v, v % 1 ? 1 : 0))}</option>`).join("")}</select></label>`).join("");
  const rows = f.sites.slice(0, 10).map((i, k) => { const br = brank[i]; const inB = bs.includes(i);
    return `<tr data-xtsite="${S.cell[i]}"><td>${esc(txInt(k + 1))}</td><td>${xtPlaceBtn(i)}</td><td>${esc(txPct(f.eff[i]))}</td><td>${base.eff[i] >= 0 ? esc(txPct(base.eff[i])) : "—"}</td><td>${inB ? esc(tx("ext.th.also_base")) : esc(tx("ext.th.cell_rank", { r: txInt(br) }))}</td></tr>`; }).join("");
  const shared = f.sites.slice(0, 10).filter(i => bs.includes(i)).length;
  let sweep = "";
  if (XT.sweep) {
    const thr = [0.6, 0.7, 0.8, 0.9, 1.0], sw = XC().coverageSweep(ENG, f.res, S.cell, S.lat, S.lon, thr, 10, S.app.thresholds.distinct_sep_km), ref = sw[2].sites;
    sweep = `<div class="tbl-wrap"><table class="xt-t" data-xtsweep><thead><tr><th scope="col">${esc(tx("ext.rob.thr"))}</th><th scope="col">${esc(tx("ext.rob.eligible"))}</th><th scope="col">${esc(tx("ext.rob.top3"))}</th><th scope="col">${esc(tx("ext.rob.shared"))}</th></tr></thead><tbody>${sw.map(s => `<tr${s.thr === 0.8 ? ' class="ref"' : ""}><td>${esc(txPct(s.thr, 0))}${s.thr === 0.8 ? " · " + esc(tx("ext.rob.standard")) : ""}</td><td>${esc(txInt(s.eligible))}</td><td>${s.sites.slice(0, 3).map(xtPlaceBtn).join(" · ")}</td><td>${esc(tx("ext.rob.of10", { k: txInt(s.sites.filter(i => ref.includes(i)).length) }))}</td></tr>`).join("")}</tbody></table></div>
      <p class="jn-note">${esc(tx("ext.rob.note"))}</p>`;
  }
  return `<div class="sec"><div class="lbl">${esc(tx("ext.th.hub_title"))}<span class="n">${keep(XC().CONFIG)}</span></div>
    <p class="note">${esc(tx("ext.th.hub_p"))}</p>
    <div class="xt-row">${xtTidSel("tid", tid)}</div>
    <h4 class="xt-h">${esc(tx("ext.th.limits"))}</h4><ul class="xt-list">${lim}</ul>
    <h4 class="xt-h">${esc(tx("ext.th.weights"))}</h4><p class="note small">${esc(tx("ext.th.weights_p"))}</p><div class="xt-row">${wIn}</div>
    <h4 class="xt-h">${esc(tx("ext.th.leaders"))}</h4>
    <div class="tbl-wrap"><table class="xt-t" data-xtleaders><thead><tr><th scope="col">#</th><th scope="col">${esc(tx("ext.col.place"))}</th><th scope="col">${esc(tx("ext.th.col_ext"))}</th><th scope="col">${esc(tx("ext.th.col_base"))}</th><th scope="col">${esc(tx("ext.th.col_base_rank"))}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="note small">${esc(tx("ext.th.shared", { k: txInt(shared) }))} ${esc(tx("ext.th.not_prob"))}</p>
    <p class="xt-cfg">${esc(tx("ext.cfg"))} <code>${esc(f.id)}</code> <button class="btn-sm" data-xtx="export-th">${esc(tx("ext.export"))}</button></p></div>
    <div class="sec"><div class="lbl">${esc(tx("ext.rob.title"))}</div><p class="note small">${esc(tx("ext.rob.p"))}</p>
    ${XT.sweep ? sweep : `<button class="btn-sm" data-xtx="sweep">${esc(tx("ext.rob.run"))}</button>`}</div>`;
}

/* ---------------------------------------------------------------- Planetary Process Explorer */
function xtVar(v) {
  if (v === "mean_air_temperature" || v === "surface_temp_day" || v === "surface_temp_night") return xtStack()[v];
  return S.A[v];
}
function xtRuleOk(rule, i, thr) {
  if (rule.all) return rule.all.every(r => xtRuleOk(r, i, thr));
  const x = xtVar(rule.var)[i]; if (x - x !== 0) return false;
  const v = rule.pct != null ? thr[rule.var + ":" + rule.pct] : rule.value;
  return rule.op === ">=" ? x >= v : rule.op === ">" ? x > v : rule.op === "<=" ? x <= v : x < v;
}
function xtPercentile(arr, p) { const a = []; for (let i = 0; i < arr.length; i++) { const x = arr[i]; if (x - x === 0) a.push(x); } a.sort((x, y) => x - y); return a[Math.floor(p / 100 * (a.length - 1))]; }
function xtProcEval(P) {
  const key = "proc|" + P.id; if (XT.cache.has(key)) return XT.cache.get(key);
  const thr = {}; const rules = P.rule.all || [P.rule];
  for (const r of rules) if (r.pct != null) thr[r.var + ":" + r.pct] = xtPercentile(xtVar(r.var), r.pct);
  const hit = []; let area = 0, landArea = 0;
  for (let i = 0; i < S.n; i++) { const a = cellArea(i); landArea += a; if (xtRuleOk(P.rule, i, thr)) { hit.push(i); area += a; } }
  const ov = P.order_var || P.rule.var, m = xtVar(ov), sgn = P.order === "asc" ? 1 : -1;
  hit.sort((a, b) => sgn * (m[a] - m[b]) || S.cell[a] - S.cell[b]);
  const sites = ENG.distinctSites(Int32Array.from(hit), S.lat, S.lon, 10, S.app.thresholds.distinct_sep_km);
  const cc = new Map(); for (const i of hit) { const c = placeName(i).secondary || placeName(i).primary; cc.set(c, (cc.get(c) || 0) + 1); }
  const top = [...cc.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 6);
  const r = { n: hit.length, area, share: area / landArea, sites, top, thr, ov };
  XT.cache.set(key, r); return r;
}
function xtFmtVar(v, x) {
  if (x == null || x !== x) return esc(tx("val.na"));
  if (["lst_diurnal_range", "annual_temperature_range"].includes(v)) return esc(txNum(x, 1)) + " K";
  if (["lst_day_k", "lst_night_k", "mean_air_temperature", "surface_temp_day", "surface_temp_night"].includes(v)) return xtK(x);
  if (v === "t2m_mean_c") return esc(txNum(x, 1)) + " °C";
  if (v === "elevation") return esc(txInt(x)) + " m";
  if (v === "slope") return esc(txNum(x, 1)) + "°";
  if (v === "surface_roughness") return esc(txInt(x)) + " m";
  if (v === "precip_mm_yr") return esc(txInt(x)) + " mm/yr";
  return esc(txNum(x, 3));
}
function xtHubProcesses() {
  const L = XD.processes.processes, cur = L.find(p => p.id === XT.proc);
  const list = `<ul class="xt-procs">${L.map(p => `<li><button type="button" data-xproc="${p.id}" aria-pressed="${XT.proc === p.id}"><b>${esc(tx("ext.proc." + p.id + ".name"))}</b><span class="xt-st ${p.status === "data" ? "data" : p.status === "indirect" ? "partial" : "nodata"}">${esc(tx("ext.proc.st." + p.status))}</span></button></li>`).join("")}</ul>`;
  let det = "";
  if (cur) {
    const fld = k => `<dt>${esc(tx("ext.proc.f." + k))}</dt><dd>${esc(tx("ext.proc." + cur.id + "." + k))}</dd>`;
    det = `<div class="xt-proc" data-xprocdet="${cur.id}"><h4 class="xt-h">${esc(tx("ext.proc." + cur.id + ".name"))}</h4><dl class="xt-dl">${["earth", "planet", "mech", "sim", "diff", "use", "lim"].map(fld).join("")}
      <dt>${esc(tx("ext.proc.f.data"))}</dt><dd>${(cur.datasets || []).map(id => keep(jnDataset(id).dataset || id)).join(", ") || esc(tx("ext.proc.none"))}</dd></dl>`;
    if (cur.status === "data" || cur.status === "indirect") {
      const r = xtProcEval(cur), rule = (cur.rule.all || [cur.rule]).map(x => typeof xcRuleText === "function" ? xcRuleText(x, r.thr) : `${keep(x.var)} ${x.op} ${x.pct != null ? esc(tx("ext.proc.pct", { p: txInt(x.pct) })) + " (" + xtFmtVar(x.var, r.thr[x.var + ":" + x.pct]) + ")" : xtFmtVar(x.var, x.value)}`).join(" · ");
      if (cur.status === "indirect") det += `<p class="jn-note" data-xprocindirect>${esc(tx("ext.proc.indirect_note"))}</p>`;
      det += `<p class="note small" data-xprule>${esc(tx("ext.proc.rule"))} ${rule}</p>
        <p class="xt-stat" data-xproccount="${r.n}">${esc(tx("ext.proc.count", { n: txInt(r.n), a: txInt(Math.round(r.area)), p: txPct(r.share, 1) }))}</p>
        <p class="note small">${esc(tx("ext.proc.where"))} ${r.top.map(([c, k]) => `${keep(c)} (${esc(txInt(k))})`).join(", ") || "—"}</p>
        <h4 class="xt-h">${esc(tx("ext.proc.examples"))}</h4><ol class="xt-list">${r.sites.map(i => `<li>${xtPlaceBtn(i)} <span class="meta">${xtFmtVar(r.ov, xtVar(r.ov)[i])}</span></li>`).join("")}</ol>`;
      if (cur.planet) {
        const v = cur.planet.var, vals = xtTargets().concat(TARGET_IDS.filter(t => !xtTargets().includes(t) && t !== "cross")).filter(t => S.T[t]).map(t => {
          const x = v === "mean_air_temperature" ? (XD.thermal.targets[t] || {})[v] : S.T[t].variables[v];
          return x == null ? null : `${esc(jnBody(t))} · ${esc(jnTNameText(t))}: ${xtFmtVar(v, x)}`; }).filter(Boolean).slice(0, 6);
        det += `<h4 class="xt-h">${esc(tx("ext.proc.planet_vals"))}</h4><ul class="xt-list">${vals.map(x => `<li>${x}</li>`).join("") || `<li>${esc(tx("ext.proc.none"))}</li>`}</ul>`;
      }
      if (cur.partial) det += `<p class="jn-note">${esc(tx("ext.proc.partial", { d: tx("ext.dim." + cur.partial + ".name") }))}</p>`;
      if (cur.status === "indirect" && cur.needs) det += `<p class="note small" data-xprocneeds>${esc(tx("ext.proc.needs_full", { list: txList(cur.needs.map(d => tx("ext.dim." + d + ".name"))) }))}${(cur.candidates || []).length ? " " + esc(tx("ext.proc.cands")) + " " + cur.candidates.map(id => { const it = (typeof INV_BY !== "undefined" && INV_BY[id]) || null; return keep(it ? it.name : id) + (it ? " " + invChip(it.status) : ""); }).join(" · ") : ""}</p>`;
    } else {
      det += `<p class="jn-note" data-xprocnodata>${esc(tx("ext.proc.nodata", { list: txList(cur.needs.map(d => tx("ext.dim." + d + ".name"))) }))}</p>`;
      if (cur.candidates.length) det += `<p class="note small">${esc(tx("ext.proc.cands"))} ${cur.candidates.map(id => { const it = (typeof INV_BY !== "undefined" && INV_BY[id]) || null; return keep(it ? it.name : id) + (it ? " " + invChip(it.status) : ""); }).join(" · ")}</p>`;
    }
    det += `</div>`;
  }
  return `<div class="sec"><div class="lbl">${esc(tx("ext.proc.title"))}</div><p class="note">${esc(tx("ext.proc.p"))}</p>${list}${det}</div>`;
}

/* ---------------------------------------------------------------- Beyond the familiar */
function xtHubBeyond() {
  const R = S.res; if (!R) return "";
  const K = XD.known_analogues, sep = S.app.thresholds.distinct_sep_km, envOk = i => xcEnvGroupOk(XT.bfEnv, i);
  const ord = XT.bfEnv === "all" ? R.order : Int32Array.from(Array.from(R.order).filter(envOk)), sites = ENG.distinctSites(ord, S.lat, S.lon, XT.bfN, sep);
  const near = i => { let best = null; for (const s of K.sites) { const d = ENG.haversine(S.lat[i], S.lon[i], s.lat, s.lon); if (!best || d < best.d) best = { s, d }; } return best; };
  const w = S.weights, single = S.T[S.targetId] && S.targetId !== "cross", tv = single ? S.T[S.targetId].variables : null;
  const rows = [], familiar = [];
  sites.forEach((i, k) => {
    const nb = near(i);
    if (nb.d < K.radius_km) { familiar.push([i, k, nb]); return; }
    const on = single ? ENG.detail(S.A, S.critIds, i, tv, w, a4RangesFor(S.targetId)).rows.filter(r => r.s != null).sort((a, b) => b.s - a.s || (a.c < b.c ? -1 : 1)) : [];
    rows.push(`<tr data-xbf="${S.cell[i]}"><td>${esc(txInt(k + 1))}</td><td>${xtPlaceBtn(i)}<div class="meta">${xcEnvName(xcEnv(i))} · ${keep(xcKoppen(i) || "—")}</div><div class="meta">${esc(tx("ext.bf.nearest", { name: nb.s.name, km: txInt(Math.round(nb.d)) }))}</div><span class="xt-st lab-future" data-xbfclass="review">${esc(tx("ext.bf.cls_review"))}</span></td><td>${esc(txPct(R.eff[i]))}</td><td><div><span class="meta">${esc(tx("ext.bf.col_strong"))}:</span> ${on.length ? esc(tx("crit." + on[0].c + ".s")) : "—"}</div><div><span class="meta">${esc(tx("ext.bf.col_weak"))}:</span> ${on.length ? esc(tx("crit." + on[on.length - 1].c + ".s")) + " (s = " + esc(txNum(on[on.length - 1].s, 2)) + ")" : "—"}</div></td></tr>`);
  });
  return `<div class="sec"><div class="lbl">${esc(tx("ext.bf.title"))}</div>
    <p class="note">${esc(tx("ext.bf.p", { n: txInt(sites.length), km: txInt(K.radius_km) }))}</p>
    <p class="jn-note" data-xbfhonest>${esc(tx("ext.bf.honest"))}</p>
    <div class="xt-row"><label class="xt-field"><span>${esc(tx("ext.bf.env"))}</span><select data-xbfenv>${XC_ENV_GROUPS.map(g => `<option value="${g}"${XT.bfEnv === g ? " selected" : ""}>${esc(tx("ext.envg." + g))}</option>`).join("")}</select></label></div>
    <p class="xt-stat" data-xbfcount="${rows.length}">${esc(tx("ext.bf.count", { k: txInt(rows.length), n: txInt(sites.length), f: txInt(familiar.length) }))}</p>
    <div class="tbl-wrap"><table class="xt-t"><thead><tr><th scope="col">${esc(tx("ext.bf.col_rank"))}</th><th scope="col">${esc(tx("ext.col.place"))}</th><th scope="col">${esc(tx("ext.bf.col_score"))}</th><th scope="col">${esc(tx("ext.bf.col_strong"))} / ${esc(tx("ext.bf.col_weak"))}</th></tr></thead><tbody>${rows.slice(0, 25).join("")}</tbody></table></div>
    <p class="note small">${esc(tx("ext.bf.research"))}</p>
    <details class="xt-det"><summary>${esc(tx("ext.bf.list", { n: txInt(K.sites.length) }))}</summary><p class="note small">${esc(tx("ext.bf.list_p"))}</p><ul class="xt-list">${K.sites.map(s => `<li>${keep(s.name)} <span class="meta">${esc(txLL(s.lat, s.lon))}</span></li>`).join("")}</ul></details>
    ${familiar.length ? `<details class="xt-det"><summary>${esc(tx("ext.bf.familiar", { n: txInt(familiar.length) }))}</summary><ul class="xt-list">${familiar.map(([i, k, nb]) => `<li>#${esc(txInt(k + 1))} ${xtPlaceBtn(i)} <span class="meta">${esc(tx("ext.bf.near", { name: nb.s.name, km: txInt(Math.round(nb.d)) }))}</span> <span class="xt-st lab-verified" data-xbfclass="known">${esc(tx("ext.bf.cls_known"))}</span></li>`).join("")}</ul></details>` : ""}</div>`;
}

/* ---------------------------------------------------------------- Mission profiles (extended) */
function xtHubProfiles() {
  const P = XD.profiles_ext.profiles, av = P.filter(p => p.status === "available"), un = P.filter(p => p.status !== "available");
  const cur = av.find(p => p.id === XT.prof) || av[0]; XT.prof = cur.id;
  const W = XT.profW[cur.id] || { ...cur.weights }, tid = xtCurTid();
  const f = xtField(tid, W), changed = JSON.stringify(W) !== JSON.stringify(cur.weights);
  const wIn = xtCrit().map(c => `<label class="xt-w"><span>${XC().EXT.includes(c) ? xtDimName(c) : esc(tx("crit." + c))}</span><select data-xtpw="${c}">${[0, 0.5, 1, 2, 3].map(v => `<option value="${v}"${+W[c] === v ? " selected" : ""}>${esc(txNum(v, v % 1 ? 1 : 0))}</option>`).join("")}</select></label>`).join("");
  return `<div class="sec"><div class="lbl">${esc(tx("ext.prof.title"))}<span class="n">${keep(XC().CONFIG)}</span></div><p class="note">${esc(tx("ext.prof.p"))}</p>
    <div class="xt-row" role="group" aria-label="${esc(tx("ext.prof.title"))}">${av.map(p => `<button type="button" class="xt-chip" data-xprof="${p.id}" aria-pressed="${p.id === cur.id}">${esc(tx("ext.prof." + p.id + ".name"))}</button>`).join("")}</div>
    <div class="xt-proc" data-xprofdet="${cur.id}"><dl class="xt-dl"><dt>${esc(tx("ext.prof.f.goal"))}</dt><dd>${esc(tx("ext.prof." + cur.id + ".goal"))}</dd><dt>${esc(tx("ext.prof.f.why"))}</dt><dd>${esc(tx("ext.prof." + cur.id + ".why"))}</dd><dt>${esc(tx("ext.prof.f.lim"))}</dt><dd>${esc(tx("ext.prof." + cur.id + ".lim"))}</dd></dl>
    <div class="xt-row">${xtTidSel("tid", tid)}</div>
    <h4 class="xt-h">${esc(tx("ext.prof.weights"))}${changed ? ` <span class="xt-st partial">${esc(tx("ext.prof.edited"))}</span> <button class="jn-lnk" data-xtx="prof-reset">${esc(tx("ext.prof.reset"))}</button>` : ""}</h4><div class="xt-row xt-wgrid">${wIn}</div>
    <h4 class="xt-h">${esc(tx("ext.prof.leaders"))}</h4><ol class="xt-list" data-xprofleaders>${f.sites.slice(0, 10).map(i => `<li>${xtPlaceBtn(i)} <span class="meta">${esc(txPct(f.eff[i]))} · ${esc(tx("ext.cov", { p: txPct(f.res.coverage[i], 0) }))}</span></li>`).join("")}</ol>
    <p class="xt-cfg">${esc(tx("ext.cfg"))} <code>${esc(f.id)}</code> <button class="btn-sm" data-xtx="export-prof">${esc(tx("ext.export"))}</button></p>
    <p class="jn-note">${esc(tx("ext.prof.not_approval"))}</p></div></div>
    <div class="sec"><div class="lbl">${esc(tx("ext.prof.unavail"))}</div><p class="note small">${esc(tx("ext.prof.unavail_p"))}</p><ul class="xt-list" data-xprofun>${un.map(p => `<li data-xprofna="${p.id}"><b>${esc(tx("ext.prof." + p.id + ".name"))}</b> — ${esc(tx("ext.prof.needs", { list: txList(p.needs.map(d => tx("ext.dim." + d + ".name"))) }))}</li>`).join("")}</ul></div>`;
}

/* ---------------------------------------------------------------- Learn */
const XLEARN = ["what", "why", "measure", "landing", "similarity", "looks", "limits"];
function xtHubLearn() {
  return `<div class="sec"><div class="lbl">${esc(tx("ext.learn.title"))}</div><p class="note">${esc(tx("ext.learn.p"))}</p>${XLEARN.map((k, n) => `<details class="xt-det xt-learn" data-xlearn="${k}"${n === 0 ? " open" : ""}><summary>${esc(tx("ext.learn." + k + ".t"))}</summary><p>${esc(tx("ext.learn." + k + ".p1"))}</p><p>${esc(tx("ext.learn." + k + ".p2"))}</p></details>`).join("")}</div>`;
}

/* ---------------------------------------------------------------- events */
document.addEventListener("click", e => {
  const t = e.target; if (!t.closest) return;
  const h = t.closest("[data-xhub]"); if (h) { XT.hub = h.dataset.xhub; xtRerender(); const n = document.querySelector(`[data-xhub="${XT.hub}"]`); if (n) n.focus(); return; }
  const p = t.closest("[data-xproc]"); if (p) { XT.proc = XT.proc === p.dataset.xproc ? null : p.dataset.xproc; xtRerender(); const n = document.querySelector(`[data-xproc="${p.dataset.xproc}"]`); if (n) n.focus(); return; }
  const q = t.closest("[data-xprof]"); if (q) { XT.prof = q.dataset.xprof; xtRerender(); const n = document.querySelector(`[data-xprof="${XT.prof}"]`); if (n) n.focus(); return; }
  const x = t.closest("[data-xtx]"); if (!x) return;
  const a = x.dataset.xtx;
  if (a === "sweep") { XT.sweep = true; xtRerender(); }
  else if (a === "export-th") { const f = xtField(xtCurTid(), xtWeights(S.weights, XT.w3)); xtDownload(`asterro-ext-${f.tid}-${f.id}.json`, xtRecord(f, "temperature extremes")); if (typeof jlMark === "function") jlMark("repro_ext"); }
  else if (a === "export-prof") { const P = XD.profiles_ext.profiles.find(p => p.id === XT.prof), f = xtField(xtCurTid(), XT.profW[P.id] || P.weights); xtDownload(`asterro-ext-${P.id}-${f.id}.json`, xtRecord(f, "profile " + P.id)); }
  else if (a === "prof-reset") { delete XT.profW[XT.prof]; xtRerender(); }
});
document.addEventListener("change", e => {
  const t = e.target; if (!t.dataset) return;
  if (t.dataset.xbfenv != null) { XT.bfEnv = t.value; xtRerender(); const n = document.querySelector("[data-xbfenv]"); if (n) n.focus(); return; }
  if (t.dataset.xtin === "tid") { XT.tid = t.value; XT.sweep = false; xtRerender(); const n = document.querySelector('[data-xtin="tid"]'); if (n) n.focus(); }
  else if (t.dataset.xtw) { XT.w3 = { ...XT.w3, [t.dataset.xtw]: +t.value }; XT.sweep = false; xtRerender(); const n = document.querySelector(`[data-xtw="${t.dataset.xtw}"]`); if (n) n.focus(); }
  else if (t.dataset.xtpw) { const P = XD.profiles_ext.profiles.find(p => p.id === XT.prof); XT.profW[P.id] = { ...(XT.profW[P.id] || P.weights), [t.dataset.xtpw]: +t.value }; xtRerender(); const n = document.querySelector(`[data-xtpw="${t.dataset.xtpw}"]`); if (n) n.focus(); }
});
