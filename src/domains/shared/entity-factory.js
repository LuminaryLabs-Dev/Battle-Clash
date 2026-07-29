import {
  ARCHETYPES,
  BATTLEFIELD,
  INITIAL_DUNGEON,
  PROGRESSION,
  WORLD_ID,
  WORLD_SEED
} from "../../data/battlefield.js";
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
    size: [sizeX, sizeY, sizeZ]
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
    lastReward: Math.max(0, Math.floor(Number(profile.lastReward) || 0)),
    lastCompletionFrame: Number.isFinite(Number(profile.lastCompletionFrame))
      ? Number(profile.lastCompletionFrame)
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

  clearBattleEntities(world);

  world.setResource(Resources.ProgressionState, progression);
  world.setResource(Resources.SessionState, session);
  world.setResource(Resources.RaidState, {
    phase: "deploy",
    timeRemaining: BATTLEFIELD.raidDuration,
    result: null,
    destroyed: 0,
    startedAtFrame: null,
    completedAtFrame: null
  });
  world.setResource(Resources.DeploymentState, {
    remaining: BATTLEFIELD.troopBudget,
    serial: 0,
    selectedArchetype: "delver",
    accepted: 0,
    rejected: 0
  });
  world.setResource(Resources.CommandQueue, {
    deploy: [],
    start: false,
    reset: false,
    fortify: false
  });
  world.setResource(Resources.EffectsState, {
    serial: 0,
    items: []
  });
  world.setResource(Resources.BattleMetadata, {
    worldId: WORLD_ID,
    seed: WORLD_SEED,
    version: 2,
    scenario: "obsidian-vault"
  });
  world.setResource(Resources.DefenseState, {
    wardCharges: 1,
    wardsUsed: 0,
    lastFortifiedFrame: null
  });

  for (const recipe of INITIAL_DUNGEON) {
    spawnFromArchetype(world, recipe);
  }
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
