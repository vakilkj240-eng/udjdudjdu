import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/gb-admin/' : '/',
  server: {
    host: '0.0.0.0',
    port: 3001,
    allowedHosts: 'all',
    proxy: {
      '/admin/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
}))
