import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("release-manifest.json", "utf8"));
const tiers = JSON.parse(await readFile("release-tiers.json", "utf8"));
const required = ["npm ci", "npm run check", "npm run check:domains", "npm run check:buildings", "npm run build", "git diff --check"];
if (manifest.schema !== "battle-clash.release/1") throw new Error("release manifest schema drifted");
if (JSON.stringify(manifest.requiredChecks) !== JSON.stringify(required)) throw new Error("release checks drifted");
if (manifest.deployment.sourceBranch !== "main") throw new Error("GitHub Pages must deploy from main");
if (manifest.deployment.workflow !== ".github/workflows/deploy.yml") throw new Error("single deploy workflow missing");
if (manifest.deployment.siteModel !== "single-main-branch-pages-site") throw new Error("Pages site model drifted");
if (manifest.secretsPolicy !== "provider-encrypted-only") throw new Error("secrets policy missing");
if (manifest.audit?.schema !== "battle-clash.release-audit/1") throw new Error("release audit schema missing");
if (manifest.audit?.artifact !== "battle-clash-release-audit") throw new Error("release audit artifact missing");
if (manifest.tiers !== "release-tiers.json" || tiers.schema !== "battle-clash.release-tiers/1") throw new Error("release tier contract missing");
if (manifest.deployment.productionUrl !== tiers.tiers.main.pages.url) throw new Error("production Pages URL drifted");
console.log(JSON.stringify({ ok: true, schema: manifest.schema, checks: required.length, deployment: manifest.deployment }, null, 2));
