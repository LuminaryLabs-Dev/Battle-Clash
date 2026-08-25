import {
  createFlatWorldSurface,
  createUniformGridPartition
} from "nexusengine/domains/world";
import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import {
  BATTLEFIELD,
  WORLD_ID,
  WORLD_SEED
} from "../../data/battlefield.js";
import { isTerritorySceneId, sceneForTerritory } from "../../data/world.js";
import { Events, Resources } from "../shared/definitions.js";
import {
  claimTerritory as claimTerritoryState,
  changeLandscape as changeLandscapeState,
  discoverTerritory as discoverTerritoryState,
  enterTerritory as enterTerritoryState,
  interactLandmark as interactLandmarkState,
  moveHero as moveHeroState,
  healArmy as healArmyState,
  recruitArmy as recruitArmyState,
  tradeResources as tradeResourcesState,
  upgradeSanctum as upgradeSanctumState,
  tickEconomy as tickEconomyState
} from "./world-state.js";
import {
  activeRegionIds,
  factionStrategy,
  factionSummary,
  landscapeForTerritory
} from "./world-state.js";
import {
  clearHeroEntity,
  seedBattleState,
  seedTerritoryFronts,
  seedHeroEntity,
  seedTerritoryLandmarks,
  syncHeroEntity,
  syncTerritoryFronts
} from "../shared/entity-factory.js";

