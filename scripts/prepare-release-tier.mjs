import { mkdir, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("release-tiers.json", "utf8"));
// Ordinary branch checks should build the development root unless a workflow
// explicitly selects staging or production. The Pages matrix and promotion
// workflow set BATTLE_CLASH_TIER; this keeps a plain npm run build deterministic
// on any feature branch and prevents stale branch names from changing paths.
const requested = String(process.env.BATTLE_CLASH_TIER ?? "main").trim();
const tier = manifest.tiers?.[requested] ? requested : "main";
const entry = manifest.tiers[tier];
const basePath = String(process.env.BATTLE_CLASH_BASE_PATH ?? entry.pages.basePath ?? "/Battle-Clash/").trim();
const output = {
  schema: "battle-clash.release-tier/1",
  project: manifest.project,
  tier,
  branch: String(process.env.GITHUB_REF_NAME ?? requested),
  commit: String(process.env.GITHUB_SHA ?? "local"),
  phase: entry.phase,
  dataMode: entry.dataMode,
  profilePolicy: entry.profilePolicy,
  networkPolicy: entry.networkPolicy,
  pages: {
    basePath,
    url: entry.pages.url,
    published: Boolean(entry.pages.published)
  },
  generatedAt: new Date().toISOString(),
  redaction: {
    credentials: "excluded",
    accessTokens: "excluded",
    profilePayloads: "excluded"
  }
};

await mkdir("public", { recursive: true });
await writeFile("public/release-tier.json", `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, output: "public/release-tier.json", tier, basePath }, null, 2));
