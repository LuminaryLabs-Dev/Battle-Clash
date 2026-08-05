# Battle Clash release operations

## Branch policy

Work lands on feature branches. The default branch is protected and receives a
merge only after `npm ci`, simulation/domain checks, production builds, Pages
artifact smoke validation, and the Player harness gates pass.

## Deployment

`.github/workflows/deploy-pages.yml` deploys Pages from `main`. Provider secrets
are configured outside Git and are never copied into this repository. The
expected public origin is `https://luminarylabs-dev.github.io/Battle-Clash/`.

## Health checks

- Pages: `PAGES_ARTIFACT_ROOT=docs npm run check:pages-artifact` before upload.
- Pages deploy: the workflow curls the published `page_url` and requires the
  Battle Clash title and runtime script before the deployment is healthy.
- Pages deploy: the workflow uploads a redacted `battle-clash-release-audit`
  artifact containing the deployment SHA, public URL, status, and proof slots;
  credentials and private profile data are excluded.
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
