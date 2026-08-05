# Battle Clash Master Plan

## Product Direction

Battle Clash is a persistent hero-led frontier RPG, not a village-building
clone. The repeatable loop is:

```txt
load Home Base and persistent world profile
  -> travel the connected overworld
  -> enter a 100x100 territory scene
  -> follow a directional front with A* navigation
  -> run an authoritative deterministic encounter
  -> claim territory and update supply/economy/enemies
  -> return Home Base with a stronger hero and army
```

The greybox uses original colored-cube visuals so systems, readability, and
network authority can be proven before production content.

## First Public Slice

Required player actions:

- Attacker: deploy delvers, start the run, reset or continue.
- Defender: observe the authoritative room, trigger one Heart ward, reset.
- Solo: use attacker controls while matchmaking remains a progressive enhancement.

Active play stays world-first. Tiny masked edge sigils expose only party, Heart,
and currently valid interactions. Progression, network, reset, domain, entity,
and tick details stay inside the invoked system menu.

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
n:runtime:data      schemas, deterministic random, digest contracts
n:spatial           transforms, distances, zones
n:simulation        timers, objectives, ordered resolution
n:interaction:input semantic action contracts
n:network           sessions, peers, envelopes, authority, sync policy
n:runtime:persistence profile slots and adapter contracts
n:presentation:graphics renderer-neutral presentation descriptors
n:presentation:camera camera intent and framing contracts
n:presentation:ui  HUD and accessibility descriptors
n:world:scene       host-neutral scene lifecycle and transitions
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
├─ session
   └─ attack/defend role and authority read model
├─ flow
│  └─ scene routing, transition guards, recovery
├─ frontier
│  └─ directional fronts, supply lines, ownership consequences
├─ hero
│  └─ movement, discovery, scouting
├─ army
│  └─ roster, recruitment, capacity, supply demand
├─ economy
│  └─ production, upkeep, storage, territory bonuses
├─ encounter
│  └─ attack, defense, objectives, dynamic A* composition
└─ sanctum
   └─ Home Base, loadout, healing, upgrades

The encounter domain now has an atomic `encounter:objectives` kit. It derives
objective targets from territory kind and deterministic ECS recipes, tracks
destroyed entity IDs, and publishes progress/completion in `ObjectiveState`.
The renderer only reads that state for the contextual objective prompt.

Territory scenes also seed landmark entities from the same data descriptors:
settlements, resource nodes, and the territory's signature site. These are
renderer-neutral ECS entities with `TerritoryMarker`/`ResourceNode` components,
without combat health, and are cleared when the encounter scene is seeded.

Objective target destruction produces deterministic `LootState` drops. The
Sanctum transition collects those drops into capped persistent economy storage,
keeping encounter rewards inside the simulation/persistence boundary.

Army loadout is also data-driven: the base delver can be joined by Sanctum-
unlocked lancer and arcanist troops, selected through a semantic command before
deployment. Territory recipes mix sentinel, scout, and bastion defenses by
territory kind.

The persistent `WorldState.frontier` clock advances pressure through economy
ticks. Pressure changes encounter counts and world-route costs, and emits alert
territories without silently changing ownership.

Player claims issue a one-time deterministic resource reward, update faction
control summaries, and apply settlement/resource landmark multipliers to the
territory's economy production.

Supply routes are resolved as a Core World BFS from Dawnwatch. Route distance
is serialized and applies deterministic efficiency decay; disconnected claims
remain isolated rather than being treated as supplied by any local neighbor.

The World kit's cleanup system turns a won contested encounter into a single
player territory claim and reward receipt, completing the encounter-to-world
ownership transition before the return-home collection step.

Hostile front pressure can escalate a supplied route into `contested` status.
Contested routes halve production efficiency, increase world A* traversal cost,
and surface as alerts before ownership is threatened.

Claims propagate a player-facing front into neighboring territory descriptors,
raising their pressure and encounter composition so the connected map reacts to
the player's expansion.

Rich frontier pressure simulation is bounded to `WorldState.activeRegionIds`;
the full 169-territory graph remains a lightweight deterministic descriptor set,
with `frontier.simulatedTerritoryCount` exposing the hydrated simulation window.

`WorldState.factionStrategy` now exposes deterministic faction intent (`expand`,
`contest`, `settle`, `raid`, `pressure`, or `consolidate`), power, and prioritized
target territories. This keeps future faction AI and encounter composition
inside the simulation/world boundary without letting strategy silently mutate
ownership.

Encounter seeding consumes the selected territory's current hostile front and
strategy intent. The resulting scout/sentinel/bastion mix and its source values
are serialized in `BattleMetadata`, so pressure and ownership changes alter
future battles deterministically.

