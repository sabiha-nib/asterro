/* ===== Data Source Intelligence: dimensions and challenge status labels in the Data view =====
 * Two additions to the Data tab, both read from generated records (nothing typed in by hand here):
 *   1. every dimension the challenge names, by family, with its status in ASTERRO (scored / extension / evidence /
 *      no data), unit, Earth source, planetary side and limitation (data/ext/dimensions.json + catalogues);
 *   2. every inventory source with the challenge's five status labels. The mapping is a rule over the inventory:
 *      integrated + no recorded unverified step -> "Integrated and verified"; integrated with a recorded unverified
 *      step (a known limitation names it) -> "Integrated, validation pending"; candidate whose access was blocked or
 *      not attempted -> "Available for future integration"; investigated and unsuitable -> "Investigated but
 *      unsuitable"; unavailable -> "Unavailable". A link is never an integration. */
const XDC_PENDING = { lim_power_unverified: ["nasa_power"], lim_modis_decoded: ["modis_aqua_lst"], lim_diviner_hour02: ["diviner", "diviner_polar"] };
function xdcLabel(it) {
  if (it.status === "integrated") {
    const pend = Object.entries(XDC_PENDING).filter(([lid, ids]) => ids.includes(it.id) && (typeof INV_BY === "undefined" || INV_BY[lid])).map(([lid]) => lid);
    return pend.length ? { k: "pending", why: pend } : { k: "verified", why: [] };
  }
  if (it.status === "blocked" || it.status === "not_investigated") return { k: "future", why: [] };
  if (it.status === "unavailable") return { k: it.unsuitable ? "unsuitable" : "unavailable", why: [] };
  if (it.status === "verified_not_integrated" || it.status === "downloaded_not_validated") return { k: "pending", why: [] };
  return null;
}
function xdcDims() {
  const D = XD.dimensions, fam = D.families;
  const rows = fam.map(f => {
    const ds = D.dimensions.filter(d => d.family === f);
    return `<tr class="xdc-fam"><th colspan="4" scope="colgroup">${esc(tx("ext.fam." + f))}</th></tr>` + ds.map(d => `<tr data-xdim="${d.id}"><th scope="row">${esc(tx("ext.dim." + d.id + ".name"))}<div class="meta">${esc(tx("ext.dim." + d.id + ".def"))}</div></th>
      <td><span class="xt-st dim-${d.status}">${esc(tx("ext.dimst." + d.status))}</span><div class="meta">${txHas("ext.dim." + d.id + ".unit") ? esc(tx("ext.dim." + d.id + ".unit")) : keep(d.unit)}</div></td>
      <td>${d.earth.length ? d.earth.map(id => keep(jnDataset(id).dataset || id)).join(", ") : (d.candidates.length ? esc(tx("ext.dim.candidates")) + " " + d.candidates.map(id => keep((typeof INV_BY !== "undefined" && INV_BY[id] && INV_BY[id].name) || id)).join(", ") : "—")}<div class="meta">${esc(tx("ext.dim." + d.id + ".planet"))}</div></td>
      <td class="meta">${esc(tx("ext.dim." + d.id + ".lim"))}</td></tr>`).join("");
  }).join("");
  const n = s => D.dimensions.filter(d => d.status === s).length;
  return `<div class="sec xdc" data-i18n-done data-xdc="dims"><div class="lbl">${esc(tx("ext.dc.dims_title"))}</div>
    <p class="note small">${esc(tx("ext.dc.dims_p", { a: txInt(n("scored")), b: txInt(n("extension")), c: txInt(n("evidence")), d: txInt(n("no_data")) }))}</p>
    <div class="tbl-wrap"><table class="t xt-t"><thead><tr><th scope="col">${esc(tx("ext.dc.col_dim"))}</th><th scope="col">${esc(tx("ext.dc.col_status"))}</th><th scope="col">${esc(tx("ext.dc.col_source"))}</th><th scope="col">${esc(tx("ext.dc.col_lim"))}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function xdcSources() {
  if (typeof INV === "undefined") return "";
  const items = INV.items.filter(it => it.class !== "limitation").map(it => [it, xdcLabel(it)]).filter(x => x[1]);
  const order = ["verified", "pending", "future", "unsuitable", "unavailable"];
  const cnt = Object.fromEntries(order.map(k => [k, items.filter(x => x[1].k === k).length]));
  return `<div class="sec xdc" data-i18n-done data-xdc="labels"><div class="lbl">${esc(tx("ext.dc.labels_title"))}</div>
    <p class="note small">${esc(tx("ext.dc.labels_p"))}</p>
    <p class="inv-counts">${order.map(k => `<span class="xt-st lab-${k}">${esc(tx("ext.dc.lab." + k))}</span> ${esc(txInt(cnt[k]))}`).join(" ")}</p>
    <div class="tbl-wrap"><table class="t xt-t"><thead><tr><th scope="col">${esc(tx("ext.dc.col_source"))}</th><th scope="col">${esc(tx("ext.dc.col_label"))}</th><th scope="col">${esc(tx("ext.dc.col_why"))}</th></tr></thead><tbody>
    ${items.map(([it, L]) => `<tr data-xlab="${esc(it.id)}" data-xlabk="${L.k}"><th scope="row">${keep(it.name)}${it.provider ? `<div class="meta">${keep(it.provider)}</div>` : ""}</th><td><span class="xt-st lab-${L.k}">${esc(tx("ext.dc.lab." + L.k))}</span></td>
      <td class="meta">${L.k === "pending" ? L.why.map(w => esc(tx("inv.lim." + w))).join(" ") : L.k === "future" ? esc(it.status === "blocked" ? tx("ext.dc.why_blocked", { d: INV.probed_utc ? txDate(new Date(INV.probed_utc)) : "—" }) : tx("ext.dc.why_not_inv")) : L.k === "verified" ? esc(tx("ext.dc.why_verified")) : ""}</td></tr>`).join("")}</tbody></table></div></div>`;
}
{ const f = viewData; viewData = function () { let h = f.apply(this, arguments); try { if (XD) h += xdcDims() + xdcSources(); } catch (e) { console.error(e); } return h; }; }
