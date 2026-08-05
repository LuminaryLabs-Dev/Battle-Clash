# Battle Clash Memory

## Purpose

Build an original browser dungeon-battle RPG about leveling a delver party and
attacking or defending compact rooms. Do not copy the names, art, characters,
layouts, UI, text, audio, or balance of Clash of Clans, Diablo, or another game.

## Durable Architecture Decisions

- NexusEngine is the deterministic Core runtime and is pinned as an external dependency.
- The feature branch is compatible with NexusEngine 0.0.4 semantic paths (`n:world`,
  `n:network`, `n:runtime:*`, `n:simulation`, `n:spatial`, `n:interaction:*`,
  `n:presentation:*`, and `n:world:scene`); retired `n:core-*` aliases are not
  part of the game contract.
- ECS entities, components, resources, events, and ordered systems own gameplay truth.
- Deep game domains compose NexusEngine Core domains and small atomic kits.
- Core World owns world identity, partitioning, cells, surfaces, focus, and portable lifecycle state.
- Core Network owns sessions, peers, envelopes, sync policy, authority, and reconnect descriptors.
- Core Persistence owns profile-slot contracts; localStorage is a browser adapter.
- The defender peer hosts the authoritative simulation. Attackers send semantic
  commands and receive bounded authoritative snapshots.
- PeerJS is only a transport adapter. The default public build uses PeerServer
  Cloud; the repository also includes an optional self-hosted PeerServer layer.
- The self-hosted PeerServer was smoke-tested locally through `npm run server`
  and its `/battle-clash/peerjs/id?key=battle-clash` discovery endpoint.
- Room discovery uses deterministic room IDs and automatic host election. No
  room code is required for the first attack/defend slice.
- Multiplayer is progressive enhancement: signaling, NAT, or room failure must
  degrade to a fully playable solo run.
- Progression persists XP, level, wins, runs, and perk points. Levels scale
  newly deployed delvers through data, not renderer logic.
- Three.js owns browser input projection and presentation only.
- The playable remains a colored-cube greybox with an orthographic bird's-eye camera.
- Active play is world-first: persistent cards, status dashboards, objective
  panels, control rows, and diagnostics are forbidden over the battlefield.
- The active HUD is limited to tiny masked edge sigils and controls that appear
  only for the current interaction. Progression, networking, reset, and
  diagnostics live in an explicitly invoked system menu.
- Health, deployment legality, combat impact, objective state, pressure, and
  results should be expressed by the owning world object through material,
  light, motion, attached meters, projectiles, runes, and world transformations.
- The persistent frontier loop is Home Base -> overworld -> territory ->
  directional encounter -> ownership/economy/army update -> Home Base.
- World data is authored in `src/data/world.js`; runtime copies live in ECS
  resources (`WorldState`, `SceneState`, `HeroState`, `TerritoryState`,
  `ArmyState`, `EconomyState`, and `LandscapeState`).
- Territory scenes use a 100x100 grid and connected neighbors. Scene transitions
  are mediated by Core Scene and synchronized by the Battle Clash World kit.
- Core Scene registers one `territory:<id>` descriptor per non-sanctum
  territory, while the renderer can continue using the compact territory host
  route with `WorldState.currentTerritoryId` as its active scene payload. The
  canonical Core Scene and `SceneState.current` values now use the descriptor
  ID; the bare `territory` value is accepted only as a compatibility input.
- Navigation queries use NexusEngine's `createAStarPathfinder` with a grid
  adapter. Landscape blocked cells and dynamic costs remain simulation-owned.
- Deep game boundaries now include flow, frontier, hero, army, economy,
  encounter, and sanctum read-model kits alongside the original combat domains.
- World profiles persist separately from XP profiles through the Core Persistence
  adapter contract, preserving discovered/controlled territories and economy.
- Territory claims recalculate supply-route efficiency, unlocks, and encounter
  composition metadata; encounter seeding derives deterministic sentinel counts
  from the active territory.