Directional front markers are non-combat ECS projections. The World kit
resynchronizes their pressure, faction, and render palette after each committed
territory update, keeping economy ticks and claims visible without making the
renderer authoritative.
Front marker clicks are routed through Core Interaction as directional encounter
intent; only the World/Flow boundary can authorize the resulting scene change.
Sanctum recruitment uses the selected unlocked troop archetype in both local and
PeerJS command paths, preserving data-driven multi-unit army composition.
Economy trade routes are derived from controlled supply routes and expose
efficiency/capacity to the Core Simulation boundary; contested routes reduce
exchange yield while isolated routes cannot service route-bound trades.
Encounter population is derived from territory kind and hostile front pressure:
frontier/wilds remain first-proof scale, while dungeons and strongholds create
larger major encounters within a bounded 50-enemy cap.
Returning to Dawnwatch persists `WorldState.lastSanctumReturn`, a deterministic
receipt linking the source territory, loot deposit, resource delta, and world
revision so the encounter-to-Home-Base loop is durable and auditable.
Territory settlement and resource landmarks are selectable through Core
Interaction; WorldState resolves repeatable rewards and interaction receipts,
leaving Three.js as a projection-only input surface.
The interaction emits a dedicated `LandmarkInteracted` event instead of being
folded into passive economy ticks.
Directional front selection resolves a territory-grid A* route to the selected
boundary gate before the Flow boundary authorizes the encounter transition.
Landmark selection uses the same grid A* approach contract before dispatching
the interaction reward command.
Combat movement also resolves bounded grid A* routes around living building
footprints and records the route receipt on troop Movement state.
Landscape hazards are projected as pulsing territory markers from deterministic
WorldState descriptors; hazard behavior remains inside World/Simulation.
Hazard cells also contribute deterministic traversal penalties to territory A*,
so the landscape changes routing as well as presentation.
Core Camera intent now supplies distinct bird's-eye framing for overworld,
Sanctum/territory, and combat scenes without entering gameplay state.
Frontier ticks emit dedicated `FrontChanged` events for changed directional
fronts, rather than forcing consumers to diff every economy tick.
The authoritative snapshot envelope also carries trade routes, landmarks,
hazards, strategy, and grid data for reconnect and attacker read-model parity.
Stronghold recipes scale into a bounded 50–100 enemy major-encounter band,
while frontier proof scenes retain their smaller deterministic population.
The combat path API is explicitly entity-authoritative, keeping route queries
aligned with live troop/building ECS state.

The hero is also a persistent ECS projection in territory scenes: its `Hero`
component and position mirror `HeroState`, making discovery and movement part of
the world/entity contract while keeping the hero out of combat targeting.

When the hero reaches a 100x100 grid edge, Core World discovers the adjacent
territory and records a discovery event. This expands the player's known graph
without conflating scouting with scene entry or territory ownership.

Core progression now synchronizes level gains into the persistent hero state,
keeping hero level, army scaling, and saved world progression on one contract.

The flow boundary now rejects unknown scenes, undiscovered territory entry,
encounter requests from Home Base/overworld, and encounter territory mismatches.
The Core Scene transition ledger remains the transport; Battle Clash owns these
game-specific guards.

The versioned Core Persistence world profile serializes the complete connected
world read model, including hero route receipts, discoveries, faction strategy,
ownership, economy, and territory snapshots.

PeerJS profile handoff also synchronizes the received progression level into
`HeroState` and `WorldState` before authoritative commands are accepted.

Hero movement also commits only after the Nexus A* query resolves. The resulting
path receipt is stored in `HeroState.route` and mirrored on the hero entity, so
the network host can reject blocked movement and replay the same route.

Territory entry now resolves World A* before committing the scene transition and
stores `HeroState.worldRoute`; the territory grid A* route is then resolved for
local movement, keeping the two navigation layers explicit.
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
ObjectiveState    territory-derived target IDs and objective progress
ProgressionState  XP, level, runs, wins, perks, last reward
DefenseState      ward charges and use receipt
SessionState      role, room, peer, status, authority
BattleMetadata    scenario, seed, version
SceneState        current scene and transition ledger
WorldState        connected territory graph, ownership, routes, unlocks
HeroState         hero position, level, discovery radius
TerritoryState    current territory, fronts, economy, landscape revision
ArmyState         roster, power, supply, capacity
EconomyState      resources, rates, production clock
LandscapeState    100x100 walkability, blocked cells, hazards
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
- Dawnwatch Sanctum owns healing, recruitment, and capacity upgrades; costs are
  paid from the persistent economy and upgrades add deterministic unlocks.
- The browser adapter stores the portable profile in localStorage.
- Multiplayer hosts temporarily use the attacker's portable profile for party scaling.
- Account identity, inventory, cloud saves, and anti-cheat remain later server work.

## Host Boundaries

Three.js owns:

- Canvas and resize lifecycle.
- Projected-bounds orthographic framing, lighting, polished cube meshes, attached
  damage meters, deployment runes, projectiles, and terminal world effects.
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
├─ docs/
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
- Better movement, enemy telegraphs, audio, and camera feel while preserving the
  world-first interaction-specific UI contract.

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
- A push to `main` triggers the Pages Actions workflow and publishes `dist/`
- public URL loads, plays, and reports no console errors
