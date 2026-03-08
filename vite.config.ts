import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    dedupe: ['react', 'react-dom', '@react-three/fiber'],
  },
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'util'],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  define: {
    global: 'globalThis',
  },

  // COOP+COEP: required for SharedArrayBuffer (bb.js WASM multi-threading)
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/world.World': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },

  // @aztec/bb.js WASM breaks if Vite pre-bundles it
  optimizeDeps: {
    exclude: ['@aztec/bb.js'],
  },

  // Web Workers must use ES module format for top-level imports
  worker: { format: 'es' },

  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'cartridge': ['@cartridge/controller'],
          'starknet': ['starknet', 'starkzap'],
          'react-vendor': ['react', 'react-dom', 'framer-motion'],
        },
      },
    },
  },
})
