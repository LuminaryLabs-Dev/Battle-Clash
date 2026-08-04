import assert from "node:assert/strict";
import { createBattleClashGame } from "../src/composition/create-battle-clash.js";
import { WORLD_SEED } from "../src/data/battlefield.js";
import { Components } from "../src/domains/shared/definitions.js";
import {
  loadProgressionProfile,
  loadWorldProfile,
  saveProgressionProfile,
  saveWorldProfile
} from "../src/persistence/profile-storage.js";
import {
  createPeerMessage,
  isPeerMessageFresh,
  normalizePeerCommand,
  parsePeerMessage
} from "../src/network/peer-protocol.js";

const deploymentPattern = [
  [-10.5, -6],
  [-10.5, -2],
  [-10.5, 2],
  [-10.5, 6],
  [10.5, -6],
  [10.5, -2],
  [10.5, 2],
  [10.5, 6]
];

const combatPathProbe = createBattleClashGame();
combatPathProbe.deployAt(-10.5, 0);
combatPathProbe.startRaid();
combatPathProbe.tick();
const combatRoute = combatPathProbe.findCombatPath();
assert.equal(combatRoute.status, "resolved");
assert.ok(combatRoute.pathLength > 0);
assert.ok(combatRoute.obstacleCount >= 28, "combat A* must include walls and living buildings as obstacles");

function runScenario() {
  const game = createBattleClashGame();
  for (const [x, z] of deploymentPattern) {
    assert.equal(game.canDeployAt(x, z), true, `expected valid deployment at ${x},${z}`);
    game.deployAt(x, z);
    game.tick();
  }

  game.startRaid();
  game.tick();
  game.stepSeconds(45);
  const snapshot = game.getSnapshot();
  const digest = game.getDigest();
  return { game, snapshot, digest };
}

const first = runScenario();
const second = runScenario();

assert.equal(first.snapshot.raid.phase, "won", "expected the bounded first raid to be winnable");
assert.equal(first.snapshot.deployment.remaining, 0);
assert.equal(first.snapshot.activeCellCount, 49);
assert.ok(first.snapshot.domains.includes("n:world"));
assert.ok(first.snapshot.domains.includes("n:core-network"));
assert.ok(first.snapshot.domains.includes("n:core-persistence"));
assert.ok(first.snapshot.domains.includes("n:game:battle-clash:combat"));
assert.ok(first.snapshot.domains.includes("n:game:battle-clash:progression"));
assert.ok(first.snapshot.progression.runs === 1);
assert.ok(first.snapshot.progression.lastReward > 0);
assert.equal(first.digest, second.digest, "identical inputs must produce identical digests");
assert.equal(first.snapshot.scene.current, "sanctum");
assert.deepEqual(first.snapshot.world.discoveredTerritoryIds, ["dawnwatch-sanctum"]);
assert.equal(first.snapshot.world.grid.width, 100);
assert.equal(first.snapshot.world.grid.height, 100);
assert.equal(Object.keys(first.snapshot.world.territories).length, 169);
const sceneRegistry = first.game.engine.n.coreScene.getSceneRegistry();
assert.equal(Object.keys(sceneRegistry).filter((id) => id.startsWith("territory:")).length, 168);
assert.equal(sceneRegistry["territory:ash-crossing"].metadata.territoryId, "ash-crossing");
assert.equal(first.snapshot.world.territories["ash-crossing"].sceneId, "territory:ash-crossing");
assert.ok(Object.values(first.snapshot.world.territories).every((territory) =>
  territory.landmarks.length >= 3 && Object.keys(territory.neighbors).length >= 1
));
const reachableTerritories = new Set(["dawnwatch-sanctum"]);
const pendingTerritories = ["dawnwatch-sanctum"];
while (pendingTerritories.length) {
  const territory = first.snapshot.world.territories[pendingTerritories.shift()];
  for (const neighborId of Object.values(territory.neighbors)) {
    if (reachableTerritories.has(neighborId)) continue;
    reachableTerritories.add(neighborId);
    pendingTerritories.push(neighborId);
  }
}
assert.equal(reachableTerritories.size, 169);
assert.ok(first.snapshot.world.activeRegionIds.includes("dawnwatch-sanctum"));
assert.ok(first.snapshot.world.activeRegionIds.includes("ash-crossing"));
assert.ok(first.snapshot.world.activeRegionIds.length < Object.keys(first.snapshot.world.territories).length);
assert.equal(first.snapshot.world.frontier.simulatedTerritoryCount, first.snapshot.world.activeRegionIds.length);
assert.equal(first.snapshot.world.factionStrategy.player.intent, "expand");
assert.ok(first.snapshot.world.factionStrategy.player.activeTargetTerritoryIds.length > 0);
assert.ok(["raid", "pressure", "consolidate"].includes(first.snapshot.world.factionStrategy["obsidian-court"].intent));
assert.ok(first.snapshot.world.factionStrategy["obsidian-court"].power > 0);
const distantPressureBefore = first.snapshot.world.territories["frontier-w6-s6"].fronts.map((front) => front.pressure);
first.game.tickEconomy(60);
assert.deepEqual(first.game.getSnapshot().world.territories["frontier-w6-s6"].fronts.map((front) => front.pressure), distantPressureBefore);
assert.equal(first.snapshot.hero.territoryId, "dawnwatch-sanctum");
assert.equal(first.snapshot.objective.kind, "relic-secure");
assert.equal(first.snapshot.objective.required, 2);
assert.ok(Object.keys(first.snapshot.world.territories).length >= 100);
assert.ok(first.snapshot.world.territories["frontier-w6-s6"].landmarks.length >= 1);

