import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the built dist/ can be served from any path; the collector
// serves it from its own root at :8792.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    // `npm run dev` against a local collector: proxy the API, the rest is Vite.
    proxy: {
      '/api': 'http://127.0.0.1:8792',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // keep the bundle inspectable; the console is a single view
    chunkSizeWarningLimit: 900,
  },
})
