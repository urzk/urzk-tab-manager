import { resolve } from "node:path";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { manifestPlugin } from "./build/manifest-plugin.ts";

const svelteConfig = resolve(import.meta.dirname, "svelte.config.js");

// https://vitejs.dev/config/
export default defineConfig({
  root: "src",
  publicDir: "../public",
  base: "./",
  // root is src/, so point the Svelte plugin at the project's svelte.config.js
  plugins: [svelte({ configFile: svelteConfig }), manifestPlugin()],
  build: {
    target: "chrome104", // matches minimum_chrome_version
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        manager: resolve(import.meta.dirname, "src/manager/index.html"),
        "service-worker": resolve(
          import.meta.dirname,
          "src/background/service-worker.ts",
        ),
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
