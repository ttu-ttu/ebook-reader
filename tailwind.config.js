/* eslint-env es6 */
const plugin = require('tailwindcss/plugin');

module.exports = {
  content: ['./src/app/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans JP', 'sans-serif'],
        serif: ['Noto Serif JP', 'serif'],
      },
      height: {
        21: '5.25rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/line-clamp'),
    require('tailwindcss-elevation')(),
    plugin(function ({ addUtilities }) {
      const newUtilities = {
        '.elevation-transition': {
          transition: 'box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'box-shadow',
        },
      };

      addUtilities(newUtilities);
    }),
  ],
};
