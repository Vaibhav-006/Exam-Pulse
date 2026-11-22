/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#1A1D26',
          soft: '#222632',
          border: 'rgba(255,255,255,0.06)',
        },
      },
      backgroundOpacity: {
        8: '0.08',
      }
    },
  },
  plugins: [],
}
