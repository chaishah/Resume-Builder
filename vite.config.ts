import { defineConfig } from "vite";
const buildId = process.env.GITHUB_SHA || `local-${Date.now()}`;
export default defineConfig({
  define: { __APP_BUILD__: JSON.stringify(buildId) },
  plugins: [
    {
      name: "app-version",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify({ version: buildId }),
        });
      },
    },
  ],
  // esbuild handles JSX in both the UI and workers, without a window-only refresh runtime.
  esbuild: { jsx: "automatic" },
  base: process.env.VITE_BASE_PATH || "/Resume-Builder/",
  server: { host: "0.0.0.0", port: 4173, allowedHosts: ["terminal.local"] },
  worker: { format: "es" },
  build: { target: "es2022", chunkSizeWarningLimit: 1200 },
});
