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
    // Not part of upstream: book HTML can come from other people (shared sync folder), so
    // only this site's own scripts may run: no inline handlers, no javascript: URLs.
    // SvelteKit adds the hash of its inline bootstrap script. Frames, images and
    // connections stay open (Yomitan's popup, covers, AI and cloud APIs).
    csp: {
      mode: 'hash',
      directives: {
        'script-src': ['self'],
        'worker-src': ['self', 'blob:'],
        'object-src': ['none'],
        'base-uri': ['self']
      }
    }
  }
};

export default config;
