import { useState, Suspense, Component, ReactNode, ErrorInfo } from 'react';
import { Canvas } from '@react-three/fiber';
import { GameScene } from './scene/GameScene';
import { UIOverlay } from './ui/UIOverlay';

// Error boundary — renders HTML error outside the canvas
class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div style={{ color: '#ff4444', padding: 40, fontFamily: 'monospace', whiteSpace: 'pre-wrap', background: '#111' }}>
            <h2>Render Error</h2>
            <p>{this.state.error.message}</p>
            <pre style={{ fontSize: 12, opacity: 0.6 }}>{this.state.error.stack}</pre>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

function TestCube() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} />
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="red" />
      </mesh>
    </>
  );
}

export default function App() {
  const [showFull, setShowFull] = useState(true);
  const [canvasError, setCanvasError] = useState<string | null>(null);

  return (
    <ErrorBoundary>
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        {/* Debug toggle */}
        <div style={{ position: 'fixed', top: 8, right: 8, zIndex: 9999 }}>
          <button
            onClick={() => { setShowFull(f => !f); setCanvasError(null); }}
            style={{ padding: '8px 16px', background: '#333', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            {showFull ? 'Show Test Cube' : 'Show Full Game'}
          </button>
        </div>

        {/* Show canvas errors as HTML overlay */}
        {canvasError && (
          <div style={{
            position: 'fixed', top: 60, left: 20, right: 20, zIndex: 9999,
            background: '#220000', border: '1px solid #ff4444', borderRadius: 8,
            padding: 16, color: '#ff6666', fontFamily: 'monospace', fontSize: 13,
            whiteSpace: 'pre-wrap', maxHeight: '50vh', overflow: 'auto'
          }}>
            <strong>Canvas Error:</strong> {canvasError}
          </div>
        )}

        <Canvas
          shadows
          camera={{ fov: 45, near: 0.1, far: 100, position: [0, 12, 14] }}
          style={{ background: '#0f0e17' }}
          onCreated={() => console.log('[R3F] Canvas created OK')}
          onError={(e) => {
            console.error('[Canvas error]', e);
            setCanvasError(String(e));
          }}
        >
          {showFull ? (
            <Suspense fallback={<TestCube />}>
              <GameScene />
            </Suspense>
          ) : (
            <TestCube />
          )}
        </Canvas>

        {showFull && (
          <ErrorBoundary>
            <UIOverlay />
          </ErrorBoundary>
        )}
      </div>
    </ErrorBoundary>
  );
}
