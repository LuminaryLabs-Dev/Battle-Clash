import {
  ARCHETYPES,
  BATTLEFIELD,
  INITIAL_DUNGEON,
  PROGRESSION,
  WORLD_ID,
  WORLD_SEED
} from "../../data/battlefield.js";
import { territoryById } from "../../data/world.js";
import { createDefaultWorldState, heroUnlocksForLevel } from "../world/world-state.js";
import { createObjectiveState } from "../encounter/encounter-objectives.js";
import { createRoomState } from "../encounter/room-state.js";
import { Components, Resources } from "./definitions.js";

function set(world, entity, component, value) {
  world.setComponent(entity, component, structuredClone(value));
}

export function spawnFromArchetype(world, {
  id,
  archetype: archetypeId,
  position,
  serial = null
}) {
  const archetype = ARCHETYPES[archetypeId];
  if (!archetype) throw new Error(`Unknown Battle Clash archetype: ${archetypeId}`);

  const entity = world.addEntity();
  const [sizeX, sizeY, sizeZ] = archetype.size;
  const level = Number(
    world.getResource(Resources.ProgressionState)?.level ?? 1
  );
  const troopPower =
    archetype.category === "troop"
      ? 1 + Math.max(0, level - 1) * PROGRESSION.powerPerLevel
      : 1;

  set(world, entity, Components.Identity, {
    id,
    archetypeId,
    category: archetype.category,
    role: archetype.role,
    serial
  });
  set(world, entity, Components.Position, {
    x: Number(position[0]),
    y: sizeY / 2,
    z: Number(position[1])
  });
  set(world, entity, Components.Faction, { id: archetype.faction });
  set(world, entity, Components.Renderable, {
    shape: "box",
    color: archetype.color,
    emissive: archetype.emissive,
    size: [sizeX, sizeY, sizeZ],
    ...(archetype.assetId ? { assetId: archetype.assetId } : {})
  });
  set(world, entity, Components.Footprint, {
    radius: Math.max(sizeX, sizeZ) / 2,
    size: [sizeX, sizeZ]
  });

  if (archetype.health) {
    const maximum = Math.round(archetype.health * troopPower);
    set(world, entity, Components.Health, {
      current: maximum,
      maximum
    });
    set(world, entity, Components.Targeting, {
      entity: null,
      targetId: null,
      targetBias: Number(archetype.targetBias ?? 0)
    });
  }

  if (archetype.attack) {
    set(world, entity, Components.Attack, {
      ...archetype.attack,
      damage: Math.round(archetype.attack.damage * troopPower),
      remaining: 0
    });
  }

  if (archetype.category === "troop") {
    set(world, entity, Components.Troop, {
      role: archetype.role,
      deployed: true
    });
    set(world, entity, Components.Movement, {
      speed: archetype.speed,
      state: "seeking"
    });
    if (archetype.role === "hero") {
      set(world, entity, Components.Hero, {
        id,
        name: "Ember",
        level,
        territoryId: world.getResource(Resources.WorldState)?.currentTerritoryId ?? null,
        routeLength: 0
      });
      set(world, entity, Components.HeroCombat, {
        abilityId: archetype.ability?.id ?? "arc-burst",
        abilityDamage: Number(archetype.ability?.damage ?? 0),
        abilityCooldown: Number(archetype.ability?.cooldown ?? 0)
      });
    }
  }

  if (archetype.category === "building") {
    set(world, entity, Components.Building, {
      role: archetype.role,
      targetBias: Number(archetype.targetBias ?? 0)
    });
  }

  if (archetype.role === "defense") {
    set(world, entity, Components.Defense, {
      role: "tower"
    });
  }

  return entity;
}

export function clearBattleEntities(world) {
  for (const entity of world.query(Components.Identity)) {
    world.removeEntity(entity);
  }
}

