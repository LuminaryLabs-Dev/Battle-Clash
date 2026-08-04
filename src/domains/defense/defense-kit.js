import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { Components, Events, Resources } from "../shared/definitions.js";
import { identityOf } from "../shared/entity-factory.js";

function fortificationSystem(world) {
  const commands = world.getResource(Resources.CommandQueue);
  if (!commands.fortify) return;

  world.setResource(Resources.CommandQueue, {
    ...commands,
    fortify: false
  });

  const raid = world.getResource(Resources.RaidState);
  const defense = world.getResource(Resources.DefenseState);
  if (raid.phase !== "active" || defense.wardCharges <= 0) return;

  const core = world
    .query(Components.Identity, Components.Health)
    .find((entity) => identityOf(world, entity)?.role === "core");
  if (!core) return;

  const health = world.getComponent(core, Components.Health);
  if (health.current >= health.maximum) return;

  const restored = Math.min(
    health.maximum,
    health.current + Math.round(health.maximum * 0.32)
  );
  world.setComponent(core, Components.Health, {
    ...health,
    current: restored
  });
  const frame = world.__nexusClock?.frame ?? 0;
  world.setResource(Resources.DefenseState, {
    ...defense,
    wardCharges: defense.wardCharges - 1,
    wardsUsed: defense.wardsUsed + 1,
    lastFortifiedFrame: frame
  });
  world.emit(Events.DefenseFortified, {
    frame,
    restored: restored - health.current
  });
}

export function createDefenseKit() {
  return defineDomainServiceKit({
    id: "battle-clash-dungeon-defense-kit",
    domain: "battle-clash-defense",
    domainPath: "n:game:battle-clash:defense",
    parentDomainPath: "n:game:battle-clash",
    apiName: "battleClashDefense",
    stability: "experimental",
    version: "0.1.0",
    provides: ["n:game:battle-clash:defense"],
    requires: [
      "n:game:battle-clash",
      "n:game:battle-clash:combat",
      "n:simulation"
    ],
    services: ["dungeon-ward", "defender-command"],
    systems: [
      {
        phase: "input",
        name: "battleClashFortificationSystem",
        system: fortificationSystem
      }
    ],
    createApi({ world }) {
      return {
        getState: () =>
          structuredClone(world.getResource(Resources.DefenseState))
      };
    },
    metadata: {
      owns: ["defender ward charges", "dungeon fortification command"],
      doesNotOwn: ["PeerJS role assignment", "generic damage", "renderer effects"]
    }
  });
}
