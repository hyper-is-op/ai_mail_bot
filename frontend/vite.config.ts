import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 1947,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8024',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/ws': {
        target: 'ws://127.0.0.1:8024',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err: any) => {
            if (err?.code === 'ECONNRESET' || err?.code === 'ECONNREFUSED' || err?.message?.includes('socket hang up')) {
              return;
            }
            console.warn('[vite] ws proxy error:', err?.message || err);
          });
        }
      }
    }
  },
});