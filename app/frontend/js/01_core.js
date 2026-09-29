/* ===== 01 core: state, loading, helpers ===== */
"use strict";
const ENG = window.TAIEngine;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const el = (tag, attrs = {}, html = "") => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (html) e.innerHTML = html; return e; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clamp = (x, a, b) => x < a ? a : (x > b ? b : x);
const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

const S = {
  app: null, targets: null, T: {}, labels: null, A: {}, n: 0, lat: null, lon: null, cell: null,
  crit: [], critIds: [], ranges: null,
  targetId: "mars_jezero", weights: null, profile: "general",
  tab: "explore", layer: "sim", proj: 0,
  res: null,          // current result object (see compute())
  prev: null,         // snapshot before the last committed change (for WHY DID THIS MOVE / Change layer)
  selected: null,     // cell index (into valid-cell arrays)
  picked: null,       // cell index chosen by clicking the globe (reverse search)
  fpMode: "radial", searched: false, computeMs: 0, clusterFocus: null,
};

const fmtPct = (x, d = 1) => (x == null || x !== x || x < 0) ? "—" : (100 * x).toFixed(d) + "%";
const fmtPts = x => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(1) + " pts";
const fmtLat = v => Math.abs(v).toFixed(2) + "°" + (v >= 0 ? "N" : "S");
const fmtLon = v => Math.abs(v).toFixed(2) + "°" + (v >= 0 ? "E" : "W");
const pad2 = k => String(k).padStart(2, "0");
function fmtVal(c, v) {
  if (v == null || v !== v) return "N/A";
  const cr = S.crit.find(x => x.id === c); const d = cr ? cr.fmt : 2;
  return (+v).toFixed(d);
}
const unitOf = c => ({ aridity: "", annual_temperature_range: "K", elevation: "m", slope: "°", surface_roughness: "m", lst_diurnal_range: "K" }[c] || "");
const shortOf = c => (S.crit.find(x => x.id === c) || {}).short || c;
const labelOf = c => (S.crit.find(x => x.id === c) || {}).label || c;

function announce(msg) { const a = $("#announcer"); if (a) { a.textContent = ""; setTimeout(() => a.textContent = msg, 30); } }

function placeName(i) {
  const r = S.A.region ? S.A.region[i] : -1, c = S.A.country ? S.A.country[i] : -1;
  const title = s => s.toLowerCase().replace(/(^|[\s\-(])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bRa\.?$/, "Range");
  const rn = r >= 0 ? title(S.labels.region[r]) : null;
  const cn = c >= 0 ? S.labels.country[c] : null;
  if (rn && cn) return { primary: rn, secondary: cn };
  if (cn) return { primary: cn, secondary: null };
  if (rn) return { primary: rn, secondary: null };
  return { primary: "Unlabelled land cell", secondary: null };
}
const placeStr = i => { const p = placeName(i); return p.secondary ? `${p.primary}, ${p.secondary}` : p.primary; };
function cellArea(i) {           // km², spherical cell 0.5° x 0.625°
  const R = 6371.0088, la = S.lat[i], p1 = Math.max(-90, la - 0.25) * Math.PI / 180, p2 = Math.min(90, la + 0.25) * Math.PI / 180;
  return R * R * (0.625 * Math.PI / 180) * Math.abs(Math.sin(p2) - Math.sin(p1));
}
function cellDims(i) { const kmDeg = 111.195; return [0.5 * kmDeg, 0.625 * kmDeg * Math.cos(S.lat[i] * Math.PI / 180)]; }

async function loadAll(progress) {
  const get = async (u, kind) => { const r = await fetch(u); if (!r.ok) throw new Error(u + " → HTTP " + r.status); return kind === "bin" ? r.arrayBuffer() : r.json(); };
  progress("Loading registry…");
  const [app, tg, lab] = await Promise.all([get("data/app.json"), get("data/targets.json"), get("data/labels.json")]);
  S.app = app; S.targets = tg.targets; S.labels = lab;
  for (const t of S.targets) S.T[t.id] = t;
  S.crit = app.criteria; S.critIds = app.criteria.map(c => c.id); S.ranges = app.ranges;
  progress(`Loading predictor stack · ${(app.stack.bytes / 1048576).toFixed(1)} MB · ${app.stack.n_cells.toLocaleString()} cells`);
  // stack.bin is published base64-encoded as text (hosts serve only standard web types)
  const r64 = await fetch("data/stack.b64.txt"); if (!r64.ok) throw new Error("data/stack.b64.txt → HTTP " + r64.status);
  const bs = atob((await r64.text()).trim()), u8 = new Uint8Array(bs.length);
  for (let k = 0; k < bs.length; k++) u8[k] = bs.charCodeAt(k);
  const buf = u8.buffer;
  try {
    const h = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buf)), b => b.toString(16).padStart(2, "0")).join("");
    S.hashOK = h === app.stack.sha256; S.hashSeen = h;
  } catch (e) { S.hashOK = null; }
  if (S.hashOK === false) throw new Error(`predictor stack checksum mismatch (got ${S.hashSeen.slice(0, 12)}…, expected ${app.stack.sha256.slice(0, 12)}…). No scores are shown from unverified data.`);
  if (buf.byteLength !== app.stack.bytes) throw new Error(`predictor stack size ${buf.byteLength} B ≠ expected ${app.stack.bytes} B.`);
  const TA = { float32: Float32Array, uint32: Uint32Array, int16: Int16Array };
  for (const L of app.stack.layout) S.A[L.name] = new TA[L.dtype](buf, L.offset, L.length);
  S.n = app.stack.n_cells; S.cell = S.A.cell;
  S.lat = new Float64Array(S.n); S.lon = new Float64Array(S.n);
  S.index = new Int32Array(361 * 576).fill(-1);
  for (let i = 0; i < S.n; i++) { const c = S.cell[i]; S.lat[i] = -90 + 0.5 * Math.floor(c / 576); S.lon[i] = -180 + 0.625 * (c % 576); S.index[c] = i; }
  S.weights = { ...app.profiles.general.weights };
  S.bytesLoaded = buf.byteLength;
}
/* nearest valid cell to (lat, lon), searching outward on the grid */
function nearestCell(lat, lon) {
  const i0 = Math.round((lat + 90) / 0.5), j0 = Math.round((lon + 180) / 0.625);
  for (let r = 0; r <= 3; r++) {
    let best = -1, bd = Infinity;
    for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = i0 + di; if (i < 0 || i > 360) continue;
      const j = ((j0 + dj) % 576 + 576) % 576, k = S.index[i * 576 + j];
      if (k >= 0) { const d = ENG.haversine(lat, lon, S.lat[k], S.lon[k]); if (d < bd) { bd = d; best = k; } }
    }
    if (best >= 0) return best;
  }
  return -1;
}
