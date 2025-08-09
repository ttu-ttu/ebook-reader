import adapter from '@sveltejs/adapter-static';
import preprocess from 'svelte-preprocess';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    compilerOptions: {
        immutable: true
    },

    preprocess: [
        preprocess({
            postcss: true
        }),
        vitePreprocess()
    ],

    kit: {
        adapter: adapter({
            fallback: '404.html'
        }),
        paths: {
            // Add your repository name as the base path.
            // This is crucial for GitHub Pages to resolve your links correctly.
            base: process.env.NODE_ENV === 'production' ? '/korean-ebook-reader' : ''
        }
    }
};

export default config;