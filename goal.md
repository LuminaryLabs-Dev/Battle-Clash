# Battle Clash Goal

## Active Goal

Make Battle Clash a persistent hero-led frontier RPG: the hero leaves a Home
Base, discovers a connected web of 100x100 territories, enters each territory
as its own contested scene, and changes army strength, economy, routes, and
future encounters through ownership and directional fronts. Preserve the
immersive Three.js greybox, deterministic NexusEngine ECS, and PeerJS attack /
defend boundaries.

## Status

The Nexus expansion baseline and persistent Sanctum building proof are
implemented: Flow transition state/readiness is composed with Core Scene and
Runtime Startup, while the Building domain owns deterministic plot collision,
costs, three upgrade tiers, demolition receipts, and economy/army bonuses.
Browser and headless hosts now share procedural building descriptors instead of
reconstructing conflicting block stand-ins. Semantic coverage is 701/701 (100%).
See `docs/NEXUS_EXPANSION_CHECKLIST.md` for the domain-to-kit contract.

Complete locally on `agent/domain-validator` (not pushed to `main`). Home Base, overworld,
territory state, economy ticks, scene transitions, and NexusEngine-backed world,
territory, and combat A* queries are wired and validated. Dynamic landscape
mutation, territory-specific encounter composition, full world rendering,
Sanctum progression, upkeep/trade, PeerJS room authority, and the deterministic
169-territory graph are wired. Active-region streaming keeps only nearby
territories hydrated for rich simulation while the full graph remains a
serializable world contract. Final verification includes `npm run check`,
`npm run build`, `npm run build:pages`, `git diff --check`, and a live browser
run that deployed eight delvers, shattered the Heart, and rendered the victory
receipt with zero console errors.

### Current PR audit lane

The active feature branch is compatible with NexusEngine 0.0.4 semantic domains
and adds deterministic authored room chains plus the content kit. Current proof
is 675/675, with Player harness browser proof green. Main is now the
unprotected development branch; staging/publish review gates, external
Supabase, Rails runtime, OAuth, and hosted PeerServer/TURN remain release gates.

## Acceptance Criteria

- No persistent card, dashboard, objective panel, control row, or diagnostics
  surface remains visible during active play.
- Tiny masked edge sigils expose only party, Heart, and currently available actions.
- Deployment, damage, projectiles, pressure, victory, and loss have readable
  world-owned signals.
- The invoked system menu owns progression, network status, reset, and diagnostics.
- Camera framing preserves the whole room at desktop, compact, and portrait sizes.
- Pointer deployment, combat, win, loss, restart, and keyboard menu access remain playable.
- Core World owns the flat uniform-grid world contract.
- Core Interaction owns scene-specific selection and front/territory intent.
- The game world is data-driven: territory records, hero state, army state,
  economy state, fronts, and landscape revisions are persistent ECS resources.
- Scene transitions are explicit: `sanctum` (Home Base), `overworld` (connected
  map), `territory` (contested 100x100 grid), and `encounter` (directional
  attack/defend front).
- Core Scene also registers a descriptor for every non-sanctum territory
  (`territory:<id>`), carrying its title, kind, grid contract, and front exit;
  the compact `territory` route remains a compatibility alias for the current
  host while `WorldState.currentTerritoryId` selects the active descriptor.
- NexusEngine's A* pathfinder is the navigation solver; dynamic blocked cells
  and landscape costs are owned by the Landscape resource, never by Three.js.
- Core Network owns session, authority, peer, and envelope descriptors.
- Core Persistence owns the profile slot contract; browser storage is only an adapter.
- World persistence stores the connected territory graph, ownership, routes,
  landscape revisions, hero position, army roster, and economy alongside XP.
- Economy storage caps, army upkeep, and Sanctum trading are simulation-owned.
- Sanctum construction is persistent `WorldState`/`BuildingState`: six fixed
  plots validate AABB clearance from the central keep and existing structures;
  four blueprints spend resources, upgrade to level 3, apply derived bonuses,
  and return a bounded 35% refund when demolished.
- Encounter objectives are data-derived from territory kind/front recipes and
  resolve through `ObjectiveState`, not through Three.js or UI state.
- Territory scenes seed settlement, resource, and signature-site entities from
  territory data; landmarks are non-combat ECS entities and are cleared when
  entering an encounter.
