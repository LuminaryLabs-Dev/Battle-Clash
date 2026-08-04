import { territoryById } from "../../data/world.js";

function targetIdsFor(recipes, archetype) {
  return recipes.filter((recipe) => recipe.archetype === archetype).map((recipe) => recipe.id);
}

function guardIdsFor(recipes) {
  return recipes
    .filter((recipe) => ["sentinel", "elite"].includes(recipe.archetype))
    .map((recipe) => recipe.id);
}

function lootFor(kind, index) {
  if (kind === "stronghold-break") return { gold: 30 + index * 10, food: 0, iron: 15, arcane: 18 };
  if (kind === "relic-secure") return { gold: 12, food: 0, iron: 4, arcane: 8 + index * 4 };
  if (kind === "pressure-clear") return { gold: 6, food: 10, iron: 2, arcane: 0 };
  return { gold: 8, food: 2, iron: 7, arcane: 0 };
}

/**
 * Encounter objectives are data-derived from the territory descriptor and the
 * deterministic recipe, not from the renderer or a scene-specific button.
 */
export function createObjectiveState(territoryId, recipes = []) {
  const territory = territoryById(territoryId);
  const kind = territory?.kind ?? "dungeon";
  const sentinels = guardIdsFor(recipes);
  const relics = targetIdsFor(recipes, "relic");
  const bosses = targetIdsFor(recipes, "boss");
  let descriptor;

  if (kind === "stronghold" && bosses.length) {
    descriptor = {
      id: `${territoryId}:break-warden`,
      kind: "stronghold-break",
      title: "Break the Warden",
      description: "Destroy the territory warden to open the front.",
      targetIds: bosses,
      required: 1
    };
  } else if (kind === "dungeon" && relics.length) {
    descriptor = {
      id: `${territoryId}:secure-relics`,
      kind: "relic-secure",
      title: "Secure the Relics",
      description: "Recover the contested relic nodes before the Heart falls.",
      targetIds: relics,
      required: relics.length
    };
  } else if (kind === "wilds") {
    const targets = sentinels.slice(0, Math.min(3, sentinels.length));
    descriptor = {
      id: `${territoryId}:clear-pressure`,
      kind: "pressure-clear",
      title: "Clear the Pressure",
      description: "Break the sentinels holding the wilds front.",
      targetIds: targets,
      required: targets.length
    };
  } else {
    const targets = sentinels.slice(0, Math.min(2, sentinels.length));
    descriptor = {
      id: `${territoryId}:break-front`,
      kind: "front-break",
      title: "Break the Front",
      description: "Destroy the front sentinels and reach the Heart.",
      targetIds: targets,
      required: targets.length
    };
  }

  return {
    schema: "battle-clash.objective/1",
    ...descriptor,
    lootTable: descriptor.targetIds.map((targetId, index) => ({
      targetId,
      resources: lootFor(descriptor.kind, index)
    })),
    lootedTargetIds: [],
    progress: 0,
    completed: false,
    completedAtFrame: null
  };
}
