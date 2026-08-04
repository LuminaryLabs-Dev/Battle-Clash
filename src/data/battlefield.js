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
  hero: Object.freeze({
    id: "hero",
    category: "troop",
    role: "hero",
    faction: "player",
    health: 260,
    size: [1.05, 1.45, 1.05],
    color: "#fbbf24",
    emissive: "#b45309",
    speed: 4.2,
    attack: Object.freeze({ damage: 58, range: 1.25, cooldown: 0.72 }),
    ability: Object.freeze({ id: "arc-burst", damage: 92, cooldown: 8 })
  }),
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
  lancer: Object.freeze({
    id: "lancer",
    category: "troop",
    role: "lancer",
    faction: "player",
    health: 155,
    size: [1, 1.05, 1],
    color: "#22c55e",
    emissive: "#14532d",
    speed: 3.15,
    attack: Object.freeze({ damage: 46, range: 1.15, cooldown: 0.78 })
  }),
  arcanist: Object.freeze({
    id: "arcanist",
    category: "troop",
    role: "arcanist",
    faction: "player",
    health: 88,
    size: [0.84, 1.15, 0.84],
    color: "#38bdf8",
    emissive: "#0c4a6e",
    speed: 2.8,
    attack: Object.freeze({ damage: 25, range: 5.8, cooldown: 0.52 })
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
  scout: Object.freeze({
    id: "scout",
    category: "building",
    role: "defense",
    faction: "enemy",
    health: 120,
    size: [1.35, 2.2, 1.35],
    color: "#f97316",
    emissive: "#7c2d12",
    targetBias: -0.5,
    attack: Object.freeze({ damage: 10, range: 8.4, cooldown: 0.58 })
  }),
  bastion: Object.freeze({
    id: "bastion",
    category: "building",
    role: "defense",
    faction: "enemy",
    health: 280,
    size: [2.25, 3.2, 2.25],
    color: "#64748b",
    emissive: "#1e293b",
    targetBias: -1.8,
    attack: Object.freeze({ damage: 20, range: 6.2, cooldown: 1.08 })
  }),
  elite: Object.freeze({
    id: "elite",
    category: "building",
    role: "defense",
    faction: "enemy",
    health: 360,
    size: [2.45, 3.5, 2.45],
    color: "#facc15",
    emissive: "#854d0e",
    targetBias: -2.1,
    attack: Object.freeze({ damage: 28, range: 7.6, cooldown: 0.94 })
  }),
  boss: Object.freeze({
    id: "boss",
    category: "building",
    role: "defense",
    faction: "enemy",
    health: 480,
    size: [2.8, 3.8, 2.8],
    color: "#be123c",
    emissive: "#881337",
    targetBias: -2.4,
    attack: Object.freeze({ damage: 24, range: 8.2, cooldown: 1.1 })
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
