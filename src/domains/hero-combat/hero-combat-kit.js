import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { Components, Events, Resources } from "../shared/definitions.js";
import { identityOf, isAlive } from "../shared/entity-factory.js";

function command(world) {
  return world.getResource(Resources.CommandQueue);
}

function heroAbilitySystem(world) {
  const raid = world.getResource(Resources.RaidState);
  const ability = world.getResource(Resources.AbilityState);
  const request = command(world).heroAbility;
  const delta = Number(world.__nexusClock?.delta ?? 0);
  const cooldownRemaining = Math.max(0, Number(ability.cooldownRemaining ?? 0) - delta);
  world.setResource(Resources.AbilityState, { ...ability, cooldownRemaining });
  if (raid.phase !== "active" || !request || cooldownRemaining > 0) return;

  const hero = world.query(Components.HeroCombat, Components.Position, Components.Health)
    .find((entity) => isAlive(world, entity));
  if (!hero) return;
  const origin = world.getComponent(hero, Components.Position);
  const target = world.query(Components.Building, Components.Health, Components.Position)
    .filter((entity) => isAlive(world, entity))
    .sort((left, right) => {
      const a = world.getComponent(left, Components.Position);
      const b = world.getComponent(right, Components.Position);
      return Math.hypot(a.x - origin.x, a.z - origin.z) - Math.hypot(b.x - origin.x, b.z - origin.z);
    })[0];
  if (!target) return;

  const targetHealth = world.getComponent(target, Components.Health);
  const heroCombat = world.getComponent(hero, Components.HeroCombat);
  const damage = Number(heroCombat.abilityDamage ?? 0);
  world.setComponent(target, Components.Health, {
    ...targetHealth,
    current: Math.max(0, targetHealth.current - damage)
  });
  const targetPosition = world.getComponent(target, Components.Position);
  const effects = world.getResource(Resources.EffectsState);
  world.setResource(Resources.EffectsState, {
    serial: effects.serial + 1,
    items: [...effects.items, {
      id: `hero-ability-${effects.serial + 1}`,
      type: "hero-ability-burst",
      from: structuredClone(origin),
      to: structuredClone(targetPosition),
      faction: "player",
      duration: 0.55,
      remaining: 0.55
    }].slice(-40)
  });
  world.setResource(Resources.AbilityState, {
    ...world.getResource(Resources.AbilityState),
    cooldownRemaining: Number(heroCombat.abilityCooldown ?? 8),
    uses: Number(world.getResource(Resources.AbilityState).uses ?? 0) + 1,
    lastUseFrame: world.__nexusClock?.frame ?? 0
  });
  world.setResource(Resources.CommandQueue, { ...command(world), heroAbility: null });
  world.emit(Events.AbilityUsed, {
    abilityId: heroCombat.abilityId,
    heroId: identityOf(world, hero)?.id,
    targetId: identityOf(world, target)?.id,
    damage
  });
}

export function createHeroCombatKit() {
  return defineDomainServiceKit({
    id: "battle-clash-hero-combat-kit",
    domain: "battle-clash-hero-combat",
    domainPath: "n:game:battle-clash:hero-combat",
    parentDomainPath: "n:game:battle-clash",
    apiName: "battleClashHeroCombat",
    stability: "experimental",
    version: "0.1.0",
    provides: ["n:game:battle-clash:hero-combat"],
    requires: ["n:game:battle-clash", "n:game:battle-clash:combat", "n:simulation"],
    services: ["hero-combat", "ability-cooldowns"],
    systems: [{ phase: "input", name: "battleClashHeroAbilitySystem", system: heroAbilitySystem }],
    metadata: {
      owns: ["hero combat abilities", "hero ability cooldowns"],
      doesNotOwn: ["hero strategic movement", "enemy targeting", "Three.js presentation"]
    }
  });
}
