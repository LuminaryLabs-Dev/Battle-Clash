export const WORLD_MAP_SEED = "battle-clash-frontier-world-v1";

export const TERRITORY_GRID = Object.freeze({
  width: 100,
  height: 100,
  cellSize: 1
});

const AUTHORED_TERRITORIES = Object.freeze([
  Object.freeze({
    id: "dawnwatch-sanctum",
    title: "Dawnwatch Sanctum",
    kind: "sanctum",
    coordinates: Object.freeze({ x: 0, z: 0 }),
    ownerFaction: "player",
    neighbors: Object.freeze({ east: "ash-crossing", north: "verdant-rift", west: "cinder-road", south: "moonfen" }),
    fronts: Object.freeze([]),
    economy: Object.freeze({ gold: 4, food: 6, iron: 1, arcane: 0 })
  }),
  Object.freeze({
    id: "ash-crossing",
    title: "Ash Crossing",
    kind: "frontier",
    coordinates: Object.freeze({ x: 1, z: 0 }),
    ownerFaction: "neutral",
    neighbors: Object.freeze({ west: "dawnwatch-sanctum", east: "obsidian-vault", north: "redfen-march", south: "ember-coast" }),
    fronts: Object.freeze([
      Object.freeze({ direction: "west", faction: "player", pressure: 0.15 }),
      Object.freeze({ direction: "east", faction: "obsidian-court", pressure: 0.6 }),
      Object.freeze({ direction: "north", faction: "redfen-clan", pressure: 0.35 })
    ]),
    economy: Object.freeze({ gold: 2, food: 3, iron: 3, arcane: 1 })
  }),
  Object.freeze({
    id: "obsidian-vault",
    title: "Obsidian Vault",
    kind: "dungeon",
    coordinates: Object.freeze({ x: 2, z: 0 }),
    ownerFaction: "obsidian-court",
    neighbors: Object.freeze({ west: "ash-crossing", north: "blackglass-rise" }),
    fronts: Object.freeze([
      Object.freeze({ direction: "west", faction: "player", pressure: 0.25 })
    ]),
    economy: Object.freeze({ gold: 6, food: 0, iron: 2, arcane: 5 })
  }),
  Object.freeze({
    id: "verdant-rift",
    title: "Verdant Rift",
    kind: "wilds",
    coordinates: Object.freeze({ x: 0, z: 1 }),
    ownerFaction: "neutral",
    neighbors: Object.freeze({ south: "dawnwatch-sanctum", east: "redfen-march", west: "frostline" }),
    fronts: Object.freeze([
      Object.freeze({ direction: "south", faction: "player", pressure: 0.1 }),
      Object.freeze({ direction: "east", faction: "redfen-clan", pressure: 0.45 })
    ]),
    economy: Object.freeze({ gold: 1, food: 8, iron: 0, arcane: 2 })
  }),
  Object.freeze({
    id: "redfen-march",
    title: "Redfen March",
    kind: "frontier",
    coordinates: Object.freeze({ x: 1, z: 1 }),
    ownerFaction: "redfen-clan",
    neighbors: Object.freeze({ south: "ash-crossing", west: "verdant-rift" }),
    fronts: Object.freeze([
      Object.freeze({ direction: "south", faction: "obsidian-court", pressure: 0.5 }),
      Object.freeze({ direction: "west", faction: "player", pressure: 0.2 })
    ]),
    economy: Object.freeze({ gold: 3, food: 5, iron: 2, arcane: 0 })
  }),
  Object.freeze({
    id: "blackglass-rise",
    title: "Blackglass Rise",
    kind: "stronghold",
    coordinates: Object.freeze({ x: 2, z: 1 }),
    ownerFaction: "obsidian-court",
    neighbors: Object.freeze({ south: "obsidian-vault" }),
    fronts: Object.freeze([
      Object.freeze({ direction: "south", faction: "player", pressure: 0.75 })
    ]),
    economy: Object.freeze({ gold: 8, food: 0, iron: 5, arcane: 8 })
  }),
  Object.freeze({
    id: "cinder-road",
    title: "Cinder Road",
    kind: "frontier",
    coordinates: Object.freeze({ x: -1, z: 0 }),
    ownerFaction: "neutral",
    neighbors: Object.freeze({ east: "dawnwatch-sanctum", west: "stoneveil", south: "frostline" }),
    fronts: Object.freeze([
      Object.freeze({ direction: "east", faction: "player", pressure: 0.12 }),
      Object.freeze({ direction: "west", faction: "redfen-clan", pressure: 0.4 })
    ]),
    economy: Object.freeze({ gold: 2, food: 4, iron: 2, arcane: 0 })
  }),
  Object.freeze({
    id: "stoneveil",
    title: "Stoneveil Bastion",
    kind: "stronghold",
    coordinates: Object.freeze({ x: -2, z: 0 }),
    ownerFaction: "redfen-clan",
    neighbors: Object.freeze({ east: "cinder-road", south: "frostline" }),
    fronts: Object.freeze([
      Object.freeze({ direction: "east", faction: "player", pressure: 0.5 })
    ]),
    economy: Object.freeze({ gold: 5, food: 0, iron: 6, arcane: 1 })
  }),
  Object.freeze({
    id: "moonfen",
    title: "Moonfen Crossing",
    kind: "wilds",
    coordinates: Object.freeze({ x: 0, z: -1 }),
    ownerFaction: "neutral",
    neighbors: Object.freeze({ north: "dawnwatch-sanctum", south: "sunken-grove", east: "ember-coast" }),
    fronts: Object.freeze([
      Object.freeze({ direction: "north", faction: "player", pressure: 0.18 }),
      Object.freeze({ direction: "south", faction: "obsidian-court", pressure: 0.38 })
    ]),
    economy: Object.freeze({ gold: 1, food: 7, iron: 0, arcane: 3 })
  }),
  Object.freeze({
    id: "sunken-grove",
    title: "Sunken Grove",
    kind: "dungeon",
    coordinates: Object.freeze({ x: 0, z: -2 }),
    ownerFaction: "obsidian-court",
    neighbors: Object.freeze({ north: "moonfen", east: "ember-coast" }),
    fronts: Object.freeze([
      Object.freeze({ direction: "north", faction: "player", pressure: 0.42 })
    ]),
    economy: Object.freeze({ gold: 4, food: 1, iron: 1, arcane: 6 })
  }),
  Object.freeze({
    id: "frostline",
    title: "Frostline Pass",
    kind: "frontier",
    coordinates: Object.freeze({ x: -1, z: -1 }),
    ownerFaction: "redfen-clan",
    neighbors: Object.freeze({ north: "cinder-road", east: "moonfen", south: "stoneveil" }),
    fronts: Object.freeze([
      Object.freeze({ direction: "north", faction: "player", pressure: 0.28 }),
      Object.freeze({ direction: "east", faction: "redfen-clan", pressure: 0.55 })
    ]),
    economy: Object.freeze({ gold: 3, food: 3, iron: 4, arcane: 0 })
  }),
  Object.freeze({
    id: "ember-coast",
    title: "Ember Coast",
    kind: "frontier",
    coordinates: Object.freeze({ x: 1, z: -1 }),
    ownerFaction: "neutral",
    neighbors: Object.freeze({ north: "ash-crossing", west: "moonfen", south: "sunken-grove" }),
    fronts: Object.freeze([
      Object.freeze({ direction: "north", faction: "obsidian-court", pressure: 0.48 }),
      Object.freeze({ direction: "west", faction: "player", pressure: 0.22 })
    ]),
    economy: Object.freeze({ gold: 5, food: 2, iron: 3, arcane: 2 })
  })
]);

