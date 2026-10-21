import dns from 'dns';
import { sveltekit } from '@sveltejs/kit/vite';

const nodeVersion = Number.parseInt(process.versions.node.match(/^(\d+)\./)?.[1] || '17', 10);

if (nodeVersion < 17) {
  dns.setDefaultResultOrder('verbatim');
}

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [sveltekit()],
  ssr: {
    // https://github.com/FortAwesome/Font-Awesome/issues/18677
    noExternal: ['@fortawesome/*', '@popperjs/*']
  },
  // O lindera carrega o próprio wasm; o pré-empacotamento do Vite quebra o caminho.
  optimizeDeps: {
    exclude: ['lindera-wasm-ipadic']
  },
  experimental: {
    prebundleSvelteLibraries: true
  },
  test: {
    include: ['src/**/*.test.ts', '../../supabase/functions/**/*.test.ts']
  }
};

export default config;
