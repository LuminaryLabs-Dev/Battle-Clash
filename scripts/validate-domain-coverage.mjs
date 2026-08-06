import { mkdir, writeFile } from "node:fs/promises";
import { createBattleClashGame } from "../src/composition/create-battle-clash.js";
import { ARCHETYPES } from "../src/data/battlefield.js";
import { TERRITORIES, WORLD_SCENES, sceneForTerritory } from "../src/data/world.js";
import { Components, Events, Resources } from "../src/domains/shared/definitions.js";
import { createPeerMessage, normalizePeerCommand, parsePeerMessage } from "../src/network/peer-protocol.js";
import { APPROVED_ASSETS, ASSET_CATALOG_SCHEMA, assetById, resolveRenderableAsset, validateAssetEntry } from "../src/assets/catalog.js";
import { createReviewRun, promoteAfterConsecutivePasses, reviewPassAccepted } from "../src/assets/asset-review.js";
import { createAuthenticatedHello, validateAuthenticatedHello, validateCommandEnvelope, createMatchReceipt, acceptMatchReceipt } from "../src/network/peer-room-contract.js";
import { normalizePlayerObservation, playerObservationKey } from "../src/domains/player/player-observation.js";
import {
  PRODUCTION_CONTENT_SCHEMA, CONTENT_TERRITORIES, ROOM_TYPES, ENEMY_FAMILIES,
  BOSS_PHASES, GEAR_ITEMS, QUESTS, CRAFTING_RECIPES, SANCTUM_ROOMS
} from "../src/data/production-content.js";

const expectedDomains = [
  "n:game:battle-clash", "n:game:battle-clash:army", "n:game:battle-clash:combat",
  "n:game:battle-clash:defense", "n:game:battle-clash:deployment", "n:game:battle-clash:economy",
  "n:game:battle-clash:encounter", "n:game:battle-clash:encounter:objectives", "n:game:battle-clash:flow",
  "n:game:battle-clash:frontier", "n:game:battle-clash:hero", "n:game:battle-clash:hero-combat",
  "n:game:battle-clash:navigation", "n:game:battle-clash:progression", "n:game:battle-clash:raid",
  "n:game:battle-clash:sanctum", "n:game:battle-clash:session", "n:game:battle-clash:targeting",
  "n:game:battle-clash:world", "n:game:battle-clash:player", "n:game:battle-clash:content", "n:interaction", "n:interaction:input",
  "n:network", "n:presentation", "n:presentation:camera", "n:presentation:graphics", "n:presentation:output",
  "n:presentation:ui", "n:runtime", "n:runtime:data", "n:runtime:persistence", "n:runtime:realtime",
  "n:runtime:sequence", "n:runtime:startup", "n:simulation", "n:spatial", "n:world", "n:world:scene"
];

const commandCases = [
  ["deploy", { kind: "deploy", x: 10, z: 0 }],
  ["start", { kind: "start" }],
  ["reset", { kind: "reset" }],
  ["fortify", { kind: "fortify" }],
  ["hero-ability", { kind: "hero-ability", abilityId: "arc-burst" }],
  ["scene", { kind: "scene", sceneId: "overworld" }],
  ["discover", { kind: "discover", territoryId: "ash-crossing" }],
  ["claim", { kind: "claim", territoryId: "ash-crossing" }],
  ["move-hero", { kind: "move-hero", x: 50, z: 50 }],
  ["heal-army", { kind: "heal-army" }],
  ["recruit-army", { kind: "recruit-army", archetype: "delver" }],
  ["select-archetype", { kind: "select-archetype", archetype: "delver" }],
  ["upgrade-sanctum", { kind: "upgrade-sanctum" }],
  ["trade-resources", { kind: "trade-resources", from: "iron", to: "gold", amount: 1 }],
  ["interact-landmark", { kind: "interact-landmark", landmarkId: "ash-crossing-settlement" }],
  ["craft-gear", { kind: "craft-gear", itemId: "ember-ward" }],
  ["equip-gear", { kind: "equip-gear", itemId: "ember-ward" }]
];

