# Battle Clash branch tiers

Battle Clash uses four copies of the same application source with different
release and data policies. A branch is a product state, not a second game
architecture.

| Tier | Branch | Purpose | Data policy | Public URL |
| --- | --- | --- | --- | --- |
| Build | `build` | Integration and deterministic checks | Synthetic/local only | No Pages deployment |
| Staging | `staging` | Shared browser and service verification | Anonymized sandbox profiles | [staging Pages](https://luminarylabs-dev.github.io/Battle-Clash/staging/) |
| Publish | `publish` | Release candidate and final acceptance | Production-shaped candidate data | [publish Pages](https://luminarylabs-dev.github.io/Battle-Clash/publish/) |
| Main | `main` | Production source and public release | Authenticated production data | [production Pages](https://luminarylabs-dev.github.io/Battle-Clash/) |

The policy is defined in [`release-tiers.json`](../release-tiers.json) and is
validated by `npm run check:tier`. Each Pages build also emits a redacted
`release-tier.json` beside the game so a browser proof can identify which tier
it is exercising.

## Promotion path

```txt
feature branch -> build -> staging -> publish -> main
```

Use **Promote Battle Clash tier** in GitHub Actions to open the next pull
request. The workflow only permits the ordered transitions above, runs the
source checks, writes an audit artifact, and opens a PR. It never pushes
directly to `main` or merges a protected branch.

Required evidence grows with risk:

- `build`: checks, domain coverage, and release manifest.
- `staging`: those checks plus browser screenshots, asset review, and sandbox
  service checks.
- `publish`: staging evidence plus backend sync and authenticated multiplayer
  proof.
- `main`: protected review, deployment health, and a fresh public browser proof.

## Pages layout

GitHub Pages provides one site per repository. The deploy workflow therefore
builds the three public branches into one artifact:

```txt
https://luminarylabs-dev.github.io/Battle-Clash/
├─ staging/
└─ publish/
```

This gives staging and production distinct links without duplicating the
repository or pretending that a branch is a separate Pages site. `build` is
intentionally artifact-only.

## Operating rules

- Keep `main` protected and merge through a reviewed promotion PR.
- Keep credentials in GitHub/Supabase/Rails provider settings; never in a
  branch or tier metadata file.
- Never send real user profiles or receipts to `build` or `staging`.
- Rebuild all public paths after a `main`, `staging`, or `publish` push so each
  link remains a known snapshot of its branch.
- Retain the tier audit artifact, deployment SHA, browser proof, and rollback
  reference for every promotion.
