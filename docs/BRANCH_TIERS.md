# Battle Clash branch tiers

Battle Clash uses three copies of the same application source with different
release and data policies. A branch is a product state, not a second game
architecture.

| Tier | Branch | Purpose | Data policy | Public URL |
| --- | --- | --- | --- | --- |
| Main | `main` | Development source and integration | Synthetic development profiles | [development Pages](https://luminarylabs-dev.github.io/Battle-Clash/) |
| Staging | `staging` | Production staging and acceptance | Anonymized sandbox profiles | [staging Pages](https://luminarylabs-dev.github.io/Battle-Clash/staging/) |
| Publish | `publish` | Production source and release | Authenticated production data | [production Pages](https://luminarylabs-dev.github.io/Battle-Clash/publish/) |

The policy is defined in [`release-tiers.json`](../release-tiers.json) and is
validated by `npm run check:tier`. Each Pages build also emits a redacted
`release-tier.json` beside the game so a browser proof can identify which tier
it is exercising.

## Promotion path

```txt
feature branch -> main -> staging -> publish
```

Use **Promote Battle Clash tier** in GitHub Actions to open the next pull
request. The workflow only permits the ordered transitions above, runs the
source checks, writes an audit artifact, and opens a PR. It never pushes
directly to `main` or merges a protected branch.

Required evidence grows with risk:

- `main`: checks, domain coverage, and development integration.
- `staging`: those checks plus browser screenshots, asset review, and sandbox
  service checks.
- `publish`: staging evidence plus backend sync and authenticated multiplayer
  proof.
- Production: protected review, deployment health, and a fresh public browser
  proof from `publish`.

## Pages layout

GitHub Pages provides one site per repository. The deploy workflow therefore
builds the three branches into one artifact:

```txt
https://luminarylabs-dev.github.io/Battle-Clash/
├─ staging/
└─ publish/
```

This gives staging and production distinct links without duplicating the
repository or pretending that a branch is a separate Pages site. `build` is
no longer a release tier.

## Operating rules

- `main` is intentionally unprotected during early development; use normal
  checks and PRs when useful, but do not treat it as the production gate.
- Keep `staging` and `publish` protected and merge them only through reviewed
  promotion PRs.
- Keep credentials in GitHub/Supabase/Rails provider settings; never in a
  branch or tier metadata file.
- Never send real user profiles or receipts to `main` or `staging`.
- Rebuild all public paths after a `main`, `staging`, or `publish` push so each
  link remains a known snapshot of its branch.
- Retain the tier audit artifact, deployment SHA, browser proof, and rollback
  reference for every promotion.