const checks = [];
function check(category, id, fn) {
  try {
    const detail = fn();
    checks.push({ category, id, status: "pass", detail: detail ?? true });
  } catch (error) {
    checks.push({ category, id, status: "fail", detail: error.message });
  }
}

function requireValue(value, message) {
  if (!value) throw new Error(message);
  return true;
}

const baseline = createBattleClashGame();
const snapshot = baseline.getSnapshot();

const domainNamespaces = {
  "n:interaction": "interaction", "n:interaction:input": "input", "n:network": "network",
  "n:presentation": "presentation", "n:presentation:camera": "cameraFraming", "n:presentation:graphics": "graphics",
  "n:presentation:output": "presentationOutput", "n:presentation:ui": "ui", "n:runtime": "runtime",
  "n:runtime:data": "data", "n:runtime:persistence": "persistence", "n:runtime:realtime": "realtime",
  "n:runtime:sequence": "sequence", "n:runtime:startup": "startup", "n:simulation": "simulation", "n:spatial": "spatial", "n:world": "world",
  "n:world:scene": "scene", "n:game:battle-clash:army": "battleClashArmy", "n:game:battle-clash:combat": "battleClashRaid",
  "n:game:battle-clash:defense": "battleClashDefense", "n:game:battle-clash:deployment": "battleClashDeployment",
  "n:game:battle-clash:economy": "battleClashEconomy", "n:game:battle-clash:encounter": "battleClashEncounter",
  "n:game:battle-clash:encounter:objectives": "battleClashEncounterObjectives", "n:game:battle-clash:flow": "battleClashFlow",
  "n:game:battle-clash:frontier": "battleClashFrontier", "n:game:battle-clash:hero": "battleClashHero",
  "n:game:battle-clash:hero-combat": "battleClashHero", "n:game:battle-clash:navigation": "battleClashNavigation",
  "n:game:battle-clash:progression": "battleClashProgression", "n:game:battle-clash:raid": "battleClashRaid",
  "n:game:battle-clash:sanctum": "battleClashSanctum", "n:game:battle-clash:session": "battleClashSession",
  "n:game:battle-clash:targeting": "battleClashEncounter", "n:game:battle-clash:world": "battleClashWorld", "n:game:battle-clash:player": "battleClashPlayer",
  "n:game:battle-clash:content": "battleClashContent"
};

