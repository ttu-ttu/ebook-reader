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
    require('@tailwindcss/forms'),
    plugin(({ addUtilities }) => {
      addUtilities(require('./tailwindcss/material-elevation.cjs'));
    })
  ],
  safelist: [
    {
      pattern: /grid-cols-(2|3)/,
      variants: ['md']
    },
    'animate-[pulse_0.5s_cubic-bezier(0.4,0,0.6,1)_1]',
    'animate-[pulse_1s_cubic-bezier(0.4,0,0.6,1)_infinite]'
  ]
};

module.exports = config;
