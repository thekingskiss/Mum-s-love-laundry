// Colours read CSS variables (defined per theme in src/index.css) so the
// colour themes can repaint the app without changing component classes.
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const varScale = (name, shades = SHADES) =>
  Object.fromEntries(shades.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));
const semantic = (name) => ({
  DEFAULT: `rgb(var(--${name}) / <alpha-value>)`,
  soft: `rgb(var(--${name}-soft) / <alpha-value>)`,
  line: `rgb(var(--${name}-line) / <alpha-value>)`,
});

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: varScale('brand'),
        slate: varScale('slate'),
        ink: varScale('ink', [800, 900]),
        success: semantic('success'),
        warning: semantic('warning'),
        danger: semantic('danger'),
        info: semantic('info'),
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