for (const domain of expectedDomains) check("domain", domain, () => requireValue(snapshot.domains.includes(domain), "domain not installed"));
for (const domain of expectedDomains) check("domain-behavior", domain, () => {
  if (domain === "n:game:battle-clash") return requireValue(snapshot.schema === "battle-clash.snapshot/1", "composition snapshot unavailable");
  const namespace = baseline.engine.n[domainNamespaces[domain]];
  requireValue(namespace, `namespace missing for ${domain}`);
  if (domain === "n:game:battle-clash:navigation") return requireValue(namespace.findPath({ x: 50, z: 50 }, { x: 51, z: 50 })?.status, "navigation probe unavailable");
  if (domain === "n:runtime:realtime") return requireValue(namespace.getCurrentTickContext() !== undefined, "realtime context unavailable");
  if (domain === "n:runtime:sequence") return requireValue(namespace.getRuntime() !== undefined, "sequence runtime unavailable");
  const read = namespace.getState ?? namespace.getSnapshot ?? namespace.getWorldState ?? namespace.getCurrentScene;
  requireValue(typeof read === "function", `read model missing for ${domain}`);
  requireValue(read.call(namespace) !== undefined, `read model returned undefined for ${domain}`);
});
for (const [name, component] of Object.entries(Components)) check("component", name, () => requireValue(component?.name, "component has no identity"));
for (const [name, resource] of Object.entries(Resources)) check("resource", name, () => requireValue(resource?.name, "resource has no identity"));
for (const [name, event] of Object.entries(Events)) check("event", name, () => requireValue(event?.name, "event has no identity"));
check("asset-behavior", "quarantine-requires-metadata", () => {
  const rejected = validateAssetEntry({ id: "quarantine", status: "quarantined" });
  requireValue(!rejected.accepted && rejected.missing.length >= 1, "incomplete asset crossed catalog boundary");
});
check("asset-behavior", "checked-in-manifest-integrity", () => {
  requireValue(ASSET_CATALOG_SCHEMA === "battle-clash.asset-catalog/1", "asset catalog schema drifted");
  requireValue(new Set(APPROVED_ASSETS.map((asset) => asset.id)).size === APPROVED_ASSETS.length, "duplicate approved asset id");
  for (const asset of APPROVED_ASSETS) requireValue(validateAssetEntry(asset).accepted, `invalid approved manifest entry ${asset.id}`);
});
check("asset-behavior", "approved-catalog-entry", () => {
  const entry = { id: "objaverse_demo", objaverseUid: "demo", slug: "demo", sourceUrl: "https://example.invalid/demo", license: "CC-BY", sha256: "hash", path: "assets/demo.glb", status: "approved" };
  requireValue(validateAssetEntry(entry).accepted, "complete approved asset rejected");
  requireValue(assetById(entry.id, [entry]) === entry, "approved asset cannot be resolved");
  requireValue(assetById(entry.id, [{ ...entry, status: "quarantined" }]) === null, "quarantined asset resolved at runtime");
  requireValue(resolveRenderableAsset(entry.id, [entry]).kind === "gltf", "approved asset did not produce GLB descriptor");
  requireValue(resolveRenderableAsset("missing", [entry]).kind === "cube-fallback", "missing asset did not produce cube fallback");
});
check("asset-behavior", "three-pass-review-gate", () => {
  const pass = (number) => {
    const run = createReviewRun("objaverse_demo", number);
    run.perspectives.forEach((item) => { item.decision = "pass"; });
    run.contexts.forEach((item) => { item.decision = "pass"; });
    run.humanDecision = "pass";
    return run;
  };
  requireValue(reviewPassAccepted(pass(1)), "passing review rejected");
  requireValue(promoteAfterConsecutivePasses([pass(1), pass(2), pass(3)]), "three consecutive passes did not promote");
  requireValue(!promoteAfterConsecutivePasses([pass(1), pass(2)]), "incomplete review sequence promoted");
});
check("content-behavior", "production-content-integrity", () => {
  requireValue(PRODUCTION_CONTENT_SCHEMA === "battle-clash.production-content/1", "production content schema drifted");
  requireValue(CONTENT_TERRITORIES.length >= 3, "fewer than three authored territories");
  const roomIds = new Set(Object.keys(ROOM_TYPES));
  requireValue(roomIds.size >= 9, "fewer than nine authored room types");
  for (const territory of CONTENT_TERRITORIES) {
    requireValue(territory.sceneId && territory.rooms.length >= 3, `incomplete territory ${territory.id}`);
    for (const roomId of territory.rooms) {
      const room = ROOM_TYPES[roomId];
      requireValue(room, `unknown room ${roomId}`);
      for (const exit of room.exits) requireValue(roomIds.has(exit), `unknown room exit ${exit}`);
    }
  }
  requireValue(Object.keys(ENEMY_FAMILIES).length >= 3, "enemy families missing");
  for (const family of Object.values(ENEMY_FAMILIES)) requireValue(family.archetypes?.length >= 2, `enemy family ${family.id} lacks variants`);
  requireValue(BOSS_PHASES.length >= 3 && BOSS_PHASES.every((phase, index) => index === 0 || phase.threshold < BOSS_PHASES[index - 1].threshold), "boss phases are not ordered");
  requireValue(new Set(GEAR_ITEMS.map((item) => item.id)).size === GEAR_ITEMS.length && GEAR_ITEMS.every((item) => item.slot && item.rarity && Object.keys(item.modifiers).length), "gear catalog incomplete");
  requireValue(QUESTS.length >= 3 && QUESTS.every((quest) => CONTENT_TERRITORIES.some((territory) => territory.id === quest.territoryId) && quest.steps.length >= 3), "quest chains incomplete");
  requireValue(CRAFTING_RECIPES.every((recipe) => GEAR_ITEMS.some((item) => item.id === recipe.output) && Object.values(recipe.costs).every((cost) => cost > 0)), "crafting recipe references invalid gear or cost");
  requireValue(new Set(SANCTUM_ROOMS.map((room) => room.id)).size === SANCTUM_ROOMS.length && SANCTUM_ROOMS.every((room) => QUESTS.some((quest) => quest.id === room.unlock)), "Sanctum unlock graph incomplete");
  requireValue(snapshot.productionContent?.schema === PRODUCTION_CONTENT_SCHEMA, "production content is not exposed by runtime snapshot");
  requireValue(snapshot.productionContent?.territories?.length === CONTENT_TERRITORIES.length, "runtime content territory projection drifted");
  return { territories: CONTENT_TERRITORIES.length, rooms: roomIds.size, enemyFamilies: Object.keys(ENEMY_FAMILIES).length, bossPhases: BOSS_PHASES.length };
});
check("content-behavior", "loot-quest-craft-equip-loop", () => {
  const game = createBattleClashGame();
  const emitted = new Set();
  const originalEmit = game.engine.world.emit.bind(game.engine.world);
  game.engine.world.emit = (event, payload) => {
    emitted.add(Object.entries(Events).find(([, definition]) => definition === event)?.[0] ?? event?.name);
    return originalEmit(event, payload);
  };
  game.prepareTerritory("ash-crossing");
  game.transitionToScene("encounter", { territoryId: "ash-crossing", frontDirection: "east" });
  const pattern = [[-10.5, -6], [-10.5, -2], [-10.5, 2], [-10.5, 6], [10.5, -6], [10.5, -2], [10.5, 2], [10.5, 6]];
  for (const [x, z] of pattern) { game.deployAt(x, z); game.tick(); }
  game.startRaid();
  game.stepSeconds(45);
  const looted = game.getContentState();
  requireValue(looted.inventory.includes("ember-ward"), "entry-room loot did not promote gear");
  requireValue(looted.quests["q-ash-first-light"].completedSteps.includes("discover"), "room win did not advance quest");
  requireValue(game.transitionToScene("sanctum").accepted, "content loop could not return to Sanctum");
  const economy = game.engine.world.getResource(Resources.EconomyState);
  game.engine.world.setResource(Resources.EconomyState, {
    ...economy,
    resources: { ...economy.resources, gold: 100, arcane: 10 }
  });
  requireValue(game.craftGear("scout-lens").accepted, "Sanctum crafting rejected a valid recipe");
  requireValue(game.equipGear("scout-lens").accepted, "owned gear could not be equipped");
  requireValue(emitted.has("GearLooted"), "GearLooted was not emitted");
  requireValue(emitted.has("QuestProgressed"), "QuestProgressed was not emitted");
  for (const event of [Events.ItemCrafted, Events.GearEquipped]) {
    const name = Object.entries(Events).find(([, definition]) => definition === event)?.[0];
    requireValue(emitted.has(name), `${event.name} was not emitted`);
  }
  return { inventory: game.getContentState().inventory, equipped: game.getContentState().equipped };
});
check("network-behavior", "authenticated-room-receipt-contract", () => {
  const hello = createAuthenticatedHello({ roomId: "room-1", userId: "123e4567-e89b-12d3-a456-426614174000", role: "attacker", profileRevision: 4 });
  requireValue(validateAuthenticatedHello(hello, "room-1").accepted, "valid room hello rejected");
  requireValue(!validateAuthenticatedHello({ ...hello, roomId: "room-2" }, "room-1").accepted, "foreign room hello accepted");
  requireValue(validateCommandEnvelope({ roomId: "room-1", senderId: "user-1", authorityId: "host-1", sequence: 1, command: { kind: "deploy" } }).accepted, "valid command envelope rejected");
  requireValue(!validateCommandEnvelope({ roomId: "room-1", senderId: "host-1", authorityId: "host-1", sequence: 1, command: { kind: "deploy" } }).accepted, "authority spoof accepted");
  const receipt = createMatchReceipt({ roomId: "room-1", authorityId: "host-1", sequenceStart: 1, sequenceEnd: 12, result: "won", rewardIdempotencyKey: "reward-1" });
  requireValue(acceptMatchReceipt(receipt, { roomId: "room-1", authorityId: "host-1" }).accepted, "valid match receipt rejected");
  requireValue(!acceptMatchReceipt(receipt, { roomId: "room-1", authorityId: "host-1", lastAcceptedKey: "reward-1" }).accepted, "duplicate reward receipt accepted");
  return { schema: hello.schema, receipt: receipt.schema };
});
for (const [name, resource] of Object.entries(Resources)) check("resource-behavior", name, () => {
  requireValue(baseline.engine.world.hasResource(resource), "resource is not registered");
  requireValue(baseline.engine.world.getResource(resource) !== undefined, "resource has no initial state");
});
check("resource-behavior", "AccountState-owner-mutation", () => {
  const game = createBattleClashGame();
  const before = JSON.stringify(game.engine.world.getResource(Resources.AccountState));
  game.updateAccount({ syncStatus: "validator" });
  const after = JSON.stringify(game.engine.world.getResource(Resources.AccountState));
  requireValue(before !== after, "account owner did not mutate AccountState");
});
check("event-behavior", "AccountChanged", () => {
  const game = createBattleClashGame();
  game.updateAccount({ syncStatus: "validator" });
  requireValue(game.engine.world.readEvents(Events.AccountChanged).length > 0, "AccountChanged was not emitted");
});
check("event-behavior", "SceneTransitionChanged", () => {
  const game = createBattleClashGame();
  requireValue(game.transitionToScene("overworld").accepted, "scene transition rejected");
  requireValue(game.getTransitionState().phase === "exiting", "transition did not enter exiting phase");
  requireValue(game.engine.world.readEvents(Events.SceneTransitionChanged).length >= 2, "transition start events were not emitted");
  game.stepSeconds(1);
  requireValue(game.getTransitionState().phase === "stable", "transition did not settle");
});
check("flow", "startup-preparation-bridge", () => {
  const game = createBattleClashGame();
  requireValue(game.engine.n.startup.getState().playable === true, "Core Startup did not reach playable readiness");
  const preparation = game.prepare({
    id: "validator-scene",
    metadata: { assets: ["objaverse-fc1339e225b7408caec82681be2746c5"] }
  });
  requireValue(preparation.accepted && preparation.state.manifest.length >= 6, "scene preparation manifest was not created");
  const first = preparation.state.manifest.find((item) => item.required !== false && item.status !== "ready");
  requireValue(first && game.markPreparationReady(first.id).accepted, "preparation readiness could not advance");
  requireValue(game.getPreparationState().status === "preparing", "partial readiness was not preserved");
  return { preparations: game.getPreparationState().manifest.length, startup: game.engine.n.startup.getState().launch.status };
});
check("event-behavior", "world-event-emission", () => {
  const game = createBattleClashGame();
  game.transitionToScene("overworld");
  game.discoverTerritory("ash-crossing");
  game.enterTerritory("ash-crossing");
  game.changeLandscape({ blockedCells: [[1, 1]] });
  game.tickEconomy(1);
  const required = [Events.SceneChanged, Events.TerritoryDiscovered, Events.TerritoryEntered, Events.LandscapeChanged, Events.EconomyTicked];
  for (const event of required) requireValue(game.engine.world.readEvents(event).length > 0, `${event.name} was not emitted`);
});
check("event-behavior", "complete-event-catalog", () => {
  const game = createBattleClashGame();
  const emitted = new Set();
  const originalEmit = game.engine.world.emit.bind(game.engine.world);
  game.engine.world.emit = (event, payload) => {
    emitted.add(Object.entries(Events).find(([, definition]) => definition === event)?.[0] ?? event?.name);
    return originalEmit(event, payload);
  };
  const pattern = [[-10.5, -6], [-10.5, -2], [-10.5, 2], [-10.5, 6], [10.5, -6], [10.5, -2], [10.5, 2], [10.5, 6]];
  game.updateSession({ message: "event-catalog" });
  game.updateAccount({ syncStatus: "event-catalog" });
  game.reset();
  game.tick();
  game.transitionToScene("overworld");
  game.discoverTerritory("ash-crossing");
  game.enterTerritory("ash-crossing");
  game.moveHero({ x: 50, z: 50 });
  game.tickEconomy(1);
  game.changeLandscape({ blockedCells: [[1, 1]] });
  game.interactLandmark("ash-crossing-settlement");
  game.transitionToScene("encounter", { territoryId: "ash-crossing" });
  game.deployAt(0, 0);
  for (const [x, z] of pattern) { game.deployAt(x, z); game.tick(); }
  game.startRaid();
  game.tick();
  game.useHeroAbility();
  game.stepSeconds(3);
  game.fortify();
  game.tick();
  game.stepSeconds(45);
  while (game.getSnapshot().room?.hasNext) {
    game.advanceRoom();
    for (const [x, z] of pattern) { game.deployAt(x, z); game.tick(); }
    game.startRaid();
    game.tick();
    game.useHeroAbility();
    game.stepSeconds(45);
  }
  const required = [
    "DeploymentAccepted", "DeploymentRejected", "TargetAcquired", "AttackResolved", "EntityDestroyed",
    "RaidStarted", "RaidCompleted", "RaidReset", "ProgressionAwarded", "LevelGained", "DefenseFortified",
    "SessionChanged", "SceneChanged", "RoomChanged", "HeroMoved", "TerritoryDiscovered", "TerritoryEntered", "TerritoryClaimed",
    "EconomyTicked", "LandmarkInteracted", "LandscapeChanged", "ObjectiveProgressed", "ObjectiveCompleted",
    "AccountChanged", "AbilityUsed", "SceneTransitionChanged"
  ];
  for (const name of required) check("event-behavior", name, () => requireValue(emitted.has(name), `${name} was not emitted`));
  return { events: required.length, observed: emitted.size };
});
for (const [id, archetype] of Object.entries(ARCHETYPES)) check("archetype", id, () => {
  requireValue(archetype.id === id, "archetype id mismatch");
  requireValue(archetype.category && archetype.role && archetype.faction, "archetype semantic fields missing");
});
const territoryFixture = createBattleClashGame();
territoryFixture.prepareTerritory("ash-crossing");
territoryFixture.tick();
const encounterFixture = createBattleClashGame();
encounterFixture.prepareTerritory("blackglass-rise");
encounterFixture.transitionToScene("encounter", { territoryId: "blackglass-rise" });
encounterFixture.tick();
const scoutFixture = createBattleClashGame();
scoutFixture.prepareTerritory("ash-crossing");
scoutFixture.transitionToScene("encounter", { territoryId: "ash-crossing" });
scoutFixture.tick();
const fixtureEntityArchetypes = new Set([
  ...territoryFixture.getSnapshot().entities.map((entity) => entity.archetypeId),
  ...encounterFixture.getSnapshot().entities.map((entity) => entity.archetypeId),
  ...scoutFixture.getSnapshot().entities.map((entity) => entity.archetypeId)
]);
for (const id of ["delver", "lancer", "arcanist"]) {
  const loadout = createBattleClashGame({ progression: { level: 5, xp: 0, xpToNext: 332 } });
  requireValue(loadout.selectArchetype(id, { allowLocked: true }).accepted, `loadout rejected ${id}`);
  loadout.deployAt(-10.5, 0);
  loadout.tick();
  for (const entity of loadout.getSnapshot().entities) fixtureEntityArchetypes.add(entity.archetypeId);
}
for (const id of Object.keys(ARCHETYPES)) check("archetype-behavior", id, () => requireValue(fixtureEntityArchetypes.has(id), "archetype never materialized in a fixture"));
const componentFixtures = [baseline, territoryFixture, encounterFixture];
for (const [name, component] of Object.entries(Components)) check("component-behavior", name, () => requireValue(componentFixtures.some((game) => game.engine.world.query(component).length > 0), "component never materialized in fixtures"));
for (const territory of TERRITORIES) check("territory", territory.id, () => {
  const descriptor = snapshot.world?.territories?.[territory.id];
  requireValue(descriptor?.sceneId === sceneForTerritory(territory.id), "scene identity mismatch");
  requireValue(descriptor?.landmarks?.length >= 1, "territory has no landmark");
  for (const neighbor of Object.values(territory.neighbors ?? {})) requireValue(TERRITORIES.some((candidate) => candidate.id === neighbor), `unknown neighbor ${neighbor}`);
});
for (const scene of WORLD_SCENES) check("scene", scene.id, () => {
  requireValue(scene.title && scene.kind && Array.isArray(scene.exits), "scene descriptor incomplete");
  requireValue(new Set(scene.exits.map((exit) => exit.to)).size === scene.exits.length, "duplicate scene exits");
});

