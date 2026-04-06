/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { primary: '#4F46E5', 'primary-hover': '#4338CA' }
    },
  },
  plugins: [],
}