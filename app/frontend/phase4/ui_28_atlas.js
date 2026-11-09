/* ===== Atlas: the Earth globe at the centre, a quiet context card, layers on request =====
 * In the Atlas view the planetary atlas moves to a narrower side panel so the 3D Earth globe (still the default
 * projection) takes the centre. Selecting an Earth candidate (globe or list) shows a short context card on the globe:
 * where it is, how similar it is to the current target, its landscape and climate class, the strongest similarities
 * and the important differences, with the full analysis one click away. The analysis layer buttons (Similarity,
 * Constellations, Change, Coverage, Dimension) are behind a single "Layers" button in this view. Nothing is computed
 * here that the engine does not already provide. */
/* phones and tablets (stacked layout): the card sits under the globe; desktop: over the globe */
const DSA_PHONE = matchMedia("(max-width:1180px)");
try { DSA_PHONE.addEventListener("change", () => { try { dsaCard(); } catch (e) { console.error(e); } }); } catch (e) { }
function dsaCard() {
  const vp = document.getElementById("viewport"); if (!vp) return;
  let c = document.getElementById("ds-acard");
  const app = document.getElementById("app");
  if (S.tab !== "atlas" || !S.res) { if (c) c.hidden = true; if (app) app.classList.remove("ds-card-below"); return; }
  if (!c) { c = document.createElement("section"); c.id = "ds-acard"; c.className = "ds-acard"; c.setAttribute("aria-live", "polite"); c.setAttribute("data-i18n-done", ""); vp.appendChild(c); }
  c.hidden = false;
  // phones and tablets: the card sits under the globe instead of over it, so the globe stays fully visible and the card never scrolls
  const below = DSA_PHONE.matches;
  if (below && c.previousElementSibling !== vp) vp.after(c); else if (!below && c.parentElement !== vp) vp.appendChild(c);
  if (app) app.classList.toggle("ds-card-below", below);
  const tid = S.targetId, i = S.selected;
  if (i == null || tid === "cross") {
    c.setAttribute("data-dsacard", "hint");
    c.innerHTML = `<h3>${esc(tx("dsa.hint.t", { target: tid === "cross" ? tx("tname.cross") : jnTNameText(tid) }))}</h3><p>${esc(tx("dsa.hint.p"))}</p>`;
    return;
  }
  const th = S.app.thresholds, D = ENG.detail(S.A, S.critIds, i, jnCtx(tid).tv, S.weights, jnCtx(tid).ranges);
  const rows = D.rows.filter(r => r.s != null && r.s === r.s && r.w > 0), strong = rows.filter(r => r.s >= th.match).sort((a, b) => b.s - a.s).slice(0, 3), weak = rows.filter(r => r.s < th.partial).sort((a, b) => a.s - b.s).slice(0, 3);
  const env = typeof xcEnv === "function" ? xcEnv(i) : null, kg = typeof xcKoppen === "function" ? xcKoppen(i) : null;
  c.setAttribute("data-dsacard", String(S.cell[i]));
  c.innerHTML = `<p class="dsa-k">${esc(tx("dsa.selected"))}</p><h3>${jnPlace(i)}</h3><p class="dsa-ll">${esc(txLL(S.lat[i], S.lon[i]))}${env ? " · " + xcEnvName(env) : ""}${kg ? " · " + keep(kg) : ""}</p>
    <p class="dsa-score"><b>${esc(S.res.eff[i] >= 0 ? txPct(S.res.eff[i]) : tx("val.na"))}</b> ${esc(tx("dsa.similar_to", { target: jnTNameText(tid) }))}</p>
    ${strong.length ? `<p class="dsa-l"><span>${esc(tx("dsa.alike"))}</span> ${strong.map(r => esc(tx("crit." + r.c + ".s"))).join(", ")}</p>` : ""}
    ${weak.length ? `<p class="dsa-l"><span>${esc(tx("dsa.differs"))}</span> ${weak.map(r => esc(tx("crit." + r.c + ".s"))).join(", ")}</p>` : ""}
    <p class="dsa-l"><span>${esc(tx("dsa.assessed", { k: txInt(D.rows.filter(r => r.s != null && r.s === r.s).length), n: txInt(S.critIds.length), p: txPct(D.coverage, 0) }))}</span></p>
    <p class="dsa-l ds-adv"><span>${esc(tx("dsa.evidence", { d: txInt(S.critIds.filter(c => (S.T[tid].status || {})[c] === "DIRECT").length), p: txInt(S.critIds.filter(c => (S.T[tid].status || {})[c] === "PROXY").length) }))}</span></p>
    ${(() => { const ops = typeof xcOps === "function" ? xcOps(i, tid).filter(o => o.mean != null).sort((a, b) => b.mean - a.mean) : []; return ops.length ? `<p class="dsa-l"><span>${esc(tx("dsa.useful"))}</span> ${esc(tx("ext.op." + ops[0].id + ".name"))}</p>` : ""; })()}
    <p class="dsa-note">${esc(tx("dsa.note"))}</p>
    <div class="dsa-act"><button type="button" class="btn-primary btn-sm" data-dsaopen="${i}">${esc(tx("dsa.open"))}</button><button type="button" class="btn-ghost btn-sm" data-dsalab="${i}">${esc(tx("dsa.lab"))}</button></div>`;
}
function dsaLayersBtn() {
  const top = document.querySelector("#viewport .vp-top"); if (!top) return;
  let b = document.getElementById("ds-layers");
  if (!b) { b = document.createElement("button"); b.type = "button"; b.id = "ds-layers"; b.className = "ds-layers"; top.appendChild(b); }
  const open = document.documentElement.classList.contains("ds-layers-open");
  b.setAttribute("aria-expanded", String(open)); b.textContent = tx(open ? "dsa.layers_hide" : "dsa.layers");
}
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("#ds-layers,[data-dsaopen],[data-dsalab]"); if (!t) return;
  if (t.id === "ds-layers") { document.documentElement.classList.toggle("ds-layers-open"); dsaLayersBtn(); return; }
  if (t.dataset.dsaopen) jnOpen("place", { i: +t.dataset.dsaopen, tid: S.targetId, pid: S.profile === "custom" ? "custom" : S.profile, sec: "lens", step: 0 });
  else if (t.dataset.dsalab) { if (S.selected !== +t.dataset.dsalab) select(+t.dataset.dsalab); DSF.step = 3; setTab("lab"); }
});
{ const f = renderLeft; renderLeft = function () { const r = f.apply(this, arguments); try { dsaCard(); dsaLayersBtn(); } catch (e) { console.error(e); } return r; }; }
{ const f = select; select = function () { const r = f.apply(this, arguments); try { dsaCard(); } catch (e) { console.error(e); } return r; }; }
document.addEventListener("asterro:lang", () => { try { dsaCard(); dsaLayersBtn(); } catch (e) { console.error(e); } });
/* the Atlas opens on the 3D globe (phones otherwise start on the flat map); later choices are kept */
{ const f = setTab; setTab = function (t) { const r = f.apply(this, arguments); try { if (t === "atlas" && !DSF.atlasGlobe) { DSF.atlasGlobe = true; if (S.proj !== 0) setProj(0); } } catch (e) { console.error(e); } return r; }; }

