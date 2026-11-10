import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COURT, PATH_LENGTH, pathAt } from '../../shared/path.js';
import { groundY } from '../terrain.js';
import { frustumGeo, mat } from './geo.js';
import { sky } from '../time.js';

const C = {
  stone: '#aaa59a', stoneDark: '#8c887e', wood: '#8e2f22', woodDark: '#5d1f17', tan: '#c9a56a', cream: '#e8dcc0',
  roof: '#3f434b', green: '#2f7a5b', blue: '#2a5d9a', yellow: '#d9a441', red: '#b83a2a', bronze: '#7a6a3a',
};
const dancheong = [C.green, C.red, C.blue, C.yellow];

// 밤에 은은히 빛나는 창호 / 석등 재질 (여러 곳에서 공유)
export const glowMats = {
  door: new THREE.MeshStandardMaterial({ color: C.tan, emissive: '#ffb15a', emissiveIntensity: 0, roughness: 0.9, flatShading: true }),
  stoneLamp: new THREE.MeshStandardMaterial({ color: '#d9c9a0', emissive: '#ffb050', emissiveIntensity: 0, roughness: 0.9, flatShading: true }),
};

function Box({ p = [0, 0, 0], s = [1, 1, 1], c = C.stone, m, rot }) {
  const material = useMemo(() => m || mat(c), [m, c]);
  return <mesh position={p} rotation={rot} material={material}><boxGeometry args={s} /></mesh>;
}
function Cyl({ p = [0, 0, 0], r = 0.3, rb, h = 1, c = C.wood, seg = 10 }) {
  const material = useMemo(() => mat(c), [c]);
  return <mesh position={p} material={material}><cylinderGeometry args={[r, rb ?? r, h, seg]} /></mesh>;
}
function Roof({ p = [0, 0, 0], w, d, tw, td, h, c = C.roof }) {
  const geo = useMemo(() => frustumGeo(w, d, tw, td, h), [w, d, tw, td, h]);
  const material = useMemo(() => mat(c, { side: THREE.DoubleSide }), [c]);
  return (
    <group position={p}>
      <mesh geometry={geo} material={material} />
      {/* 처마 끝 들림 */}
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (w / 2 - 0.3), 0.25, sz * (d / 2 - 0.3)]} rotation={[sz * -0.35, 0, sx * 0.35]} material={material}>
          <coneGeometry args={[Math.min(0.3, w * 0.05), Math.min(0.9, w * 0.12), 4]} />
        </mesh>
      ))}
    </group>
  );
}
/** 단청 띠 */
function Dancheong({ p, width, y = 0, z = 0 }) {
  const n = Math.round(width / 1.6);
  return (
    <group position={p}>
      {Array.from({ length: n }, (_, i) => (
        <Box key={i} p={[-width / 2 + (i + 0.5) * (width / n), y, z]} s={[width / n, 0.55, 0.5]} c={dancheong[i % 4]} />
      ))}
    </group>
  );
}

function Hall() {
  const cols = [-9, -5.4, -1.8, 1.8, 5.4, 9];
  return (
    <group>
      <Box p={[0, 0.5, 0]} s={[25, 1, 14]} c={C.stone} />
      <Box p={[0, 0.25, 8]} s={[7, 0.5, 2.4]} c={C.stoneDark} />
      <Box p={[0, 0.125, 9.4]} s={[8, 0.25, 1]} c={C.stone} />
      {cols.map((x) => <Cyl key={'f' + x} p={[x, 3.2, 4.2]} r={0.34} h={4.4} c={C.wood} />)}
      {cols.map((x) => <Cyl key={'b' + x} p={[x, 3.2, -4.6]} r={0.34} h={4.4} c={C.wood} />)}
      <Box p={[0, 3.2, -4.6]} s={[19, 4.4, 0.4]} c={C.cream} />
      <Box p={[-9.6, 3.2, -0.2]} s={[0.4, 4.4, 8.8]} c={C.cream} />
      <Box p={[9.6, 3.2, -0.2]} s={[0.4, 4.4, 8.8]} c={C.cream} />
      {[-7.2, -3.6, 0, 3.6, 7.2].map((x) => (
        <Box key={x} p={[x, 3.0, 4.2]} s={[3.1, 3.4, 0.2]} m={glowMats.door} />
      ))}
      <Box p={[0, 1.55, 4.15]} s={[19, 0.3, 0.35]} c={C.woodDark} />
      <Box p={[0, 5.1, 4.2]} s={[19.5, 0.35, 0.5]} c={C.woodDark} />
      <Dancheong p={[0, 5.5, 4.4]} width={19.5} />
      <Roof p={[0, 5.6, 0]} w={26} d={17.5} tw={14} td={2.2} h={5.2} />
      <Box p={[0, 11.0, 0]} s={[14.6, 0.35, 0.7]} c={C.roof} />
      {/* 편액 */}
      <Box p={[0, 5.9, 4.7]} s={[4, 0.9, 0.12]} c="#1d2a3a" />
      <Box p={[0, 5.9, 4.77]} s={[3.6, 0.5, 0.04]} c={C.yellow} />
    </group>
  );
}