const scoutingGrowth = createBattleClashGame();
const initialActiveRegionCount = scoutingGrowth.getSnapshot().world.activeRegionIds.length;
scoutingGrowth.engine.n.battleClashProgression.setProfile({ level: 3, xp: 0, xpToNext: 182 });
const scoutingSnapshot = scoutingGrowth.getSnapshot();
assert.equal(scoutingSnapshot.hero.level, 3);
assert.equal(scoutingSnapshot.hero.discoveryRadius, 3);
assert.ok(scoutingSnapshot.hero.unlocks.includes("front-command"));
assert.ok(scoutingSnapshot.hero.unlocks.includes("hazard-sight"));
assert.ok(scoutingSnapshot.world.activeRegionIds.length > initialActiveRegionCount);
assert.equal(scoutingSnapshot.world.frontier.simulatedTerritoryCount, scoutingSnapshot.world.activeRegionIds.length);
const hazardAware = createBattleClashGame();
const hazardPatch = {
  blockedCells: [],
  hazards: [
    { id: "test-hazard-1", x: 50, z: 51, kind: "pressure" },
    { id: "test-hazard-2", x: 50, z: 52, kind: "pressure" },
    { id: "test-hazard-3", x: 50, z: 53, kind: "pressure" }
  ]
};
hazardAware.changeLandscape(hazardPatch);
const cautiousRoute = hazardAware.findHeroPath({ x: 50, z: 50 }, { x: 50, z: 54 });
hazardAware.setProgression({ level: 3, xp: 0, xpToNext: 182 });
const hazardSightRoute = hazardAware.findHeroPath({ x: 50, z: 50 }, { x: 50, z: 54 });
assert.ok(cautiousRoute.points.some((point) => point.x !== 50));
assert.deepEqual(hazardSightRoute.points.map((point) => point.x), [50, 50, 50, 50, 50]);
assert.ok(hazardSightRoute.cost < cautiousRoute.cost);
const veteranRoute = createBattleClashGame({ progression: { level: 4, xp: 0, xpToNext: 246 } });
veteranRoute.changeLandscape(hazardPatch);
const rapidMarchRoute = veteranRoute.findHeroPath({ x: 50, z: 50 }, { x: 50, z: 54 });
assert.ok(rapidMarchRoute.cost < hazardSightRoute.cost);
const siegeLoadout = createBattleClashGame({ progression: { level: 5, xp: 0, xpToNext: 332 } });
assert.equal(siegeLoadout.getSnapshot().deployment.remaining, 10);

const landscapePersistence = createBattleClashGame();
assert.equal(landscapePersistence.discoverTerritory("ash-crossing").accepted, true);
assert.equal(landscapePersistence.enterTerritory("ash-crossing").accepted, true);
const customHazard = { id: "ash-crossing-hazard-test", x: 42, z: 43, kind: "fireline" };
assert.equal(landscapePersistence.changeLandscape({
  blockedCells: ["42,42"],
  hazards: [customHazard]
}).territoryId, "ash-crossing");
assert.deepEqual(landscapePersistence.getSnapshot().landscape.hazards, [customHazard]);
assert.deepEqual(landscapePersistence.getSnapshot().world.territories["ash-crossing"].landscape.hazards, [customHazard]);
assert.equal(landscapePersistence.transitionToScene("overworld").accepted, true);
assert.equal(landscapePersistence.enterTerritory("ash-crossing").accepted, true);
assert.deepEqual(landscapePersistence.getSnapshot().landscape.hazards, [customHazard]);

const strongholdPreview = createBattleClashGame();
for (const territoryId of ["ash-crossing", "obsidian-vault", "blackglass-rise"]) {
  assert.equal(strongholdPreview.discoverTerritory(territoryId).accepted, true);
  assert.equal(strongholdPreview.enterTerritory(territoryId).accepted, true);
}
assert.equal(strongholdPreview.transitionToScene("encounter").accepted, true);
const strongholdSnapshot = strongholdPreview.getSnapshot();
assert.equal(strongholdSnapshot.objective.kind, "stronghold-break");
assert.equal(strongholdSnapshot.battleMetadata.enemyCount >= 50, true);
assert.ok(strongholdSnapshot.entities.some((entity) => entity.archetypeId === "boss"));
assert.ok(strongholdSnapshot.entities.filter((entity) => entity.category === "building").length >= 50);

