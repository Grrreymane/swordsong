// Tempo is per song: recorded tracks bring their own BPM. These are live bindings, updated by setTempo.
export let BPM = 120;
export let BEAT = 60 / BPM;
export let STEP = BEAT / 4;
export let BAR = BEAT * 4;
export function setTempo(bpm) { BPM = bpm; BEAT = 60 / bpm; STEP = BEAT / 4; BAR = BEAT * 4; }
export const SPEED = 36;
export const MAX_LOCKS = 8;
export const SWORD_DEPTH = 12;     // rail distance from camera to sword guard
export const BOSS_BAR = 72;
// rhythm windows (seconds)
export const OPEN = 0.9;     // approach ring appears this long before the beat
export const LATE = 0.2;     // a note can still be struck this long after its beat
export const PERFECT = 0.085;
export const GREAT = 0.17;

export const STAGES = [
  { bar: 0, key: 'dawn', name: '云海', chapter: '第一章', poem: ['云海苍茫', '一剑破晓'] },
  { bar: 24, key: 'jade', name: '青绿', chapter: '第二章', poem: ['千里江山', '青绿如梦'] },
  { bar: 48, key: 'dusk', name: '灯海', chapter: '第三章', poem: ['万灯升暮', '归路无尘'] },
  { bar: 72, key: 'night', name: '龙渊', chapter: '终章', poem: ['潜龙勿用', '或跃在渊'] },
];

export const PALETTES = {
  dawn: {
    skyTop: '#8a97a5', skyHorizon: '#ece3d2', skyBottom: '#e2dcd0',
    sunDir: [0.15, 0.15, -1], sunColor: '#d6452a', sunGlow: '#f1b08b', glowAmt: 0.85, sunSize: 0.058,
    ink: '#1a1f27', paper: '#d4d1c7', fog: 0.0019,
    seaLight: '#f7f2ea', seaShadow: '#a2a7ad', cloudLit: '#fbf7ef', cloudShade: '#b0b4b7',
    ranges: '#39404a', mineral: 0, mineralA: '#2c6d8c', mineralB: '#3d8c69', ochre: '#a8794a',
    stars: 0, lanterns: 0, bandInk: 0.14, night: 0,
  },
  jade: {
    skyTop: '#5a8aa5', skyHorizon: '#e7eee4', skyBottom: '#dde5de',
    sunDir: [-0.12, 0.3, -1], sunColor: '#f7ecd2', sunGlow: '#fff0cf', glowAmt: 0.7, sunSize: 0.046,
    ink: '#18282e', paper: '#cdd7cb', fog: 0.0019,
    seaLight: '#f5f8f2', seaShadow: '#9ab1b4', cloudLit: '#ffffff', cloudShade: '#aabdbe',
    ranges: '#2c5664', mineral: 1, mineralA: '#2a6f93', mineralB: '#36906d', ochre: '#b27d44',
    stars: 0, lanterns: 0, bandInk: 0.08, night: 0,
  },
  dusk: {
    skyTop: '#1e2348', skyHorizon: '#dc7650', skyBottom: '#6e4452',
    sunDir: [0.06, 0.045, -1], sunColor: '#f3562d', sunGlow: '#ff8f55', glowAmt: 0.62, sunSize: 0.078,
    ink: '#0f1018', paper: '#836d70', fog: 0.0021,
    seaLight: '#dc9b7c', seaShadow: '#4a3c55', cloudLit: '#f2a47c', cloudShade: '#4f4561',
    ranges: '#2a2235', mineral: 0.15, mineralA: '#3b4f7a', mineralB: '#5b3f5f', ochre: '#8a4a3a',
    stars: 0.25, lanterns: 1, bandInk: 0.22, night: 1,
  },
  night: {
    skyTop: '#080b19', skyHorizon: '#2f2947', skyBottom: '#1b1a2c',
    sunDir: [0.22, 0.29, -1], sunColor: '#f3e7c6', sunGlow: '#a8a3d8', glowAmt: 0.6, sunSize: 0.05,
    ink: '#04050a', paper: '#3e4059', fog: 0.0022,
    seaLight: '#5d5c80', seaShadow: '#15162a', cloudLit: '#9290b8', cloudShade: '#262640',
    ranges: '#141629', mineral: 0, mineralA: '#2a3f6a', mineralB: '#28445a', ochre: '#4a3a4a',
    stars: 1, lanterns: 0.75, bandInk: 0.2, night: 1,
  },
  gold: {
    skyTop: '#c98f68', skyHorizon: '#f6e2c2', skyBottom: '#efd6b6',
    sunDir: [0.0, 0.2, -1], sunColor: '#fff4dc', sunGlow: '#ffc27a', glowAmt: 0.9, sunSize: 0.07,
    ink: '#3b2a22', paper: '#efdcc2', fog: 0.0021,
    seaLight: '#fff9ef', seaShadow: '#d6a983', cloudLit: '#fffaf1', cloudShade: '#d5a887',
    ranges: '#8a5d4a', mineral: 0, mineralA: '#2c6d8c', mineralB: '#3d8c69', ochre: '#a8794a',
    stars: 0, lanterns: 0.35, bandInk: 0.1, night: 0,
  },
};
