import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { Components, Events, Resources } from "../shared/definitions.js";
import { identityOf, isAlive } from "../shared/entity-factory.js";

function appendEffect(world, from, to, faction) {
  const effects = world.getResource(Resources.EffectsState);
  const serial = effects.serial + 1;
  const item = {
    id: `impact-${serial}`,
    from: structuredClone(from),
    to: structuredClone(to),
    faction,
    duration: 0.22,
    remaining: 0.22
  };
  world.setResource(Resources.EffectsState, {
    serial,
    items: [...effects.items, item].slice(-40)
  });
}

function tickEffects(world, delta) {
  const effects = world.getResource(Resources.EffectsState);
  const items = effects.items
    .map((item) => ({ ...item, remaining: item.remaining - delta }))
    .filter((item) => item.remaining > 0);
  world.setResource(Resources.EffectsState, {
    ...effects,
    items
  });
}

function combatSystem(world) {
  const delta = Number(world.__nexusClock?.delta ?? 0);
  tickEffects(world, delta);

  const raid = world.getResource(Resources.RaidState);
  if (raid.phase !== "active") return;

  for (const entity of world.query(
    Components.Attack,
    Components.Targeting,
    Components.Position,
    Components.Faction,
    Components.Health
  )) {
    if (!isAlive(world, entity)) continue;
    const attack = world.getComponent(entity, Components.Attack);
    const nextRemaining = Math.max(0, attack.remaining - delta);
    const target = world.getComponent(entity, Components.Targeting).entity;

    if (!target || !isAlive(world, target)) {
      world.setComponent(entity, Components.Attack, {
        ...attack,
        remaining: nextRemaining
      });
      continue;
    }

    const from = world.getComponent(entity, Components.Position);
    const to = world.getComponent(target, Components.Position);
    const footprint = world.getComponent(target, Components.Footprint);
    const distance = Math.hypot(from.x - to.x, from.z - to.z);
    const hitRange = attack.range + Number(footprint?.radius ?? 0.5) * 0.68;

    if (nextRemaining > 0 || distance > hitRange) {
      world.setComponent(entity, Components.Attack, {
        ...attack,
        remaining: nextRemaining
      });
      continue;
    }

    const health = world.getComponent(target, Components.Health);
    const nextHealth = Math.max(0, health.current - attack.damage);
    world.setComponent(target, Components.Health, {
      ...health,
      current: nextHealth
    });
    world.setComponent(entity, Components.Attack, {
      ...attack,
      remaining: attack.cooldown
    });

    const faction = world.getComponent(entity, Components.Faction).id;
    appendEffect(world, from, to, faction);
    world.emit(Events.AttackResolved, {
      attackerId: identityOf(world, entity)?.id,
      targetId: identityOf(world, target)?.id,
      damage: attack.damage,
      remainingHealth: nextHealth
    });
  }
}

function destructionSystem(world) {
  const raid = world.getResource(Resources.RaidState);
  let destroyed = raid.destroyed;
  for (const entity of world.query(Components.Identity, Components.Health)) {
    const health = world.getComponent(entity, Components.Health);
    if (health.current > 0) continue;
    const identity = identityOf(world, entity);
    world.emit(Events.EntityDestroyed, {
      id: identity.id,
      category: identity.category,
      role: identity.role
    });
    if (identity.category === "building") destroyed += 1;
    world.removeEntity(entity);
  }
  if (destroyed !== raid.destroyed) {
    world.setResource(Resources.RaidState, {
      ...world.getResource(Resources.RaidState),
      destroyed
    });
  }
}

export function createCombatKit() {
  return defineDomainServiceKit({
    id: "battle-clash-damage-resolution-kit",
    domain: "battle-clash-combat",
    domainPath: "n:game:battle-clash:combat",
    parentDomainPath: "n:game:battle-clash",
    apiName: "battleClashCombat",
    stability: "experimental",
    version: "0.1.0",
    requires: [
      "n:game:battle-clash",
      "n:game:battle-clash:targeting",
      "n:game:battle-clash:navigation",
      "n:core-simulation"
    ],
    services: ["health", "attack-cooldown", "damage-resolution", "destruction"],
    systems: [
      {
        phase: "resolve",
        name: "battleClashCombatSystem",
        system: combatSystem
      },
      {
        phase: "cleanup",
        name: "battleClashDestructionSystem",
        system: destructionSystem
      }
    ],
    metadata: {
      owns: ["health", "attack cooldowns", "damage resolution", "destruction receipts"],
      doesNotOwn: ["target policy", "raid victory", "render effects"]
    }
  });
}
