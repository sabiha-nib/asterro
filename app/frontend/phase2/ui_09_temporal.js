/* ===== Phase II · Planetary Analogue Evolution Observatory =====
 * Separate from the existing "Analogue evolution" (unchanged). Uses MODIS yearly day−night LST
 * (2016–2025, in the baseline bundle), MODIS yearly pixel-month counts and POWER monthly
 * climatology (Phase II series, loaded on demand). Periods and products are never combined. */
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
function lineSVG(xs, ys, { W = 700, H = 190, unit = "", label = "", fit = null, xfmt = x => x, bars = false, yLo = null, yHi = null } = {}) {
  const m = { l: 40, r: 10, t: 12, b: 30 }, fin = ys.filter(v => v === v);
  if (!fin.length) return `<div class="empty">No data.</div>`;
  let lo = yLo ?? Math.min(...fin), hi = yHi ?? Math.max(...fin); if (hi - lo < 1e-6) { lo -= 1; hi += 1; } const padv = (hi - lo) * 0.12; if (yLo == null) lo -= padv; if (yHi == null) hi += padv;
  const X = k => m.l + (bars ? (k + 0.5) / xs.length : k / Math.max(1, xs.length - 1)) * (W - m.l - m.r), Y = v => H - m.b - (v - lo) / (hi - lo) * (H - m.t - m.b);
  let g = [lo, (lo + hi) / 2, hi].map(v => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${m.l - 5}" y="${Y(v) + 3}" font-size="9" text-anchor="end" fill="var(--ink-3)">${v.toFixed(1)}</text>`).join("");
  if (bars) { const bw = Math.min(26, (W - m.l - m.r) / xs.length - 4); ys.forEach((v, k) => { if (v === v) g += `<rect x="${X(k) - bw / 2}" y="${Math.min(Y(v), Y(Math.max(lo, 0)))}" width="${bw}" height="${Math.abs(Y(Math.max(lo, 0)) - Y(v))}" fill="var(--accent)" opacity=".75" rx="2"><title>${xfmt(xs[k])}: ${v.toFixed(2)} ${unit}</title></rect>`; }); }
  else {
    let d = "", pen = false; ys.forEach((v, k) => { if (v === v) { d += (pen ? "L" : "M") + X(k).toFixed(1) + "," + Y(v).toFixed(1); pen = true; } else pen = false; });
    g += `<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2"/>` + ys.map((v, k) => v === v ? `<circle cx="${X(k)}" cy="${Y(v)}" r="4" fill="var(--accent)" stroke="var(--ground)" stroke-width="2"><title>${xfmt(xs[k])}: ${v.toFixed(2)} ${unit}</title></circle>` : `<text x="${X(k)}" y="${H - m.b - 4}" font-size="9" text-anchor="middle" fill="var(--mismatch)">×</text>`).join("");
  }
  if (fit) g += `<line x1="${X(0)}" x2="${X(xs.length - 1)}" y1="${Y(fit.intercept + fit.slope * xs[0])}" y2="${Y(fit.intercept + fit.slope * xs[xs.length - 1])}" stroke="var(--ink-2)" stroke-width="1.2" stroke-dasharray="4 3"/>`;
  g += xs.map((x, k) => `<text x="${X(k)}" y="${H - m.b + 13}" font-size="9" text-anchor="middle" fill="var(--ink-3)">${xfmt(x)}</text>`).join("");
  g += `<text x="${m.l}" y="${H - 4}" font-size="9" fill="var(--ink-2)">${esc(label)}${unit ? " (" + unit + ")" : ""}</text>`;
  return `<svg class="fp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${g}</svg>`;
}
function temporalStats(i) {
  const yr = yearlyLST(i), xs = yr.map(y => y.year), ys = yr.map(y => y.v), fin = ys.filter(v => v === v), st = LAB.stats(fin);
  const ts = LAB.theilSen(xs, ys), mk = LAB.mannKendall(ys), q = L.ctx ? L.ctx.modis_quantisation_K : 0.6;
  let cls, why;
  if (fin.length < 8) { cls = "Insufficient temporal evidence"; why = `${fin.length} of 10 years have a value (< 8).`; }
  else if (mk && mk.p < 0.05) { cls = "Monotonic change detected (exploratory)"; why = `Mann–Kendall p = ${mk.p.toFixed(3)} < 0.05 with n = ${mk.n}; Theil–Sen slope ${ts.slope >= 0 ? "+" : ""}${ts.slope.toFixed(3)} K yr⁻¹.`; }
  else if (st.max - st.min <= 2 * q) { cls = "Stable observed conditions"; why = `Yearly range ${(st.max - st.min).toFixed(2)} K ≤ 2 × the ${q} K decoding bin (indistinguishable from decoding precision).`; }
  else { cls = "Interannual variation"; why = `Yearly range ${(st.max - st.min).toFixed(2)} K exceeds 2 × the ${q} K decoding bin; no monotonic trend at p < 0.05.`; }
  return { xs, ys, st, ts, mk, cls, why, n: fin.length };
}
LAB_VIEWS.temporal = function () {
  if (!S.res) return `<div class="sec"><div class="empty">Run the search first.</div></div>`;
  const i = labSel(); if (i == null) return `<div class="sec"><div class="empty">Select a site.</div></div>`;
  const TS = temporalStats(i), ev = evolution(S.targetId, i);
  let h = `<div class="sec"><h3 class="ttl">Planetary analogue evolution observatory</h3>${experimentBanner("analysis")}
    <p class="note">How does the environment of <b>${esc(candShort(i))}</b> vary over the observed period, and is the evidence sufficient to say? Historical observations only — nothing here is a forecast.</p></div>
    <div class="sec"><div class="lbl">MODIS day − night LST by year (2016–2025)<span class="rq ${TS.cls.startsWith("Stable") ? "c-match" : TS.cls.startsWith("Insufficient") ? "" : "c-partial"}">${esc(TS.cls)}</span></div>
    ${lineSVG(TS.xs, TS.ys, { unit: "K", label: "Yearly mean day−night LST; dashed = Theil–Sen line", fit: TS.ts })}
    <div class="grid2"><div class="kv"><span>Mean · SD · range</span><b>${f2(TS.st.mean)} · ${f2(TS.st.sd)} · ${f2(TS.st.min)}–${f2(TS.st.max)} K</b></div>
    <div class="kv"><span>Theil–Sen slope</span><b>${TS.ts ? (TS.ts.slope >= 0 ? "+" : "") + TS.ts.slope.toFixed(3) + " K yr⁻¹" : "—"}</b></div>
    <div class="kv"><span>Mann–Kendall S · τ · p (normal approx.)</span><b>${TS.mk ? `${TS.mk.S} · ${TS.mk.tau.toFixed(2)} · ${TS.mk.p.toFixed(3)}` : "—"}</b></div>
    <div class="kv"><span>Existing evolution class (score-based, unchanged)</span><b>${esc(ev.cls)}${ev.rangePts != null ? " · " + ev.rangePts.toFixed(2) + " pts" : ""}</b></div></div>
    <p class="note small">${esc(TS.why)} With only ${TS.n} annual values the Mann–Kendall test has low power and assumes serially independent years; treat a detection as exploratory. Change detection is not applied where &lt; 8 years exist.</p></div>`;
  if (!L.series) {
    h += `<div class="sec"><div class="lbl">Coverage and seasonal analysis</div><p class="note small">Needs the Phase II series file (≈ 7 MB, loaded once and checksum-verified).</p>
      ${L.seriesErr ? `<div class="callout">${esc(L.seriesErr)}</div>` : `<button class="btn-sm" data-lab="t-load"${L.seriesLoading ? " disabled" : ""}>${L.seriesLoading ? "Loading…" : "Load series"}</button>`}</div>`;
  } else {
    const cov = S.A.modis_coverage[i], ny = TS.xs.map((_, k) => seriesVal("modis_n_year", k, i)), tot = ny.reduce((s, v) => s + (v === v ? v : 0), 0);
    const possible = cov > 0 ? tot / (cov * 10) : NaN, yc = ny.map(v => possible > 0 ? v / possible : NaN);
    const t2m = MONTHS.map((_, k) => seriesVal("t2m_monthly", k, i)), pr = MONTHS.map((_, k) => seriesVal("prec_monthly", k, i)), hm = LAB.harmonic(t2m);
    const rng = Math.max(...t2m) - Math.min(...t2m), crit = S.A.annual_temperature_range[i];
    h += `<div class="sec"><div class="lbl">Temporal coverage inspection · MODIS valid pixel-months per year</div>
      ${lineSVG(TS.xs, yc.map(v => 100 * v), { unit: "% of possible", label: "Yearly MODIS coverage", bars: true, yLo: 0, yHi: 100 })}
      <p class="note small">Possible pixel-months per year = (Σ yearly counts) / (overall coverage × 10). Years below 50 %: ${yc.map((v, k) => v < 0.5 ? TS.xs[k] : null).filter(Boolean).join(", ") || "none"}. GIBS serves MODIS Collections 006/061 without recording which collection each year used, so a data-product change between years cannot be excluded.</p></div>
      <div class="sec"><div class="lbl">Seasonal analysis · NASA POWER monthly climatology 2001–2020</div>
      ${lineSVG(MONTHS.map((_, k) => k), t2m, { unit: "°C", label: "Monthly mean T2M", xfmt: k => MONTHS[k] })}
      <div class="grid2"><div class="kv"><span>First-harmonic amplitude · peak month</span><b>${hm ? hm.amplitude.toFixed(2) + " °C · " + MONTHS[Math.floor(hm.peakMonth)] + " (" + hm.peakMonth.toFixed(1) + ")" : "—"}</b></div>
      <div class="kv"><span>Max − min monthly · stack criterion (check)</span><b>${rng.toFixed(2)} · ${crit.toFixed(2)} K</b></div>
      <div class="kv"><span>Variance explained by annual harmonic</span><b>${hm ? pct(hm.varianceExplained) : "—"}</b></div><div class="kv"><span>Hemisphere</span><b>${S.lat[i] >= 0 ? "Northern" : "Southern"}</b></div></div>
      ${lineSVG(MONTHS.map((_, k) => k), pr, { unit: "mm day⁻¹", label: "Monthly precipitation (PRECTOTCORR)", xfmt: k => MONTHS[k], bars: true, yLo: 0 })}
      <p class="note small">A 20-year climatology: seasonal shape only. Interannual variability of these variables is not available, so their stability cannot be assessed.</p></div>`;
    if (S.targetId !== "moon_south_pole") {
      const bins = S.T.mars_jezero.raw_reference.meda_bins;
      h += `<div class="sec"><div class="lbl">Jezero seasonal reference · MEDA ATS air temperature by Ls bin</div>
        ${lineSVG(bins.map(b => b.ls_bin[0]), bins.map(b => b.air_diurnal_mean_K), { unit: "K", label: "Diurnal-mean air temperature per 30° Ls bin (one Mars year)", xfmt: x => "Ls " + x })}
        <p class="note small">Different calendar: one 30° Ls bin ≈ 56 sols vs ≈ 30 days per Earth month. Shown separately; the two seasonal curves are not aligned or correlated, because any alignment (e.g. by equinox) would be an assumption.</p></div>`;
    }
  }
  const comp = [i, ...candSet().filter(x => x !== i).slice(0, 5)].map(k => ({ k, ...temporalStats(k) }));
  h += `<div class="sec"><div class="lbl">Temporal analogue comparison · common window 2016–2025 (MODIS only)</div><div class="tbl-wrap"><table class="t"><thead><tr><th>Site</th><th class="n">Years</th><th class="n">Mean K</th><th class="n">SD K</th><th class="n">Slope K/yr</th><th class="n">MK p</th><th>Class</th></tr></thead><tbody>
    ${comp.map(c => `<tr><td><button class="lnk" data-lab="sel" data-i="${c.k}">${siteNo(c.k)} ${esc(candShort(c.k).slice(0, 22))}</button></td><td class="n">${c.n}</td><td class="n">${f2(c.st.mean)}</td><td class="n">${f2(c.st.sd)}</td><td class="n">${c.ts ? c.ts.slope.toFixed(3) : "—"}</td><td class="n">${c.mk ? c.mk.p.toFixed(3) : "—"}</td><td class="meta">${esc(c.cls)}</td></tr>`).join("")}
    </tbody></table></div><div class="callout">Future projection boundary: historical trends are not extrapolated. ASTERRO produces no future Earth, Mars or Moon conditions.</div></div>`;
  const claims = [LAB.claim({ id: "t.series", category: "MEASURED", text: "Yearly MODIS day−night LST and pixel-month counts; POWER monthly climatology.", provenance: ["MODIS Aqua via GIBS 2016–2025", "NASA POWER 2001–2020"], limitations: ["Collection per year unknown."] }),
    LAB.claim({ id: "t.trend", category: "INFERRED", text: "Trend classification from Theil–Sen and Mann–Kendall (normal approximation, tie and continuity corrected).", method: "Rules: < 8 years insufficient; MK p < 0.05 monotonic (exploratory); range ≤ 2×decoding bin stable; else interannual variation.", limitations: ["n = 10; low power; independence assumed."] }),
    LAB.claim({ id: "t.future", category: "UNAVAILABLE", text: "No projection of future conditions is made." })];
  return h + `<div class="sec">${claimsBlock(claims)}</div>`;
};
LAB_ACTIONS["t-load"] = () => labSeries();
