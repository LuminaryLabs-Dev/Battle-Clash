import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("release-manifest.json", "utf8"));
const tiers = JSON.parse(await readFile("release-tiers.json", "utf8"));
const required = ["npm ci", "npm run check", "npm run check:domains", "npm run build", "npm run build:pages", "git diff --check"];
if (manifest.schema !== "battle-clash.release/1") throw new Error("release manifest schema drifted");
if (JSON.stringify(manifest.requiredChecks) !== JSON.stringify(required)) throw new Error("release checks drifted");
if (manifest.deployment.sourceBranch !== "main") throw new Error("Pages must deploy from main");
if (manifest.secretsPolicy !== "provider-encrypted-only") throw new Error("secrets policy missing");
if (manifest.audit?.schema !== "battle-clash.release-audit/1") throw new Error("release audit schema missing");
if (manifest.audit?.artifact !== "battle-clash-release-audit") throw new Error("release audit artifact missing");
if (manifest.tiers !== "release-tiers.json" || tiers.schema !== "battle-clash.release-tiers/1") throw new Error("release tier contract missing");
if (manifest.deployment.stagingUrl !== tiers.tiers.staging.pages.url) throw new Error("staging Pages URL drifted");
if (manifest.deployment.publishUrl !== tiers.tiers.publish.pages.url) throw new Error("publish Pages URL drifted");
console.log(JSON.stringify({ ok: true, schema: manifest.schema, checks: required.length, deployment: manifest.deployment }, null, 2));
