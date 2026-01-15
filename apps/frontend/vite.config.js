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
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:8788',
        changeOrigin: true,
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