function generatedTerritories() {
  const occupied = new Set(AUTHORED_TERRITORIES.map((territory) => `${territory.coordinates.x},${territory.coordinates.z}`));
  const nodes = [];
  const byCoordinate = new Map(AUTHORED_TERRITORIES.map((territory) => [`${territory.coordinates.x},${territory.coordinates.z}`, territory.id]));
  for (let x = -6; x <= 6; x += 1) {
    for (let z = -6; z <= 6; z += 1) {
      const coordinateKey = `${x},${z}`;
      if (occupied.has(coordinateKey)) continue;
      const id = `frontier-${x < 0 ? "w" : "e"}${Math.abs(x)}-${z < 0 ? "s" : "n"}${Math.abs(z)}`;
      byCoordinate.set(coordinateKey, id);
      nodes.push({ id, x, z });
    }
  }
  const factions = ["neutral", "redfen-clan", "obsidian-court", "neutral"];
  return nodes.map(({ id, x, z }, index) => {
    const neighbor = (dx, dz) => byCoordinate.get(`${x + dx},${z + dz}`);
    const neighbors = Object.fromEntries([
      ["east", neighbor(1, 0)],
      ["west", neighbor(-1, 0)],
      ["north", neighbor(0, 1)],
      ["south", neighbor(0, -1)]
    ].filter(([, value]) => value));
    const faction = factions[index % factions.length];
    const kind = index % 9 === 0 ? "stronghold" : index % 5 === 0 ? "dungeon" : index % 3 === 0 ? "wilds" : "frontier";
    const resource = ["gold", "food", "iron", "arcane"][index % 4];
    return Object.freeze({
      id,
      title: `Frontier Reach ${String(index + 13).padStart(3, "0")}`,
      kind,
      coordinates: Object.freeze({ x, z }),
      ownerFaction: faction,
      neighbors: Object.freeze(neighbors),
      fronts: Object.freeze([
        Object.freeze({ direction: "west", faction: "player", pressure: Number((0.08 + (index % 7) * 0.07).toFixed(2)) }),
        Object.freeze({ direction: "east", faction: faction === "neutral" ? "obsidian-court" : faction, pressure: Number((0.24 + (index % 5) * 0.1).toFixed(2)) })
      ]),
      economy: Object.freeze({ gold: 1 + index % 5, food: resource === "food" ? 6 : 1, iron: resource === "iron" ? 5 : 1, arcane: resource === "arcane" ? 4 : 0 }),
      landmarks: Object.freeze([
        Object.freeze({ id: `${id}-settlement`, kind: "settlement", resource }),
        Object.freeze({ id: `${id}-resource`, kind: "resource", resource }),
        Object.freeze({ id: `${id}-${kind}`, kind })
      ])
    });
  });
}

