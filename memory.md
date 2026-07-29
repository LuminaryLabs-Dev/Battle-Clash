# Battle Clash Memory

## Purpose

Build an original browser dungeon-battle RPG about leveling a delver party and
attacking or defending compact rooms. Do not copy the names, art, characters,
layouts, UI, text, audio, or balance of Clash of Clans, Diablo, or another game.

## Durable Architecture Decisions

- NexusEngine is the deterministic Core runtime and is pinned as an external dependency.
- ECS entities, components, resources, events, and ordered systems own gameplay truth.
- Deep game domains compose NexusEngine Core domains and small atomic kits.
- Core World owns world identity, partitioning, cells, surfaces, focus, and portable lifecycle state.
- Core Network owns sessions, peers, envelopes, sync policy, authority, and reconnect descriptors.
- Core Persistence owns profile-slot contracts; localStorage is a browser adapter.
- The defender peer hosts the authoritative simulation. Attackers send semantic
  commands and receive bounded authoritative snapshots.
- PeerJS is only a transport adapter. The default public build uses PeerServer
  Cloud; the repository also includes an optional self-hosted PeerServer layer.
- Room discovery uses deterministic room IDs and automatic host election. No
  room code is required for the first attack/defend slice.
- Multiplayer is progressive enhancement: signaling, NAT, or room failure must
  degrade to a fully playable solo run.
- Progression persists XP, level, wins, runs, and perk points. Levels scale
  newly deployed delvers through data, not renderer logic.
- Three.js owns browser input projection and presentation only.
- The playable remains a colored-cube greybox with an orthographic bird's-eye camera.
- The private repository deploys a public `dist/` artifact through GitHub Pages
  when the default branch is pushed.

## Repository And Release

- Local folder: `/Users/crimsonwheeler/Documents/GitHub/Battle-Clash`
- GitHub repository: `LuminaryLabs-Dev/Battle-Clash` (private)
- Public Pages URL: `https://luminarylabs-dev.github.io/Battle-Clash/`
- Default release workflow: `.github/workflows/deploy-pages.yml`

## Conventions

- Keep provider SDKs in host/adapter layers.
- Keep commands semantic and snapshots serializable.
- Preserve solo fallback when changing networking.
- Update this file by replacing outdated decisions rather than accumulating duplicates.
