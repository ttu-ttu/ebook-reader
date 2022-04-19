import adapter from '@sveltejs/adapter-static';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    immutable: true
  },

  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors
  preprocess: [
    preprocess({
      postcss: true
    })
  ],

  kit: {
    adapter: adapter({
      fallback: '404.html'
    }),
    prerender: {
      default: true
    },
    vite: {
      ssr: {
        // https://github.com/FortAwesome/Font-Awesome/issues/18677
        noExternal: ['@fortawesome/*']
      }
    }
  },

  experimental: {
    prebundleSvelteLibraries: true
  }
};

export default config;
