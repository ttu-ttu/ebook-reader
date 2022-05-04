/* eslint-disable global-require */
const plugin = require('tailwindcss/plugin');

const config = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans JP', 'sans-serif'],
        serif: ['Noto Serif JP', 'serif']
      },
      colors: {
        'background-color': 'var(--background-color)'
      },
      spacing: {
        21: '5.25rem'
      },
      maxWidth: {
        '60vw': '60vw'
      }
    }
  },
  plugins: [
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/line-clamp'),
    require('@tailwindcss/forms'),
    plugin(({ addUtilities }) => {
      addUtilities(require('./tailwindcss/material-elevation.cjs'));
    })
  ],
  safelist: [
    {
      pattern: /grid-cols-(2|3)/,
      variants: ['md']
    }
  ]
};

module.exports = config;
