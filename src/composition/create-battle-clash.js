import { createEngine } from "nexusengine/engine";
import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { createCoreCameraKit } from "nexusengine/core-kits/core-camera-kit";
import { createCoreDataKit } from "nexusengine/core-kits/core-data-kit";
import { createCoreGraphicsKit } from "nexusengine/core-kits/core-graphics-kit";
import { createCoreInputKit } from "nexusengine/core-kits/core-input-kit";
import { createCoreNetworkKit } from "nexusengine/core-kits/core-network-kit";
import { createCorePersistenceKit } from "nexusengine/core-kits/core-persistence-kit";
import { createCoreSimulationKit } from "nexusengine/core-kits/core-simulation-kit";
import { createCoreSpatialKit } from "nexusengine/core-kits/core-spatial-kit";
import { createCoreUIKit } from "nexusengine/core-kits/core-ui-kit";
import { createCoreWorldDomain } from "nexusengine/core-domains/core-world-domain";
import { createCombatKit } from "../domains/combat/combat-kit.js";
import { createDefenseKit } from "../domains/defense/defense-kit.js";
import { createDeploymentKit } from "../domains/deployment/deployment-kit.js";
import { createNavigationKit } from "../domains/navigation/navigation-kit.js";
import { createProgressionKit } from "../domains/progression/progression-kit.js";
import { createRaidLifecycleKit } from "../domains/raid/raid-kit.js";
import { createSessionKit } from "../domains/session/session-kit.js";
import { Components, Events, Resources } from "../domains/shared/definitions.js";
import { createTargetingKit } from "../domains/targeting/targeting-kit.js";
import { createBattleWorldKit } from "../domains/world/world-kit.js";
import { WORLD_SEED } from "../data/battlefield.js";

export const FIXED_DELTA = 1 / 30;

function createBattleClashRootKit() {
  return defineDomainServiceKit({
    id: "battle-clash-composition-kit",
    domain: "battle-clash",
    domainPath: "n:game:battle-clash",
    apiName: "battleClash",
    stability: "experimental",
    version: "0.1.0",
    services: ["composition", "commands", "snapshot"],
    components: Components,
    resources: Resources,
    events: Events,
    metadata: {
      owns: ["game domain graph", "shared ECS vocabulary", "game command boundary"],
      doesNotOwn: ["Core domain state", "Three.js objects", "browser events"]
    }
  });
}

function entitySnapshot(world, entity) {
  const identity = world.getComponent(entity, Components.Identity);
  const position = world.getComponent(entity, Components.Position);
  const renderable = world.getComponent(entity, Components.Renderable);
  const health = world.hasComponent(entity, Components.Health)
    ? world.getComponent(entity, Components.Health)
    : null;
  const faction = world.getComponent(entity, Components.Faction);
  const movement = world.hasComponent(entity, Components.Movement)
    ? world.getComponent(entity, Components.Movement)
    : null;
  const targeting = world.hasComponent(entity, Components.Targeting)
    ? world.getComponent(entity, Components.Targeting)
    : null;

  return {
    id: identity.id,
    archetypeId: identity.archetypeId,
    category: identity.category,
    role: identity.role,
    faction: faction.id,
    position: {
      x: Number(position.x.toFixed(4)),
      y: Number(position.y.toFixed(4)),
      z: Number(position.z.toFixed(4))
    },
    renderable: structuredClone(renderable),
    health: health
      ? {
          current: Number(health.current.toFixed(4)),
          maximum: health.maximum
        }
      : null,
    movement: movement ? { state: movement.state } : null,
    targetId: targeting?.targetId ?? null
  };
}

