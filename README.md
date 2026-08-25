# Battle Clash

Battle Clash is an original browser frontier-RPG greybox. Lead a hero from a
Home Base through connected 100x100 territories, resolve directional fronts
with A*, grow the army and economy, and shatter or protect a territory's
Dungeon Heart.

Play: <https://luminarylabs-dev.github.io/Battle-Clash/>

## First Playable

- Isometric Three.js battlefields with deterministic procedural fortifications,
  towers, vaults, walls, and a readable Dungeon Heart silhouette.
- World-first active play with tiny masked interaction sigils instead of a dashboard.
- Rounded cube silhouettes, layered lighting, deployment runes, attached damage
  feedback, projectile trails, terminal shockwaves, and responsive camera framing.
- Deterministic NexusEngine ECS movement, targeting, combat, destruction, and results.
- Nexus Core World uniform-grid world state.
- PeerJS automatic room election and discovery with defender-host authority.
- Attacker deployment commands and synchronized authoritative snapshots.
- One defender fortification ward per run.
- Persistent XP, levels, wins, runs, perk points, and level-based party power.
- Fully playable solo fallback when no peer is available.
- Home Base, overworld, territory, and encounter scenes with persistent world state.
- Deterministic landscape hazards and blocked cells that reroute A* movement.
- Territory claims update supply routes, unlocks, economy efficiency, and future
  encounter composition.
- The overworld graph colors supplied, contested, and isolated routes from the
  authoritative world snapshot.
- Visible territory nodes can be selected directly to follow the connected
  discovery and entry flow.
- Territory scenes show directional front markers sourced from faction pressure
  data before the player enters combat.
- Twelve authored territories now form the mid-scale connected world proof;
  world A* routes precede territory-grid A* movement.
- Economy storage, army upkeep, Sanctum recruitment/healing/upgrades, and
  resource trading are persistent simulation state.
- Dawnwatch has six selectable construction plots and four persistent building
  blueprints: Delver Hall, Ember Foundry, Frontier Watch, and Vault Storehouse.
- Building placement uses renderer-neutral AABB collision, deducts authoritative
  resources, upgrades through three visual/gameplay tiers, applies army,
  production, defense, scouting, and storage bonuses, and supports a 35% demolition refund.

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
   ├─ flow, world, frontier, hero, army, economy, building
   ├─ encounter, sanctum, raid, deployment, navigation, targeting, combat
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

For deterministic browser-agent audits, append `?solo=1` to disable PeerJS
discovery for that tab. This leaves normal multiplayer behavior unchanged.

Validation:

```sh
npm run check
npm run check:buildings
npm run build
```

Headless Editor review:

```sh
NEXUS_ENGINE_EDITOR_PATH=/path/to/NexusEngine-Editor/src/headless/index.js \
  npm run review:headless
```

The game-owned adapter at
`src/hosts/headless/battle-clash-headless-adapter.js` imports the real
NexusEngine composition, projects the stable `deploy-slot` target through the
real Three.js camera, raycasts it, calls `deployAt()` and `startRaid()`, advances
the fixed simulation, and emits before/after image and state evidence. It does
not move combat, deployment, or victory truth into Three.js and does not require
Chromium or Xvfb.

The procedural generator can also emit a renderer-neutral review descriptor:

```sh
npm run generate:building -- watchtower 2 artifacts/buildings/watchtower-level-2.json
```

Controls:

- Click a glowing perimeter rune to deploy a delver.
- In Dawnwatch, click a blue plot, cycle the building plan, then build; click an
  occupied structure to upgrade or demolish it.
- `1` toggles deployment focus and `Space` begins the run.
- `F` invokes the defender ward when it becomes available.
- `Escape` opens the system menu; reset and diagnostics stay inside it.

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

Battle Clash uses three ordered branch tiers: `main` (development), `staging`
(production staging), and `publish` (production). The policy and promotion requirements are in
[`docs/BRANCH_TIERS.md`](docs/BRANCH_TIERS.md).

The tiered Pages workflow builds the three public branches into one Pages site:

Nexus ownership and the expansion checklist are documented in
[`docs/NEXUS_EXPANSION_CHECKLIST.md`](docs/NEXUS_EXPANSION_CHECKLIST.md).

- Development: <https://luminarylabs-dev.github.io/Battle-Clash/>
- Staging: <https://luminarylabs-dev.github.io/Battle-Clash/staging/>
- Production: <https://luminarylabs-dev.github.io/Battle-Clash/publish/>

GitHub Pages gives one site per repository, so staging and production use stable subpaths of the
same private-repository Pages site rather than pretending each branch is a
separate Pages project.

For a local static fallback, refresh the checked-in `/docs` artifact with:

```sh
npm run build:pages
```

`.github/workflows/deploy-pages.yml` rebuilds production, staging, and publish
after a push to any of those branches; manual dispatch remains available.
Configure repository Pages to use GitHub Actions. The GitHub repository remains
private while the Pages game is public.

Use `.github/workflows/promote-tier.yml` to open a checked promotion PR in the
only permitted order: `main -> staging -> publish`. The promotion
workflow does not merge or push to `main`.

See [docs/TIER_MAINTENANCE.md](docs/TIER_MAINTENANCE.md) for baseline parity,
promotion, drift checks, and recovery procedures. The weekly tier maintenance
workflow also provides manual baseline and promotion audits.

See [MASTER_PLAN.md](MASTER_PLAN.md) for the domain and product roadmap.

## Online and asset boundaries

The companion Rails API skeleton lives locally at
`/Users/crimsonwheeler/Documents/GitHub/LuminaryLabs-Backend`. It owns
Supabase-authenticated identity, durable profile snapshots, idempotent receipts,
sync cursors, and approved asset metadata. The browser remains playable while
signed out and queues receipts locally until an authenticated backend is
configured. Copy `.env.example` to a local environment file to configure the
Supabase URL, anon key, and Rails API URL; never commit credentials.

Supabase Auth supports email/password through the in-game account boundary and
Google OAuth through `signInWithProvider("google")`. Configure the Supabase
redirect URL to the Pages origin before enabling the OAuth control; passwords
never pass through Battle Clash or Rails. The folded system menu also exposes
profile sync, JSON export, and idempotent deletion without covering active play.

Objaverse tooling is quarantine-first under `tools/objaverse/`. Only entries in
`src/assets/approved-manifest.json` may cross the runtime asset boundary. The
Three.js host falls back to the existing cube descriptors when a catalog entry
is missing or over budget.
