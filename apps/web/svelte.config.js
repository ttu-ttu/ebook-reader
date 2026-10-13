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
        'base-uri': ['self'],
        // Book CSS is applied as is: no outside images, fonts or stylesheets to beacon to.
        // The image hosts are the covers "Find details" may save (lib/data/book-metadata.ts).
        'img-src': [
          'self',
          'blob:',
          'data:',
          'https://s4.anilist.co',
          'https://t.vndb.org',
          'https://cdn.jiten.moe'
        ],
        'font-src': ['self', 'blob:', 'data:'],
        'style-src': ['self', 'unsafe-inline']
      }
    }
  }
};

export default config;
