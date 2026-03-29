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
    prerender: {
      handleHttpError: ({ path, message }) => {
        // During prerendering, internal links prefixed with VITE_PAGE_PATH
        // (e.g. /ebook-reader/manage) appear as 404s to the crawler but are
        // valid routes at runtime. Ignore them.
        const pagePath = env.VITE_PAGE_PATH || '';
        if (pagePath && path.startsWith(pagePath)) {
          return;
        }
        throw new Error(message);
      }
    }
  }
};

export default config;
