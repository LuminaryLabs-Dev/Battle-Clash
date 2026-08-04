import { mkdir, writeFile } from "node:fs/promises";
import { createBattleClashGame } from "../src/composition/create-battle-clash.js";
import { ARCHETYPES } from "../src/data/battlefield.js";
import { TERRITORIES, WORLD_SCENES, sceneForTerritory } from "../src/data/world.js";
import { Components, Events, Resources } from "../src/domains/shared/definitions.js";
import { createPeerMessage, normalizePeerCommand, parsePeerMessage } from "../src/network/peer-protocol.js";
import { assetById, resolveRenderableAsset, validateAssetEntry } from "../src/assets/catalog.js";
import { createReviewRun, promoteAfterConsecutivePasses, reviewPassAccepted } from "../src/assets/asset-review.js";

const expectedDomains = [
  "n:core-camera", "n:core-data", "n:core-graphics", "n:core-input", "n:core-interaction",
  "n:core-network", "n:core-persistence", "n:core-scene", "n:core-simulation", "n:core-spatial",
  "n:core-ui", "n:game:battle-clash", "n:game:battle-clash:army", "n:game:battle-clash:combat",
  "n:game:battle-clash:defense", "n:game:battle-clash:deployment", "n:game:battle-clash:economy",
  "n:game:battle-clash:encounter", "n:game:battle-clash:encounter:objectives", "n:game:battle-clash:flow",
  "n:game:battle-clash:frontier", "n:game:battle-clash:hero", "n:game:battle-clash:hero-combat",
  "n:game:battle-clash:navigation", "n:game:battle-clash:progression", "n:game:battle-clash:raid",
  "n:game:battle-clash:sanctum", "n:game:battle-clash:session", "n:game:battle-clash:targeting",
  "n:game:battle-clash:world", "n:realtime", "n:sequence", "n:world"
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
  ["interact-landmark", { kind: "interact-landmark", landmarkId: "ash-crossing-settlement" }]
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
  "n:core-camera": "coreCamera", "n:core-data": "coreData", "n:core-graphics": "coreGraphics",
  "n:core-input": "coreInput", "n:core-interaction": "coreInteraction", "n:core-network": "coreNetwork",
  "n:core-persistence": "corePersistence", "n:core-scene": "coreScene", "n:core-simulation": "coreSimulation",
  "n:core-spatial": "coreSpatial", "n:core-ui": "coreUI", "n:world": "coreWorld", "n:realtime": "realtime",
  "n:sequence": "sequence", "n:game:battle-clash:army": "battleClashArmy", "n:game:battle-clash:combat": "battleClashRaid",
  "n:game:battle-clash:defense": "battleClashDefense", "n:game:battle-clash:deployment": "battleClashDeployment",
  "n:game:battle-clash:economy": "battleClashEconomy", "n:game:battle-clash:encounter": "battleClashEncounter",
  "n:game:battle-clash:encounter:objectives": "battleClashEncounterObjectives", "n:game:battle-clash:flow": "battleClashFlow",
  "n:game:battle-clash:frontier": "battleClashFrontier", "n:game:battle-clash:hero": "battleClashHero",
  "n:game:battle-clash:hero-combat": "battleClashHero", "n:game:battle-clash:navigation": "battleClashNavigation",
  "n:game:battle-clash:progression": "battleClashProgression", "n:game:battle-clash:raid": "battleClashRaid",
  "n:game:battle-clash:sanctum": "battleClashSanctum", "n:game:battle-clash:session": "battleClashSession",
  "n:game:battle-clash:targeting": "battleClashEncounter", "n:game:battle-clash:world": "battleClashWorld"
};

for (const domain of expectedDomains) check("domain", domain, () => requireValue(snapshot.domains.includes(domain), "domain not installed"));
for (const domain of expectedDomains) check("domain-behavior", domain, () => {
  if (domain === "n:game:battle-clash") return requireValue(snapshot.schema === "battle-clash.snapshot/1", "composition snapshot unavailable");
  const namespace = baseline.engine.n[domainNamespaces[domain]];
  requireValue(namespace, `namespace missing for ${domain}`);
  if (domain === "n:game:battle-clash:navigation") return requireValue(namespace.findPath({ x: 50, z: 50 }, { x: 51, z: 50 })?.status, "navigation probe unavailable");
  if (domain === "n:realtime") return requireValue(namespace.getCurrentTickContext() !== undefined, "realtime context unavailable");
  if (domain === "n:sequence") return requireValue(namespace.getRuntime() !== undefined, "sequence runtime unavailable");
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
  const required = [
    "DeploymentAccepted", "DeploymentRejected", "TargetAcquired", "AttackResolved", "EntityDestroyed",
    "RaidStarted", "RaidCompleted", "RaidReset", "ProgressionAwarded", "LevelGained", "DefenseFortified",
    "SessionChanged", "SceneChanged", "HeroMoved", "TerritoryDiscovered", "TerritoryEntered", "TerritoryClaimed",
    "EconomyTicked", "LandmarkInteracted", "LandscapeChanged", "ObjectiveProgressed", "ObjectiveCompleted",
    "AccountChanged", "AbilityUsed"
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
  "tickEconomy", "changeLandscape", "transitionToScene", "canDeployAt", "getSnapshot", "getDeterministicSnapshot", "getDigest"
];
for (const method of apiMethods) check("api", method, () => requireValue(typeof baseline[method] === "function", "missing composition API method"));

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
