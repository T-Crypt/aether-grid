import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the built dist/ can be dropped behind nginx at any path,
// same as the static web/ it sits beside.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // keep the bundle inspectable; the console is a single view
    chunkSizeWarningLimit: 900,
  },
})
