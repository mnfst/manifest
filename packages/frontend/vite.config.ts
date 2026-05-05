import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { codecovVitePlugin } from "@codecov/vite-plugin";

const manifestVersion = (() => {
  try {
    const pkg = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, "../manifest/package.json"),
        "utf-8",
      ),
    ) as { version?: string };
    return pkg.version ?? "";
  } catch {
    return "";
  }
})();

export default defineConfig({
  define: {
    __MANIFEST_VERSION__: JSON.stringify(manifestVersion),
  },
  plugins: [
    solidPlugin(),
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: "manifest-frontend",
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      "/api": `http://localhost:${process.env.VITE_BACKEND_PORT || "3001"}`,
      "/otlp": `http://localhost:${process.env.VITE_BACKEND_PORT || "3001"}`,
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/solid-js") || id.includes("node_modules/@solidjs/")) {
            return "vendor";
          }
          if (id.includes("node_modules/uplot")) {
            return "charts";
          }
          if (id.includes("node_modules/better-auth")) {
            return "auth";
          }
        },
      },
    },
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
        "src/components/SavingsChart.tsx",
        "src/components/Sparkline.tsx",
        "src/services/auth-client.ts",
      ],
    },
  },
});
