import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { Events, Resources } from "../shared/definitions.js";

function objectiveSystem(world) {
  const objective = world.getResource(Resources.ObjectiveState);
  const raid = world.getResource(Resources.RaidState);
  if (!objective || !raid) return;
  const destroyed = new Set(raid.destroyedEntityIds ?? []);
  const progress = objective.targetIds.filter((id) => destroyed.has(id)).length;
  const completed = progress >= objective.required;
  const looted = new Set(objective.lootedTargetIds ?? []);
  const newlyLooted = objective.lootTable.filter((entry) => destroyed.has(entry.targetId) && !looted.has(entry.targetId));
  if (progress === objective.progress && completed === objective.completed && newlyLooted.length === 0) return;

  const loot = world.getResource(Resources.LootState) ?? {
    schema: "battle-clash.loot/1",
    drops: [],
    totals: { gold: 0, food: 0, iron: 0, arcane: 0 }
  };
  const totals = { ...loot.totals };
  for (const entry of newlyLooted) {
    for (const [resource, amount] of Object.entries(entry.resources)) {
      totals[resource] = Number(totals[resource] ?? 0) + Number(amount ?? 0);
    }
    looted.add(entry.targetId);
  }
  if (newlyLooted.length) {
    world.setResource(Resources.LootState, {
      ...loot,
      totals,
      drops: [...loot.drops, ...newlyLooted.map((entry) => ({
        targetId: entry.targetId,
        resources: { ...entry.resources },
        frame: world.__nexusClock?.frame ?? 0
      }))]
    });
  }

  const next = {
    ...objective,
    lootedTargetIds: [...looted],
    progress,
    completed,
    completedAtFrame: completed
      ? objective.completedAtFrame ?? world.__nexusClock?.frame ?? 0
      : null
  };
  world.setResource(Resources.ObjectiveState, next);
  world.emit(completed ? Events.ObjectiveCompleted : Events.ObjectiveProgressed, {
    id: next.id,
    progress: next.progress,
    required: next.required,
    frame: world.__nexusClock?.frame ?? 0
  });
}

export function createEncounterKit() {
  return defineDomainServiceKit({
    id: "battle-clash-encounter-objective-kit",
    domain: "battle-clash-encounter",
    domainPath: "n:game:battle-clash:encounter:objectives",
    parentDomainPath: "n:game:battle-clash:encounter",
    apiName: "battleClashEncounterObjectives",
    stability: "experimental",
    version: "0.1.0",
    requires: ["n:game:battle-clash", "n:game:battle-clash:raid", "n:core-simulation"],
    services: ["objective-selection", "objective-progress", "objective-receipts"],
    systems: [{ phase: "cleanup", name: "battleClashObjectiveSystem", system: objectiveSystem }],
    createApi({ world }) {
      return { getState: () => structuredClone(world.getResource(Resources.ObjectiveState)) };
    },
    metadata: {
      owns: ["territory objective read model", "objective progress", "objective completion"],
      doesNotOwn: ["enemy damage", "territory ownership", "Three.js presentation"]
    }
  });
}
