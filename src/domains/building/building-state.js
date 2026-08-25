import {
  BUILDING_BLUEPRINT_ORDER,
  BUILDING_MAX_LEVEL,
  BUILDING_PLOTS,
  buildingBlueprint,
  buildingCost
} from "../../data/buildings.js";

const RESOURCE_KEYS = ["gold", "food", "iron", "arcane"];
const BASE_STORAGE = Object.freeze({ gold: 500, food: 500, iron: 300, arcane: 200 });
const SANCTUM_COLLIDER = Object.freeze({ id: "dawnwatch-keep", x: 0, z: 0, width: 4.2, depth: 4.2 });

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeStructure(structure = {}) {
  const blueprint = buildingBlueprint(structure.blueprintId);
  if (!blueprint) return null;
  const plot = BUILDING_PLOTS.find((candidate) => candidate.id === structure.plotId);
  if (!plot) return null;
  return {
    id: String(structure.id ?? `building-${plot.id}`),
    blueprintId: blueprint.id,
    plotId: plot.id,
    level: Math.max(1, Math.min(BUILDING_MAX_LEVEL, Math.floor(finite(structure.level, 1)))),
    position: { ...plot.position },
    footprint: [...blueprint.footprint],
    seed: String(structure.seed ?? `dawnwatch:${plot.id}:${blueprint.id}`),
    builtRevision: Math.max(1, Math.floor(finite(structure.builtRevision, 1))),
    upgradedRevision: Math.max(1, Math.floor(finite(structure.upgradedRevision, structure.builtRevision ?? 1)))
  };
}

export function calculateBuildingBonuses(structures = {}) {
  const bonuses = {
    armyCapacity: 0,
    recruitmentDiscount: 0,
    ironProduction: 0,
    craftDiscount: 0,
    defensePower: 0,
    scoutingRadius: 0,
    storage: 0,
    supplyProtection: 0
  };
  for (const structure of Object.values(structures)) {
    const blueprint = buildingBlueprint(structure.blueprintId);
    if (!blueprint) continue;
    const level = Math.max(1, Math.min(BUILDING_MAX_LEVEL, Math.floor(finite(structure.level, 1))));
    for (const [key, amount] of Object.entries(blueprint.bonus ?? {})) {
      const target = key === "ironRate" ? "ironProduction" : key;
      bonuses[target] = finite(bonuses[target]) + finite(amount) * level;
    }
  }
  return Object.fromEntries(Object.entries(bonuses).map(([key, value]) => [key, Number(value.toFixed(4))]));
}

export function createDefaultBuildingState(profile = {}) {
  const structures = Object.fromEntries(
    Object.values(profile.structures ?? {})
      .map(normalizeStructure)
      .filter(Boolean)
      .map((structure) => [structure.id, structure])
  );
  const occupiedByPlot = new Map(Object.values(structures).map((structure) => [structure.plotId, structure.id]));
  const selectedBlueprintId = BUILDING_BLUEPRINT_ORDER.includes(profile.selectedBlueprintId)
    ? profile.selectedBlueprintId
    : BUILDING_BLUEPRINT_ORDER[0];
  return {
    schema: "battle-clash.buildings/1",
    revision: Math.max(1, Math.floor(finite(profile.revision, 1))),
    selectedBlueprintId,
    selectedPlotId: BUILDING_PLOTS.some((plot) => plot.id === profile.selectedPlotId)
      ? profile.selectedPlotId
      : BUILDING_PLOTS[0].id,
    selectedBuildingId: structures[profile.selectedBuildingId] ? profile.selectedBuildingId : null,
    plots: BUILDING_PLOTS.map((plot) => ({
      id: plot.id,
      position: { ...plot.position },
      size: [...plot.size],
      buildingId: occupiedByPlot.get(plot.id) ?? null
    })),
    structures,
    bonuses: calculateBuildingBonuses(structures),
    lastReceipt: profile.lastReceipt ? structuredClone(profile.lastReceipt) : null
  };
}

function aabbFor(position, footprint) {
  return {
    minX: position.x - footprint[0] / 2,
    maxX: position.x + footprint[0] / 2,
    minZ: position.z - footprint[1] / 2,
    maxZ: position.z + footprint[1] / 2
  };
}

function overlaps(left, right, clearance = 0.12) {
  return left.minX < right.maxX + clearance
    && left.maxX > right.minX - clearance
    && left.minZ < right.maxZ + clearance
    && left.maxZ > right.minZ - clearance;
}

