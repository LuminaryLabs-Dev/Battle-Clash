# Battle Clash Master Plan

## Summary

Battle Clash will be an original, small browser village-battle game. The first
playable is a deterministic greybox: colored cubes on a square battlefield,
viewed through a bird's-eye orthographic Three.js camera.

The architecture is deliberately layered:

```txt
Browser shell
└─ Three.js host adapters
   └─ renderer-neutral descriptors
      └─ Battle Clash composition
         ├─ deep game domains
         │  └─ atomic game kits
         └─ NexusEngine Core domains
            └─ ECS, resources, events, scheduler, snapshots
```

Gameplay flows outward from ECS state to descriptors to Three.js. Input flows
inward as semantic intents. Three.js never decides damage, targeting, economy,
placement validity, movement, victory, or progression.

## Product Shape

### First playable claim

The player sees one compact enemy village, deploys a limited group of units
along the map edge, starts a short raid, and watches units acquire targets,
move, attack, take defensive fire, and either destroy the enemy Core or fail.

### Required first-screen actions

Hero controls:

- Select troop type.
- Deploy troop.
- Start raid.
- Reset battle.

Advanced foldout:

- World seed.
- Simulation speed.
- Grid and path overlays.
- ECS/entity inspector.
- Snapshot save/load controls.
- Camera tuning and diagnostics.

### Explicitly deferred

- Village editing and persistent building construction.
- Multiple currencies and long-term upgrades.
- Online multiplayer, clans, chat, matchmaking, or asynchronous attack servers.
- Monetization, accounts, cloud saves, production art, audio, and animation.

## Visual Target

```txt
Camera        orthographic, angled bird's-eye, fixed readable battlefield
Ground        muted green plane with a subtle square grid
Player units  blue cubes
Enemy units   red cubes
Enemy Core    purple tall cube
Defenses      dark red cubes
Walls         gray low cubes
Resources     orange cubes
Projectiles   yellow small cubes
Selection     cyan outline or ground marker
Blocked tile  translucent red
Valid tile    translucent green
```

The camera should frame the whole first battlefield at spawn. Pan and zoom may
be added later, but they must not be required to understand the first raid.

## Domain Architecture

### Core layer

`n:realtime`

- Owns ECS entities, components, resources, events, queries, scheduler phases,
  deterministic ticks, and lifecycle surfaces.

`n:core-world`

- Owns world identity, seed, flat surface mapping, uniform-grid partitioning,
  cell identity/lifecycle, focus, provider status, portable snapshots, and
  deterministic diagnostics.
- Does not own authored buildings, units, combat rules, Three.js meshes, GPU
  state, or game-specific content.

`n:core-object` and `n:object:placement`

- Own renderer-neutral object identity, intrinsic bounds, pivots, ground
  anchors, world transforms, grounding, fitting, overlap checks, and placement
  validation.
- Do not own building costs, construction rules, target priorities, or meshes.

`n:core-data`

- Owns state contracts, schemas, selectors, reset/load semantics, deterministic
  random streams, completion/idempotency ledgers, and state digests.

`n:core-spatial`

- Owns transforms, bounds, zones, distances, and query descriptors.

`n:core-simulation`

- Owns generic resources, timers, cooldowns, objectives, proposal ordering,
  resolution policy, and committed deterministic frames.
- Does not own Battle Clash fiction or balance.

`n:core-input`

- Owns semantic actions and action state, not DOM or gameplay outcomes.

`n:core-camera`

- Owns camera intent, target, framing policy, and zoom descriptors, not the
  `THREE.OrthographicCamera`.

`n:core-graphics`

- Owns renderer-neutral mesh, material, light, visibility, and effect
  descriptors, not WebGL objects.

`n:core-ui`

- Owns HUD, prompt, selection, notification, and accessibility descriptors,
  not concrete DOM.

`n:core-physics`

- Owns backend-neutral collider/contact/query contracts when needed. The first
  playable should prefer deterministic grid/spatial rules over a full physics
  backend.

### Deep game-domain layer

`battle-clash.world`

- Composes Core World, Object, Placement, and Spatial.
- Owns the authored battlefield definition, deployment perimeter, village
  zones, walkability data, and mapping from authored cells to game entities.

`battle-clash.roster`

- Owns unit and building archetype data, team/faction data, spawn recipes, and
  entity creation policy.

`battle-clash.deployment`

- Owns troop inventory for the current raid, legal edge deployment, deployment
  commands, and deployment receipts.

`battle-clash.navigation`

- Owns target-reachable grid data, path requests, paths, movement intent, and
  blocked-cell policy.
- Uses Core Spatial and world cell data; it does not mutate combat health.

`battle-clash.targeting`

- Owns candidate evaluation, target priority data, target selection, target
  loss, and retarget events.
- Reads spatial and faction data; it does not apply damage.

`battle-clash.combat`

- Owns attack requests, ranges, cooldown use, damage resolution, health
  mutation policy, destruction receipts, and projectile gameplay descriptors.
