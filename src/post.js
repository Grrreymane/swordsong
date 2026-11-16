import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { NOISE } from './glsl.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
    uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 1, 1) }, uDamage: { value: 0 }, uWipe: { value: 0 },
    uVig: { value: 1 }, uGrain: { value: 1 }, uMist: { value: 0 }, uOD: { value: 0 }, uInkCol: { value: new THREE.Color(0.08, 0.09, 0.11) },
    uCA: { value: 0.002 }, uSat: { value: 1 },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime; uniform float uFlash; uniform vec3 uFlashCol;
uniform float uDamage; uniform float uWipe; uniform float uVig; uniform float uGrain; uniform float uMist; uniform float uOD;
uniform vec3 uInkCol; uniform float uCA; uniform float uSat;
varying vec2 vUv;
${NOISE}
void main(){
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float aspect = uRes.x / uRes.y;
  float r2 = dot(c * vec2(min(aspect, 1.0), 1.0), c * vec2(min(aspect, 1.0), 1.0));
  float ca = uCA * (0.35 + r2 * 3.0);
  vec3 col;
  col.r = texture2D(tDiffuse, uv + c * ca).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - c * ca).b;
  col = mix(col, vec3(0.95, 0.94, 0.92), uMist);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, uSat);
  vec2 px = uv * uRes;
  float g1 = hash12(floor(px * 0.5) + floor(uTime * 24.0) * 1.7) - 0.5;
  float fib = vnoise(vec2(px.x * 0.018, px.y * 0.3)) - 0.5;
  col += (g1 * 0.03 + fib * 0.018) * uGrain;
  float vig = smoothstep(0.18, 0.75, r2);
  col *= 1.0 - vig * 0.22 * uVig;
  if (uDamage > 0.001) {
    float n = fbm2(uv * vec2(aspect, 1.0) * 3.0 + vec2(uTime * 0.15, 0.0));
    float edge = r2 * 2.4 + n * 0.55;
    float m = smoothstep(1.05 - uDamage * 0.75, 1.18 - uDamage * 0.75, edge);
    col = mix(col, uInkCol, m * 0.93);
    col = mix(col, vec3(dot(col, vec3(0.333))), uDamage * 0.55);
  }
  col += vec3(1.0, 0.72, 0.28) * uOD * 0.07 * (1.0 - r2);
  col = mix(col, uFlashCol, uFlash);
  if (uWipe > 0.001) {
    float n = fbm2(uv * vec2(aspect, 1.0) * 2.4 + 3.0);
    float d = length(c * vec2(aspect, 1.0));
    float v = 1.25 - d + n * 0.5;
    float thr = 2.0 - uWipe * 2.3;
    float m = smoothstep(thr, thr + 0.1, v);
    col = mix(col, uInkCol, m);
  }
  gl_FragColor = vec4(col, 1.0);
}`,
};

// One NaN or Inf pixel (a pow() of a negative number on D3D, a zero normal) is harmless on its own,
// but the bloom blurs it across its mip chain into flickering black squares. Scrub them before the bloom.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
uniform sampler2D tDiffuse; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  bvec3 bad = bvec3(isnan(c.r) || isinf(c.r), isnan(c.g) || isinf(c.g), isnan(c.b) || isinf(c.b));
  if (any(bad)) c = vec3(0.0);
  c = min(max(c, vec3(0.0)), vec3(32.0));
  gl_FragColor = vec4(c, 1.0);
}`,
};

export class Post {
  constructor(renderer, scene, camera, hudScene, hudCam, w, h, dpr) {
    this.renderer = renderer;
    const gl = renderer.getContext();
    const ext = renderer.extensions;
    const hdr = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
    this.hdr = hdr;
    const samples = (!renderer.capabilities.isWebGL2 || !ext.has('EXT_color_buffer_float')) ? 0 : dpr <= 1.3 ? 4 : 2;
    const rt = new THREE.WebGLRenderTarget(Math.max(1, w * dpr), Math.max(1, h * dpr), {
      type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, samples,
    });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.sanitize = new ShaderPass(SanitizeShader);
    this.composer.addPass(this.sanitize);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.45, 0.5, hdr ? 0.95 : 0.8);
    this.composer.addPass(this.bloom);
    this.hudPass = new RenderPass(hudScene, hudCam);
    this.hudPass.clear = false;
    this.composer.addPass(this.hudPass);
    this.output = new OutputPass();
    this.composer.addPass(this.output);
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);
    this.u = this.final.uniforms;
    this.u.uRes.value.set(w * dpr, h * dpr);
    void gl;
  }
  setSize(w, h, dpr) {
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.u.uRes.value.set(w * dpr, h * dpr);
  }
  render(dt) { this.composer.render(dt); }
}
