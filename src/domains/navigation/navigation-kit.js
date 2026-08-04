import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { createAStarPathfinder } from "nexusengine";
import { Components, Resources } from "../shared/definitions.js";
import { identityOf, isAlive } from "../shared/entity-factory.js";

function navigationSystem(world) {
  const raid = world.getResource(Resources.RaidState);
  if (raid.phase !== "active") return;

  const delta = Number(world.__nexusClock?.delta ?? 0);
  for (const entity of world.query(
    Components.Troop,
    Components.Position,
    Components.Movement,
    Components.Targeting,
    Components.Attack,
    Components.Health
  )) {
    if (!isAlive(world, entity)) continue;
    const target = world.getComponent(entity, Components.Targeting).entity;
    if (!target || !isAlive(world, target)) continue;

    const position = world.getComponent(entity, Components.Position);
    const movement = world.getComponent(entity, Components.Movement);
    const attack = world.getComponent(entity, Components.Attack);
    const targetPosition = world.getComponent(target, Components.Position);
    const targetFootprint = world.getComponent(target, Components.Footprint);
    const dx = targetPosition.x - position.x;
    const dz = targetPosition.z - position.z;
    const distance = Math.hypot(dx, dz);
    const stopDistance = attack.range + Number(targetFootprint?.radius ?? 0.5) * 0.68;

    if (distance <= stopDistance) {
      if (movement.state !== "attacking") {
        world.setComponent(entity, Components.Movement, {
          ...movement,
          state: "attacking"
        });
      }
      continue;
    }

    const route = combatPath(world, entity, target);
    const waypoint = route.status === "resolved" && route.points.length > 1
      ? route.points[1]
      : targetPosition;
    const waypointDx = waypoint.x - position.x;
    const waypointDz = waypoint.z - position.z;
    const waypointDistance = Math.hypot(waypointDx, waypointDz) || 1;
    const travel = Math.min(waypointDistance, movement.speed * delta);
    world.setComponent(entity, Components.Position, {
      ...position,
      x: position.x + (waypointDx / waypointDistance) * travel,
      z: position.z + (waypointDz / waypointDistance) * travel
    });
    world.setComponent(entity, Components.Movement, {
      ...movement,
      state: "moving",
      pathStatus: route.status,
      pathLength: route.pathLength ?? route.points?.length ?? 0
    });
  }
}

function combatPath(world, entity, target) {
  const step = 0.5;
  const extent = 12;
  const size = Math.round((extent * 2) / step) + 1;
  const obstacles = world.query(Components.Identity, Components.Position, Components.Footprint)
    .filter((candidate) => candidate !== target && candidate !== entity)
    .filter((candidate) => {
      const identity = identityOf(world, candidate);
      if (identity?.category === "scenery") return identity.role === "wall";
      return world.hasComponent(candidate, Components.Health) && isAlive(world, candidate);
    })
    .map((candidate) => ({
      position: world.getComponent(candidate, Components.Position),
      radius: Number(world.getComponent(candidate, Components.Footprint)?.radius ?? 0.6) + step * 0.7
    }));
  const adapter = {
    mode: "combat-grid-astar",
    key: (node) => `${node.x},${node.z}`,
    point: (node) => ({ x: node.x * step - extent, z: node.z * step - extent }),
    nodeFromPoint: (point) => ({
      x: Math.max(0, Math.min(size - 1, Math.round((Number(point?.x ?? 0) + extent) / step))),
      z: Math.max(0, Math.min(size - 1, Math.round((Number(point?.z ?? 0) + extent) / step)))
    }),
    equals: (left, right) => left.x === right.x && left.z === right.z,
    walkable: (node) => {
      if (node.x < 0 || node.x >= size || node.z < 0 || node.z >= size) return false;
      const point = adapter.point(node);
      return !obstacles.some((obstacle) => Math.hypot(point.x - obstacle.position.x, point.z - obstacle.position.z) < obstacle.radius);
    },
    neighbors: (node) => [
      { x: node.x + 1, z: node.z },
      { x: node.x - 1, z: node.z },
      { x: node.x, z: node.z + 1 },
      { x: node.x, z: node.z - 1 }
    ],
    cost: () => 1
  };
  const start = adapter.nodeFromPoint(world.getComponent(entity, Components.Position));
  const goal = adapter.nodeFromPoint(world.getComponent(target, Components.Position));
  const route = createAStarPathfinder({ adapter }).findPath({ start, goal });
  return {
    ...route,
    obstacleCount: obstacles.length
  };
}

