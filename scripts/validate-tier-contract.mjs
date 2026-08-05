import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("release-tiers.json", "utf8"));
const expected = ["build", "staging", "publish", "main"];
if (manifest.schema !== "battle-clash.release-tiers/1") throw new Error("release tier schema drifted");
if (manifest.defaultBranch !== "main") throw new Error("main must remain the default branch");
if (JSON.stringify(manifest.order) !== JSON.stringify(expected)) throw new Error("release tier order drifted");

for (const tier of expected) {
  const entry = manifest.tiers?.[tier];
  if (!entry) throw new Error(`missing release tier: ${tier}`);
  if (entry.branch !== tier) throw new Error(`${tier} branch mapping drifted`);
  if (!entry.phase || !entry.dataMode || !entry.profilePolicy || !entry.networkPolicy) {
    throw new Error(`${tier} is missing lifecycle policy`);
  }
  if (tier === "build" && entry.pages.published) throw new Error("build cannot publish Pages");
  if (tier !== "build" && (!entry.pages.published || !entry.pages.basePath || !entry.pages.url)) {
    throw new Error(`${tier} must have a Pages path and URL`);
  }
}

const requested = String(process.env.BATTLE_CLASH_TIER ?? process.env.GITHUB_REF_NAME ?? "build").trim();
const resolved = manifest.tiers?.[requested] ? requested : "build";
if (process.env.BATTLE_CLASH_ENFORCE_TIER === "true" && !manifest.tiers?.[requested]) {
  throw new Error(`unknown release tier: ${requested}`);
}

console.log(JSON.stringify({ ok: true, requested, resolved, order: manifest.order, defaultBranch: manifest.defaultBranch }, null, 2));
