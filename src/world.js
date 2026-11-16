import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { U, uni, NOISE, SKY, FOG } from './glsl.js';
void U;
import { Rail } from './rail.js';
import { rng, cloudTexture } from './textures.js';

// --- small JS value noise for geometry
function h2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x, y) { return vn(x, y) * 0.55 + vn(x * 2.1 + 5.2, y * 2.1 + 1.3) * 0.3 + vn(x * 4.3 + 9.1, y * 4.3 + 7.7) * 0.15; }

const SKY_V = /* glsl */`
varying vec3 vDir;
void main(){ vDir = position; vec4 wp = modelMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * viewMatrix * wp; gl_Position.z = gl_Position.w * 0.99999; }`;
const SKY_F = /* glsl */`
uniform float uTime; uniform vec3 uSunColor; uniform float uSunSize; uniform vec3 uRanges; uniform float uStars;
uniform float uBandInk; uniform vec3 uInk; uniform float uMineral; uniform vec3 uMineralA; uniform float uNight;
uniform sampler2D uRidge;
varying vec3 vDir;
${NOISE}
${SKY}
float fbm3o(vec2 p){ float s=0., a=.5; for(int i=0;i<3;i++){ s+=a*vnoise(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,1.7); a*=.5; } return s / 0.875; }
void main(){
  vec3 d = normalize(vDir);
  vec3 col = skyCol(d);
  float az = atan(d.x, -d.z);
  float el = d.y;
  if (uStars > 0.001 && el > 0.0) {
    vec3 sp = d * 260.0; vec3 cell = floor(sp); float h = hash13(cell);
    if (h > 0.986) {
      vec3 f = fract(sp) - 0.5;
      float s = smoothstep(0.16, 0.0, length(f)) * (0.55 + 0.45 * sin(uTime * 2.3 + h * 97.0));
      col += vec3(1.0, 0.94, 0.82) * s * uStars * smoothstep(0.0, 0.2, el) * (h - 0.986) * 70.0;
    }
    float milky = fbm2(vec2(az * 1.3 + 2.0, el * 5.0)) * smoothstep(0.35, 0.0, abs(el - 0.32 - 0.12 * sin(az * 1.5)));
    col += vec3(0.45, 0.42, 0.62) * milky * 0.12 * uStars;
  }
  vec3 base = col;
  float sd = dot(d, uSunDir);
  float ang = acos(clamp(sd, -1.0, 1.0));
  float disc = 1.0 - smoothstep(uSunSize - 0.002, uSunSize + 0.0015, ang);
  vec3 dcol = uSunColor * (0.98 + 0.2 * (1.0 - ang / uSunSize));
  dcol *= 1.0 + uNight * 0.75;
  col = mix(col, dcol, disc);
  // sky ink bands
  float bands = fbm3o(vec2(az * 2.4 + uTime * 0.004, el * 15.0)) * 0.9;
  float bm = smoothstep(0.5, 0.8, bands) * smoothstep(0.03, 0.12, el) * smoothstep(0.6, 0.15, el);
  col = mix(col, mix(uInk, col, 0.5), bm * uBandInk);
  base = mix(base, mix(uInk, base, 0.5), bm * uBandInk);
  // far ranges (opaque silhouettes, tinted by atmosphere)
  vec3 rc = mix(uRanges, uMineralA * 0.8, uMineral * 0.45);
  vec3 rdg = texture2D(uRidge, vec2(az / 6.28318 + 0.5, 0.5)).rgb;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float b0 = 0.006 - fi * 0.008;
    float amp = 0.062 + fi * 0.02;
    float rv = i == 0 ? rdg.r : (i == 1 ? rdg.g : rdg.b);
    float r = b0 + amp * pow(rv, 1.7) * 1.7;
    float inside = smoothstep(r + 0.0012, r - 0.0012, el);
    float depth = max(r - el, 0.0);
    float wash = exp(-depth * (34.0 - fi * 8.0)) * 0.78 + 0.22 * exp(-depth * 5.0);
    float tx = 0.8 + 0.2 * hash12(floor(vec2(az * 300.0, el * 80.0)));
    float strength = 0.24 + fi * 0.17;
    vec3 mcol = mix(base, rc, wash * strength * tx);
    col = mix(col, mcol, inside);
    base = mix(base, mcol, inside);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const SEA_V = /* glsl */`