- It does not create Three.js projectiles.

`battle-clash.defense`

- Composes targeting and combat for stationary defensive entities.
- Owns defense-specific authored policy, not generic health or targeting APIs.

`battle-clash.raid`

- Orchestrates setup, ready, active, won, lost, and reset states.
- Owns the timer, victory conditions, star/result calculation for this game,
  and the authoritative raid result.

`battle-clash.presentation`

- Converts ECS/game-domain read models into Core Graphics, Camera, and UI
  descriptors.
- It never mutates authoritative gameplay state.

### Atomic kit layer

Each game domain is implemented through small idempotent kits:

```txt
world
├─ battlefield-definition-kit
├─ deployment-perimeter-kit
└─ battlefield-entity-spawn-kit

roster
├─ archetype-catalog-kit
└─ entity-recipe-kit

deployment
├─ troop-budget-kit
└─ edge-deployment-kit

navigation
├─ grid-walkability-kit
├─ path-request-kit
└─ path-follow-kit

targeting
├─ target-candidate-kit
└─ nearest-priority-target-kit

combat
├─ health-kit
├─ attack-cooldown-kit
├─ damage-resolution-kit
└─ destruction-kit

raid
├─ raid-lifecycle-kit
├─ victory-condition-kit
└─ raid-reset-kit

presentation
├─ battle-render-descriptor-kit
├─ battle-camera-descriptor-kit
└─ battle-hud-descriptor-kit
```

These remain game-local until evidence proves that a kit is reusable,
renderer-neutral, deterministic, independently testable, and appropriate for a
trusted registry.

## ECS Data Model

### Components

```txt
Identity         stable game id and archetype id
Faction          player, enemy, or neutral
Transform        position, facing, and scale descriptor
GridFootprint    occupied cells and placement anchor
Renderable       renderer-neutral shape/material descriptor id
Health           current and maximum hit points
Attack           damage, range, cooldown, projectile style
Targeting        priority policy and current target entity
Movement         speed, path, waypoint index, and movement status
Building         building role and destruction value
Troop            troop role and deployment cost
Defense          defense role and firing state
ResourceStore    resource kind and amount, initially visual/read-only
PendingDamage    ordered damage proposals for resolution
PendingDespawn   deterministic removal marker
```

### Resources

```txt
BattleConfig       immutable balance and archetype tables
BattlefieldConfig  authored grid, zones, and initial entity recipes
RaidState          lifecycle, time remaining, result, and score
DeploymentBudget   remaining troop counts
SelectionState     selected troop and hovered deployment cell
```

### Events

```txt
deployment.requested / accepted / rejected
target.acquired / lost
attack.requested / resolved
damage.applied
entity.destroyed
raid.started / won / lost / reset
```

### System order

```txt
input
  semantic input -> deployment/start/reset requests
simulate
  navigation -> targeting -> attack proposals -> defense proposals
resolve
  ordered damage -> health -> destruction -> victory evaluation
cleanup
  despawn -> descriptor refresh -> committed snapshot/digest
```

No system directly mutates Three.js objects.

## Data-Driven Content

Authored content lives in plain JavaScript or JSON-compatible records:

```txt
data/archetypes/buildings
data/archetypes/troops
data/balance/combat
data/battlefields/first-village
data/presentation/colors
```

Changing a cube color, hit points, attack range, grid footprint, deployment
count, or battlefield layout must not require changing a system.

## Three.js Host Boundary

The Three.js host owns:

- Browser canvas and resize lifecycle.
- `THREE.Scene`, `THREE.WebGLRenderer`, and `THREE.OrthographicCamera`.
- Cube geometry and material caching.
- Descriptor-to-mesh creation and synchronization.
- Raycasting from pointer to ground cell.
- Visual interpolation between committed ECS transforms.
- Selection markers, valid/invalid cell overlays, and visual-only projectiles.

The host does not own:

- Entity health or destruction.
- Grid occupancy or placement validity.
- Target selection, paths, attack cooldowns, or damage.
- Raid state, score, victory, economy, or persistence.

## Proposed Repository Shape

```txt
Battle-Clash/
├─ .agent/
│  ├─ goal-packets/
│  ├─ feedback-packets/
│  ├─ start-here.md
│  ├─ intention.md
│  ├─ goal.md
│  ├─ workflow.md
│  ├─ memory.md
│  ├─ feedback.md
│  └─ change-log.md
├─ AGENTS.md
├─ README.md
├─ MASTER_PLAN.md
├─ goal.md
├─ memory.md
├─ package.json
├─ index.html
└─ src/
   ├─ main.js
   ├─ composition/
   │  └─ battle-clash-composition.js
   ├─ data/
   │  ├─ archetypes.js
   │  ├─ balance.js
   │  ├─ battlefield.js
   │  └─ presentation.js
   ├─ domains/
   │  ├─ world/
   │  ├─ roster/
   │  ├─ deployment/
   │  ├─ navigation/
   │  ├─ targeting/
   │  ├─ combat/
   │  ├─ defense/
   │  ├─ raid/
   │  └─ presentation/
   └─ hosts/
      ├─ browser/
      │  ├─ input-adapter.js
      │  └─ ui-adapter.js
      └─ three/
         ├─ three-host.js
         ├─ descriptor-adapter.js
         └─ picking-adapter.js
```

