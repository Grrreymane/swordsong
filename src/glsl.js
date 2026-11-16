import * as THREE from 'three';
import { PALETTES } from './config.js';

// Shared uniforms (objects are shared by reference across every material)
export const U = {
  uTime: { value: 0 },
  uBeat: { value: 0 },
  uSkyTop: { value: new THREE.Color() },
  uSkyHorizon: { value: new THREE.Color() },
  uSkyBottom: { value: new THREE.Color() },
  uSunDir: { value: new THREE.Vector3(0, 0.1, -1).normalize() },
  uSunColor: { value: new THREE.Color() },
  uSunGlow: { value: new THREE.Color() },
  uGlowAmt: { value: 1 },
  uSunSize: { value: 0.05 },
  uInk: { value: new THREE.Color() },
  uPaper: { value: new THREE.Color() },
  uFogDensity: { value: 0.002 },
  uMistTop: { value: -6 },
  uMistBottom: { value: -46 },
  uSeaLight: { value: new THREE.Color() },
  uSeaShadow: { value: new THREE.Color() },
  uCloudLit: { value: new THREE.Color() },
  uCloudShade: { value: new THREE.Color() },
  uRanges: { value: new THREE.Color() },
  uMineral: { value: 0 },
  uMineralA: { value: new THREE.Color() },
  uMineralB: { value: new THREE.Color() },
  uOchre: { value: new THREE.Color() },
  uStars: { value: 0 },
  uLanterns: { value: 0 },
  uBandInk: { value: 0.1 },
  uNight: { value: 0 },
};

export function uni(own) {
  return Object.assign({}, U, own || {});
}

export const NOISE = /* glsl */`
float hash11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float hash13(vec3 p3){ p3 = fract(p3*.1031); p3 += dot(p3, p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1.,0.)),u.x), mix(hash12(i+vec2(0.,1.)),hash12(i+vec2(1.,1.)),u.x), u.y); }
float vnoise3(vec3 p){ vec3 i=floor(p); vec3 f=fract(p); vec3 u=f*f*(3.-2.*f);
  float a=hash13(i), b=hash13(i+vec3(1.,0.,0.)), c=hash13(i+vec3(0.,1.,0.)), d=hash13(i+vec3(1.,1.,0.));
  float e=hash13(i+vec3(0.,0.,1.)), g=hash13(i+vec3(1.,0.,1.)), h=hash13(i+vec3(0.,1.,1.)), k=hash13(i+vec3(1.,1.,1.));
  return mix(mix(mix(a,b,u.x),mix(c,d,u.x),u.y), mix(mix(e,g,u.x),mix(h,k,u.x),u.y), u.z); }
float fbm2(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,1.7); a*=.5; } return s; }
float fbm3(vec3 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vnoise3(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }
`;

export const SKY = /* glsl */`
uniform vec3 uSkyTop; uniform vec3 uSkyHorizon; uniform vec3 uSkyBottom;
uniform vec3 uSunDir; uniform vec3 uSunGlow; uniform float uGlowAmt;
vec3 skyCol(vec3 d){
  float y = d.y;
  vec3 c = mix(uSkyHorizon, uSkyTop, pow(clamp(y/0.72, 0., 1.), 0.62));
  c = mix(c, uSkyBottom, smoothstep(0.0, -0.2, y));
  float sd = max(dot(d, uSunDir), 0.);
  c += uSunGlow * uGlowAmt * (pow(sd, 5.)*0.22 + pow(sd, 40.)*0.42);
  return min(c, vec3(0.92));
}
`;

export const FOG = /* glsl */`
uniform float uFogDensity; uniform float uMistTop; uniform float uMistBottom;
vec3 applyFog(vec3 col, vec3 wpos, float k){
  vec3 v = wpos - cameraPosition; float dist = length(v); vec3 dir = v / max(dist, 1e-4);
  float fd = 1. - exp(-dist * uFogDensity * k);
  float fh = smoothstep(uMistTop, uMistBottom, wpos.y) * smoothstep(25., 180., dist);
  float f = clamp(fd + fh * (1. - fd), 0., 0.93);
  return mix(col, skyCol(dir), f);
}
`;

// Dissolve chunk: requires varying vec3 vObj (object-space position) and uniforms uDissolve, uEmber
export const DISSOLVE = /* glsl */`
uniform float uDissolve; uniform vec3 uEmber;
vec3 dissolve(vec3 col, vec3 p, float scale){
  if (uDissolve <= 0.0) return col;
  float n = fbm3(p * scale);
  float th = uDissolve * 1.08 - 0.04;
  if (n < th) discard;
  float e = 1.0 - smoothstep(th, th + 0.07, n);
  return mix(col, uEmber, e);
}
`;

// ---------- palette mixer
const keys = Object.keys(PALETTES.dawn);
function toLinear(p) {
  const o = {};
  for (const k of keys) {
    const v = p[k];
    if (typeof v === 'string') o[k] = new THREE.Color(v);
    else if (Array.isArray(v)) o[k] = new THREE.Vector3(...v).normalize();
    else o[k] = v;
  }
  return o;
}
const LIN = {};
for (const name in PALETTES) LIN[name] = toLinear(PALETTES[name]);

const MAP = {
  skyTop: 'uSkyTop', skyHorizon: 'uSkyHorizon', skyBottom: 'uSkyBottom', sunDir: 'uSunDir', sunColor: 'uSunColor',
  sunGlow: 'uSunGlow', glowAmt: 'uGlowAmt', sunSize: 'uSunSize', ink: 'uInk', paper: 'uPaper', fog: 'uFogDensity',
  seaLight: 'uSeaLight', seaShadow: 'uSeaShadow', cloudLit: 'uCloudLit', cloudShade: 'uCloudShade', ranges: 'uRanges',
  mineral: 'uMineral', mineralA: 'uMineralA', mineralB: 'uMineralB', ochre: 'uOchre', stars: 'uStars', lanterns: 'uLanterns',
  bandInk: 'uBandInk', night: 'uNight',
};

export class PaletteMixer {
  constructor(name) {
    this.cur = this.clone(LIN[name]);
    this.from = this.clone(LIN[name]);
    this.to = LIN[name];
    this.t = 1; this.dur = 1; this.name = name;
    this.apply(this.to, this.to, 1);
  }
  clone(p) { const o = {}; for (const k of keys) o[k] = (p[k] && p[k].clone) ? p[k].clone() : p[k]; return o; }
  set(name, dur = 4) {
    if (!LIN[name]) return;
    this.name = name;
    this.from = this.clone(this.cur);
    this.to = LIN[name];
    this.t = 0; this.dur = Math.max(0.001, dur);
  }
  update(dt) {
    if (this.t >= 1) return;
    this.t = Math.min(1, this.t + dt / this.dur);
    const e = this.t * this.t * (3 - 2 * this.t);
    this.apply(this.from, this.to, e);
  }
  apply(a, b, e) {
    for (const k of keys) {
      const u = U[MAP[k]]; if (!u) continue;
      const va = a[k], vb = b[k];
      if (va instanceof THREE.Color) { this.cur[k].copy(va).lerp(vb, e); u.value.copy(this.cur[k]); }
      else if (va instanceof THREE.Vector3) { this.cur[k].copy(va).lerp(vb, e).normalize(); u.value.copy(this.cur[k]); }
      else { this.cur[k] = va + (vb - va) * e; u.value = this.cur[k]; }
    }
  }
}