function gridPath(start, goal, landscape = {}, hero = {}) {
  const width = landscape.grid?.width ?? 100;
  const height = landscape.grid?.height ?? 100;
  const blocked = new Set(landscape.blockedCells ?? []);
  const hazards = new Set((landscape.hazards ?? []).map((hazard) => `${hazard.x},${hazard.z}`));
  const hazardCost = hero.unlocks?.includes("rapid-march")
    ? 1
    : hero.unlocks?.includes("hazard-sight")
      ? 1.25
      : 2.5;
  const adapter = {
    mode: "grid",
    key: (node) => `${node.x},${node.y}`,
    point: (node) => ({ x: node.x, z: node.y }),
    nodeFromPoint: (point) => ({
      x: Math.max(0, Math.min(width - 1, Math.round(Number(point?.x ?? 0)))),
      y: Math.max(0, Math.min(height - 1, Math.round(Number(point?.z ?? point?.y ?? 0))))
    }),
    equals: (left, right) => left.x === right.x && left.y === right.y,
    walkable: (node) => node.x >= 0 && node.x < width && node.y >= 0 && node.y < height && !blocked.has(`${node.x},${node.y}`),
    neighbors: (node) => [
      { x: node.x + 1, y: node.y },
      { x: node.x - 1, y: node.y },
      { x: node.x, y: node.y + 1 },
      { x: node.x, y: node.y - 1 }
    ].filter((candidate) => candidate.x >= 0 && candidate.x < width && candidate.y >= 0 && candidate.y < height),
    cost: (_from, to) => hazards.has(`${to.x},${to.y}`) ? hazardCost : 1
  };
  return createAStarPathfinder({ adapter }).findPath({ start, goal });
}

function worldPath(startId, goalId, worldState = {}) {
  const territories = worldState.territories ?? {};
  const adapter = {
    mode: "world-astar",
    key: (node) => node.id,
    nodeFromPoint: (point) => territories[point?.id] ?? null,
    point: (node) => node.id,
    equals: (left, right) => left.id === right.id,
    walkable: (node) => Boolean(territories[node.id]),
    neighbors: (node) => Object.values(node.neighbors ?? {}).map((id) => territories[id]).filter(Boolean),
    cost: (from, to) => {
      const route = worldState.supplyRoutes?.find((entry) => entry.territoryId === to.id);
      const pressure = Math.max(...(to.fronts ?? []).map((front) => Number(front.pressure ?? 0)), 0);
      return (route?.status === "isolated" ? 2 : route?.status === "contested" ? 2.5 : 1) + pressure * 1.5;
    }
  };
  return createAStarPathfinder({ adapter }).findPath({
    start: { id: startId },
    goal: { id: goalId }
  });
}

export function createNavigationKit() {
  return defineDomainServiceKit({
    id: "battle-clash-direct-path-follow-kit",
    domain: "battle-clash-navigation",
    domainPath: "n:game:battle-clash:navigation",
    parentDomainPath: "n:game:battle-clash",
    apiName: "battleClashNavigation",
    stability: "experimental",
    version: "0.1.0",
    requires: [
      "n:game:battle-clash",
      "n:game:battle-clash:targeting",
      "n:core-spatial"
    ],
    services: ["movement-intent", "direct-path-follow"],
    createApi({ engine }) {
      return {
        findPath(start, goal) {
          return gridPath(
            start,
            goal,
            engine.world.getResource(Resources.LandscapeState),
            engine.world.getResource(Resources.HeroState)
          );
        },
        findWorldPath(startId, goalId) {
          return worldPath(startId, goalId, engine.world.getResource(Resources.WorldState));
        },
        findCombatPath() {
          const startEntity = engine.world.query(Components.Troop, Components.Position)[0];
          const targetEntity = engine.world.query(Components.Building, Components.Position)[0];
          if (!startEntity || !targetEntity) return { status: "unresolved", points: [] };
          return combatPath(engine.world, startEntity, targetEntity);
        }
      };
    },
    systems: [
      {
        phase: "simulate",
        name: "battleClashNavigationSystem",
        system: navigationSystem
      }
    ],
    metadata: {
      owns: ["movement intent", "direct greybox paths", "arrival state"],
      doesNotOwn: ["target selection", "damage", "Three.js interpolation"]
    }
  });
}
