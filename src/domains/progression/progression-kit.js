import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { PROGRESSION } from "../../data/battlefield.js";
import { Events, Resources } from "../shared/definitions.js";
import { createDefaultProgression } from "../shared/entity-factory.js";
import { activeRegionIds, heroUnlocksForLevel } from "../world/world-state.js";

function thresholdFor(level) {
  return Math.round(
    PROGRESSION.baseXpToLevel *
      PROGRESSION.levelGrowth ** Math.max(0, level - 1)
  );
}

function discoveryRadiusForLevel(level, currentRadius = 2) {
  return Math.min(5, Math.max(Number(currentRadius) || 2, 2 + Math.floor(Math.max(0, level - 1) / 2)));
}

function syncWorldHero(world, hero) {
  const worldState = world.getResource(Resources.WorldState);
  if (!worldState || !hero) return;
  const nextActiveRegionIds = activeRegionIds(
    worldState.territories,
    worldState.currentTerritoryId,
    hero.discoveryRadius
  );
  world.setResource(Resources.WorldState, {
    ...worldState,
    hero: {
      ...worldState.hero,
      level: hero.level,
      discoveryRadius: hero.discoveryRadius,
      unlocks: [...(hero.unlocks ?? []), ...(heroUnlocksForLevel(hero.level) ?? [])]
    },
    activeRegionIds: nextActiveRegionIds,
    frontier: worldState.frontier
      ? { ...worldState.frontier, simulatedTerritoryCount: nextActiveRegionIds.length }
      : worldState.frontier
  });
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
    unlocks: heroUnlocksForLevel(level),
    runs: current.runs + 1,
    wins: current.wins + (raid.phase === "won" ? 1 : 0),
    perkPoints: current.perkPoints + levelsGained,
    lastReward: reward,
    lastCompletionFrame: raid.completedAtFrame
  };
  world.setResource(Resources.ProgressionState, next);
  const hero = world.getResource(Resources.HeroState);
  if (hero && level > Number(hero.level ?? 1)) {
    const nextHero = {
      ...hero,
      level,
      discoveryRadius: discoveryRadiusForLevel(level, hero.discoveryRadius),
      unlocks: heroUnlocksForLevel(level)
    };
    world.setResource(Resources.HeroState, nextHero);
    syncWorldHero(world, nextHero);
  }
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
    provides: ["n:game:battle-clash:progression"],
    requires: [
      "n:game:battle-clash",
      "n:runtime:data",
      "n:runtime:persistence"
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
        awardExploration({ kind = "discovery", id = "" } = {}) {
          const receiptId = `${String(kind)}:${String(id)}`;
          const current = world.getResource(Resources.ProgressionState);
          if (!id || current.explorationReceipts?.includes(receiptId)) {
            return { accepted: true, duplicate: true, state: structuredClone(current) };
          }
          const reward = kind === "discovery" ? 18 : 6;
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
            unlocks: heroUnlocksForLevel(level),
            perkPoints: current.perkPoints + levelsGained,
            lastReward: reward,
            explorationReceipts: [...(current.explorationReceipts ?? []), receiptId],
            lastExplorationReward: { kind, id: String(id), reward, level }
          };
          world.setResource(Resources.ProgressionState, next);
          const hero = world.getResource(Resources.HeroState);
          if (hero && level > Number(hero.level ?? 1)) {
            const nextHero = {
              ...hero,
              level,
              discoveryRadius: discoveryRadiusForLevel(level, hero.discoveryRadius),
              unlocks: heroUnlocksForLevel(level)
            };
            world.setResource(Resources.HeroState, nextHero);
            syncWorldHero(world, nextHero);
          }
          world.emit(Events.ProgressionAwarded, {
            reward,
            result: "exploration",
            source: kind,
            id: String(id),
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
          return { accepted: true, duplicate: false, reward, state: structuredClone(next) };
        },
        setProfile(profile = {}) {
          const next = createDefaultProgression(profile);
          world.setResource(Resources.ProgressionState, next);
          const hero = world.getResource(Resources.HeroState);
          if (hero && next.level > Number(hero.level ?? 1)) {
            const nextHero = {
              ...hero,
              level: next.level,
              discoveryRadius: discoveryRadiusForLevel(next.level, hero.discoveryRadius),
              unlocks: heroUnlocksForLevel(next.level)
            };
            world.setResource(Resources.HeroState, nextHero);
            syncWorldHero(world, nextHero);
          }
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