export function createBattleClashGame(options = {}) {
  const engine = createEngine({
    tick: { maxDelta: FIXED_DELTA },
    kits: [
      createCoreDataKit({
        random: {
          seed: WORLD_SEED,
          streams: ["battle"]
        }
      }),
      createCorePersistenceKit({
        descriptors: {
          slots: {
            "battle-clash-profile": {
              id: "battle-clash-profile",
              schema: "battle-clash.progression/1",
              adapter: "browser-local-storage"
            }
          }
        }
      }),
      createCoreNetworkKit({
        config: {
          authority: "defender-host",
          transport: "peerjs",
          sync: "authoritative-snapshot"
        },
        descriptors: {
          sessions: {
            "attack-defend-room": {
              id: "attack-defend-room",
              roles: ["attacker", "defender"],
              capacity: 2
            }
          },
          envelopes: {
            game: {
              schema: "battle-clash.peer-message/1",
              kinds: ["hello", "command", "snapshot", "room-full"]
            }
          }
        }
      }),
      createCoreSpatialKit(),
      createCoreSimulationKit(),
      createCoreInputKit(),
      createCoreGraphicsKit(),
      createCoreCameraKit(),
      createCoreUIKit(),
      createCoreWorldDomain({
        foundation: false,
        features: false
      }),
      createBattleClashRootKit(),
      createBattleWorldKit({
        progression: options.progression
      }),
      createRaidLifecycleKit(),
      createDeploymentKit(),
      createTargetingKit(),
      createNavigationKit(),
      createCombatKit(),
      createDefenseKit(),
      createProgressionKit(),
      createSessionKit()
    ]
  });

  function updateCommands(patch) {
    const current = engine.world.getResource(Resources.CommandQueue);
    engine.world.setResource(Resources.CommandQueue, {
      ...current,
      ...patch
    });
  }

  function deployAt(x, z) {
    const current = engine.world.getResource(Resources.CommandQueue);
    updateCommands({
      deploy: [...current.deploy, { x: Number(x), z: Number(z) }]
    });
  }

  function startRaid() {
    updateCommands({ start: true });
  }

  function reset() {
    updateCommands({ reset: true });
  }

  function fortify() {
    updateCommands({ fortify: true });
  }

  function tick(steps = 1) {
    for (let index = 0; index < steps; index += 1) {
      engine.tick(FIXED_DELTA);
    }
  }

  function stepSeconds(seconds) {
    tick(Math.max(1, Math.round(Number(seconds) / FIXED_DELTA)));
  }

  function getSnapshot() {
    const entities = engine.world
      .query(
        Components.Identity,
        Components.Position,
        Components.Renderable,
        Components.Faction
      )
      .map((entity) => entitySnapshot(engine.world, entity))
      .sort((left, right) => left.id.localeCompare(right.id));
    const raid = structuredClone(engine.world.getResource(Resources.RaidState));
    const deployment = structuredClone(
      engine.world.getResource(Resources.DeploymentState)
    );
    const effects = structuredClone(engine.world.getResource(Resources.EffectsState));
    const progression = structuredClone(
      engine.world.getResource(Resources.ProgressionState)
    );
    const defense = structuredClone(
      engine.world.getResource(Resources.DefenseState)
    );
    const session = structuredClone(
      engine.world.getResource(Resources.SessionState)
    );
    const activeCells = engine.n.battleClashWorld.getActiveCells();
    const core = entities.find((entity) => entity.role === "core") ?? null;

    return {
      schema: "battle-clash.snapshot/1",
      frame: engine.clock.frame,
      elapsed: Number(engine.clock.elapsed.toFixed(4)),
      raid,
      deployment,
      progression,
      defense,
      session,
      coreHealth: core?.health ?? { current: 0, maximum: 520 },
      activeCellCount: activeCells.length,
      entities,
      effects,
      domains: engine.n.paths().map((entry) => entry.path)
    };
  }

  function getDeterministicSnapshot() {
    const snapshot = getSnapshot();
    return {
      schema: snapshot.schema,
      raid: snapshot.raid,
      deployment: snapshot.deployment,
      progression: snapshot.progression,
      defense: snapshot.defense,
      coreHealth: snapshot.coreHealth,
      activeCellCount: snapshot.activeCellCount,
      entities: snapshot.entities,
      domains: snapshot.domains
    };
  }

  function getDigest() {
    return engine.n.coreData.digest.digest(getDeterministicSnapshot(), {
      game: "battle-clash"
    }).digest;
  }

  return {
    engine,
    deployAt,
    startRaid,
    reset,
    fortify,
    tick,
    stepSeconds,
    setProgression: (profile) =>
      engine.n.battleClashProgression.setProfile(profile),
    updateSession: (patch) => engine.n.battleClashSession.update(patch),
    canDeployAt: (x, z) => engine.n.battleClashDeployment.canDeployAt(x, z),
    getSnapshot,
    getDeterministicSnapshot,
    getDigest
  };
}