const LANDMARK_PALETTE = Object.freeze({
  settlement: { color: "#38bdf8", emissive: "#0c4a6e", size: [1.5, 1.8, 1.5], role: "settlement" },
  resource: { color: "#f59e0b", emissive: "#78350f", size: [1.25, 1.6, 1.25], role: "resource" },
  stronghold: { color: "#ef4444", emissive: "#7f1d1d", size: [1.8, 2.4, 1.8], role: "stronghold" },
  dungeon: { color: "#a855f7", emissive: "#4c1d95", size: [1.7, 2.2, 1.7], role: "dungeon" },
  wilds: { color: "#22c55e", emissive: "#14532d", size: [1.4, 1.9, 1.4], role: "wilds" },
  frontier: { color: "#64748b", emissive: "#1e293b", size: [1.35, 1.7, 1.35], role: "frontier" }
});

function landmarkPosition(landmark, index) {
  const hash = [...String(landmark.id)].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619), 2166136261);
  return {
    x: 24 + ((hash >>> 3) + index * 19) % 52,
    z: 24 + ((hash >>> 11) + index * 29) % 52
  };
}

/** Seed renderer-neutral landmark entities for the current 100x100 territory.
 * They have no combat health, so the encounter systems cannot target them.
 */
export function seedTerritoryLandmarks(world, territoryId) {
  for (const entity of world.query(Components.Identity)) {
    if (world.getComponent(entity, Components.Identity)?.category === "landmark") world.removeEntity(entity);
  }
  const territory = territoryById(territoryId);
  if (!territory) return [];
  const descriptors = [...(territory.landmarks ?? [])];
  const economy = territory.economy ?? {};
  const resource = Object.entries(economy).sort((left, right) => Number(right[1]) - Number(left[1]))[0]?.[0] ?? "gold";
  if (!descriptors.some((landmark) => landmark.kind === "settlement")) {
    descriptors.push({ id: `${territory.id}-settlement`, kind: "settlement", resource });
  }
  if (!descriptors.some((landmark) => landmark.kind === "resource")) {
    descriptors.push({ id: `${territory.id}-resource`, kind: "resource", resource });
  }
  if (!descriptors.some((landmark) => landmark.kind === territory.kind)) {
    descriptors.push({ id: `${territory.id}-${territory.kind}`, kind: territory.kind });
  }
  return descriptors.map((landmark, index) => {
    const palette = LANDMARK_PALETTE[landmark.kind] ?? LANDMARK_PALETTE.frontier;
    const position = landmarkPosition(landmark, index);
    const entity = world.addEntity();
    set(world, entity, Components.Identity, {
      id: landmark.id,
      archetypeId: `landmark-${landmark.kind}`,
      category: "landmark",
      role: palette.role,
      serial: null
    });
    set(world, entity, Components.Position, { x: position.x, y: palette.size[1] / 2, z: position.z });
    set(world, entity, Components.Faction, { id: territory.ownerFaction ?? "neutral" });
    set(world, entity, Components.Renderable, {
      shape: "box",
      color: palette.color,
      emissive: palette.emissive,
      size: palette.size
    });
    set(world, entity, Components.Footprint, { radius: Math.max(palette.size[0], palette.size[2]) / 2, size: [palette.size[0], palette.size[2]] });
    set(world, entity, Components.TerritoryMarker, {
      territoryId,
      kind: landmark.kind,
      gridPosition: position,
      resource: landmark.resource ?? null
    });
    if (landmark.kind === "resource") {
      set(world, entity, Components.ResourceNode, { resource: landmark.resource ?? "gold" });
    }
    return entity;
  });
}

const FRONT_PALETTE = Object.freeze({
  player: { color: "#38bdf8", emissive: "#0c4a6e" },
  "obsidian-court": { color: "#f43f5e", emissive: "#881337" },
  "redfen-clan": { color: "#fb923c", emissive: "#9a3412" },
  neutral: { color: "#94a3b8", emissive: "#334155" }
});

const FRONT_POSITIONS = Object.freeze({
  west: { x: 8, z: 50 },
  east: { x: 92, z: 50 },
  north: { x: 50, z: 8 },
  south: { x: 50, z: 92 }
});