export function createBattleWorldKit(options = {}) {
  return defineDomainServiceKit({
    id: "battle-clash-world-kit",
    domain: "battle-clash-world",
    domainPath: "n:game:battle-clash:world",
    parentDomainPath: "n:game:battle-clash",
    apiName: "battleClashWorld",
    stability: "experimental",
    version: "0.1.0",
    provides: ["n:game:battle-clash:world"],
    requires: [
      "n:game:battle-clash",
      "n:world",
      "n:spatial"
    ],
    services: [
      "battlefield",
      "deployment-perimeter",
      "territory-map",
      "hero-exploration",
      "territory-control",
      "economy-clock"
    ],
    systems: [
      {
        phase: "cleanup",
        name: "battleClashTerritoryCompletionSystem",
        system: territoryCompletionSystem
      }
    ],
    metadata: {
      owns: [
        "authored battlefield definition",
        "deployment perimeter",
        "game entity seeding",
        "territory graph and ownership projection",
        "hero, army, economy, and landscape state synchronization"
      ],
      doesNotOwn: [
        "world cell lifecycle",
        "renderer meshes",
        "combat outcomes"
      ]
    },
    initWorld({ engine, world }) {
      engine.n.world.registerWorld({
        id: WORLD_ID,
        seed: WORLD_SEED,
        partition: createUniformGridPartition({
          id: "battle-clash-grid",
          cellSize: BATTLEFIELD.cellSize,
          radius: BATTLEFIELD.cellRadius
        }),
        surface: createFlatWorldSurface({
          id: "battle-clash-flat-surface"
        }),
        providers: []
      });
      engine.n.world.setFocus(WORLD_ID, {
        position: { x: 0, y: 0, z: 0 }
      });
      engine.n.world.updateWorld(WORLD_ID);
      seedBattleState(world, {
        progression: options.progression,
        world: options.world
      });
      const initialWorld = world.getResource(Resources.WorldState);
      if (isTerritorySceneId(initialWorld.currentSceneId)) {
        seedTerritoryLandmarks(world, initialWorld.currentTerritoryId);
        seedTerritoryFronts(world, initialWorld.currentTerritoryId, initialWorld.territories[initialWorld.currentTerritoryId]);
        seedHeroEntity(world, initialWorld.hero, initialWorld.currentTerritoryId);
      }
    },
    createApi({ engine }) {
      return {
        id: WORLD_ID,
        seed: WORLD_SEED,
        getSnapshot() {
          return engine.n.world.snapshotWorld(WORLD_ID);
        },
        getActiveCells() {
          return engine.n.world.getActiveCells(WORLD_ID);
        },
        getWorldState() {
          return structuredClone(engine.world.getResource(Resources.WorldState));
        },
        getCurrentTerritory() {
          return structuredClone(engine.world.getResource(Resources.TerritoryState));
        },
        getHeroState() {
          return structuredClone(engine.world.getResource(Resources.HeroState));
        },
        getSanctumState() {
          return structuredClone(engine.world.getResource(Resources.SanctumState));
        },
        setProfile(profile = {}) {
          const current = engine.world.getResource(Resources.WorldState);
          const currentScene = engine.world.getResource(Resources.SceneState)?.current ?? current.currentSceneId;
          const nextTerritories = profile.territories
            ? structuredClone(profile.territories)
            : structuredClone(current.territories);
          const nextTerritoryId = nextTerritories[profile.currentTerritoryId]
            ? profile.currentTerritoryId
            : current.currentTerritoryId;
          const nextHero = {
            ...current.hero,
            ...(profile.hero ? structuredClone(profile.hero) : {}),
            territoryId: nextTerritoryId
          };
          const next = {
            ...current,
            ...structuredClone(profile),
            currentSceneId: currentScene,
            currentTerritoryId: nextTerritoryId,
            territories: nextTerritories,
            hero: nextHero,
            army: profile.army ? structuredClone(profile.army) : structuredClone(current.army),
            economy: profile.economy ? structuredClone(profile.economy) : structuredClone(current.economy),
            sanctum: profile.sanctum ? structuredClone(profile.sanctum) : structuredClone(current.sanctum)
          };
          next.activeRegionIds = activeRegionIds(next.territories, next.currentTerritoryId, next.hero.discoveryRadius);
          next.factions = factionSummary(next.territories);
          next.factionStrategy = factionStrategy(next.territories, next.activeRegionIds);
          next.frontier = {
            ...current.frontier,
            ...(profile.frontier ? structuredClone(profile.frontier) : {}),
            simulatedTerritoryCount: next.activeRegionIds.length
          };
          commitWorldState(engine, next, null);
          return structuredClone(next);
        },
        discoverTerritory(territoryId) {
          const current = engine.world.getResource(Resources.WorldState);
          const result = discoverTerritoryState(current, territoryId);
          if (!result.accepted || result.duplicate) return result;
          engine.world.setResource(Resources.WorldState, result.state);
          engine.n.battleClashProgression?.awardExploration({
            kind: "discovery",
            id: territoryId
          });
          worldEvent(engine, Events.TerritoryDiscovered, {
            territoryId,
            revision: result.state.revision
          });
          return { ...result, state: structuredClone(result.state) };
        },
        enterTerritory(territoryId) {
          const current = engine.world.getResource(Resources.WorldState);
          const result = enterTerritoryState(current, territoryId);
          if (!result.accepted) return result;
          const worldRoute = engine.n.battleClashNavigation?.findWorldPath(
            current.currentTerritoryId,
            territoryId
          );
          if (worldRoute?.status !== "resolved") {
            return { accepted: false, reason: "world-route-unresolved", route: structuredClone(worldRoute) };
          }
          const routedState = {
            ...result.state,
            hero: {
              ...result.state.hero,
              worldRoute: {
                status: "resolved",
                pathLength: Number(worldRoute.pathLength ?? worldRoute.points?.length ?? 0),
                points: [...(worldRoute.points ?? [])],
                targetTerritoryId: territoryId,
                revision: result.state.revision
              }
            }
          };
          const transition = engine.n.scene?.requestTransition({
            toSceneId: sceneForTerritory(territoryId),
            direct: true,
            transitionId: `territory:${current.revision + 1}:${territoryId}`,
            payload: { territoryId }
          });
          if (!transition?.accepted) return { ...result, transition };
          commitWorldState(engine, routedState, transition);
          if (isTerritorySceneId(sceneForTerritory(territoryId))) {
            seedTerritoryLandmarks(engine.world, territoryId);
            seedTerritoryFronts(engine.world, territoryId, routedState.territories[territoryId]);
            seedHeroEntity(engine.world, routedState.hero, territoryId);
          } else {
            clearHeroEntity(engine.world);
          }
          worldEvent(engine, Events.TerritoryEntered, {
            territoryId,
            sceneId: sceneForTerritory(territoryId),
            revision: routedState.revision
          });
          return { ...result, transition, route: structuredClone(worldRoute), state: structuredClone(routedState) };
        },
        claimTerritory(territoryId, faction = "player") {
          const current = engine.world.getResource(Resources.WorldState);
          const result = claimTerritoryState(current, territoryId, faction);
          if (!result.accepted) return result;
          commitWorldState(engine, result.state, null);
          worldEvent(engine, Events.TerritoryClaimed, {
            territoryId,
            faction,
            revision: result.state.revision
          });
          return { ...result, state: structuredClone(result.state) };
        },
        moveHero(position) {
          const current = engine.world.getResource(Resources.WorldState);
          const route = engine.n.battleClashNavigation?.findPath(current.hero.position, position);
          if (route?.status !== "resolved") {
            return { accepted: false, reason: "hero-route-blocked", route: structuredClone(route) };
          }
          const next = moveHeroState(current, position, route);
          commitWorldState(engine, next, null);
          const discoveredBefore = new Set(current.discoveredTerritoryIds ?? []);
          for (const territoryId of next.discoveredTerritoryIds ?? []) {
            if (discoveredBefore.has(territoryId)) continue;
            worldEvent(engine, Events.TerritoryDiscovered, {
              territoryId,
              source: "hero-border-crossing",
              direction: next.lastHeroDiscovery?.direction ?? null,
              revision: next.revision
            });
            engine.n.battleClashProgression?.awardExploration({
              kind: "discovery",
              id: territoryId
            });
          }
          worldEvent(engine, Events.HeroMoved, {
            territoryId: next.currentTerritoryId,
            position: structuredClone(next.hero.position),
            discoveredTerritoryId: next.lastHeroDiscovery?.territoryId ?? null,
            revision: next.revision
          });
          return { accepted: true, hero: structuredClone(next.hero), route: structuredClone(route) };
        },
        tickEconomy(deltaSeconds) {
          const current = engine.world.getResource(Resources.WorldState);
          const next = tickEconomyState(current, deltaSeconds);
          commitWorldState(engine, next, null);
          for (const [territoryId, territory] of Object.entries(next.territories ?? {})) {
            const previous = current.territories?.[territoryId];
            const previousFronts = JSON.stringify(previous?.fronts ?? []);
            const nextFronts = JSON.stringify(territory.fronts ?? []);
            if (previousFronts === nextFronts) continue;
            worldEvent(engine, Events.FrontChanged, {
              territoryId,
              fronts: structuredClone(territory.fronts ?? []),
              revision: next.revision
            });
          }
          worldEvent(engine, Events.EconomyTicked, {
            deltaSeconds: Number(deltaSeconds),
            resources: structuredClone(next.economy.resources)
          });
          return structuredClone(next.economy);
        },
        healArmy() {
          return applyWorldAction(engine, healArmyState, Events.EconomyTicked, "army-healed");
        },
        recruitArmy(request = {}) {
          return applyWorldAction(engine, (state) => recruitArmyState(state, request), Events.EconomyTicked, "army-recruited");
        },
        upgradeSanctum() {
          return applyWorldAction(engine, upgradeSanctumState, Events.TerritoryClaimed, "sanctum-upgraded");
        },
        tradeResources(request = {}) {
          return applyWorldAction(engine, (state) => tradeResourcesState(state, request), Events.EconomyTicked, "resources-traded");
        },
        interactLandmark(landmarkId) {
          const result = applyWorldAction(
            engine,
            (state) => interactLandmarkState(state, landmarkId),
            Events.LandmarkInteracted,
            "landmark-interacted"
          );
          if (result.accepted && result.state?.lastLandmarkInteraction?.firstInteraction) {
            engine.n.battleClashProgression?.awardExploration({
              kind: "landmark",
              id: landmarkId
            });
          }
          return result;
        },
        changeLandscape(patch = {}) {
          const current = engine.world.getResource(Resources.WorldState);
          const next = changeLandscapeState(current, patch);
          commitWorldState(engine, next, null);
          worldEvent(engine, Events.LandscapeChanged, {
            territoryId: next.currentTerritoryId,
            revision: next.landscape.revision,
            blockedCells: next.landscape.blockedCells.length
          });
          return structuredClone(next.landscape);
        },
        transitionScene(sceneId, payload = {}) {
          const current = engine.world.getResource(Resources.WorldState);
          const requestedTerritoryId = payload.territoryId
            ?? (current.currentTerritoryId === "dawnwatch-sanctum" ? null : current.currentTerritoryId);
          const canonicalSceneId = sceneId === "territory" && requestedTerritoryId
            ? sceneForTerritory(requestedTerritoryId)
            : String(sceneId ?? "");
          const guard = sceneTransitionGuard(current, canonicalSceneId, payload);
          if (!guard.accepted) return guard;
          const transition = engine.n.scene?.requestTransition({
            toSceneId: canonicalSceneId,
            direct: true,
            payload,
            transitionId: `scene:${current.revision + 1}:${canonicalSceneId}`
          });
          if (!transition?.accepted) return transition;
          const next = {
            ...current,
            currentSceneId: canonicalSceneId,
            revision: current.revision + 1
          };
          if (canonicalSceneId === "sanctum") {
            const sanctum = current.territories["dawnwatch-sanctum"];
            next.currentTerritoryId = "dawnwatch-sanctum";
            next.hero = { ...current.hero, territoryId: "dawnwatch-sanctum", position: { x: 50, z: 50 } };
            const resourcesBefore = structuredClone(current.economy.resources);
            next.landscape = structuredClone(
              sanctum?.landscape ??
              landscapeForTerritory("dawnwatch-sanctum", sanctum?.landscapeRevision ?? 0)
            );
            const loot = engine.world.getResource(Resources.LootState);
            if (loot?.totals) {
              const resources = Object.fromEntries(
                Object.entries(next.economy.resources).map(([resource, amount]) => [
                  resource,
                  Math.min(
                    next.economy.storage[resource] ?? Number.POSITIVE_INFINITY,
                    Number(amount ?? 0) + Number(loot.totals[resource] ?? 0)
                  )
                ])
              );
              next.economy = { ...next.economy, resources };
              next.lastSanctumReturn = {
                territoryId: current.currentTerritoryId,
                loot: structuredClone(loot.totals),
                resourcesBefore,
                resourcesAfter: structuredClone(resources),
                revision: next.revision
              };
            }
            if (!next.lastSanctumReturn) {
              next.lastSanctumReturn = {
                territoryId: current.currentTerritoryId,
                loot: { gold: 0, food: 0, iron: 0, arcane: 0 },
                resourcesBefore,
                resourcesAfter: structuredClone(next.economy.resources),
                revision: next.revision
              };
            }
          }
          if (isTerritorySceneId(canonicalSceneId)) {
            seedTerritoryLandmarks(engine.world, next.currentTerritoryId);
            seedTerritoryFronts(engine.world, next.currentTerritoryId, next.territories[next.currentTerritoryId]);
            seedHeroEntity(engine.world, next.hero, next.currentTerritoryId);
          } else {
            clearHeroEntity(engine.world);
          }
          const committed = commitWorldState(engine, next, transition);
          if (canonicalSceneId === "sanctum") {
            engine.world.setResource(Resources.LootState, {
              schema: "battle-clash.loot/1",
              drops: [],
              totals: { gold: 0, food: 0, iron: 0, arcane: 0 }
            });
          }
          if (canonicalSceneId === "encounter") {
            seedBattleState(engine.world, {
              encounterTerritoryId: next.currentTerritoryId,
              encounterFrontDirection: payload.frontDirection ?? null,
              progression: engine.world.getResource(Resources.ProgressionState)
            });
          }
          worldEvent(engine, Events.SceneChanged, {
            fromSceneId: transition.transition?.fromSceneId ?? null,
            toSceneId: canonicalSceneId,
            revision: next.revision
          });
          return { ...transition, state: structuredClone(committed) };
        }
      };
    }
  });
}

