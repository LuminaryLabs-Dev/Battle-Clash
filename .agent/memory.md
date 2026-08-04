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
- Pages publishes verified `/docs` output from `main`; the custom `dist/`
  artifact workflow is manual while organization Actions billing is unavailable.

## Conventions

- Reconcile active work in `.agent/workflow.md`.
- Append meaningful progress to `.agent/change-log.md`.
- Store human-view routing and proof in `.agent/feedback-packets/`.
- Keep provider SDK details outside gameplay domains.
- Mark unknown future product decisions as `TBD`.
