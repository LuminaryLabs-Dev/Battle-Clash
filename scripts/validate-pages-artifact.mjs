import { readFile } from "node:fs/promises";

const html = await readFile("dist/index.html", "utf8");
const required = ["<title>Battle Clash</title>", "id=\"app\"", "/Battle-Clash/assets/"];
for (const marker of required) if (!html.includes(marker)) throw new Error(`Pages artifact missing ${marker}`);
const scripts = [...html.matchAll(/<script[^>]+src=\"([^\"]+)\"/g)].map((match) => match[1]);
if (!scripts.some((src) => src.endsWith(".js"))) throw new Error("Pages artifact has no runtime script");
console.log(JSON.stringify({ ok: true, entry: "dist/index.html", scripts: scripts.length, markers: required.length }, null, 2));
