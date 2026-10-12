import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// Unit tests (`pnpm test`); see CONTRIBUTING.md for running them without Node.js.
export default defineConfig({
  plugins: [sveltekit()],
  // Svelte's browser build, so component tests run onMount and updates.
  resolve: { conditions: ['browser'] },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'jsdom'
  }
});
