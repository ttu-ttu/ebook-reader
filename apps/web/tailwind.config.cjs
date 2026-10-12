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
      // Theme colours (lib/data/theme/theme-tokens.ts); components use these, never a palette.
      colors: {
        'background-color': 'var(--background-color)',
        fg: 'var(--font-color)',
        muted: 'var(--app-muted-fg)',
        subtle: 'var(--app-text-subtle)',
        line: 'var(--border-color)',
        surface: 'var(--surface-color)',
        'surface-strong': 'var(--surface-strong-color)',
        accent: 'var(--accent-color)',
        'accent-strong': 'var(--accent-strong-color)',
        danger: 'var(--app-danger-color)',
        success: 'var(--app-success-color)',
        warning: 'var(--app-warning-color)',
        overlay: 'var(--app-overlay-color)',
        hover: 'color-mix(in srgb, var(--font-color) 7%, transparent)',
        // Errors inside the dark reader panels
        'panel-danger': 'color-mix(in srgb, var(--app-danger-color) 55%, var(--reader-panel-fg))'
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