const homeBase = createBattleClashGame();
assert.equal(homeBase.recruitArmy().accepted, true);
assert.equal(homeBase.getSnapshot().army.roster[0].count, 5);
assert.equal(homeBase.healArmy().accepted, true);
assert.equal(homeBase.getSnapshot().army.supply, 120);
assert.equal(homeBase.upgradeSanctum().accepted, true);
assert.equal(homeBase.getSnapshot().sanctum.level, 2);
assert.equal(homeBase.getSnapshot().army.capacity, 16);
assert.ok(homeBase.getSnapshot().army.unlockedArchetypes.includes("lancer"));
assert.equal(homeBase.selectArchetype("arcanist").accepted, false);
assert.equal(homeBase.selectArchetype("arcanist", { allowLocked: true }).accepted, true);
assert.equal(homeBase.getSnapshot().deployment.selectedArchetype, "arcanist");
const preparedHost = createBattleClashGame();
const preparedEntry = preparedHost.prepareTerritory("obsidian-vault");
assert.equal(preparedEntry.accepted, true);
assert.equal(preparedEntry.route.status, "resolved");
assert.equal(preparedHost.getSnapshot().scene.current, "territory:obsidian-vault");
assert.ok(preparedHost.getSnapshot().world.discoveredTerritoryIds.includes("ash-crossing"));
assert.ok(preparedHost.getSnapshot().world.discoveredTerritoryIds.includes("obsidian-vault"));
assert.equal(preparedHost.transitionToScene("encounter", {
  territoryId: "obsidian-vault",
  frontDirection: "west"
}).accepted, true);
const loadout = createBattleClashGame();
assert.equal(loadout.upgradeSanctum().accepted, true);
assert.equal(loadout.recruitArmy({ archetype: "lancer" }).accepted, true);
assert.equal(loadout.selectArchetype("lancer").accepted, true);
assert.ok(loadout.getSnapshot().army.roster.some((unit) => unit.archetype === "lancer" && unit.count === 1));
assert.equal(loadout.getSnapshot().deployment.selectedArchetype, "lancer");
assert.deepEqual(normalizePeerCommand({ kind: "recruit-army", archetype: "lancer" }), {
  kind: "recruit-army",
  archetype: "lancer"
});
const goldBeforeTrade = homeBase.getSnapshot().economy.resources.gold;
assert.equal(homeBase.tradeResources({ from: "iron", to: "gold", amount: 5 }).accepted, true);
assert.equal(homeBase.getSnapshot().economy.resources.gold, goldBeforeTrade + 20);
homeBase.tickEconomy(10);
assert.ok(homeBase.getSnapshot().economy.upkeep.food > 0);
const tradeRoute = homeBase.getSnapshot().economy.tradeRoutes;
assert.deepEqual(tradeRoute, []);
const routedTrade = createBattleClashGame();
assert.equal(routedTrade.discoverTerritory("ash-crossing").accepted, true);
assert.equal(routedTrade.enterTerritory("ash-crossing").accepted, true);
assert.equal(routedTrade.claimTerritory("ash-crossing").accepted, true);
assert.equal(routedTrade.transitionToScene("sanctum").accepted, true);
const routeId = routedTrade.getSnapshot().economy.tradeRoutes[0].id;
assert.equal(routedTrade.tradeResources({ from: "iron", to: "gold", amount: 1, routeId }).accepted, true);
assert.equal(routedTrade.getSnapshot().economy.lastTrade.routeId, routeId);
assert.equal(routedTrade.tradeResources({ from: "iron", to: "gold", amount: 99, routeId }).reason, "trade-capacity-exceeded");
assert.equal(routedTrade.enterTerritory("ash-crossing").accepted, true);
assert.equal(routedTrade.discoverTerritory("obsidian-vault").accepted, true);
assert.equal(routedTrade.enterTerritory("obsidian-vault").accepted, true);
assert.equal(routedTrade.claimTerritory("obsidian-vault").accepted, true);
assert.equal(routedTrade.transitionToScene("sanctum").accepted, true);
assert.ok(routedTrade.getSnapshot().economy.tradeRoutes.length >= 2);

const explorationRun = createBattleClashGame();
const explorationXpBefore = explorationRun.getSnapshot().progression.xp;
assert.equal(explorationRun.discoverTerritory("ash-crossing").accepted, true);
assert.equal(explorationRun.getSnapshot().progression.xp, explorationXpBefore + 18);
assert.ok(explorationRun.getSnapshot().progression.explorationReceipts.includes("discovery:ash-crossing"));
assert.equal(explorationRun.getSnapshot().progression.lastExplorationReward.id, "ash-crossing");
assert.equal(explorationRun.discoverTerritory("ash-crossing").duplicate, true);
assert.equal(explorationRun.getSnapshot().progression.xp, explorationXpBefore + 18);
assert.equal(explorationRun.enterTerritory("ash-crossing").accepted, true);
assert.equal(explorationRun.moveHero({ x: 99, z: 50 }).accepted, true);
assert.ok(explorationRun.getSnapshot().progression.explorationReceipts.includes("discovery:obsidian-vault"));
const progressionProfileStorage = {
  values: new Map(),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, value); }
};
assert.equal(saveProgressionProfile(explorationRun.getSnapshot().progression, progressionProfileStorage), true);
const restoredProgression = loadProgressionProfile(progressionProfileStorage);
assert.ok(restoredProgression.explorationReceipts.includes("discovery:ash-crossing"));
assert.ok(restoredProgression.explorationReceipts.includes("discovery:obsidian-vault"));

