/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      boxShadow: {
        glow: "0 20px 60px rgba(17, 24, 39, 0.18)",
      },
    },
  },
  plugins: [],
}