/** Seed non-combat boundary entities for the territory's directional fronts. */
export function seedTerritoryFronts(world, territoryId, territoryState = null) {
  for (const entity of world.query(Components.FrontMarker)) world.removeEntity(entity);
  const territory = territoryState ?? territoryById(territoryId);
  if (!territory) return [];
  return (territory.fronts ?? []).map((front) => {
    const position = FRONT_POSITIONS[front.direction] ?? FRONT_POSITIONS.west;
    const palette = FRONT_PALETTE[front.faction] ?? FRONT_PALETTE.neutral;
    const entity = world.addEntity();
    set(world, entity, Components.Identity, {
      id: `${territoryId}-front-${front.direction}`,
      archetypeId: "front-marker",
      category: "front",
      role: "front",
      serial: null
    });
    set(world, entity, Components.Position, { x: position.x, y: 0.24, z: position.z });
    set(world, entity, Components.Faction, { id: front.faction ?? "neutral" });
    set(world, entity, Components.Renderable, {
      shape: "box",
      color: palette.color,
      emissive: palette.emissive,
      size: [1.35, 0.48, 1.35]
    });
    set(world, entity, Components.Footprint, { radius: 0.68, size: [1.35, 1.35] });
    set(world, entity, Components.TerritoryMarker, {
      territoryId,
      kind: "front",
      direction: front.direction,
      faction: front.faction ?? "neutral",
      pressure: Number(front.pressure ?? 0),
      gridPosition: position
    });
    set(world, entity, Components.FrontMarker, {
      direction: front.direction,
      faction: front.faction ?? "neutral",
      pressure: Number(front.pressure ?? 0)
    });
    return entity;
  });
}

/** Keep directional front projections aligned with the authoritative territory state. */
export function syncTerritoryFronts(world, territoryState) {
  if (!territoryState) return;
  const fronts = new Map((territoryState.fronts ?? []).map((front) => [front.direction, front]));
  for (const entity of world.query(Components.FrontMarker)) {
    const marker = world.getComponent(entity, Components.TerritoryMarker);
    const frontMarker = world.getComponent(entity, Components.FrontMarker);
    const front = fronts.get(marker?.direction ?? frontMarker?.direction);
    if (!front) continue;
    const faction = front.faction ?? "neutral";
    const pressure = Number(front.pressure ?? 0);
    set(world, entity, Components.Faction, { id: faction });
    set(world, entity, Components.FrontMarker, {
      direction: front.direction,
      faction,
      pressure
    });
    set(world, entity, Components.TerritoryMarker, {
      ...marker,
      faction,
      pressure
    });
    const palette = FRONT_PALETTE[faction] ?? FRONT_PALETTE.neutral;
    const renderable = world.getComponent(entity, Components.Renderable);
    if (renderable) {
      set(world, entity, Components.Renderable, {
        ...renderable,
        color: palette.color,
        emissive: palette.emissive
      });
    }
  }
}

export function clearHeroEntity(world) {
  for (const entity of world.query(Components.Hero)) world.removeEntity(entity);
}

/** Seed the persistent hero as a non-combat ECS projection for a territory scene. */
export function seedHeroEntity(world, heroState, territoryId) {
  clearHeroEntity(world);
  if (!heroState || !territoryId) return null;
  const entity = world.addEntity();
  set(world, entity, Components.Identity, {
    id: heroState.id ?? "hero-ember",
    archetypeId: "hero",
    category: "hero",
    role: "hero",
    serial: null
  });
  set(world, entity, Components.Position, {
    x: Number(heroState.position?.x ?? 50),
    y: 0.72,
    z: Number(heroState.position?.z ?? 50)
  });
  set(world, entity, Components.Faction, { id: "player" });
  set(world, entity, Components.Renderable, {
    shape: "box",
    color: "#fbbf24",
    emissive: "#b45309",
    size: [1.05, 1.45, 1.05]
  });
  set(world, entity, Components.Footprint, { radius: 0.52, size: [1.05, 1.05] });
  set(world, entity, Components.Hero, {
    id: heroState.id ?? "hero-ember",
    name: heroState.name ?? "Ember",
    level: Number(heroState.level ?? 1),
    territoryId,
    routeLength: Number(heroState.route?.pathLength ?? 0)
  });
  return entity;
}

export function syncHeroEntity(world, heroState) {
  for (const entity of world.query(Components.Hero)) {
    const position = world.getComponent(entity, Components.Position);
    const hero = world.getComponent(entity, Components.Hero);
    position.x = Number(heroState?.position?.x ?? position.x);
    position.z = Number(heroState?.position?.z ?? position.z);
    hero.level = Number(heroState?.level ?? hero.level);
    hero.territoryId = heroState?.territoryId ?? hero.territoryId;
    hero.routeLength = Number(heroState?.route?.pathLength ?? hero.routeLength ?? 0);
    world.setComponent(entity, Components.Position, position);
    world.setComponent(entity, Components.Hero, hero);
  }
}