const guardedFlow = createBattleClashGame();
assert.deepEqual(guardedFlow.transitionToScene("encounter"), {
  accepted: false,
  reason: "territory-required-for-encounter"
});
assert.deepEqual(guardedFlow.transitionToScene("territory"), {
  accepted: false,
  reason: "territory-unavailable"
});
assert.equal(guardedFlow.discoverTerritory("ash-crossing").accepted, true);
assert.equal(guardedFlow.enterTerritory("ash-crossing").accepted, true);
assert.equal(guardedFlow.transitionToScene("encounter", { territoryId: "obsidian-vault" }).accepted, false);

const frontier = createBattleClashGame();
assert.equal(frontier.discoverTerritory("ash-crossing").accepted, true);
const ashEntry = frontier.enterTerritory("ash-crossing");
assert.equal(ashEntry.accepted, true);
assert.equal(ashEntry.route.status, "resolved");
assert.ok(ashEntry.route.pathLength > 0);
assert.equal(frontier.getSnapshot().scene.current, "territory:ash-crossing");
assert.equal(frontier.getSnapshot().world.currentTerritoryId, "ash-crossing");
assert.equal(frontier.getSnapshot().hero.worldRoute.targetTerritoryId, "ash-crossing");
assert.ok(frontier.getSnapshot().world.activeRegionIds.includes("ash-crossing"));
assert.ok(!frontier.getSnapshot().world.activeRegionIds.includes("frontier-w6-s6"));
assert.ok(frontier.getSnapshot().entities.filter((entity) => entity.category === "landmark").length >= 3);
assert.ok(frontier.getSnapshot().entities.some((entity) => entity.resourceNode?.resource));
assert.equal(frontier.getSnapshot().entities.filter((entity) => entity.category === "front").length, 3);
assert.equal(frontier.getSnapshot().entities.filter((entity) => entity.category === "hero").length, 1);
const directionalEncounter = createBattleClashGame();
assert.equal(directionalEncounter.discoverTerritory("ash-crossing").accepted, true);
assert.equal(directionalEncounter.enterTerritory("ash-crossing").accepted, true);
assert.equal(directionalEncounter.transitionToScene("encounter", {
  territoryId: "ash-crossing",
  frontDirection: "north"
}).accepted, true);
assert.equal(directionalEncounter.getSnapshot().battleMetadata.frontDirection, "north");
assert.equal(directionalEncounter.getSnapshot().battleMetadata.frontPressure, 0.35);
assert.equal(frontier.moveHero({ x: 14, z: 22 }).accepted, true);
assert.equal(frontier.getSnapshot().hero.route.status, "resolved");
assert.ok(frontier.getSnapshot().hero.route.pathLength > 0);
assert.deepEqual(
  frontier.getSnapshot().entities.find((entity) => entity.category === "hero").position,
  { x: 14, y: 0.72, z: 22 }
);
assert.equal(frontier.moveHero({ x: 100, z: 50 }).accepted, true);
assert.equal(frontier.getSnapshot().hero.position.x, 99);
assert.ok(frontier.getSnapshot().world.discoveredTerritoryIds.includes("obsidian-vault"));
assert.equal(frontier.getSnapshot().world.territories["obsidian-vault"].discovered, true);
assert.equal(frontier.getSnapshot().world.lastHeroDiscovery.territoryId, "obsidian-vault");
const profileStorage = {
  values: new Map(),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, value); }
};
assert.equal(saveWorldProfile(frontier.getSnapshot().world, profileStorage), true);
const restoredWorld = loadWorldProfile(profileStorage);
assert.equal(restoredWorld.lastHeroDiscovery.territoryId, "obsidian-vault");
assert.equal(restoredWorld.hero.route.status, "resolved");
assert.equal(restoredWorld.territories["obsidian-vault"].discovered, true);
const goldBeforeClaim = frontier.getSnapshot().economy.resources.gold;
assert.equal(frontier.claimTerritory("ash-crossing").accepted, true);
assert.ok(frontier.getSnapshot().economy.resources.gold > goldBeforeClaim);
assert.equal(frontier.getSnapshot().world.lastClaimReward.territoryId, "ash-crossing");
assert.equal(frontier.getSnapshot().world.factions.player.territories, 2);
assert.ok(frontier.getSnapshot().world.territories["obsidian-vault"].fronts.some((front) => front.faction === "player" && front.pressure >= 0.28));
assert.ok(frontier.getSnapshot().world.factionStrategy.player.targetTerritoryIds.includes("obsidian-vault"));
const goldAfterClaim = frontier.getSnapshot().economy.resources.gold;
assert.equal(frontier.claimTerritory("ash-crossing").accepted, true);
assert.equal(frontier.getSnapshot().economy.resources.gold, goldAfterClaim);
const supplyChain = createBattleClashGame();
assert.equal(supplyChain.discoverTerritory("ash-crossing").accepted, true);
assert.equal(supplyChain.enterTerritory("ash-crossing").accepted, true);
assert.equal(supplyChain.claimTerritory("ash-crossing").accepted, true);
assert.equal(supplyChain.discoverTerritory("obsidian-vault").accepted, true);
assert.equal(supplyChain.enterTerritory("obsidian-vault").accepted, true);
assert.equal(supplyChain.claimTerritory("obsidian-vault").accepted, true);
assert.ok(supplyChain.getSnapshot().army.unlockedArchetypes.includes("arcanist"));
assert.ok(supplyChain.getSnapshot().world.territories["obsidian-vault"].unlocks.includes("arcane-expedition"));
const obsidianRoute = supplyChain.getSnapshot().world.supplyRoutes.find((route) => route.territoryId === "obsidian-vault");
assert.equal(obsidianRoute.status, "supplied");
assert.equal(obsidianRoute.distance, 2);
assert.ok(obsidianRoute.efficiency < 1 && obsidianRoute.efficiency > 0.7);
const threat = createBattleClashGame();
assert.equal(threat.discoverTerritory("ash-crossing").accepted, true);
assert.equal(threat.enterTerritory("ash-crossing").accepted, true);
assert.equal(threat.claimTerritory("ash-crossing").accepted, true);
threat.tickEconomy(120);
const contestedRoute = threat.getSnapshot().world.supplyRoutes.find((route) => route.territoryId === "ash-crossing");
assert.equal(contestedRoute.status, "contested");
assert.ok(contestedRoute.efficiency < 0.6);
assert.ok(threat.getSnapshot().world.frontier.alerts.includes("ash-crossing"));
const contestedFront = threat.getSnapshot().world.territories["ash-crossing"].fronts[0];
const contestedFrontEntity = threat.getSnapshot().entities.find(
  (entity) => entity.category === "front" && entity.territoryMarker?.direction === contestedFront.direction
);
assert.equal(contestedFrontEntity.territoryMarker.pressure, contestedFront.pressure);
const autoClaim = createBattleClashGame();
assert.equal(autoClaim.discoverTerritory("ash-crossing").accepted, true);
assert.equal(autoClaim.enterTerritory("ash-crossing").accepted, true);
assert.equal(autoClaim.transitionToScene("encounter").accepted, true);
const autoCore = autoClaim.engine.world.query(Components.Identity, Components.Health)
  .find((entity) => autoClaim.engine.world.getComponent(entity, Components.Identity).role === "core");