export function validateBuildingPlacement(buildings, blueprintId, plotId) {
  const blueprint = buildingBlueprint(blueprintId);
  if (!blueprint) return { accepted: false, reason: "unknown-building-blueprint" };
  const plot = buildings.plots.find((candidate) => candidate.id === plotId);
  if (!plot) return { accepted: false, reason: "unknown-building-plot" };
  if (plot.buildingId) return { accepted: false, reason: "building-plot-occupied", collisionId: plot.buildingId };
  if (blueprint.footprint[0] > plot.size[0] || blueprint.footprint[1] > plot.size[1]) {
    return { accepted: false, reason: "building-footprint-too-large" };
  }
  const candidate = aabbFor(plot.position, blueprint.footprint);
  const central = aabbFor(
    { x: SANCTUM_COLLIDER.x, z: SANCTUM_COLLIDER.z },
    [SANCTUM_COLLIDER.width, SANCTUM_COLLIDER.depth]
  );
  if (overlaps(candidate, central)) {
    return { accepted: false, reason: "building-collision", collisionId: SANCTUM_COLLIDER.id };
  }
  for (const structure of Object.values(buildings.structures)) {
    if (overlaps(candidate, aabbFor(structure.position, structure.footprint))) {
      return { accepted: false, reason: "building-collision", collisionId: structure.id };
    }
  }
  return { accepted: true, plot: structuredClone(plot), blueprint: structuredClone(blueprint) };
}

function canAfford(resources, cost) {
  return RESOURCE_KEYS.every((key) => finite(resources[key]) >= finite(cost[key]));
}

function deduct(resources, cost) {
  return Object.fromEntries(RESOURCE_KEYS.map((key) => [key, finite(resources[key]) - finite(cost[key])]));
}

function totalInvested(blueprintId, level) {
  return RESOURCE_KEYS.reduce((total, key) => {
    total[key] = 0;
    for (let tier = 1; tier <= level; tier += 1) total[key] += finite(buildingCost(blueprintId, tier)?.[key]);
    return total;
  }, {});
}

export function applyBuildingBonuses(worldState, buildings) {
  const bonuses = calculateBuildingBonuses(buildings.structures);
  const baseCapacity = 12
    + Math.max(0, (worldState.controlledTerritoryIds?.length ?? 1) - 1) * 2
    + Math.max(0, finite(worldState.sanctum?.level, 1) - 1) * 4;
  const storage = Object.fromEntries(RESOURCE_KEYS.map((key) => [
    key,
    BASE_STORAGE[key] + bonuses.storage
  ]));
  const resources = Object.fromEntries(RESOURCE_KEYS.map((key) => [
    key,
    Math.min(storage[key], finite(worldState.economy?.resources?.[key]))
  ]));
  return {
    ...worldState,
    buildings: { ...buildings, bonuses },
    army: {
      ...worldState.army,
      capacity: baseCapacity + bonuses.armyCapacity
    },
    economy: {
      ...worldState.economy,
      storage,
      resources,
      buildingBonuses: structuredClone(bonuses)
    },
    sanctum: {
      ...worldState.sanctum,
      buildingCount: Object.keys(buildings.structures).length,
      buildingBonuses: structuredClone(bonuses)
    }
  };
}

function reject(state, reason, detail = {}) {
  return { accepted: false, reason, ...detail, state };
}

export function selectBuildingBlueprint(worldState, blueprintId) {
  if (!buildingBlueprint(blueprintId)) return reject(worldState, "unknown-building-blueprint");
  const revision = worldState.revision + 1;
  const buildings = { ...worldState.buildings, revision, selectedBlueprintId: blueprintId };
  return { accepted: true, state: applyBuildingBonuses({ ...worldState, revision }, buildings) };
}

export function selectBuildingPlot(worldState, plotId) {
  const plot = worldState.buildings.plots.find((candidate) => candidate.id === plotId);
  if (!plot) return reject(worldState, "unknown-building-plot");
  const revision = worldState.revision + 1;
  const buildings = {
    ...worldState.buildings,
    revision,
    selectedPlotId: plot.id,
    selectedBuildingId: plot.buildingId
  };
  return { accepted: true, state: applyBuildingBonuses({ ...worldState, revision }, buildings) };
}

export function selectBuilding(worldState, buildingId) {
  const structure = worldState.buildings.structures[buildingId];
  if (!structure) return reject(worldState, "unknown-building");
  const revision = worldState.revision + 1;
  const buildings = {
    ...worldState.buildings,
    revision,
    selectedPlotId: structure.plotId,
    selectedBuildingId: structure.id,
    selectedBlueprintId: structure.blueprintId
  };
  return { accepted: true, state: applyBuildingBonuses({ ...worldState, revision }, buildings) };
}