- Encounter objectives are an atomic `encounter:objectives` ECS kit. Territory
  kind selects relic, pressure, front, or stronghold objectives; combat records
  destroyed entity IDs and the objective kit resolves progress/completion.
- Authored room chains are encounter-domain state: `RoomState` exposes the
  current room, deterministic exits, objective kind, and completed room IDs.
  A won room advances through the chain; the World kit claims a territory only
  after its final room and persists `roomProgress` on that territory.
- Territory descriptors seed renderer-neutral landmark entities for settlement,
  resource, and territory-kind sites. They use `TerritoryMarker` and
  `ResourceNode` components, have no combat health, and are visible only in the
  territory scene; encounter seeding clears them before combat.
- `syncTerritoryFronts` keeps directional front components and Three.js colors
  aligned with authoritative territory pressure/faction state after commits.
- Territory marker selection now routes front intent through the host callback
  and flow guard; non-front ground input remains hero movement.
- Sanctum recruitment forwards the selected `delver`, `lancer`, or `arcanist`
  archetype through the same semantic command for local and remote authority.
- World economy now derives trade routes from supply routes; route-bound trades
  carry efficiency/capacity consequences and persist a deterministic receipt.
- Trade requests enforce each route's capacity as a hard per-transaction bound;
  controlled multi-territory worlds expose one route record per territory.
- Encounter counts use deterministic territory-kind bands and front pressure;
  frontier proof scenes remain small while strongholds become major fights.
- Initial frontier and wilds recipes use a readable 8-enemy floor with a gentler
  pressure contribution, keeping the level-1 eight-delver route winnable while
  dungeon and stronghold pressure scaling remains intact.
- Encounter room geometry uses deterministic territory-kind transforms and
  publishes `BattleMetadata.layoutId`, so A* and obstacle footprints vary with
  the frontier instead of reusing one static room.
- Encounter archetypes include an elite defense building selected by dungeon /
  stronghold recipes; objective guard targets include both elite and sentinel
  IDs so stronger rooms remain objective-driven.
- Sanctum return persists a `lastSanctumReturn` receipt linking loot deposits
  and economy deltas to the territory and WorldState revision.
- Landmark clicks now use a semantic interaction command; resource/settlement
  rewards and repeat counts live in persistent WorldState.
- Landmark rewards emit `LandmarkInteracted` separately from passive economy
  ticks for clean simulation/event boundaries.
- Front selection now requires a resolved hero A* route to the directional gate
  before the encounter transition is authorized.
- Landmark interaction now requires a resolved hero route to the landmark's
  deterministic grid position before rewards are applied.
- Combat navigation uses a bounded A* grid around living building obstacles and
  mirrors the route receipt into troop Movement state.
- Territory hazards now have a dedicated Three.js projection driven by the
  authoritative landscape descriptor.
- Hazard cells contribute a deterministic A* traversal penalty, making the
  landscape simulation affect hero routing rather than only visuals.
- Three.js applies scene-specific Core Camera intents for map, Sanctum/territory,
  and combat framing while keeping camera state outside gameplay resources.
- World economy ticks emit `FrontChanged` only for territories whose directional
  front data actually changed.
- PeerJS snapshot regression covers trade routes, landmarks, hazards, strategy,
  and the 100x100 world grid.
- Stronghold enemy composition now targets a bounded 50–100 major-encounter
  band without inflating frontier proof scenes.
- PeerJS connections enforce room identity and monotonic incoming sequences per
  connection before processing commands or snapshots, and pin the sender ID for
  the lifetime of that connection.
- Combat path queries are explicitly entity-authoritative and no longer expose
  misleading ignored coordinate arguments.
- Objective target destruction creates deterministic `LootState` drops. Loot
  remains in the encounter snapshot until the hero returns to the Sanctum,
  where it is capped into persistent economy storage and then cleared.
- Army composition is data-driven: `delver` is the base troop, Sanctum level 2
  unlocks `lancer`, and level 3 unlocks `arcanist`. Semantic archetype selection
  controls deployment, while enemy recipes vary sentinel/scout/bastion defense
  archetypes by territory kind.
