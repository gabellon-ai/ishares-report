import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
// @ts-ignore – works in v4
import tailwind from "@tailwindcss/postcss";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  css: {
    postcss: {
      plugins: [tailwind()],  // ← force Tailwind
    },
  },
});
