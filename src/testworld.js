import * as THREE from 'three';
import { U, PaletteMixer } from './glsl.js';
import { World } from './world.js';
import { Post } from './post.js';
import { Rail } from './rail.js';

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.NeutralToneMapping;
const w = innerWidth, h = innerHeight, dpr = 1;
renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(w < h ? 68 : 55, w / h, 0.5, 6000);
const hudScene = new THREE.Scene(); const hudCam = new THREE.OrthographicCamera(0, w, h, 0, -10, 10);
const pal = new PaletteMixer(location.hash.slice(1).split('-')[0] || 'dawn');
const world = new World(scene); if (location.hash.includes('nc')) world.clouds.visible = false; window.__world = world;
const post = new Post(renderer, scene, camera, hudScene, hudCam, w, h, dpr);
const F = Rail.makeFrame();
let s = 300;
world.reset(s - 12, 0);
document.getElementById('loading').classList.add('out');
function frame() {
  s += 36 * 0.016;
  const camS = s - 12;
  Rail.frame(camS, F);
  camera.position.copy(F.p).addScaledVector(F.u, 4.5);
  const T = Rail.frame(s + 40, Rail.makeFrame());
  camera.up.copy(F.u);
  camera.lookAt(T.p.clone().addScaledVector(T.u, 1));
  U.uTime.value += 0.016;
  world.update(0.016, camera.position, camS, U.uTime.value);
  post.render(0.016);
}
window.__frame = frame;
for (let i = 0; i < 3; i++) frame();
window.__ready = true;
