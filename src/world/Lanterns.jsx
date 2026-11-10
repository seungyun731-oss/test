import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COURT, LANTERN_SLOTS } from '../../shared/path.js';
import { sky } from '../time.js';
import { mat } from './geo.js';

export const LANTERN_COLORS = ['#ff6a3d', '#ff8fb1', '#ffd34d', '#8fd36b', '#b58cff'];
export const CORD_Z = [11, 7, 3];
const HALF = 17;
const PER = LANTERN_SLOTS / CORD_Z.length; // 32

const cordY = (x) => 4.7 - 0.9 * (1 - (x / HALF) ** 2);

/** 슬롯 번호 → 월드 좌표 */
export function slotPos(slot) {
  const c = Math.floor(slot / PER), i = slot % PER;
  const x = COURT.x - HALF + (i + 0.5) * ((HALF * 2) / PER);
  return { x, y: COURT.y + cordY(x - COURT.x) - 0.5, z: COURT.z + CORD_Z[c] };
}

export default function Lanterns({ items }) {
  const ref = useRef(), matRef = useRef(), lights = useRef([]);
  useEffect(() => {
    const o = new THREE.Object3D();
    const mesh = ref.current;
    let n = 0;
    for (const it of items) {
      if (!it) continue;
      const p = slotPos(it.slot);
      o.position.set(p.x, p.y, p.z); o.rotation.set(0, (it.slot * 1.7) % 6.28, 0); o.scale.set(1, 1.3, 1); o.updateMatrix();
      mesh.setMatrixAt(n, o.matrix);
      mesh.setColorAt(n, new THREE.Color(LANTERN_COLORS[it.color] || LANTERN_COLORS[0]));
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items]);

  useFrame(() => {
    const n = sky.night;
    matRef.current.color.setScalar(0.62 + 0.38 * n);
    lights.current.forEach((l) => { if (l) l.intensity = n * 14; });
  });

  const cords = useMemo(() => CORD_Z.map((cz) => {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const x = -HALF + (i / 24) * HALF * 2;
      pts.push(new THREE.Vector3(COURT.x + x, COURT.y + cordY(x), COURT.z + cz));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }), []);
  const poleM = useMemo(() => mat('#5d1f17'), []);

  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, LANTERN_SLOTS]} frustumCulled={false}>
        <sphereGeometry args={[0.24, 10, 8]} />
        <meshBasicMaterial ref={matRef} toneMapped={false} />
      </instancedMesh>
      {cords.map((g, i) => (
        <line key={i} geometry={g}><lineBasicMaterial color="#3a2a1e" /></line>
      ))}
      {CORD_Z.flatMap((cz, i) => [-1, 1].map((sx) => (
        <mesh key={`${i}${sx}`} position={[COURT.x + sx * (HALF + 0.4), COURT.y + 2.6, COURT.z + cz]} material={poleM}>
          <cylinderGeometry args={[0.14, 0.18, 5.2, 6]} />
        </mesh>
      )))}
      {[-9, 0, 9].map((x, i) => (
        <pointLight key={x} ref={(el) => (lights.current[i] = el)} color="#ff9a4d" distance={22} decay={1.6}
          position={[COURT.x + x, COURT.y + 3.4, COURT.z + 7]} intensity={0} />
      ))}
    </>
  );
}
