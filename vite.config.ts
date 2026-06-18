import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:3001'
const dockerDev = process.env.VITE_DOCKER_DEV === 'true'
const usePolling = dockerDev || process.env.CHOKIDAR_USEPOLLING === 'true'
const pollInterval = Number(process.env.CHOKIDAR_INTERVAL ?? 250)
const hmrClientPort = Number(process.env.VITE_HMR_CLIENT_PORT ?? 5173)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: usePolling
      ? {
          usePolling: true,
          interval: Number.isFinite(pollInterval) ? pollInterval : 250,
        }
      : undefined,
    hmr: dockerDev
      ? {
          host: process.env.VITE_HMR_HOST ?? 'localhost',
          clientPort: Number.isFinite(hmrClientPort) ? hmrClientPort : 5173,
        }
      : undefined,
    proxy: {
      '/api': apiProxyTarget,
    },
  },
})
