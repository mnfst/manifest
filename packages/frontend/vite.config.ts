import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { codecovVitePlugin } from '@codecov/vite-plugin';

const manifestVersion = (() => {
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../manifest/package.json'), 'utf-8'),
    ) as { version?: string };
    return pkg.version ?? '';
  } catch {
    return '';
  }
})();

export default defineConfig(({ command }) => ({
  define: {
    __MANIFEST_VERSION__: JSON.stringify(manifestVersion),
    // The Wingman drawer and the orange "Dev" header badge are dev-only
    // affordances. They ship only when Vite runs in dev mode
    // (`vite serve`). Any production build — Docker self-hosted, Railway
    // cloud, anything else — gets `__DEV_MODE__ = false`, so esbuild
    // dead-code-eliminates the FAB, drawer, and badge.
    __DEV_MODE__: JSON.stringify(command === 'serve'),
    // Optional build-time override for the Wingman drawer; otherwise it
    // points at the hosted SPA at https://wingman.manifest.build.
    __WINGMAN_URL__: JSON.stringify(process.env.VITE_WINGMAN_URL || ''),
  },
  plugins: [
    solidPlugin(),
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: 'manifest-frontend',
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
  server: {
    port: 3000,
    // Disable Vite's built-in CORS handler. Otherwise it short-circuits
    // OPTIONS preflights for proxied paths (e.g. `/api`, `/v1`) and
    // strips the backend's headers — including
    // `Access-Control-Allow-Private-Network`, which Chrome's Private
    // Network Access enforcement now requires when the hosted Wingman
    // SPA (https://wingman.manifest.build) calls into a loopback dev
    // backend. The dashboard itself is same-origin, so it doesn't need
    // Vite's CORS at all.
    cors: false,
    proxy: {
      '/api': `http://localhost:${process.env.VITE_BACKEND_PORT || '3001'}`,
      '/otlp': `http://localhost:${process.env.VITE_BACKEND_PORT || '3001'}`,
      '/v1': `http://localhost:${process.env.VITE_BACKEND_PORT || '3001'}`,
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/solid-js') || id.includes('node_modules/@solidjs/')) {
            return 'vendor';
          }
          if (id.includes('node_modules/uplot')) {
            return 'charts';
          }
          if (id.includes('node_modules/better-auth')) {
            return 'auth';
          }
          // Syntax highlighting (highlight.js) is only pulled in by the
          // recorded-message viewer. Pin it to a stable named chunk so it
          // caches independently of the route chunks that lazy-load it.
          if (id.includes('node_modules/highlight.js')) {
            return 'syntax';
          }
          // Markdown rendering (marked + dompurify) is shared across the
          // few surfaces that render model output. A dedicated chunk keeps
          // its hash stable across route-chunk changes.
          if (id.includes('node_modules/marked') || id.includes('node_modules/dompurify')) {
            return 'markdown';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    transformMode: { web: [/\.[jt]sx?$/] },
    deps: {
      optimizer: { web: { include: ['solid-js'] } },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/index.tsx',
        'src/components/CostChart.tsx',
        'src/components/TokenChart.tsx',
        'src/components/SingleTokenChart.tsx',
        'src/components/SavingsChart.tsx',
        'src/components/Sparkline.tsx',
      ],
    },
  },
}));
