# Battle Clash Agent Instructions

## Current Boundary

- The first playable implementation and default-branch release are authorized.
- Deploy the playable Pages artifact; keep the GitHub repository private.
- Do not change repository visibility without new explicit authorization.
- Preserve NexusEngine as an external Core dependency; do not copy Core source here.

## Architecture

```txt
Battle Clash composition
  game domains
    own authored game meaning and rules
  NexusEngine Core domains
    own universal state and lifecycle contracts
  atomic kits
    install deterministic behavior
  host adapters
    translate input and presentation only
```

- Gameplay truth must live in NexusEngine ECS state, resources, events, and systems.
- Game domains may compose Core domains but must not reach across boundaries to mutate unrelated domain state.
- Use Core World for world identity, flat surface mapping, uniform-grid partitioning, cells, focus, and portable world snapshots.
- Use Core Object and Object Placement for object identity, bounds, anchors, transforms, and placement validation.
- Use Core Data for snapshots, reset, selectors, schemas, ledgers, and deterministic random streams.
- Use Core Spatial for transforms, bounds, zones, and renderer-neutral spatial queries.
- Use Core Simulation for resources, timers, cooldowns, objectives, and deterministic resolution primitives.
- Use Core Network for session, peer, envelope, authority, sync, and reconnect contracts.
- Use Core Persistence for save-slot and persistence-adapter contracts.
- Use Core Input, Camera, Graphics, UI, and Physics only for their declared renderer-neutral contracts.
- Keep Three.js objects, raycasters, cameras, materials, GPU state, DOM, and WebGL side effects inside host adapters.
- Keep PeerJS and signaling-provider details inside network adapters and server layers.
- Keep authored units, buildings, balance, colors, battle rules, and scenario data in this game repository.
- Begin local-only behavior as game-owned atomic kits. Promote reusable behavior only after independent proof and a separate ownership decision.

## Repository Memory

- Maintain `memory.md` for durable decisions only.
- Maintain `goal.md` as the live product goal and acceptance contract.
- Use `.agent/` as the persistent agent workspace.
- Append meaningful repository decisions to `.agent/change-log.md`.

## Validation

- Prefer deterministic headless state proof before browser validation.
- Validate browser startup, zero console errors, gameplay interaction, and human-view screenshots.
- Player-visible acceptance requires screenshots; build success alone is insufficient.
