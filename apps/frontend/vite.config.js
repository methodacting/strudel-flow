import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'url';
import process from 'node:process';

// https://vitejs.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(fileURLToPath(new URL('.', import.meta.url)), 'src'),
    },
  },
  base:
    process.env.VERCEL_ENV === 'production'
      ? 'https://flow-machine-xyflow.vercel.app/'
      : '/',
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'https://backend.strudel-flow.localhost',
        changeOrigin: true,
        secure: false,
      },
      '/auth': {
        target: process.env.VITE_BACKEND_URL || 'https://backend.strudel-flow.localhost',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@strudel')) return 'strudel';
          if (id.includes('@xyflow')) return 'xyflow';
          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('react')) return 'react';
          return 'vendor';
        },
      },
    },
  },
}));
