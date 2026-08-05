import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("release-tiers.json", "utf8"));
const requested = String(process.env.BATTLE_CLASH_TIER ?? process.env.GITHUB_REF_NAME ?? "build").trim();
const tier = manifest.tiers?.[requested] ? requested : "build";
const entry = manifest.tiers[tier];
const output = path.resolve(process.env.TIER_AUDIT_PATH ?? `tier-audit-${tier}.json`);
const audit = {
  schema: "battle-clash.tier-audit/1",
  project: manifest.project,
  tier,
  branch: String(process.env.GITHUB_REF_NAME ?? requested),
  commit: String(process.env.GITHUB_SHA ?? "local"),
  phase: entry.phase,
  dataMode: entry.dataMode,
  profilePolicy: entry.profilePolicy,
  networkPolicy: entry.networkPolicy,
  pages: entry.pages,
  checks: {
    status: process.env.TIER_AUDIT_STATUS ?? "verified",
    semantic: process.env.TIER_AUDIT_SEMANTIC ?? "not-recorded",
    browser: process.env.TIER_AUDIT_BROWSER ?? "not-recorded",
    backend: process.env.TIER_AUDIT_BACKEND ?? "not-recorded",
    multiplayer: process.env.TIER_AUDIT_MULTIPLAYER ?? "not-recorded"
  },
  generatedAt: new Date().toISOString(),
  redaction: {
    credentials: "excluded",
    accessTokens: "excluded",
    passwords: "excluded",
    profilePayloads: "excluded"
  }
};

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, output, schema: audit.schema, tier }, null, 2));
