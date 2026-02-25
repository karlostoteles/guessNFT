import { BOARD } from '../utils/constants';

export function Board() {
  return (
    <group>
      {/* Main board surface */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[BOARD.width, BOARD.height, BOARD.depth]} />
        <meshStandardMaterial color={BOARD.color} roughness={0.75} />
      </mesh>

      {/* Raised border/frame */}
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[BOARD.width + 0.3, BOARD.height + 0.15, BOARD.depth + 0.3]} />
        <meshStandardMaterial color="#1e100a" roughness={0.8} />
      </mesh>

      {/* Felt surface on top */}
      <mesh position={[0, BOARD.height / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOARD.width - 0.4, BOARD.depth - 0.4]} />
        <meshStandardMaterial color="#1a3322" roughness={0.95} />
      </mesh>
    </group>
  );
}
