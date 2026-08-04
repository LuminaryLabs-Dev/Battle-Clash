import { mkdir, writeFile } from "node:fs/promises";
import { createBattleClashGame } from "../src/composition/create-battle-clash.js";
import { ARCHETYPES } from "../src/data/battlefield.js";
import { TERRITORIES, WORLD_SCENES, sceneForTerritory } from "../src/data/world.js";
import { Components, Events, Resources } from "../src/domains/shared/definitions.js";
import { createPeerMessage, normalizePeerCommand, parsePeerMessage } from "../src/network/peer-protocol.js";

const expectedDomains = [
  "n:core-camera", "n:core-data", "n:core-graphics", "n:core-input", "n:core-interaction",
  "n:core-network", "n:core-persistence", "n:core-scene", "n:core-simulation", "n:core-spatial",
  "n:core-ui", "n:game:battle-clash", "n:game:battle-clash:army", "n:game:battle-clash:combat",
  "n:game:battle-clash:defense", "n:game:battle-clash:deployment", "n:game:battle-clash:economy",
  "n:game:battle-clash:encounter", "n:game:battle-clash:encounter:objectives", "n:game:battle-clash:flow",
  "n:game:battle-clash:frontier", "n:game:battle-clash:hero", "n:game:battle-clash:hero-combat",
  "n:game:battle-clash:navigation", "n:game:battle-clash:progression", "n:game:battle-clash:raid",
  "n:game:battle-clash:sanctum", "n:game:battle-clash:session", "n:game:battle-clash:targeting",
  "n:game:battle-clash:world", "n:realtime", "n:sequence", "n:world"
];

const commandCases = [
  ["deploy", { kind: "deploy", x: 10, z: 0 }],
  ["start", { kind: "start" }],
  ["reset", { kind: "reset" }],
  ["fortify", { kind: "fortify" }],
  ["hero-ability", { kind: "hero-ability", abilityId: "arc-burst" }],
  ["scene", { kind: "scene", sceneId: "overworld" }],
  ["discover", { kind: "discover", territoryId: "ash-crossing" }],
  ["claim", { kind: "claim", territoryId: "ash-crossing" }],
  ["move-hero", { kind: "move-hero", x: 50, z: 50 }],
  ["heal-army", { kind: "heal-army" }],
  ["recruit-army", { kind: "recruit-army", archetype: "delver" }],
  ["select-archetype", { kind: "select-archetype", archetype: "delver" }],
  ["upgrade-sanctum", { kind: "upgrade-sanctum" }],
  ["trade-resources", { kind: "trade-resources", from: "iron", to: "gold", amount: 1 }],
  ["interact-landmark", { kind: "interact-landmark", landmarkId: "ash-crossing-settlement" }]
];

const checks = [];
function check(category, id, fn) {
  try {
    const detail = fn();
    checks.push({ category, id, status: "pass", detail: detail ?? true });
  } catch (error) {
    checks.push({ category, id, status: "fail", detail: error.message });
  }
}

function requireValue(value, message) {
  if (!value) throw new Error(message);
  return true;
}

const baseline = createBattleClashGame();
const snapshot = baseline.getSnapshot();

for (const domain of expectedDomains) check("domain", domain, () => requireValue(snapshot.domains.includes(domain), "domain not installed"));
for (const [name, component] of Object.entries(Components)) check("component", name, () => requireValue(component?.name, "component has no identity"));
for (const [name, resource] of Object.entries(Resources)) check("resource", name, () => requireValue(resource?.name, "resource has no identity"));
for (const [name, event] of Object.entries(Events)) check("event", name, () => requireValue(event?.name, "event has no identity"));
for (const [id, archetype] of Object.entries(ARCHETYPES)) check("archetype", id, () => {
  requireValue(archetype.id === id, "archetype id mismatch");
  requireValue(archetype.category && archetype.role && archetype.faction, "archetype semantic fields missing");
});
for (const territory of TERRITORIES) check("territory", territory.id, () => {
  const descriptor = snapshot.world?.territories?.[territory.id];
  requireValue(descriptor?.sceneId === sceneForTerritory(territory.id), "scene identity mismatch");
  requireValue(descriptor?.landmarks?.length >= 1, "territory has no landmark");
  for (const neighbor of Object.values(territory.neighbors ?? {})) requireValue(TERRITORIES.some((candidate) => candidate.id === neighbor), `unknown neighbor ${neighbor}`);
});
for (const scene of WORLD_SCENES) check("scene", scene.id, () => {
  requireValue(scene.title && scene.kind && Array.isArray(scene.exits), "scene descriptor incomplete");
  requireValue(new Set(scene.exits.map((exit) => exit.to)).size === scene.exits.length, "duplicate scene exits");
});

