import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BOUNDS, COURT, PATH_LENGTH, pathAt } from '../../shared/path.js';
import { groundY, pathDist, mulberry } from '../terrain.js';
import { mat } from './geo.js';
import { glowMats } from './Temple.jsx';
import { sky } from '../time.js';

function paint(geo, r, g, b) {
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
function moved(geo, y) { geo.translate(0, y, 0); return geo.toNonIndexed(); }

function makePine() {
  const parts = [
    paint(moved(new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6), 1.2), 0.36, 0.25, 0.18),
    paint(moved(new THREE.ConeGeometry(1.5, 2.6, 7), 3.0), 0.2, 0.34, 0.2),
    paint(moved(new THREE.ConeGeometry(1.15, 2.3, 7), 4.4), 0.22, 0.38, 0.22),
    paint(moved(new THREE.ConeGeometry(0.8, 2.0, 7), 5.7), 0.25, 0.42, 0.24),
  ];
  return mergeGeometries(parts);
}
function makeBroadleaf() {
  const parts = [
    paint(moved(new THREE.CylinderGeometry(0.16, 0.26, 2.2, 6), 1.1), 0.38, 0.28, 0.2),
    paint(moved(new THREE.IcosahedronGeometry(1.8, 0), 3.6), 1, 1, 1),
    paint(moved(new THREE.IcosahedronGeometry(1.3, 0), 4.6), 1, 1, 1),
  ];
  return mergeGeometries(parts);
}

const MAPLE = ['#d9531e', '#e8742a', '#c23a1c', '#f0a030', '#e2b52f', '#b8452a'];

function Forest() {
  const refs = { pine: useRef(), leaf: useRef() };
  const { pines, leaves } = useMemo(() => {
    const rnd = mulberry(7);
    const pines = [], leaves = [];
    let tries = 0;
    while (pines.length + leaves.length < 1500 && tries++ < 12000) {
      const x = BOUNDS.minX + 4 + rnd() * (BOUNDS.maxX - BOUNDS.minX - 8);
      const z = BOUNDS.minZ + 4 + rnd() * (BOUNDS.maxZ - BOUNDS.minZ - 8);
      const d = pathDist(x, z);
      const dc = Math.hypot(x - COURT.x, z - COURT.z);
      if (d < 5 || dc < COURT.r + 3) continue;
      if (Math.hypot(x - COURT.x, z - COURT.z) < COURT.r + 8 && rnd() < 0.5) continue;
      const near = Math.min(1, d / 14);
      if (rnd() > 0.35 + 0.65 * near) continue; // 길가는 성기게
      const item = { x, z, y: groundY(x, z) - 0.1, s: 0.8 + rnd() * 0.9, ry: rnd() * 6.28, c: new THREE.Color(MAPLE[Math.floor(rnd() * MAPLE.length)]) };
      (rnd() < 0.62 ? pines : leaves).push(item);
    }
    return { pines, leaves };
  }, []);
  const pineGeo = useMemo(makePine, []);
  const leafGeo = useMemo(makeBroadleaf, []);
  const m = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }), []);
  useEffect(() => {
    const o = new THREE.Object3D();
    const fill = (mesh, list, tint) => {
      list.forEach((t, i) => {
        o.position.set(t.x, t.y, t.z); o.rotation.set(0, t.ry, 0); o.scale.setScalar(t.s); o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
        mesh.setColorAt(i, tint ? t.c : new THREE.Color().setHSL(0.3, 0.1, 0.85 + (i % 5) * 0.03));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    fill(refs.pine.current, pines, false);
    fill(refs.leaf.current, leaves, true);
  }, [pines, leaves]);
  return (
    <>
      <instancedMesh ref={refs.pine} args={[pineGeo, m, pines.length]} frustumCulled={false} />
      <instancedMesh ref={refs.leaf} args={[leafGeo, m, leaves.length]} frustumCulled={false} />
    </>
  );
}

function Rocks() {
  const ref = useRef();
  const list = useMemo(() => {
    const rnd = mulberry(21), out = [];
    for (let i = 0; i < 400 && out.length < 160; i++) {
      const s = rnd() * PATH_LENGTH, p = pathAt(s);
      const off = (rnd() < 0.5 ? -1 : 1) * (3.2 + rnd() * 9);
      const x = p.x - p.tz * off, z = p.z + p.tx * off;
      out.push({ x, z, y: groundY(x, z), s: 0.3 + rnd() * rnd() * 1.6, ry: rnd() * 6 });
    }
    return out;
  }, []);
  useEffect(() => {
    const o = new THREE.Object3D();
    list.forEach((t, i) => {
      o.position.set(t.x, t.y + t.s * 0.2, t.z); o.rotation.set(0, t.ry, 0); o.scale.set(t.s * 1.2, t.s * 0.8, t.s); o.updateMatrix();
      ref.current.setMatrixAt(i, o.matrix);
      ref.current.setColorAt(i, new THREE.Color().setHSL(0.1, 0.05, 0.38 + (i % 7) * 0.025));
    });
    ref.current.instanceMatrix.needsUpdate = true; ref.current.instanceColor.needsUpdate = true;
  }, [list]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, list.length]} frustumCulled={false}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial flatShading roughness={1} />
    </instancedMesh>
  );
}