varying vec3 vWorld;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const SEA_F = /* glsl */`
uniform float uTime; uniform vec3 uSeaLight; uniform vec3 uSeaShadow;
varying vec3 vWorld;
${NOISE}
${SKY}
uniform float uFogDensity;
float fbm4(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,1.7); a*=.5; } return s * 1.0667; }
void main(){
  float t = uTime * 0.012;
  vec2 p = vWorld.xz * 0.013 + vec2(t, t * 0.35);
  float h0 = fbm4(p);
  float hx = fbm4(p + vec2(0.025, 0.0));
  float hz = fbm4(p + vec2(0.0, 0.025));
  vec3 nrm = normalize(vec3((h0 - hx) * 22.0, 1.0, (h0 - hz) * 22.0));
  vec3 L = normalize(uSunDir * vec3(1.0, 0.0, 1.0) + vec3(0.0, 0.55, 0.0));
  float shade = clamp(dot(nrm, L) * 0.5 + 0.5, 0.0, 1.0);
  shade = smoothstep(0.25, 0.95, shade);
  float puff = smoothstep(0.3, 0.75, h0);
  vec3 V = normalize(vWorld - cameraPosition);
  float dist = length(vWorld - cameraPosition);
  float det = vnoise(vWorld.xz * 0.06 - vec2(t * 3.0, 0.0)) * 0.6 + vnoise(vWorld.xz * 0.13) * 0.4;
  vec3 col = mix(uSeaShadow, uSeaLight, clamp(shade * 0.62 + puff * 0.48, 0.0, 1.0));
  col *= 1.0 + (det - 0.5) * 0.14 * smoothstep(500.0, 40.0, dist);
  vec2 sh = normalize(uSunDir.xz + 1e-4);
  float sunF = pow(max(dot(normalize(V.xz + 1e-4), sh), 0.0), 4.0);
  col += uSunGlow * uGlowAmt * sunF * 0.14 * shade;
  float f = 1.0 - exp(-dist * uFogDensity * 1.1);
  col = mix(col, skyCol(V), clamp(f, 0., 1.));
  gl_FragColor = vec4(col, 1.0);
}`;

const PILLAR_V = /* glsl */`
attribute float aTree;
varying vec3 vWorld; varying vec3 vN; varying float vTree; varying vec3 vLocal;
void main(){
  mat4 im = mat4(1.0);
  #ifdef USE_INSTANCING
  im = instanceMatrix;
  #endif
  vec4 wp = modelMatrix * im * vec4(position, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(modelMatrix * im) * normal);
  vTree = aTree; vLocal = position;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const PILLAR_F = /* glsl */`
