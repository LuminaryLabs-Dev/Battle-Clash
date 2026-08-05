# Battle Clash tier maintenance

The release branches are a controlled promotion chain:

```txt
feature/* -> main -> staging -> publish
             dev     pre-prod   production
```

## Baseline alignment

Before the first development change, merge the current Battle-Clash PR into
`main`, then promote `main -> staging` and `staging -> publish` through reviewed
pull requests. Run:

```sh
npm run check:tier-baseline
```

The baseline check requires all three release branches to have the same source
tree. Generated `release-tier.json` files may still differ because each tier
has a different data and network policy.

## Normal change flow

1. Create a short-lived feature branch from `main`.
2. Open a PR into `main` and wait for required checks/review.
3. Use **Promote Battle Clash tier** with `main -> staging`.
4. Review browser, asset, and sandbox evidence before merging staging.
5. Use the workflow again with `staging -> publish`.
6. Require backend, multiplayer, deployment, and production browser evidence
   before merging publish.

The promotion validator requires the target branch to be an ancestor of the
source branch, preventing hidden target-only commits from being promoted.

## Maintenance checks

```sh
npm run check:tier-flow       # release refs exist
npm run check:tier-baseline   # exact source-tree parity at a baseline
git diff main..staging --quiet
git diff staging..publish --quiet
```

The weekly **Battle Clash tier maintenance** workflow runs the ref audit. Its
manual dispatch can run baseline or source/target promotion checks. The branch
audit workflow runs the ref check on every release-branch push and PR.

## Recovery

- Never force-push a protected release branch.
- Stop promotion if the ancestry check fails.
- Preserve the failed workflow, deployment SHA, and audit artifact.
- Restore the last reviewed release through a new protected PR.
- Keep credentials and provider configuration outside the repository.
