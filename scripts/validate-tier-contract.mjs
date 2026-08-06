import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("release-tiers.json", "utf8"));
const expected = ["main", "staging", "publish"];
if (manifest.schema !== "battle-clash.release-tiers/1") throw new Error("release tier schema drifted");
if (manifest.defaultBranch !== "main") throw new Error("main must remain the default branch");
if (JSON.stringify(manifest.order) !== JSON.stringify(expected)) throw new Error("release tier order drifted");
if (manifest.policy?.mainReceivesOnlyThroughPullRequest !== false) throw new Error("main development protection policy drifted");
if (manifest.policy?.mainProtection !== "development-unprotected") throw new Error("main protection mode drifted");
if (manifest.policy?.stagingAndPublishRemainProtected !== true) throw new Error("staging/publish protection policy drifted");

for (const tier of expected) {
  const entry = manifest.tiers?.[tier];
  if (!entry) throw new Error(`missing release tier: ${tier}`);
  if (entry.branch !== tier) throw new Error(`${tier} branch mapping drifted`);
  if (!entry.phase || !entry.dataMode || !entry.profilePolicy || !entry.networkPolicy) {
    throw new Error(`${tier} is missing lifecycle policy`);
  }
  if (!entry.pages.published || !entry.pages.basePath || !entry.pages.url) throw new Error(`${tier} must have a Pages path and URL`);
}

const requested = String(process.env.BATTLE_CLASH_TIER ?? process.env.GITHUB_REF_NAME ?? "main").trim();
const resolved = manifest.tiers?.[requested] ? requested : "main";
if (process.env.BATTLE_CLASH_ENFORCE_TIER === "true" && !manifest.tiers?.[requested]) {
  throw new Error(`unknown release tier: ${requested}`);
}

console.log(JSON.stringify({ ok: true, requested, resolved, order: manifest.order, defaultBranch: manifest.defaultBranch }, null, 2));