- Frontier pressure advances deterministically during economy ticks. It updates
  front pressures, alert territories, encounter enemy counts, and world A*
  traversal costs while keeping ownership and claims explicit player actions.
- Territory claims now issue a one-time deterministic resource reward, record
  `lastClaimReward`, update persistent faction summaries, and production applies
  settlement/resource landmark multipliers.
- Supply routes now resolve by BFS from Dawnwatch across controlled territory;
  each route records distance and distance-decayed efficiency, while
  disconnected controlled islands remain isolated at reduced efficiency.
- A won encounter in a contested territory now triggers the World kit's
  deterministic completion system, claims that territory for the player once,
  and issues the claim reward before the Sanctum return.
- Hostile pressure can now mark a supplied player route `contested` once its
  enemy-front pressure reaches the threshold; contested routes halve their
  efficiency, increase world A* cost, and remain visible as frontier alerts.
- Player claims propagate a player front into neighboring territories, raising
  their future encounter pressure and ensuring ownership changes reshape the
  connected frontier rather than only one node.
- Frontier pressure simulation is active-region bounded: `frontier.simulatedTerritoryCount`
  records the nearby hydrated set while distant territory descriptors remain
  deterministic snapshots and are not advanced every economy tick.
- `WorldState.factionStrategy` derives deterministic player expansion, neutral
  contest/settle, and hostile raid/pressure/consolidate intents with power and
  prioritized target territory IDs; strategy is a read model, not auto-claim AI.
- Encounter seeding consumes territory front pressure and faction strategy to
  vary scout/sentinel/bastion composition; `BattleMetadata` records the hostile
  faction, pressure, strategy intent, and enemy count for authoritative replay.
- Territory scenes project `HeroState` into one renderer-neutral `Hero` ECS
  entity; movement synchronizes that entity, while encounter seeding clears it
  so the hero remains a world actor rather than a combat target.
- Hero movement at a territory edge auto-discovers the connected neighbor and
  records `lastHeroDiscovery`; entry and ownership remain explicit actions.
- Progression seeding and level gains synchronize `ProgressionState.level` into
  `HeroState.level`, so delver power and hero progression cannot diverge.
- Exploration discovery is progression-owned: each territory grants one
  deterministic 18 XP receipt when first discovered, whether reached through a
  direct map action or hero border A*, and duplicate discovery grants no XP.
- Landmark exploration is progression-owned as well: the first interaction
  with a settlement, resource, or signature site grants one 6 XP receipt, while
  repeat interactions only apply their economy reward.
- The versioned world profile persists route receipts, hero discovery, faction
  strategy, ownership, economy, and territory snapshots together.
- Remote progression profile handoff updates hero and world levels immediately,
  preventing multiplayer clients from using stale hero scaling.
- Scene transition guards enforce sanctum -> overworld -> territory -> encounter
  sequencing, discovered-territory checks, and current-territory identity.
- Hero movement commits only after the Nexus A* query resolves; `HeroState.route`
  and the hero component retain the deterministic path receipt.
- Hero grid positions clamp to the valid 0–99 cell range on the 100×100 grid;
  border discovery still triggers at the final cell instead of storing an
  out-of-grid coordinate.
- Territory entry commits only after World A* resolves a connected route;
  `HeroState.worldRoute` records the territory-level path before grid movement.
- Three.js overworld links read serialized supply-route status for visual color
  and opacity only; route classification remains World/Economy-owned.
- Overworld node pointer selection delegates to the World/Interaction APIs and
  cannot bypass discovery or scene-transition guards.
- Territory front descriptors project to non-combat `FrontMarker` ECS entities
  with faction, direction, and pressure; encounter seeding clears them with the
  rest of the territory presentation layer.
- Sanctum actions are simulation-owned: healing restores army supply for a
  resource cost, recruitment grows the roster, and upgrades increase capacity
  and unlocks. Strongholds can seed a deterministic boss encounter.