const autoCoreHealth = autoClaim.engine.world.getComponent(autoCore, Components.Health);
autoClaim.engine.world.setComponent(autoCore, Components.Health, { ...autoCoreHealth, current: 0 });
autoClaim.startRaid();
autoClaim.tick(2);
assert.equal(autoClaim.getSnapshot().raid.phase, "won");
autoClaim.tick();
assert.equal(autoClaim.getSnapshot().territory.ownerFaction, "player");
assert.equal(autoClaim.getSnapshot().world.lastClaimReward.territoryId, "ash-crossing");
assert.ok(autoClaim.getSnapshot().world.activeRegionIds.includes("ash-crossing"));
assert.equal(autoClaim.getSnapshot().landscape.territoryId, "ash-crossing");
assert.equal(
  autoClaim.getSnapshot().landscape.revision,
  autoClaim.getSnapshot().territory.landscapeRevision
);
const pressureBeforeTick = frontier.getSnapshot().territory.fronts[0].pressure;
frontier.tickEconomy(60);
const frontierSnapshot = frontier.getSnapshot();
assert.equal(frontierSnapshot.territory.ownerFaction, "player");
assert.ok(frontierSnapshot.world.frontier.clock >= 60);
assert.notEqual(frontierSnapshot.territory.fronts[0].pressure, pressureBeforeTick);
assert.ok(frontierSnapshot.economy.resources.gold > 120);
assert.ok(frontierSnapshot.economy.resources.food > 80);
assert.ok(frontierSnapshot.army.roster[0].count > 4);
assert.ok(frontierSnapshot.army.capacity > 12);
const heroPath = frontier.findHeroPath({ x: 1, z: 1 }, { x: 8, z: 8 });
assert.equal(heroPath.status, "resolved");
assert.equal(heroPath.points.at(0).x, 1);
assert.equal(heroPath.points.at(-1).z, 8);
assert.equal(frontier.transitionToScene("overworld").accepted, true);
assert.equal(frontier.getSnapshot().scene.current, "overworld");
const terrainLandscape = frontier.getSnapshot().landscape;
assert.ok(terrainLandscape.blockedCells.length > 0);
const landscapeRevision = terrainLandscape.revision;
const changedLandscape = frontier.changeLandscape({
  blockedCells: ["4,4", "4,5"],
  hazards: [{ id: "ash-crossing-fire", x: 4, z: 4, kind: "pressure" }]
});
assert.equal(changedLandscape.revision, landscapeRevision + 1);
assert.deepEqual(changedLandscape.blockedCells, ["4,4", "4,5"]);
const rerouted = frontier.findHeroPath({ x: 1, z: 4 }, { x: 7, z: 4 });
assert.equal(rerouted.status, "resolved");
assert.equal(rerouted.points.some((point) => `${point.x},${point.z}` === "4,4"), false);
const hazardRoute = createBattleClashGame();
assert.equal(hazardRoute.discoverTerritory("ash-crossing").accepted, true);
assert.equal(hazardRoute.enterTerritory("ash-crossing").accepted, true);
hazardRoute.changeLandscape({ blockedCells: [], hazards: [{ id: "heat", x: 4, z: 4, kind: "pressure" }] });
const hazardPath = hazardRoute.findHeroPath({ x: 1, z: 4 }, { x: 7, z: 4 });
assert.equal(hazardPath.status, "resolved");
assert.ok(hazardPath.cost > 6);
const landmarkRun = createBattleClashGame();
assert.equal(landmarkRun.discoverTerritory("ash-crossing").accepted, true);
assert.equal(landmarkRun.enterTerritory("ash-crossing").accepted, true);
const resourceLandmark = landmarkRun.getSnapshot().territory.landmarks.find((landmark) => landmark.kind === "resource");
assert.ok(resourceLandmark);
const resourceEntity = landmarkRun.getSnapshot().entities.find((entity) => entity.id === resourceLandmark.id);
assert.ok(resourceEntity?.territoryMarker?.gridPosition);
assert.equal(landmarkRun.findHeroPath(landmarkRun.getSnapshot().hero.position, resourceEntity.territoryMarker.gridPosition).status, "resolved");
assert.equal(landmarkRun.moveHero(resourceEntity.territoryMarker.gridPosition).accepted, true);
const firstLandmark = landmarkRun.interactLandmark(resourceLandmark.id);
assert.equal(firstLandmark.accepted, true);
assert.equal(firstLandmark.state.lastLandmarkInteraction.firstInteraction, true);
const landmarkXp = landmarkRun.getSnapshot().progression.xp;
assert.equal(landmarkRun.getSnapshot().progression.lastExplorationReward.kind, "landmark");
assert.ok(landmarkRun.getSnapshot().progression.explorationReceipts.includes(`landmark:${resourceLandmark.id}`));
assert.equal(landmarkRun.interactLandmark(resourceLandmark.id).state.lastLandmarkInteraction.firstInteraction, false);
assert.equal(landmarkRun.getSnapshot().progression.xp, landmarkXp);
assert.equal(normalizePeerCommand({ kind: "interact-landmark", landmarkId: resourceLandmark.id }).landmarkId, resourceLandmark.id);
assert.equal(frontier.transitionToScene("territory", { territoryId: "ash-crossing" }).accepted, true);
const frontGatePath = frontier.findHeroPath(frontier.getSnapshot().hero.position, { x: 98, z: 50 });
assert.equal(frontGatePath.status, "resolved");
assert.equal(frontier.moveHero({ x: 98, z: 50 }).accepted, true);
assert.deepEqual(frontier.getSnapshot().hero.route.target, { x: 98, z: 50 });
assert.equal(frontier.transitionToScene("encounter", { territoryId: "ash-crossing" }).accepted, true);
const encounterSnapshot = frontier.getSnapshot();
assert.equal(encounterSnapshot.scene.current, "encounter");
assert.equal(encounterSnapshot.world.currentTerritoryId, "ash-crossing");
assert.equal(encounterSnapshot.entities.filter((entity) => entity.category === "landmark").length, 0);
assert.equal(encounterSnapshot.entities.filter((entity) => entity.category === "hero").length, 0);
assert.equal(encounterSnapshot.entities.filter((entity) => entity.category === "front").length, 0);
assert.ok(encounterSnapshot.entities.filter((entity) => entity.role === "defense").length >= 2);
assert.equal(encounterSnapshot.objective.kind, "front-break");
assert.equal(encounterSnapshot.objective.required, 2);
assert.ok(encounterSnapshot.battleMetadata.enemyCount >= 8);
assert.ok(encounterSnapshot.battleMetadata.enemyCount <= 12);
assert.ok(["redfen-clan", "obsidian-court", "neutral"].includes(encounterSnapshot.battleMetadata.hostileFaction));
assert.ok(typeof encounterSnapshot.battleMetadata.strategyIntent === "string");
assert.equal(encounterSnapshot.battleMetadata.layoutId, "frontier-layout-v1");
const dungeonLayoutRun = createBattleClashGame();
assert.equal(dungeonLayoutRun.discoverTerritory("ash-crossing").accepted, true);
assert.equal(dungeonLayoutRun.enterTerritory("ash-crossing").accepted, true);
assert.equal(dungeonLayoutRun.discoverTerritory("obsidian-vault").accepted, true);
assert.equal(dungeonLayoutRun.enterTerritory("obsidian-vault").accepted, true);
assert.equal(dungeonLayoutRun.transitionToScene("encounter", { territoryId: "obsidian-vault" }).accepted, true);
const dungeonLayoutSnapshot = dungeonLayoutRun.getSnapshot();
assert.equal(dungeonLayoutSnapshot.battleMetadata.layoutId, "dungeon-layout-v1");
assert.notDeepEqual(
  dungeonLayoutSnapshot.entities.find((entity) => entity.id === "wall-01").position,
  encounterSnapshot.entities.find((entity) => entity.id === "wall-01").position
);
assert.equal(frontier.transitionToScene("sanctum").accepted, true);
assert.equal(frontier.getSnapshot().territory.id, "dawnwatch-sanctum");
assert.ok(frontier.getSnapshot().world.activeRegionIds.includes("dawnwatch-sanctum"));
const worldRoute = frontier.findWorldPath("dawnwatch-sanctum", "blackglass-rise");
assert.equal(worldRoute.status, "resolved");
assert.equal(worldRoute.points.at(0), "dawnwatch-sanctum");
assert.equal(worldRoute.points.at(-1), "blackglass-rise");
const distantWorldRoute = frontier.findWorldPath("dawnwatch-sanctum", "frontier-e6-n6");
assert.equal(distantWorldRoute.status, "resolved");
assert.equal(distantWorldRoute.points.at(0), "dawnwatch-sanctum");
assert.equal(distantWorldRoute.points.at(-1), "frontier-e6-n6");
assert.ok(distantWorldRoute.points.length > worldRoute.points.length);
const bossRun = createBattleClashGame();
bossRun.discoverTerritory("ash-crossing");
bossRun.enterTerritory("ash-crossing");
bossRun.discoverTerritory("obsidian-vault");
bossRun.enterTerritory("obsidian-vault");
bossRun.discoverTerritory("blackglass-rise");
bossRun.enterTerritory("blackglass-rise");
bossRun.transitionToScene("encounter", { territoryId: "blackglass-rise" });
assert.equal(bossRun.getSnapshot().entities.some((entity) => entity.archetypeId === "boss"), true);
assert.equal(bossRun.getSnapshot().entities.some((entity) => entity.archetypeId === "bastion"), true);
assert.equal(bossRun.getSnapshot().entities.some((entity) => entity.archetypeId === "elite"), true);
assert.ok(bossRun.getSnapshot().battleMetadata.enemyCount >= 50);
assert.ok(bossRun.getSnapshot().battleMetadata.enemyCount <= 100);
assert.equal(bossRun.getSnapshot().objective.kind, "stronghold-break");
const bossEntity = bossRun.engine.world.query(Components.Identity, Components.Health)
  .find((entity) => bossRun.engine.world.getComponent(entity, Components.Identity).archetypeId === "boss");
