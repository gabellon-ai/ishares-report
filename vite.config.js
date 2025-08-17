// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/ishares-report/', // <-- repo name
  plugins: [react()],
})
