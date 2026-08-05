import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import {
  CRAFTING_RECIPES,
  GEAR_ITEMS,
  QUESTS,
  ROOM_TYPES,
  SANCTUM_ROOMS
} from "../../data/production-content.js";
import { Events, Resources } from "../shared/definitions.js";

const CONTENT_SCHEMA = "battle-clash.content/1";
const clone = (value) => structuredClone(value);

function questStateFromProfile(profile = {}) {
  return Object.fromEntries(QUESTS.map((quest) => {
    const saved = profile.quests?.[quest.id] ?? {};
    const completedSteps = [...new Set((saved.completedSteps ?? []).map(String))]
      .filter((step) => quest.steps.includes(step));
    return [quest.id, {
      questId: quest.id,
      territoryId: quest.territoryId,
      completedSteps,
      status: completedSteps.length >= quest.steps.length ? "complete" : "active"
    }];
  }));
}

export function createDefaultContentState(profile = {}) {
  const inventory = [...new Set((profile.inventory ?? []).map((item) => typeof item === "string" ? item : item.id))]
    .filter((id) => GEAR_ITEMS.some((item) => item.id === id));
  const equipped = Object.fromEntries(Object.keys(profile.equipped ?? {}).map((slot) => [slot, profile.equipped[slot]]));
  return {
    schema: CONTENT_SCHEMA,
    inventory,
    equipped,
    quests: questStateFromProfile(profile),
    crafted: [...new Set((profile.crafted ?? []).map(String))].filter((id) => GEAR_ITEMS.some((item) => item.id === id)),
    sanctumRooms: SANCTUM_ROOMS.map((room) => ({
      ...room,
      status: Object.values(profile.quests ?? {}).some((quest) => quest.questId === room.unlock && quest.status === "complete") ? "unlocked" : "locked"
    })),
    lastLoot: profile.lastLoot ?? null,
    lastQuest: profile.lastQuest ?? null,
    lastCraft: profile.lastCraft ?? null,
    lastEquip: profile.lastEquip ?? null,
    lastRaidFrame: Number(profile.lastRaidFrame ?? -1)
  };
}

function currentContent(world) {
  return world.getResource(Resources.ContentState) ?? createDefaultContentState();
}

function updateSanctumRooms(state) {
  return SANCTUM_ROOMS.map((room) => ({
    ...room,
    status: state.quests?.[room.unlock]?.status === "complete" ? "unlocked" : "locked"
  }));
}

function lootGearForRoom(room) {
  if (room?.kind === "boss") return "glassbreaker";
  if (room?.kind === "elite") return "scout-lens";
  if (room?.kind === "entry") return "ember-ward";
  return null;
}

function questStepForRoom(room, state) {
  const quest = QUESTS.find((candidate) => candidate.territoryId === state.territoryId);
  if (!quest) return null;
  const index = Number(state.index ?? 0);
  return quest.steps[index] ?? room?.objective ?? null;
}

function contentProgressionSystem(world) {
  const current = currentContent(world);
  const raid = world.getResource(Resources.RaidState);
  const room = world.getResource(Resources.RoomState);
  if (!raid || raid.phase !== "won" || Number(raid.completedAtFrame) === current.lastRaidFrame) return;

  let next = { ...current, lastRaidFrame: Number(raid.completedAtFrame) };
  const roomDefinition = ROOM_TYPES[room?.roomId] ?? room;
  const gearId = lootGearForRoom(roomDefinition);
  if (gearId && !next.inventory.includes(gearId)) {
    next = {
      ...next,
      inventory: [...next.inventory, gearId],
      lastLoot: { itemId: gearId, roomId: room?.roomId ?? null, frame: raid.completedAtFrame }
    };
    world.emit(Events.GearLooted, clone(next.lastLoot));
  }

  const quest = QUESTS.find((candidate) => candidate.territoryId === room?.territoryId);
  const step = questStepForRoom(room, room);
  if (quest && step && quest.steps.includes(step)) {
    const previous = next.quests[quest.id] ?? { questId: quest.id, territoryId: quest.territoryId, completedSteps: [], status: "active" };
    if (!previous.completedSteps.includes(step)) {
      const completedSteps = [...previous.completedSteps, step];
      const questUpdate = {
        ...previous,
        completedSteps,
        status: completedSteps.length >= quest.steps.length ? "complete" : "active"
      };
      next = {
        ...next,
        quests: { ...next.quests, [quest.id]: questUpdate },
        sanctumRooms: updateSanctumRooms({ ...next, quests: { ...next.quests, [quest.id]: questUpdate } }),
        lastQuest: { questId: quest.id, step, status: questUpdate.status, frame: raid.completedAtFrame }
      };
      world.emit(Events.QuestProgressed, clone(next.lastQuest));
    }
  }
  world.setResource(Resources.ContentState, next);
}

