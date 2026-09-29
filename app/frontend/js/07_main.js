/* ===== 07 main: wiring, hero sequence ===== */
function setTab(t) {
  S.tab = t; $$(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
  if (!S.searched && t !== "method" && t !== "data") return runSearch();
  if ($("#app").classList.contains("is-hero")) $("#app").classList.remove("is-hero");
  renderLeft(); try { history.replaceState(null, "", "#" + t); } catch (e) {}
}
function setTarget(tid) {
  if (tid === S.targetId && S.res) return;
  if (S.res) S.prev = null;
  S.targetId = tid; $("#app").dataset.target = tid;
  $$("[data-target]").forEach(b => { if (b.hasAttribute("aria-checked")) b.setAttribute("aria-checked", b.dataset.target === tid); });
  S.selected = null; S.picked = null;
  if (S.layer === "delta") setLayer("sim");
  compute(); paintField(); renderAll(); renderConsole();
  if (S.searched) announce(`${TNAME[tid]}: #1 ${placeStr(S.res.distinct[0])} at ${fmtPct(S.res.eff[S.res.distinct[0]])}.`);
}
function setLayer(l) {
  S.layer = l; $$("[data-layer]").forEach(b => b.setAttribute("aria-pressed", b.dataset.layer === l));
  GLOBE.layer = { sim: 0, clusters: 1, delta: 2 }[l]; GLOBE.dirty = true; renderLegend();
}
function setProj(p) { S.proj = p; $$("[data-proj]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.proj === p)); GLOBE.setProj(p); }
function select(i, fly) {
  S.selected = i; renderAll(["right", "left"]);
  if (fly) GLOBE.flyTo(S.lat[i], S.lon[i]);
  const el = $(`.site[data-cell="${i}"]`); el && el.scrollIntoView({ block: "nearest" });
}

async function runSearch() {
  if (S.searched) return;
  S.searched = true;
  const app = $("#app"); app.classList.remove("is-hero");
  GLOBE.autoRotate = false;
  const n = S.n.toLocaleString();
  renderAll(); renderConsole();
  $("#right").innerHTML = `<div class="rail-head"><div class="lbl">Analogue field</div><div class="meta">Comparing ${n} Earth cells…</div></div>`;
  GLOBE.animate("grid", 1, 700); GLOBE.animate("baseMix", 1, 1400);
  if (S.proj === 1) setTimeout(() => { GLOBE.resize(); GLOBE.animate("dist", GLOBE.mapFit(), 600); }, 900);
  const tgt = S.T[S.targetId] || S.T.mars_jezero;
  if (S.targetId !== "cross") GLOBE.flyTo(15, S.targetId === "moon_south_pole" ? -60 : -30);
  renderStatus(`fingerprint of ${TNAME[S.targetId]} applied to all ${n} cells — revealing from lowest to highest similarity`);
  const wait = ms => new Promise(r => setTimeout(r, REDUCED ? 0 : ms));
  await wait(500);
  GLOBE.animate("reveal", 1, 2600, t => t * t * (3 - 2 * t));
  await wait(2700);
  if (!S.res.clusters) computeClusters(); paintField();
  setLayer("clusters"); renderStatus(`${S.res.clusters.k} analogue constellations among the top ${S.app.thresholds.n_candidates} cells`);
  await wait(1700);
  setLayer("sim"); renderAll(); renderStatus();
  const first = S.res.distinct[0];
  GLOBE.flyTo(S.lat[first], S.lon[first]);
  announce(`Search complete. #1 ${placeStr(first)} at ${fmtPct(S.res.eff[first])}. Select it to open its analogue DNA.`);
  const f = $(".site[data-cell]"); if (f) f.classList.add("pulse");
}

function hover(x, y) {
  const r = $("#readout"); if (x == null || !S.searched) { r.innerHTML = ""; return; }
  const ll = GLOBE.unproject(x, y); if (!ll) { r.innerHTML = ""; return; }
  const i = nearestCell(ll.lat, ll.lon);
  if (i < 0 || ENG.haversine(ll.lat, ll.lon, S.lat[i], S.lon[i]) > 60) { r.innerHTML = `${fmtLat(ll.lat)} ${fmtLon(ll.lon)} · no valid land cell`; return; }
  r.innerHTML = `<b>${esc(placeStr(i))}</b><br>${fmtLat(S.lat[i])} ${fmtLon(S.lon[i])} · similarity <b>${fmtPct(S.res.eff[i])}</b> · rank #${S.res.rank[i] ? S.res.rank[i].toLocaleString() : "—"}`;
}
function pick(ll) {
  if (!S.searched) return;
  const i = nearestCell(ll.lat, ll.lon);
  if (i < 0 || ENG.haversine(ll.lat, ll.lon, S.lat[i], S.lon[i]) > 60) { announce("No valid land cell there (ocean or missing data)."); return; }
  S.picked = i; select(i, false);
  if (S.tab !== "compare" && S.tab !== "explore") setTab("explore");
  announce(`Picked ${placeStr(i)}: ${S.res.tid === "cross" ? "" : TNAME[S.res.tid] + " "}${fmtPct(S.res.eff[i])}.`);
}

function wire() {
  $$(".tabs button").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
  $$("[data-target]").forEach(b => { if (b.tagName === "BUTTON") b.addEventListener("click", () => setTarget(b.dataset.target)); });
  $("#btn-search").addEventListener("click", () => { if (!S.searched) runSearch(); else { const f = S.res.distinct[0]; select(f, true); } });
  $("#hero-search").addEventListener("click", runSearch);
  $("#hero-science").addEventListener("click", () => { S.tab = "method"; $("#app").classList.remove("is-hero"); setTab("method"); renderConsole(); renderRight(); });
  $$("[data-proj]").forEach(b => b.addEventListener("click", () => setProj(+b.dataset.proj)));
  $$("[data-layer]").forEach(b => b.addEventListener("click", () => setLayer(b.dataset.layer)));
  document.addEventListener("click", e => {
    const tg = e.target.closest("[data-railmore],[data-contoggle]");
    if (tg) { if (tg.dataset.railmore != null) { $("#right").classList.toggle("open"); renderRight(); } else { $("#console").classList.toggle("open"); renderConsole(); } return; }
    const t = e.target.closest("[data-cell],[data-fp],[data-act],[data-profile],[data-whatif],[data-cluster]"); if (!t) return;
    if (t.dataset.cell != null) { closeSheet(); select(+t.dataset.cell, true); }
    else if (t.dataset.fp) { S.fpMode = t.dataset.fp; renderLeft(); }
    else if (t.dataset.act === "trace") showTrace(); else if (t.dataset.act === "report") showReport(); else if (t.dataset.act === "reproduce") showReproduce();
    else if (t.dataset.profile) applyProfile(t.dataset.profile);
    else if (t.dataset.whatif) applyWhatIf(t.dataset.whatif);
    else if (t.dataset.cluster != null) { const k = +t.dataset.cluster; S.clusterFocus = k; setLayer("clusters"); const G = S.res.clusters.groups[k]; GLOBE.flyTo(S.lat[G.best], S.lon[G.best]); renderLeft(); }
  });
  $("#sheet-close").addEventListener("click", closeSheet);
  $("#sheet").addEventListener("click", e => { if (e.target.id === "sheet") closeSheet(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });
  GLOBE.onHover = hover; GLOBE.onPick = pick; GLOBE.onFrame = renderMarkers;
}

(async function boot() {
  const facts = $("#hero-facts");
  try {
    window.GLOBE = new Globe($("#globe"));
    GLOBE.reveal = 0; GLOBE.baseMix = 0.55; GLOBE.grid = 0.25; GLOBE.autoRotate = true;
    await loadAll(m => facts.textContent = m);
    const img = new Image(); img.onload = () => GLOBE.setBase(img); img.src = "data/bluemarble_2048.jpg";
    GLOBE.setCoast(S.labels.coast);
    compute(); paintField();
    wire(); renderConsole();
    facts.innerHTML = `${S.n.toLocaleString()} valid land cells · 6 criteria from NASA POWER, MODIS & GMTED2010 · targets built from MEDA, MOLA, LOLA & Diviner · every score deterministic and traceable`;
    if (innerWidth < 760) { setProj(1); }
    const h = (location.hash || "").slice(1);
    if (["method", "data"].includes(h)) { $("#app").classList.remove("is-hero"); setTab(h); renderRight(); }
    else if (["explore", "compare", "scenarios", "discover"].includes(h)) { S.tab = h; runSearch().then(() => setTab(h)); }
  } catch (err) {
    facts.innerHTML = `<span style="color:var(--mismatch)">Could not start: ${esc(err.message)}</span>`;
    console.error(err);
  }
})();
