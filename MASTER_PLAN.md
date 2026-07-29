# Battle Clash Master Plan

## Product Direction

Battle Clash is a compact dungeon attack/defend RPG, not a village-building
clone. The repeatable loop is:

```txt
load persistent delver profile
  -> auto-discover an attack/defend room
  -> deploy a party around the dungeon
  -> run an authoritative deterministic battle
  -> earn XP and levels
  -> begin a stronger run
```

The greybox uses original colored-cube visuals so systems, readability, and
network authority can be proven before production content.

## First Public Slice

Required player actions:

- Attacker: deploy delvers, start the run, reset or continue.
- Defender: observe the authoritative room, trigger one Heart ward, reset.
- Solo: use attacker controls while matchmaking remains a progressive enhancement.

Hero controls stay on the first screen. Domain, room, entity, and tick details
stay inside the Advanced foldout.

## Authority And Room Structure

```txt
PeerServer signaling layer
└─ deterministic room directory
   ├─ room 0
   ├─ room 1
   └─ bounded overflow rooms

one attack/defend room
├─ defender host
│  ├─ owns the NexusEngine instance
│  ├─ accepts validated semantic commands
│  ├─ advances deterministic ECS ticks
│  └─ publishes authoritative snapshots
└─ attacker peer
   ├─ sends deploy, start, and reset commands
   ├─ renders authoritative snapshots
   └─ persists awarded progression
```

The first client claims a deterministic room ID. If that ID is already claimed,
the next client receives a random peer ID and connects as attacker. Filled or
failed rooms move discovery to the next bounded room. If signaling or WebRTC
cannot connect, the client remains fully playable in solo mode.

PeerJS and PeerServer only broker and transport. They do not own combat,
progression, validation, or results. A production networking phase should add a
hosted HTTPS PeerServer, TURN, authentication, abuse limits, and signed profile
receipts.

## Domain Boundaries

### NexusEngine Core

```txt
n:world             world identity, cells, surface, focus, snapshots
n:core-data         schemas, deterministic random, digest contracts
n:core-spatial      transforms, distances, zones
n:core-simulation   timers, objectives, ordered resolution
n:core-input        semantic action contracts
n:core-network      sessions, peers, envelopes, authority, sync policy
n:core-persistence  profile slots and adapter contracts
n:core-graphics     renderer-neutral presentation descriptors
n:core-camera       camera intent and framing contracts
n:core-ui           HUD and accessibility descriptors
```

### Deep Game Domains

```txt
n:game:battle-clash
├─ world
│  └─ authored Obsidian Vault over Core World
├─ deployment
│  └─ delver budget and legal perimeter commands
├─ targeting
│  └─ deterministic target priorities
├─ navigation
│  └─ target approach and stopping range
├─ combat
│  └─ cooldowns, damage, destruction, projectile state
├─ defense
│  └─ defender Heart ward
├─ raid
│  └─ deploy, active, won, lost, and reset lifecycle
├─ progression
│  └─ XP, levels, perk points, and power scaling
└─ session
   └─ attack/defend role and authority read model
```

Each game domain is installed as an atomic domain service kit with explicit
requirements, services, ownership, and non-ownership metadata.

## ECS Truth

Components:

```txt
Identity  Position  Faction  Renderable  Footprint
Health    Attack    Targeting  Movement
Troop     Building  Defense
```

Resources:

```txt
RaidState         lifecycle, timer, result, destroyed count
DeploymentState   party budget, selected archetype, receipts
CommandQueue      deploy, start, reset, fortify
EffectsState      renderer-neutral projectile effects
ProgressionState  XP, level, runs, wins, perks, last reward
DefenseState      ward charges and use receipt
SessionState      role, room, peer, status, authority
BattleMetadata    scenario, seed, version
```

Events:

```txt
deployment accepted / rejected
target acquired
attack resolved
entity destroyed
raid started / completed / reset
progression awarded / level gained
defense fortified
session changed
```

System order:

```txt
input
  -> validate commands
  -> deploy, start, reset, or fortify
simulate
  -> target
  -> navigate
resolve
  -> attack and damage
cleanup
  -> raid result
  -> destruction
  -> progression award
  -> committed snapshot
```

## Progression Model

- A win awards base XP plus structure-destruction XP.
- A loss still awards a smaller amount so a run always advances the profile.
- XP rolls through deterministic level thresholds.
- Each level grants one perk point and raises newly deployed delver health and damage.
- The browser adapter stores the portable profile in localStorage.
- Multiplayer hosts temporarily use the attacker's portable profile for party scaling.
- Account identity, inventory, cloud saves, and anti-cheat remain later server work.

## Host Boundaries

Three.js owns:

- Canvas and resize lifecycle.
- Orthographic camera, lighting, cube meshes, and health bars.
- Pointer-to-ground raycasting.
- Visual-only interpolation and projectile meshes.

Three.js does not own:

- Deployment legality.
- Targeting, navigation, damage, death, raid results, XP, or levels.
- Session roles or network authority.

PeerJS owns:

- Signaling-client lifecycle.
- WebRTC data connections.
- Delivery of validated message envelopes.

PeerJS does not own:

- Game commands after validation.
- Simulation timing or snapshots.
- Persistence or progression meaning.

## Repository Shape

```txt
Battle-Clash/
├─ .agent/
├─ .github/workflows/deploy-pages.yml
├─ server/peer-server.mjs
├─ scripts/validate-simulation.mjs
├─ src/
│  ├─ composition/
│  ├─ data/
│  ├─ domains/
│  │  ├─ combat/
│  │  ├─ defense/
│  │  ├─ deployment/
│  │  ├─ navigation/
│  │  ├─ progression/
│  │  ├─ raid/
│  │  ├─ session/
│  │  ├─ shared/
│  │  ├─ targeting/
│  │  └─ world/
│  ├─ hosts/three/
│  ├─ network/
│  ├─ persistence/
│  ├─ main.js
│  └─ styles.css
├─ goal.md
├─ memory.md
├─ README.md
└─ package.json
```

## Delivery Phases

### Phase 1: Public systems greybox

- Deterministic dungeon battle.
- Attacker/defender PeerJS room.
- Solo fallback.
- Persistent XP and levels.
- Human-view and two-browser proof.
- GitHub Pages deployment.

### Phase 2: Dungeon depth

- Multiple room data sets, bosses, hazards, elites, and encounter modifiers.
- Delver classes, gear, perks, and meaningful build choices.
- Defender layout choices with validated budgets.
- Better movement, telegraphs, feedback, audio, and camera feel.

### Phase 3: Production services

- Hosted signaling and TURN.
- Authenticated accounts and cloud profiles.
- Server-issued result and progression receipts.
- Matchmaking regions, reconnection, rate limits, moderation, and telemetry.

### Phase 4: Original content production

- Original art direction, characters, animation, sound, narrative, and balance.
- Accessibility, mobile interaction, performance budgets, and content pipeline.

## Release Gates

- `npm ci`
- `npm run check`
- `npm run build`
- no diff whitespace errors
- solo browser flow with no console errors
- two independent browser sessions auto-match as defender and attacker
- attacker command produces synchronized authoritative state
- defender ward produces synchronized authoritative state
- two runs visibly produce a level gain
- `main` push triggers a successful Pages workflow
- public URL loads, plays, and reports no console errors
