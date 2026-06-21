/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d7fe',
          300: '#a5bafc',
          400: '#8098f9',
          500: '#6172f3',
          600: '#4a4de7',
          700: '#3c3ccc',
          800: '#3235a5',
          900: '#2e3382',
        },
        surface: {
          DEFAULT: '#0f1117',
          1: '#161b27',
          2: '#1e2435',
          3: '#252d40',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'serif'],
      }
    },
  },
  plugins: [],
}