export function createDefaultProgression(profile = {}) {
  const level = Math.max(1, Math.floor(Number(profile.level) || 1));
  const xpToNext = Math.max(
    1,
    Math.floor(
      Number(profile.xpToNext) ||
        PROGRESSION.baseXpToLevel *
          PROGRESSION.levelGrowth ** Math.max(0, level - 1)
    )
  );
  return {
    schema: "battle-clash.progression/1",
    level,
    xp: Math.max(0, Math.floor(Number(profile.xp) || 0)),
    xpToNext,
    runs: Math.max(0, Math.floor(Number(profile.runs) || 0)),
    wins: Math.max(0, Math.floor(Number(profile.wins) || 0)),
    perkPoints: Math.max(0, Math.floor(Number(profile.perkPoints) || 0)),
    unlocks: Array.from(new Set([
      ...heroUnlocksForLevel(level),
      ...(Array.isArray(profile.unlocks) ? profile.unlocks.map(String) : [])
    ])),
    lastReward: Math.max(0, Math.floor(Number(profile.lastReward) || 0)),
    lastCompletionFrame: Number.isFinite(Number(profile.lastCompletionFrame))
      ? Number(profile.lastCompletionFrame)
      : null,
    explorationReceipts: Array.isArray(profile.explorationReceipts)
      ? [...new Set(profile.explorationReceipts.map(String))]
      : [],
    lastExplorationReward: profile.lastExplorationReward
      ? structuredClone(profile.lastExplorationReward)
      : null
  };
}

export function createDefaultSession() {
  return {
    schema: "battle-clash.session/1",
    status: "offline",
    mode: "solo",
    role: "solo",
    roomId: null,
    peerId: null,
    connectedPeerId: null,
    authority: "local",
    transport: "peerjs",
    message: "Solo dungeon run ready"
  };
}