Only the documentation and `.agent/` files exist during planning. Code files
are created only after explicit implementation authorization.

## GitHub And Branch Plan

Local folder:

```txt
/Users/crimsonwheeler/Documents/GitHub/Battle-Clash
```

Remote:

```txt
LuminaryLabs-Dev/Battle-Clash
visibility: private
```

Initial branch:

```txt
agent/planning-foundation
```

Do not create or push `main` during planning. A later default-branch decision
requires explicit user direction.

### Deployment workflow

`.github/workflows/deploy-pages.yml` listens only for pushes to `main`. When a
future implementation is pushed there, it must:

- install exactly from the committed npm lockfile with `npm ci`
- run the repository's `npm run build`
- require `dist/index.html`
- upload only `dist/`
- deploy through GitHub Pages with minimal Pages permissions

The workflow can exist safely on the planning branch without deploying it.
There is no `main` branch or deployable application yet.

## Implementation Sequence

### Phase 0: planning repository

- Create the local repository and agent workspace.
- Commit only planning documents.
- Create the private GitHub repository.
- Push only `agent/planning-foundation`.

### Phase 1: deterministic headless foundation

- Add the NexusEngine dependency through a public package entrypoint.
- Compose ECS, Core Data, Core World, Core Object/Placement, Core Spatial, and
  Core Simulation.
- Register `battle-clash-greybox` with a flat surface and uniform grid.
- Load archetype and battlefield data.
- Spawn initial entities and prove deterministic reset/snapshot behavior.

### Phase 2: raid state

- Add deployment, navigation, targeting, combat, defense, and raid domains.
- Implement one ordered deterministic tick pipeline.
- Reach win/loss/reset without a renderer.

### Phase 3: descriptor presentation

- Add Graphics, Camera, and UI descriptors.
- Convert committed ECS state to cube/material/camera/HUD descriptors.
- Keep all descriptors serializable and renderer-neutral.

### Phase 4: Three.js browser host

- Add orthographic camera, scene, lights, ground grid, cube mesh cache, picking,
  and semantic input adapters.
- Render one full raid without gameplay logic inside the host.

### Phase 5: human-view refinement

- Capture and review initial spawn, troop selection/deployment, active raid,
  target attack, destruction, victory, loss, and reset states.
- Fix the highest-visibility issue before adding more systems.

### Phase 6: optional expansion

- Village edit mode.
- Resource collection and building upgrades.
- More troop/defense archetypes.
- Save/load UX.
- Kit promotion review for genuinely reusable game-local atomic kits.

## Validation

### Architecture gates

- Every state owner has explicit `owns` and `doesNotOwn` boundaries.
- Every atomic kit is idempotent and declares dependencies.
- Core is consumed only through public exports.
- Game domains do not mutate one another directly.
- Three.js imports appear only under `src/hosts/three`.
- DOM side effects appear only under browser/host adapters.

### Determinism gates

- Same seed plus same semantic inputs produces the same committed digest.
- Snapshot, advance, restore, and replay reaches the same result.
- Reset returns entity/resource/event state to the authored baseline.
- Damage and destruction ordering is stable.

### Browser gates

- App starts with no console errors.
- Canvas resizes without stretching or changing simulation state.
- Pointer selection maps to the correct world cell.
- A full raid can be completed and reset.

### Human-view acceptance

- Initial spawn: the full battlefield, enemy Core, defenses, and deployment
  perimeter are immediately readable.
- Deployment view: selected troop, valid cell, invalid cell, and remaining troop
  count are visually distinct.
- Active raid: blue attackers and red defenders separate clearly; paths and
  attacks are understandable without a debug panel.
- Objective view: the enemy Core is visually dominant.
- Victory/loss: result and reset action are unmistakable.
- The first screen contains only the four hero controls; diagnostics remain
  folded away.

## Risks And Controls

- Similarity risk: use only genre-level inspiration; keep the name, visual
  language, copy, content, balance, and layouts original.
- Domain leakage: require explicit ownership metadata and reject renderer-side
  gameplay.
- Overbuilding: stop at one battlefield, one troop type, one defense type, one
  Core target, and one raid result until human-view proof passes.
- Core drift: pin a known NexusEngine revision and use public exports; update
  only after compatibility validation.
- Dirty sibling repositories: do not edit or absorb changes from the existing
  NexusEngine or NexusEngine-Experiments worktrees.

## Definition Of Ready To Implement

- User explicitly authorizes implementation.
- NexusEngine revision and dependency strategy are selected.
- The first playable claim and deferred scope remain accepted.
- The implementation branch is confirmed and is not `main`.
- The visual color key and hero controls are accepted.