uniform vec3 uInk; uniform vec3 uPaper; uniform float uMineral; uniform vec3 uMineralA; uniform vec3 uMineralB; uniform vec3 uOchre;
varying vec3 vWorld; varying vec3 vN; varying float vTree; varying vec3 vLocal;
${NOISE}
${SKY}
${FOG}
void main(){
  vec3 N = normalize(vN + vec3(0.0, 1e-6, 0.0));
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, uSunDir);
  float light = smoothstep(-0.35, 0.85, ndl);
  float ang = atan(vLocal.x, vLocal.z);
  float hN = vLocal.y / 200.0;
  float s1 = fbm2(vec2(ang * 4.0, vLocal.y * 0.03));
  float s2 = vnoise(vec2(ang * 26.0, vLocal.y * 0.012));
  float ink = 0.98 - light * 0.6;
  ink += (s1 - 0.5) * 0.65 + (s2 - 0.5) * 0.3;
  ink += smoothstep(0.62, 0.9, vnoise(vec2(ang * 3.0, vLocal.y * 0.09))) * 0.25;
  float rim = pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 3.0);
  ink += rim * 0.9;
  ink += smoothstep(0.7, 1.0, hN) * 0.2;
  ink = mix(ink, 1.05, vTree * 0.85);
  ink = clamp(ink, 0., 1.);
  vec3 col = mix(uPaper, uInk, ink);
  float mm = smoothstep(0.08, 0.5, hN + (s1 - 0.5) * 0.6) * (1.0 - vTree * 0.3);
  vec3 mineral = mix(uMineralB, uMineralA, smoothstep(0.4, 0.8, hN + (fbm2(vLocal.xz * 0.03 + vLocal.y * 0.006) - 0.5) * 0.6));
  vec3 mcol = mineral * (1.45 - ink * 1.05);
  vec3 ocol = uOchre * (1.3 - ink * 0.9);
  col = mix(col, mix(ocol, mcol, mm), uMineral * (1.0 - vTree * 0.6) * 0.92);
  gl_FragColor = vec4(applyFog(col, vWorld, 1.0), 1.0);
}`;

const CLOUD_V = /* glsl */`
attribute vec3 aPos; attribute vec4 aInfo;
varying vec2 vUv; varying float vAlpha; varying vec3 vWorld;
void main(){
  vec3 camRight = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
  float size = aInfo.x;
  vec3 wp = aPos + camRight * position.x * size + vec3(0.0, 1.0, 0.0) * position.y * size;
  vWorld = wp;
  vUv = vec2((position.x + 0.5) * 0.5 + aInfo.y * 0.5, position.y + 0.5);
  float dist = length(aPos - cameraPosition);
  vAlpha = aInfo.z * smoothstep(size * 0.18, size * 0.9, dist);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const CLOUD_F = /* glsl */`
uniform sampler2D uTex; uniform vec3 uCloudLit; uniform vec3 uCloudShade;
varying vec2 vUv; varying float vAlpha; varying vec3 vWorld;
${NOISE}
${SKY}
${FOG}
void main(){
  vec4 t = texture2D(uTex, vUv);
  float a = t.a * vAlpha;
  if (a < 0.008) discard;
  vec3 col = mix(uCloudShade, uCloudLit, t.r);
  col = applyFog(col, vWorld, 0.85);
  gl_FragColor = vec4(col, clamp(a * 1.25, 0., 1.));
}`;

const LANT_V = /* glsl */`
attribute vec3 aPos; attribute vec4 aInfo;
uniform float uTime;
varying vec2 vUv; varying float vFade; varying float vSeed;
void main(){
  vec3 camRight = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
  vec3 p = aPos; p.y += (uTime - aInfo.w) * aInfo.z;
  p.x += sin(uTime * 0.3 + aInfo.y * 10.0) * 2.0;
  float size = aInfo.x;
  vec3 wp = p + camRight * position.x * size + vec3(0.0, 1.0, 0.0) * position.y * size * 1.25;
  vUv = position.xy * 2.0;
  float dist = length(p - cameraPosition);
  vFade = exp(-dist * 0.0011) * smoothstep(10.0, 40.0, dist);
  vSeed = aInfo.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const LANT_F = /* glsl */`
uniform float uTime; uniform float uLanterns;
varying vec2 vUv; varying float vFade; varying float vSeed;
void main(){
  vec2 p = vUv;
  float w = mix(0.3, 0.38, clamp(p.y * 0.5 + 0.5, 0.0, 1.0));
  float body = smoothstep(0.08, 0.0, max(abs(p.x) - w, abs(p.y + 0.05) - 0.5));
  float glow = exp(-dot(p * vec2(1.6, 1.1), p * vec2(1.6, 1.1)) * 2.6);
  float flick = 0.82 + 0.18 * sin(uTime * 7.0 + vSeed * 40.0);
  vec3 c = vec3(1.0, 0.5, 0.2) * body * 2.4 + vec3(1.0, 0.45, 0.15) * glow * 0.75;
  c += vec3(1.0, 0.85, 0.6) * smoothstep(0.25, 0.0, length(p - vec2(0.0, -0.32))) * body * 1.5;
  gl_FragColor = vec4(c * flick * uLanterns * vFade, 1.0);
}`;

const BIRD_V = /* glsl */`
attribute vec3 aPos; attribute vec4 aInfo;
uniform float uTime;
varying vec3 vWorld;
void main(){
  vec3 p = position * aInfo.y;
  float f = sin(uTime * aInfo.w + aInfo.x);
  p.y += f * abs(position.x) * 0.7 * aInfo.y;
  float c = cos(aInfo.z), s = sin(aInfo.z);
  p = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  vec3 wp = aPos + p;
  vWorld = wp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const BIRD_F = /* glsl */`
uniform vec3 uInk;
varying vec3 vWorld;
${NOISE}
${SKY}
${FOG}
void main(){ gl_FragColor = vec4(applyFog(uInk * 1.25, vWorld, 0.8), 1.0); }`;

function birdGeometry() {
  const v = [
    0, 0, 0.35, -1.0, 0.28, -0.05, -0.45, 0.08, -0.12,
    -0.45, 0.08, -0.12, 0, 0, -0.3, 0, 0, 0.35,
    0, 0, 0.35, 0, 0, -0.3, 0.45, 0.08, -0.12,
    0.45, 0.08, -0.12, 1.0, 0.28, -0.05, 0, 0, 0.35,
    0, 0, 0.75, -0.07, 0, 0.25, 0.07, 0, 0.25,
    0, 0, -0.3, -0.14, 0, -0.62, 0.14, 0, -0.62,
  ];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}

function makePillarGeometry(seed) {
  const R = rng(seed);
  const H = 200, RB = 18, radial = 22, rings = 30;
  const pos = [], idx = [];
  const n1 = R() * 100, n2 = R() * 100, twist = (R() - 0.5) * 0.9, lean = (R() - 0.5) * 0.22;
  for (let j = 0; j <= rings; j++) {
    const v = j / rings, y = v * H;
    let r = RB * (1 + 0.6 * Math.pow(1 - v, 3)) * (0.86 + 0.14 * Math.sin(v * 5 + n1));
    if (v > 0.84) { const k = (v - 0.84) / 0.16; r *= Math.sqrt(Math.max(0, 1 - k * k)) * 0.85 + 0.15 * (1 - k); }
    for (let i = 0; i < radial; i++) {
      const a = i / radial * Math.PI * 2 + twist * v;
      const nz = fbm(Math.cos(a) * 1.4 + n1, Math.sin(a) * 1.4 + v * 7 + n2);
      const terr = Math.floor(v * 9 + nz * 0.7) / 9;
      const rr = r * (0.8 + nz * 0.42 + Math.sin(a * 6 + v * 3 + n2) * 0.05) * (1 + 0.035 * Math.sin(terr * 40));
      pos.push(Math.cos(a) * rr + lean * y, y, Math.sin(a) * rr);
    }
  }
  const top = pos.length / 3;
  pos.push(lean * H, H + 2, 0);
  for (let j = 0; j < rings; j++) for (let i = 0; i < radial; i++) {
    const a = j * radial + i, b = j * radial + (i + 1) % radial, c = (j + 1) * radial + i, d = (j + 1) * radial + (i + 1) % radial;
    idx.push(a, c, b, b, c, d);
  }
  const lr = rings * radial;
  for (let i = 0; i < radial; i++) idx.push(top, lr + (i + 1) % radial, lr + i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.setAttribute('aTree', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3), 1));
  const parts = [g];
  // trees on top & ledges
  const nT = 7 + Math.floor(R() * 8);
  for (let t = 0; t < nT; t++) {
    const onTop = t < nT * 0.65;
    const h = 7 + R() * 9, rad = 2.2 + R() * 2.2;
    const cone = new THREE.ConeGeometry(rad, h, 6, 1);
    cone.deleteAttribute('uv');
    let x, y, z, tilt = 0, ta = 0;
    if (onTop) {
      const a = R() * Math.PI * 2, d = R() * RB * 0.55;
      x = Math.cos(a) * d + lean * H * 0.96; z = Math.sin(a) * d; y = H * 0.93 + h * 0.35;
    } else {
      const v = 0.35 + R() * 0.5, a = R() * Math.PI * 2;
      const r = RB * (0.95 + 0.6 * Math.pow(1 - v, 3));
      x = Math.cos(a) * r + lean * v * H; z = Math.sin(a) * r; y = v * H; tilt = 0.6; ta = a;
    }
    if (tilt) { cone.rotateZ(-tilt); cone.rotateY(-ta); }
    cone.translate(x, y, z);
    cone.setAttribute('aTree', new THREE.Float32BufferAttribute(new Float32Array(cone.attributes.position.count).fill(1), 1));
    parts.push(cone.index ? cone : cone);
  }
  const merged = mergeGeometries(parts.map(p => p.index ? p : p), false);
  return merged;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    // sky
    const RN = 1024, rd = new Uint8Array(RN * 4);
    for (let i = 0; i < RN; i++) {
      const a = (i / RN - 0.5) * Math.PI * 2;
      for (let l = 0; l < 3; l++) {
        const f = 1.7 + l * 1.6, sd = 11 + l * 7;
        const x = a * f + sd;
        let n = 0, amp = 0.5, fr = 1;
        for (let o = 0; o < 5; o++) { n += amp * vn(x * fr, sd * 1.7 + o * 7.3); amp *= 0.5; fr *= 2.03; }
        const n2 = vn(a * f * 3.3 + sd * 2, 3.3);
        rd[i * 4 + l] = Math.round(Math.max(0, Math.min(1, n * 0.8 + n2 * 0.28 - 0.08)) * 255);
      }
      rd[i * 4 + 3] = 255;
    }
    const rtex = new THREE.DataTexture(rd, RN, 1, THREE.RGBAFormat);
    rtex.magFilter = THREE.LinearFilter; rtex.minFilter = THREE.LinearFilter; rtex.wrapS = THREE.RepeatWrapping; rtex.needsUpdate = true;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), new THREE.ShaderMaterial({
      uniforms: uni({ uRidge: { value: rtex } }), vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, depthTest: false,
    }));
    this.sky.renderOrder = -100; this.sky.frustumCulled = false;
    scene.add(this.sky);
    // cloud sea
    const seaGeo = new THREE.PlaneGeometry(5000, 5000, 1, 1); seaGeo.rotateX(-Math.PI / 2);
    this.sea = new THREE.Mesh(seaGeo, new THREE.ShaderMaterial({ uniforms: uni(), vertexShader: SEA_V, fragmentShader: SEA_F }));
    this.sea.frustumCulled = false;
    scene.add(this.sea);
    // pillars
    this.pillarMat = new THREE.ShaderMaterial({ uniforms: uni(), vertexShader: PILLAR_V, fragmentShader: PILLAR_F });
    this.pillarGeos = [];
    this.pillarMeshes = [];
    const NG = 6, PER = 30;
    for (let i = 0; i < NG; i++) {
      const g = makePillarGeometry(1000 + i * 77);
      const m = new THREE.InstancedMesh(g, this.pillarMat, PER);
      m.frustumCulled = false; m.count = PER;
      const hide = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let k = 0; k < PER; k++) m.setMatrixAt(k, hide);
      scene.add(m);
      this.pillarMeshes.push(m);
    }
    this.NP = NG * PER; this.pSlot = 0; this.nextPillarS = -100;
    this.pillarS = new Float32Array(this.NP).fill(-1e9);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3();
    this.R = rng(4242);
    // clouds
    this.NC = 110;
    const cg = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    cg.index = base.index; cg.setAttribute('position', base.attributes.position);
    this.cPos = new Float32Array(this.NC * 3); this.cInfo = new Float32Array(this.NC * 4);
    cg.setAttribute('aPos', new THREE.InstancedBufferAttribute(this.cPos, 3));
    cg.setAttribute('aInfo', new THREE.InstancedBufferAttribute(this.cInfo, 4));
    cg.instanceCount = this.NC;
    this.cloudGeo = cg;
    this.clouds = new THREE.Mesh(cg, new THREE.ShaderMaterial({
      uniforms: uni({ uTex: { value: cloudTexture() } }), vertexShader: CLOUD_V, fragmentShader: CLOUD_F,
      transparent: true, depthWrite: false,
    }));
    this.clouds.frustumCulled = false; this.clouds.renderOrder = 5;
    scene.add(this.clouds);
    this.cSlot = 0; this.nextCloudS = -60;
    // sky lanterns
    this.NL = 260;
    const lg = new THREE.InstancedBufferGeometry();
    lg.index = base.index; lg.setAttribute('position', base.attributes.position);
    this.lPos = new Float32Array(this.NL * 3); this.lInfo = new Float32Array(this.NL * 4);
    lg.setAttribute('aPos', new THREE.InstancedBufferAttribute(this.lPos, 3));
    lg.setAttribute('aInfo', new THREE.InstancedBufferAttribute(this.lInfo, 4));
    lg.instanceCount = this.NL;
    this.lanterns = new THREE.Mesh(lg, new THREE.ShaderMaterial({
      uniforms: uni(), vertexShader: LANT_V, fragmentShader: LANT_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.lanterns.frustumCulled = false; this.lanterns.renderOrder = 6;
    scene.add(this.lanterns);
    this.lSlot = 0; this.nextLanternS = 0;
    // flocks of cranes
    this.NB = 28;
    const bg = new THREE.InstancedBufferGeometry(); const bb = birdGeometry();
    bg.setAttribute('position', bb.attributes.position);
    this.bPos = new Float32Array(this.NB * 3); this.bInfo = new Float32Array(this.NB * 4);
    bg.setAttribute('aPos', new THREE.InstancedBufferAttribute(this.bPos, 3).setUsage(THREE.DynamicDrawUsage));
    bg.setAttribute('aInfo', new THREE.InstancedBufferAttribute(this.bInfo, 4));
    bg.instanceCount = this.NB;
    this.birds = new THREE.Mesh(bg, new THREE.ShaderMaterial({ uniforms: uni(), vertexShader: BIRD_V, fragmentShader: BIRD_F, side: THREE.DoubleSide }));
    this.birds.frustumCulled = false; scene.add(this.birds);
    this.flocks = [];
    for (let f = 0; f < 4; f++) this.flocks.push({ c: new THREE.Vector3(), v: new THREE.Vector3(), head: 0, ok: false });
  }

  spawnFlock(F, camS) {
    const R = this.R;
    const s = camS + 380 + R() * 700, side = R() < 0.5 ? -1 : 1;
    Rail.place(s, side * (140 + R() * 240), 40 + R() * 120, F.c);
    const sp = 9 + R() * 8;
    F.v.set(-side * sp, (R() - 0.5) * 1.5, -(4 + R() * 10));
    F.head = Math.atan2(F.v.x, F.v.z);
    F.ok = true;
  }
  updateBirds(dt, camPos, camS, time) {
    const night = U.uNight.value > 0.5;
    for (let f = 0; f < this.flocks.length; f++) {
      const F = this.flocks[f];
      if (!F.ok || F.c.z > camPos.z + 30 || Math.abs(F.c.x - camPos.x) > 700) this.spawnFlock(F, camS);
      F.c.addScaledVector(F.v, dt);
      const ch = Math.cos(F.head), sh = Math.sin(F.head);
      for (let i = 0; i < 7; i++) {
        const b = f * 7 + i, k = i - 3;
        const back = -Math.abs(k) * 2.4, lat = k * 2.8;
        const ox = ch * lat + sh * back, oz = -sh * lat + ch * back;
        this.bPos[b * 3] = F.c.x + ox; this.bPos[b * 3 + 1] = F.c.y + Math.sin(time * 0.7 + i) * 0.6; this.bPos[b * 3 + 2] = F.c.z + oz;
        this.bInfo[b * 4] = i * 0.7 + f; this.bInfo[b * 4 + 1] = night ? 0 : 2.4; this.bInfo[b * 4 + 2] = F.head; this.bInfo[b * 4 + 3] = 4.2 + (i % 3) * 0.3;
      }
    }
    this.birds.geometry.attributes.aPos.needsUpdate = true; this.birds.geometry.attributes.aInfo.needsUpdate = true;
  }

  spawnPillar(s) {
    const R = this.R;
    const side = R() < 0.5 ? -1 : 1;
    const r = R();
    let x, sc;
    if (r < 0.07) { x = 36 + R() * 12; sc = 0.42 + R() * 0.22; }
    else if (r < 0.5) { x = 58 + R() * 110; sc = 0.55 + R() * 0.7; }
    else { x = 170 + R() * 520; sc = 0.8 + R() * 1.1; }
    const sy = 0.3 + Math.pow(R(), 1.3) * 1.05;
    Rail.place(s, x * side, -72, this._p);
    this._q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.283);
    this._s.set(sc, sy, sc);
    this._m.compose(this._p, this._q, this._s);
    const slot = this.pSlot++ % this.NP;
    const mesh = this.pillarMeshes[slot % this.pillarMeshes.length];
    const k = Math.floor(slot / this.pillarMeshes.length);
    mesh.setMatrixAt(k, this._m);
    mesh.instanceMatrix.needsUpdate = true;
    this.pillarS[slot] = s;
  }

  spawnCloud(s) {
    const R = this.R; const i = this.cSlot++ % this.NC;
    const kind = R();
    let x, y, size, alpha;
    if (kind < 0.55) { x = (R() < 0.5 ? -1 : 1) * (20 + R() * 420); y = -36 + R() * 14; size = 60 + R() * 120; alpha = 0.75 + R() * 0.25; }
    else if (kind < 0.9) { x = (R() < 0.5 ? -1 : 1) * (35 + R() * 260); y = -18 + R() * 70; size = 30 + R() * 60; alpha = 0.45 + R() * 0.4; }
    else { x = (R() - 0.5) * 30; y = -6 + R() * 16; size = 26 + R() * 30; alpha = 0.5 + R() * 0.3; }
    Rail.place(s, x, y, this._p);
    this.cPos[i * 3] = this._p.x; this.cPos[i * 3 + 1] = this._p.y; this.cPos[i * 3 + 2] = this._p.z;
    this.cInfo[i * 4] = size; this.cInfo[i * 4 + 1] = R() < 0.5 ? 0 : 1; this.cInfo[i * 4 + 2] = alpha; this.cInfo[i * 4 + 3] = R();
    this.cloudGeo.attributes.aPos.needsUpdate = true; this.cloudGeo.attributes.aInfo.needsUpdate = true;
  }

  spawnLantern(s, time) {
    const R = this.R; const i = this.lSlot++ % this.NL;
    const x = (R() < 0.5 ? -1 : 1) * (26 + Math.pow(R(), 1.6) * 700);
    const y = -40 + R() * 150;
    Rail.place(s, x, y, this._p);
    const geo = this.lanterns.geometry;
    this.lPos[i * 3] = this._p.x; this.lPos[i * 3 + 1] = this._p.y; this.lPos[i * 3 + 2] = this._p.z;
    this.lInfo[i * 4] = 2.6 + R() * 2.4; this.lInfo[i * 4 + 1] = R(); this.lInfo[i * 4 + 2] = 0.8 + R() * 1.8; this.lInfo[i * 4 + 3] = time;
    geo.attributes.aPos.needsUpdate = true; geo.attributes.aInfo.needsUpdate = true;
  }

  reset(camS, time) {
    this.nextPillarS = camS - 80; this.nextCloudS = camS - 60; this.nextLanternS = camS - 40;
    this.fill(camS, time);
  }

  fill(camS, time) {
    while (this.nextPillarS < camS + 1900) { this.spawnPillar(this.nextPillarS); this.nextPillarS += 7 + this.R() * 20; }
    while (this.nextCloudS < camS + 1300) { this.spawnCloud(this.nextCloudS); this.nextCloudS += 9 + this.R() * 14; }
    while (this.nextLanternS < camS + 1500) { this.spawnLantern(this.nextLanternS, time); this.nextLanternS += 4 + this.R() * 7; }
  }

  update(dt, camPos, camS, time) {
    this.sky.position.copy(camPos);
    this.sea.position.set(camPos.x, -32, camPos.z);
    this.fill(camS, time);
    this.updateBirds(dt, camPos, camS, time);
  }
}
