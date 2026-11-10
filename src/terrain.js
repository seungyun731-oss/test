import { PATH, PATH_LENGTH, COURT, BOUNDS, H_END, pathHeight } from '../shared/path.js';

export const STEP = 1.5;
const NX = Math.round((BOUNDS.maxX - BOUNDS.minX) / STEP) + 1;
const NZ = Math.round((BOUNDS.maxZ - BOUNDS.minZ) / STEP) + 1;

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 값 노이즈 (결정적)
function hash(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => vnoise(x * 0.05, z * 0.05) * 0.6 + vnoise(x * 0.13, z * 0.13) * 0.3 + vnoise(x * 0.31, z * 0.31) * 0.1;

const heights = new Float32Array(NX * NZ);
const dists = new Float32Array(NX * NZ);
const colors = new Float32Array(NX * NZ * 3);
const nearestS = new Float32Array(NX * NZ);

const hp = PATH.map((p) => pathHeight(p.s));

(function bake() {
  for (let iz = 0; iz < NZ; iz++) {
    for (let ix = 0; ix < NX; ix++) {
      const x = BOUNDS.minX + ix * STEP, z = BOUNDS.minZ + iz * STEP;
      let wsum = 0, hsum = 0, dmin = 1e9, near = 0;
      for (let i = 0; i < PATH.length; i++) {
        const dx = x - PATH[i].x, dz = z - PATH[i].z;
        const d2 = dx * dx + dz * dz;
        if (d2 < dmin) { dmin = d2; near = i; }
        const w = 1 / (d2 * d2 + 4);
        wsum += w; hsum += w * hp[i];
      }
      const d = Math.sqrt(dmin);
      let h = hsum / wsum;
      const n = fbm(x, z);
      h += smooth(3, 9, d) * Math.min((d - 3) * 0.3, 8);
      h += (n - 0.5) * 6 * smooth(5, 16, d) + (vnoise(x * 0.5, z * 0.5) - 0.5) * 0.25;
      const dc = Math.hypot(x - COURT.x, z - COURT.z);
      const blend = 1 - smooth(COURT.r + 2, COURT.r + 12, dc);
      h = h * (1 - blend) + H_END * blend;

      const k = iz * NX + ix;
      heights[k] = h; dists[k] = d; nearestS[k] = PATH[near].s;

      // 색
      let r, g, b;
      const patch = vnoise(x * 0.09 + 40, z * 0.09 - 17); // 단풍 든 풀밭 얼룩
      const gr = 0.9 + 0.2 * vnoise(x * 0.4, z * 0.4);
      const grass = patch > 0.58 ? [0.55 * gr, 0.38 * gr, 0.17 * gr] : [0.30 * gr, 0.43 * gr, 0.2 * gr];
      const dirt = [0.62, 0.5, 0.36];
      const t1 = smooth(2.0, 3.6, d);
      r = dirt[0] * (1 - t1) + grass[0] * t1; g = dirt[1] * (1 - t1) + grass[1] * t1; b = dirt[2] * (1 - t1) + grass[2] * t1;
      const rock = smooth(10, 24, d) * (n > 0.62 ? 1 : 0);
      r += (0.5 - r) * rock * 0.5; g += (0.5 - g) * rock * 0.5; b += (0.48 - b) * rock * 0.5;
      const tc = 1 - smooth(COURT.r - 2, COURT.r + 2, dc);
      if (tc > 0) {
        const chk = (Math.floor(x / 3) + Math.floor(z / 3)) & 1 ? 0.0 : 0.04;
        r = r * (1 - tc) + (0.5 + chk) * tc; g = g * (1 - tc) + (0.49 + chk) * tc; b = b * (1 - tc) + (0.46 + chk) * tc;
      }
      colors[k * 3] = r; colors[k * 3 + 1] = g; colors[k * 3 + 2] = b;
    }
  }
})();

function bilinear(arr, x, z) {
  const fx = (x - BOUNDS.minX) / STEP, fz = (z - BOUNDS.minZ) / STEP;
  const ix = Math.max(0, Math.min(NX - 2, Math.floor(fx))), iz = Math.max(0, Math.min(NZ - 2, Math.floor(fz)));
  const u = Math.max(0, Math.min(1, fx - ix)), v = Math.max(0, Math.min(1, fz - iz));
  const k = iz * NX + ix;
  return arr[k] * (1 - u) * (1 - v) + arr[k + 1] * u * (1 - v) + arr[k + NX] * (1 - u) * v + arr[k + NX + 1] * u * v;
}

export const groundY = (x, z) => bilinear(heights, x, z);
export const pathDist = (x, z) => bilinear(dists, x, z);
export const progressAt = (x, z) => bilinear(nearestS, x, z);

/** 걸어갈 수 있는 곳인가 */
export function walkable(x, z) {
  if (x < BOUNDS.minX + 4 || x > BOUNDS.maxX - 4 || z < BOUNDS.minZ + 4 || z > BOUNDS.maxZ - 4) return false;
  if (Math.hypot(x - COURT.x, z - COURT.z) < COURT.r + 3) return true;
  return pathDist(x, z) < 30;
}

export const terrainData = { NX, NZ, STEP, heights, colors, dists, minX: BOUNDS.minX, minZ: BOUNDS.minZ };

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export { PATH_LENGTH };
