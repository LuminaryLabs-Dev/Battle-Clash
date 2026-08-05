export const PRODUCTION_CONTENT_SCHEMA = "battle-clash.production-content/1";

export const CONTENT_TERRITORIES = Object.freeze([
  Object.freeze({ id: "ash-crossing", sceneId: "territory:ash-crossing", rooms: ["frontier-entry", "ash-traversal", "cinder-ambush"] }),
  Object.freeze({ id: "verdant-rift", sceneId: "territory:verdant-rift", rooms: ["wilds-resource", "thorn-trap", "rift-elite"] }),
  Object.freeze({ id: "blackglass-rise", sceneId: "territory:blackglass-rise", rooms: ["stronghold-objective", "boss-approach", "boss-arena"] })
]);

export const ROOM_TYPES = Object.freeze({
  "frontier-entry": Object.freeze({ kind: "entry", objective: "route", exits: ["ash-traversal"] }),
  "ash-traversal": Object.freeze({ kind: "traversal", objective: "scout", exits: ["cinder-ambush"] }),
  "cinder-ambush": Object.freeze({ kind: "ambush", objective: "survive", exits: [] }),
  "wilds-resource": Object.freeze({ kind: "resource", objective: "harvest", exits: ["thorn-trap"] }),
  "thorn-trap": Object.freeze({ kind: "trap", objective: "disarm", exits: ["rift-elite"] }),
  "rift-elite": Object.freeze({ kind: "elite", objective: "defeat-elite", exits: [] }),
  "stronghold-objective": Object.freeze({ kind: "objective", objective: "capture", exits: ["boss-approach"] }),
  "boss-approach": Object.freeze({ kind: "boss-approach", objective: "prepare", exits: ["boss-arena"] }),
  "boss-arena": Object.freeze({ kind: "boss", objective: "defeat-boss", exits: [] })
});

export const ENEMY_FAMILIES = Object.freeze({
  ashbound: Object.freeze({ id: "ashbound", role: "mobile", damageType: "physical", archetypes: ["raider", "scorcher"] }),
  thornkin: Object.freeze({ id: "thornkin", role: "mobile", damageType: "nature", archetypes: ["stalker", "briar-caster"] }),
  blackglass: Object.freeze({ id: "blackglass", role: "stronghold", damageType: "arcane", archetypes: ["warden", "void-priest"] })
});

export const BOSS_PHASES = Object.freeze([
  Object.freeze({ id: "glass-sentinel-phase-1", threshold: 1, pattern: "sweep" }),
  Object.freeze({ id: "glass-sentinel-phase-2", threshold: 0.66, pattern: "summon" }),
  Object.freeze({ id: "glass-sentinel-phase-3", threshold: 0.33, pattern: "collapse" })
]);

export const GEAR_ITEMS = Object.freeze([
  Object.freeze({ id: "ember-ward", slot: "ward", rarity: "rare", modifiers: { defense: 0.12, arcane: 0.08 } }),
  Object.freeze({ id: "scout-lens", slot: "relic", rarity: "uncommon", modifiers: { scouting: 1, movement: 0.1 } }),
  Object.freeze({ id: "glassbreaker", slot: "weapon", rarity: "legendary", modifiers: { damage: 0.2, bossDamage: 0.15 } })
]);

export const QUESTS = Object.freeze([
  Object.freeze({ id: "q-ash-first-light", territoryId: "ash-crossing", steps: ["discover", "enter", "survive"] }),
  Object.freeze({ id: "q-verdant-harvest", territoryId: "verdant-rift", steps: ["harvest", "disarm", "defeat-elite"] }),
  Object.freeze({ id: "q-blackglass-breaker", territoryId: "blackglass-rise", steps: ["capture", "prepare", "defeat-boss"] })
]);

export const CRAFTING_RECIPES = Object.freeze([
  Object.freeze({ id: "recipe-ember-ward", output: "ember-ward", costs: { iron: 8, arcane: 4 } }),
  Object.freeze({ id: "recipe-scout-lens", output: "scout-lens", costs: { gold: 20, arcane: 2 } }),
  Object.freeze({ id: "recipe-glassbreaker", output: "glassbreaker", costs: { iron: 16, arcane: 12 } })
]);

export const SANCTUM_ROOMS = Object.freeze([
  Object.freeze({ id: "sanctum-forge", kind: "forge", unlock: "q-ash-first-light" }),
  Object.freeze({ id: "sanctum-armory", kind: "armory", unlock: "q-verdant-harvest" }),
  Object.freeze({ id: "sanctum-training", kind: "training", unlock: "q-blackglass-breaker" })
]);