const apiMethods = [
  "deployAt", "startRaid", "useHeroAbility", "reset", "fortify", "setProgression", "updateSession",
  "updateAccount", "getWorldState", "getCurrentTerritory", "getHeroState", "getSanctumState", "selectArchetype",
  "discoverTerritory", "enterTerritory", "prepareTerritory", "claimTerritory", "moveHero", "healArmy", "recruitArmy",
  "upgradeSanctum", "tradeResources", "interactLandmark", "findHeroPath", "findWorldPath", "findCombatPath",
  "tickEconomy", "changeLandscape", "transitionToScene", "getTransitionState", "getPreparationState", "prepare", "markPreparationReady", "markSceneReady", "canDeployAt", "getSnapshot", "getDeterministicSnapshot", "getDigest",
  "getContentState", "craftGear", "equipGear",
  "getPlayerState", "startPlayerEpisode", "recordPlayerObservation", "retrievePlayerMemory", "recordPlayerDecision",
  "getPlayerObservation",
  "recordPlayerActionResult", "recordPlayerOutcome", "completePlayerEpisode", "promotePlayerSkill"
];
for (const method of apiMethods) check("api", method, () => requireValue(typeof baseline[method] === "function", "missing composition API method"));
check("player-behavior", "observation-decision-outcome-lifecycle", () => {
  const game = createBattleClashGame();
  requireValue(game.getPlayerState().status === "idle", "player domain did not initialize idle");
  game.startPlayerEpisode({ episodeId: "validator-episode", goal: "return home", mode: "ecs" });
  const observation = game.recordPlayerObservation({ observationId: "obs-1", scene: "sanctum", phase: "idle", availableActions: ["open_frontier"] });
  requireValue(observation.state.status === "deciding", "observation did not advance player state");
  game.retrievePlayerMemory([{ id: "skill.open-frontier", score: 1 }]);
  game.recordPlayerDecision({ decisionId: "decision-1", observationId: "obs-1", selectedAction: { kind: "open_frontier" } });
  requireValue(game.recordPlayerActionResult({ accepted: true, action: { kind: "open_frontier" } }).accepted, "player action result rejected");
  game.recordPlayerOutcome({ outcomeId: "outcome-1", result: "success", reward: 0.2 });
  const completed = game.completePlayerEpisode("complete", { result: "returned-home" });
  requireValue(completed.episode.status === "complete", "player episode did not complete");
  return { status: completed.state.status, episode: completed.episode.episodeId };
});
check("player-behavior", "stable-observation-normalization", () => {
  const game = createBattleClashGame();
  const first = normalizePlayerObservation(game.getSnapshot(), { viewport: "compact" });
  const second = normalizePlayerObservation({ ...game.getSnapshot(), frame: 99, elapsed: 8.2 }, { viewport: "compact" });
  requireValue(first.schema === "battle-clash.observation/1", "observation schema missing");
  requireValue(playerObservationKey(first) === playerObservationKey(second), "volatile frame changed observation key");
  requireValue(game.getPlayerObservation({ viewport: "portrait" }).viewport === "portrait", "composition observation projection unavailable");
  return { keyLength: playerObservationKey(first).length, actions: first.availableActions.length };
});

