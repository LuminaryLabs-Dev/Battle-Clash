import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { Resources } from "../shared/definitions.js";

function boundary({ id, domain, path, apiName, services, owns, read }) {
  return defineDomainServiceKit({
    id,
    domain,
    domainPath: path,
    parentDomainPath: "n:game:battle-clash",
    apiName,
    stability: "experimental",
    version: "0.1.0",
    requires: ["n:game:battle-clash", "n:world", "n:core-simulation"],
    services,
    createApi({ engine }) {
      return {
        getState() {
          return read(engine);
        }
      };
    },
    metadata: {
      owns,
      doesNotOwn: ["Three.js presentation", "PeerJS transport", "browser storage"]
    }
  });
}

export function createFlowBoundaryKit() {
  return boundary({
    id: "battle-clash-flow-boundary-kit",
    domain: "battle-clash-flow",
    path: "n:game:battle-clash:flow",
    apiName: "battleClashFlow",
    services: ["scene-routing", "transition-guards", "recovery"],
    owns: ["scene route intent", "transition recovery policy"],
    read: (engine) => structuredClone(engine.world.getResource(Resources.SceneState))
  });
}

export function createFrontierBoundaryKit() {
  return boundary({
    id: "battle-clash-frontier-boundary-kit",
    domain: "battle-clash-frontier",
    path: "n:game:battle-clash:frontier",
    apiName: "battleClashFrontier",
    services: ["directional-fronts", "supply-lines", "territory-control"],
    owns: ["front pressure", "supply route read model", "ownership consequences"],
    read: (engine) => structuredClone(engine.n.battleClashWorld.getWorldState())
  });
}

export function createHeroBoundaryKit() {
  return boundary({
    id: "battle-clash-hero-boundary-kit",
    domain: "battle-clash-hero",
    path: "n:game:battle-clash:hero",
    apiName: "battleClashHero",
    services: ["hero-movement", "discovery", "scouting"],
    owns: ["hero read model", "movement intent", "discovery radius"],
    read: (engine) => structuredClone(engine.n.battleClashWorld.getHeroState())
  });
}

export function createArmyBoundaryKit() {
  return boundary({
    id: "battle-clash-army-boundary-kit",
    domain: "battle-clash-army",
    path: "n:game:battle-clash:army",
    apiName: "battleClashArmy",
    services: ["roster", "recruitment", "deployment-capacity"],
    owns: ["army read model", "roster capacity", "supply demand"],
    read: (engine) => structuredClone(engine.world.getResource(Resources.ArmyState))
  });
}

export function createEconomyBoundaryKit() {
  return boundary({
    id: "battle-clash-economy-boundary-kit",
    domain: "battle-clash-economy",
    path: "n:game:battle-clash:economy",
    apiName: "battleClashEconomy",
    services: ["production", "upkeep", "storage", "territory-bonuses"],
    owns: ["resource rates", "upkeep policy", "production modifiers"],
    read: (engine) => structuredClone(engine.world.getResource(Resources.EconomyState))
  });
}

export function createEncounterBoundaryKit() {
  return boundary({
    id: "battle-clash-encounter-boundary-kit",
    domain: "battle-clash-encounter",
    path: "n:game:battle-clash:encounter",
    apiName: "battleClashEncounter",
    services: ["attack", "defense", "objectives", "dynamic-a-star"],
    owns: ["encounter read model", "objective modifiers", "front composition"],
    read: (engine) => structuredClone(engine.world.getResource(Resources.RaidState))
  });
}

export function createSanctumBoundaryKit() {
  return boundary({
    id: "battle-clash-sanctum-boundary-kit",
    domain: "battle-clash-sanctum",
    path: "n:game:battle-clash:sanctum",
    apiName: "battleClashSanctum",
    services: ["home-base", "loadout", "healing", "upgrades"],
    owns: ["Home Base read model", "loadout intent", "upgrade unlocks"],
    read: (engine) => structuredClone(engine.n.battleClashWorld.getWorldState())
  });
}
