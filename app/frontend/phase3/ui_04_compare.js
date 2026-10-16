/* ===== Phase III · Multi-target comparison workspace =====
 * For the selected targets: Earth candidates per target, ranking stability, distinguishing
 * dimensions, shared and complementary candidates, missing evidence and discriminating measurements. */
const AT_LETTER = ["A", "B", "C", "D", "E", "F", "G", "H"];
function atSelTargets() { return A3.sel.map(atT).filter(Boolean); }
function atStabKey(t) { return atKey(t, "stab"); }
async function atRunStability(ts) {
  const w = atWeights();
  A3.busy = { label: "Weight-perturbation stability", done: 0, total: ts.length, cancel: false }; atRender();
  for (const t of ts) {
    if (A3.busy.cancel) break;
    const R = atCands(t, 20); if (!R.eligible) { A3.busy.done++; continue; }
    const act = R.P.applicable.filter(c => w[c] > 0);
    const factors = act.length <= 2 ? [0.5, 0.75, 1, 1.5, 2] : [0.5, 1, 2];
    const design = LAB.designFactorial(w, act, S.critIds, factors);
    const run = await LAB.runDesign({ Ps: [R.P], cell: S.cell, cand: R.top, baseW: w, design, onProgress: () => !A3.busy.cancel });
    if (run.cancelled) break;
    A3.stab[atStabKey(t)] = { stats: LAB.rankStats(run, { topN: 20, topPct: 1 }), design: design.length, factors, active: act, cand: R.top.slice(), flips: (pf => ({ any: pf.filter(p => p.flips > 0).length, pairs: pf.length, worst: pf[0] ? pf[0].frac : 0 }))(LAB.pairFlips(run)) };
    A3.busy.done++; atRender();
  }
  A3.busy = null; atRender();
}
function atImpactKey(t) { return atKey(t, "impact"); }
function atRunImpact(ts) {
  const w = atWeights();
  for (const t of ts) {
    if (!ATL.eligibility(t, S.critIds).ok) continue;
    const res = [];
    for (const c of S.critIds) {
      if (t.status[c] !== "MISSING") continue;
      const sc = A3.atlas.targets.filter(o => o.body === t.body && o.id !== t.id && o.status[c] === "DIRECT")
        .map(o => ({ label: "value observed at " + o.name, value: o.values[c] }));
      if (!sc.length) { res.push({ criterion: c, blocked: `No other ${t.body} target has a measured ${labelOf(c)}; no scenario can be formed.` }); continue; }
      res.push(ATL.measurementImpact({ A: S.A, cell: S.cell, lat: S.lat, lon: S.lon, critIds: S.critIds, t, ranges: atRanges(t), w, criterion: c, scenarios: sc }));
    }
    A3.stab[atImpactKey(t)] = res;
  }
  atRender();
}
A3_VIEWS.compare = function () {
  const ts = atSelTargets();
  let h = `<div class="sec"><h3 class="ttl">Multi-target comparison</h3>${atBanner("comparison workspace")}
    <p class="note">Compares Earth analogue evidence across the selected targets. Every score below is an <b>atlas comparison score</b> on the target's directly comparable criteria; it is not the baseline Analogue Score and it is not a suitability or safety rating.</p>${atControls()}${atCtxLine()}</div>`;
  if (!ts.length) return h + `<div class="sec"><div class="empty">Select targets in the Atlas view, or <button class="lnk" data-a3="selexample">load the example (Gale · Elysium · Shackleton)</button>.</div></div>`;
  const R = atRanges(null), D = ATL.distinguishing(ts, S.critIds, A3.norm === "atlas" ? A3.atlas.normalisation.ranges : S.app.ranges);
  const res = ts.map(t => Object.assign(atCands(t, 20), { targetId: t.id }));
  // 1 · fingerprints
  h += `<div class="sec"><div class="lbl">1 · Fingerprints</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th>${ts.map((t, k) => `<th>${AT_LETTER[k]} · ${esc(t.name)}<div class="meta">L${t.readiness.level}</div></th>`).join("")}</tr></thead><tbody>
    ${S.critIds.map(c => `<tr><td>${esc(labelOf(c))}</td>${ts.map(t => `<td>${t.status[c] === "DIRECT" ? atVal(c, t.values[c]) + " " : ""}${atStatus(t.status[c])}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
  // 2 · distinguishing dimensions
  const VERD = { COMPARABLE: "comparable for all", PARTIALLY_COMPARABLE: "comparable for some", NOT_COMPARABLE: "not comparable", NOT_DISTINGUISHING_PROXY: "proxy — identical by rule" };
  h += `<div class="sec"><div class="lbl">2 · Which dimensions distinguish the targets</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th><th class="n">normalised spread</th><th>largest pairwise difference</th><th>comparability</th></tr></thead><tbody>
    ${D.rows.slice().sort((a, b) => (b.spread ?? -1) - (a.spread ?? -1)).map(r => { const p = r.pairs.slice().sort((x, y) => y.normDiff - x.normDiff)[0];
      return `<tr><td>${esc(labelOf(r.criterion))}</td><td class="n">${r.spread == null ? "—" : r.spread.toFixed(3)}</td><td class="meta">${p ? `${esc(atT(p.a).name)} vs ${esc(atT(p.b).name)}: ${atVal(r.criterion, Math.abs(p.diff))}` : "—"}</td><td class="meta">${esc(VERD[r.verdict])}${r.missing.length ? " · missing: " + r.missing.map(x => esc(atT(x).name)).join(", ") : ""}${r.incompatible.length ? " · incompatible: " + r.incompatible.map(x => esc(atT(x).name)).join(", ") : ""}</td></tr>`; }).join("")}
    </tbody></table></div><p class="note small">Spread = (max − min) / normalisation span over targets with a directly comparable value. A dimension that is missing for a target cannot distinguish it; proxies are identical for every planetary target by construction.</p></div>`;
  // 3 · candidates per target + map
  const items = [];
  res.forEach((r, k) => { if (r.eligible) r.top.slice(0, 10).forEach((i, q) => items.push({ i, t: r.targetId, label: AT_LETTER[k] + (q + 1), cls: "t" + k, title: `${AT_LETTER[k]}${q + 1} · ${atT(r.targetId).name}: ${placeStr(i)} · ${fmtPct(r.eff[i])}` })); });
  h += `<div class="sec"><div class="lbl">3 · Earth analogue candidates per target (top 10, ≥ 300 km apart)</div>${atEarthMap("at-cmp", items)}
    <div class="at-cols">${res.map((r, k) => { const t = atT(r.targetId);
      if (!r.eligible) return `<div class="at-col"><div class="at-col-h">${AT_LETTER[k]} · ${esc(t.name)}</div><div class="callout warn">${esc(r.reason)}</div></div>`;
      const st = A3.stab[atStabKey(t)];
      return `<div class="at-col"><div class="at-col-h">${AT_LETTER[k]} · ${esc(t.name)}</div><div class="meta small">${esc(r.mode === "full" ? "full comparison" : "partial comparison: " + r.P.applicable.map(shortOf).join(", "))} · ${nfmt(r.nEligible)} eligible cells</div>${r.saturated ? `<div class="callout warn small">${nfmt(r.nNearTop)} cells score within 0.1 pt of the best. With so few comparable criteria the list is saturated: the order among them comes from the tie-break (cell id), not from evidence.</div>` : ""}
      <ol class="at-rank">${r.top.slice(0, 10).map((i, q) => { const s = st && st.cand.indexOf(i) >= 0 ? st.stats[st.cand.indexOf(i)] : null;
        return `<li><button class="lnk" data-a3="cand" data-t="${t.id}" data-i="${i}">${esc(candShort(i))}</button> <b>${fmtPct(r.eff[i])}</b>${s ? ` ${clsTag(s.cls)}` : ""}</li>`; }).join("")}</ol></div>`; }).join("")}</div></div>`;
  // 4 · stability
  const haveStab = ts.every(t => !ATL.eligibility(t, S.critIds).ok || A3.stab[atStabKey(t)]);
  h += `<div class="sec"><div class="lbl">4 · Which rankings are most stable</div>
    ${haveStab ? ts.map((t, k) => { const st = A3.stab[atStabKey(t)]; if (!st) return "";
      const cnt = {}; st.stats.forEach(s => cnt[s.cls] = (cnt[s.cls] || 0) + 1);
      return `<p class="note small"><b>${AT_LETTER[k]} · ${esc(t.name)}</b>: ${st.design} weight configurations (factors ${st.factors.join(", ")} on ${st.active.map(shortOf).join(", ")}). ${Object.entries(cnt).map(([c, n]) => `${n} ${esc(LAB.CLASS_LABEL[c].toLowerCase())}`).join(" · ")}. Candidate pairs whose order flips in at least one configuration: ${st.flips.any} of ${st.flips.pairs} (worst pair flips in ${pct(st.flips.worst)} of configurations).${atCands(t, 20).saturated ? " <b>Not informative here:</b> the list is saturated (many cells tie near the top), so a stable rank reflects the tie-break, not robust evidence." : ""}</p>`; }).join("")
      : `<p class="note small">Re-scores Earth under a factorial perturbation of the profile weights (Phase II robustness engine) and classifies each candidate by how often it stays in the top 1 % of eligible cells.</p><button class="btn-sm" data-a3="stab">Run stability for ${ts.length} target${ts.length > 1 ? "s" : ""}</button>`}</div>`;
  // 5 · shared + complementary
  const er = res.filter(r => r.eligible);
  if (er.length >= 2) {
    const SH = ATL.shared(er.map(r => r.eff), S.cell, S.lat, S.lon, 10);
    const CP = ATL.complementary(er, S.cell, S.lat, S.lon);
    h += `<div class="sec"><div class="lbl">5 · Shared and complementary candidates</div>
      <div class="grid2"><div><div class="meta">Shared — similar to every eligible target (minimum of the per-target scores)</div><ol class="at-rank">${SH.top.map(i => `<li>${esc(candShort(i))} <b>${fmtPct(SH.eff[i])}</b> <span class="meta">${er.map((r, k) => AT_LETTER[res.indexOf(r)] + " " + fmtPct(r.eff[i], 0)).join(" · ")}</span></li>`).join("")}</ol></div>
      <div><div class="meta">Complementary — one site per target, each ≥ 300 km from the others</div><ol class="at-rank">${CP.map(c => { const k = res.findIndex(r => r.targetId === c.target);
        return `<li><b>${AT_LETTER[k]}</b> ${c.index == null ? "none" : esc(candShort(c.index)) + " " + fmtPct(c.score)} <span class="meta">${c.scoresForOthers ? c.scoresForOthers.filter(o => o.target !== c.target).map(o => AT_LETTER[res.findIndex(r => r.targetId === o.target)] + " " + fmtPct(o.score, 0)).join(" · ") : ""}</span></li>`; }).join("")}</ol></div></div>
      <p class="note small">A shared candidate is useful when one field site must serve several targets; a complementary set gives each target its own best site. Scores of targets on different criteria sets (e.g. terrain-only vs full) are not directly comparable.</p></div>`;
  } else h += `<div class="sec"><div class="lbl">5 · Shared and complementary candidates</div><p class="meta">Needs at least two eligible targets.</p></div>`;
  // 6 · missing evidence + 7 · discriminating measurements
  h += `<div class="sec"><div class="lbl">6 · Missing evidence</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Target</th><th>Gaps (status)</th><th class="n">weight share affected</th></tr></thead><tbody>
    ${ts.map((t, k) => { const m = ATL.missingEvidence(t, S.critIds, atWeights()).filter(x => x.status !== "PROXY"); const ws = m.reduce((a, x) => a + x.weightShare, 0);
      return `<tr><td>${AT_LETTER[k]} · ${esc(t.name)}</td><td class="meta">${m.length ? m.map(x => `${esc(x.criterion === "heterogeneity" ? "heterogeneity" : shortOf(x.criterion))} (${x.status})`).join(", ") : "none"}</td><td class="n">${pct(ws)}</td></tr>`; }).join("")}</tbody></table></div></div>`;
  const imp = ts.map(t => A3.stab[atImpactKey(t)]);
  h += `<div class="sec"><div class="lbl">7 · Discriminating measurements</div>
    ${imp.some(x => x) ? ts.map((t, k) => { const I = A3.stab[atImpactKey(t)]; if (!I || !I.length) return "";
      return `<p class="note small"><b>${AT_LETTER[k]} · ${esc(t.name)}</b></p><ul class="lab-ul">${I.map(x => x.blocked ? `<li>${esc(labelOf(x.criterion))}: ${esc(x.blocked)}</li>` :
        `<li><b>${esc(labelOf(x.criterion))}</b> — ${x.discriminating ? "<b>discriminating</b>" : "weakly discriminating"}: ${x.scenarios.map(s => `if it equalled the ${esc(s.label)} (${atVal(x.criterion, s.value)}), ${pct(s.overlap)} of the current top ${atCands(t).top.length} would remain`).join("; ")}.${x.agreement != null ? ` The scenarios share ${pct(x.agreement)} of their top 20 with each other — ${x.agreement < 0.5 ? "the actual value decides which sites are preferred" : "the preferred sites barely depend on the exact value"}.` : ""}</li>`).join("")}</ul>`; }).join("")
      + `<p class="note small">Scenario values are values <b>measured at other targets on the same body</b>, used only to show how strongly the candidate list depends on the missing measurement. They are not estimates for this target.</p>`
      : `<p class="note small">For each missing criterion, re-ranks Earth with scenario values taken from other targets on the same body and reports how much of the candidate list survives. A measurement whose plausible values reorder the list is the one worth making first.</p><button class="btn-sm" data-a3="impact">Evaluate measurement impact</button>`}</div>
    <div class="sec"><div class="row"><button class="btn-sm" data-a3="cmp-save">Save comparison record</button>${A3.lastRec ? `<span class="meta">Saved ${esc(A3.lastRec)}</span>` : ""}</div></div>`;
  return h;
};
Object.assign(A3_ACTIONS, {
  stab() { atRunStability(atSelTargets()); },
  impact() { atRunImpact(atSelTargets()); },
  async "cmp-save"() {
    const ts = atSelTargets(), res = ts.map(t => atCands(t, 20));
    const outputs = { candidates: res.map((r, k) => ({ target: ts[k].id, eligible: r.eligible, mode: r.mode, cells: r.eligible ? r.top.map(i => S.cell[i]) : [], scores: r.eligible ? r.top.map(i => r.eff[i]) : [] })) };
    const rec = await atMakeRecord("atlas-candidates", { n: 20, sep_km: 300 }, outputs, { targets: ts.map(t => t.id), stage: "candidate" });
    A3.lastRec = rec.id; atRender();
  },
});