const bossHealth = bossRun.engine.world.getComponent(bossEntity, Components.Health);
bossRun.engine.world.setComponent(bossEntity, Components.Health, { ...bossHealth, current: 0 });
bossRun.tick();
assert.equal(bossRun.getSnapshot().objective.progress, 1);
assert.equal(bossRun.getSnapshot().objective.completed, true);
assert.ok(bossRun.getSnapshot().loot.totals.arcane > 0);
const bossGoldBeforeReturn = bossRun.getSnapshot().economy.resources.gold;
assert.equal(bossRun.transitionToScene("sanctum").accepted, true);
assert.ok(bossRun.getSnapshot().economy.resources.gold > bossGoldBeforeReturn);
assert.equal(bossRun.getSnapshot().loot.totals.gold, 0);
assert.equal(bossRun.getSnapshot().world.lastSanctumReturn.territoryId, "blackglass-rise");
assert.ok(bossRun.getSnapshot().world.lastSanctumReturn.loot.arcane > 0);
assert.deepEqual(
  bossRun.getSnapshot().world.lastSanctumReturn.resourcesAfter,
  bossRun.getSnapshot().economy.resources
);
const returnProfileStorage = {
  values: new Map(),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, value); }
};
assert.equal(saveWorldProfile(bossRun.getSnapshot().world, returnProfileStorage), true);
const restoredBossWorld = loadWorldProfile(returnProfileStorage);
assert.equal(restoredBossWorld.lastSanctumReturn.territoryId, "blackglass-rise");
const rehydratedBoss = createBattleClashGame({
  world: restoredBossWorld,
  progression: bossRun.getSnapshot().progression
});
assert.equal(rehydratedBoss.getSnapshot().scene.current, "sanctum");
assert.equal(rehydratedBoss.getSnapshot().world.currentTerritoryId, "dawnwatch-sanctum");
assert.ok(rehydratedBoss.getSnapshot().world.discoveredTerritoryIds.includes("blackglass-rise"));
assert.deepEqual(
  rehydratedBoss.getSnapshot().economy.resources,
  bossRun.getSnapshot().economy.resources
);
assert.deepEqual(
  rehydratedBoss.getSnapshot().army.roster,
  bossRun.getSnapshot().army.roster
);

