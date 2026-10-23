/* ===== Data inventory in the interface: Missing pieces statuses and the Data view =====
 * Every status shown comes from ASTERRO_INVENTORY (data_inventory.js), which scripts/build_inventory.py generates
 * from the registry's dataset records, the provenance manifest, the re-hashed raw files and a recorded access probe
 * of candidate sources. Nothing here marks anything integrated: a candidate becomes "integrated" only when the
 * registry carries it and its raw files verify. Text is localised here (inv.* keys); names and URLs stay as written. */
const INV = (typeof ASTERRO_INVENTORY !== "undefined") ? ASTERRO_INVENTORY : { items: [], statuses: {}, counts: {} };
const INV_BY = Object.fromEntries(INV.items.map(x => [x.id, x]));
const INV_ORDER = ["integrated", "verified_not_integrated", "downloaded_not_validated", "known_limitation", "blocked", "unavailable", "not_investigated"];
function invChip(st) { return `<span class="inv-st inv-${st}" title="${esc(tx("inv.def." + st))}">${esc(tx("inv.st." + st))}</span>`; }
function invName(it) { return it.class === "limitation" ? esc(tx("inv.lim." + it.id)) : keep(it.name); }
/* the inventory records behind one Missing-pieces item */
function invFor(m) {
  const src = { nasa_power: ["lim_power_unverified", "merra2", "terraclimate"], modis_aqua_lst: ["lim_modis_decoded", "modis_lst_hdf", "viirs"], gmted2010: ["lim_resolution", "nasadem", "copernicus_dem"] };
  switch (m.kind) {
    case "earth_missing": return m.c === "aridity" ? ["lim_aridity_nan", "terraclimate", "era5"] : [];
    case "partial_coverage": return ["lim_aridity_nan", "terraclimate"];
    case "thin_coverage": return ["lim_modis_decoded", "modis_lst_hdf", "viirs"];
    case "resolution": return ["lim_resolution", "nasadem", "copernicus_dem"];
    case "temporal": return ["lim_temporal", "era5", "merra2"];
    case "not_measured": return ["lim_not_measured"];
    case "source_dependence": return src[m.source] || [];
    case "structural": return ["@structural"];
    case "target_na": case "target_proxy": case "proxy_dependence": return ["@target"];
    default: return [];
  }
}
function invRow(id) {
  if (id === "@structural") return `<li>${invChip("known_limitation")} ${esc(tx("inv.structural"))}</li>`;
  if (id === "@target") return `<li>${invChip("known_limitation")} ${esc(tx("inv.target"))}</li>`;
  const it = INV_BY[id]; if (!it) return "";
  const why = it.status === "blocked" ? tx("inv.why.blocked", { d: INV.probed_utc ? txDate(new Date(INV.probed_utc)) : "—" }) + (it.reason && /account/.test(it.reason) ? " " + tx("inv.why.account") : "")
    : it.status === "not_investigated" ? tx("inv.why.not_investigated") : "";
  return `<li data-inv="${esc(id)}">${invChip(it.status)} ${invName(it)}${it.class !== "limitation" && txHas("inv.val." + id) ? ` <span class="meta">— ${esc(tx("inv.val." + id))}</span>` : ""}${why ? ` <span class="meta">${esc(why)}</span>` : ""}</li>`;
}
function invCounts() {
  return INV_ORDER.filter(s => INV.counts[s]).map(s => `${invChip(s)} ${esc(txInt(INV.counts[s]))}`).join(" ");
}
/* Missing pieces: each item says which records stand behind it, and the inventory is summarised at the end */
function invAugmentMissing() {
  const box = document.querySelector("#jn .jn-check"); if (!box || box.dataset.inv) return;
  box.dataset.inv = "1";
  const ctx = JN.tid && jnCtx(JN.tid); if (!ctx) return;
  const items = jnMissingItems(ctx, JE.lens(ctx, JN.i, jnW()));
  for (const m of items) {
    const li = box.querySelector(`[data-miss="${CSS.escape(m.id)}"] > div`); if (!li) continue;
    const ids = invFor(m); if (!ids.length) continue;
    const ul = document.createElement("ul"); ul.className = "inv-list"; ul.innerHTML = ids.map(invRow).join("");
    li.appendChild(ul);
  }
  const s = document.createElement("details"); s.className = "inv-sum"; s.setAttribute("data-inv-summary", "");
  s.innerHTML = `<summary>${esc(tx("inv.title"))} · ${invCounts()}</summary><p class="jn-note">${esc(tx("inv.p"))}</p>${invTable()}`;
  box.insertAdjacentElement("afterend", s);
}
function invTable() {
  const groups = [["integrated", it => it.class === "integrated"], ["known_limitation", it => it.class === "limitation"], ["candidates", it => it.class === "candidate" || it.class === "referenced_only" || it.class === "local_not_integrated"]];
  return groups.map(([g, f]) => { const rows = INV.items.filter(f); return rows.length ? `<h4 class="inv-h">${esc(tx("inv.group." + g))} (${esc(txInt(rows.length))})</h4><ul class="inv-list">${rows.map(it => it.class === "integrated"
    ? `<li data-inv="${esc(it.id)}">${invChip(it.status)} ${keep(it.name)} <span class="meta">${keep(it.provider || "")} · ${esc(tx("inv.use." + (/^scoring/.test(it.use) ? "score" : /evidence/.test(it.use) ? "evidence" : /context/.test(it.use) ? "context" : "record")))}${it.integrity_ok === true ? " · " + esc(tx("inv.sha_ok")) : it.integrity_ok === false ? " · " + esc(tx("inv.sha_bad")) : ""}</span></li>`
    : invRow(it.id)).join("")}</ul>` : ""; }).join("");
}
{ const f = jnRender; jnRender = function () { const r = f.apply(this, arguments); try { if (JN.open && JN.sec === "missing") invAugmentMissing(); } catch (e) { console.error(e); } return r; }; }
/* the Data view gains the inventory (rendered in the active language; the route translator leaves it alone) */
{ const f = viewData; viewData = function () { let h = f.apply(this, arguments); try { h += `<div class="sec inv-data" data-i18n-done><div class="lbl">${esc(tx("inv.title"))}</div><p class="note small">${esc(tx("inv.p"))}</p><p class="inv-counts">${invCounts()}</p>${invTable()}<p class="note small">${esc(tx("inv.doc"))} <span class="mono">docs/data/DATA_INVENTORY.md</span></p></div>`; } catch (e) { console.error(e); } return h; }; }

/* the translation status lives here, once, in the Method view, and in docs/i18n/TRANSLATION_REGISTER.md — not as a
 * warning on every screen (the journey's per-screen note is retired; its text stays in the catalogues) */
jnReviewNote = function () { return ""; };
{ const f = viewMethod; viewMethod = function () { let h = f.apply(this, arguments); try { h += `<div class="sec" data-i18n-done id="lang-status"><div class="lbl">${esc(tx("lang.section"))}</div><p class="note small">${esc(tx("lang.section_p"))}</p></div>`; } catch (e) { } return h; }; }
