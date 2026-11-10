import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { me, remote } from '../store.js';
import { input } from '../controls.js';
import { groundY, walkable, pathDist, progressAt } from '../terrain.js';
import { COURT, PATH_LENGTH, pathAt } from '../../shared/path.js';
import { footstep } from '../audio.js';

const PALETTE = ['#ffd9b0', '#cfe8ff', '#e6d1ff', '#d4f5c9', '#ffd0d8', '#fff0a8', '#c9f0f0', '#f6c9a8'];

function Figure({ color, ghost = false }) {
  const body = useMemo(() => new THREE.MeshStandardMaterial({
    color, roughness: 0.9, flatShading: true, transparent: ghost, opacity: ghost ? 0.62 : 1, depthWrite: !ghost,
    emissive: color, emissiveIntensity: ghost ? 0.18 : 0.05,
  }), [color, ghost]);
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2d3b5', roughness: 1, flatShading: true, transparent: ghost, opacity: ghost ? 0.7 : 1, depthWrite: !ghost }), [ghost]);
  const hat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 1, flatShading: true, transparent: ghost, opacity: ghost ? 0.7 : 1, depthWrite: !ghost }), [ghost]);
  return (
    <group>
      <mesh position={[0, 0.62, 0]} material={body}><coneGeometry args={[0.42, 1.24, 8]} /></mesh>
      <mesh position={[0, 1.38, 0]} material={skin}><sphereGeometry args={[0.2, 10, 8]} /></mesh>
      <mesh position={[0, 1.56, 0]} material={hat}><cylinderGeometry args={[0.3, 0.3, 0.05, 10]} /></mesh>
      <mesh position={[0, 1.63, 0]} material={hat}><cylinderGeometry args={[0.13, 0.17, 0.12, 10]} /></mesh>
      {/* 걷는 방향 표시 (앞쪽 작은 보따리) */}
      <mesh position={[0, 0.85, -0.28]} material={hat}><boxGeometry args={[0.28, 0.34, 0.14]} /></mesh>
    </group>
  );
}

export function LocalPlayer() {
  const g = useRef();
  const stepAcc = useRef(0), progT = useRef(0);
  const init = useRef(false);
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (!init.current) {
      const p = pathAt(2);
      me.x = p.x; me.z = p.z; input.yaw = Math.atan2(-p.tx, -p.tz); init.current = true;
    }
    // 입력 → 월드 이동 방향 (카메라 기준)
    const fx = -Math.sin(input.yaw), fz = -Math.cos(input.yaw);
    const rx = Math.cos(input.yaw), rz = -Math.sin(input.yaw);
    let ix = input.x, iy = input.y;
    const mag = Math.min(1, Math.hypot(ix, iy));
    let moving = mag > 0.05;
    if (moving) {
      const dx = (fx * iy + rx * ix) / (Math.hypot(ix, iy) || 1), dz = (fz * iy + rz * ix) / (Math.hypot(ix, iy) || 1);
      const speed = (input.run ? 3.6 : 1.9) * mag;
      const nx = me.x + dx * speed * dt, nz = me.z + dz * speed * dt;
      let moved = 0;
      if (walkable(nx, nz)) { moved = Math.hypot(nx - me.x, nz - me.z); me.x = nx; me.z = nz; }
      else if (walkable(nx, me.z)) { moved = Math.abs(nx - me.x); me.x = nx; }
      else if (walkable(me.x, nz)) { moved = Math.abs(nz - me.z); me.z = nz; }
      else moving = false;
      // 방향 부드럽게 회전
      const target = Math.atan2(dx, dz);
      let diff = target - me.r;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      me.r += diff * Math.min(1, dt * 10);
      stepAcc.current += moved;
      if (stepAcc.current > 1.15) { stepAcc.current = 0; footstep(me.inCourt); }
    }
    me.moving = moving;
    const gy = groundY(me.x, me.z);
    me.y += (gy - me.y) * Math.min(1, dt * 14);
    if (Math.abs(gy - me.y) > 3) me.y = gy;

    progT.current -= dt;
    if (progT.current <= 0) {
      progT.current = 0.2;
      me.s = progressAt(me.x, me.z); me.dPath = pathDist(me.x, me.z);
      me.inCourt = Math.hypot(me.x - COURT.x, me.z - COURT.z) < COURT.r + 2;
    }

    const bob = moving ? Math.sin(state.clock.elapsedTime * 9) * 0.04 : 0;
    g.current.position.set(me.x, me.y + bob, me.z);
    g.current.rotation.y = me.r;

    // 3인칭 카메라
    const cp = Math.cos(input.pitch), sp = Math.sin(input.pitch);
    const cx = me.x + Math.sin(input.yaw) * cp * input.dist;
    const cz = me.z + Math.cos(input.yaw) * cp * input.dist;
    let cy = me.y + 1.5 + sp * input.dist;
    cy = Math.max(cy, groundY(cx, cz) + 0.8);
    const cam = state.camera;
    const k = 1 - Math.exp(-dt * 12);
    cam.position.x += (cx - cam.position.x) * k; cam.position.y += (cy - cam.position.y) * k; cam.position.z += (cz - cam.position.z) * k;
    cam.lookAt(me.x, me.y + 1.4, me.z);
  });
  return <group ref={g}><Figure color="#fff4e0" /></group>;
}

function Remote({ id }) {
  const g = useRef();
  const color = PALETTE[id % PALETTE.length];
  useFrame((state, rawDt) => {
    const p = remote.get(id);
    if (!p) return;
    const dt = Math.min(rawDt, 0.1), k = 1 - Math.exp(-dt * 9);
    p.x += (p.tx - p.x) * k; p.z += (p.tz - p.z) * k;
    let d = p.tr - p.r; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    p.r += d * k;
    const bob = p.moving ? Math.sin(state.clock.elapsedTime * 9 + id) * 0.04 : 0;
    g.current.position.set(p.x, groundY(p.x, p.z) + bob, p.z);
    g.current.rotation.y = p.r;
  });
  return <group ref={g}><Figure color={color} ghost /></group>;
}

export function Remotes({ ids }) {
  return ids.map((id) => <Remote key={id} id={id} />);
}
export { PATH_LENGTH };
