export const WORLD_ID = "battle-clash-obsidian-vault";
export const WORLD_SEED = "battle-clash-dungeon-run-v1";

export const BATTLEFIELD = Object.freeze({
  halfSize: 12,
  deployMin: 9,
  deployMax: 11.75,
  raidDuration: 45,
  troopBudget: 8,
  cellSize: 4,
  cellRadius: 3
});

export const PROGRESSION = Object.freeze({
  baseXpToLevel: 100,
  levelGrowth: 1.35,
  powerPerLevel: 0.08,
  winXp: 72,
  lossXp: 24,
  destroyedStructureXp: 4
});

export const ARCHETYPES = Object.freeze({
  delver: Object.freeze({
    id: "delver",
    category: "troop",
    role: "delver",
    faction: "player",
    health: 115,
    size: [0.9, 0.9, 0.9],
    color: "#3b82f6",
    emissive: "#123f92",
    speed: 3.7,
    attack: Object.freeze({ damage: 32, range: 1.05, cooldown: 0.62 })
  }),
  heart: Object.freeze({
    id: "heart",
    category: "building",
    role: "core",
    faction: "enemy",
    health: 520,
    size: [3.2, 3.8, 3.2],
    color: "#a855f7",
    emissive: "#4c1d95",
    targetBias: -3.6
  }),
  sentinel: Object.freeze({
    id: "sentinel",
    category: "building",
    role: "defense",
    faction: "enemy",
    health: 185,
    size: [1.8, 3, 1.8],
    color: "#ef4444",
    emissive: "#7f1d1d",
    targetBias: -1.2,
    attack: Object.freeze({ damage: 14, range: 7.1, cooldown: 0.86 })
  }),
  relic: Object.freeze({
    id: "relic",
    category: "building",
    role: "resource",
    faction: "enemy",
    health: 135,
    size: [2.2, 2.1, 2.2],
    color: "#f97316",
    emissive: "#7c2d12",
    targetBias: 0
  }),
  wall: Object.freeze({
    id: "wall",
    category: "scenery",
    role: "wall",
    faction: "enemy",
    size: [1.25, 1.05, 1.25],
    color: "#64748b",
    emissive: "#1e293b"
  })
});

const wallPositions = [
  [-5, -5],
  [-3.7, -5],
  [-2.4, -5],
  [-1.1, -5],
  [1.1, -5],
  [2.4, -5],
  [3.7, -5],
  [5, -5],
  [-5, 5],
  [-3.7, 5],
  [-2.4, 5],
  [-1.1, 5],
  [1.1, 5],
  [2.4, 5],
  [3.7, 5],
  [5, 5],
  [-5, -3.7],
  [-5, -2.4],
  [-5, 2.4],
  [-5, 3.7],
  [5, -3.7],
  [5, -2.4],
  [5, 2.4],
  [5, 3.7]
];

export const INITIAL_DUNGEON = Object.freeze([
  Object.freeze({ id: "dungeon-heart", archetype: "heart", position: [0, 0] }),
  Object.freeze({ id: "northwest-sentinel", archetype: "sentinel", position: [-4.2, -1.8] }),
  Object.freeze({ id: "southeast-sentinel", archetype: "sentinel", position: [4.2, 1.8] }),
  Object.freeze({ id: "gold-relic", archetype: "relic", position: [-3.4, 3.6] }),
  Object.freeze({ id: "ember-relic", archetype: "relic", position: [3.4, -3.6] }),
  ...wallPositions.map((position, index) =>
    Object.freeze({ id: `wall-${String(index + 1).padStart(2, "0")}`, archetype: "wall", position })
  )
]);
