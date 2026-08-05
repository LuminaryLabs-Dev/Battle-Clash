import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root, "release-tiers.json"), "utf8"));
const publicTiers = ["main", "staging", "publish"];
const remote = process.env.BATTLE_CLASH_REMOTE ?? "origin";
const siteRoot = path.resolve(process.env.TIER_PAGES_ROOT ?? "pages-site");
const scratch = await mkdtemp(path.join(os.tmpdir(), "battle-clash-pages-"));

await rm(siteRoot, { recursive: true, force: true });
await mkdir(siteRoot, { recursive: true });
await writeFile(path.join(siteRoot, ".nojekyll"), "\n");

const summaries = [];
try {
  for (const tier of publicTiers) {
    const config = manifest.tiers[tier];
    const ref = `${remote}/${config.branch}`;
    const source = path.join(scratch, tier);
    await mkdir(source, { recursive: true });

    execFileSync("git", ["show-ref", "--verify", "--quiet", `refs/remotes/${ref}`], { cwd: root });
    const archive = execFileSync("git", ["archive", "--format=tar", ref], { cwd: root });
    execFileSync("tar", ["-xf", "-", "-C", source], { cwd: root, input: archive });

    const env = {
      ...process.env,
      BATTLE_CLASH_TIER: tier,
      BATTLE_CLASH_BASE_PATH: config.pages.basePath,
      PAGES_BASE_PATH: config.pages.basePath
    };

    execFileSync("npm", ["ci"], { cwd: source, env, stdio: "inherit" });
    execFileSync("npm", ["run", "check:all"], { cwd: source, env, stdio: "inherit" });
    execFileSync("npm", ["run", "build:pages"], { cwd: source, env, stdio: "inherit" });
    execFileSync("npm", ["run", "check:pages-artifact"], { cwd: source, env, stdio: "inherit" });

    const destination = path.join(siteRoot, config.pages.subpath ?? "");
    await cp(path.join(source, "docs"), destination, { recursive: true });
    const auditPath = path.join(siteRoot, "release-audits", `${tier}.json`);
    execFileSync("npm", ["run", "audit:tier"], {
      cwd: source,
      env: { ...env, TIER_AUDIT_STATUS: "build-verified", TIER_AUDIT_PATH: auditPath },
      stdio: "inherit"
    });

    summaries.push({ tier, branch: config.branch, basePath: config.pages.basePath, destination });
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}

console.log(JSON.stringify({ ok: true, siteRoot, tiers: summaries }, null, 2));
