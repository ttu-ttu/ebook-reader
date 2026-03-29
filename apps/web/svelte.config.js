import adapter from '@sveltejs/adapter-static';
import preprocess from 'svelte-preprocess';
import { env } from 'node:process';

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
    paths: {
      base: env.NODE_ENV === 'production' ? '/ebook-reader' : ''
    }
  }
};

export default config;