first.game.reset();
first.game.tick();
const reset = first.game.getSnapshot();
assert.equal(reset.raid.phase, "deploy");
assert.equal(reset.deployment.remaining, 8);
assert.equal(reset.entities.filter((entity) => entity.category === "troop").length, 0);
assert.equal(reset.coreHealth.current, reset.coreHealth.maximum);
assert.equal(reset.progression.xp, first.snapshot.progression.xp);

const leveled = createBattleClashGame({
  progression: { level: 3, xp: 12, xpToNext: 182 }
});
assert.equal(leveled.getSnapshot().hero.level, 3);
leveled.deployAt(-10.5, 0);
leveled.tick();
const leveledDelver = leveled
  .getSnapshot()
  .entities.find((entity) => entity.category === "troop");
assert.ok(leveledDelver.health.maximum > 115, "levels must scale delver power");
const syncedRemoteProfile = createBattleClashGame();
syncedRemoteProfile.setProgression({ level: 4, xp: 8, xpToNext: 246 });
assert.equal(syncedRemoteProfile.getSnapshot().hero.level, 4);
assert.equal(syncedRemoteProfile.getSnapshot().world.hero.level, 4);

const defended = createBattleClashGame();
const coreEntity = defended.engine.world
  .query(Components.Identity, Components.Health)
  .find(
    (entity) =>
      defended.engine.world.getComponent(entity, Components.Identity).role ===
      "core"
  );
