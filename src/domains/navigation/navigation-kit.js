import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { Components, Resources } from "../shared/definitions.js";
import { isAlive } from "../shared/entity-factory.js";

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

    const travel = Math.min(distance - stopDistance, movement.speed * delta);
    world.setComponent(entity, Components.Position, {
      ...position,
      x: position.x + (dx / distance) * travel,
      z: position.z + (dz / distance) * travel
    });
    world.setComponent(entity, Components.Movement, {
      ...movement,
      state: "moving"
    });
  }
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
