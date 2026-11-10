import React, { useMemo } from 'react';
import * as THREE from 'three';
import { terrainData } from '../terrain.js';

export default function Terrain() {
  const geo = useMemo(() => {
    const { NX, NZ, STEP, heights, colors, minX, minZ } = terrainData;
    const pos = new Float32Array(NX * NZ * 3);
    for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
      const k = iz * NX + ix;
      pos[k * 3] = minX + ix * STEP; pos[k * 3 + 1] = heights[k]; pos[k * 3 + 2] = minZ + iz * STEP;
    }
    const idx = new Uint32Array((NX - 1) * (NZ - 1) * 6);
    let n = 0;
    for (let iz = 0; iz < NZ - 1; iz++) for (let ix = 0; ix < NX - 1; ix++) {
      const a = iz * NX + ix, b = a + 1, c = a + NX, d = c + 1;
      idx[n++] = a; idx[n++] = c; idx[n++] = b; idx[n++] = b; idx[n++] = c; idx[n++] = d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial vertexColors flatShading roughness={1} metalness={0} />
    </mesh>
  );
}