const coreHealth = defended.engine.world.getComponent(
  coreEntity,
  Components.Health
);
defended.engine.world.setComponent(coreEntity, Components.Health, {
  ...coreHealth,
  current: 260
});
defended.startRaid();
defended.tick();
defended.fortify();
defended.tick();
assert.ok(defended.getSnapshot().coreHealth.current > 260);
assert.equal(defended.getSnapshot().defense.wardCharges, 0);

const envelope = createPeerMessage(
  "command",
  { command: { kind: "deploy", x: 10.5, z: -2 } },
  { roomId: "room-0", senderId: "peer-a", sequence: 1 }
);
assert.deepEqual(parsePeerMessage(envelope), envelope);
const snapshotChunk = createPeerMessage(
  "snapshot-chunk",
  { snapshotId: "room-0:1", index: 0, total: 2, data: "{\"schema\":" },
  { roomId: "room-0", senderId: "peer-host", sequence: 1 }
);
assert.deepEqual(parsePeerMessage(snapshotChunk), snapshotChunk);
assert.deepEqual(normalizePeerCommand(envelope.payload.command), {
  kind: "deploy",
  x: 10.5,
  z: -2
});
assert.deepEqual(normalizePeerCommand({ kind: "scene", sceneId: "territory", territoryId: "ash-crossing" }), {
  kind: "scene",
  sceneId: "territory",
  territoryId: "ash-crossing",
  frontDirection: null
});
assert.equal(normalizePeerCommand({
  kind: "scene",
  sceneId: "encounter",
  territoryId: "ash-crossing",
  frontDirection: "north"
}).frontDirection, "north");
assert.deepEqual(normalizePeerCommand({ kind: "move-hero", x: 120, z: -4 }), {
  kind: "move-hero",
  x: 99,
  z: 0
});
const authoritativeSnapshot = createPeerMessage(
  "snapshot",
  { snapshot: frontier.getSnapshot() },
  { roomId: "room-0", senderId: "peer-host", sequence: 2 }
);
const parsedSnapshot = parsePeerMessage(authoritativeSnapshot);
assert.equal(parsedSnapshot.payload.snapshot.schema, "battle-clash.snapshot/1");
assert.ok(parsedSnapshot.payload.snapshot.world.factionStrategy);
assert.equal(parsedSnapshot.payload.snapshot.world.grid.width, 100);
assert.ok(Array.isArray(parsedSnapshot.payload.snapshot.economy.tradeRoutes));
assert.ok(Array.isArray(parsedSnapshot.payload.snapshot.territory.landmarks));
assert.ok(Array.isArray(parsedSnapshot.payload.snapshot.landscape.hazards));
assert.equal(isPeerMessageFresh(authoritativeSnapshot, "room-0", 1), true);
assert.equal(isPeerMessageFresh(authoritativeSnapshot, "room-0", 2), false);
assert.equal(isPeerMessageFresh({ ...authoritativeSnapshot, roomId: "other-room" }, "room-0", 0), false);
assert.equal(isPeerMessageFresh(authoritativeSnapshot, "room-0", 0, "peer-host"), true);
assert.equal(isPeerMessageFresh(authoritativeSnapshot, "room-0", 0, "spoofed-peer"), false);

console.log(JSON.stringify({
  ok: true,
  seed: WORLD_SEED,
  fixedDelta: 1 / 30,
  installedBattleDomains: first.snapshot.domains.filter((path) => path.includes("battle-clash")),
  activeCellCount: first.snapshot.activeCellCount,
  result: first.snapshot.raid.phase,
  timeRemaining: first.snapshot.raid.timeRemaining,
  digest: first.digest,
  progression: first.snapshot.progression,
  leveledDelverHealth: leveledDelver.health.maximum,
  defenderWardRestored: defended.getSnapshot().coreHealth.current - 260,
  reset: {
    phase: reset.raid.phase,
    remaining: reset.deployment.remaining,
    coreHealth: reset.coreHealth
  }
}, null, 2));
