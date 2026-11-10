// 서버/클라이언트가 함께 쓰는 월드 정의 (순수 JS, three 의존 없음)

export const MAX_PLAYERS = 30;
export const LANTERN_SLOTS = 96;
export const H_END = 30; // 절 마당의 해발(월드 y)

// 산길이 지나는 지점 (x, z). 입구(+z)에서 절 마당(-z)까지 구불구불 올라간다.
const WAYPOINTS = [
  [0, 100], [0, 90], [20, 78], [45, 70], [62, 52], [50, 32], [22, 24], [-8, 28],
  [-38, 20], [-55, 0], [-40, -20], [-12, -26], [18, -22], [45, -34], [58, -56],
  [40, -76], [12, -84], [-18, -92], [-30, -110], [-10, -124], [0, -136], [0, -150],
];

// 절 마당(중심 + 반지름)
export const COURT = { x: 0, z: -165, y: H_END, r: 24 };

// 월드 경계
export const BOUNDS = { minX: -110, maxX: 110, minZ: -195, maxZ: 115 };

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return [
    0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

function build() {
  const P = WAYPOINTS;
  const dense = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < 24; k++) dense.push(catmull(p0, p1, p2, p3, k / 24));
  }
  dense.push(P[P.length - 1]);
  // 호 길이로 균등(약 2m) 재샘플링
  const cum = [0];
  for (let i = 1; i < dense.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  }
  const L = cum[cum.length - 1];
  const N = Math.round(L / 2);
  const out = [];
  let j = 0;
  for (let i = 0; i <= N; i++) {
    const s = (i / N) * L;
    while (j < cum.length - 2 && cum[j + 1] < s) j++;
    const f = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
    out.push({
      x: dense[j][0] + (dense[j + 1][0] - dense[j][0]) * f,
      z: dense[j][1] + (dense[j + 1][1] - dense[j][1]) * f,
      s,
    });
  }
  return { samples: out, length: L };
}

const built = build();
export const PATH = built.samples;
export const PATH_LENGTH = built.length;

/** 산길 위의 s(미터) 지점의 좌표와 진행 방향 */
export function pathAt(s) {
  const f = Math.max(0, Math.min(PATH.length - 1.001, (s / PATH_LENGTH) * (PATH.length - 1)));
  const i = Math.floor(f), u = f - i;
  const a = PATH[i], b = PATH[i + 1];
  let tx = b.x - a.x, tz = b.z - a.z;
  const l = Math.hypot(tx, tz) || 1;
  tx /= l; tz /= l;
  return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, tx, tz };
}

/** 길 높이 (월드 y) */
export function pathHeight(s) {
  const k = s / PATH_LENGTH;
  return H_END * k + 0.8 * Math.sin(s * 0.05) * (1 - k);
}

// 돌탑 자리: 0 = 절 마당, 1 = 산길 중간 쉼터
const mid = pathAt(PATH_LENGTH * 0.45);
export const CAIRNS = [
  { x: COURT.x + 15, z: COURT.z - 4, name: '마당 돌탑' },
  { x: mid.x + -mid.tz * 3.6, z: mid.z + mid.tx * 3.6, name: '쉼터 돌탑' },
];

export const MAX_WISH = 30;
