// standalone dragon viewer: poses the dragon on a fixed path and renders it from chosen angles
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Dragon, DL } from '../src/dragon.js';
import { U, PaletteMixer } from '../src/glsl.js';

const W = innerWidth, H = innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.NeutralToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
let pm = new PaletteMixer('night');
U.uFogDensity.value = 0.0004;
const cam = new THREE.PerspectiveCamera(38, W / H, 0.5, 4000);
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, cam));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.35, 0.5, 0.9); composer.addPass(bloom);
composer.addPass(new OutputPass());
const dragon = new Dragon(scene);
dragon.group.visible = true;
const C = { camPos: new THREE.Vector3(), F: new THREE.Vector3(0, 0, -1), R: new THREE.Vector3(1, 0, 0), U: new THREE.Vector3(0, 1, 0), ky: 0.5, aspect: W / H };

function setPath(kind) {
  dragon.hist.length = 0;
  const N = 400;
  for (let k = N; k >= 0; k--) {
    const s = k / N * (DL + 50);
    let x, y, d;
    if (kind === 'coil') { x = -Math.sin(s * 0.018) * 90; y = Math.sin(s * 0.03) * 25 - s * 0.15; d = 220 + Math.cos(s * 0.018) * 90; }
    else { x = -s * 0.95; y = Math.sin(s * 0.03) * 16; d = 150 + Math.sin(s * 0.015) * 25; }
    dragon.hist.push([x, y, d]);
  }
}
const tmp = new THREE.Vector3(), tgt = new THREE.Vector3();
// local head-frame point -> world
function hl(x, y, z, out) { return dragon.at(0, x, y, z, out); }
window.render = (view, opts = {}) => {
  const t = opts.t ?? 1.0;
  if (opts.pal && opts.pal !== pm.name) pm = new PaletteMixer(opts.pal);
  setPath(opts.path || 'line');
  const u = dragon.u;
  u.uJaw.value = opts.jaw ?? 0.12; u.uCorrupt.value = opts.cor ?? 1; u.uFreed.value = opts.freed ?? 0;
  U.uTime.value = t;
  dragon.update(0, C, t);
  const V = { side: [-1, 0.12, 0.05], side2: [1, 0.12, 0.05], q34: [-0.7, 0.3, 0.65], front: [0, 0.18, 1], top: [-0.15, 1, 0.1], back: [-0.5, 0.45, -0.75] }[view];
  if (view === 'body') {
    dragon.at(0.35, 0, 0, 0, tgt);
    cam.position.set(tgt.x - 40, tgt.y + 60, tgt.z + 330); cam.fov = 38;
  } else if (view === 'game') {
    cam.position.set(0, 0, 0); cam.fov = 58; tgt.set(0, 0, -1);
  } else {
    const dist = opts.dist ?? 48;
    hl(0, 1.5, 4, tgt);
    const v = new THREE.Vector3(...V).normalize();
    hl(v.x * dist, 1.5 + v.y * dist, 4 + v.z * dist, tmp);
    cam.position.copy(tmp); cam.fov = 38;
  }
  cam.updateProjectionMatrix(); cam.up.set(0, 1, 0); cam.lookAt(tgt);
  scene.background = U.uSkyHorizon.value.clone().multiplyScalar(0.8);
  composer.render();
  return [tgt.x, tgt.y, tgt.z].map(v => +v.toFixed(1));
};
window.__ready = true;
