import {
  TERRITORIES,
  TERRITORY_GRID,
  WORLD_MAP_SEED,
  isTerritorySceneId,
  sceneForTerritory,
  territoryById,
  territorySceneId
} from "../../data/world.js";
import { applyBuildingBonuses, createDefaultBuildingState } from "../building/building-state.js";

const RESOURCE_KEYS = ["gold", "food", "iron", "arcane"];

export function landscapeForTerritory(territoryId, revision = 0) {
  let hash = 2166136261;
  for (const char of String(territoryId)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const blockedCells = [];
  const hazards = [];
  for (let index = 0; index < 18; index += 1) {
    const x = 18 + ((hash >>> (index % 16)) + index * 13) % 64;
    const z = 18 + ((hash >>> ((index + 5) % 16)) + index * 7) % 64;
    blockedCells.push(`${x},${z}`);
    if (index % 6 === 0) hazards.push({ id: `${territoryId}-hazard-${index}`, x, z, kind: "pressure" });
  }
  return {
    schema: "battle-clash.landscape/1",
    territoryId,
    revision,
    grid: { ...TERRITORY_GRID },
    blockedCells: Array.from(new Set(blockedCells)),
    hazards
  };
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function territoryState(territory, discoveredIds, controlledIds) {
  const discovered = discoveredIds.includes(territory.id);
  const controlled = controlledIds.includes(territory.id);
  return {
    id: territory.id,
    sceneId: territory.kind === "sanctum" ? "sanctum" : territorySceneId(territory.id),
    title: territory.title,
    kind: territory.kind,
    coordinates: { ...territory.coordinates },
    ownerFaction: controlled ? "player" : territory.ownerFaction,
    discovered,
    controlled,
    controlRevision: 0,
    claimRewarded: controlled,
    fronts: territory.fronts.map((front) => ({ ...front })),
    neighbors: { ...territory.neighbors },
    economy: { ...territory.economy },
    landmarks: landmarksForTerritory(territory),
    landscape: landscapeForTerritory(territory.id, 0),
    landscapeRevision: 0,
    roomProgress: [],
    supplyEfficiency: controlled ? 1 : 0,
    encounterEnemyCount: encounterEnemyCountFor(territory, territory.fronts),
    unlocks: territoryUnlocksFor(territory, controlled)
  };
}

export function territoryUnlocksFor(territory, controlled = false) {
  if (!controlled) return [];
  const byKind = {
    sanctum: ["sanctum", "recruitment", "scouting"],
    frontier: ["route", "scouting"],
    wilds: ["route", "scouting", "food-production"],
    dungeon: ["route", "scouting", "arcane-expedition"],
    stronghold: ["route", "scouting", "stronghold", "siege-front"]
  };
  return [...(byKind[territory?.kind] ?? ["route", "scouting"])]
    .map(String);
}

function landmarksForTerritory(territory) {
  const landmarks = [...(territory.landmarks ?? [])].map((landmark) => ({ ...landmark }));
  const resource = Object.entries(territory.economy ?? {})
    .sort((left, right) => Number(right[1]) - Number(left[1]))[0]?.[0] ?? "gold";
  if (!landmarks.some((landmark) => landmark.kind === "settlement")) {
    landmarks.push({ id: `${territory.id}-settlement`, kind: "settlement", resource });
  }
  if (!landmarks.some((landmark) => landmark.kind === "resource")) {
    landmarks.push({ id: `${territory.id}-resource`, kind: "resource", resource });
  }
  if (!landmarks.some((landmark) => landmark.kind === territory.kind)) {
    landmarks.push({ id: `${territory.id}-${territory.kind}`, kind: territory.kind, resource });
  }
  return landmarks;
}

function encounterEnemyCountFor(territory, fronts = territory?.fronts ?? []) {
  const baseByKind = { frontier: 4, wilds: 5, dungeon: 10, stronghold: 40, sanctum: 0 };
  const base = baseByKind[territory?.kind] ?? 8;
  const pressure = Math.max(...fronts.map((front) => Number(front.pressure ?? 0)), 0);
  const pressureBonus = territory?.kind === "stronghold"
    ? Math.round(pressure * 12)
    : territory?.kind === "frontier" || territory?.kind === "wilds"
      ? Math.round(pressure * 2)
      : Math.round(pressure * 4);
  return Math.min(100, Math.max(8, base + fronts.length + pressureBonus));
}

export function factionSummary(territories) {
  const summary = {};
  for (const territory of Object.values(territories)) {
    const faction = String(territory.ownerFaction ?? "neutral");
    if (!summary[faction]) summary[faction] = { territories: 0, discovered: 0, pressure: 0, controlledIds: [] };
    summary[faction].territories += 1;
    summary[faction].discovered += territory.discovered ? 1 : 0;
    summary[faction].pressure += territory.fronts.reduce((sum, front) => sum + Number(front.pressure ?? 0), 0);
    if (territory.controlled) summary[faction].controlledIds.push(territory.id);
  }
  for (const faction of Object.keys(summary)) {
    summary[faction].pressure = Number(summary[faction].pressure.toFixed(3));
    summary[faction].controlledIds.sort();
  }
  return summary;
}

/**
 * Derive deterministic faction intent from the current frontier snapshot.
 * Factions do not mutate ownership here; they publish the strategic pressure
 * that the frontier and encounter domains can resolve on later ticks.
 */
export function factionStrategy(territories, activeIds = []) {
  const active = new Set(activeIds);
  const factionIds = Array.from(new Set([
    "player",
    ...Object.values(territories).map((territory) => String(territory.ownerFaction ?? "neutral")),
    ...Object.values(territories).flatMap((territory) => (territory.fronts ?? []).map((front) => String(front.faction ?? "neutral")))
  ])).sort();
  return Object.fromEntries(factionIds.map((faction) => {
    const ownedIds = Object.values(territories)
      .filter((territory) => String(territory.ownerFaction ?? "neutral") === faction)
      .map((territory) => territory.id)
      .sort();
    const targetTerritoryIds = Object.values(territories)
      .filter((territory) => String(territory.ownerFaction ?? "neutral") !== faction)
      .map((territory) => ({
        id: territory.id,
        pressure: Math.max(
          ...(territory.fronts ?? [])
            .filter((front) => String(front.faction ?? "neutral") === faction)
            .map((front) => Number(front.pressure ?? 0)),
          0
        )
      }))
      .filter((target) => target.pressure > 0)
      .sort((left, right) => right.pressure - left.pressure || left.id.localeCompare(right.id))
      .map((target) => target.id);
    const pressure = Object.values(territories).reduce((total, territory) => total + (territory.fronts ?? [])
      .filter((front) => String(front.faction ?? "neutral") === faction)
      .reduce((sum, front) => sum + Number(front.pressure ?? 0), 0), 0);
    const activeTargets = targetTerritoryIds.filter((id) => active.has(id));
    const intent = faction === "player"
      ? (targetTerritoryIds.length ? "expand" : "fortify")
      : faction === "neutral"
        ? (targetTerritoryIds.length ? "contest" : "settle")
        : (activeTargets.length ? "raid" : targetTerritoryIds.length ? "pressure" : "consolidate");
    return [faction, {
      faction,
      intent,
      ownedTerritoryIds: ownedIds,
      targetTerritoryIds,
      activeTargetTerritoryIds: activeTargets,
      power: Number((ownedIds.length * 10 + pressure * 4).toFixed(3)),
      pressure: Number(pressure.toFixed(3))
    }];
  }));
}

function productionMultiplier(territory) {
  const landmarks = territory.landmarks ?? [];
  const settlementBonus = landmarks.some((landmark) => landmark.kind === "settlement") ? 1.12 : 1;
  const resourceBonus = landmarks.some((landmark) => landmark.kind === "resource") ? 1.2 : 1;
  return settlementBonus * resourceBonus;
}

function claimRewardFor(territory) {
  const dominant = Object.entries(territory.economy ?? {})
    .sort((left, right) => Number(right[1]) - Number(left[1]))[0]?.[0] ?? "gold";
  const reward = { gold: 16, food: 8, iron: 5, arcane: 2 };
  reward[dominant] += territory.kind === "stronghold" ? 18 : territory.kind === "dungeon" ? 10 : 4;
  return reward;
}

function propagateClaimPressure(territories, territoryId, faction) {
  if (faction !== "player") return territories;
  const claimed = territories[territoryId];
  if (!claimed) return territories;
  const next = { ...territories };
  for (const neighborId of Object.values(claimed.neighbors ?? {})) {
    const neighbor = next[neighborId];
    if (!neighbor) continue;
    const direction = Object.entries(neighbor.neighbors ?? {})
      .find(([, id]) => id === territoryId)?.[0] ?? "west";
    const fronts = neighbor.fronts.some((front) => front.direction === direction)
      ? neighbor.fronts.map((front) => front.direction === direction
        ? { ...front, faction: "player", pressure: Math.max(Number(front.pressure ?? 0), 0.28) }
        : front)
      : [
          ...neighbor.fronts,
          { direction, faction: "player", pressure: 0.28 }
        ];
    next[neighborId] = {
      ...neighbor,
      fronts,
      encounterEnemyCount: encounterEnemyCountFor(neighbor, fronts)
    };
  }
  return next;
}

function supplyRoutes(territories, controlledIds) {
  const controlled = new Set(controlledIds);
  const distances = new Map([["dawnwatch-sanctum", 0]]);
  const queue = ["dawnwatch-sanctum"];
  while (queue.length) {
    const currentId = queue.shift();
    const current = territories[currentId];
    if (!current) continue;
    for (const neighborId of Object.values(current.neighbors ?? {})) {
      if (!controlled.has(neighborId) || distances.has(neighborId)) continue;
      distances.set(neighborId, distances.get(currentId) + 1);
      queue.push(neighborId);
    }
  }
  return controlledIds
    .map((territoryId) => {
      const distance = distances.get(territoryId);
      const supplied = Number.isFinite(distance);
      const territory = territories[territoryId];
      const hostilePressure = Math.max(
        ...(territory?.fronts ?? [])
          .filter((front) => front.faction !== "player")
          .map((front) => Number(front.pressure ?? 0)),
        0
      );
      const contested = supplied && hostilePressure >= 0.85;
      const baseEfficiency = supplied ? Math.max(0.72, Number((1 - distance * 0.08).toFixed(3))) : 0.55;
      return {
        territoryId,
        status: contested ? "contested" : supplied ? "supplied" : "isolated",
        distance: supplied ? distance : null,
        hostilePressure: Number(hostilePressure.toFixed(3)),
        efficiency: contested ? Number((baseEfficiency * 0.5).toFixed(3)) : baseEfficiency
      };
    })
    .filter((route) => territories[route.territoryId]);
}

function tradeRoutesFor(territories, routes) {
  return routes
    .filter((route) => route.territoryId !== "dawnwatch-sanctum")
    .map((route) => {
      const territory = territories[route.territoryId];
      const resource = Object.entries(territory?.economy ?? {})
        .sort((left, right) => Number(right[1]) - Number(left[1]))[0]?.[0] ?? "gold";
      return {
        id: `${route.territoryId}->dawnwatch-sanctum`,
        territoryId: route.territoryId,
        destinationId: "dawnwatch-sanctum",
        resource,
        status: route.status,
        efficiency: Number(route.efficiency ?? 0),
        capacity: Math.max(0, Math.floor(10 * Number(route.efficiency ?? 0)))
      };
    });
}

/**
 * Return the bounded set of territory descriptors that Core World should
 * hydrate around the hero. The complete graph remains deterministic and
 * serializable, but only this active window is eligible for full simulation
 * and rich Three.js presentation.
 */
export function activeRegionIds(territories, currentTerritoryId, radius = 2) {
  const current = territories[currentTerritoryId];
  if (!current) return [];
  const limit = Math.max(0, Number(radius) || 0);
  return Object.values(territories)
    .filter((territory) => {
      const distance = Math.hypot(
        Number(territory.coordinates?.x ?? 0) - Number(current.coordinates?.x ?? 0),
        Number(territory.coordinates?.z ?? 0) - Number(current.coordinates?.z ?? 0)
      );
      return distance <= limit;
    })
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((territory) => territory.id);
}

export function heroUnlocksForLevel(level) {
  const currentLevel = Math.max(1, Math.floor(Number(level) || 1));
  return [
    "scouting",
    ...(currentLevel >= 2 ? ["front-command"] : []),
    ...(currentLevel >= 3 ? ["hazard-sight"] : []),
    ...(currentLevel >= 4 ? ["rapid-march"] : []),
    ...(currentLevel >= 5 ? ["siege-command"] : [])
  ];
}

export function createDefaultWorldState(profile = {}) {
  const discoveredIds = Array.from(new Set([
    "dawnwatch-sanctum",
    ...(Array.isArray(profile.discoveredTerritoryIds) ? profile.discoveredTerritoryIds : [])
  ])).filter((id) => territoryById(id));
  const controlledIds = Array.from(new Set([
    "dawnwatch-sanctum",
    ...(Array.isArray(profile.controlledTerritoryIds) ? profile.controlledTerritoryIds : [])
  ])).filter((id) => territoryById(id));
  const currentTerritoryId = profile.currentSceneId === "sanctum"
    ? "dawnwatch-sanctum"
    : territoryById(profile.currentTerritoryId)?.id ?? "dawnwatch-sanctum";
  const discoveryRadius = Math.max(1, finite(profile.hero?.discoveryRadius, 2));
  const heroLevel = Math.max(1, Math.floor(finite(profile.hero?.level, 1)));
  const heroUnlocks = Array.from(new Set([
    ...heroUnlocksForLevel(heroLevel),
    ...(Array.isArray(profile.hero?.unlocks) ? profile.hero.unlocks.map(String) : [])
  ]));
  const territories = Object.fromEntries(
    TERRITORIES.map((territory) => [
      territory.id,
      territoryState(territory, discoveredIds, controlledIds)
    ])
  );
  const initialRoutes = supplyRoutes(territories, controlledIds);
  const initialTradeRoutes = tradeRoutesFor(territories, initialRoutes);
  const synchronizedTerritories = Object.fromEntries(Object.entries(territories).map(([id, territory]) => [
    id,
    { ...territory, supplyEfficiency: initialRoutes.find((route) => route.territoryId === id)?.efficiency ?? 0 }
  ]));
  const economy = {
    schema: "battle-clash.economy/1",
    resources: {
      gold: finite(profile.economy?.resources?.gold, 120),
      food: finite(profile.economy?.resources?.food, 80),
      iron: finite(profile.economy?.resources?.iron, 35),
      arcane: finite(profile.economy?.resources?.arcane, 0)
    },
    storage: { gold: 500, food: 500, iron: 300, arcane: 200 },
    upkeep: { food: 0, gold: 0 },
    rates: { gold: 0, food: 0, iron: 0, arcane: 0 },
    tradeRoutes: initialTradeRoutes,
    lastTrade: profile.economy?.lastTrade ?? null,
    lastTick: finite(profile.economy?.lastTick, 0)
  };
  const initialState = {
    schema: "battle-clash.world/1",
    seed: WORLD_MAP_SEED,
    grid: { ...TERRITORY_GRID },
    revision: finite(profile.revision, 1),
    currentSceneId: profile.currentSceneId === "territory"
      ? sceneForTerritory(currentTerritoryId)
      : profile.currentSceneId ?? sceneForTerritory(currentTerritoryId),
    currentTerritoryId,
    activeRegionIds: activeRegionIds(territories, currentTerritoryId, discoveryRadius),
    discoveredTerritoryIds: discoveredIds,
    controlledTerritoryIds: controlledIds,
    lastClaimReward: profile.lastClaimReward ?? null,
    lastSanctumReturn: profile.lastSanctumReturn ?? null,
    landmarkInteractions: profile.landmarkInteractions ? structuredClone(profile.landmarkInteractions) : {},
    lastLandmarkInteraction: profile.lastLandmarkInteraction ?? null,
    lastHeroDiscovery: profile.lastHeroDiscovery ?? null,
    factions: factionSummary(synchronizedTerritories),
    factionStrategy: factionStrategy(synchronizedTerritories, activeRegionIds(territories, currentTerritoryId, discoveryRadius)),
    frontier: {
      schema: "battle-clash.frontier/1",
      clock: finite(profile.frontier?.clock, 0),
      alerts: Array.isArray(profile.frontier?.alerts) ? [...profile.frontier.alerts] : [],
      simulatedTerritoryCount: activeRegionIds(synchronizedTerritories, currentTerritoryId, discoveryRadius).length
    },
    territories: synchronizedTerritories,
    supplyRoutes: initialRoutes,
    unlocks: controlledIds.includes("dawnwatch-sanctum") ? ["sanctum", "recruitment", "scouting"] : [],
    hero: {
      id: "hero-ember",
      name: profile.hero?.name ?? "Ember",
      territoryId: currentTerritoryId,
      position: {
        x: finite(profile.hero?.position?.x, 50),
        z: finite(profile.hero?.position?.z, 50)
      },
      route: profile.hero?.route ? structuredClone(profile.hero.route) : null,
      worldRoute: profile.hero?.worldRoute ? structuredClone(profile.hero.worldRoute) : null,
      level: heroLevel,
      discoveryRadius,
      unlocks: heroUnlocks
    },
    army: {
      schema: "battle-clash.army/1",
      power: Math.max(1, finite(profile.army?.power, 12)),
      supply: Math.max(0, finite(profile.army?.supply, 100)),
      capacity: Math.max(1, finite(profile.army?.capacity, 12)),
      unlockedArchetypes: Array.isArray(profile.army?.unlockedArchetypes) && profile.army.unlockedArchetypes.length
        ? [...new Set(profile.army.unlockedArchetypes)]
        : ["delver"],
      roster: Array.isArray(profile.army?.roster) && profile.army.roster.length
        ? profile.army.roster.map((unit) => ({ ...unit }))
        : [{ id: "delver-scouts", archetype: "delver", count: 4, level: 1 }]
    },
    sanctum: {
      schema: "battle-clash.sanctum/1",
      level: Math.max(1, Math.floor(finite(profile.sanctum?.level, 1))),
      upgradeCost: { gold: 100, iron: 20 },
      healingCost: { food: 12, gold: 8 },
      recruitmentCost: { food: 10, gold: 6 }
    },
    economy,
    landscape: structuredClone(
      territories[currentTerritoryId]?.landscape ?? landscapeForTerritory(currentTerritoryId, 0)
    )
  };
  initialState.buildings = createDefaultBuildingState(profile.buildings);
  return applyBuildingBonuses(initialState, initialState.buildings);
}

export function interactLandmark(state, landmarkId) {
  if (!isTerritorySceneId(state.currentSceneId)) {
    return { accepted: false, reason: "territory-required", state };
  }
  const territory = state.territories[state.currentTerritoryId];
  const landmark = territory?.landmarks?.find((candidate) => candidate.id === landmarkId);
  if (!landmark) return { accepted: false, reason: "unknown-landmark", state };
  const previous = state.landmarkInteractions?.[landmarkId] ?? { count: 0 };
  const firstInteraction = Number(previous.count ?? 0) === 0;
  const reward = landmark.kind === "resource"
    ? { [landmark.resource ?? "gold"]: firstInteraction ? 8 : 2 }
    : landmark.kind === "settlement"
      ? { gold: firstInteraction ? 5 : 1, food: firstInteraction ? 3 : 0 }
      : { arcane: firstInteraction ? 2 : 0 };
  const resources = { ...state.economy.resources };
  for (const [key, value] of Object.entries(reward)) {
    resources[key] = Math.min(state.economy.storage[key], Number(resources[key] ?? 0) + Number(value ?? 0));
  }
  const interactions = {
    ...(state.landmarkInteractions ?? {}),
    [landmarkId]: { count: Number(previous.count ?? 0) + 1, lastRevision: state.revision + 1 }
  };
  return {
    accepted: true,
    state: {
      ...state,
      revision: state.revision + 1,
      economy: { ...state.economy, resources },
      landmarkInteractions: interactions,
      lastLandmarkInteraction: {
        territoryId: state.currentTerritoryId,
        landmarkId,
        kind: landmark.kind,
        reward,
        firstInteraction,
        revision: state.revision + 1
      }
    }
  };
}

export function tradeResources(state, { from = "iron", to = "gold", amount = 0, routeId = null } = {}) {
  if (state.currentTerritoryId !== "dawnwatch-sanctum") {
    return { accepted: false, reason: "sanctum-required", state };
  }
  const units = Math.max(0, Math.floor(finite(amount)));
  const rates = { iron: { gold: 4 }, food: { gold: 2 }, gold: { food: 2 } };
  const baseExchange = rates[from]?.[to];
  const route = routeId
    ? (state.economy.tradeRoutes ?? []).find((candidate) => candidate.id === routeId)
    : null;
  if (routeId && (!route || route.status === "isolated" || route.capacity <= 0)) {
    return { accepted: false, reason: "trade-route-unavailable", state };
  }
  if (route && units > route.capacity) {
    return { accepted: false, reason: "trade-capacity-exceeded", state };
  }
  const exchange = route
    ? Math.max(1, Math.floor(baseExchange * route.efficiency))
    : baseExchange;
  if (!exchange || units <= 0 || state.economy.resources[from] < units) {
    return { accepted: false, reason: "invalid-trade", state };
  }
  const resources = {
    ...state.economy.resources,
    [from]: state.economy.resources[from] - units,
    [to]: Math.min(state.economy.storage[to], state.economy.resources[to] + units * exchange)
  };
  return {
    accepted: true,
    state: {
      ...state,
      revision: state.revision + 1,
      economy: {
        ...state.economy,
        resources,
        lastTrade: {
          routeId: route?.id ?? "sanctum-market",
          from,
          to,
          amount: units,
          exchange,
          revision: state.revision + 1
        }
      }
    }
  };
}

export function healArmy(state) {
  if (state.currentTerritoryId !== "dawnwatch-sanctum") {
    return { accepted: false, reason: "sanctum-required", state };
  }
  const cost = state.sanctum.healingCost;
  if (state.economy.resources.food < cost.food || state.economy.resources.gold < cost.gold) {
    return { accepted: false, reason: "insufficient-healing-resources", state };
  }
  return {
    accepted: true,
    state: {
      ...state,
      revision: state.revision + 1,
      army: { ...state.army, supply: state.army.capacity * 10 },
      economy: {
        ...state.economy,
        resources: {
          ...state.economy.resources,
          food: state.economy.resources.food - cost.food,
          gold: state.economy.resources.gold - cost.gold
        }
      }
    }
  };
}

export function recruitArmy(state, { archetype = "delver" } = {}) {
  if (state.currentTerritoryId !== "dawnwatch-sanctum") {
    return { accepted: false, reason: "sanctum-required", state };
  }
  const cost = state.sanctum.recruitmentCost;
  const selected = String(archetype || "delver");
  if (!state.army.unlockedArchetypes.includes(selected)) {
    return { accepted: false, reason: "archetype-locked", state };
  }
  const rosterCount = state.army.roster.reduce((sum, entry) => sum + Number(entry.count ?? 0), 0);
  if (rosterCount >= state.army.capacity) return { accepted: false, reason: "army-at-capacity", state };
  if (state.economy.resources.food < cost.food || state.economy.resources.gold < cost.gold) {
    return { accepted: false, reason: "insufficient-recruitment-resources", state };
  }
  const existing = state.army.roster.some((entry) => entry.archetype === selected);
  const roster = existing
    ? state.army.roster.map((entry) => entry.archetype === selected ? { ...entry, count: Number(entry.count ?? 0) + 1 } : entry)
    : [...state.army.roster, { id: `${selected}-cadre`, archetype: selected, count: 1, level: state.hero.level }];
  return {
    accepted: true,
    state: {
      ...state,
      revision: state.revision + 1,
      army: { ...state.army, roster, power: state.army.power + 1 },
      economy: {
        ...state.economy,
        resources: {
          ...state.economy.resources,
          food: state.economy.resources.food - cost.food,
          gold: state.economy.resources.gold - cost.gold
        }
      }
    }
  };
}

export function upgradeSanctum(state) {
  if (state.currentTerritoryId !== "dawnwatch-sanctum") {
    return { accepted: false, reason: "sanctum-required", state };
  }
  const cost = state.sanctum.upgradeCost;
  if (state.economy.resources.gold < cost.gold || state.economy.resources.iron < cost.iron) {
    return { accepted: false, reason: "insufficient-upgrade-resources", state };
  }
  const level = state.sanctum.level + 1;
  return {
    accepted: true,
    state: {
      ...state,
      revision: state.revision + 1,
      sanctum: {
        ...state.sanctum,
        level,
        upgradeCost: { gold: cost.gold + level * 35, iron: cost.iron + level * 8 }
      },
      economy: {
        ...state.economy,
        resources: {
          ...state.economy.resources,
          gold: state.economy.resources.gold - cost.gold,
          iron: state.economy.resources.iron - cost.iron
        }
      },
      unlocks: Array.from(new Set([...state.unlocks, "sanctum-upgrade", level >= 2 ? "veteran-delvers" : "recruitment"])),
      army: {
        ...state.army,
        capacity: state.army.capacity + 4,
        unlockedArchetypes: Array.from(new Set([
          ...(state.army.unlockedArchetypes ?? ["delver"]),
          ...(level >= 2 ? ["lancer"] : []),
          ...(level >= 3 ? ["arcanist"] : [])
        ]))
      }
    }
  };
}

export function discoverTerritory(state, territoryId) {
  const territory = territoryById(territoryId);
  if (!territory) return { accepted: false, reason: "unknown-territory", state };
  if (state.discoveredTerritoryIds.includes(territory.id)) return { accepted: true, duplicate: true, state };
  const current = state.territories[state.currentTerritoryId];
  const connected = current && Object.values(current.neighbors).includes(territory.id);
  if (!connected) return { accepted: false, reason: "territory-not-connected", state };
  const next = {
    ...state,
    revision: state.revision + 1,
    discoveredTerritoryIds: [...state.discoveredTerritoryIds, territory.id],
    territories: {
      ...state.territories,
      [territory.id]: { ...state.territories[territory.id], discovered: true }
    },
    supplyRoutes: supplyRoutes(state.territories, state.controlledTerritoryIds),
    unlocks: state.unlocks
  };
  return { accepted: true, state: next };
}

export function enterTerritory(state, territoryId) {
  if (!state.discoveredTerritoryIds.includes(territoryId)) {
    return { accepted: false, reason: "territory-undiscovered", state };
  }
  const next = {
    ...state,
    revision: state.revision + 1,
    currentTerritoryId: territoryId,
    currentSceneId: sceneForTerritory(territoryId),
    activeRegionIds: activeRegionIds(state.territories, territoryId, state.hero.discoveryRadius),
    hero: { ...state.hero, territoryId, position: { x: 50, z: 50 } },
    landscape: structuredClone(
      state.territories[territoryId]?.landscape ??
      landscapeForTerritory(territoryId, (state.territories[territoryId]?.landscapeRevision ?? 0))
    )
  };
  return { accepted: true, state: next };
}

export function changeLandscape(state, patch = {}) {
  const current = state.landscape ?? landscapeForTerritory(state.currentTerritoryId, 0);
  const nextLandscape = {
    ...current,
    territoryId: state.currentTerritoryId,
    revision: current.revision + 1,
    blockedCells: Array.from(new Set((patch.blockedCells ?? current.blockedCells).map(String))),
    hazards: structuredClone(patch.hazards ?? current.hazards)
  };
  return {
    ...state,
    revision: state.revision + 1,
    landscape: nextLandscape,
    territories: {
      ...state.territories,
      [state.currentTerritoryId]: {
        ...state.territories[state.currentTerritoryId],
        landscape: structuredClone(nextLandscape),
        landscapeRevision: nextLandscape.revision
      }
    }
  };
}

export function claimTerritory(state, territoryId, faction = "player") {
  if (!state.discoveredTerritoryIds.includes(territoryId)) {
    return { accepted: false, reason: "territory-undiscovered", state };
  }
  const current = state.territories[territoryId];
  if (!current) return { accepted: false, reason: "unknown-territory", state };
  const firstPlayerClaim = faction === "player" && current.ownerFaction !== "player" && !current.claimRewarded;
  const reward = firstPlayerClaim ? claimRewardFor(current) : { gold: 0, food: 0, iron: 0, arcane: 0 };
  const controlledIds = state.controlledTerritoryIds.filter((id) => id !== territoryId);
  if (faction === "player") controlledIds.push(territoryId);
  const resources = RESOURCE_KEYS.reduce((total, key) => {
    total[key] = Math.min(
      state.economy.storage[key],
      state.economy.resources[key] + Number(reward[key] ?? 0)
    );
    return total;
  }, {});
  const territories = {
    ...state.territories,
    [territoryId]: {
      ...current,
      ownerFaction: faction,
      controlled: faction === "player",
      controlRevision: current.controlRevision + 1,
      claimRewarded: current.claimRewarded || firstPlayerClaim,
      supplyEfficiency: faction === "player" ? 1 : 0,
      fronts: current.fronts.map((front) => ({
        ...front,
        pressure: faction === "player" && front.faction === "player"
          ? Math.max(0.05, Number(front.pressure ?? 0) * 0.35)
          : front.pressure
      })),
      encounterEnemyCount: Math.min(
        100,
        encounterEnemyCountFor(current, current.fronts) + (faction === "player" ? 1 : 2)
      ),
      unlocks: territoryUnlocksFor(current, faction === "player")
    }
  };
  const propagatedTerritories = propagateClaimPressure(territories, territoryId, faction);
  const routes = supplyRoutes(propagatedTerritories, controlledIds);
  const synchronizedTerritories = Object.fromEntries(Object.entries(propagatedTerritories).map(([id, territory]) => [
    id,
    { ...territory, supplyEfficiency: routes.find((route) => route.territoryId === id)?.efficiency ?? 0 }
  ]));
  const next = {
    ...state,
    revision: state.revision + 1,
    controlledTerritoryIds: controlledIds,
    territories: synchronizedTerritories,
    factions: factionSummary(synchronizedTerritories),
    factionStrategy: factionStrategy(synchronizedTerritories, state.activeRegionIds),
    economy: {
      ...state.economy,
      resources,
      tradeRoutes: tradeRoutesFor(synchronizedTerritories, routes)
    },
    army: faction === "player"
      ? {
          ...state.army,
          unlockedArchetypes: Array.from(new Set([
            ...(state.army.unlockedArchetypes ?? ["delver"]),
            ...(current.kind === "dungeon" ? ["arcanist"] : []),
            ...(current.kind === "stronghold" ? ["lancer"] : [])
          ]))
        }
      : state.army,
    lastClaimReward: firstPlayerClaim ? { territoryId, resources: reward } : state.lastClaimReward ?? null,
    supplyRoutes: routes,
    unlocks: faction === "player"
      ? Array.from(new Set([
          ...state.unlocks,
          ...territoryUnlocksFor(current, true)
        ]))
      : state.unlocks
  };
  return { accepted: true, state: next };
}

export function moveHero(state, position, route = null) {
  const x = Math.max(0, Math.min(TERRITORY_GRID.width - 1, finite(position?.x, state.hero.position.x)));
  const z = Math.max(0, Math.min(TERRITORY_GRID.height - 1, finite(position?.z, state.hero.position.z)));
  const current = state.territories[state.currentTerritoryId];
  const border = [
    ["east", x >= TERRITORY_GRID.width - 1],
    ["west", x <= 1],
    ["north", z >= TERRITORY_GRID.height - 1],
    ["south", z <= 1]
  ].find(([, reached]) => reached);
  const neighborId = border ? current?.neighbors?.[border[0]] : null;
  const shouldDiscover = neighborId && !state.discoveredTerritoryIds.includes(neighborId);
  const discoveredTerritoryIds = shouldDiscover
    ? [...state.discoveredTerritoryIds, neighborId]
    : state.discoveredTerritoryIds;
  const territories = shouldDiscover
    ? {
        ...state.territories,
        [neighborId]: { ...state.territories[neighborId], discovered: true }
      }
    : state.territories;
  return {
    ...state,
    revision: state.revision + 1,
    hero: {
      ...state.hero,
      position: { x, z },
      route: route?.status === "resolved"
        ? {
            status: "resolved",
            pathLength: Number(route.pathLength ?? route.points?.length ?? 0),
            points: (route.points ?? []).map((point) => ({ x: Number(point.x), z: Number(point.z) })),
            target: { x, z },
            revision: state.revision + 1
          }
        : state.hero.route ?? null
    },
    discoveredTerritoryIds,
    territories,
    lastHeroDiscovery: shouldDiscover
      ? { territoryId: neighborId, direction: border[0], revision: state.revision + 1 }
      : state.lastHeroDiscovery ?? null
  };
}

function advanceFrontier(state, delta) {
  const amount = Math.max(0, finite(delta));
  if (amount <= 0) return state;
  const active = new Set(state.activeRegionIds ?? []);
  const territories = Object.fromEntries(Object.entries(state.territories).map(([id, territory]) => {
    if (active.size && !active.has(id)) return [id, territory];
    const adjacentToPlayer = state.controlledTerritoryIds.some((controlledId) =>
      controlledId !== id && Object.values(state.territories[controlledId]?.neighbors ?? {}).includes(id)
    );
    const fronts = territory.fronts.map((front) => {
      const faction = String(front.faction ?? "neutral");
      const isPlayerFront = faction === "player";
      const deltaPressure = isPlayerFront
        ? (territory.controlled ? -0.004 : adjacentToPlayer ? -0.0015 : 0)
        : (territory.controlled ? 0.0025 : 0.001) * amount;
      const pressure = Math.max(0.02, Math.min(0.98, Number(front.pressure ?? 0) + deltaPressure * (isPlayerFront ? amount : 1)));
      return { ...front, pressure: Number(pressure.toFixed(3)) };
    });
    const maxPressure = fronts.reduce((max, front) => Math.max(max, Number(front.pressure ?? 0)), 0);
    return [id, {
      ...territory,
      fronts,
      encounterEnemyCount: encounterEnemyCountFor(territory, fronts)
    }];
  }));
  const alerts = Object.values(territories)
    .filter((territory) => territory.discovered && territory.fronts.some((front) => Number(front.pressure ?? 0) >= 0.7))
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, 8)
    .map((territory) => territory.id);
  return {
    ...state,
    territories,
    factions: factionSummary(territories),
    factionStrategy: factionStrategy(territories, Array.from(active)),
    frontier: {
      ...(state.frontier ?? { schema: "battle-clash.frontier/1", clock: 0 }),
      clock: Number(((state.frontier?.clock ?? 0) + amount).toFixed(3)),
      alerts,
      simulatedTerritoryCount: active.size || Object.keys(territories).length
    }
  };
}

export function tickEconomy(state, deltaSeconds) {
  const delta = Math.max(0, finite(deltaSeconds));
  const advanced = advanceFrontier(state, delta);
  const routes = supplyRoutes(advanced.territories, advanced.controlledTerritoryIds);
  const territorySource = Object.fromEntries(Object.entries(advanced.territories).map(([id, territory]) => [
    id,
    { ...territory, supplyEfficiency: routes.find((route) => route.territoryId === id)?.efficiency ?? 0 }
  ]));
  const frontierState = {
    ...advanced,
    territories: territorySource,
    supplyRoutes: routes,
    factions: factionSummary(territorySource),
    factionStrategy: factionStrategy(territorySource, advanced.activeRegionIds),
    economy: {
      ...advanced.economy,
      tradeRoutes: tradeRoutesFor(territorySource, routes)
    }
  };
  const rates = RESOURCE_KEYS.reduce((total, key) => {
    total[key] = frontierState.controlledTerritoryIds.reduce((sum, id) => {
      const route = frontierState.supplyRoutes?.find((item) => item.territoryId === id);
      return sum + finite(territorySource[id]?.economy?.[key]) * productionMultiplier(territorySource[id]) * Number(route?.efficiency ?? 1);
    }, 0) / 60;
    if (key === "iron") total[key] *= 1 + finite(frontierState.buildings?.bonuses?.ironProduction);
    return total;
  }, {});
  const rosterCount = state.army.roster.reduce((sum, unit) => sum + Number(unit.count ?? 0), 0);
  const upkeep = { food: rosterCount * 0.03, gold: rosterCount * 0.01 };
  const resources = RESOURCE_KEYS.reduce((total, key) => {
    const cost = key === "food" ? upkeep.food * delta : key === "gold" ? upkeep.gold * delta : 0;
    total[key] = Math.max(0, Math.min(frontierState.economy.storage[key], frontierState.economy.resources[key] + rates[key] * delta - cost));
    return total;
  }, {});
  const capacity = 12
    + Math.max(0, frontierState.controlledTerritoryIds.length - 1) * 2
    + Math.max(0, frontierState.sanctum.level - 1) * 4
    + finite(frontierState.buildings?.bonuses?.armyCapacity);
  const roster = frontierState.army.roster.map((unit) => ({ ...unit }));
  const recruits = resources.food >= 10
    ? Math.max(0, Math.floor((frontierState.economy.lastTick + delta) / 30) - Math.floor(frontierState.economy.lastTick / 30))
    : 0;
  if (roster[0] && recruits > 0) {
    roster[0].count = Math.min(capacity, Number(roster[0].count ?? 0) + recruits);
    roster[0].level = Math.max(Number(roster[0].level ?? 1), frontierState.hero.level);
  }
  return {
    ...frontierState,
    army: {
      ...frontierState.army,
      capacity,
      roster,
      power: Math.max(frontierState.army.power, roster.reduce((sum, unit) => sum + Number(unit.count ?? 0) * Math.max(1, Number(unit.level ?? 1)), 0)),
      supply: Math.min(capacity * 10, state.army.supply + recruits * 4)
    },
    economy: {
      ...frontierState.economy,
      resources,
      rates,
      upkeep,
      lastTick: state.economy.lastTick + delta
    }
  };
}
