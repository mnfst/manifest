import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { skybridge } from "skybridge/web";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [skybridge(), react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