function territoryCompletionSystem(world) {
  const raid = world.getResource(Resources.RaidState);
  const scene = world.getResource(Resources.SceneState);
  const current = world.getResource(Resources.WorldState);
  if (raid?.phase !== "won" || scene?.current !== "encounter" || !current) return;
  const room = world.getResource(Resources.RoomState);
  if (room?.hasNext) return;
  const territory = current.territories[current.currentTerritoryId];
  if (!territory || territory.ownerFaction === "player") return;
  const progressed = room?.roomId
    ? {
        ...current,
        territories: {
          ...current.territories,
          [current.currentTerritoryId]: {
            ...territory,
            roomProgress: [...new Set([...(territory.roomProgress ?? []), room.roomId])]
          }
        }
      }
    : current;
  const result = claimTerritoryState(progressed, current.currentTerritoryId, "player");
  if (!result.accepted) return;
  const next = {
    ...result.state,
    activeRegionIds: activeRegionIds(
      result.state.territories,
      result.state.currentTerritoryId,
      result.state.hero?.discoveryRadius ?? 2
    )
  };
  world.setResource(Resources.WorldState, next);
  world.setResource(Resources.HeroState, structuredClone(next.hero));
  world.setResource(Resources.ArmyState, structuredClone(next.army));
  world.setResource(Resources.EconomyState, structuredClone(next.economy));
  world.setResource(Resources.SanctumState, structuredClone(next.sanctum));
  world.setResource(Resources.BuildingState, structuredClone(next.buildings));
  world.setResource(Resources.TerritoryState, structuredClone(next.territories[next.currentTerritoryId]));
  world.setResource(Resources.LandscapeState, {
    ...structuredClone(next.landscape),
    territoryId: next.currentTerritoryId,
    revision: next.territories[next.currentTerritoryId]?.landscapeRevision ?? next.landscape?.revision ?? 0
  });
  world.emit(Events.TerritoryClaimed, {
    territoryId: next.currentTerritoryId,
    faction: "player",
    source: "encounter-won",
    reward: structuredClone(next.lastClaimReward),
    revision: next.revision
  });
}

