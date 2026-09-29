/* ===== 02 globe: WebGL similarity-field renderer (globe <-> map morph) ===== */
const RAMPS = {
  mars_jezero: ["#1a0f0a", "#5a2a16", "#a8522a", "#e08a4e", "#fbe2b6"],
  moon_south_pole: ["#0b1218", "#233a4b", "#4f7690", "#99b9cf", "#eef5fa"],
  cross: ["#12100a", "#3d3419", "#86733a", "#d6c07a", "#f8f0d0"],
};
const CLUSTER_COLORS = ["#E6A15C", "#7FB3AE", "#B59BD6", "#D9705F", "#C9C46A", "#6F9BD1"];
const hex3 = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16) / 255);

const VS = `
attribute vec2 aLL;
uniform mat3 uRot; uniform mat4 uProj; uniform float uMorph, uDist, uScale; uniform vec2 uPan;
varying vec2 vLL; varying vec3 vN;
void main(){
  float la = radians(aLL.y), lo = radians(aLL.x);
  vec3 s = vec3(cos(la)*sin(lo), sin(la), cos(la)*cos(lo));
  vec3 ps = uRot * s * uScale;
  vec3 pp = vec3(aLL.x/180.0*1.9 + uPan.x, aLL.y/90.0*0.95 + uPan.y, (uScale-1.0)*0.2);
  vec3 p = mix(ps, pp, uMorph);
  vN = normalize(mix(uRot * s, vec3(0.0,0.0,1.0), uMorph));
  vLL = aLL;
  gl_Position = uProj * vec4(p.x, p.y, p.z - uDist, 1.0);
}`;
const FS = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform sampler2D uField, uBase;
uniform float uReveal, uBaseMix, uGrid, uLayer, uLo, uHi, uCellGrid, uMorph;
uniform vec3 uRamp[5]; uniform vec3 uClus[6];
varying vec2 vLL; varying vec3 vN;
vec3 ramp(float t){
  t = clamp(t,0.0,1.0)*4.0;
  if (t < 1.0) return mix(uRamp[0], uRamp[1], t);
  if (t < 2.0) return mix(uRamp[1], uRamp[2], t-1.0);
  if (t < 3.0) return mix(uRamp[2], uRamp[3], t-2.0);
  return mix(uRamp[3], uRamp[4], t-3.0);
}
void main(){
  vec3 base = texture2D(uBase, vec2((vLL.x+180.0)/360.0, (90.0-vLL.y)/180.0)).rgb;
  float lum = dot(base, vec3(0.3,0.59,0.11));
  vec3 b = mix(vec3(lum)*vec3(0.62,0.68,0.76), base, 0.28) * 0.36 * uBaseMix + vec3(0.012,0.016,0.022);
  float j = mod(floor((vLL.x+180.0)/0.625+0.5), 576.0);
  float i = clamp(floor((vLL.y+90.0)/0.5+0.5), 0.0, 360.0);
  vec4 f = texture2D(uField, vec2((j+0.5)/576.0, (i+0.5)/361.0));
  vec3 col = b;
  if (f.a > 0.0) {
    float vis = step(f.g, uReveal + 0.0001);
    float t = (f.r - uLo) / max(uHi - uLo, 0.001);
    vec3 c = ramp(t); float a = mix(0.10, 0.96, smoothstep(0.0, 1.0, clamp(t,0.0,1.0)));
    if (uLayer > 0.5 && uLayer < 1.5) {
      float cid = floor(f.b*255.0 + 0.5);
      if (cid > 0.5) { c = cid < 1.5 ? uClus[0] : cid < 2.5 ? uClus[1] : cid < 3.5 ? uClus[2] : cid < 4.5 ? uClus[3] : cid < 5.5 ? uClus[4] : uClus[5]; a = 0.95; }
      else { c = ramp(t) * 0.55; a *= 0.35; }
    } else if (uLayer > 1.5) {
      float d = (f.a*255.0 - 128.0) / 127.0;
      c = d >= 0.0 ? vec3(0.50,0.80,0.74) : vec3(0.86,0.42,0.36);
      a = clamp(abs(d)*1.4, 0.0, 0.95);
      col = mix(b, ramp(t)*0.25, 0.5*vis);
    }
    col = mix(col, c, a * vis);
  }
  #ifdef GL_OES_standard_derivatives
  vec2 q = vLL / 15.0; vec2 g = abs(fract(q + 0.5) - 0.5) / max(fwidth(q), vec2(1e-5));
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  col += vec3(0.45,0.55,0.66) * line * 0.10 * uGrid;
  if (uCellGrid > 0.0) {
    vec2 c2 = vec2((vLL.x+180.0)/0.625, (vLL.y+90.0)/0.5) + 0.5;
    vec2 gg = abs(fract(c2) - 0.5) / max(fwidth(c2), vec2(1e-5));
    col += vec3(1.0) * (1.0 - min(min(gg.x, gg.y), 1.0)) * 0.05 * uCellGrid;
  }
  #endif
  float nd = clamp(vN.z, 0.0, 1.0);
  col *= mix(0.42, 1.0, pow(nd, 0.6));
  gl_FragColor = vec4(col, 1.0);
}`;
const FS_RIM = `precision highp float; varying vec2 vLL; varying vec3 vN; uniform float uMorph; uniform vec3 uTint;
void main(){ float r = pow(1.0 - clamp(abs(vN.z),0.0,1.0), 3.0); gl_FragColor = vec4(uTint * r * 0.55 * (1.0-uMorph), 1.0); }`;
const FS_LINE = `precision highp float; uniform vec4 uColor; varying vec3 vN; uniform float uMorph;
void main(){ float f = uMorph > 0.5 ? 1.0 : smoothstep(0.0, 0.25, vN.z); gl_FragColor = vec4(uColor.rgb, uColor.a * f); }`;

class Globe {
  constructor(canvas) {
    this.cv = canvas;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false });
    if (!gl) throw new Error("WebGL is not available in this browser.");
    this.gl = gl; gl.getExtension("OES_standard_derivatives");
    this.yaw = -0.35; this.pitch = 0.28; this.dist = 3.6; this.morph = 0; this.pan = [0, 0];
    this.reveal = 1; this.baseMix = 1; this.grid = 1; this.layer = 0; this.lo = 0; this.hi = 1;
    this.ramp = RAMPS.mars_jezero; this.tween = []; this.dirty = true; this.autoRotate = false; this.onFrame = null;
    this.prog = this.program(VS, FS); this.rim = this.program(VS, FS_RIM); this.lineP = this.program(VS, FS_LINE);
    this.mesh(); this.fieldTex = this.tex(); this.baseTex = this.tex();
    gl.bindTexture(gl.TEXTURE_2D, this.baseTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([10, 14, 20, 255]));
    this.fieldData = new Uint8Array(576 * 361 * 4);
    this.uploadField();
    new ResizeObserver(() => { this.resize(); this.dirty = true; }).observe(canvas);
    this.resize(); this.bindInput(); this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  program(vs, fs) {
    const gl = this.gl, sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "aLL"); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    p.u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let k = 0; k < n; k++) { const a = gl.getActiveUniform(p, k), nm = a.name.replace("[0]", ""); p.u[nm] = gl.getUniformLocation(p, a.name); }
    return p;
  }
  tex() { const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
  mesh() {
    const gl = this.gl, st = 2.5, nx = 360 / st + 1, ny = 180 / st + 1, v = [], ix = [];
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) v.push(-180 + x * st, -90 + y * st);
    for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) { const a = y * nx + x; ix.push(a, a + 1, a + nx, a + 1, a + nx + 1, a + nx); }
    this.vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    this.ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ix), gl.STATIC_DRAW);
    this.nIdx = ix.length;
  }
  setCoast(polys) {
    const gl = this.gl, seg = [];
    for (const pl of polys) for (let k = 1; k < pl.length; k++) { const a = pl[k - 1], b = pl[k]; if (Math.abs(a[0] - b[0]) > 180) continue; seg.push(a[0], a[1], b[0], b[1]); }
    this.lb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.lb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(seg), gl.STATIC_DRAW);
    this.nLine = seg.length / 2; this.dirty = true;
  }
  setBase(img) { const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.baseTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); this.dirty = true; }
  uploadField() { const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.fieldTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 576, 361, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.fieldData); this.dirty = true; }
  resize() { const r = this.cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.width = Math.max(2, Math.round(r.width * d)); this.cv.height = Math.max(2, Math.round(r.height * d)); this.w = r.width; this.h = r.height; }
  rot() { const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    // R = Rx(pitch) * Ry(yaw), row-major rows
    return [[cy, 0, sy], [sp * sy, cp, -sp * cy], [-cp * sy, sp, cp * cy]]; }
  proj() { const f = 1 / Math.tan(17 * Math.PI / 180), a = this.w / Math.max(1, this.h), n = 0.05, fa = 50;
    return [f / a, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]; }
  project(lat, lon) {
    const R = this.rot(), la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
    const s = [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
    const ps = R.map(r => r[0] * s[0] + r[1] * s[1] + r[2] * s[2]);
    const pp = [lon / 180 * 1.9 + this.pan[0], lat / 90 * 0.95 + this.pan[1], 0], m = this.morph;
    const p = [0, 1, 2].map(k => ps[k] * (1 - m) + pp[k] * m);
    const z = p[2] - this.dist, f = 1 / Math.tan(17 * Math.PI / 180), a = this.w / this.h;
    const x = (p[0] * f / a) / -z, y = (p[1] * f) / -z;
    return { x: (x * 0.5 + 0.5) * this.w, y: (0.5 - y * 0.5) * this.h, front: m > 0.5 || ps[2] > 0.08 };
  }
  unproject(px, py) {
    const f = Math.tan(17 * Math.PI / 180), a = this.w / this.h;
    const dx = ((px / this.w) * 2 - 1) * f * a, dy = (1 - (py / this.h) * 2) * f, dz = -1;
    if (this.morph > 0.5) {
      const t = this.dist; const x = dx * t, y = dy * t;
      const lon = (x - this.pan[0]) / 1.9 * 180, lat = (y - this.pan[1]) / 0.95 * 90;
      return (Math.abs(lon) <= 180 && Math.abs(lat) <= 90) ? { lat, lon } : null;
    }
    const L = Math.hypot(dx, dy, dz), d = [dx / L, dy / L, dz / L], c = [0, 0, -this.dist];
    const b = d[0] * c[0] + d[1] * c[1] + d[2] * c[2], cc = this.dist * this.dist - 1, disc = b * b - cc;
    if (disc < 0) return null;
    const t = b - Math.sqrt(disc), h = [d[0] * t, d[1] * t, d[2] * t + this.dist], R = this.rot();
    const s = [0, 1, 2].map(k => R[0][k] * h[0] + R[1][k] * h[1] + R[2][k] * h[2]);   // R^T h
    return { lat: Math.asin(clamp(s[1], -1, 1)) * 180 / Math.PI, lon: Math.atan2(s[0], s[2]) * 180 / Math.PI };
  }
  animate(key, to, ms = 900, ease = t => 1 - Math.pow(1 - t, 3)) {
    if (REDUCED) ms = 1;
    this.tween = this.tween.filter(t => t.key !== key);
    this.tween.push({ key, from: this[key], to, t0: performance.now(), ms, ease }); this.dirty = true;
  }
  flyTo(lat, lon) {
    if (this.morph > 0.5) { const d = Math.min(this.dist, this.mapFit() * 0.5); this.animate("panX", -lon / 180 * 1.9); this.animate("panY", -lat / 90 * 0.95); this.animate("dist", d); return; }
    let ty = -lon * Math.PI / 180; while (ty - this.yaw > Math.PI) ty -= 2 * Math.PI; while (this.yaw - ty > Math.PI) ty += 2 * Math.PI;
    this.animate("yaw", ty, 1100); this.animate("pitch", clamp(lat, -75, 75) * Math.PI / 180, 1100); this.animate("dist", Math.min(this.dist, 2.9), 1100);
  }
  setProj(p) {
    if (p === 1) { this.animate("yaw", 0, 800); this.animate("pitch", 0, 800); this.animate("morph", 1, 1100); this.animate("dist", this.mapFit(), 1100); this.animate("panX", 0, 800); this.animate("panY", 0, 800); }
    else { this.animate("morph", 0, 1100); this.animate("dist", 3.4, 1100); this.animate("panX", 0, 800); this.animate("panY", 0, 800); }
  }
  get panX() { return this.pan[0]; } set panX(v) { this.pan[0] = v; }
  get panY() { return this.pan[1]; } set panY(v) { this.pan[1] = v; }
  bindInput() {
    const cv = this.cv; let pts = new Map(), moved = 0, last = null, pinch = null;
    cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; last = [e.clientX, e.clientY]; this.autoRotate = false; });
    cv.addEventListener("pointermove", e => {
      const r = cv.getBoundingClientRect();
      if (!pts.has(e.pointerId)) { this.onHover && this.onHover(e.clientX - r.left, e.clientY - r.top); return; }
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) this.zoomBy(pinch / d); pinch = d; moved += 10; return; }
      const dx = e.clientX - last[0], dy = e.clientY - last[1]; last = [e.clientX, e.clientY]; moved += Math.abs(dx) + Math.abs(dy);
      if (this.morph > 0.5) { const k = this.dist * 2 * Math.tan(17 * Math.PI / 180) / this.h; this.pan[0] += dx * k; this.pan[1] -= dy * k; }
      else { const k = 0.0052 * (this.dist - 1) / 2.4; this.yaw += dx * k; this.pitch = clamp(this.pitch + dy * k, -1.45, 1.45); }
      this.dirty = true;
    });
    const up = e => { if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); pinch = null;
      if (moved < 5 && this.onPick) { const r = cv.getBoundingClientRect(); const ll = this.unproject(e.clientX - r.left, e.clientY - r.top); if (ll) this.onPick(ll); } };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("pointerleave", () => this.onHover && this.onHover(null));
    cv.addEventListener("wheel", e => { e.preventDefault(); this.zoomBy(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    cv.addEventListener("keydown", e => {
      const k = e.key, s = 0.08; let h = true;
      if (k === "ArrowLeft") this.yaw += s; else if (k === "ArrowRight") this.yaw -= s;
      else if (k === "ArrowUp") this.pitch = clamp(this.pitch + s, -1.45, 1.45); else if (k === "ArrowDown") this.pitch = clamp(this.pitch - s, -1.45, 1.45);
      else if (k === "+" || k === "=") this.zoomBy(0.88); else if (k === "-") this.zoomBy(1.14); else h = false;
      if (h) { e.preventDefault(); this.dirty = true; }
    });
  }
  mapFit() { const t = Math.tan(17 * Math.PI / 180), a = this.w / Math.max(1, this.h); return 1.04 * Math.max(0.95 / t, 1.9 / (t * a)); }
  zoomBy(f) { const lo = this.morph > 0.5 ? 0.9 : 1.45; this.dist = clamp(this.dist * f, lo, this.morph > 0.5 ? Math.max(6, this.mapFit()) : 6); this.dirty = true; }
  loop(now) {
    if (this.tween.length) {
      this.tween = this.tween.filter(t => { const u = clamp((now - t.t0) / t.ms, 0, 1); this[t.key] = t.from + (t.to - t.from) * t.ease(u); return u < 1; });
      this.dirty = true;
    }
    if (this.autoRotate && !REDUCED) { this.yaw += 0.0009; this.dirty = true; }
    if (this.dirty) { this.draw(); this.dirty = false; this.onFrame && this.onFrame(); }
    requestAnimationFrame(this.loop);
  }
  uniforms(p, scale) {
    const gl = this.gl, R = this.rot();
    gl.uniformMatrix3fv(p.u.uRot, false, new Float32Array([R[0][0], R[1][0], R[2][0], R[0][1], R[1][1], R[2][1], R[0][2], R[1][2], R[2][2]]));
    gl.uniformMatrix4fv(p.u.uProj, false, new Float32Array(this.proj()));
    gl.uniform1f(p.u.uMorph, this.morph); gl.uniform1f(p.u.uDist, this.dist); gl.uniform1f(p.u.uScale, scale); gl.uniform2f(p.u.uPan, this.pan[0], this.pan[1]);
  }
  draw() {
    const gl = this.gl; gl.viewport(0, 0, this.cv.width, this.cv.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib);
    const p = this.prog; gl.useProgram(p); this.uniforms(p, 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fieldTex); gl.uniform1i(p.u.uField, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.baseTex); gl.uniform1i(p.u.uBase, 1);
    gl.uniform1f(p.u.uReveal, this.reveal); gl.uniform1f(p.u.uBaseMix, this.baseMix); gl.uniform1f(p.u.uGrid, this.grid);
    gl.uniform1f(p.u.uLayer, this.layer); gl.uniform1f(p.u.uLo, this.lo); gl.uniform1f(p.u.uHi, this.hi);
    gl.uniform1f(p.u.uCellGrid, this.morph > 0.5 ? clamp((1.6 - this.dist) * 1.5, 0, 1) : clamp((2.2 - this.dist) * 1.4, 0, 1));
    gl.uniform3fv(p.u.uRamp, new Float32Array(this.ramp.flatMap(hex3)));
    gl.uniform3fv(p.u.uClus, new Float32Array(CLUSTER_COLORS.flatMap(hex3)));
    gl.drawElements(gl.TRIANGLES, this.nIdx, gl.UNSIGNED_SHORT, 0);
    if (this.morph < 0.99) {        // atmosphere rim
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
      gl.useProgram(this.rim); this.uniforms(this.rim, 1.018); gl.uniform3fv(this.rim.u.uTint, new Float32Array(hex3(this.ramp[3]).map(x => x * 0.5 + 0.18)));
      gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT); gl.drawElements(gl.TRIANGLES, this.nIdx, gl.UNSIGNED_SHORT, 0); gl.disable(gl.CULL_FACE);
      gl.depthMask(true);
    }
    if (this.lb) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lb); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(this.lineP); this.uniforms(this.lineP, 1.0015); gl.uniform4f(this.lineP.u.uColor, 0.72, 0.78, 0.85, 0.30 * this.baseMix);
      gl.drawArrays(gl.LINES, 0, this.nLine);
    }
  }
}
