import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMERA, computeAdaptiveCamera } from '@/core/rules/constants';
import { usePhase, useGameCharacters, useActivePlayer, useEliminatedIds, useOnlinePlayerNum } from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';

export function CameraController() {
  const { camera } = useThree();
  const targetPos    = useRef(new THREE.Vector3(...CAMERA.overview.position));
  const targetLookAt = useRef(new THREE.Vector3(...CAMERA.overview.lookAt));
  const currentLookAt = useRef(new THREE.Vector3(...CAMERA.overview.lookAt));

  const phase         = usePhase();
  const characters    = useGameCharacters();
  const activePlayer  = useActivePlayer();
  const eliminatedIds = useEliminatedIds(activePlayer);
  const onlinePlayerNum = useOnlinePlayerNum();

  const isP2 = onlinePlayerNum === 2;

  useFrame(() => {
    if (phase === GamePhase.MENU) {
      targetPos.current.set(...CAMERA.overview.position);
      targetLookAt.current.set(...CAMERA.overview.lookAt);
    } else {
      // Adaptive: zoom in as tiles shrink
      const activeCount = Math.max(1, characters.length - eliminatedIds.length);
      const cam = computeAdaptiveCamera(activeCount);
      // P2: slight Y offset — board is rotated 180° on Y, tilt makes the
      // perspective slightly different from P2's side
      const yOffset = isP2 ? -0.8 : 0;
      targetPos.current.set(cam.position[0], cam.position[1] + yOffset, cam.position[2]);
      targetLookAt.current.set(...cam.lookAt);
    }

    // Smooth lerp — slightly slower for dramatic zoom-in effect
    camera.position.lerp(targetPos.current, 0.035);
    currentLookAt.current.lerp(targetLookAt.current, 0.035);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}
