import { defineConfig } from "vite";

function normalizeBasePath(value) {
  const raw = String(value ?? "/Battle-Clash/").trim();
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

export default defineConfig({
  base: normalizeBasePath(process.env.BATTLE_CLASH_BASE_PATH),
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false
  }
});
