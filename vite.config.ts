import { defineConfig } from "vite";
export default defineConfig({
  // esbuild handles JSX in both the UI and workers, without a window-only refresh runtime.
  esbuild: { jsx: "automatic" },
  base: process.env.VITE_BASE_PATH || "/Resume-Builder/",
  server: { host: "0.0.0.0", port: 4173, allowedHosts: ["terminal.local"] },
  worker: { format: "es" },
  build: { target: "es2022", chunkSizeWarningLimit: 1200 },
});
