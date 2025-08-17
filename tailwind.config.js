// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],                                // ⬅️ for the theme toggle
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"], // ⬅️ includes TSX
  theme: { extend: {} },
  plugins: [require("tailwindcss-animate")],         // ok to omit if unused
};
