# Battle Clash tier maintenance

The release branches are a controlled promotion chain:

```txt
feature/* -> main -> staging -> publish
             dev     pre-prod   production
```

## Baseline alignment

After the current Battle-Clash PR is merged into the unprotected development
`main`, promote `main -> staging` and `staging -> publish` through reviewed
pull requests. Run:

```sh
npm run check:tier-baseline
```

The baseline check requires all three release branches to have the same source
tree. Generated `release-tier.json` files may still differ because each tier
has a different data and network policy.

## Normal change flow

1. Make a small change on `main` or a short-lived feature branch.
2. Run the development checks and verify the root Pages build.
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
