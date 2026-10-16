/* ===== Phase III · Earth-to-World Analogue Translator and Analogue Expedition Designer =====
 * Translator: states, criterion by criterion, in what sense an Earth cell is (and is not) analogous
 * to a target — a partial analogy, never an equivalence.
 * Expedition designer: turns chosen candidates into analytical field objectives and measurement
 * needs. It contains no travel, cost, access, permit or safety information and invents none. */
const AT_FACTS = {
  Mars: { src: "NASA NSSDCA Mars Fact Sheet, https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html",
    items: [["Surface gravity", "3.71 m/s² (0.38 of Earth)"], ["Mean surface pressure", "~6.36 mbar (~0.6 % of Earth's); MEDA median at Jezero 740 Pa (baseline record)"],
      ["Atmosphere", "~95 % CO₂"], ["Length of day", "24.66 h (sol)"], ["Liquid water", "not stable at the surface under present conditions"]] },
  Moon: { src: "NASA NSSDCA Moon Fact Sheet, https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html",
    items: [["Surface gravity", "1.62 m/s² (0.165 of Earth)"], ["Atmosphere", "none (exosphere only)"], ["Length of day", "29.53 Earth days (synodic)"],
      ["Thermal cycle", "local times 13–14 h and 01–02 h are lunar hours (~29.5 Earth hours each): the lunar ΔT develops over ~2 weeks, the Earth ΔT over ~12 h"],
      ["Surface", "regolith; no weathering by water or wind"]] },
};
function atTranslate(t, i) {
  const R = atCands(t, 20), w = atWeights(), X = R.eligible ? ATL.explain(R.P, w, i, S.A, R.ranges) : [], by = Object.fromEntries(X.map(x => [x.criterion, x]));
  return S.critIds.map(c => {
    const st = t.status[c], x = by[c];
    if (st === "INCOMPATIBLE") return { c, verdict: "NO COUNTERPART", text: t.status_reason[c] };
    if (st === "PROXY") return { c, verdict: "PROXY ONLY", text: `Represented by a rule-based proxy (${t.status_reason[c]}); the Earth value ${atVal(c, S.A[c][i])} is not compared with a target measurement.` };
    if (st !== "DIRECT") return { c, verdict: "NOT COMPARABLE", text: `The target has no ${st === "MISSING" ? "assembled" : "validated"} value: ${t.status_reason[c]}` };
    if (!x || x.similarity == null) return { c, verdict: "NOT COMPARABLE", text: `No Earth value at this cell for ${labelOf(c)}.` };
    const v = x.similarity >= 0.85 ? "ANALOGOUS" : x.similarity >= 0.6 ? "PARTIALLY ANALOGOUS" : "NOT ANALOGOUS";
    const extra = c === "lst_diurnal_range" && t.body === "Moon" ? " The lunar cycle lasts ~29.5 Earth days, so equal ΔT does not mean an equal heating rate." :
      c === "lst_diurnal_range" ? " Ground temperature from a different instrument and retrieval; compare magnitudes, not absolute calibration." :
      c === "annual_temperature_range" ? " Mars 'months' are 30° Ls bins (~56 sols)." : " Same algorithm at the same ~1 km baseline.";
    return { c, verdict: v, s: x.similarity, text: `Earth ${atVal(c, x.earth)} vs ${t.name} ${atVal(c, x.target)} (s = ${x.similarity.toFixed(2)}).${extra}` };
  });
}
const AT_VCLS = { ANALOGOUS: "c-match", "PARTIALLY ANALOGOUS": "c-partial", "NOT ANALOGOUS": "c-mismatch", "NOT COMPARABLE": "st-m", "NO COUNTERPART": "st-x", "PROXY ONLY": "st-p" };
A3_VIEWS.translate = function () {
  const t = atT(A3.active); if (!t) return `<div class="sec"><div class="empty">Choose a target.</div></div>`;
  const R = atCands(t, 20);
  let h = `<div class="sec"><h3 class="ttl">Earth-to-world analogue translator</h3>${atBanner("interpretation aid")}
    <p class="note">An analogue is a partial correspondence on named dimensions, never an equivalence. This view states which dimensions correspond, which do not, and which ASTERRO cannot assess at all.</p>
    <div class="lab-form"><label class="wide">Target${atTargetPicker(t.id)}</label></div></div>`;
  if (!R.eligible) return h + `<div class="sec"><div class="callout warn">${esc(R.reason)}</div></div>`;
  const i = A3.cand[t.id] ?? R.top[0];
  const T = atTranslate(t, i);
  h += `<div class="sec"><div class="lbl">${esc(placeStr(i))} → ${esc(t.name)} · atlas comparison score ${fmtPct(R.eff[i])}</div>
    <div class="row">${R.top.slice(0, 8).map(k => `<button class="btn-sm${k === i ? " on" : ""}" data-a3="cand" data-t="${t.id}" data-i="${k}">${esc(candShort(k))}</button>`).join("")}</div>
    <div class="tbl-wrap"><table class="t"><thead><tr><th>Dimension</th><th>Correspondence</th><th>Statement</th></tr></thead><tbody>
    ${T.map(r => `<tr><td>${esc(labelOf(r.c))}</td><td><span class="tag ${AT_VCLS[r.verdict]}">${esc(r.verdict)}</span></td><td class="meta">${esc(r.text)}</td></tr>`).join("")}</tbody></table></div>
    <p class="note"><b>Translation:</b> ${esc(placeStr(i))} reproduces ${t.name}'s ${T.filter(r => r.verdict === "ANALOGOUS").map(r => labelOf(r.c).toLowerCase()).join(", ") || "no dimension"} closely${T.some(r => r.verdict === "PARTIALLY ANALOGOUS") ? ", " + T.filter(r => r.verdict === "PARTIALLY ANALOGOUS").map(r => labelOf(r.c).toLowerCase()).join(", ") + " partly" : ""}. It is ${T.some(r => r.verdict === "NOT ANALOGOUS") ? "not analogous in " + T.filter(r => r.verdict === "NOT ANALOGOUS").map(r => labelOf(r.c).toLowerCase()).join(", ") + ", and " : ""}not assessed in ${T.filter(r => ["NOT COMPARABLE", "NO COUNTERPART", "PROXY ONLY"].includes(r.verdict)).map(r => labelOf(r.c).toLowerCase()).join(", ") || "no criterion"}.</p></div>
    <div class="sec"><div class="lbl">Not represented by any ASTERRO criterion · ${t.body}</div><div class="tbl-wrap"><table class="t"><tbody>${AT_FACTS[t.body].items.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="meta">${esc(b)}</td></tr>`).join("")}</tbody></table></div>
    <p class="note small">Context from ${esc(AT_FACTS[t.body].src)}. These properties are not compared with Earth and no Earth cell reproduces them; any analogue study must account for them separately.</p></div>`;
  return h;
};

/* ---------- Expedition designer ---------- */
A3.exp = { picks: [], title: "" };
const AT_MEAS = {
  lst_diurnal_range: "Surface (skin) temperature at ~13:30 and ~01:30 local time, e.g. a thermal-infrared radiometer, over all seasons.",
  annual_temperature_range: "Near-surface air temperature logged hourly for at least one year.",
  slope: "Slope at a ~1 km baseline and finer, from a high-resolution DEM (e.g. photogrammetry or lidar).",
  surface_roughness: "Elevation variability within ~55 km and at sub-km scales from the same DEM.",
  aridity: "Precipitation and potential evapotranspiration (station or reanalysis) — the target value is a proxy.",
  elevation: "Surface pressure (the 'thin atmosphere' proxy) — the target value is a proxy.",
};
A3_VIEWS.expedition = function () {
  const t = atT(A3.active); if (!t) return `<div class="sec"><div class="empty">Choose a target.</div></div>`;
  const R = atCands(t, 20);
  let h = `<div class="sec"><h3 class="ttl">Analogue expedition designer</h3>${atBanner("research design aid")}
    <p class="note">Turns chosen Earth candidates into analytical field objectives: what each site can and cannot represent, and which measurements would test the analogy. <b>ASTERRO holds no travel, access, cost, permit or safety information and generates none.</b></p>
    <div class="lab-form"><label class="wide">Target${atTargetPicker(t.id)}</label></div></div>`;
  if (!R.eligible) return h + `<div class="sec"><div class="callout warn">${esc(R.reason)}</div></div>`;
  const picks = A3.exp.picks.filter(i => R.top.includes(i));
  h += `<div class="sec"><div class="lbl">Choose sites (top 20 candidates)</div><div class="lab-picks">${R.top.map((i, k) => `<label class="ck"><input type="checkbox" data-a3in="exp-p" value="${i}" ${picks.includes(i) ? "checked" : ""}>${k + 1}. ${esc(candShort(i))} (${fmtPct(R.eff[i], 0)})</label>`).join("")}</div></div>`;
  if (!picks.length) return h + `<div class="sec"><p class="meta">Select one or more sites.</p></div>`;
  const T = picks.map(i => ({ i, tr: atTranslate(t, i) }));
  // geographic grouping only (no routes): sites within 1000 km of each other
  const groups = []; for (const i of picks) { const g = groups.find(G => G.some(j => ATL.haversine(S.lat[i], S.lon[i], S.lat[j], S.lon[j]) < 1000)); g ? g.push(i) : groups.push([i]); }
  h += `<div class="sec"><div class="lbl">Field objectives per site</div>${T.map(({ i, tr }) => `<div class="fm-card"><div class="fm-h">${esc(placeStr(i))}</div><div class="meta">${atFmtLL(S.lat[i], S.lon[i])} · cell ${S.cell[i]} · ${nfmt(cellArea(i))} km² cell</div>
      <dl><dt>Represents</dt><dd>${tr.filter(r => r.verdict === "ANALOGOUS").map(r => esc(labelOf(r.c))).join(", ") || "no criterion closely"}</dd>
      <dt>Partly</dt><dd>${tr.filter(r => r.verdict === "PARTIALLY ANALOGOUS").map(r => esc(labelOf(r.c))).join(", ") || "—"}</dd>
      <dt>Does not represent</dt><dd>${tr.filter(r => r.verdict === "NOT ANALOGOUS").map(r => esc(labelOf(r.c))).join(", ") || "—"}; and every property listed in the Translator as not represented.</dd>
      <dt>Measurements to test the analogy</dt><dd><ul class="lab-ul">${tr.filter(r => ["ANALOGOUS", "PARTIALLY ANALOGOUS"].includes(r.verdict)).map(r => `<li>${esc(AT_MEAS[r.c])}</li>`).join("") || "<li>—</li>"}</ul></dd>
      <dt>Not assessed</dt><dd>Access, travel, cost, permits, land ownership, hazards and safety: to be established by the team from authoritative local sources.</dd></dl></div>`).join("")}
    <p class="note small">Geographic grouping (sites within 1,000 km of another chosen site): ${groups.map((g, k) => `group ${k + 1}: ${g.map(i => esc(candShort(i))).join(", ")}`).join(" · ")}. Grouping is by great-circle distance only; it is not a route.</p></div>
    <div class="sec"><div class="lbl">Target-side gaps the expedition cannot close</div><ul class="lab-ul">${ATL.missingEvidence(t, S.critIds, atWeights()).filter(m => m.status !== "PROXY").map(m => `<li>${esc(m.criterion === "heterogeneity" ? "Within-feature heterogeneity" : labelOf(m.criterion))} (${m.status}) — requires planetary data, not fieldwork on Earth.</li>`).join("") || "<li>None among scored criteria.</li>"}</ul>
    <button class="btn-sm" data-a3="exp-export">Export design (JSON)</button></div>`;
  return h;
};
A3_INPUTS["exp-p"] = a => { const i = +a.value, s = new Set(A3.exp.picks); a.checked ? s.add(i) : s.delete(i); A3.exp.picks = [...s]; atRender(); };
A3_ACTIONS["exp-export"] = () => {
  const t = atT(A3.active), R = atCands(t, 20), picks = A3.exp.picks.filter(i => R.top.includes(i));
  const d = { schema: "asterro.expedition-design/1", created_utc: new Date().toISOString(), target: t.id, atlas_version: A3.atlas.version, profile: A3.profile, normalisation: A3.norm,
    sites: picks.map(i => ({ cell: S.cell[i], lat: S.lat[i], lon: S.lon[i], place: placeStr(i), score: R.eff[i], translation: atTranslate(t, i).map(r => ({ criterion: r.c, verdict: r.verdict })) })),
    not_assessed: ["access", "travel", "cost", "permits", "land ownership", "hazards", "safety"] };
  showExport("Expedition design", JSON.stringify(d, null, 1), "asterro-expedition-design.json");
};
