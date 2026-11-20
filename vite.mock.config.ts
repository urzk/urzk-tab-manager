import { resolve } from "node:path";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Demo page backed by the in-memory fake Chrome (`pnpm dev:mock`).
export default defineConfig({
  root: "src/mock",
  base: "./",
  // root is src/mock, so point the Svelte plugin at the project's svelte.config.js
  plugins: [
    svelte({ configFile: resolve(import.meta.dirname, "svelte.config.js") }),
  ],
  server: { port: 5174 },
  build: { outDir: "../../dist-mock", emptyOutDir: true },
});