export function seedBattleState(world, options = {}) {
  const progression = world.hasResource(Resources.ProgressionState)
    ? createDefaultProgression(world.getResource(Resources.ProgressionState))
    : createDefaultProgression(options.progression);
  const session = world.hasResource(Resources.SessionState)
    ? structuredClone(world.getResource(Resources.SessionState))
    : createDefaultSession();
  const baseWorldState = world.hasResource(Resources.WorldState)
    ? structuredClone(world.getResource(Resources.WorldState))
    : createDefaultWorldState(options.world);
  const worldState = {
    ...baseWorldState,
    hero: {
      ...baseWorldState.hero,
      level: Math.max(Number(baseWorldState.hero?.level ?? 1), Number(progression.level ?? 1)),
      unlocks: Array.from(new Set([
        ...(baseWorldState.hero?.unlocks ?? []),
        ...heroUnlocksForLevel(Math.max(Number(baseWorldState.hero?.level ?? 1), Number(progression.level ?? 1))),
        ...(progression.unlocks ?? [])
      ]))
    }
  };
  const encounterTerritoryId = options.encounterTerritoryId ??
    (worldState.currentSceneId === "encounter" ? worldState.currentTerritoryId : null);
  const encounterTerritory = encounterTerritoryId
    ? worldState.territories?.[encounterTerritoryId]
    : null;

  clearBattleEntities(world);

  world.setResource(Resources.ProgressionState, progression);
  world.setResource(Resources.SessionState, session);
  world.setResource(Resources.AccountState, options.account ?? {
    schema: "battle-clash.account/1",
    status: "signed-out",
    userId: null,
    email: null,
    syncStatus: "offline",
    pendingReceipts: 0
  });
  world.setResource(Resources.WorldState, worldState);
  world.setResource(Resources.SceneState, {
    current: worldState.currentSceneId,
    previous: null,
    transition: null,
    revision: worldState.revision
  });
  world.setResource(Resources.HeroState, structuredClone(worldState.hero));
  world.setResource(Resources.ArmyState, structuredClone(worldState.army));
  world.setResource(Resources.SanctumState, structuredClone(worldState.sanctum));
  world.setResource(Resources.EconomyState, structuredClone(worldState.economy));
  world.setResource(Resources.TerritoryState, structuredClone(worldState.territories[worldState.currentTerritoryId]));
  world.setResource(Resources.LandscapeState, {
    ...structuredClone(worldState.landscape),
    territoryId: worldState.currentTerritoryId
  });
  const existingRoom = world.getResource(Resources.RoomState);
  const roomState = encounterTerritoryId
    ? createRoomState(
      encounterTerritoryId,
      options.roomId ?? (existingRoom?.territoryId === encounterTerritoryId && !existingRoom.completedRoomIds?.includes(existingRoom.roomId) ? existingRoom.roomId : null),
      options.completedRoomIds ?? encounterTerritory?.roomProgress ?? (existingRoom?.territoryId === encounterTerritoryId ? existingRoom.completedRoomIds : [])
    )
    : createRoomState(worldState.currentTerritoryId);
  const recipes = encounterTerritoryId
    ? encounterRecipes(
      encounterTerritoryId,
      encounterTerritory,
      worldState.factionStrategy,
      options.encounterFrontDirection,
      roomState
    )
    : INITIAL_DUNGEON;
  const encounterFront = encounterTerritory
    ? hostileFront(encounterTerritory, options.encounterFrontDirection)
    : null;
  world.setResource(Resources.RaidState, {
    phase: "deploy",
    timeRemaining: BATTLEFIELD.raidDuration,
    result: null,
    destroyed: 0,
    destroyedEntityIds: [],
    startedAtFrame: null,
    completedAtFrame: null
  });
  world.setResource(Resources.DeploymentState, {
    remaining: BATTLEFIELD.troopBudget + (progression.unlocks?.includes("siege-command") ? 2 : 0),
    serial: 0,
    selectedArchetype: "delver",
    accepted: 0,
    rejected: 0
  });
  world.setResource(Resources.CommandQueue, {
    deploy: [],
    start: false,
    reset: false,
    fortify: false,
    heroAbility: null
  });
  world.setResource(Resources.EffectsState, {
    serial: 0,
    items: []
  });
  world.setResource(Resources.AbilityState, {
    schema: "battle-clash.ability/1",
    selected: "arc-burst",
    cooldownRemaining: 0,
    uses: 0,
    lastUseFrame: null
  });
  world.setResource(Resources.BattleMetadata, {
    worldId: WORLD_ID,
    seed: WORLD_SEED,
    version: 4,
    scenario: encounterTerritoryId ? `${encounterTerritoryId}-front` : "obsidian-vault",
    territoryId: encounterTerritoryId,
    layoutId: encounterTerritory ? `${encounterTerritory.kind ?? "frontier"}-layout-v1` : "default-layout-v1",
    enemyCount: encounterTerritoryId ? encounterEnemyCount(encounterTerritoryId, encounterTerritory) : 2,
    hostileFaction: encounterFront?.faction ?? "enemy",
    frontDirection: encounterFront?.direction ?? null,
    frontPressure: Number((encounterFront?.pressure ?? 0).toFixed(3)),
    strategyIntent: encounterTerritory
      ? worldState.factionStrategy?.[encounterFront?.faction]?.intent ?? "pressure"
      : "pressure",
    roomId: roomState.roomId,
    roomKind: roomState.kind,
    roomObjective: roomState.objective,
    roomIndex: roomState.index,
    roomCount: roomState.total
  });
  world.setResource(Resources.RoomState, roomState);
  world.setResource(
    Resources.ObjectiveState,
    createObjectiveState(encounterTerritoryId ?? "obsidian-vault", recipes, roomState)
  );
  world.setResource(Resources.LootState, {
    schema: "battle-clash.loot/1",
    drops: [],
    totals: { gold: 0, food: 0, iron: 0, arcane: 0 }
  });
  world.setResource(Resources.DefenseState, {
    wardCharges: 1,
    wardsUsed: 0,
    lastFortifiedFrame: null
  });

  for (const recipe of recipes) {
    spawnFromArchetype(world, recipe);
  }
  if (encounterTerritoryId) {
    spawnFromArchetype(world, {
      id: "hero-ember-combat",
      archetype: "hero",
      position: [0, -8]
    });
  }
}

