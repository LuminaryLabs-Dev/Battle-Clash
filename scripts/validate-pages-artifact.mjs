import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const artifactRoot = process.env.PAGES_ARTIFACT_ROOT ?? "dist";
const html = await readFile(`${artifactRoot}/index.html`, "utf8");
const configuredBase = String(process.env.PAGES_BASE_PATH ?? "/Battle-Clash/").trim();
const basePath = `${configuredBase.startsWith("/") ? configuredBase : `/${configuredBase}`}`.replace(/\/+$/, "") + "/";
const required = ["<title>Battle Clash</title>", "id=\"app\"", `${basePath}assets/`];
for (const marker of required) if (!html.includes(marker)) throw new Error(`Pages artifact missing ${marker}`);
const scripts = [...html.matchAll(/<script[^>]+src=\"([^\"]+)\"/g)].map((match) => match[1]);
if (!scripts.some((src) => src.endsWith(".js"))) throw new Error("Pages artifact has no runtime script");
const manifest = JSON.parse(await readFile("src/assets/approved-manifest.json", "utf8"));
const tierMetadata = JSON.parse(await readFile(`${artifactRoot}/release-tier.json`, "utf8"));
if (tierMetadata.pages?.basePath !== basePath) throw new Error(`release tier base path mismatch: ${tierMetadata.pages?.basePath}`);
const assets = [];
for (const asset of manifest.assets ?? []) {
  if (asset.status !== "approved") continue;
  const path = `${artifactRoot}/${asset.path.replace(/^public\//, "")}`;
  const bytes = await readFile(path);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== asset.sha256) throw new Error(`Pages asset hash mismatch: ${asset.id}`);
  assets.push({ id: asset.id, path, sha256: hash });
}
console.log(JSON.stringify({ ok: true, entry: `${artifactRoot}/index.html`, scripts: scripts.length, markers: required.length, assets }, null, 2));
