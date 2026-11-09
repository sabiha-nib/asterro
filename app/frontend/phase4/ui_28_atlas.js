/* ===== Atlas: the Earth globe at the centre, a quiet context card, layers on request =====
 * In the Atlas view the planetary atlas moves to a narrower side panel so the 3D Earth globe (still the default
 * projection) takes the centre. Selecting an Earth candidate (globe or list) shows a short context card on the globe:
 * where it is, how similar it is to the current target, its landscape and climate class, the strongest similarities
 * and the important differences, with the full analysis one click away. The analysis layer buttons (Similarity,
 * Constellations, Change, Coverage, Dimension) are behind a single "Layers" button in this view. Nothing is computed
 * here that the engine does not already provide. */
function dsaCard() {
  const vp = document.getElementById("viewport"); if (!vp) return;
  let c = document.getElementById("ds-acard");
  if (S.tab !== "atlas" || !S.res) { if (c) c.hidden = true; return; }
  if (!c) { c = document.createElement("section"); c.id = "ds-acard"; c.className = "ds-acard"; c.setAttribute("aria-live", "polite"); c.setAttribute("data-i18n-done", ""); vp.appendChild(c); }
  c.hidden = false;
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