function hostileFront(territory, preferredDirection = null) {
  const hostile = (territory?.fronts ?? [])
    .filter((front) => String(front.faction ?? "neutral") !== "player")
    .sort((left, right) => Number(right.pressure ?? 0) - Number(left.pressure ?? 0));
  return hostile.find((front) => front.direction === preferredDirection) ?? hostile[0] ?? null;
}

function encounterEnemyCount(territoryId, territoryState = null) {
  return Math.max(8, Number(territoryState?.encounterEnemyCount) || 8 + (territoryById(territoryId)?.fronts.length ?? 0));
}

function encounterRecipes(territoryId, territoryState = null, strategy = {}, preferredDirection = null, roomState = null) {
  const roomKind = roomState?.kind ?? null;
  const count = encounterEnemyCount(territoryId, territoryState) + (roomKind === "ambush" || roomKind === "elite" ? 1 : 0);
  const territory = territoryById(territoryId);
  const layoutKind = territory?.kind ?? "frontier";
  const front = hostileFront(territoryState ?? territory, preferredDirection);
  const pressure = Number(front?.pressure ?? 0);
  const intent = strategy?.[front?.faction]?.intent ?? "pressure";
  const room = INITIAL_DUNGEON.map((recipe, index) => ({
    ...recipe,
    position: encounterPosition(recipe.position, layoutKind, index)
  }));
  const extra = Array.from({ length: Math.max(0, count - 2) }, (_, index) => {
    const radius = layoutKind === "stronghold" ? 5.4 : layoutKind === "dungeon" ? 4.9 : 4.6;
    const angle = (index / Math.max(1, count - 2)) * Math.PI * 2
      + (layoutKind === "wilds" ? 0.28 : layoutKind === "dungeon" ? 0.12 : 0);
    const archetype = roomKind === "boss" && territory?.kind === "stronghold"
      ? "boss"
      : roomKind === "elite" && index === 0
        ? "elite"
        : roomKind === "trap" && index % 3 === 0
          ? "bastion"
          : territory?.kind === "stronghold"
      ? index % 7 === 0 ? "elite" : index % 3 === 0 ? "bastion" : "sentinel"
      : territory?.kind === "wilds"
        ? index % 2 === 0 ? "scout" : "sentinel"
        : territory?.kind === "dungeon" && index % 5 === 0
          ? "elite"
        : territory?.kind === "frontier" && index % 4 === 0
          ? "scout"
          : intent === "raid" && index % 3 === 0
            ? "scout"
            : pressure >= 0.75 && index % 4 === 0
              ? "bastion"
              : "sentinel";
    return {
      id: `${territoryId}-defense-${index + 1}`,
      archetype,
      position: [Number((Math.cos(angle) * radius).toFixed(2)), Number((Math.sin(angle) * radius).toFixed(2))]
    };
  });
  const boss = territoryId === "blackglass-rise"
    ? [{ id: "blackglass-warden", archetype: "boss", position: encounterPosition([0, -4.4], layoutKind, 99) }]
    : [];
  return [...room, ...extra, ...boss];
}

function encounterPosition([x, z], kind, index) {
  if (kind === "wilds") {
    return [Number((z + 0.45).toFixed(2)), Number((-x + (index % 2 ? 0.3 : -0.3)).toFixed(2))];
  }
  if (kind === "dungeon") {
    const angle = Math.PI / 8;
    return [
      Number((x * Math.cos(angle) - z * Math.sin(angle)).toFixed(2)),
      Number((x * Math.sin(angle) + z * Math.cos(angle)).toFixed(2))
    ];
  }
  if (kind === "stronghold") {
    return [Number((x * 1.06).toFixed(2)), Number((z * 1.06).toFixed(2))];
  }
  return [x, z];
}

export function identityOf(world, entity) {
  return world.hasComponent(entity, Components.Identity)
    ? world.getComponent(entity, Components.Identity)
    : null;
}

export function positionOf(world, entity) {
  return world.hasComponent(entity, Components.Position)
    ? world.getComponent(entity, Components.Position)
    : null;
}

export function isAlive(world, entity) {
  if (!world.hasComponent(entity, Components.Health)) return false;
  return Number(world.getComponent(entity, Components.Health).current) > 0;
}
