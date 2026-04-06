import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ["**/src-tauri/**"] } },
  build: {
    target: process.env.TAURI_PLATFORM == "windows" ? "chrome105" : "safari13",
    minify: "esbuild",
    outDir: "dist",
    chunkSizeWarningLimit: 3000,
  },
});