import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import manifest from "../src/assets/approved-manifest.json" with { type: "json" };

const root = path.resolve(new URL("..", import.meta.url).pathname);
for (const asset of manifest.assets ?? []) {
  if (asset.status !== "approved" || !asset.path) continue;
  const source = path.join(root, asset.path);
  const relative = asset.path.replace(/^public[\\/]/, "");
  const target = path.join(root, "public", relative);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
  console.log(`prepared approved asset ${asset.id} -> ${path.relative(root, target)}`);
}