export function placeBuilding(worldState, request = {}) {
  if (worldState.currentTerritoryId !== "dawnwatch-sanctum") return reject(worldState, "sanctum-required");
  const blueprintId = String(request.blueprintId ?? worldState.buildings.selectedBlueprintId);
  const plotId = String(request.plotId ?? worldState.buildings.selectedPlotId);
  const validation = validateBuildingPlacement(worldState.buildings, blueprintId, plotId);
  if (!validation.accepted) return reject(worldState, validation.reason, validation);
  const cost = buildingCost(blueprintId, 1);
  if (!canAfford(worldState.economy.resources, cost)) return reject(worldState, "insufficient-building-resources", { cost });
  const revision = worldState.revision + 1;
  const id = `building-${plotId}`;
  const structure = {
    id,
    blueprintId,
    plotId,
    level: 1,
    position: { ...validation.plot.position },
    footprint: [...validation.blueprint.footprint],
    seed: `dawnwatch:${plotId}:${blueprintId}`,
    builtRevision: revision,
    upgradedRevision: revision
  };
  const receipt = { kind: "placed", buildingId: id, blueprintId, plotId, level: 1, cost, revision };
  const structures = { ...worldState.buildings.structures, [id]: structure };
  const buildings = {
    ...worldState.buildings,
    revision,
    selectedPlotId: plotId,
    selectedBuildingId: id,
    plots: worldState.buildings.plots.map((plot) => plot.id === plotId ? { ...plot, buildingId: id } : plot),
    structures,
    bonuses: calculateBuildingBonuses(structures),
    lastReceipt: receipt
  };
  const state = applyBuildingBonuses({
    ...worldState,
    revision,
    economy: { ...worldState.economy, resources: deduct(worldState.economy.resources, cost) }
  }, buildings);
  return { accepted: true, building: structuredClone(structure), cost, receipt, state };
}

export function upgradeBuilding(worldState, buildingId = worldState.buildings.selectedBuildingId) {
  if (worldState.currentTerritoryId !== "dawnwatch-sanctum") return reject(worldState, "sanctum-required");
  const structure = worldState.buildings.structures[buildingId];
  if (!structure) return reject(worldState, "unknown-building");
  if (structure.level >= BUILDING_MAX_LEVEL) return reject(worldState, "building-max-level");
  const level = structure.level + 1;
  const cost = buildingCost(structure.blueprintId, level);
  if (!canAfford(worldState.economy.resources, cost)) return reject(worldState, "insufficient-building-resources", { cost });
  const revision = worldState.revision + 1;
  const upgraded = { ...structure, level, upgradedRevision: revision };
  const receipt = { kind: "upgraded", buildingId, blueprintId: structure.blueprintId, plotId: structure.plotId, level, cost, revision };
  const structures = { ...worldState.buildings.structures, [buildingId]: upgraded };
  const buildings = { ...worldState.buildings, revision, structures, bonuses: calculateBuildingBonuses(structures), lastReceipt: receipt };
  const state = applyBuildingBonuses({
    ...worldState,
    revision,
    economy: { ...worldState.economy, resources: deduct(worldState.economy.resources, cost) }
  }, buildings);
  return { accepted: true, building: structuredClone(upgraded), cost, receipt, state };
}

export function demolishBuilding(worldState, buildingId = worldState.buildings.selectedBuildingId) {
  if (worldState.currentTerritoryId !== "dawnwatch-sanctum") return reject(worldState, "sanctum-required");
  const structure = worldState.buildings.structures[buildingId];
  if (!structure) return reject(worldState, "unknown-building");
  const invested = totalInvested(structure.blueprintId, structure.level);
  const refund = Object.fromEntries(RESOURCE_KEYS.map((key) => [key, Math.floor(invested[key] * 0.35)]));
  const revision = worldState.revision + 1;
  const structures = { ...worldState.buildings.structures };
  delete structures[buildingId];
  const receipt = { kind: "demolished", buildingId, blueprintId: structure.blueprintId, plotId: structure.plotId, level: structure.level, refund, revision };
  const resources = Object.fromEntries(RESOURCE_KEYS.map((key) => [key, finite(worldState.economy.resources[key]) + refund[key]]));
  const buildings = {
    ...worldState.buildings,
    revision,
    selectedBuildingId: null,
    plots: worldState.buildings.plots.map((plot) => plot.id === structure.plotId ? { ...plot, buildingId: null } : plot),
    structures,
    bonuses: calculateBuildingBonuses(structures),
    lastReceipt: receipt
  };
  const state = applyBuildingBonuses({ ...worldState, revision, economy: { ...worldState.economy, resources } }, buildings);
  return { accepted: true, refund, receipt, state };
}
