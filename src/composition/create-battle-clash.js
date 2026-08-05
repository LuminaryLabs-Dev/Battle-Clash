import { createEngine } from "nexusengine/engine";
import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { createCameraFramingKit as createCoreCameraKit } from "nexusengine/domains/presentation/camera/framing";
import { createDataKit as createCoreDataKit } from "nexusengine/domains/runtime/data";
import { createGraphicsKit as createCoreGraphicsKit } from "nexusengine/domains/presentation/graphics";
import { createInputKit as createCoreInputKit } from "nexusengine/domains/interaction/input";
import { createInteractionKit as createCoreInteractionKit } from "nexusengine/domains/interaction/runtime";
import { createNetworkKit as createCoreNetworkKit } from "nexusengine/domains/network";
import { createPersistenceKit as createCorePersistenceKit } from "nexusengine/domains/runtime/persistence";
import { createSimulationKit as createCoreSimulationKit } from "nexusengine/domains/simulation/runtime";
import { createSceneKit as createCoreSceneKit } from "nexusengine/domains/world/scene";
import { createSpatialKit as createCoreSpatialKit } from "nexusengine/domains/spatial";
import { createUIKit as createCoreUIKit } from "nexusengine/domains/presentation/ui";
import { createPresentationKit } from "nexusengine/domains/presentation/registry";
import { createPresentationOutputKit } from "nexusengine/domains/presentation/output";
import { createWorldDomain as createCoreWorldDomain } from "nexusengine/domains/world";
import { createCombatKit } from "../domains/combat/combat-kit.js";
import { createHeroCombatKit } from "../domains/hero-combat/hero-combat-kit.js";
import { createDefenseKit } from "../domains/defense/defense-kit.js";
import { createDeploymentKit } from "../domains/deployment/deployment-kit.js";
import { createEncounterKit } from "../domains/encounter/encounter-kit.js";
import { createNavigationKit } from "../domains/navigation/navigation-kit.js";
import { createProgressionKit } from "../domains/progression/progression-kit.js";
import { createRaidLifecycleKit } from "../domains/raid/raid-kit.js";
import { createSessionKit } from "../domains/session/session-kit.js";
import { Components, Events, Resources } from "../domains/shared/definitions.js";
import { createTargetingKit } from "../domains/targeting/targeting-kit.js";
import { createBattleWorldKit } from "../domains/world/world-kit.js";
import {
  createArmyBoundaryKit,
  createEconomyBoundaryKit,
  createEncounterBoundaryKit,
  createFlowBoundaryKit,
  createFrontierBoundaryKit,
  createHeroBoundaryKit,
  createSanctumBoundaryKit
} from "../domains/boundaries/boundary-kits.js";
import { ARCHETYPES, WORLD_SEED } from "../data/battlefield.js";
import { WORLD_SCENES, sceneForTerritory } from "../data/world.js";
import { createPlayerKit } from "../domains/player/player-kit.js";
import { createContentKit } from "../domains/content/content-kit.js";
import { normalizePlayerObservation } from "../domains/player/player-observation.js";
import { advanceRoomState } from "../domains/encounter/room-state.js";
import { seedBattleState } from "../domains/shared/entity-factory.js";
import {
  PRODUCTION_CONTENT_SCHEMA, CONTENT_TERRITORIES, ROOM_TYPES, ENEMY_FAMILIES,
  BOSS_PHASES, GEAR_ITEMS, QUESTS, CRAFTING_RECIPES, SANCTUM_ROOMS
} from "../data/production-content.js";

export const FIXED_DELTA = 1 / 30;

