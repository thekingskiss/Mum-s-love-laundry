/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f4413b',
          500: '#eb1c1c',
          600: '#cc1414',
          700: '#a30f0f',
          800: '#7a0c0c',
          900: '#560808',
        },
        ink: {
          900: '#0f172a',
          800: '#1e293b',
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 10px 30px -10px rgba(15, 23, 42, 0.15)',
      },
    },
  },
  plugins: [],
};
