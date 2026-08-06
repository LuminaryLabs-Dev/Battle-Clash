# Battle Clash release gap checklist

This is the current evidence-based handoff. `DONE` means the local contract and
available CI/browser proof pass. `EXTERNAL` means the code is ready but needs a
provider, credential, reviewer, or deployed runtime that is not available in
this workspace.

## Loop 1 — local product and proof

- [x] `DONE` Objaverse asset: one CC-BY GLB is quarantined, normalized, hashed,
  attributed, approved after three review passes, rendered in the game, and
  verified with cube fallback. Evidence: `src/assets/approved-manifest.json`,
  `assets/objaverse/reviews/`, `python3 tools/objaverse/cli.py verify ...`.
- [x] `DONE` NexusEngine ECS/game domains: 39 domains, 169 territories, 175
  scene descriptors, deterministic A*, authored room chain, content kit, PeerJS
  contracts, and 687/687 semantic coverage.
- [x] `DONE` Player harness: ECS/screen adapters, JSONL memory triangle,
  retrieval/replay/dataset checks, responsive screenshots, and full local
  Home Base → Frontier → Territory → Rooms → Victory → Home episode.
- [x] `DONE` Workspace cleanup: Battle-Clash, BattleClash-Player, and
  LuminaryLabs-Backend are clean; stale checked-in Pages bundles were removed.
  NexusEngine has only the pre-existing untracked `docs/assets/social/` tree,
  which was not touched.

Next loop: keep these gates unchanged while integrating external services.

## Loop 2 — protected repository integration

- [x] `DONE` All repositories are private, default branch `main`; staging and
  publish are promotion branches with required CI checks and no early-development
  approval gate.
- [x] `DONE` PR auto-merge is queued without bypassing protection:
  - [Battle-Clash PR](https://github.com/LuminaryLabs-Dev/Battle-Clash/pull/1)
  - [BattleClash-Player PR](https://github.com/LuminaryLabs-Dev/BattleClash-Player/pull/1)
  - [LuminaryLabs-Backend PR](https://github.com/LuminaryLabs-Dev/LuminaryLabs-Backend/pull/1)
- [x] `DONE` Promotion PRs #2, #3, #4, and #5 merged in order; main, staging,
  and publish now point to the same source tree baseline.

Next loop: restore review protection before production hardening, after the
current early-development baseline is accepted.

## Loop 3 — account and durable backend providers

- [x] `DONE` Supabase/Auth adapters expose email/password, Google redirect,
  refresh, logout, shared UUID continuity, profile sync, export, and deletion.
- [x] `DONE` Rails has SQLite local/test, Postgres production configuration,
  snapshots, receipts, idempotency, replay protection, JWT issuer/audience/
  expiry/signature/UUID checks, RLS migration, and RLS CI contract tests.
- [x] `DONE` Ruby 3.3/Rails CI is green on the backend PR.
- [ ] `EXTERNAL` Create/configure the Supabase project, Google OAuth credentials,
  callback URLs, encrypted GitHub/provider secrets, and production Rails.
- [ ] `EXTERNAL` Apply Rails migrations and Supabase RLS to the live Postgres
  project, then run real email/Google identity and profile round-trip tests.

Next loop after provider setup: authenticate two browsers, verify the same UUID,
offline queue flush, conflict handling, export, deletion, and one receipt.

## Loop 4 — production multiplayer

- [x] `DONE` PeerJS room hello, UUID/role/revision/reconnect token, command
  sequence/authority checks, snapshot chunking, solo fallback, and one-receipt
  backend contracts are implemented and tested.
- [ ] `EXTERNAL` Provision hosted HTTPS PeerServer and TURN, then set encrypted
  client endpoints.
- [ ] `EXTERNAL` Run two authenticated attack/defend browsers through disconnect,
  reconnect/host recovery, sequence validation, and exactly one durable receipt.

Next loop after hosted transport: capture match IDs/profile revisions in the
release audit artifact and repeat the browser proof on the deployed origin.

## Loop 5 — deployed browser and release proof

- [x] `DONE` Local Playwright proof passes desktop, compact, and portrait views,
  zero console errors, approved GLB loading, and the full screen episode.
- [x] `DONE` All three public Pages paths return HTTP 200 after the current
  publish deployment; workflow health checks pass.
- [x] `DONE` Public Playwright proof passes desktop, compact, and portrait views,
  zero console errors, approved GLB loading, and the complete screen episode.
- [ ] `EXTERNAL` Run Google/email callbacks and two-browser authenticated
  multiplayer after provider credentials and hosted transport are configured.

Next loop after provider setup: compare authenticated runtime evidence to the
publish audit and exercise the rollback procedure if a health check fails.

## Loop 6 — release operations and monitoring

- [x] `DONE` Pages workflow deploys from `main`, verifies the public title/runtime
  after deploy, and uploads a redacted deployment audit artifact.
- [x] `DONE` `release-manifest.json`, rollback instructions, encrypted-secret
  policy, branch protection, and health-check contracts are present.
- [x] `DONE` Verify current main/staging/publish branch SHAs, identical source
  tree hash, Pages health result, and public browser-proof artifacts.
- [ ] `EXTERNAL` Verify a real profile revision, match receipt ID, and backend
  error summary after providers exist.
- [ ] `EXTERNAL` Add provider monitoring/alerting (Rails, Supabase, PeerServer,
  TURN) after production endpoints exist.

Next loop after monitoring: run a controlled rollback drill and retain the
deployment/audit evidence without recording secrets or private profile payloads.

## NexusEngine compatibility and cleanup

- [x] `DONE` NexusEngine `main` passes the full test suite, Core catalog/contract
  checks, boundary audit, and docs/PDF checks. Battle Clash remains pinned to the
  external Nexus dependency and keeps gameplay in ECS/atomic kits.
- [x] `DONE` No Nexus source was copied or modified; the only untracked Nexus
  files are the pre-existing social assets and remain outside this task.
