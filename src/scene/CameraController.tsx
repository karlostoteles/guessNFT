import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMERA } from '../utils/constants';
import { usePhase } from '../store/selectors';
import { GamePhase } from '../store/types';

export function CameraController() {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(...CAMERA.player1.position));
  const targetLookAt = useRef(new THREE.Vector3(...CAMERA.player1.lookAt));
  const currentLookAt = useRef(new THREE.Vector3(...CAMERA.player1.lookAt));
  const phase = usePhase();

  useFrame(() => {
    // Determine target camera based on phase
    if (phase === GamePhase.MENU) {
      targetPos.current.set(...CAMERA.overview.position);
      targetLookAt.current.set(...CAMERA.overview.lookAt);
    } else {
      targetPos.current.set(...CAMERA.player1.position);
      targetLookAt.current.set(...CAMERA.player1.lookAt);
    }

    // Lerp camera position
    camera.position.lerp(targetPos.current, 0.04);

    // Lerp lookAt
    currentLookAt.current.lerp(targetLookAt.current, 0.04);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}
