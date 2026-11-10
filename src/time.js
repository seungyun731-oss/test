import * as THREE from 'three';

// 산사의 하루는 20분. 접속한 모든 사람이 같은 시각(Date.now 기준)을 본다.
export const CYCLE_MS = 20 * 60 * 1000;
export const PRESETS = [
  { key: 'auto', label: '함께(자동)', icon: '🧭' },
  { key: 'dawn', label: '새벽', icon: '🌄', phase: 0.0 },
  { key: 'day', label: '낮', icon: '☀️', phase: 0.3 },
  { key: 'dusk', label: '저녁', icon: '🌇', phase: 0.56 },
  { key: 'night', label: '밤', icon: '🌙', phase: 0.77 },
];

export const sharedPhase = () => (Date.now() % CYCLE_MS) / CYCLE_MS;

// [phase, 하늘, 안개, 해/달빛, 광량, 반구 하늘, 반구 땅, 반구 광량, 밤 정도]
const K = [
  [0.0, '#e9b79a', '#d8b8b0', '#ffb98a', 0.9, '#c8b8d8', '#6a5a5a', 0.55, 0.35],
  [0.1, '#a9d3ec', '#d5e4ea', '#fff0d0', 1.8, '#bfe0ff', '#7a6a55', 0.8, 0.0],
  [0.3, '#8fcbf0', '#cfe6f0', '#fff6e4', 2.3, '#cfe8ff', '#7d7060', 0.95, 0.0],
  [0.48, '#9ccbea', '#e2e2d0', '#ffe3b0', 2.0, '#cfe0ff', '#7d6a55', 0.9, 0.0],
  [0.56, '#f0905a', '#e3a07f', '#ff8040', 1.2, '#e0a890', '#6b4a45', 0.6, 0.3],
  [0.64, '#4b4a80', '#5a5683', '#8a6ab0', 0.6, '#6a6aa8', '#3a2f44', 0.6, 0.8],
  [0.75, '#0f1a42', '#1a2650', '#8ea6e8', 0.75, '#4a5a9a', '#1c2036', 0.85, 1.0],
  [0.92, '#2a2f5a', '#3b3f66', '#9aa0d0', 0.6, '#4a5088', '#22222e', 0.7, 0.8],
  [1.0, '#e9b79a', '#d8b8b0', '#ffb98a', 0.9, '#c8b8d8', '#6a5a5a', 0.55, 0.35],
].map((k) => [k[0], new THREE.Color(k[1]), new THREE.Color(k[2]), new THREE.Color(k[3]), k[4], new THREE.Color(k[5]), new THREE.Color(k[6]), k[7], k[8]]);

export const sky = {
  sky: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(),
  sunI: 1, hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), hemiI: 1, night: 0,
  sunDir: new THREE.Vector3(),
};

export function evalSky(p) {
  let i = 0;
  while (i < K.length - 2 && p > K[i + 1][0]) i++;
  const a = K[i], b = K[i + 1];
  const f = (p - a[0]) / (b[0] - a[0]);
  sky.sky.copy(a[1]).lerp(b[1], f);
  sky.fog.copy(a[2]).lerp(b[2], f);
  sky.sun.copy(a[3]).lerp(b[3], f);
  sky.sunI = a[4] + (b[4] - a[4]) * f;
  sky.hemiSky.copy(a[5]).lerp(b[5], f);
  sky.hemiGround.copy(a[6]).lerp(b[6], f);
  sky.hemiI = a[7] + (b[7] - a[7]) * f;
  sky.night = a[8] + (b[8] - a[8]) * f;
  // 해는 새벽(0)에 뜨고 해질녘(~0.62)에 진다. 그 외에는 달빛.
  const el = p < 0.62 ? Math.sin((Math.PI * p) / 0.62) * 1.1 + 0.05 : 0.9;
  const az = p < 0.62 ? -0.6 + (p / 0.62) * 1.6 : 1.2;
  sky.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el) * -1).normalize();
  return sky;
}
