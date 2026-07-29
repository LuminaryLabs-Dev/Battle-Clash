import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { PROGRESSION } from "../../data/battlefield.js";
import { Events, Resources } from "../shared/definitions.js";
import { createDefaultProgression } from "../shared/entity-factory.js";

function thresholdFor(level) {
  return Math.round(
    PROGRESSION.baseXpToLevel *
      PROGRESSION.levelGrowth ** Math.max(0, level - 1)
  );
}

function progressionSystem(world) {
  const raid = world.getResource(Resources.RaidState);
  if (!["won", "lost"].includes(raid.phase)) return;

  const current = world.getResource(Resources.ProgressionState);
  if (current.lastCompletionFrame === raid.completedAtFrame) return;

  const reward =
    (raid.phase === "won" ? PROGRESSION.winXp : PROGRESSION.lossXp) +
    raid.destroyed * PROGRESSION.destroyedStructureXp;
  let level = current.level;
  let xp = current.xp + reward;
  let xpToNext = current.xpToNext;
  let levelsGained = 0;

  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    levelsGained += 1;
    xpToNext = thresholdFor(level);
  }

  const next = {
    ...current,
    level,
    xp,
    xpToNext,
    runs: current.runs + 1,
    wins: current.wins + (raid.phase === "won" ? 1 : 0),
    perkPoints: current.perkPoints + levelsGained,
    lastReward: reward,
    lastCompletionFrame: raid.completedAtFrame
  };
  world.setResource(Resources.ProgressionState, next);
  world.emit(Events.ProgressionAwarded, {
    reward,
    result: raid.phase,
    level,
    levelsGained
  });
  if (levelsGained > 0) {
    world.emit(Events.LevelGained, {
      level,
      levelsGained,
      perkPoints: next.perkPoints
    });
  }
}

export function createProgressionKit() {
  return defineDomainServiceKit({
    id: "battle-clash-progression-kit",
    domain: "battle-clash-progression",
    domainPath: "n:game:battle-clash:progression",
    parentDomainPath: "n:game:battle-clash",
    apiName: "battleClashProgression",
    stability: "experimental",
    version: "0.1.0",
    requires: [
      "n:game:battle-clash",
      "n:core-data",
      "n:core-persistence"
    ],
    services: ["profile", "xp-awards", "level-thresholds", "power-scaling"],
    systems: [
      {
        phase: "cleanup",
        name: "battleClashProgressionSystem",
        system: progressionSystem
      }
    ],
    createApi({ world }) {
      return {
        getState: () =>
          structuredClone(world.getResource(Resources.ProgressionState)),
        setProfile(profile = {}) {
          const next = createDefaultProgression(profile);
          world.setResource(Resources.ProgressionState, next);
          return structuredClone(next);
        },
        thresholdFor
      };
    },
    metadata: {
      owns: [
        "run XP awards",
        "level thresholds",
        "perk point accrual",
        "delver power scaling"
      ],
      doesNotOwn: [
        "localStorage",
        "cloud accounts",
        "PeerJS transport",
        "Three.js presentation"
      ]
    }
  });
}
