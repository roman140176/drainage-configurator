import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// /api проксируем на json-server, чтобы фронт не знал его порт
export default defineConfig({
  plugins: [react()],
  // antd сам по себе весит около мегабайта, для демо это нормально
  build: { chunkSizeWarningLimit: 1300 },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
