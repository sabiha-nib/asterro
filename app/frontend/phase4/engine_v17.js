/* ===== ASTERRO V17 · discovery engine (browser + Node), exposed as AsterroV17 =====
 * Reads the V17 analytical products (ASTERRO_V17, built by scripts/build_v17.py from retained inputs) and answers:
 *   val / cls          the feature cube (tai-v17-features-1.0.0), missing stays null
 *   novelty / pattern  novelty indicator (tai-v17-novelty-1.0.0) and unsupervised patterns (tai-v17-ml-1.0.0)
 *   module             one scientific domain module for one Earth cell: values, evidence kinds, completeness
 *   diversify          alternative spatial-diversity methods (the baseline 300 km rule is untouched)
 *   surprise           Surprise me discovery modes, deterministic for a given draw number
 *   challenge          checks a discovery challenge against the data
 *   report             the 20-section research report (Markdown)
 * Nothing here changes a score. Similarities come from the caller (the unchanged engine). */
(function (root) {
  "use strict";
  const VERSION = "tai-v17-discovery-1.0.0";
  const R_EARTH = 6371.0088;
  function b64(s) {
    if (typeof atob === "function") { const t = atob(s), a = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) a[i] = t.charCodeAt(i); return a; }
    return new Uint8Array(Buffer.from(s, "base64"));
  }
  function km(la1, lo1, la2, lo2) {
    const r = Math.PI / 180, p1 = la1 * r, p2 = la2 * r, dp = p2 - p1, dl = (lo2 - lo1) * r;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  const fin = x => x != null && x === x && x !== Infinity && x !== -Infinity;

  function create(D, n) {
    const cube = D.cube, P = D.patterns, M = cube.missing;
    if (cube.n_cells !== n) throw new Error("V17 cube has " + cube.n_cells + " cells, the stack has " + n);
    const raw = {}, vars = cube.vars;
    for (const k in vars) raw[k] = b64(vars[k].b64);
    const nv = { u: b64(P.novelty.uniqueness_pct_b64), e: b64(P.novelty.known_env_pct_b64), k: b64(P.novelty.known_km40_b64), c: b64(P.novelty.class_b64) };
    const ml = { l: b64(P.ml.labels_b64), a: b64(P.ml.anomaly_pct_b64), h: new Set(P.ml.hidden_cells) };
    const MODS = Object.fromEntries(D.modules.modules.map(m => [m.id, m]));
    const REG = Object.fromEntries(D.registry.sources.map(s => [s.id, s]));

    function val(v, i) { const q = raw[v] ? raw[v][i] : M; if (q === M || q == null) return null; const V = vars[v]; return q * V.scale + V.offset; }
    function cls(v, i) { const x = val(v, i); return x == null ? null : cube.classes[v][x]; }
    function novelty(i) {
      const c = P.novelty.classes[nv.c[i]];
      if (c === "insufficient") return { cls: c };
      return { cls: c, uniq: nv.u[i], env: nv.e[i], km: nv.k[i] * 40 };
    }
    function pattern(i) {
      const l = ml.l[i];
      if (l === M) return null;
      return { cluster: l, name: P.ml.names[l], anomaly: ml.a[i] === M ? null : ml.a[i], hidden: ml.h.has(i) };
    }
    /* ctx: A (stack arrays by variable), gentle5(i) share or null, noon(i) deg or null, ops(i) [{id, mean, k}] */
    function module(id, i, ctx) {
      const m = MODS[id]; if (!m) return null;
      const rows = [];
      const get = (v) => {
        if (raw[v]) return v === "aridity_class" || v === "landform_class" ? cls(v, i) : val(v, i);
        if (v === "gentle_le5") return ctx.gentle5 ? ctx.gentle5(i) : null;
        if (v === "noon_solar_elevation") return ctx.noon ? ctx.noon(i) : null;
        if (v === "exploration_operations") { const o = ctx.ops ? ctx.ops(i) : null; return o && o.length ? o.filter(x => x.mean != null).sort((a, b) => b.mean - a.mean)[0] || null : null; }
        const a = ctx.A && ctx.A[v]; const x = a ? a[i] : null; return fin(x) ? x : null;
      };
      for (const inp of m.inputs) { const x = get(inp.var); rows.push({ var: inp.var, kind: inp.kind, value: x == null ? null : x, unit: inp.unit, source: inp.source, resolution: inp.resolution, period: inp.period, note: inp.note }); }
      const have = rows.filter(r => r.value != null).length;
      const ev = {}; for (const r of rows) if (r.value != null) ev[r.kind] = (ev[r.kind] || 0) + 1;
      return { id, version: m.version, status: m.status, question: m.question, rows, have, need: rows.length,
        completeness: rows.length ? have / rows.length : null, evidence: ev, blocked: m.blocked.map(b => ({ id: b, state: REG[b] ? REG[b].state : "not_investigated" })),
        target: m.target, limits: m.limits, validation: m.validation };
    }
    function modules(i, ctx) { return D.modules.modules.map(m => module(m.id, i, ctx)); }

    /* alternative spatial diversity. order: candidate indices, best first. */
    function diversify(order, lat, lon, opts) {
      const out = [], N = opts.n || 20;
      if (opts.method === "km") {
        for (const i of order) { if (out.length >= N) break; if (out.every(j => km(lat[i], lon[i], lat[j], lon[j]) >= opts.km)) out.push(i); }
      } else if (opts.method === "region") {
        const seen = new Set();
        for (const i of order) { if (out.length >= N) break; const r = opts.label(i); if (r == null || seen.has(r)) continue; seen.add(r); out.push(i); }
      } else if (opts.method === "mmr") {
        const pool = order.slice(0, opts.pool || 400), lam = opts.lambda == null ? 0.7 : opts.lambda, F = pool.map(opts.feat), sc = pool.map(opts.score);
        const used = new Set(); const dmin = pool.map(() => Infinity);
        while (out.length < Math.min(N, pool.length)) {
          let best = -1, bv = -Infinity;
          for (let k = 0; k < pool.length; k++) {
            if (used.has(k)) continue;
            const div = out.length ? Math.min(1, dmin[k]) : 1;
            const v = lam * sc[k] + (1 - lam) * div;
            if (v > bv + 1e-12) { bv = v; best = k; }
          }
          if (best < 0) break;
          used.add(best); out.push(pool[best]);
          for (let k = 0; k < pool.length; k++) { if (used.has(k)) continue; let d = 0; for (let q = 0; q < F[k].length; q++) d += (F[k][q] - F[best][q]) ** 2; d = Math.sqrt(d / F[k].length); if (d < dmin[k]) dmin[k] = d; }
        }
      }
      return out;
    }

    /* Surprise me. ctx: n, lat, lon, eff (Float array for the mode's target), rows(i) [{c, s, e, t}], thr {match, partial},
       draw (0, 1, 2 ...), tid, body. Returns a card or {unavailable, blocked}. */
    const MODES = {
      mars_unexpected: { body: "mars", need: [] }, moon_unexpected: { body: "moon", need: [] },
      thermal_unusual: { body: "any", need: [] }, polar: { body: "moon", need: [] },
      hidden: { body: "any", need: [] }, underrepresented: { body: "any", need: [] }, one_dimension: { body: "any", need: [] },
      geology: { body: "any", need: ["usgs_sgmc", "macrostrat", "gvp_volcanoes"] },
      water_history: { body: "any", need: ["jrc_gsw"] }, dust_wind: { body: "any", need: ["merra2_aerosol", "merra2_wind", "modis_aerosol"] },
      subsurface: { body: "any", need: ["cave_inventories"] },
    };
    function pctThreshold(eff, n, p) { const a = []; for (let i = 0; i < n; i++) if (fin(eff[i]) && eff[i] >= 0) a.push(eff[i]); a.sort((x, y) => x - y); return a[Math.floor(p * (a.length - 1))]; }
    function surprise(mode, ctx) {
      const md = MODES[mode]; if (!md) return null;
      if (md.need.length) return { mode, unavailable: true, blocked: md.need.map(b => ({ id: b, state: REG[b] ? REG[b].state : "not_investigated" })) };
      const { n, lat, lon, eff } = ctx; let cand = [], why = {};
      const sorted = idx => idx.sort((a, b) => (eff[b] - eff[a]) || (a - b));
      if (mode === "mars_unexpected" || mode === "moon_unexpected") {
        const t = pctThreshold(eff, n, 0.98);
        for (let i = 0; i < n; i++) { if (!(eff[i] >= t)) continue; const nv2 = novelty(i); if (nv2.cls === "outside_distinct" || nv2.cls === "outside_rare") cand.push(i); }
        sorted(cand); why = { kind: "top2_outside", threshold: t };
      } else if (mode === "thermal_unusual") {
        const a = ctx.A.lst_diurnal_range, vals = []; for (let i = 0; i < n; i++) if (fin(a[i])) vals.push(a[i]); vals.sort((x, y) => x - y);
        const t = vals[Math.floor(0.99 * (vals.length - 1))];
        for (let i = 0; i < n; i++) if (fin(a[i]) && a[i] >= t && novelty(i).cls !== "near_listed" && novelty(i).cls !== "insufficient") cand.push(i);
        sorted(cand); why = { kind: "lst_top1", threshold: t };
      } else if (mode === "polar") {
        for (let i = 0; i < n; i++) { const pn = val("polar_night_months", i), fz = val("freeze_months", i); if (pn != null && pn >= 2 && fz != null && fz >= 10 && eff[i] >= 0 && novelty(i).cls !== "near_listed") cand.push(i); }
        sorted(cand); why = { kind: "polar_night" };
      } else if (mode === "hidden") {
        cand = sorted(Array.from(ml.h).filter(i => eff[i] >= 0)); why = { kind: "hidden_combination", p98: P.ml.anomaly_p98 };
      } else if (mode === "underrepresented") {
        const t = pctThreshold(eff, n, 0.95), top = [];
        for (let i = 0; i < n; i++) if (eff[i] >= t) top.push(i);
        sorted(top);
        const pool = diversify(top, lat, lon, { method: "km", km: 300, n: 60 });
        cand = pool.map(i => ({ i, k: pool.filter(j => j !== i && km(lat[i], lon[i], lat[j], lon[j]) < 1500).length, nv: novelty(i) }))
          .filter(x => x.nv.cls !== "near_listed" && x.nv.cls !== "insufficient").sort((a, b) => (a.k - b.k) || (eff[b.i] - eff[a.i]) || (a.i - b.i)).map(x => x.i);
        why = { kind: "sparse_region", radius_km: 1500 };
      } else if (mode === "one_dimension") {
        for (let i = 0; i < n; i++) {
          if (!(eff[i] >= 0)) continue;
          const r = ctx.rows(i), ok = r.filter(x => fin(x.s));
          if (ok.length < r.length || ok.length < 4) continue;
          if (ok.filter(x => x.s >= ctx.thr.match).length === 1 && ok.filter(x => x.s >= ctx.thr.partial).length === 1) cand.push(i);
          if (cand.length > 3000) break;
        }
        sorted(cand); why = { kind: "single_condition" };
      }
      if (mode !== "underrepresented") cand = diversify(cand, lat, lon, { method: "km", km: 300, n: 50 });
      if (!cand.length) return { mode, empty: true };
      const i = cand[(ctx.draw || 0) % cand.length];
      return card(mode, i, ctx, why, cand.length);
    }
    function card(mode, i, ctx, why, pool) {
      const rows = ctx.rows(i), ok = rows.filter(r => fin(r.s));
      const match = ok.filter(r => r.s >= ctx.thr.match).sort((a, b) => b.s - a.s), part = ok.filter(r => r.s >= ctx.thr.partial && r.s < ctx.thr.match);
      const diff = ok.filter(r => r.s < ctx.thr.partial).sort((a, b) => a.s - b.s), miss = rows.filter(r => !fin(r.s));
      return { mode, i, tid: ctx.tid, eff: ctx.eff[i], why, pool, rows, match, part, diff, miss,
        coverage: ctx.coverage ? ctx.coverage(i) : null, novelty: novelty(i), pattern: pattern(i),
        lat: ctx.lat[i], lon: ctx.lon[i], version: VERSION, draw: ctx.draw || 0 };
    }

    /* challenges: each check returns {ok, reason} from data only */
    const CHALLENGES = {
      terrain_not_thermal: { body: "mars", check: (i, c) => { const s = sOf(c.rows(i)); return { ok: s.slope >= c.thr.match && s.surface_roughness >= c.thr.match && fin(s.lst_diurnal_range) && s.lst_diurnal_range < c.thr.partial, s }; } },
      arid_rough: { body: "any", check: (i, c) => { const a = cls("aridity_class", i), r = c.A.surface_roughness[i]; return { ok: (a === "hyper_arid" || a === "arid") && fin(r) && r >= 200, a, r }; } },
      seasonal_rain: { body: "any", check: (i) => { const cv = val("precip_cv", i), dm = val("dry_months", i); return { ok: cv != null && dm != null && cv >= 1.0 && dm >= 6, cv, dm }; } },
      polar_compare: { body: "moon", check: (i) => { const pn = val("polar_night_months", i); return { ok: pn != null && pn >= 1, pn }; } },
      single_dimension: { body: "any", check: (i, c) => { const ok = c.rows(i).filter(r => fin(r.s)); const m = ok.filter(r => r.s >= c.thr.match).length; return { ok: ok.length >= 4 && m === 1 && ok.filter(r => r.s >= c.thr.partial).length === 1, m }; } },
      beyond_famous: { body: "any", check: (i, c) => { const nv2 = novelty(i); return { ok: c.eff[i] >= c.thr.partial && (nv2.cls === "outside_distinct" || nv2.cls === "outside_rare"), nv: nv2.cls }; } },
      shared_process: { body: "any", check: (i, c) => { const hit = c.processHits ? c.processHits(i) : []; return { ok: hit.length > 0, hit }; } },
    };
    function sOf(rows) { const o = {}; for (const r of rows) o[r.c] = fin(r.s) ? r.s : null; return o; }
    function challenge(id, i, ctx) { const C = CHALLENGES[id]; return C ? C.check(i, ctx) : null; }
    /* interpretation quiz: the condition that differs most is the lowest similarity among assessed conditions */
    function mostDifferent(rows) { const ok = rows.filter(r => fin(r.s)); if (!ok.length) return null; return ok.reduce((a, b) => (b.s < a.s ? b : a)).c; }

    return { VERSION, val, cls, novelty, pattern, module, modules, diversify, surprise, card, challenge, mostDifferent,
      MODES: Object.keys(MODES), MODE_DEF: MODES, CHALLENGES: Object.keys(CHALLENGES), CHALLENGE_DEF: CHALLENGES, registry: REG, km };
  }

  /* 20-section research report. r: structured fields gathered by the page (all values already computed). */
  function report(r) {
    const L = [], h = (k, t) => L.push("", "## " + k + ". " + t, "");
    const f = x => x == null ? "not available" : String(x);
    L.push("# " + r.title, "", "ASTERRO research report · " + r.versions.join(" · ") + " · generated " + r.when);
    h(1, "Research title"); L.push(r.title);
    h(2, "Research question"); L.push(r.question);
    h(3, "Planetary target"); L.push(r.target.name + " (" + r.target.body + "), " + r.target.id);
    h(4, "Earth analogue"); L.push(r.place.name);
    h(5, "Geographic coordinates"); L.push(r.place.coords + " (cell " + r.place.cell + ")");
    h(6, "Spatial scale"); L.push(r.scale);
    h(7, "Data sources"); for (const d of r.sources) L.push("- " + d);
    h(8, "Data versions"); for (const d of r.dataVersions) L.push("- " + d);
    h(9, "Measurement characteristics"); L.push("| Condition | Earth | Target | Target measurement | Earth source |", "|---|---|---|---|---|"); for (const m of r.measurements) L.push(`| ${m.c} | ${f(m.e)} | ${f(m.t)} | ${f(m.kind)} | ${f(m.src)} |`);
    h(10, "Methodology"); for (const m of r.method) L.push("- " + m);
    h(11, "Results"); L.push(r.result);
    h(12, "Similarities"); L.push(r.similar.length ? r.similar.map(x => "- " + x).join("\n") : "None at or above the similarity threshold.");
    h(13, "Differences"); L.push(r.different.length ? r.different.map(x => "- " + x).join("\n") : "None below the partial threshold.");
    h(14, "Uncertainty"); for (const u of r.uncertainty) L.push("- " + u);
    h(15, "Missing data"); L.push(r.missing.length ? r.missing.map(x => "- " + x).join("\n") : "No baseline condition is missing.");
    h(16, "Exploration relevance"); for (const x of r.relevance) L.push("- " + x);
    h(17, "Earth's limitations"); for (const x of r.limits) L.push("- " + x);
    h(18, "Conclusions"); L.push(r.conclusion);
    h(19, "Reproducibility"); L.push("```json", JSON.stringify(r.repro, null, 2), "```");
    h(20, "References and data attribution"); for (const x of r.refs) L.push("- " + x);
    L.push("", "_A similarity of measured conditions, not a probability, a suitability rating, a safety assessment or a certification._", "");
    return L.join("\n");
  }

  const api = { VERSION, create, report, km };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.AsterroV17 = api;
})(typeof window !== "undefined" ? window : globalThis);
