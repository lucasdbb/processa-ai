/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'warm-bg': '#fffaf6',
        primary: {
          50: '#e8f0f7',
          100: '#c3d8e8',
          200: '#9abfd8',
          300: '#71a5c8',
          400: '#5391bc',
          500: '#357db0',
          600: '#2f6fa1',
          700: '#265c8a',
          800: '#1e4a73',
          900: '#123365',
        },
        secondary: {
          50: '#faf8f0',
          100: '#f3efd9',
          200: '#ebe4bf',
          300: '#e3d9a5',
          400: '#ddd192',
          500: '#d7c87f',
          600: '#d3c277',
          700: '#cdbb6c',
          800: '#c7b462',
          900: '#a88e3e',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}