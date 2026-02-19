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
});
