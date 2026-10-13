/* ===== Phase II · Cross-Planet Evidence Comparator ===== */
function compatFlag(c) {
  const J = S.T.mars_jezero, M = S.T.moon_south_pole, sj = J.status[c], sm = M.status[c];
  if (sj === "N/A" || sm === "N/A") return { level: "none", text: "Not comparable: not applicable to " + (sj === "N/A" ? J.name : M.name) + "." };
  if (sj === "PROXY" && sm === "PROXY") return J.variables[c] === M.variables[c]
    ? { level: "none", text: "Identical by construction (same proxy rule and value): carries no information that distinguishes the targets." }
    : { level: "low", text: "Both proxies; differences reflect the proxy rules, not measurements." };
  if (c === "slope" || c === "surface_roughness") return { level: "high", text: "Directly comparable: identical algorithm, 926.6 m baseline and 55.6 km window (MOLA 463 m vs LOLA 118 m source DEMs)." };
  if (c === "lst_diurnal_range") return { level: "mid", text: "Comparable with caveats: MEDA TIRS rover point (one Mars year, 12 Ls bins, LTST) vs Diviner 240 m window (2009–2019, two seasons, polar local time ≈ solar azimuth)." };
  return { level: "mid", text: "Comparable with caveats (different instruments)." };
}
LAB_VIEWS.xplanet = function () {
  if (!S.res) return `<div class="sec"><div class="empty">Run the search first.</div></div>`;
  const J = S.T.mars_jezero, M = S.T.moon_south_pole, w = S.weights;
  const tn = (t, c) => t.variables[c] == null ? null : (t.variables[c] - S.ranges[c][0]) / (S.ranges[c][1] - S.ranges[c][0]);
  let h = `<div class="sec"><h3 class="ttl">Cross-planet evidence comparator</h3>${experimentBanner("analysis")}
    <p class="note">How do the two targets differ on the common criteria, and where does an Earth candidate resemble one more than the other? No unified score is formed from incompatible quantities; the existing cross-planet mode (minimum of the two scores) is unchanged.</p></div>
    <div class="sec"><div class="lbl">Target fingerprints on the shared normalisation</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Criterion</th><th class="n">Jezero</th><th class="n">South Pole</th><th>Position in range (0 → 1)</th><th>Compatibility</th></tr></thead><tbody>
    ${S.critIds.map(c => { const a = tn(J, c), b = tn(M, c), f = compatFlag(c);
      const strip = `<svg width="130" height="14"><line x1="5" x2="125" y1="7" y2="7" stroke="var(--line-2)"/>${a != null ? `<circle cx="${5 + 120 * a}" cy="7" r="4" fill="var(--mars)"><title>Jezero ${a.toFixed(3)}</title></circle>` : ""}${b != null ? `<rect x="${1 + 120 * b}" y="3" width="8" height="8" fill="var(--moon)" transform="rotate(45 ${5 + 120 * b} 7)"><title>South Pole ${b.toFixed(3)}</title></rect>` : ""}</svg>`;
      return `<tr><td>${esc(labelOf(c))}</td><td class="n">${J.variables[c] == null ? "N/A" : fmtVal(c, J.variables[c])} <span class="tag ${J.status[c] === "PROXY" ? "proxy" : J.status[c] === "N/A" ? "na" : "direct"}">${J.status[c]}</span></td><td class="n">${M.variables[c] == null ? "N/A" : fmtVal(c, M.variables[c])} <span class="tag ${M.status[c] === "PROXY" ? "proxy" : M.status[c] === "N/A" ? "na" : "direct"}">${M.status[c]}</span></td><td>${strip}</td><td class="meta">${esc(f.text)}</td></tr>`; }).join("")}
    </tbody></table></div><p class="note small">● Jezero · ◆ Lunar South Pole, on the fixed min–max range of Earth ∪ targets. Only slope, roughness and (with caveats) the thermal criterion carry measured differences between the targets.</p></div>`;
  const cand = candSet(), sel = labSel(); if (sel != null && !cand.includes(sel)) cand.unshift(sel);
  const rows = cand.map(i => { const p = profileFor(i, w); const dJ = ENG.detail(S.A, S.critIds, i, J.variables, w, S.ranges), dM = ENG.detail(S.A, S.critIds, i, M.variables, w, S.ranges);
    return { i, sJ: p[0].score, sM: p[1].score, rJ: p[0].rank, rM: p[1].rank, dJ, dM }; });
  h += `<div class="sec"><div class="lbl">Candidate trade-offs (${esc(currentLabel())})</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Site</th><th class="n">Jezero</th><th class="n">South Pole</th><th class="n">Δ (J − M) pts</th><th>Shared criteria favouring</th></tr></thead><tbody>
    ${rows.map(r => { const shared = S.critIds.filter(c => J.status[c] === "DIRECT" && M.status[c] === "DIRECT");
      const fav = shared.map(c => { const a = r.dJ.rows.find(x => x.c === c).s, b = r.dM.rows.find(x => x.c === c).s; return a == null || b == null ? null : { c, d: a - b }; }).filter(Boolean);
      const txt = fav.map(f => `${shortOf(f.c)} ${f.d > 0.005 ? "→ Mars" : f.d < -0.005 ? "→ Moon" : "≈"} ${f.d >= 0 ? "+" : ""}${f.d.toFixed(2)}`).join(" · ");
      return `<tr><td><button class="lnk" data-lab="sel" data-i="${r.i}">${siteNo(r.i)} ${esc(candShort(r.i).slice(0, 22))}</button></td><td class="n">${fmtPct(r.sJ)} <span class="meta">#${r.rJ ?? "—"}</span></td><td class="n">${fmtPct(r.sM)} <span class="meta">#${r.rM ?? "—"}</span></td><td class="n">${r.sJ >= 0 && r.sM >= 0 ? (100 * (r.sJ - r.sM)).toFixed(1) : "—"}</td><td class="meta">${esc(txt)}</td></tr>`; }).join("")}
    </tbody></table></div><p class="note small">Per-target Analogue Scores are the baseline values. “Shared criteria favouring” lists sᴹᵃʳˢ − sᴹᵒᵒⁿ for criteria measured directly for BOTH targets. The two scores use different criterion sets (the Moon has no temperature-range criterion), so their difference is descriptive, not a calibrated comparison.</p></div>`;
  h += `<div class="sec"><div class="lbl">Missing-variable analysis</div><ul class="lab-ul">
    <li>Annual temperature range: defined for Jezero only (no near-surface air on the Moon).</li>
    <li>Aridity and elevation: proxies with identical values for both targets — they cannot separate the targets.</li>
    <li>Not represented for either target: gravity, atmospheric composition, radiation, geology/mineralogy, day length, dust, illumination, subsurface.</li></ul>
    <div class="callout">An Earth candidate may offer useful environmental analogies for several research purposes without being equivalent to any planetary environment.</div></div>`;
  const claims = [LAB.claim({ id: "xp.compat", category: "INFERRED", text: "Compatibility flags follow from the recorded status, method and source of each target value.", method: "Rule table over targets.json status/methodology (documented in the comparator source).", provenance: ["targets.json"] }),
    LAB.claim({ id: "xp.unified", category: "UNAVAILABLE", text: "No defensible method exists here for a unified Mars–Moon score beyond the existing documented min rule; none is created." })];
  return h + `<div class="sec">${claimsBlock(claims)}</div>`;
};