/* collapsible side panels (desktop) and the configuration summary in the weight console */
function dsaPanelBtns() {
  const vp = document.getElementById("viewport"), app = document.getElementById("app"); if (!vp || !app || app.classList.contains("is-hero")) return;
  for (const side of ["left", "right"]) {
    let b = vp.querySelector(`.ds-paneltog[data-dspanel="${side}"]`);
    if (!b) { b = document.createElement("button"); b.type = "button"; b.className = "ds-paneltog"; b.dataset.dspanel = side; b.setAttribute("aria-controls", side); vp.appendChild(b); }
    const hidden = app.classList.contains("ds-hide-" + side);
    b.setAttribute("aria-expanded", String(!hidden)); b.textContent = tx("dsp." + side + (hidden ? ".show" : ".hide"));
  }
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest(".ds-paneltog"); if (!b) return;
  const app = document.getElementById("app"); app.classList.toggle("ds-hide-" + b.dataset.dspanel); dsaPanelBtns();
  if (typeof GLOBE !== "undefined" && GLOBE.resize) setTimeout(() => GLOBE.resize(), 0); window.dispatchEvent(new Event("resize"));
});
function dsCfgSummary() {
  const side = document.querySelector("#console .con-side"); if (!side) return;
  let c = side.querySelector(".ds-cfg"); if (!c) { c = document.createElement("span"); c.className = "ds-cfg"; c.setAttribute("data-i18n-done", ""); const pr = side.querySelector(".profiles"); if (pr) pr.insertAdjacentElement("afterend", c); else side.prepend(c); }
  const tid = S.targetId, active = S.critIds.filter(k => (+S.weights[k] || 0) > 0).length;
  const prof = S.profile === "custom" ? tx("dsf.weights.custom") : tx("profile." + S.profile);
  c.innerHTML = `${esc(tx("dsp.cfg", { n: txInt(active), m: txInt(S.critIds.length) }))} <b>${esc(prof)}</b>`;
  let r = side.querySelector(".ds-reset"); if (!r) { r = document.createElement("button"); r.type = "button"; r.className = "ds-reset"; r.dataset.dsreset = ""; c.insertAdjacentElement("afterend", r); }
  r.textContent = tx("dsp.reset");
}
document.addEventListener("click", e => { const r = e.target.closest && e.target.closest("[data-dsreset]"); if (r) { applyProfile(S.profile in S.app.profiles ? S.profile : "general"); } });
{ const f = renderConsole; renderConsole = function () { const r = f.apply(this, arguments); try { dsCfgSummary(); } catch (e) { console.error(e); } return r; }; }
{ const f = renderLeft; renderLeft = function () { const r = f.apply(this, arguments); try { dsaPanelBtns(); } catch (e) { console.error(e); } return r; }; }
document.addEventListener("asterro:lang", () => { try { dsaPanelBtns(); dsCfgSummary(); } catch (e) { } });
