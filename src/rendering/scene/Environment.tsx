export function Environment() {
  return (
    <>
      <color attach="background" args={['#0f0e17']} />
      <fog attach="fog" args={['#0f0e17', 20, 40]} />

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.3}
        castShadow
      />
      <pointLight position={[-5, 3, -5]} intensity={0.4} color="#4488ff" />
      <pointLight position={[6, 2, 3]} intensity={0.2} color="#ff8844" />
    </>
  );
}