for (const [kind, command] of commandCases) check("command", kind, () => {
  const normalized = normalizePeerCommand(command);
  requireValue(normalized?.kind === kind, "command normalization mismatch");
  const envelope = createPeerMessage("command", { command: normalized }, { roomId: "validator", senderId: "validator", sequence: 1 });
  requireValue(parsePeerMessage(envelope).payload.command.kind === kind, "command envelope mismatch");
});

check("flow", "home-frontier-territory-encounter-raid-home", () => {
  const game = createBattleClashGame();
  requireValue(game.getSnapshot().scene.current === "sanctum", "flow did not start at Home Base");
  requireValue(game.transitionToScene("overworld").accepted, "frontier transition rejected");
  requireValue(game.discoverTerritory("ash-crossing").accepted, "territory discovery rejected");
  requireValue(game.enterTerritory("ash-crossing").accepted, "territory entry rejected");
  requireValue(game.transitionToScene("encounter", { territoryId: "ash-crossing", frontDirection: "east" }).accepted, "encounter transition rejected");
  const pattern = [[-10.5, -6], [-10.5, -2], [-10.5, 2], [-10.5, 6], [10.5, -6], [10.5, -2], [10.5, 2], [10.5, 6]];
  for (const [x, z] of pattern) { requireValue(game.canDeployAt(x, z), `invalid deployment ${x},${z}`); game.deployAt(x, z); game.tick(); }
  game.startRaid();
  game.stepSeconds(45);
  const victory = game.getSnapshot();
  requireValue(victory.raid.phase === "won", "raid did not resolve to victory");
  requireValue(game.transitionToScene("sanctum").accepted, "return-home transition rejected");
  const result = game.getSnapshot();
  requireValue(result.scene.current === "sanctum", "victory did not return Home Base");
  requireValue(result.progression.wins === 1, "victory receipt missing");
  return { phase: result.raid.phase, scene: result.scene.current, wins: result.progression.wins };
});

