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
    const archive = execFileSync("git", ["archive", "--format=tar", ref], {
      cwd: root,
      maxBuffer: 128 * 1024 * 1024
    });
    execFileSync("tar", ["-xf", "-", "-C", source], { cwd: root, input: archive });
    const packageJson = JSON.parse(await readFile(path.join(source, "package.json"), "utf8"));
    const sourceCommit = execFileSync("git", ["rev-parse", ref], { cwd: root }).toString().trim();

    const env = {
      ...process.env,
      BATTLE_CLASH_TIER: tier,
      BATTLE_CLASH_BASE_PATH: config.pages.basePath,
      PAGES_BASE_PATH: config.pages.basePath
    };

    execFileSync("npm", ["ci"], { cwd: source, env, stdio: "inherit" });
    if (packageJson.scripts?.["check:all"]) {
      execFileSync("npm", ["run", "check:all"], { cwd: source, env, stdio: "inherit" });
    } else {
      // Keep the production path deployable while main is being promoted from
      // the legacy first-playable commit. The next main promotion removes this
      // compatibility branch when all four tiers share the new contract.
      execFileSync("npm", ["run", "check"], { cwd: source, env, stdio: "inherit" });
    }
    execFileSync("npm", ["run", "build:pages"], { cwd: source, env, stdio: "inherit" });
    if (packageJson.scripts?.["check:pages-artifact"]) {
      execFileSync("npm", ["run", "check:pages-artifact"], {
        cwd: source,
        env: { ...env, PAGES_ARTIFACT_ROOT: "docs" },
        stdio: "inherit"
      });
    } else {
      execFileSync("test", ["-f", path.join(source, "docs", "index.html")], { cwd: root });
    }

    const destination = path.join(siteRoot, config.pages.subpath ?? "");
    await cp(path.join(source, "docs"), destination, { recursive: true });
    await writeFile(path.join(destination, "release-tier.json"), `${JSON.stringify({
      schema: "battle-clash.release-tier/1",
      project: manifest.project,
      tier,
      branch: config.branch,
      commit: sourceCommit,
      phase: config.phase,
      dataMode: config.dataMode,
      profilePolicy: config.profilePolicy,
      networkPolicy: config.networkPolicy,
      pages: { basePath: config.pages.basePath, url: config.pages.url, published: config.pages.published },
      generatedAt: new Date().toISOString(),
      redaction: { credentials: "excluded", accessTokens: "excluded", profilePayloads: "excluded" }
    }, null, 2)}\n`);
    const auditPath = path.join(siteRoot, "release-audits", `${tier}.json`);
    if (packageJson.scripts?.["audit:tier"]) {
      execFileSync("npm", ["run", "audit:tier"], {
        cwd: source,
        env: { ...env, TIER_AUDIT_STATUS: "build-verified", TIER_AUDIT_PATH: auditPath },
        stdio: "inherit"
      });
    } else {
      await mkdir(path.dirname(auditPath), { recursive: true });
      await writeFile(auditPath, `${JSON.stringify({
        schema: "battle-clash.tier-audit/1",
        project: manifest.project,
        tier,
        branch: config.branch,
        commit: sourceCommit,
        phase: config.phase,
        dataMode: config.dataMode,
        profilePolicy: config.profilePolicy,
        networkPolicy: config.networkPolicy,
        pages: config.pages,
        checks: { status: "legacy-build-verified", semantic: "legacy-check", browser: "not-recorded", backend: "not-recorded", multiplayer: "not-recorded" },
        generatedAt: new Date().toISOString(),
        redaction: { credentials: "excluded", accessTokens: "excluded", passwords: "excluded", profilePayloads: "excluded" }
      }, null, 2)}\n`);
    }

    summaries.push({ tier, branch: config.branch, basePath: config.pages.basePath, destination });
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}

console.log(JSON.stringify({ ok: true, siteRoot, tiers: summaries }, null, 2));
