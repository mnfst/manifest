import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { readFileSync } from "fs";
import { resolve } from "path";

function getBackendPort(): string {
  if (process.env.VITE_BACKEND_PORT) return process.env.VITE_BACKEND_PORT;
  try {
    const env = readFileSync(resolve(__dirname, "../backend/.env"), "utf-8");
    const match = env.match(/^PORT=(\d+)/m);
    if (match) return match[1];
  } catch {}
  return "3001";
}

const backendPort = getBackendPort();

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3000,
    proxy: {
      "/api": `http://localhost:${backendPort}`,
      "/otlp": `http://localhost:${backendPort}`,
    },
  },
  build: {
    target: "esnext",
  },
});