check("determinism", "identical-seed-digest", () => {
  const run = () => { const game = createBattleClashGame(); game.deployAt(-10.5, 0); game.startRaid(); game.stepSeconds(1); return game.getDigest(); };
  requireValue(run() === run(), "digest changed for identical input");
});

const passed = checks.filter((item) => item.status === "pass").length;
const failed = checks.filter((item) => item.status === "fail");
const coveragePct = Number(((passed / checks.length) * 100).toFixed(2));
const report = {
  schema: "battle-clash.domain-coverage/1",
  thresholdPct: 99,
  coveragePct,
  passed,
  total: checks.length,
  failed,
  categories: Object.fromEntries([...new Set(checks.map((item) => item.category))].map((category) => {
    const items = checks.filter((item) => item.category === category);
    return [category, { passed: items.filter((item) => item.status === "pass").length, total: items.length }];
  })),
  evidence: { seed: snapshot.world?.schema ?? "unknown", domains: snapshot.domains.length, territories: TERRITORIES.length, scenes: WORLD_SCENES.length },
  status: coveragePct >= 99 && failed.length === 0 ? "pass" : "fail"
};

try {
  await mkdir("artifacts/validation", { recursive: true });
  await writeFile("artifacts/validation/domain-coverage.json", `${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  if (error?.code !== "ENOSPC") throw error;
  console.warn("validation report file skipped: workspace disk is full");
}
console.log(JSON.stringify(report, null, 2));
if (report.status !== "pass") process.exitCode = 1;
