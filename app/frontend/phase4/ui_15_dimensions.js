/* ===== The six environmental dimensions, explained in place (weight console) =====
 * Additive layer over the baseline console (js/05_console.js stays byte-identical): after each render every slider
 * gets a plain-language line, its unit, an active / not-active state, and a small scale with the target value
 * (diamond) and the selected Earth place (dot). An ⓘ button opens one explanation panel: what it measures, the
 * target value and how it was obtained, the selected place's value, its similarity s, its weight share and its
 * contribution to the score — all read from the unchanged engine (detailFor). Sliders, ids and behaviour are the
 * baseline's; nothing here computes a score. */
const DM = { open: null };
function dmCell() { return S.selected ?? S.picked ?? null; }
function dmTid() { return S.targetId === "cross" ? null : S.targetId; }
function dmActive(c) {
  const tid = S.targetId, has = tid === "cross" ? S.targets.some(t => t.variables[c] != null) : S.T[tid].variables[c] != null;
  return has && +S.weights[c] > 0;
}
function dmTrack(c) {
  const tid = dmTid(); if (!tid) return "";
  const R = a4RangesFor(tid)[c], t = S.T[tid].variables[c], i = dmCell(), e = i != null ? S.A[c][i] : null;
  const pos = v => (100 * clamp((v - R[0]) / (R[1] - R[0]), 0, 1)).toFixed(1);
  if (t == null) return `<div class="dm-et na" aria-hidden="true"></div>`;
  return `<div class="dm-et" aria-hidden="true"><i class="dm-t" style="left:${pos(t)}%"></i>${e != null && e === e ? `<i class="dm-e" style="left:${pos(e)}%"></i>` : ""}</div>`;
}
function dmDecorate() {
  const box = $("#console"); if (!box || !S.app) return;
  for (const c of S.critIds) {
    const inp = $("#w-" + c), sl = inp && inp.closest(".sl"); if (!sl) continue;
    sl.classList.toggle("dm-off", !dmActive(c)); sl.dataset.dm = c;
    if (!sl.querySelector(".dm-plain")) {
      const u = unitOf(c), p = document.createElement("div"); p.className = "dm-plain";
      p.innerHTML = `${esc(tx("crit." + c + ".plain"))}${u ? ` <span class="dm-u">${keep(u)}</span>` : ""}`; p.title = tx("crit." + c + ".plain");
      sl.querySelector("label").insertAdjacentElement("afterend", p);
      inp.insertAdjacentHTML("afterend", dmTrack(c));
      const f = sl.querySelector(".foot");
      if (f) f.insertAdjacentHTML("afterbegin", `<button type="button" class="dm-i" data-dm-info="${c}" aria-expanded="${DM.open === c}" aria-controls="dm-info" aria-label="${esc(tx("dm.about", { c: tx("crit." + c) }))}">ⓘ</button>`);
    } else { const old = sl.querySelector(".dm-et"); if (old) old.outerHTML = dmTrack(c); }
  }
  let panel = $("#dm-info");
  if (DM.open) {
    if (!panel) { panel = document.createElement("div"); panel.id = "dm-info"; panel.className = "dm-info"; panel.setAttribute("role", "region"); const sl = box.querySelector(".sliders"); sl && sl.insertAdjacentElement("afterend", panel); }
    panel.setAttribute("aria-label", tx("dm.about", { c: tx("crit." + DM.open) }));
    panel.innerHTML = dmInfo(DM.open);
  } else if (panel) panel.remove();
}
function dmInfo(c) {
  const tid = dmTid(), i = dmCell(), u = unitOf(c), on = dmActive(c);
  let h = `<div class="dm-ih"><b>${esc(tx("crit." + c))}</b><span class="dm-st ${on ? "on" : "off"}">${esc(tx(on ? "dm.active" : "dm.inactive"))}</span><button type="button" class="dm-x" data-dm-info="${c}" aria-label="${esc(tx("nav.close"))}">×</button></div>`;
  h += `<p>${esc(tx("crit." + c + ".plain"))}${u ? ` · ${esc(tx("dm.unit"))} ${keep(u)}` : ""}.</p>`;
  if (tid) {
    const T = S.T[tid], st = (T.status || {})[c];
    h += `<p><b>${jnTName(tid)}</b>: ${T.variables[c] == null ? esc(tx("dm.no_target")) : jnVal(c, T.variables[c])} ${st ? jnStatusChip(st) : ""}</p>`;
    if (T.methodology && T.methodology[c]) h += `<p class="dm-meth">${esc(tx("dm.method"))} ${keep(String(T.methodology[c]).slice(0, 240))}</p>`;
    if (i != null) {
      const d = detailFor(tid, i).rows.find(r => r.c === c);
      h += `<p><b>${jnPlace(i)}</b>: ${jnVal(c, d.e)}${d.s != null ? ` · s = ${esc(txNum(d.s, 3))} · ${esc(tx("dm.contrib", { k: txNum(100 * d.k, 1), w: txNum(d.w, 2) }))}` : d.e == null && d.active ? ` · ${esc(tx("dm.missing_here"))}` : ""}</p>`;
    } else h += `<p class="dm-meth">${esc(tx("dm.pick"))}</p>`;
  } else h += `<p class="dm-meth">${esc(tx("dm.cross"))}</p>`;
  h += `<p class="dm-note">${esc(tx("dm.weight_note"))}</p>`;
  return h;
}
{ const f = renderConsole; renderConsole = function () { const r = f.apply(this, arguments); try { dmDecorate(); } catch (e) { console.error(e); } return r; }; }
{ const f = updateConsoleNumbers; updateConsoleNumbers = function () { const r = f.apply(this, arguments); try { for (const c of S.critIds) { const sl = $("#w-" + c)?.closest(".sl"); if (sl) sl.classList.toggle("dm-off", !dmActive(c)); } } catch (e) { } return r; }; }
{ const f = select; select = function () { const r = f.apply(this, arguments); try { dmDecorate(); } catch (e) { } return r; }; }
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-dm-info]"); if (!b) return;
  const c = b.dataset.dmInfo; DM.open = DM.open === c ? null : c; dmDecorate();
  for (const x of $$(".dm-i")) x.setAttribute("aria-expanded", x.dataset.dmInfo === DM.open);
  const back = $(`.dm-i[data-dm-info="${c}"]`); if (back) back.focus();
  if (DM.open && typeof jlMark === "function") jlMark("dim:" + c);
});
