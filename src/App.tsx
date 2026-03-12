import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { GameScene } from '@/rendering/scene/GameScene';
import { UIOverlay } from '@/ui/UIOverlay';
import { ErrorBoundary } from '@/ui/common';

function LoadingFallback() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#E8A444" wireframe />
      </mesh>
    </>
  );
}

// Dark canvas fallback — shown when the 3D scene crashes.
// UIOverlay stays mounted so menus remain usable.
const canvasFallback = (
  <div style={{ width: '100%', height: '100%', background: '#0f0e17' }} />
);

export default function App() {
  return (
    <ErrorBoundary>
      <div style={{ width: '100%', height: '100%', position: 'relative', isolation: 'isolate' }}>
        <ErrorBoundary fallback={canvasFallback}>
          <Canvas
            shadows
            gl={{ powerPreference: 'high-performance', antialias: false }}
            dpr={[1, 1.5]}
            camera={{ fov: 45, near: 0.1, far: 100, position: [0, 12, 14] }}
            style={{ background: '#0f0e17', position: 'relative', zIndex: 0 }}
          >
            <Suspense fallback={<LoadingFallback />}>
              <GameScene />
            </Suspense>
          </Canvas>
        </ErrorBoundary>
        <UIOverlay />
      </div>
    </ErrorBoundary>
  );
}