- Objective target destruction creates deterministic loot in `LootState`; the
  Sanctum transition collects it into persistent, capped economy resources.
- Sanctum progression unlocks lancer and arcanist army archetypes; deployment
  selection is a semantic ECS command and territory recipes vary scout/bastion
  defenses by kind.
- Frontier pressure advances on deterministic economy ticks, updates encounter
  counts and world A* costs, and surfaces alerts without auto-claiming land.
- Claims issue one-time resource rewards, update faction control summaries, and
  apply settlement/resource landmark production multipliers.
- Controlled territory supply is resolved by a Dawnwatch BFS with serialized
  route distance and efficiency decay; disconnected islands stay isolated.
- Winning a contested encounter now causes the World kit to claim that
  territory once and issue its reward before returning to the Sanctum.
- Hostile pressure can escalate supplied routes into `contested` status,
  reducing production and increasing world A* cost before a claim is lost.
- Player claims propagate pressure into neighboring fronts, changing their
  future encounters and preserving a reactive connected frontier.
- Frontier pressure simulation is bounded to `activeRegionIds`; distant graph
  descriptors remain deterministic snapshots rather than being fully simulated
  every tick.
- `WorldState.factionStrategy` publishes deterministic faction intent, power, and
  prioritized target territories; it is a read model for pressure, encounters,
  and future AI resolution, never a renderer-owned mutation.
- Encounter recipes consume the active territory's front pressure, hostile
  faction, and strategy intent, and publish those inputs in `BattleMetadata` so
  future encounters are reproducibly different as the frontier changes.
- Territory scenes seed the persistent hero as a non-combat ECS entity with a
  `Hero` component; Core World movement synchronizes its position and encounter
  transitions remove it from the combat entity set.
- Moving the hero to a 100×100 territory border discovers the connected
  neighboring territory, records `lastHeroDiscovery`, and emits a discovery
  event without silently entering or claiming that scene.
- Core progression level changes synchronize into `HeroState`, keeping hero
  level, army scaling, and persisted world progression consistent.
- The Progression kit now awards a one-time 18 XP exploration reward for each
  newly discovered territory, including border discoveries resolved by hero
  A*, with receipt IDs persisted and duplicate discoveries rejected.
- First-time settlement, resource, and signature-landmark interactions also
  award a one-time 6 XP exploration receipt through the same Progression API;
  repeat interactions remain economy-only.
- The Core Persistence profile contract serializes route receipts, discovery
  state, faction strategy, ownership, economy, and territory snapshots as one
  versioned world profile.
- PeerJS remote profile handoff synchronizes the received progression level into
  both `HeroState` and `WorldState` before the next authoritative command.
- Flow guards now require a discovered current territory before entering the
  territory scene or encounter; encounter requests must originate from that
  territory and cannot bypass the scene sequence.
- Hero movement now resolves through the Nexus A* navigation service before
  committing, and the resolved route is stored in `HeroState.route` and the
  hero ECS component for authoritative replay and network validation.
- Territory entry now resolves a World A* route first and stores the receipt in
  `HeroState.worldRoute`; grid A* then governs movement inside the territory.
- The overworld renderer projects Core World supply-route status onto graph
  links, distinguishing supplied, contested, isolated, and unresolved routes
  without owning route logic.
- Overworld territory nodes are selectable through the Core Interaction input
  boundary; selection still passes through discovery, World A*, and flow guards.
- Territory scenes seed each authored directional front as a non-combat
  `FrontMarker` ECS entity with faction and pressure, and clear those markers
  when the encounter scene is seeded.
- World commits resynchronize front ECS components and marker palettes so live
  pressure and faction changes remain visible during economy ticks and claims.
- Territory front markers are selectable through the Core Interaction boundary;
  selecting one requests the guarded encounter transition while ground clicks
  continue to resolve hero movement through territory-grid A*.
- Sanctum recruitment now uses the selected unlocked archetype for both local
  and PeerJS commands, keeping multi-unit army growth data-driven end to end.
- Economy exposes deterministic territory-to-Sanctum trade routes with supply
  status, efficiency, capacity, and a persisted last-trade receipt; contested
  routes reduce exchange yield and isolated routes reject route-bound trades.
