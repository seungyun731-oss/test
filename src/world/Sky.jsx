import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { evalSky, sharedPhase, sky } from '../time.js';
import { world } from '../store.js';

export default function Sky() {
  const sun = useRef(), hemi = useRef();
  const { scene } = useThree();
  if (!scene.fog) scene.fog = new THREE.Fog('#cfe6f0', 40, 200);
  if (!scene.background) scene.background = new THREE.Color('#8fcbf0');
  useFrame(({ camera }) => {
    const p = world.override ?? sharedPhase();
    world.phase = p;
    evalSky(p);
    world.night = sky.night;
    scene.background.copy(sky.sky);
    scene.fog.color.copy(sky.fog);
    scene.fog.near = 25 + (1 - sky.night) * 25;
    scene.fog.far = 150 + (1 - sky.night) * 70;
    sun.current.color.copy(sky.sun);
    sun.current.intensity = sky.sunI;
    sun.current.position.copy(camera.position).addScaledVector(sky.sunDir, 80);
    sun.current.target.position.copy(camera.position);
    sun.current.target.updateMatrixWorld();
    hemi.current.color.copy(sky.hemiSky);
    hemi.current.groundColor.copy(sky.hemiGround);
    hemi.current.intensity = sky.hemiI;
  });
  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight ref={sun} />
    </>
  );
}
