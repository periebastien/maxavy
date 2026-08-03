import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      // Pages légales statiques servies par le backend (pas de route React)
      '/confidentialite': 'http://localhost:3000',
      '/cgu': 'http://localhost:3000',
      '/mentions-legales': 'http://localhost:3000'
    }
  }
})
