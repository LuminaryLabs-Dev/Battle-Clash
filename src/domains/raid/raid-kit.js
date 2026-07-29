import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { BATTLEFIELD } from "../../data/battlefield.js";
import { Components, Events, Resources } from "../shared/definitions.js";
import { identityOf, seedBattleState } from "../shared/entity-factory.js";

function readCommands(world) {
  return world.getResource(Resources.CommandQueue);
}

function writeCommands(world, patch) {
  const current = readCommands(world);
  world.setResource(Resources.CommandQueue, {
    ...current,
    ...patch
  });
}

function raidCommandSystem(world) {
  const commands = readCommands(world);
  if (commands.reset) {
    seedBattleState(world);
    world.clearAllEvents();
    world.emit(Events.RaidReset, { frame: world.__nexusClock?.frame ?? 0 });
    return;
  }

  if (!commands.start) return;
  const raid = world.getResource(Resources.RaidState);
  if (raid.phase === "deploy") {
    world.setResource(Resources.RaidState, {
      ...raid,
      phase: "active",
      startedAtFrame: world.__nexusClock?.frame ?? 0
    });
    world.emit(Events.RaidStarted, {
      frame: world.__nexusClock?.frame ?? 0
    });
  }
  writeCommands(world, { start: false });
}

function completeRaid(world, raid, phase) {
  const next = {
    ...raid,
    phase,
    result: phase,
    timeRemaining: Math.max(0, raid.timeRemaining),
    completedAtFrame: world.__nexusClock?.frame ?? 0
  };
  world.setResource(Resources.RaidState, next);
  world.emit(Events.RaidCompleted, {
    result: phase,
    timeRemaining: next.timeRemaining,
    frame: next.completedAtFrame
  });
}

function raidLifecycleSystem(world) {
  const raid = world.getResource(Resources.RaidState);
  if (raid.phase !== "active") return;

  const delta = Number(world.__nexusClock?.delta ?? 0);
  const timeRemaining = Math.max(0, raid.timeRemaining - delta);
  let coreAlive = false;
  let livingRaiders = 0;

  for (const entity of world.query(Components.Identity, Components.Health)) {
    const identity = identityOf(world, entity);
    const health = world.getComponent(entity, Components.Health);
    if (identity?.role === "core" && health.current > 0) coreAlive = true;
    if (identity?.category === "troop" && health.current > 0) livingRaiders += 1;
  }

  const deployment = world.getResource(Resources.DeploymentState);
  const next = { ...raid, timeRemaining };
  world.setResource(Resources.RaidState, next);

  if (!coreAlive) {
    completeRaid(world, next, "won");
    return;
  }
  if (timeRemaining <= 0 || (livingRaiders === 0 && deployment.remaining === 0)) {
    completeRaid(world, next, "lost");
  }
}

export function createRaidLifecycleKit() {
  return defineDomainServiceKit({
    id: "battle-clash-raid-lifecycle-kit",
    domain: "battle-clash-raid",
    domainPath: "n:game:battle-clash:raid",
    parentDomainPath: "n:game:battle-clash",
    apiName: "battleClashRaid",
    stability: "experimental",
    version: "0.1.0",
    requires: [
      "n:game:battle-clash",
      "n:game:battle-clash:world",
      "n:core-simulation"
    ],
    services: ["lifecycle", "victory", "reset"],
    systems: [
      {
        phase: "input",
        name: "battleClashRaidCommandSystem",
        system: raidCommandSystem
      },
      {
        phase: "cleanup",
        name: "battleClashRaidLifecycleSystem",
        system: raidLifecycleSystem
      }
    ],
    createApi({ world }) {
      return {
        getState: () => structuredClone(world.getResource(Resources.RaidState)),
        duration: BATTLEFIELD.raidDuration
      };
    },
    metadata: {
      owns: ["raid phases", "raid timer", "victory and loss", "raid reset"],
      doesNotOwn: ["damage resolution", "Three.js presentation"]
    }
  });
}