function createBattleClashRootKit() {
  return defineDomainServiceKit({
    id: "battle-clash-composition-kit",
    domain: "battle-clash",
    domainPath: "n:game:battle-clash",
    apiName: "battleClash",
    stability: "experimental",
    version: "0.1.0",
    provides: ["n:game:battle-clash"],
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
  const territoryMarker = world.hasComponent(entity, Components.TerritoryMarker)
    ? world.getComponent(entity, Components.TerritoryMarker)
    : null;
  const resourceNode = world.hasComponent(entity, Components.ResourceNode)
    ? world.getComponent(entity, Components.ResourceNode)
    : null;
  const hero = world.hasComponent(entity, Components.Hero)
    ? world.getComponent(entity, Components.Hero)
    : null;
  const frontMarker = world.hasComponent(entity, Components.FrontMarker)
    ? world.getComponent(entity, Components.FrontMarker)
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
    targetId: targeting?.targetId ?? null,
    territoryMarker: territoryMarker ? structuredClone(territoryMarker) : null,
    resourceNode: resourceNode ? structuredClone(resourceNode) : null,
    hero: hero ? structuredClone(hero) : null,
    frontMarker: frontMarker ? structuredClone(frontMarker) : null
  };
}

export function createBattleClashGame(options = {}) {
  const requestedInitialScene = options.world?.currentSceneId === "territory"
    ? sceneForTerritory(options.world?.currentTerritoryId ?? "dawnwatch-sanctum")
    : options.world?.currentSceneId;
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
      createCoreWorldDomain({
        foundation: false,
        features: false
      }),
      createCoreSceneKit({
        initialSceneId: ["sanctum", "overworld", "encounter"].includes(requestedInitialScene)
          || String(requestedInitialScene ?? "").startsWith("territory:")
          ? requestedInitialScene
          : "sanctum",
        allowDirectTransitions: true,
        scenes: WORLD_SCENES
      }),
      createCoreInputKit(),
      createCoreInteractionKit(),
      createPresentationKit(),
      createPresentationOutputKit(),
      createCoreGraphicsKit(),
      createCoreCameraKit(),
      createCoreUIKit(),
      createBattleClashRootKit(),
      createBattleWorldKit({
        progression: options.progression,
        world: options.world
      }),
      createFlowBoundaryKit(),
      createFrontierBoundaryKit(),
      createHeroBoundaryKit(),
      createArmyBoundaryKit(),
      createEconomyBoundaryKit(),
      createEncounterBoundaryKit(),
      createSanctumBoundaryKit(),
      createRaidLifecycleKit(),
      createDeploymentKit(),
      createTargetingKit(),
      createNavigationKit(),
      createCombatKit(),
      createHeroCombatKit(),
      createEncounterKit(),
      createDefenseKit(),
      createProgressionKit(),
      createSessionKit(),
      createPlayerKit(),
      createContentKit({ profile: options.content })
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

  function useHeroAbility() {
    updateCommands({ heroAbility: { id: "arc-burst" } });
    return getSnapshot();
  }

  function reset() {
    updateCommands({ reset: true });
  }

  function fortify() {
    updateCommands({ fortify: true });
  }

  function selectArchetype(archetypeId, { allowLocked = false } = {}) {
    const id = String(archetypeId ?? "delver");
    const deployment = engine.world.getResource(Resources.DeploymentState);
    const army = engine.world.getResource(Resources.ArmyState);
    if (ARCHETYPES[id]?.category !== "troop") return { accepted: false, reason: "unknown-archetype", state: structuredClone(deployment) };
    if (!allowLocked && !(army.unlockedArchetypes ?? ["delver"]).includes(id)) {
      return { accepted: false, reason: "archetype-locked", state: structuredClone(deployment) };
    }
    const next = { ...deployment, selectedArchetype: id };
    engine.world.setResource(Resources.DeploymentState, next);
    return { accepted: true, state: structuredClone(next) };
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
    const battleMetadata = structuredClone(
      engine.world.getResource(Resources.BattleMetadata)
    );
    const defense = structuredClone(
      engine.world.getResource(Resources.DefenseState)
    );
    const ability = structuredClone(
      engine.world.getResource(Resources.AbilityState)
    );
    const objective = structuredClone(
      engine.world.getResource(Resources.ObjectiveState)
    );
    const room = structuredClone(
      engine.world.getResource(Resources.RoomState)
    );
    const loot = structuredClone(
      engine.world.getResource(Resources.LootState)
    );
    const session = structuredClone(
      engine.world.getResource(Resources.SessionState)
    );
    const account = structuredClone(
      engine.world.getResource(Resources.AccountState)
    );
    const scene = structuredClone(
      engine.world.getResource(Resources.SceneState)
    );
    const worldState = structuredClone(
      engine.world.getResource(Resources.WorldState)
    );
    const hero = structuredClone(engine.world.getResource(Resources.HeroState));
    const army = structuredClone(engine.world.getResource(Resources.ArmyState));
    const sanctum = structuredClone(engine.world.getResource(Resources.SanctumState));
    const economy = structuredClone(
      engine.world.getResource(Resources.EconomyState)
    );
    const territory = structuredClone(
      engine.world.getResource(Resources.TerritoryState)
    );
    const landscape = structuredClone(
      engine.world.getResource(Resources.LandscapeState)
    );
    const player = structuredClone(engine.world.getResource(Resources.PlayerState));
    const playerObservation = structuredClone(engine.world.getResource(Resources.PlayerObservation));
    const playerMemory = structuredClone(engine.world.getResource(Resources.PlayerMemory));
    const playerDecision = structuredClone(engine.world.getResource(Resources.PlayerDecision));
    const playerEpisode = structuredClone(engine.world.getResource(Resources.PlayerEpisode));
    const playerLearningSignal = structuredClone(engine.world.getResource(Resources.PlayerLearningSignal));
    const content = structuredClone(engine.world.getResource(Resources.ContentState));
    const activeCells = engine.n.battleClashWorld.getActiveCells();
    const core = entities.find((entity) => entity.role === "core") ?? null;

    return {
      schema: "battle-clash.snapshot/1",
      frame: engine.clock.frame,
      elapsed: Number(engine.clock.elapsed.toFixed(4)),
      raid,
      deployment,
      progression,
      battleMetadata,
      defense,
      ability,
      objective,
      room,
      loot,
      session,
      account,
      coreHealth: core?.health ?? { current: 0, maximum: 520 },
      activeCellCount: activeCells.length,
      entities,
      effects,
      scene,
      world: worldState,
      hero,
      army,
      sanctum,
      economy,
      territory,
      landscape,
      player,
      playerObservation,
      playerMemory,
      playerDecision,
      playerEpisode,
      playerLearningSignal,
      content,
      productionContent: {
        schema: PRODUCTION_CONTENT_SCHEMA,
        territories: CONTENT_TERRITORIES,
        rooms: ROOM_TYPES,
        enemyFamilies: ENEMY_FAMILIES,
        bossPhases: BOSS_PHASES,
        gear: GEAR_ITEMS,
        quests: QUESTS,
        crafting: CRAFTING_RECIPES,
        sanctumRooms: SANCTUM_ROOMS
      },
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
      battleMetadata: snapshot.battleMetadata,
      scene: snapshot.scene,
      world: snapshot.world,
      hero: snapshot.hero,
      army: snapshot.army,
      sanctum: snapshot.sanctum,
      economy: snapshot.economy,
      territory: snapshot.territory,
      landscape: snapshot.landscape,
      productionContent: snapshot.productionContent,
      player: snapshot.player,
      playerObservation: snapshot.playerObservation,
      playerMemory: snapshot.playerMemory,
      playerDecision: snapshot.playerDecision,
      playerEpisode: snapshot.playerEpisode,
      playerLearningSignal: snapshot.playerLearningSignal,
      content: snapshot.content,
      defense: snapshot.defense,
      ability: snapshot.ability,
      objective: snapshot.objective,
      room: snapshot.room,
      loot: snapshot.loot,
      account: snapshot.account,
      coreHealth: snapshot.coreHealth,
      activeCellCount: snapshot.activeCellCount,
      entities: snapshot.entities,
      domains: snapshot.domains
    };
  }

  function getDigest() {
    return engine.n.data.digest.digest(getDeterministicSnapshot(), {
      game: "battle-clash"
    }).digest;
  }

  function advanceRoom() {
    const current = engine.world.getResource(Resources.RoomState);
    const raid = engine.world.getResource(Resources.RaidState);
    const scene = engine.world.getResource(Resources.SceneState);
    if (scene?.current !== "encounter" || raid?.phase !== "won") {
      return { accepted: false, reason: "room-advance-requires-victory", state: structuredClone(current) };
    }
    const result = advanceRoomState(current);
    if (!result.accepted) return result;
    const worldState = engine.world.getResource(Resources.WorldState);
    const territory = worldState?.territories?.[result.state.territoryId];
    if (worldState && territory) {
      const nextWorld = {
        ...worldState,
        revision: Number(worldState.revision ?? 0) + 1,
        territories: {
          ...worldState.territories,
          [result.state.territoryId]: {
            ...territory,
            roomProgress: [...new Set([...(territory.roomProgress ?? []), result.completedRoomId])]
          }
        }
      };
      engine.world.setResource(Resources.WorldState, nextWorld);
      engine.world.setResource(Resources.TerritoryState, structuredClone(nextWorld.territories[result.state.territoryId]));
    }
    seedBattleState(engine.world, {
      encounterTerritoryId: result.state.territoryId,
      roomId: result.state.roomId,
      completedRoomIds: result.state.completedRoomIds,
      encounterFrontDirection: engine.world.getResource(Resources.BattleMetadata)?.frontDirection ?? null,
      progression: engine.world.getResource(Resources.ProgressionState)
    });
    engine.world.emit(Events.RoomChanged, structuredClone(result.state));
    return { ...result, snapshot: getSnapshot() };
  }

  return {
    engine,
    deployAt,
    startRaid,
    useHeroAbility,
    reset,
    advanceRoom,
    fortify,
    tick,
    stepSeconds,
    setProgression: (profile) =>
      engine.n.battleClashProgression.setProfile(profile),
    updateSession: (patch) => engine.n.battleClashSession.update(patch),
    updateAccount: (patch) => {
      const current = engine.world.getResource(Resources.AccountState) ?? {};
      const next = { ...current, ...structuredClone(patch) };
      engine.world.setResource(Resources.AccountState, next);
      engine.world.emit(Events.AccountChanged, structuredClone(next));
      return structuredClone(next);
    },
    getWorldState: () => engine.n.battleClashWorld.getWorldState(),
    getCurrentTerritory: () => engine.n.battleClashWorld.getCurrentTerritory(),
    getHeroState: () => engine.n.battleClashWorld.getHeroState(),
    getSanctumState: () => engine.n.battleClashWorld.getSanctumState(),
    getContentState: () => engine.n.battleClashContent.getState(),
    craftGear: (itemId) => engine.n.battleClashContent.craft(itemId),
    equipGear: (itemId) => engine.n.battleClashContent.equip(itemId),
    selectArchetype,
    discoverTerritory: (territoryId) =>
      engine.n.battleClashWorld.discoverTerritory(territoryId),
    enterTerritory: (territoryId) =>
      engine.n.battleClashWorld.enterTerritory(territoryId),
    prepareTerritory(territoryId) {
      const targetId = String(territoryId ?? "");
      const current = engine.n.battleClashWorld.getWorldState();
      if (current.currentTerritoryId === targetId) {
        return { accepted: true, duplicate: true, route: { status: "resolved", points: [targetId], pathLength: 0 } };
      }
      if (["encounter", "territory"].includes(current.currentSceneId) && current.currentSceneId === "encounter") {
        const raid = engine.world.getResource(Resources.RaidState);
        if (!["won", "lost"].includes(raid?.phase)) {
          return { accepted: false, reason: "raid-in-progress" };
        }
      }
      const route = engine.n.battleClashNavigation.findWorldPath(
        current.currentTerritoryId,
        targetId
      );
      if (route?.status !== "resolved") {
        return { accepted: false, reason: "world-route-unresolved", route: structuredClone(route) };
      }
      let entered = null;
      for (const nextTerritoryId of (route.points ?? []).slice(1)) {
        const snapshot = engine.n.battleClashWorld.getWorldState();
        if (!snapshot.discoveredTerritoryIds.includes(nextTerritoryId)) {
          const discovered = engine.n.battleClashWorld.discoverTerritory(nextTerritoryId);
          if (!discovered.accepted && !discovered.duplicate) return discovered;
        }
        entered = engine.n.battleClashWorld.enterTerritory(nextTerritoryId);
        if (!entered.accepted) return entered;
      }
      return { ...(entered ?? { accepted: false, reason: "empty-world-route" }), route: structuredClone(route) };
    },
    claimTerritory: (territoryId, faction = "player") =>
      engine.n.battleClashWorld.claimTerritory(territoryId, faction),
    moveHero: (position) => engine.n.battleClashWorld.moveHero(position),
    healArmy: () => engine.n.battleClashWorld.healArmy(),
    recruitArmy: (request = {}) => engine.n.battleClashWorld.recruitArmy(request),
    upgradeSanctum: () => engine.n.battleClashWorld.upgradeSanctum(),
    tradeResources: (request) => engine.n.battleClashWorld.tradeResources(request),
    interactLandmark: (landmarkId) => engine.n.battleClashWorld.interactLandmark(landmarkId),
    findHeroPath: (start, goal) => engine.n.battleClashNavigation.findPath(start, goal),
    findWorldPath: (startId, goalId) => engine.n.battleClashNavigation.findWorldPath(startId, goalId),
    findCombatPath: () => engine.n.battleClashNavigation.findCombatPath(),
    tickEconomy: (deltaSeconds) =>
      engine.n.battleClashWorld.tickEconomy(deltaSeconds),
    changeLandscape: (patch) => engine.n.battleClashWorld.changeLandscape(patch),
    transitionToScene: (sceneId, payload = {}) =>
      engine.n.battleClashWorld.transitionScene(sceneId, payload),
    canDeployAt: (x, z) => engine.n.battleClashDeployment.canDeployAt(x, z),
    getSnapshot,
    getDeterministicSnapshot,
    getDigest,
    getPlayerState: () => engine.n.battleClashPlayer.getState(),
    getPlayerObservation: (options = {}) => normalizePlayerObservation(getSnapshot(), options),
    startPlayerEpisode: (request) => engine.n.battleClashPlayer.startEpisode(request),
    recordPlayerObservation: (observation) => engine.n.battleClashPlayer.recordObservation(observation),
    retrievePlayerMemory: (memories) => engine.n.battleClashPlayer.retrieveMemory(memories),
    recordPlayerDecision: (decision) => engine.n.battleClashPlayer.recordDecision(decision),
    recordPlayerActionResult: (result) => engine.n.battleClashPlayer.recordActionResult(result),
    recordPlayerOutcome: (outcome) => engine.n.battleClashPlayer.recordOutcome(outcome),
    completePlayerEpisode: (status, result) => engine.n.battleClashPlayer.completeEpisode(status, result),
    promotePlayerSkill: (skill) => engine.n.battleClashPlayer.promoteSkill(skill)
  };
}
