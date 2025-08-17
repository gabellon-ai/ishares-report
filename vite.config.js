import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',                 // Vercel
  plugins: [react()],
  build: { sourcemap: true } // helps debug if anything breaks
})
