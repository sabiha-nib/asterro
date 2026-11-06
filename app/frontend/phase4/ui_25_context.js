/* ===== Site context: environment, climate class, illumination geometry, kilometre-scale terrain, operations =====
 * tai-ext-context-1.0.0 (src/ext/context.py, generated into ASTERRO_EXT.context). Nothing here enters any score.
 *   - climate class: Koeppen-Geiger after Peel et al. (2007) from the NASA POWER monthly climatology;
 *   - environment type: the Natural Earth geography-region class of the cell's named region;
 *   - permafrost: a climatic indicator from mean annual air temperature (indirect: not an observation of ground ice);
 *   - illumination: noon solar elevation from latitude and axial tilt (geometry only);
 *   - kilometre-scale slope: share of ~926 m pixels at or below 5 deg and 15 deg, Earth cell vs target window;
 *   - operations: the published table data/ext/operations.json; mean per-condition similarity of measured conditions.
 * The rule engine of the Process Explorer gains three condition types: env (environment type), koppen and koppen_not. */
const XCX = { k: null, s5: null, s15: null };
function xcB64(b) { const s = atob(b), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
function xcReady() { if (!XD || !XD.context) return false; if (!XCX.k) { XCX.k = xcB64(XD.context.koppen_b64); XCX.s5 = xcB64(XD.context.earth_slope_le5_b64); XCX.s15 = xcB64(XD.context.earth_slope_le15_b64); } return XCX.k.length === S.n; }
function xcKoppen(i) { if (!xcReady()) return null; const c = XCX.k[i]; return c === XD.context.koppen_missing ? null : XD.context.koppen_classes[c]; }
function xcEnv(i) { const r = S.A.region ? S.A.region[i] : -1; return r >= 0 ? XD.context.region_featurecla[r] || null : null; }
function xcSlopeShare(i, t) { if (!xcReady()) return null; const a = t === 5 ? XCX.s5 : XCX.s15, v = a[i]; return v === XD.context.earth_slope_missing ? null : v / XD.context.earth_slope_scale; }
function xcTargetShare(tid, t) { const s = XD.context.target_slope[tid]; if (!s) return null; const k = XD.context.slope_thresholds_deg.indexOf(t); return k < 0 ? null : s.frac_le[k]; }
function xcNoon(lat, body) { const e = XD.context.tilt_deg[body], a = Math.abs(lat); return { hi: 90 - Math.max(0, a - e), lo: 90 - (a + e) }; }
function xcPermafrost(i) {
  const t = S.A.t2m_mean_c ? S.A.t2m_mean_c[i] : NaN; if (t - t !== 0) return null;
  if (xcKoppen(i) === "EF") return "icecap";
  return t <= -6 ? "likely" : t <= -1 ? "possible" : "unlikely";
}
function xcBodyKey(tid) { const b = String((S.T[tid] || {}).body || "").toLowerCase(); return b === "moon" ? "moon" : "mars"; }
function xcEnvName(e) { return e ? esc(tx("ext.env." + e.replace(/[^A-Za-z]/g, "").toLowerCase())) : esc(tx("ext.cx.unlabelled")); }
function xcKName(k) { return k ? `<b>${keep(k)}</b> · ${esc(tx("ext.kg." + k))}` : esc(tx("val.na")); }

/* --- process rules: environment type and climate class conditions --- */
{ const f = xtRuleOk; xtRuleOk = function (rule, i, thr) {
  if (rule.any) return rule.any.some(r => xtRuleOk(r, i, thr));
  if (rule.all) return rule.all.every(r => xtRuleOk(r, i, thr));
  if (rule.env) return rule.env.includes(xcEnv(i));
  if (rule.koppen) return rule.koppen.includes(xcKoppen(i));
  if (rule.koppen_not) { const k = xcKoppen(i); return k != null && !rule.koppen_not.includes(k); }
  return f.apply(this, arguments);
}; }
function xcRuleText(x, thr) {
  if (x.env) return esc(tx("ext.cx.rule_env")) + " " + x.env.map(e => xcEnvName(e)).join(" / ");
  if (x.koppen) return esc(tx("ext.cx.rule_kg")) + " " + x.koppen.map(k => keep(k)).join(" / ");
  if (x.koppen_not) return esc(tx("ext.cx.rule_kg_not")) + " " + x.koppen_not.map(k => keep(k)).join(" / ");
  return `${keep(x.var)} ${x.op} ${x.pct != null ? esc(tx("ext.proc.pct", { p: txInt(x.pct) })) + " (" + xtFmtVar(x.var, thr[x.var + ":" + x.pct]) + ")" : xtFmtVar(x.var, x.value)}`;
}

/* --- per-condition similarity of one cell with one target, all conditions, weight 1 (independent of the profile) --- */
function xcSims(i, tid) {
  const ctx = jnCtx(tid), out = {};
  const D = ENG.detail(S.A, S.critIds, i, ctx.tv, Object.fromEntries(S.critIds.map(c => [c, 1])), ctx.ranges);
  for (const r of D.rows) out[r.c] = r.s == null || r.s !== r.s ? null : r.s;
  if (xtHas(tid)) { const T = xtTarget(tid); for (const r of XC().rows(xtStack(), i, T.tv, T.ranges, XT.earth)) out[r.c] = r.state === "na" || r.state === "unknown" ? null : r.s; }
  return out;
}
function xcOps(i, tid) {
  const s = xcSims(i, tid);
  return XD.operations.operations.map(o => {
    const have = o.conditions.filter(c => s[c] != null), miss = o.conditions.filter(c => s[c] == null);
    const m = have.length ? have.reduce((a, c) => a + s[c], 0) / have.length : null;
    const k = m == null ? "cannot" : xtState(m);
    return { id: o.id, mean: m, k, have, miss, needs: o.needs, km: o.km_slope || null };
  });
}

function xcContextBlock(i, tid) {
  if (!XD || !XD.context || !xcReady() || i == null || !S.T[tid]) return "";
  const env = xcEnv(i), kg = xcKoppen(i), pf = xcPermafrost(i), body = xcBodyKey(tid), tl = (S.T[tid].location || {}).lat;
  const eN = xcNoon(S.lat[i], "earth"), tN = tl == null ? null : xcNoon(tl, body);
  const deg = v => esc(txNum(v, 1)) + "°";
  const sun = n => n ? `${esc(tx("ext.cx.sun_hi"))} ${deg(n.hi)} · ${esc(tx("ext.cx.sun_lo"))} ${deg(n.lo)}${n.lo < 0 ? ` · <span class="xt-st partial">${esc(tx("ext.cx.polar_night"))}</span>` : ""}` : "—";
  const share = (v) => v == null ? "—" : esc(txPct(v, 0));
  const ops = xcOps(i, tid);
  const opRows = ops.map(o => `<tr data-xcop="${o.id}" data-xcopk="${o.k}"><th scope="row">${esc(tx("ext.op." + o.id + ".name"))}<div class="meta">${esc(tx("ext.op." + o.id + ".why"))}</div></th>
    <td><span class="xt-st ${o.k === "cannot" ? "nodata" : o.k}">${esc(o.k === "cannot" ? tx("ext.cx.cannot") : tx("state." + o.k))}</span>${o.mean != null ? `<div class="meta">${esc(tx("ext.cx.mean_s", { s: txNum(o.mean, 2), n: txInt(o.have.length) }))}</div>` : ""}</td>
    <td class="meta">${o.have.map(c => xtDimName(c)).join(", ") || "—"}${o.miss.length || o.needs.length ? `<div>${esc(tx("ext.cx.not_assessed"))} ${o.miss.concat(o.needs).map(c => xtDimName(c)).join(", ")}</div>` : ""}</td></tr>`).join("");
  const diff = jnCtx(tid);
  const L = ENG.detail(S.A, S.critIds, i, diff.tv, Object.fromEntries(S.critIds.map(c => [c, 1])), diff.ranges).rows.filter(r => r.s != null && r.s === r.s);
  const weak = L.filter(r => r.s < S.app.thresholds.partial).map(r => esc(tx("crit." + r.c + ".s")));
  return `<div class="xt-box xc" data-xc="${esc(tid)}"><h4 class="xt-h">${esc(tx("ext.cx.title"))} <span class="xt-ver">${keep(XD.context.version)}</span></h4>
    <p class="jn-note">${esc(tx("ext.cx.p"))}</p>
    <dl class="xt-dl">
      <dt>${esc(tx("ext.cx.where"))}</dt><dd data-xcenv="${esc(env || "")}">${jnPlace(i)} · ${esc(txLL(S.lat[i], S.lon[i]))} · ${esc(tx("ext.cx.extent"))}<div class="meta">${esc(tx("ext.cx.env"))} ${xcEnvName(env)}</div></dd>
      <dt>${esc(tx("ext.dim.climate_class.name"))}</dt><dd data-xckg="${esc(kg || "")}">${xcKName(kg)}<div class="meta">${esc(tx("ext.cx.kg_note"))}</div></dd>
      <dt>${esc(tx("ext.dim.ice_permafrost.name"))}</dt><dd data-xcpf="${pf || ""}"><span class="xt-st ${pf === "likely" || pf === "icecap" ? "partial" : "na"}">${esc(tx("ext.cx.pf." + (pf || "na")))}</span><div class="meta">${esc(tx("ext.cx.pf_note"))}</div></dd>
      <dt>${esc(tx("ext.dim.illumination.name"))}</dt><dd data-xcsun>${esc(tx("ext.cx.here"))} ${sun(eN)}<br>${esc(jnTNameText(tid))}: ${sun(tN)}<div class="meta">${esc(tx("ext.cx.sun_note"))}</div></dd>
      <dt>${esc(tx("ext.dim.landing_hazard.name"))}</dt><dd data-xcslope><div>${esc(tx("ext.cx.le", { t: txInt(5) }))}: ${esc(tx("ext.cx.here"))} ${share(xcSlopeShare(i, 5))} · ${esc(jnTNameText(tid))} ${share(xcTargetShare(tid, 5))}</div>
        <div>${esc(tx("ext.cx.le", { t: txInt(15) }))}: ${esc(tx("ext.cx.here"))} ${share(xcSlopeShare(i, 15))} · ${esc(jnTNameText(tid))} ${share(xcTargetShare(tid, 15))}</div><div class="meta">${esc(tx("ext.cx.slope_note"))}</div></dd>
    </dl>
    <h4 class="xt-h">${esc(tx("ext.cx.ops"))}</h4><p class="note small">${esc(tx("ext.cx.ops_p"))}</p>
    <div class="tbl-wrap"><table class="t xt-t" data-xcops><thead><tr><th scope="col">${esc(tx("ext.cx.op"))}</th><th scope="col">${esc(tx("ext.cx.similarity"))}</th><th scope="col">${esc(tx("ext.cx.based_on"))}</th></tr></thead><tbody>${opRows}</tbody></table></div>
    <h4 class="xt-h">${esc(tx("ext.cx.evidence"))}</h4>
    <dl class="xt-dl" data-xcev>
      <dt>${esc(tx("ext.cx.ev.observed"))}</dt><dd>${esc(tx("ext.cx.ev.observed_v"))}</dd>
      <dt>${esc(tx("ext.cx.ev.indirect"))}</dt><dd>${esc(tx("ext.cx.ev.indirect_v"))}</dd>
      <dt>${esc(tx("ext.cx.ev.inferred"))}</dt><dd>${esc(tx("ext.cx.ev.inferred_v"))}</dd>
      <dt>${esc(tx("ext.cx.ev.unknown"))}</dt><dd>${esc(tx("ext.cx.ev.unknown_v"))}</dd>
    </dl>
    <h4 class="xt-h">${esc(tx("ext.cx.breaks"))}</h4>
    <ul class="xt-list" data-xcbreaks>${weak.length ? `<li class="out">${esc(tx("ext.cx.breaks_here"))} ${weak.join(", ")}</li>` : ""}${["gravity", "vacuum", "radiation", "history"].map(k => `<li>${esc(tx("ext.rep.lim." + k))}</li>`).join("")}</ul>
    <p class="jn-note">${esc(tx("ext.cx.not_cert"))}</p></div>`;
}
/* dataset, author and chemical names inside translated sentences are preserved terms: mark them like every other name */
const XC_NAMES = /Natural Earth|NASA POWER|Peel et al\.|GMTED2010|MOLA|LOLA|CO₂/g;
function xcKeepNames(h) { return h.replace(/>([^<]+)</g, (m, t) => ">" + t.replace(XC_NAMES, n => keep(n)) + "<"); }
if (typeof jnLensView === "function") { const f = jnLensView; jnLensView = function (ctx, L, eff) { let h = f.apply(this, arguments); try { h += xcKeepNames(xcContextBlock(JN.i, JN.tid)); } catch (e) { console.error(e); } return h; }; }

/* --- environment groups for discovery filters (Natural Earth region class, or the climate class for polar / dry) --- */
const XC_ENV_GROUPS = ["all", "desert", "dry_climate", "polar", "mountain", "plateau", "basin", "valley", "coast"];
const XC_ENV_MAP = { desert: ["Desert"], mountain: ["Range/mtn", "Foothills"], plateau: ["Plateau"], basin: ["Basin", "Lowland", "Plain", "Wetlands", "Lake"], valley: ["Valley", "Gorge", "Delta"], coast: ["Coast", "Island", "Island group", "Pen/cape", "Peninsula", "Isthmus"] };
function xcEnvGroupOk(g, i) {
  if (!g || g === "all") return true;
  if (g === "polar") { const k = xcKoppen(i); return k === "ET" || k === "EF" || xcEnv(i) === "Tundra"; }
  if (g === "dry_climate") { const k = xcKoppen(i); return !!k && k[0] === "B"; }
  return (XC_ENV_MAP[g] || []).includes(xcEnv(i));
}
