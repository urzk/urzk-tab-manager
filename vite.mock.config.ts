import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Demo page backed by the in-memory fake Chrome (`pnpm dev:mock`).
export default defineConfig({
  root: "src/mock",
  base: "./",
  plugins: [svelte()],
  server: { port: 5174 },
  build: { outDir: "../../dist-mock", emptyOutDir: true },
});
