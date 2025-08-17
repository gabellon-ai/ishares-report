// vite.config.ts (or .js)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // base: '/'      // Vercel = '/', GitHub Pages would be '/ishares-report/'
});