- Route-bound trades now reject amounts above the route's deterministic
  per-transaction capacity, and multiple controlled territories expose
  independent route IDs rather than sharing one implicit market path.
- Encounter population is derived from territory kind and hostile pressure:
  frontier scenes stay in the 8–12 first-proof band while dungeons and
  strongholds scale into materially larger, deterministic major encounters.
- Initial frontier/wilds pressure now resolves to the readable 8-enemy floor,
  so a level-1 eight-delver deployment can complete the first territory proof
  without changing dungeon or stronghold scaling.
- Encounter room geometry is also derived from territory kind: frontier,
  wilds, dungeon, and stronghold layouts transform the same ECS recipe set into
  distinct obstacle/A* spaces and publish a versioned `layoutId` in
  `BattleMetadata`.
- Dungeon and stronghold recipes now include a data-driven `elite` defense
  archetype; guard objectives target both sentinels and elites, preserving
  objective progress when the frontier escalates.
- Returning to Dawnwatch writes `WorldState.lastSanctumReturn`, recording the
  source territory, deposited loot, before/after resources, and revision for a
  durable encounter → Home Base checkpoint.
- Territory settlement/resource landmarks are selectable through Core
  Interaction; WorldState owns one-time/repeat rewards and persists the latest
  interaction receipt while Three.js remains presentation-only.
- Landmark interactions emit a dedicated Nexus event so economy rewards remain
  observable without conflating them with passive economy ticks.
- Selecting a directional front first resolves a territory-grid A* route to its
  boundary gate, commits the hero route, and only then requests the encounter.
- Landmark selection follows the same rule: the hero resolves a grid A* route
  to the landmark position before the reward interaction is dispatched.
- Combat troops now resolve bounded combat-grid A* paths around living building
  footprints, recording path status/length on their Movement components.
- WorldState landscape hazards are projected as pulsing territory markers from
  the same deterministic hazard descriptors; the renderer does not own hazard
  state or damage.
- Hazard cells carry a deterministic traversal penalty in territory A*, so
  hero routing prefers safer alternatives when the landscape allows them.
- Core Camera intent now frames overworld, Sanctum/territory, and combat with
  distinct bird's-eye poses and zoom, without moving camera authority into
  gameplay state.
- Frontier pressure simulation emits dedicated `FrontChanged` events for
  changed territory fronts, keeping reactive consumers separate from economy
  tick notifications.
- The authoritative PeerJS snapshot contract now carries trade routes,
  landmark descriptors, and landscape hazards alongside WorldState strategy
  and grid data.
- The repository PeerServer layer starts through `npm run server` on
  `/battle-clash` with discovery enabled; a live `/peerjs/id?key=battle-clash`
  probe returns a peer ID before the process is shut down.
- Stronghold encounters now scale into the massive-world major band of 50–100
  deterministic enemies, while frontier proof scenes remain 8–12.
- PeerJS room connections now reject cross-room envelopes and stale/replayed
  sequence numbers before role-specific command or snapshot handling, and pin
  each connection to its first sender identity to reject in-room spoofing.
- The combat path query now has an explicit entity-authoritative contract: it
  resolves the current troop/building graph rather than accepting ignored
  caller coordinates.
- The authored proof graph contains 12 named territories and expands
  deterministically to 169 connected descriptors; world A* resolves
  territory-to-territory routes before territory A* handles the 100x100 grid.
- Core World exposes a bounded `activeRegionIds` window around the current
  territory so nearby scenes can be hydrated while the broad world remains a
  serializable descriptor graph.
- Hero scouting is progression-driven: the persisted `HeroState.discoveryRadius`
  controls active-region hydration, starts at radius 2, grows with level, and is
  synchronized immediately into WorldState and frontier simulation counts.
- Dynamic landscape descriptors are now owned by every territory state. Blocked
  cells and hazards survive leaving and re-entering a territory instead of only
  existing in the current-scene projection.
- Stronghold encounter previews now prove the major-room scale: the Blackglass
  Warden objective seeds a boss and at least 50 health-bearing enemy buildings,
  while frontier rooms retain the smaller first-play footprint.
- Browser territory interactions now honor canonical `territory:<id>` scene IDs,
  so hero movement, directional front selection, and landmark interaction reach
  the Nexus World/Navigation APIs instead of silently returning early.
