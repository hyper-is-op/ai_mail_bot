import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
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
        target: 'http://172.16.3.215:8024',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/ws': {
        target: 'ws://172.16.3.215:8024',
        ws: true,
        changeOrigin: true
      }
    }
  },
});