/* ===== Phase IV · Explore adapter: readiness ≥ 3 registry targets in the baseline globe =====
 * Scoring configuration explore-target-v1: the unchanged baseline formula, coverage rule, tie-break and
 * proxy rules, applied to a complete (L3+) fingerprint with ranges [min, max] over valid Earth cells ∪ THIS
 * target's DIRECT/PROXY values. The registry's ranges are recomputed here from the stack and the target is
 * registered only if they agree exactly.
 * Legacy behaviour is untouched: Jezero, the Lunar South Pole and cross-planet always run with the legacy
 * table (app.json ranges) — the wrappers below pass legacy targets straight to the baseline functions with
 * S.ranges set to the legacy table. New targets are added to S.T only (never to S.targets / TARGET_IDS), so the
 * legacy cross-planet experiment and every legacy-only view are unchanged. */
const A4X = { ranges: {}, ids: [], rejected: {}, legacyRanges: null };
function a4ExploreIds() { return A4X.ids.slice(); }
function a4RangesFor(tid) { return A4X.ranges[tid] || A4X.legacyRanges || S.app.ranges; }
function a4ExploreRegister() {
  if (A4X.ids.length || !A4.reg) return;
  A4X.legacyRanges = S.app.ranges;
  for (const t of A4.reg.targets) {
    if (t.legacy || !t.scoring.earth_analogue_enabled || t.scoring.default_explore !== "explore-target-v1") continue;
    const fp = t.fingerprint, tv = Object.fromEntries(S.critIds.map(c => [c, ["DIRECT", "PROXY"].includes(fp.criterion_status[c]) ? fp.variables[c] : null]));
    const mine = RG.earthUnionRanges(S.A, S.critIds, tv);
    if (JSON.stringify(mine) !== JSON.stringify(Object.fromEntries(S.critIds.map(c => [c, t.scoring.explore_ranges[c]])))) { A4X.rejected[t.id] = "registry ranges differ from the browser recomputation"; continue; }
    const body = t.body.id, proxy = Object.fromEntries(S.critIds.map(c => [c, fp.criterion_status[c] === "PROXY"]));
    const comp = Object.fromEntries(S.critIds.map(c => [c, { DIRECT: "direct", PROXY: "proxy", "N/A": "not applicable", MISSING: "not applicable (missing)" }[fp.criterion_status[c]]]));
    const meth = Object.fromEntries(S.critIds.map(c => [c, `${fp.criterion_status[c]}. ${fp.spatial_support[c] || fp.missingness[c] || ""}${fp.temporal_support[c] ? "; " + fp.temporal_support[c] : ""}. ${(A4.reg.compatibility[c] || {}).why || ""}`]));
    S.T[t.id] = { id: t.id, body: t.body.name, name: t.name, registry: true,
      location: { lat: t.location.latitude, lon_east: t.location.longitude_east, window_km: t.location.window_km, note: t.location.relation },
      variables: tv, units: fp.units, comparison: comp, proxy_flags: proxy, methodology: meth, status: fp.criterion_status,
      sources: t.datasets.map(d => (A4.ix.datasets[d] || {}).product_id || d), source_urls: t.datasets.map(d => (A4.ix.datasets[d] || {}).url || ""),
      limitations: t.limitations.length ? t.limitations : ["See the registry record for this target."], interpretation: S.T.mars_jezero.interpretation,
      proxy_method: S.T.mars_jezero.proxy_method, scoring_config: "explore-target-v1", fingerprint_sha256: fp.content_sha256 };
    A4X.ranges[t.id] = mine; A4X.ids.push(t.id);
    TNAME[t.id] = t.name.replace(/ \(.*\)$/, ""); TBODY[t.id] = body.toUpperCase();
    THUMB[t.id] = t.thumbnail; THUMB_CAP[t.id] = t.thumbnail_caption;
    RAMPS[t.id] = RAMPS[body === "mars" ? "mars_jezero" : "moon_south_pole"];
  }
  a4ExploreControl();
}
function a4IsNew(tid) { return !!A4X.ranges[tid]; }
/* run a baseline function with the ranges that belong to `tid` (legacy table for legacy targets) */
function a4With(tid, f) { const keep = S.ranges; S.ranges = a4RangesFor(tid); try { return f(); } finally { S.ranges = keep; } }
const _b_simFor = simFor, _b_detailFor = detailFor, _b_setTarget = setTarget, _b_reproConfig = reproConfig;
simFor = function (tid, w) { return a4With(tid, () => _b_simFor(tid, w)); };
detailFor = function (tid, i, w = S.weights) { return a4With(tid, () => _b_detailFor(tid, i, w)); };
setTarget = function (tid) {
  if (!S.T[tid] && tid !== "cross") return;
  S.ranges = a4IsNew(tid) ? A4X.ranges[tid] : (A4X.legacyRanges || S.app.ranges);
  $("#app").dataset.body4 = a4IsNew(tid) ? S.T[tid].body.toLowerCase() : "";
  _b_setTarget(tid);
  a4ExploreControl();
};
reproConfig = function (i) {
  const o = _b_reproConfig(i);
  if (a4IsNew(o.target)) {
    const t = S.T[o.target];
    o.scoring_config = "explore-target-v1";
    o.rules.normalization = "min-max over all valid Earth cells union THIS target's DIRECT/PROXY values (explore-target-v1; registry " + A4.reg.registry_version + ")";
    o.targets_version = "registry.json " + A4.reg.registry_version + " (" + A4.reg.schema + ")";
    o.target_fingerprint_sha256 = t.fingerprint_sha256;
    o.reproduce_with = "python -m scripts.reproduce_registry reproduce.json";
  } else o.scoring_config = "legacy-baseline-v1";
  return o;
};
/* quick-switch control beside the baseline target buttons */
function a4ExploreControl() {
  const ctl = $(".target-ctl"); if (!ctl || !A4X.ids.length) return;
  let box = $("#tc-atlas");
  const groups = ["Mars", "Moon"].map(b => [b, A4X.ids.filter(id => S.T[id].body === b)]).filter(g => g[1].length);
  const cur = a4IsNew(S.targetId) ? S.targetId : "";
  const html = `<i>ATLAS · L3+</i><select id="tc-atlas-sel" aria-label="More analytical targets (readiness 3 or higher)"><option value="">${A4X.ids.length} more targets…</option>${groups.map(([b, ids]) => `<optgroup label="${b}">${ids.map(id => `<option value="${id}" ${id === cur ? "selected" : ""}>${esc(TNAME[id])}</option>`).join("")}</optgroup>`).join("")}</select>`;
  if (!box) { box = document.createElement("label"); box.id = "tc-atlas"; box.className = "tc-atlas"; ctl.appendChild(box); box.addEventListener("change", e => { if (e.target.value) setTarget(e.target.value); }); }
  box.innerHTML = html; box.setAttribute("aria-checked", !!cur); box.classList.toggle("on", !!cur);
}
function a4ExploreOpen(tid) {
  if (!a4IsNew(tid) && !TARGET_IDS.includes(tid)) return;
  setTarget(tid); setTab("explore");
  announce(`${TNAME[tid]} opened in Explore under ${a4IsNew(tid) ? "explore-target-v1" : "the legacy configuration"}.`);
}
/* the Phase II laboratory is defined for the legacy targets; say so rather than run it with other ranges */
const _p4RenderLeft = renderLeft;
renderLeft = function () {
  if (S.tab === "lab" && a4IsNew(S.targetId)) {
    $("#left").innerHTML = `<div class="sec"><div class="lbl">Phase II · Research laboratory</div><div class="callout">The Phase II laboratory modules are defined for the legacy targets (Jezero Crater, Lunar South Pole, cross-planet) and their legacy normalisation table. ${esc(TNAME[S.targetId])} is scored under explore-target-v1, so the laboratory is not run for it — no result is shown rather than one computed with mismatched ranges.</div>
      <div class="row"><button class="btn-sm" id="p4-lab-legacy">Switch to Jezero Crater</button><button class="btn-sm" id="p4-lab-atlas">Analyse ${esc(TNAME[S.targetId])} in the Atlas</button></div></div>`;
    $("#p4-lab-legacy").onclick = () => setTarget("mars_jezero");
    $("#p4-lab-atlas").onclick = () => { A3.active = S.targetId; A3.view = "target"; setTab("atlas"); };
    return;
  }
  return _p4RenderLeft.apply(this, arguments);
};
/* landing entry point: open the atlas directly from the hero */
(function a4Hero() {
  const s = $("#hero-science"); if (!s || $("#hero-atlas")) return;
  const b = document.createElement("button"); b.className = "btn-ghost"; b.id = "hero-atlas"; b.textContent = "Open the planetary atlas";
  b.title = "Browse Mars and Moon locations, readiness and analytical targets";
  s.insertAdjacentElement("afterend", b);
  b.addEventListener("click", () => {
    A3.view = "home"; setTab("atlas");
    if (innerWidth <= 760) {      // stacked layout: bring the atlas into view, again once the search reveal has re-laid out the page
      const go = () => { const l = $("#left"); if (l) l.scrollIntoView({ block: "start" }); return scrollY; };
      setTimeout(() => { const y = go(); setTimeout(() => { if (Math.abs(scrollY - y) < 2) go(); }, 6800); }, 400);
    }
  });
})();