function Pagoda() {
  return (
    <group>
      <Box p={[0, 0.3, 0]} s={[6.2, 0.6, 6.2]} c={C.stoneDark} />
      <Box p={[0, 0.9, 0]} s={[5.0, 0.6, 5.0]} c={C.stone} />
      {[0, 1, 2].map((i) => {
        const y = 1.2 + i * 2.2;
        const w = 2.8 - i * 0.5;
        return (
          <group key={i}>
            <Box p={[0, y + 0.8, 0]} s={[w, 1.6, w]} c={C.stone} />
            <Roof p={[0, y + 1.6, 0]} w={w + 2.2 - i * 0.2} d={w + 2.2 - i * 0.2} tw={w * 0.6} td={w * 0.6} h={0.55} c="#8d8a82" />
          </group>
        );
      })}
      <Cyl p={[0, 8.3, 0]} r={0.06} rb={0.1} h={1.8} c={C.stoneDark} />
      <mesh position={[0, 8.0, 0]} material={useMemo(() => mat(C.stone), [])}><sphereGeometry args={[0.28, 8, 6]} /></mesh>
    </group>
  );
}

function BellPavilion() {
  return (
    <group>
      <Box p={[0, 0.3, 0]} s={[7, 0.6, 7]} c={C.stone} />
      {[[-2.8, -2.8], [2.8, -2.8], [2.8, 2.8], [-2.8, 2.8]].map(([x, z], i) => <Cyl key={i} p={[x, 2.6, z]} r={0.25} h={4} c={C.wood} />)}
      <Box p={[0, 4.4, 0]} s={[6.2, 0.35, 0.4]} c={C.woodDark} />
      <Roof p={[0, 4.6, 0]} w={9} d={9} tw={3} td={3} h={2.3} />
      <Cyl p={[0, 3.0, 0]} r={0.55} rb={0.8} h={1.7} c={C.bronze} seg={14} />
      <Cyl p={[0, 4.0, 0]} r={0.08} h={0.6} c={C.woodDark} />
      <Box p={[3.2, 1.1, 0]} s={[0.3, 1, 2.6]} c={C.woodDark} />
    </group>
  );
}

/** 산길 위의 문. 열린 쪽이 길(진행 방향, 로컬 z축)을 향한다. */
function Gate({ s, wide = 6, big = false }) {
  const { x, z, tx, tz } = pathAt(s);
  const y = groundY(x, z);
  const rotY = Math.atan2(tx, tz);
  const pill = big ? [-wide, -wide / 3, wide / 3, wide] : [-wide / 2, wide / 2];
  const h = big ? 6 : 5;
  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      <Box p={[0, 0.2, 0]} s={[wide * 2.4 + 2, 0.4, 3.2]} c={C.stone} />
      {pill.map((px) => <Cyl key={px} p={[px, h / 2 + 0.4, 0]} r={big ? 0.42 : 0.36} h={h} c={C.wood} />)}
      <Box p={[0, h + 0.2, 0]} s={[wide * (big ? 2.2 : 1.4) + 1, 0.5, 0.7]} c={C.woodDark} />
      <Dancheong p={[0, h - 0.35, 0.1]} width={wide * (big ? 2.2 : 1.4) + 1} />
      <Roof p={[0, h + 0.45, 0]} w={wide * (big ? 2.7 : 1.9) + 2} d={big ? 6.4 : 4.6} tw={wide * (big ? 1.4 : 1.0)} td={1.0} h={big ? 2.6 : 2.0} />
      {!big && <Box p={[0, h - 1.6, 0]} s={[3.2, 0.9, 0.12]} c="#1d2a3a" />}
    </group>
  );
}

export default function Temple() {
  const cy = COURT.y;
  const lamp = useRef();
  useFrame(() => {
    const n = sky.night;
    glowMats.door.emissiveIntensity = n * 0.9;
    glowMats.stoneLamp.emissiveIntensity = n * 1.6;
  });
  return (
    <group ref={lamp}>
      <group position={[COURT.x, cy, COURT.z - 14]}><Hall /></group>
      <group position={[COURT.x, cy, COURT.z - 1]}><Pagoda /></group>
      <group position={[COURT.x - 15, cy, COURT.z - 8]}><BellPavilion /></group>
      <Gate s={12} wide={3} />
      <Gate s={PATH_LENGTH - 16} wide={4} big />
      {/* 마당 가장자리 은행나무 */}
      {[[-20, 10], [20, 12], [-22, -12], [22, -10]].map(([dx, dz], i) => (
        <group key={i} position={[COURT.x + dx, cy, COURT.z + dz]}>
          <Cyl p={[0, 2.2, 0]} r={0.35} rb={0.5} h={4.4} c="#5a4632" />
          <mesh position={[0, 6, 0]} material={mat(i % 2 ? '#e2b52f' : '#d9a52a')}><icosahedronGeometry args={[3.2, 0]} /></mesh>
          <mesh position={[0.8, 4.6, 0.6]} material={mat('#e8c23c')}><icosahedronGeometry args={[2.2, 0]} /></mesh>
        </group>
      ))}
    </group>
  );
}
