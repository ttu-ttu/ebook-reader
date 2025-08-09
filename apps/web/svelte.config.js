import adapter from '@sveltejs/adapter-static';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    compilerOptions: {
        immutable: true
    },

    // Use svelte-preprocess with postcss, as configured in your project
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
            // Set the base path to your repository name
            base: process.env.NODE_ENV === 'production' ? '/korean-ebook-reader' : ''
        }
    }
};

export default config;