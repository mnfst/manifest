import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

const backendPort = process.env.WINGMAN_BACKEND_PORT || '3001';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: Number(process.env.WINGMAN_PORT || 3002),
    proxy: {
      '/v1': `http://localhost:${backendPort}`,
      '/api': `http://localhost:${backendPort}`,
    },
  },
  build: {
    target: 'esnext',
  },
});
