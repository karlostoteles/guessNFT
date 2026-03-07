import { Component, Suspense } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Canvas } from '@react-three/fiber';
import { GameScene } from './scene/GameScene';
import { UIOverlay } from './ui/UIOverlay';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[ErrorBoundary]', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#0f0e17', color: '#FCA5A5', padding: 32, fontFamily: 'monospace', zIndex: 9999, overflow: 'auto' }}>
          <h2 style={{ color: '#E8A444' }}>React Crash</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: 'rgba(255,255,254,0.4)' }}>{this.state.error.stack}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '8px 16px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

export default function App() {
  return (
    <ErrorBoundary>
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <Canvas
          shadows
          camera={{ fov: 45, near: 0.1, far: 100, position: [0, 12, 14] }}
          style={{ background: '#0f0e17' }}
        >
          <Suspense fallback={<LoadingFallback />}>
            <GameScene />
          </Suspense>
        </Canvas>
        <UIOverlay />
      </div>
    </ErrorBoundary>
  );
}
