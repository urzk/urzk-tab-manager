import { resolve } from "node:path";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { manifestPlugin } from "./build/manifest-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  root: "src",
  publicDir: "../public",
  base: "./",
  plugins: [svelte(), manifestPlugin()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        newtab: resolve(__dirname, "src/newtab/index.html"),
        "service-worker": resolve(__dirname, "src/background/service-worker.ts"),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "service-worker"
            ? "service-worker.js"
            : "assets/[name]-[hash].js",
      },
    },
  },
});