const CARDINAL_OFFSETS = Object.freeze([
  Object.freeze(["east", 1, 0]),
  Object.freeze(["west", -1, 0]),
  Object.freeze(["north", 0, 1]),
  Object.freeze(["south", 0, -1])
]);

function connectTerritories(territories) {
  const byCoordinate = new Map(
    territories.map((territory) => [
      `${territory.coordinates.x},${territory.coordinates.z}`,
      territory.id
    ])
  );
  return territories.map((territory) => {
    const neighbors = { ...(territory.neighbors ?? {}) };
    for (const [direction, dx, dz] of CARDINAL_OFFSETS) {
      const neighborId = byCoordinate.get(
        `${territory.coordinates.x + dx},${territory.coordinates.z + dz}`
      );
      if (neighborId) neighbors[direction] = neighborId;
    }
    return Object.freeze({
      ...territory,
      neighbors: Object.freeze(neighbors)
    });
  });
}

export const TERRITORIES = Object.freeze(
  connectTerritories([
    ...AUTHORED_TERRITORIES,
    ...generatedTerritories()
  ])
);

export const WORLD_SCENES = Object.freeze([
  Object.freeze({
    id: "sanctum",
    title: "Dawnwatch Sanctum",
    kind: "web-three-scene",
    exits: Object.freeze([
      Object.freeze({ id: "to-overworld", to: "overworld", label: "Open frontier map" })
    ]),
    metadata: Object.freeze({
      role: "home-base", territoryId: "dawnwatch-sanctum", version: 1,
      contentHash: "scene-sanctum-v1", seed: "battle-clash:sanctum",
      hostBinding: "sanctum", camera: { mode: "orthographic", target: "sanctum-core", framing: "wide" },
      lighting: { profile: "dawnwatch-blue", fog: "soft-void", colorGrade: "warm-cyan" },
      audio: { ambient: "sanctum-wind", mix: "quiet" }, effects: { profile: "sanctum-embers" },
      assets: ["objaverse-fc1339e225b7408caec82681be2746c5"], objective: "prepare-the-banner"
    })
  }),
  Object.freeze({
    id: "overworld",
    title: "The Frontier",
    kind: "web-three-scene",
    exits: Object.freeze([
      Object.freeze({ id: "to-sanctum", to: "sanctum", label: "Return to sanctum" }),
      Object.freeze({ id: "to-territory", to: "territory", label: "Enter territory" })
    ]),
    metadata: Object.freeze({
      role: "world-map", version: 1, contentHash: "scene-overworld-v1", seed: "battle-clash:overworld",
      hostBinding: "overworld", camera: { mode: "orthographic", target: "frontier-graph", framing: "map" },
      lighting: { profile: "frontier-dusk", fog: "distant-veil", colorGrade: "steel-blue" },
      audio: { ambient: "frontier-wind", mix: "exploration" }, effects: { profile: "route-glow" },
      assets: [], objective: "choose-a-front"
    })
  }),
  Object.freeze({
    id: "territory",
    title: "Contested Territory",
    kind: "web-three-scene",
    exits: Object.freeze([
      Object.freeze({ id: "to-overworld", to: "overworld", label: "Return to frontier" }),
      Object.freeze({ id: "to-encounter", to: "encounter", label: "Enter front" })
    ]),
    metadata: Object.freeze({
      role: "territory-front", version: 1, contentHash: "scene-territory-v1", seed: "battle-clash:territory",
      hostBinding: "territory", camera: { mode: "orthographic", target: "hero", framing: "grid" },
      lighting: { profile: "contested-front", fog: "grid-haze", colorGrade: "faction-aware" },
      audio: { ambient: "front-pressure", mix: "tension" }, effects: { profile: "hazard-pulse" },
      assets: [], objective: "reach-the-front"
    })
  }),
  Object.freeze({
    id: "encounter",
    title: "Obsidian Vault Front",
    kind: "web-three-scene",
    exits: Object.freeze([
      Object.freeze({ id: "to-territory", to: "territory", label: "Return to territory" })
    ]),
    metadata: Object.freeze({
      role: "attack-defend-encounter", territoryId: "obsidian-vault", version: 1,
      contentHash: "scene-encounter-v1", seed: "battle-clash:encounter",
      hostBinding: "encounter", camera: { mode: "orthographic", target: "dungeon-heart", framing: "combat" },
      lighting: { profile: "dungeon-ember", fog: "combat-smoke", colorGrade: "violet-amber" },
      audio: { ambient: "dungeon-heart", mix: "combat" }, effects: { profile: "combat-feedback" },
      assets: ["objaverse-fc1339e225b7408caec82681be2746c5"], objective: "shatter-the-heart"
    })
  }),
  Object.freeze({
    id: "victory",
    title: "Front Secured",
    kind: "web-three-scene",
    exits: Object.freeze([Object.freeze({ id: "to-sanctum", to: "sanctum", label: "Return to Sanctum" })]),
    metadata: Object.freeze({
      role: "victory-reward", version: 1, contentHash: "scene-victory-v1", seed: "battle-clash:victory",
      hostBinding: "victory", camera: { mode: "orthographic", target: "reward-cache", framing: "reveal" },
      lighting: { profile: "victory-dawn", fog: "clear", colorGrade: "gold" },
      audio: { ambient: "victory-rise", mix: "reward" }, effects: { profile: "victory-collapse" },
      assets: [], objective: "secure-the-reward", transient: true
    })
  }),
  Object.freeze({
    id: "defeat",
    title: "Front Lost",
    kind: "web-three-scene",
    exits: Object.freeze([Object.freeze({ id: "to-sanctum", to: "sanctum", label: "Fall Back to Sanctum" })]),
    metadata: Object.freeze({
      role: "defeat-recovery", version: 1, contentHash: "scene-defeat-v1", seed: "battle-clash:defeat",
      hostBinding: "defeat", camera: { mode: "orthographic", target: "dungeon-heart", framing: "recovery" },
      lighting: { profile: "defeat-ember", fog: "heavy", colorGrade: "red-violet" },
      audio: { ambient: "defeat-fall", mix: "recovery" }, effects: { profile: "defeat-collapse" },
      assets: [], objective: "return-to-sanctum", transient: true
    })
  }),
  Object.freeze({
    id: "room",
    title: "Dungeon Room",
    kind: "web-three-scene",
    exits: Object.freeze([Object.freeze({ id: "to-encounter", to: "encounter", label: "Enter room" })]),
    metadata: Object.freeze({
      role: "room-chain", version: 1, contentHash: "scene-room-v1", seed: "battle-clash:room",
      hostBinding: "encounter-room", camera: { mode: "orthographic", target: "room-objective", framing: "combat" },
      lighting: { profile: "room-ember", fog: "room-smoke", colorGrade: "violet-amber" },
      audio: { ambient: "room-threat", mix: "combat" }, effects: { profile: "room-hazard" },
      assets: [], objective: "complete-room", transient: true
    })
  }),
  ...TERRITORIES
    .filter((territory) => territory.kind !== "sanctum")
    .map((territory) => Object.freeze({
      id: territorySceneId(territory.id),
      title: territory.title,
      kind: "web-three-scene",
      exits: Object.freeze([
        Object.freeze({ id: "to-overworld", to: "overworld", label: "Return to frontier" }),
        Object.freeze({ id: "to-encounter", to: "encounter", label: "Enter directional front" })
      ]),
      metadata: Object.freeze({
        role: "territory-front",
        territoryId: territory.id,
        territoryKind: territory.kind,
        grid: { ...TERRITORY_GRID }, version: 1,
        contentHash: `scene-${territory.id}-v1`, seed: `battle-clash:${territory.id}`,
        hostBinding: "territory", camera: { mode: "orthographic", target: "hero", framing: "grid" },
        lighting: { profile: `${territory.kind}-front`, fog: "grid-haze", colorGrade: "faction-aware" },
        audio: { ambient: `${territory.kind}-ambient`, mix: "exploration" }, effects: { profile: "hazard-pulse" },
        assets: [], objective: "reach-the-front"
      })
    }))
]);

export function territoryById(id) {
  return TERRITORIES.find((territory) => territory.id === id) ?? null;
}

export function sceneForTerritory(territoryId) {
  const territory = territoryById(territoryId);
  return territory?.kind === "sanctum" ? "sanctum" : territorySceneId(territoryId);
}

export function territorySceneId(territoryId) {
  return `territory:${String(territoryId)}`;
}

export function isTerritorySceneId(sceneId) {
  return String(sceneId ?? "").startsWith("territory:");
}
