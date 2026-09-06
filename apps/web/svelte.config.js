import process from 'node:process';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [vitePreprocess()],

  kit: {
    paths: {
      base: process.env.BASE_PATH || ''
    },
    adapter: adapter({
      fallback: '404.html'
    })
  }
};

export default config;