function validateItem(itemId) {
  return GEAR_ITEMS.find((item) => item.id === String(itemId)) ?? null;
}

export function createContentKit({ profile = {} } = {}) {
  return defineDomainServiceKit({
    id: "battle-clash-content-kit",
    domain: "battle-clash-content",
    domainPath: "n:game:battle-clash:content",
    parentDomainPath: "n:game:battle-clash",
    apiName: "battleClashContent",
    stability: "experimental",
    version: "0.1.0",
    provides: ["n:game:battle-clash:content"],
    requires: ["n:game:battle-clash", "n:game:battle-clash:encounter", "n:game:battle-clash:sanctum", "n:simulation", "n:runtime:persistence"],
    services: ["gear", "loot", "quests", "crafting", "loadouts"],
    systems: [{ phase: "cleanup", name: "battleClashContentProgressionSystem", system: contentProgressionSystem }],
    createApi({ world }) {
      if (world.getResource(Resources.ContentState) === undefined) {
        world.setResource(Resources.ContentState, createDefaultContentState(profile));
      }
      return {
        getState: () => clone(currentContent(world)),
        setProfile(profile = {}) {
          const next = createDefaultContentState(profile);
          world.setResource(Resources.ContentState, next);
          return clone(next);
        },
        craft(itemId) {
          const item = validateItem(itemId);
          const recipe = CRAFTING_RECIPES.find((candidate) => candidate.output === item?.id);
          const scene = world.getResource(Resources.SceneState);
          if (!item || !recipe) return { accepted: false, reason: "unknown-recipe", state: clone(currentContent(world)) };
          if (scene?.current !== "sanctum") return { accepted: false, reason: "sanctum-required", state: clone(currentContent(world)) };
          const content = currentContent(world);
          const economy = world.getResource(Resources.EconomyState);
          if (content.inventory.includes(item.id)) return { accepted: false, reason: "already-owned", state: clone(content) };
          if (Object.entries(recipe.costs).some(([resource, cost]) => Number(economy?.resources?.[resource] ?? 0) < Number(cost))) {
            return { accepted: false, reason: "insufficient-crafting-resources", state: clone(content) };
          }
          const resources = { ...economy.resources };
          for (const [resource, cost] of Object.entries(recipe.costs)) resources[resource] -= Number(cost);
          world.setResource(Resources.EconomyState, { ...economy, resources });
          const next = { ...content, inventory: [...content.inventory, item.id], crafted: [...content.crafted, item.id], lastCraft: { itemId: item.id, costs: clone(recipe.costs), frame: world.__nexusClock?.frame ?? 0 } };
          world.setResource(Resources.ContentState, next);
          world.emit(Events.ItemCrafted, clone(next.lastCraft));
          return { accepted: true, state: clone(next), item: clone(item) };
        },
        equip(itemId) {
          const item = validateItem(itemId);
          const content = currentContent(world);
          if (!item || !content.inventory.includes(item.id)) return { accepted: false, reason: "gear-not-owned", state: clone(content) };
          const next = { ...content, equipped: { ...content.equipped, [item.slot]: item.id }, lastEquip: { itemId: item.id, slot: item.slot, frame: world.__nexusClock?.frame ?? 0 } };
          world.setResource(Resources.ContentState, next);
          world.emit(Events.GearEquipped, clone(next.lastEquip));
          return { accepted: true, state: clone(next), item: clone(item) };
        }
      };
    },
    metadata: {
      owns: ["gear inventory", "loot promotion", "quest progression", "Sanctum crafting", "equipment loadouts"],
      doesNotOwn: ["combat simulation", "world ownership", "Three.js presentation", "PeerJS transport"]
    }
  });
}