- Economy now has storage caps, army upkeep, and Sanctum resource trading.
- The authored proof contains 12 named territories, and the navigation domain
  exposes world-graph, territory-grid, and bounded combat-grid A* queries.
- The current deterministic world expands that authored graph to 169 connected
  territory descriptors; `activeRegionIds` keeps a bounded radius around the
  current territory eligible for rich simulation/presentation while the full
  graph remains lightweight and persistable.
- Hero progression owns scouting reach: `HeroState.discoveryRadius` starts at 2,
  increases on level gains up to 5, and immediately recomputes WorldState active
  regions/frontier hydration so leveling changes the explored simulation window.
- Each territory persists its own generated landscape descriptor, including
  blocked cells, hazards, and revision; current-scene `LandscapeState` hydrates
  from that descriptor and writes changes back to the territory snapshot.
- Stronghold composition is verified as a major encounter: Blackglass Rise
  emits a stronghold-break boss objective, 50+ enemy-count metadata, and 50+
  health-bearing defensive buildings before deployment.
- The Three.js host and browser callbacks must use `isTerritorySceneId` for
  canonical per-territory scenes; bare `territory` remains compatibility input
  only at the scene-command boundary.
- All front entry points, including the compact HUD action, route the hero to a
  selected hostile gate through Territory A* before entering an encounter.
- Directional front selection is authoritative end to end: the chosen gate is
  normalized in PeerJS commands and recorded as encounter `frontDirection`,
  with matching faction and pressure metadata.
- Combat navigation includes wall scenery in its obstacle query, keeping the
  24 authored wall entities authoritative for delver paths rather than merely
  visual geometry.
- Hero unlocks are persisted in progression and HeroState; level 3's
  `hazard-sight` capability lowers hazard traversal cost, while later command
  unlocks remain ready for authored combat/army actions.
- World HUD progression is intentionally compact: hero level, scout radius, and
  unlock labels are shown as one contextual readout while detailed controls stay
  in the system menu.
- Claims are kind-aware: controlled wilds, dungeons, and strongholds publish
  distinct unlock flags, with dungeon/stronghold ownership adding arcanist/lancer
  archetypes to the persistent army state.
- `rapid-march` and `siege-command` are active progression effects, reducing
  hazard traversal cost and increasing the raid deployment budget respectively.
- The terminal encounter HUD has a dedicated Return Home action; Sanctum
  transition remains the owner of loot deposit and Home Base restoration.
- Player HUD capture is intentionally encounter-owned: pre-raid claim shortcuts
  are hidden, while domain-level claim remains available to authoritative tests
  and resolution systems.
- Inbound PeerJS territory/encounter commands use the composition's
  `prepareTerritory` path to validate and hydrate the defender host's world
  before scene transition; route/discovery guards remain authoritative locally.
- PeerJS attacker selection keeps the attacker's unlocked loadout in the local
  HUD; the defender host accepts only known troop archetypes for remote
  selection, preserving authority without making locked archetypes locally
  selectable.
- World-profile rehydration is covered end to end: a saved post-boss return
  restores Sanctum, ownership, economy resources, army roster, progression,
  and the return receipt before the next simulation tick.
- PeerJS authoritative snapshots no longer transmit the full 169-territory
  descriptor graph. Dynamic ECS state is compacted and sent as sequenced
  snapshot chunks; the attacker merges it with deterministic local scene data.
- Remote snapshots hydrate the local scene before overlaying host state, keeping
  attacker territory titles, front objectives, and encounter descriptors aligned
  after a networked discovery transition.
- Encounter canvas input resolves the canonical scene ID at the pointer boundary;
  perimeter deployment and mid-run reserve deployment now dispatch delver ECS
  commands without leaking a territory-only presentation variable.
- A clean two-tab PeerJS audit now reaches the same Ash Crossing directional
  encounter on attacker and defender, synchronizes deployment and active-run
  timer state, and preserves the defender-host authority boundary.
