/* ===== Phase IV · Expedition objectives (extends the Phase III Analogue Expedition Designer) =====
 * A research objective selects one of the existing editorial weighting profiles (a transparent, fixed rule) and
 * states which measurable criteria matter for it and why, which criteria the selected target can actually support,
 * and the research questions the plan should answer. The Phase III designer below then turns chosen candidates into
 * field objectives and measurement needs. Nothing here is a safety, access or suitability assessment. */
const A4_OBJECTIVES = {
  rover_mobility: { label: "Rover mobility research", profile: "rover", key: ["slope", "surface_roughness"],
    why: "Traversability at the ~1 km baseline is governed mainly by slope and roughness; climate is secondary.",
    questions: ["Do slope and roughness distributions at metre scale resemble the target's at the scales a rover experiences?", "Which terrain properties not in ASTERRO (rock abundance, soil bearing strength) must be measured on site?"] },
  terrain_navigation: { label: "Terrain navigation", profile: "rover", key: ["slope", "surface_roughness"],
    why: "Navigation tests depend on relief and obstacle density; ASTERRO represents relief only through 926.6 m slope and window roughness.",
    questions: ["Is the relief at the candidate comparable over the navigation test footprint?", "Which visual or lighting conditions (not modelled) differ from the target?"] },
  thermal: { label: "Thermal-environment investigation", profile: "thermal", key: ["lst_diurnal_range", "annual_temperature_range"],
    why: "Hardware thermal cycling is dominated by the diurnal surface swing and the seasonal air-temperature range.",
    questions: ["How does the measured diurnal surface range at the candidate compare with the target's, given the point-vs-cell scale difference?", "Which absolute temperatures (not modelled) bound the test?"] },
  eva_training: { label: "Astronaut field training", profile: "eva", key: ["aridity", "lst_diurnal_range", "slope"],
    why: "Crew exposure: dryness, thermal swings and walkable terrain.",
    questions: ["Which aspects of the target environment can the candidate NOT represent (gravity, atmosphere, radiation)?", "Which training objectives depend only on the represented criteria?"] },
  instrument: { label: "Instrument testing", profile: "instrument", key: ["aridity", "elevation"],
    why: "Dry surfaces and thin (high) atmosphere columns matter most for instrument analogues; both target values are PROXY rules.",
    questions: ["Are the instrument's sensitivities covered by the criteria ASTERRO models?", "Which measured surface properties must be characterised before testing?"] },
  geology: { label: "Geological fieldwork", profile: "general", key: [],
    why: "ASTERRO does not model geology, lithology or mineralogy. Equal weights are used and the comparison is environmental only.",
    questions: ["Which geological evidence (not in ASTERRO) would establish a geological analogy?", "Do the environmental criteria at least match the context of the geological question?"] },
  habitat: { label: "Habitat-environment studies", profile: "habitat", key: ["lst_diurnal_range", "annual_temperature_range", "slope"],
    why: "Long-duration stays: thermal environment plus low slope for construction.",
    questions: ["Which thermal extremes (not modelled) drive habitat design?", "Is low slope available at the construction scale?"] },
  surface_planning: { label: "Surface exploration planning", profile: "general", key: [],
    why: "Equal weight on every available criterion; use the Scenario Lab to test how the plan depends on priorities.",
    questions: ["Which candidates remain competitive across profiles (Scenario Lab, robust candidates)?", "Which target-side measurements would change the plan most (missing evidence below)?"] },
};
A4.exp = { obj: null };
const _p3Expedition = A3_VIEWS.expedition;
A3_VIEWS.expedition = function () {
  const base = _p3Expedition();
  if (!A4.reg) return base;
  const t = atT(A3.active), rt = t && a4T(t.id), O = A4.exp.obj && A4_OBJECTIVES[A4.exp.obj];
  let h = `<div class="sec"><div class="lbl">Phase IV · Research objective</div>${a4Banner("objective → criteria (fixed, transparent rules)")}
    <div class="p4-obj" role="radiogroup" aria-label="Research objective">${Object.entries(A4_OBJECTIVES).map(([k, o]) => `<label class="p4-radio"><input type="radio" name="a4obj" data-a4in="expobj" value="${k}" ${A4.exp.obj === k ? "checked" : ""}> <b>${esc(o.label)}</b><span class="meta small">profile: ${esc(S.app.profiles[o.profile].label)}</span></label>`).join("")}</div>`;
  if (O && rt) {
    const P = S.app.profiles[O.profile], fp = rt.fingerprint;
    h += `<p class="note small"><b>${esc(O.label)}.</b> ${esc(O.why)} Selecting it sets the weighting profile to <b>${esc(P.label)}</b> (${esc(P.rationale || "")}).</p>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th><th class="n">weight</th><th>Key for this objective</th><th>${esc(rt.name)}</th></tr></thead><tbody>
      ${S.critIds.map(c => `<tr><td>${esc(labelOf(c))}</td><td class="n">${(+P.weights[c]).toFixed(1)}</td><td>${O.key.includes(c) ? "yes" : ""}</td><td class="${{ DIRECT: "st-d", PROXY: "st-p", "N/A": "st-x", MISSING: "st-m" }[fp.criterion_status[c]]}">${esc(fp.criterion_status[c])}${O.key.includes(c) && fp.criterion_status[c] !== "DIRECT" ? " — key criterion not measured at the target" : ""}</td></tr>`).join("")}</tbody></table></div>
      <p class="small"><b>Research questions for the plan</b></p><ul class="lab-ul small">${O.questions.map(q => `<li>${esc(q)}</li>`).join("")}</ul>
      <p class="meta small">An environmental analogy is not a training-site certification: access, safety, permits and operational suitability are not assessed.</p>`;
  } else h += `<p class="meta small">Choose an objective to set the weighting profile and see which criteria matter.</p>`;
  return h + `</div>` + base;
};
A4_INPUTS.expobj = function (a) { A4.exp.obj = a.value; A3.profile = A4_OBJECTIVES[a.value].profile; A3.cache.clear && A3.cache.clear(); atRender(); };
/* the exported design records the objective */
const _p3ExpExport = A3_ACTIONS["exp-export"];
A3_ACTIONS["exp-export"] = function () {
  const _show = showExport;
  if (A4.exp.obj) showExport = (title, txt, fn) => { const d = JSON.parse(txt); d.objective = { id: A4.exp.obj, label: A4_OBJECTIVES[A4.exp.obj].label, profile: A4_OBJECTIVES[A4.exp.obj].profile, questions: A4_OBJECTIVES[A4.exp.obj].questions }; _show(title, JSON.stringify(d, null, 1), fn); };
  try { _p3ExpExport(); } finally { showExport = _show; }
};
