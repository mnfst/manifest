import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3000,
    proxy: {
      "/api": `http://localhost:${process.env.VITE_BACKEND_PORT || "3001"}`,
      "/otlp": `http://localhost:${process.env.VITE_BACKEND_PORT || "3001"}`,
    },
  },
  build: {
    target: "esnext",
  },
  test: {
    environment: "jsdom",
    globals: true,
    transformMode: { web: [/\.[jt]sx?$/] },
    deps: {
      optimizer: { web: { include: ["solid-js"] } },
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/index.tsx",
        "src/components/CostChart.tsx",
        "src/components/TokenChart.tsx",
        "src/components/SingleTokenChart.tsx",
        "src/components/Sparkline.tsx",
        "src/services/auth-client.ts",
      ],
    },
  },
});
