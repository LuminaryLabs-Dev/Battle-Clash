import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { Events, Resources } from "../shared/definitions.js";
import {
  beginSceneTransition,
  installSceneTransitionState,
  markSceneTransitionReady,
  publishSceneTransition,
  sceneTransitionSystem
} from "../flow/scene-transition.js";
import {
  createScenePreparationManifest,
  installScenePreparationState,
  validateScenePreparationManifest
} from "../flow/scene-preparation.js";

function boundary({ id, domain, path, apiName, services, owns, read }) {
  return defineDomainServiceKit({
    id,
    domain,
    domainPath: path,
    parentDomainPath: "n:game:battle-clash",
    apiName,
    stability: "experimental",
    version: "0.1.0",
    provides: [path],
    requires: ["n:game:battle-clash", "n:world", "n:simulation"],
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
  return defineDomainServiceKit({
    id: "battle-clash-flow-boundary-kit",
    domain: "battle-clash-flow",
    domainPath: "n:game:battle-clash:flow",
    parentDomainPath: "n:game:battle-clash",
    apiName: "battleClashFlow",
    stability: "experimental",
    version: "0.3.0",
    provides: ["n:game:battle-clash:flow"],
    requires: ["n:game:battle-clash", "n:world", "n:world:scene", "n:runtime:sequence", "n:runtime:startup"],
    services: ["scene-routing", "transition-guards", "recovery", "transition-state", "readiness"],
    resources: {
      SceneTransitionState: Resources.SceneTransitionState,
      ScenePreparationState: Resources.ScenePreparationState
    },
    events: {
      SceneTransitionChanged: Events.SceneTransitionChanged,
      ScenePreparationChanged: Events.ScenePreparationChanged
    },
    systems: [{ phase: "resolve", name: "battleClashSceneTransitionSystem", system: sceneTransitionSystem }],
    initWorld({ world }) {
      installSceneTransitionState(world);
      installScenePreparationState(world);
    },
    createApi({ engine, world }) {
      const read = () => structuredClone(world.getResource(Resources.SceneTransitionState));
      const readPreparation = () => structuredClone(world.getResource(Resources.ScenePreparationState));
      const publishPreparation = (next) => {
        world.setResource(Resources.ScenePreparationState, structuredClone(next));
        world.emit(Events.ScenePreparationChanged, structuredClone(next));
        return structuredClone(next);
      };
      return {
        getState: read,
        getPreparationState: readPreparation,
        prepare(scene, options = {}) {
          const manifest = Array.isArray(scene) ? structuredClone(scene) : createScenePreparationManifest(scene, options);
          const validation = validateScenePreparationManifest(manifest);
          if (!validation.accepted) return { accepted: false, reason: validation.reason, state: readPreparation() };
          const next = {
            schema: "battle-clash.scene-preparation/1",
            sceneId: Array.isArray(scene) ? options.sceneId ?? null : scene.id,
            manifest,
            sequence: Number(readPreparation().sequence ?? 0) + 1,
            status: manifest.every((item) => item.required === false || item.status === "ready") ? "ready" : "preparing"
          };
          return { accepted: true, state: publishPreparation(next) };
        },
        markPreparationReady(preparationId, detail = null) {
          const current = readPreparation();
          const manifest = current.manifest.map((item) => item.id === preparationId
            ? { ...item, status: "ready", progress: 1, detail }
            : item);
          if (!manifest.some((item) => item.id === preparationId)) return { accepted: false, reason: "unknown-preparation", state: current };
          const next = { ...current, manifest, sequence: Number(current.sequence ?? 0) + 1, status: manifest.every((item) => item.required === false || item.status === "ready") ? "ready" : "preparing" };
          return { accepted: true, state: publishPreparation(next) };
        },
        begin(request = {}) {
          const result = beginSceneTransition(read(), request);
          if (result.accepted && !result.duplicate) publishSceneTransition(world, result.state);
          return { ...result, state: read() };
        },
        markReady(request = {}) {
          const result = markSceneTransitionReady(read(), request);
          if (result.accepted) publishSceneTransition(world, result.state);
          return { ...result, state: read() };
        },
        fail(error = {}) {
          const current = read();
          const next = { ...current, phase: "failed", active: false, ready: false, progress: 0, error: structuredClone(error), sequence: Number(current.sequence ?? 0) + 1 };
          publishSceneTransition(world, next);
          return { accepted: true, state: read() };
        },
        cancel(reason = "cancelled") {
          const current = read();
          const next = {
            ...current,
            phase: "failed",
            active: false,
            ready: false,
            progress: 0,
            error: { code: "scene-transition-cancelled", message: String(reason) },
            sequence: Number(current.sequence ?? 0) + 1
          };
          publishSceneTransition(world, next);
          return { accepted: true, state: read() };
        },
        getSceneState: () => structuredClone(engine.n.battleClashWorld?.getWorldState?.() ?? {})
      };
    },
    metadata: {
      owns: ["scene route intent", "transition recovery policy", "Battle Clash transition phase state", "transition readiness bridge"],
      doesNotOwn: ["Nexus Core scene identity", "Nexus startup preparation semantics", "Three.js presentation", "PeerJS transport", "browser storage"],
      rendererAgnostic: true,
      deterministic: true,
      snapshot: true,
      reset: true
    }
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
