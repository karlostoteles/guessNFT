import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  console.log('--- VITE BUILD ENV CHECK ---');
  console.log('VITE_SUPABASE_URL:', env.VITE_SUPABASE_URL ? 'PRESENT' : 'MISSING');
  console.log('--- END ENV CHECK ---');
  
  return {
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
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
    },
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
  };
})
