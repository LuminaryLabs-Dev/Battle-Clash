# Battle Clash release operations

## Branch policy

Development may land directly on the unprotected `main` branch or through a
short-lived feature PR. Release changes advance through production staging
`staging`, then production `publish`. The three branch contracts are defined in
[`../release-tiers.json`](../release-tiers.json) and explained in
[`BRANCH_TIERS.md`](BRANCH_TIERS.md). Promotion PRs are used for
`main -> staging` and `staging -> publish`; early development currently keeps
CI checks while approval review is disabled. Restore required review before
production hardening.

The branch-audit workflow uploads a redacted tier audit for every tier push or
PR. It records policy, commit, data mode, deployment path, and check status,
never credentials, passwords, tokens, or private profile payloads.

## Deployment

`.github/workflows/deploy-pages.yml` builds `main`, `staging`, and `publish`
from their remote branch snapshots and publishes them as one artifact. The
expected links are:

- Development: `https://luminarylabs-dev.github.io/Battle-Clash/`
- Staging: `https://luminarylabs-dev.github.io/Battle-Clash/staging/`
- Production: `https://luminarylabs-dev.github.io/Battle-Clash/publish/`

Provider secrets are configured outside Git and are never copied into this
repository.

## Health checks

- Pages: `PAGES_ARTIFACT_ROOT=docs npm run check:pages-artifact` before upload.
- Pages deploy: the workflow curls the published `page_url` and requires the
  Battle Clash title and runtime script before the deployment is healthy.
- Pages deploy: the workflow uploads a redacted `battle-clash-release-audit`
  artifact containing the deployment SHA, public URL, status, and proof slots;
  credentials and private profile data are excluded.
- Tier deploy: `battle-clash-tier-audits-*` contains one redacted audit for each
  public branch snapshot.
- Client: `npm run check`, `npm run check:domains`.
- Player: `npm run check:all` plus browser viewport proof.
- Backend: Ruby 3.3 CI, migrations, request tests, and RLS checks.
- Multiplayer: authenticated room, reconnect, and one idempotent receipt.

## Rollback

Disable the failing Pages deployment, redeploy the last reviewed default-branch
commit, and preserve the failed workflow URL and receipt/profile audit IDs. Do
not delete evidence or rewrite history during rollback.

## Monitoring and audit

Record deployment SHA, browser-proof artifact paths, match receipt IDs, profile
revision, and backend error summaries. Never record access tokens, passwords,
service keys, or raw private account payloads.