- The visible Enter Front action now resolves the hero's A* route to the
  highest-pressure hostile gate before requesting the encounter, matching the
  3D directional-front interaction and preserving the territory-navigation
  contract.
- The selected front direction now travels through local and PeerJS scene
  commands into `BattleMetadata`, so the encounter layout, hostile faction, and
  pressure describe the gate the player actually chose.
- Combat A* now treats the authored wall scenery as ECS-owned obstacles along
  with living defensive buildings; route results expose the obstacle count for
  deterministic navigation diagnostics.
- Hero progression now persists level unlocks: `front-command`, `hazard-sight`,
  `rapid-march`, and `siege-command` unlock in sequence. `hazard-sight` already
  lowers Territory A* hazard cost, changing the route selected through a live
  landscape.
- The compact world HUD surfaces hero level, scouting radius, and unlocked
  capabilities without turning the active-play view into a web dashboard.
- Territory ownership now grants kind-specific unlocks: wilds improve food
  production, dungeons unlock arcane expeditions and arcanists, and strongholds
  unlock siege fronts and lancers. These grants persist in WorldState and ArmyState.
- Higher hero unlocks have gameplay effects: `rapid-march` lowers hazard cost to
  the minimum route cost, and `siege-command` expands the deployment budget from
  8 to 10.
- Resolved raid results now expose an explicit Return Home action, completing
  the player-facing encounter → Sanctum transition that deposits loot and
  restores the strategic world view.
- The world HUD no longer offers pre-encounter capture; territory ownership is
  presented as an encounter-owned consequence while the World API remains
  available to authoritative simulation/setup paths.
- Defender-host scene commands now prepare requested territory targets through
  World A* and sequential discovery/entry before opening the encounter, so an
  attacker cannot fall back to the host's default Sanctum/Vault context.
- Attacker loadouts remain client-owned for selection display, while the
  defender host validates the incoming troop archetype against known ECS
  definitions and applies the remote command without granting local unlocks.
- Full world-profile rehydration now proves a reload preserves the Home Base
  scene, controlled stronghold, economy resources, army roster, progression,
  and latest Sanctum return receipt as one durable checkpoint.
- PeerJS snapshots now use a compact dynamic ECS wire projection and bounded
  sequenced chunks; the attacker rehydrates static territory/entity descriptors
  locally and merges defender-owned mutable state without exceeding the data
  channel message ceiling.
- Remote scene hydration now rebuilds the attacker’s local scene before merging
  the host snapshot, so synchronized territory titles, fronts, encounter
  objectives, and directional battle state remain coherent after discovery.
- Encounter pointer deployment now uses the canonical scene-ID predicate, keeping
  perimeter and reserve deployment playable after world-to-encounter transitions.
- A clean two-tab runtime audit now proves PeerJS scene hydration, attacker
  deployment, and shared active-run state through the directional encounter.
- Encounter completion now keeps active-region and landscape resources aligned
  with the claimed territory before loot is deposited at Home Base.
- A clean level-scaled two-tab browser run proves networked Heart victory,
  defender authority, synchronized Home Base return, territory ownership, and
  persisted loot/economy receipts on both peers.
- The private-repository Pages workflow validates the `main`, `staging`, and
  `publish` snapshots and deploys one artifact at the root, `/staging/`, and
  `/publish/`; `/docs` remains a local static fallback.
- Three.js and PeerJS never own gameplay outcomes.
- Deterministic checks, production build, zero-error browser launch, screenshots,
  and human-view acceptance all pass.

## Preserved Release Baseline

The validated development source baseline is on `main` at merge commit
`86f960f`. Promotion PR #2 carries it toward `staging`; after both protected
promotions, `npm run check:tier-baseline` is the parity gate for the shared
baseline tag.

## Later Product Work

- Expand the current deterministic encounter recipes into authored dungeon-room
  layouts, elites, hazards, loot tables, and build choices.
- Add richer territory landmark interactions and multi-route trade decisions
  while preserving the procedural 169-territory graph.
- Authenticated profiles and cloud persistence.
- Hosted PeerServer plus production TURN infrastructure.
- Defender-authored dungeon layouts and seasonal room rotation.
- Original production art, sound, and animation.
