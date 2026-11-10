import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { groundY, mulberry } from '../terrain.js';

export const CAIRN_VISIBLE = 100;

export default function Cairn({ x, z, count }) {
  const ref = useRef();
  const y = useMemo(() => groundY(x, z), [x, z]);
  const stones = useMemo(() => {
    const rnd = mulberry(Math.floor(x * 7 + z * 13) + 3);
    return Array.from({ length: CAIRN_VISIBLE }, (_, i) => {
      const layer = Math.floor(i / 5), k = i % 5;
      const rad = (0.95 - layer * 0.034) * 0.5;
      const a = k * ((Math.PI * 2) / 5) + layer * 0.7 + rnd() * 0.4;
      const sz = Math.max(0.16, 0.44 - layer * 0.013) * (0.85 + rnd() * 0.3);
      return { x: Math.cos(a) * rad * (layer ? 1 : 1.1), z: Math.sin(a) * rad * (layer ? 1 : 1.1), y: 0.3 + layer * 0.17, s: sz, ry: rnd() * 6, tone: 0.34 + rnd() * 0.22 };
    });
  }, [x, z]);
  useEffect(() => {
    const o = new THREE.Object3D(), mesh = ref.current;
    const n = Math.min(count, CAIRN_VISIBLE);
    for (let i = 0; i < n; i++) {
      const t = stones[i];
      o.position.set(t.x, t.y, t.z); o.rotation.set(0, t.ry, 0); o.scale.set(t.s * 1.15, t.s * 0.7, t.s); o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, new THREE.Color().setHSL(0.09, 0.06, t.tone));
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count, stones]);
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.8, 0.95, 0.2, 8]} /><meshStandardMaterial color="#7d7970" flatShading roughness={1} /></mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, CAIRN_VISIBLE]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial flatShading roughness={1} />
      </instancedMesh>
    </group>
  );
}
