import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwind()],
  root: path.join(__dirname, "game"),
  build: {
    outDir: path.join(__dirname, "webroot"),
    emptyOutDir: true,
    copyPublicDir: true,
    sourcemap: true,
    assetsDir: "assets",
    // Use relative paths
    base: "./",
  },
});