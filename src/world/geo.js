import * as THREE from 'three';

/** 아래가 넓고 위가 좁은 사각뿔대 (지붕). 윗면은 용마루가 된다. */
export function frustumGeo(w, d, tw, td, h) {
  const a = [w / 2, d / 2], t = [tw / 2, td / 2];
  const v = [
    [-a[0], 0, -a[1]], [a[0], 0, -a[1]], [a[0], 0, a[1]], [-a[0], 0, a[1]],
    [-t[0], h, -t[1]], [t[0], h, -t[1]], [t[0], h, t[1]], [-t[0], h, t[1]],
  ];
  const faces = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7], [3, 2, 1, 0]];
  const pos = [];
  for (const f of faces) {
    const [i, j, k, l] = f;
    for (const q of [i, j, k, i, k, l]) pos.push(...v[q]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true, ...opts });
