import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // KaTeX is only imported by the lazily loaded study session. Without this, the dev server discovers
  // it the first time a set opens and reloads the whole page, dropping the student back on Calendar.
  optimizeDeps: { include: ['katex'] },
  server: {
    proxy: {
      // The feed helper (server/) runs on 8787 in development.
      '/api': 'http://localhost:8787',
    },
  },
})
