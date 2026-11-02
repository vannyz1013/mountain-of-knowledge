import { defineConfig } from "vite";

// A relative base means the build works at any GitHub Pages path, whatever the repo is called.
export default defineConfig({
  base: "./",
  build: { target: "es2020" },
});
