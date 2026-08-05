import { spawnSync } from "node:child_process";

const RELEASE_TIERS = ["main", "staging", "publish"];
const PROMOTIONS = new Set(["main:staging", "staging:publish"]);

const arg = (name) => {
  const prefix = `--${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix));
  return value ? value.slice(prefix.length).trim() : null;
};

const mode = arg("mode") ?? process.env.BATTLE_CLASH_TIER_FLOW_MODE ?? "refs";
const remote = process.env.BATTLE_CLASH_REMOTE ?? "origin";

function runGit(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result;
}

function hasRef(ref) {
  return runGit(["show-ref", "--verify", "--quiet", ref], { allowFailure: true }).status === 0;
}

function resolveRef(tier) {
  const candidates = [`refs/remotes/${remote}/${tier}`, `refs/heads/${tier}`];
  const ref = candidates.find(hasRef);
  if (!ref) throw new Error(`missing release branch ref: ${tier}`);
  return ref;
}

function commit(ref) {
  return runGit(["rev-parse", `${ref}^{commit}`]).stdout.trim();
}

function tree(ref) {
  return runGit(["rev-parse", `${ref}^{tree}`]).stdout.trim();
}

function isAncestor(ancestor, descendant) {
  return runGit(["merge-base", "--is-ancestor", ancestor, descendant], { allowFailure: true }).status === 0;
}

function tierRefs() {
  return Object.fromEntries(
    RELEASE_TIERS.map((tier) => {
      const ref = resolveRef(tier);
      return [tier, { branch: tier, ref, commit: commit(ref), tree: tree(ref) }];
    }),
  );
}

function assertBaseline(refs) {
  const baselineTree = refs.main.tree;
  const drift = RELEASE_TIERS.filter((tier) => refs[tier].tree !== baselineTree);
  if (drift.length > 0) {
    throw new Error(`release baseline drifted: ${drift.join(", ")} differ from main`);
  }
}

function assertPromotion(refs) {
  const source = arg("source") ?? process.env.BATTLE_CLASH_PROMOTION_SOURCE;
  const target = arg("target") ?? process.env.BATTLE_CLASH_PROMOTION_TARGET;
  if (!source || !target || !PROMOTIONS.has(`${source}:${target}`)) {
    throw new Error("promotion must be one of main:staging or staging:publish");
  }
  if (!isAncestor(refs[target].ref, refs[source].ref)) {
    throw new Error(`${target} has commits not present in ${source}; resolve tier drift before promotion`);
  }
  return { source, target, fastForwardable: true };
}

try {
  const refs = tierRefs();
  const result = { ok: true, mode, remote, tiers: refs };
  if (mode === "baseline") {
    assertBaseline(refs);
    result.baseline = { status: "identical-tree", tree: refs.main.tree };
  } else if (mode === "promotion") {
    result.promotion = assertPromotion(refs);
  } else if (mode !== "refs") {
    throw new Error(`unknown tier-flow mode: ${mode}`);
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, mode, error: error.message }, null, 2));
  process.exitCode = 1;
}
