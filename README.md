# Battle Clash

Battle Clash is an original browser dungeon-battle greybox. Level a blue cube
delver party, auto-match into an attack/defend room, and shatter or protect the
purple Dungeon Heart.

Play: <https://luminarylabs-dev.github.io/Battle-Clash/>

## First Playable

- Bird's-eye Three.js dungeon made from readable colored cubes.
- Deterministic NexusEngine ECS movement, targeting, combat, destruction, and results.
- Nexus Core World uniform-grid world state.
- PeerJS automatic room election and discovery with defender-host authority.
- Attacker deployment commands and synchronized authoritative snapshots.
- One defender fortification ward per run.
- Persistent XP, levels, wins, runs, perk points, and level-based party power.
- Fully playable solo fallback when no peer is available.

## Architecture

```txt
Browser
├─ Three.js host
│  ├─ canvas, camera, meshes, raycasting
│  └─ renders ECS snapshots only
├─ PeerJS adapter
│  ├─ deterministic room discovery
│  └─ transports commands and snapshots only
└─ Battle Clash composition
   ├─ world, raid, deployment, navigation, targeting, combat
   ├─ defense, progression, and session domains
   └─ NexusEngine Core
      ├─ World
      ├─ Network
      ├─ Persistence
      ├─ Data, Spatial, Simulation, and Input
      └─ Graphics, Camera, and UI contracts
```

The defender host is authoritative. Three.js and PeerJS cannot decide damage,
movement, XP, level changes, room results, or victory.

## Run Locally

```sh
npm ci
npm run dev
```

Open the printed `/Battle-Clash/` URL. Open it in a second browser session to
exercise automatic attacker/defender matching.

Validation:

```sh
npm run check
npm run build
```

## Signaling Server

The Pages build uses the free PeerServer Cloud by default. For a self-hosted
signaling layer:

```sh
npm run server
```

Then configure the client at build time:

```sh
VITE_PEER_HOST=example.com
VITE_PEER_PORT=443
VITE_PEER_PATH=/battle-clash
VITE_PEER_KEY=battle-clash
VITE_PEER_SECURE=true
```

PeerServer performs signaling, not authoritative gameplay. A production
deployment should add its own HTTPS PeerServer and TURN service for difficult
NAT environments.

## Deployment

`.github/workflows/deploy-pages.yml` builds and publishes `dist/` whenever the
default release branch is pushed. The GitHub repository remains private while
the Pages game is public.

See [MASTER_PLAN.md](MASTER_PLAN.md) for the domain and product roadmap.