function worldEvent(engine, event, payload) {
  if (event) engine.world.emit(event, payload);
}

function sceneTransitionGuard(state, sceneId, payload = {}) {
  const target = String(sceneId ?? "");
  if (!(target === "sanctum" || target === "overworld" || target === "territory" || target === "encounter" || isTerritorySceneId(target))) {
    return { accepted: false, reason: "unknown-scene", sceneId: target };
  }
  if (target === "encounter") {
    if (!isTerritorySceneId(state.currentSceneId)) {
      return { accepted: false, reason: "territory-required-for-encounter" };
    }
    const territoryId = payload.territoryId ?? state.currentTerritoryId;
    const territory = state.territories?.[territoryId];
    if (!territory || territoryId !== state.currentTerritoryId) {
      return { accepted: false, reason: "encounter-territory-mismatch" };
    }
    if (!state.discoveredTerritoryIds.includes(territoryId) || territory.kind === "sanctum") {
      return { accepted: false, reason: "encounter-territory-unavailable" };
    }
  }
  if (target === "territory" || isTerritorySceneId(target)) {
    const territoryId = payload.territoryId ?? state.currentTerritoryId;
    const territory = state.territories?.[territoryId];
    if (!territory || territory.kind === "sanctum") {
      return { accepted: false, reason: "territory-unavailable" };
    }
    if (!state.discoveredTerritoryIds.includes(territoryId)) {
      return { accepted: false, reason: "territory-undiscovered" };
    }
    if (territoryId !== state.currentTerritoryId) {
      return { accepted: false, reason: "territory-entry-required" };
    }
  }
  if (target === "overworld" && state.currentSceneId === "encounter") {
    return { accepted: false, reason: "encounter-resolution-required" };
  }
  return { accepted: true };
}

