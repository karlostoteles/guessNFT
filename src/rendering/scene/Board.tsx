import { BOARD } from '@/core/rules/constants';

interface BoardProps {
  /** Dynamic width from the adaptive grid (defaults to BOARD.width) */
  width?: number;
  depth?: number;
}

export function Board({ width = BOARD.width, depth = BOARD.depth }: BoardProps) {
  // Add a little margin around the tile grid
  const w = Math.max(BOARD.width, width + 2.0);
  const d = Math.max(BOARD.depth, depth + 2.0);

  return (
    <group>
      {/* Main board surface */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[w, BOARD.height, d]} />
        <meshStandardMaterial color={BOARD.color} roughness={0.75} />
      </mesh>

      {/* Raised border/frame */}
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[w + 0.3, BOARD.height + 0.15, d + 0.3]} />
        <meshStandardMaterial color="#1e100a" roughness={0.8} />
      </mesh>

      {/* Felt surface on top */}
      <mesh position={[0, BOARD.height / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 0.4, d - 0.4]} />
        <meshStandardMaterial color="#1a3322" roughness={0.95} />
      </mesh>
    </group>
  );
}
