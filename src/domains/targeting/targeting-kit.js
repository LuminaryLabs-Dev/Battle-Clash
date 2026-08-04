import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { Components, Events, Resources } from "../shared/definitions.js";
import { identityOf, isAlive, positionOf } from "../shared/entity-factory.js";

function distanceBetween(world, a, b) {
  const left = positionOf(world, a);
  const right = positionOf(world, b);
  return left && right ? Math.hypot(left.x - right.x, left.z - right.z) : Infinity;
}

function selectTroopTarget(world, troop) {
  let selected = null;
  let selectedScore = Infinity;
  for (const target of world.query(
    Components.Building,
    Components.Health,
    Components.Position,
    Components.Identity
  )) {
    if (!isAlive(world, target)) continue;
    const building = world.getComponent(target, Components.Building);
    const score = distanceBetween(world, troop, target) + Number(building.targetBias ?? 0);
    if (score < selectedScore) {
      selected = target;
      selectedScore = score;
    }
  }
  return selected;
}

function selectDefenseTarget(world, defense) {
  const attack = world.getComponent(defense, Components.Attack);
  let selected = null;
  let selectedDistance = Infinity;
  for (const target of world.query(
    Components.Troop,
    Components.Health,
    Components.Position
  )) {
    if (!isAlive(world, target)) continue;
    const distance = distanceBetween(world, defense, target);
    if (distance <= attack.range && distance < selectedDistance) {
      selected = target;
      selectedDistance = distance;
    }
  }
  return selected;
}

function targetingSystem(world) {
  const raid = world.getResource(Resources.RaidState);
  if (raid.phase !== "active") return;

  for (const entity of world.query(
    Components.Targeting,
    Components.Position,
    Components.Health
  )) {
    if (!isAlive(world, entity)) continue;
    const current = world.getComponent(entity, Components.Targeting);
    const isTroop = world.hasComponent(entity, Components.Troop);
    const isDefense = world.hasComponent(entity, Components.Defense);
    if (!isTroop && !isDefense) continue;

    const target = isTroop
      ? selectTroopTarget(world, entity)
      : selectDefenseTarget(world, entity);
    const targetIdentity = target ? identityOf(world, target) : null;
    if (current.entity === target) continue;

    world.setComponent(entity, Components.Targeting, {
      ...current,
      entity: target,
      targetId: targetIdentity?.id ?? null
    });
    if (target) {
      world.emit(Events.TargetAcquired, {
        entityId: identityOf(world, entity)?.id,
        targetId: targetIdentity.id
      });
    }
  }
}

export function createTargetingKit() {
  return defineDomainServiceKit({
    id: "battle-clash-nearest-priority-target-kit",
    domain: "battle-clash-targeting",
    domainPath: "n:game:battle-clash:targeting",
    parentDomainPath: "n:game:battle-clash",
    apiName: "battleClashTargeting",
    stability: "experimental",
    version: "0.1.0",
    provides: ["n:game:battle-clash:targeting"],
    requires: [
      "n:game:battle-clash",
      "n:game:battle-clash:world",
      "n:spatial"
    ],
    services: ["candidate-selection", "target-priority"],
    systems: [
      {
        phase: "simulate",
        name: "battleClashTargetingSystem",
        system: targetingSystem
      }
    ],
    metadata: {
      owns: ["target candidates", "target priorities", "target selection"],
      doesNotOwn: ["movement", "damage", "render highlights"]
    }
  });
}