function commitWorldState(engine, next, transition) {
  const committed = {
    ...next,
    activeRegionIds: activeRegionIds(next.territories, next.currentTerritoryId, next.hero?.discoveryRadius ?? 2)
  };
  engine.world.setResource(Resources.WorldState, committed);
  if (isTerritorySceneId(committed.currentSceneId)) {
    syncTerritoryFronts(
      engine.world,
      committed.territories[committed.currentTerritoryId]
    );
  }
  engine.world.setResource(Resources.HeroState, structuredClone(committed.hero));
  syncHeroEntity(engine.world, committed.hero);
  engine.world.setResource(Resources.ArmyState, structuredClone(committed.army));
  engine.world.setResource(Resources.EconomyState, structuredClone(committed.economy));
  engine.world.setResource(Resources.SanctumState, structuredClone(committed.sanctum));
  engine.world.setResource(Resources.BuildingState, structuredClone(committed.buildings));
  engine.world.setResource(
    Resources.TerritoryState,
    structuredClone(committed.territories[committed.currentTerritoryId])
  );
  const scene = engine.n.scene?.getCurrentScene?.();
  engine.world.setResource(Resources.SceneState, {
    current: scene?.id ?? committed.currentSceneId,
    previous: transition?.transition?.fromSceneId ?? null,
    transition: transition?.transition ?? null,
    revision: committed.revision
  });
  const landscape = engine.world.getResource(Resources.LandscapeState);
  engine.world.setResource(Resources.LandscapeState, {
    ...structuredClone(committed.landscape ?? landscape),
    territoryId: committed.currentTerritoryId,
    revision: committed.territories[committed.currentTerritoryId]?.landscapeRevision ?? landscape.revision
  });
  return committed;
}

function applyWorldAction(engine, action, event, actionName) {
  const current = engine.world.getResource(Resources.WorldState);
  const result = action(current);
  if (!result.accepted) return result;
  commitWorldState(engine, result.state, null);
  worldEvent(engine, event, { action: actionName, revision: result.state.revision });
  return { ...result, state: structuredClone(result.state) };
}
