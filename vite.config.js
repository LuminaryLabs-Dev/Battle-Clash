import { defineConfig } from "vite";

export default defineConfig({
  base: "/Battle-Clash/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false
  }
});