function SignBoard({ text, sub }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#e8d3a2'; g.fillRect(0, 0, 512, 160);
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 8; g.strokeRect(6, 6, 500, 148);
    g.fillStyle = '#3b2616'; g.textAlign = 'center';
    g.font = 'bold 54px "Noto Serif KR","Nanum Myeongjo",serif,sans-serif'; g.fillText(text, 256, 78);
    g.font = '30px "Noto Sans KR","Malgun Gothic",sans-serif'; g.fillStyle = '#6b4a2a'; g.fillText(sub, 256, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }, [text, sub]);
  return (
    <mesh position={[0, 1.75, 0.06]}>
      <planeGeometry args={[1.6, 0.5]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

function Signs() {
  const woodM = useMemo(() => mat('#6b4a2a'), []);
  const signs = useMemo(() => [55, 150, 250, 350, 440].map((s, i) => {
    const p = pathAt(s);
    const x = p.x + p.tz * 2.6, z = p.z - p.tx * 2.6;
    return { x, z, y: groundY(x, z), ry: Math.atan2(-p.tx, -p.tz), s, i };
  }), []);
  return signs.map((t) => (
    <group key={t.i} position={[t.x, t.y, t.z]} rotation={[0, t.ry, 0]}>
      <mesh position={[0, 1.1, -0.12]} material={woodM}><boxGeometry args={[0.16, 2.2, 0.16]} /></mesh>
      <mesh position={[0, 1.75, 0]} material={woodM}><boxGeometry args={[1.8, 0.7, 0.1]} /></mesh>
      <SignBoard text={`대웅전 ${Math.round(PATH_LENGTH - t.s)}m`} sub={`고요사 ${Math.round((t.s / PATH_LENGTH) * 100)}%`} />
    </group>
  ));
}

function StoneLamps() {
  const base = useMemo(() => mat('#9a968c'), []);
  const spots = useMemo(() => {
    const out = [];
    for (let s = 40, i = 0; s < PATH_LENGTH - 20; s += 42, i++) {
      const p = pathAt(s), side = i % 2 ? 1 : -1;
      const x = p.x - p.tz * 2.9 * side, z = p.z + p.tx * 2.9 * side;
      out.push({ x, z, y: groundY(x, z), i });
    }
    return out;
  }, []);
  return spots.map((t) => (
    <group key={t.i} position={[t.x, t.y, t.z]}>
      <mesh position={[0, 0.12, 0]} material={base}><boxGeometry args={[0.7, 0.24, 0.7]} /></mesh>
      <mesh position={[0, 0.65, 0]} material={base}><cylinderGeometry args={[0.13, 0.17, 0.8, 6]} /></mesh>
      <mesh position={[0, 1.3, 0]} material={glowMats.stoneLamp}><boxGeometry args={[0.5, 0.5, 0.5]} /></mesh>
      <mesh position={[0, 1.78, 0]} material={base}><coneGeometry args={[0.55, 0.4, 4]} /></mesh>
      <mesh position={[0, 2.05, 0]} material={base}><sphereGeometry args={[0.1, 6, 4]} /></mesh>
    </group>
  ));
}

/** 먼 산 (안개 속 실루엣) */
function Mountains() {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5b6a5f', flatShading: true, roughness: 1 }), []);
  const list = useMemo(() => {
    const rnd = mulberry(99), out = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rnd() * 0.2;
      const r = 230 + rnd() * 70;
      out.push({ x: Math.cos(a) * r * 1.0, z: -40 + Math.sin(a) * r * 1.3, h: 70 + rnd() * 90, w: 60 + rnd() * 50 });
    }
    return out;
  }, []);
  return list.map((t, i) => (
    <mesh key={i} position={[t.x, t.h / 2 - 10, t.z]} material={m}>
      <coneGeometry args={[t.w, t.h, 6]} />
    </mesh>
  ));
}

function Stars() {
  const ref = useRef();
  const geo = useMemo(() => {
    const rnd = mulberry(5), pos = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, y = 0.15 + rnd() * 0.85, r = Math.sqrt(1 - y * y);
      pos[i * 3] = Math.cos(a) * r * 420; pos[i * 3 + 1] = y * 420; pos[i * 3 + 2] = Math.sin(a) * r * 420;
      void u;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return g;
  }, []);
  useFrame(({ camera }) => {
    ref.current.material.opacity = Math.max(0, sky.night - 0.35) * 1.4;
    ref.current.position.copy(camera.position);
  });
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial color="#ffffff" size={2.2} sizeAttenuation={false} transparent depthWrite={false} fog={false} />
    </points>
  );
}

export default function Scenery() {
  return (<><Forest /><Rocks /><Signs /><StoneLamps /><Mountains /><Stars /></>);
}
