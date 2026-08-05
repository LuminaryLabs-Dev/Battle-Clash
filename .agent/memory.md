# Agent Memory

## Decisions

- Display name: Battle Clash.
- Repository: private `LuminaryLabs-Dev/Battle-Clash`.
- Public game: `https://luminarylabs-dev.github.io/Battle-Clash/`.
- Product direction: original dungeon attack/defend RPG greybox, not a village clone.
- Architecture: deep game domains compose NexusEngine Core domains through
  atomic idempotent kits.
- Core World owns the flat uniform-grid world.
- Core Network owns session, peer, envelope, and authority descriptors.
- Core Persistence owns the progression slot contract.
- The defender peer hosts the authoritative ECS simulation.
- PeerJS transports commands and snapshots through deterministic auto-discovered rooms.
- Multiplayer failure degrades to a complete solo run.
- Progression persists in the browser and scales newly deployed delvers by level.
- Three.js is a presentation/input host only.
- Active play is world-first, with no persistent cards or dashboard rows.
- Tiny masked edge sigils may communicate party, Heart, and currently available
  interactions; other state belongs in the world or the invoked system menu.
- Responsive camera framing must fit projected room bounds across desktop,
  compact landscape, and portrait viewports.
- Pages publishes one combined artifact: production from `main` at the root,
  staging from `staging/`, and the publish candidate from `publish/`. The
  checked-in `/docs` tree remains a local fallback.

## Conventions

- Reconcile active work in `.agent/workflow.md`.
- Append meaningful progress to `.agent/change-log.md`.
- Store human-view routing and proof in `.agent/feedback-packets/`.
- Keep provider SDK details outside gameplay domains.
- Mark unknown future product decisions as `TBD`.
- A validator now measures registered domains, ECS vocabulary, archetypes,
  territories, scenes, composition APIs, peer commands, deterministic replay,
  and the full Home Base → frontier → territory → encounter → raid → Home Base
  flow. Coverage is a gate, not a claim about untested external services.
- Account identity and data rights stay behind the invoked system menu: email /
  password and Google share Supabase Auth, Rails owns export/deletion, and only
  Battle Clash's local profile and sync queue are cleared after deletion.
- Release state is explicit and data-policy-bound: `main` is development,
  `staging` is anonymized production staging, and `publish` is production.
  Public Pages uses `/staging/` and `/publish/` paths beside the development
  root because a repository has one Pages site. Promotion is PR-only in the
  order main -> staging -> publish, with redacted tier audits.
