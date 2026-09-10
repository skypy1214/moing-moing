import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyRequest) => {
            // Vite is the browser's same-origin API gateway during local development.
            // Do not forward its Origin header to the backend's cross-origin policy.
            proxyRequest.removeHeader('origin')
          })
        },
        target: 'http://localhost:8080',
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