- Encounter-win cleanup now recomputes active regions and rehydrates the
  authoritative LandscapeState alongside ownership, army, economy, and loot
  before the return-to-Sanctum transition.
- A clean level-scaled two-tab browser run proved the complete networked win
  loop: attacker Heart destruction, defender `WON`, synchronized Sanctum
  return, `ash-crossing` ownership, and identical persisted loot/economy
  receipts on both peers.
- Territory neighbor links are normalized from cardinal coordinates into a
  reciprocal graph, so generated perimeter regions remain reachable by World
  A* from the authored Dawnwatch route rather than becoming disconnected data.
- Responsive camera framing derives from projected battlefield bounds instead
  of fixed vertical zoom values, so the full room survives compact and portrait views.
- The private repository keeps `/docs` as a local static fallback, while the
  primary Pages release path builds and publishes `dist/` through GitHub
  Actions on pushes to `main`.
- The Pages artifact workflow runs deterministic simulation checks, then
  deploys on pushes to `main` while still supporting manual dispatch, preserving
  the private-repository/public-Pages boundary.

## Online Foundation And Asset Boundary

- Supabase Auth is the online identity boundary; the companion Rails API is the
  policy and receipt layer, while PeerJS remains the live room transport.
- Durable profile sync uses `battle-clash.profile-snapshot/1` and excludes ECS
  render entities, particles, and per-frame transforms. Offline receipts queue
  locally with idempotency keys until an authenticated API is available. Profile
  snapshots use the server revision endpoint; rejected revisions are preserved
  in a bounded local conflict log and deletion requests are idempotent.
- The backend contract is published privately as
  `LuminaryLabs-Dev/LuminaryLabs-Backend` on `agent/production-foundation`; Rails 8
  and Ruby 3.3 remain required provisioning gates for running it locally.
- Objaverse ingestion is quarantine-first. Only approved catalog entries may
  reach the Three.js asset boundary, with cube fallback retained for missing or
  over-budget GLBs. Review promotion requires three consecutive passing runs.
- Hero combat is an ECS kit at `n:game:battle-clash:hero-combat`; its ability
  emits renderer-only effects and never becomes gameplay authority in Three.js.
- `scripts/validate-domain-coverage.mjs` is the semantic validator gate. It
  verifies 675 structural and behavioral checks across the 38-domain graph,
  ECS vocabulary, archetype fixtures, 169-territory world, scene registry,
  commands, determinism, and the complete Home Base-to-raid-to-Home Base flow.
- `?solo=1` disables PeerJS discovery for deterministic browser-agent audits;
  normal multiplayer room discovery remains the default behavior.
- Authenticated PeerJS rooms now carry a versioned room hello with the account
  UUID, role, profile revision, and browser reconnect token; signed-out peers
  retain the explicit solo/degraded fallback.
- Production content is no longer snapshot-only: `n:game:battle-clash:content`
  owns a serializable `ContentState` for gear inventory/equipment, quest steps,
  crafting receipts, loot promotion, and Sanctum room unlocks. Room wins feed
  that kit; crafting/equip are Sanctum-gated APIs. Local storage and account
  snapshots preserve the content state, while Three.js only presents it.

## Repository And Release

- Local folder: `/Users/crimsonwheeler/Documents/GitHub/Battle-Clash`
- GitHub repository: `LuminaryLabs-Dev/Battle-Clash` (private)
- Public Pages URL: `https://luminarylabs-dev.github.io/Battle-Clash/`
- Primary Pages source: GitHub Actions artifact from `dist/`
- Local fallback artifact: `main` and `/docs`
- Workflow: `.github/workflows/deploy-pages.yml`

## Conventions

- Keep provider SDKs in host/adapter layers.
- Keep commands semantic and snapshots serializable.
- Preserve solo fallback when changing networking.
- Keep active-play UI visually tiny while preserving larger invisible pointer
  targets, keyboard focus, screen-reader labels, and an invoked accessibility surface.
- Update this file by replacing outdated decisions rather than accumulating duplicates.