const apiMethods = [
  "deployAt", "startRaid", "useHeroAbility", "reset", "fortify", "setProgression", "updateSession",
  "updateAccount", "getWorldState", "getCurrentTerritory", "getHeroState", "getSanctumState", "selectArchetype",
  "discoverTerritory", "enterTerritory", "prepareTerritory", "claimTerritory", "moveHero", "healArmy", "recruitArmy",
  "upgradeSanctum", "tradeResources", "interactLandmark", "findHeroPath", "findWorldPath", "findCombatPath",
  "tickEconomy", "changeLandscape", "transitionToScene", "canDeployAt", "getSnapshot", "getDeterministicSnapshot", "getDigest"
];
for (const method of apiMethods) check("api", method, () => requireValue(typeof baseline[method] === "function", "missing composition API method"));

for (const [kind, command] of commandCases) check("command", kind, () => {
  const normalized = normalizePeerCommand(command);
  requireValue(normalized?.kind === kind, "command normalization mismatch");
  const envelope = createPeerMessage("command", { command: normalized }, { roomId: "validator", senderId: "validator", sequence: 1 });
  requireValue(parsePeerMessage(envelope).payload.command.kind === kind, "command envelope mismatch");
});

check("flow", "home-frontier-territory-encounter-raid-home", () => {
  const game = createBattleClashGame();
  requireValue(game.getSnapshot().scene.current === "sanctum", "flow did not start at Home Base");
  requireValue(game.transitionToScene("overworld").accepted, "frontier transition rejected");
  requireValue(game.discoverTerritory("ash-crossing").accepted, "territory discovery rejected");
  requireValue(game.enterTerritory("ash-crossing").accepted, "territory entry rejected");
  requireValue(game.transitionToScene("encounter", { territoryId: "ash-crossing", frontDirection: "east" }).accepted, "encounter transition rejected");
  const pattern = [[-10.5, -6], [-10.5, -2], [-10.5, 2], [-10.5, 6], [10.5, -6], [10.5, -2], [10.5, 2], [10.5, 6]];
  for (const [x, z] of pattern) { requireValue(game.canDeployAt(x, z), `invalid deployment ${x},${z}`); game.deployAt(x, z); game.tick(); }
  game.startRaid();
  game.stepSeconds(45);
  const victory = game.getSnapshot();
  requireValue(victory.raid.phase === "won", "raid did not resolve to victory");
  requireValue(game.transitionToScene("sanctum").accepted, "return-home transition rejected");
  const result = game.getSnapshot();
  requireValue(result.scene.current === "sanctum", "victory did not return Home Base");
  requireValue(result.progression.wins === 1, "victory receipt missing");
  return { phase: result.raid.phase, scene: result.scene.current, wins: result.progression.wins };
});

check("determinism", "identical-seed-digest", () => {
  const run = () => { const game = createBattleClashGame(); game.deployAt(-10.5, 0); game.startRaid(); game.stepSeconds(1); return game.getDigest(); };
  requireValue(run() === run(), "digest changed for identical input");
});

const passed = checks.filter((item) => item.status === "pass").length;
const failed = checks.filter((item) => item.status === "fail");
const coveragePct = Number(((passed / checks.length) * 100).toFixed(2));
const report = {
  schema: "battle-clash.domain-coverage/1",
  thresholdPct: 99,
  coveragePct,
  passed,
  total: checks.length,
  failed,
  categories: Object.fromEntries([...new Set(checks.map((item) => item.category))].map((category) => {
    const items = checks.filter((item) => item.category === category);
    return [category, { passed: items.filter((item) => item.status === "pass").length, total: items.length }];
  })),
  evidence: { seed: snapshot.world?.schema ?? "unknown", domains: snapshot.domains.length, territories: TERRITORIES.length, scenes: WORLD_SCENES.length },
  status: coveragePct >= 99 ? "pass" : "fail"
};

await mkdir("artifacts/validation", { recursive: true });
await writeFile("artifacts/validation/domain-coverage.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.status !== "pass") process.exitCode = 1;
