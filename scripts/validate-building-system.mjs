import assert from "node:assert/strict";
import { createBattleClashGame } from "../src/composition/create-battle-clash.js";
import { generateProceduralBuilding } from "../src/buildings/procedural-building-generator.js";
import { buildingCost } from "../src/data/buildings.js";
import { createDefaultBuildingState, validateBuildingPlacement } from "../src/domains/building/building-state.js";

const firstDescriptor = generateProceduralBuilding({ id: "tower-a", blueprintId: "watchtower", level: 2, seed: "proof" });
const secondDescriptor = generateProceduralBuilding({ id: "tower-a", blueprintId: "watchtower", level: 2, seed: "proof" });
assert.deepEqual(firstDescriptor, secondDescriptor, "procedural descriptors must be deterministic");
assert.equal(firstDescriptor.schema, "battle-clash.procedural-building/1");
assert.ok(firstDescriptor.parts.length >= 8);
assert.equal(firstDescriptor.collision.shape, "aabb");

const collisionState = createDefaultBuildingState();
collisionState.plots = [{ id: "plot-central", position: { x: 0, z: 0 }, size: [3, 3], buildingId: null }];
const centralCollision = validateBuildingPlacement(collisionState, "barracks", "plot-central");
assert.equal(centralCollision.accepted, false);
assert.equal(centralCollision.reason, "building-collision");
assert.equal(centralCollision.collisionId, "dawnwatch-keep");

const game = createBattleClashGame({
  world: {
    economy: {
      resources: { gold: 1000, food: 1000, iron: 1000, arcane: 1000 }
    }
  }
});
const initial = game.getSnapshot();
assert.equal(initial.buildings.schema, "battle-clash.buildings/1");
assert.equal(initial.buildings.plots.length, 6);
assert.equal(Object.keys(initial.buildings.structures).length, 0);
assert.ok(initial.domains.includes("n:game:battle-clash:building"));

assert.equal(game.selectBuildingBlueprint("barracks").accepted, true);
assert.equal(game.selectBuildingPlot("plot-northwest").accepted, true);
const goldBefore = game.getSnapshot().economy.resources.gold;
const placed = game.placeBuilding({ blueprintId: "barracks", plotId: "plot-northwest" });
assert.equal(placed.accepted, true);
assert.equal(placed.building.level, 1);
assert.equal(game.getSnapshot().economy.resources.gold, goldBefore - buildingCost("barracks", 1).gold);
assert.equal(game.getSnapshot().army.capacity, 14);
assert.equal(game.getSnapshot().buildings.plots.find((plot) => plot.id === "plot-northwest").buildingId, placed.building.id);

const occupied = game.placeBuilding({ blueprintId: "foundry", plotId: "plot-northwest" });
assert.equal(occupied.accepted, false);
assert.equal(occupied.reason, "building-plot-occupied");

for (const expectedLevel of [2, 3]) {
  const upgraded = game.upgradeBuilding(placed.building.id);
  assert.equal(upgraded.accepted, true);
  assert.equal(upgraded.building.level, expectedLevel);
}
assert.equal(game.upgradeBuilding(placed.building.id).reason, "building-max-level");
assert.equal(game.getSnapshot().army.capacity, 18);

const persisted = game.getDeterministicSnapshot();
const rehydrated = createBattleClashGame({ world: persisted.world });
assert.deepEqual(rehydrated.getSnapshot().buildings, persisted.buildings);
assert.equal(rehydrated.getSnapshot().army.capacity, 18);

const demolished = game.demolishBuilding(placed.building.id);
assert.equal(demolished.accepted, true);
assert.ok(demolished.refund.gold > 0);
assert.equal(Object.keys(game.getSnapshot().buildings.structures).length, 0);
assert.equal(game.getSnapshot().army.capacity, 12);

console.log(JSON.stringify({
  ok: true,
  deterministicPartCount: firstDescriptor.parts.length,
  collision: centralCollision,
  placementReceipt: placed.receipt,
  maxLevel: persisted.buildings.structures[placed.building.id].level,
  persistenceDigest: rehydrated.getDigest(),
  demolitionReceipt: demolished.receipt
}, null, 2));
