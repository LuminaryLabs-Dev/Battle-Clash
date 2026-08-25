export const BUILDING_MAX_LEVEL = 3;

export const BUILDING_PLOTS = Object.freeze([
  Object.freeze({ id: "plot-northwest", position: Object.freeze({ x: -4.8, z: -4.8 }), size: Object.freeze([2.8, 2.8]) }),
  Object.freeze({ id: "plot-northeast", position: Object.freeze({ x: 4.8, z: -4.8 }), size: Object.freeze([2.8, 2.8]) }),
  Object.freeze({ id: "plot-southwest", position: Object.freeze({ x: -4.8, z: 4.8 }), size: Object.freeze([2.8, 2.8]) }),
  Object.freeze({ id: "plot-southeast", position: Object.freeze({ x: 4.8, z: 4.8 }), size: Object.freeze([2.8, 2.8]) }),
  Object.freeze({ id: "plot-west", position: Object.freeze({ x: -7.6, z: 0 }), size: Object.freeze([2.6, 2.6]) }),
  Object.freeze({ id: "plot-east", position: Object.freeze({ x: 7.6, z: 0 }), size: Object.freeze([2.6, 2.6]) })
]);

export const BUILDING_BLUEPRINTS = Object.freeze({
  barracks: Object.freeze({
    id: "barracks",
    label: "Delver Hall",
    style: "barracks",
    footprint: Object.freeze([2.5, 2.5]),
    cost: Object.freeze({ gold: 48, food: 18, iron: 10, arcane: 0 }),
    upgradeScale: 1.55,
    bonus: Object.freeze({ armyCapacity: 2, recruitmentDiscount: 0.05 })
  }),
  foundry: Object.freeze({
    id: "foundry",
    label: "Ember Foundry",
    style: "foundry",
    footprint: Object.freeze([2.4, 2.4]),
    cost: Object.freeze({ gold: 42, food: 0, iron: 16, arcane: 0 }),
    upgradeScale: 1.6,
    bonus: Object.freeze({ ironRate: 0.08, craftDiscount: 0.06 })
  }),
  watchtower: Object.freeze({
    id: "watchtower",
    label: "Frontier Watch",
    style: "watchtower",
    footprint: Object.freeze([2.15, 2.15]),
    cost: Object.freeze({ gold: 36, food: 8, iron: 12, arcane: 0 }),
    upgradeScale: 1.5,
    bonus: Object.freeze({ defensePower: 0.08, scoutingRadius: 0.2 })
  }),
  storehouse: Object.freeze({
    id: "storehouse",
    label: "Vault Storehouse",
    style: "storehouse",
    footprint: Object.freeze([2.55, 2.55]),
    cost: Object.freeze({ gold: 32, food: 0, iron: 9, arcane: 0 }),
    upgradeScale: 1.45,
    bonus: Object.freeze({ storage: 60, supplyProtection: 0.05 })
  })
});

export const BUILDING_BLUEPRINT_ORDER = Object.freeze(Object.keys(BUILDING_BLUEPRINTS));

export function buildingCost(blueprintId, targetLevel = 1) {
  const blueprint = BUILDING_BLUEPRINTS[String(blueprintId ?? "")];
  if (!blueprint) return null;
  const level = Math.max(1, Math.min(BUILDING_MAX_LEVEL, Math.floor(Number(targetLevel) || 1)));
  const scale = level <= 1 ? 1 : blueprint.upgradeScale ** (level - 1);
  return Object.fromEntries(Object.entries(blueprint.cost).map(([resource, amount]) => [
    resource,
    Math.max(0, Math.ceil(Number(amount) * scale))
  ]));
}

export function buildingBlueprint(blueprintId) {
  return BUILDING_BLUEPRINTS[String(blueprintId ?? "")] ?? null;
}

