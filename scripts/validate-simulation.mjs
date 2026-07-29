import assert from "node:assert/strict";
import { createBattleClashGame } from "../src/composition/create-battle-clash.js";
import { WORLD_SEED } from "../src/data/battlefield.js";
import { Components } from "../src/domains/shared/definitions.js";
import {
  createPeerMessage,
  normalizePeerCommand,
  parsePeerMessage
} from "../src/network/peer-protocol.js";

const deploymentPattern = [
  [-10.5, -6],
  [-10.5, -2],
  [-10.5, 2],
  [-10.5, 6],
  [10.5, -6],
  [10.5, -2],
  [10.5, 2],
  [10.5, 6]
];

function runScenario() {
  const game = createBattleClashGame();
  for (const [x, z] of deploymentPattern) {
    assert.equal(game.canDeployAt(x, z), true, `expected valid deployment at ${x},${z}`);
    game.deployAt(x, z);
    game.tick();
  }

  game.startRaid();
  game.tick();
  game.stepSeconds(45);
  const snapshot = game.getSnapshot();
  const digest = game.getDigest();
  return { game, snapshot, digest };
}

const first = runScenario();
const second = runScenario();

assert.equal(first.snapshot.raid.phase, "won", "expected the bounded first raid to be winnable");
assert.equal(first.snapshot.deployment.remaining, 0);
assert.equal(first.snapshot.activeCellCount, 49);
assert.ok(first.snapshot.domains.includes("n:world"));
assert.ok(first.snapshot.domains.includes("n:core-network"));
assert.ok(first.snapshot.domains.includes("n:core-persistence"));
assert.ok(first.snapshot.domains.includes("n:game:battle-clash:combat"));
assert.ok(first.snapshot.domains.includes("n:game:battle-clash:progression"));
assert.ok(first.snapshot.progression.runs === 1);
assert.ok(first.snapshot.progression.lastReward > 0);
assert.equal(first.digest, second.digest, "identical inputs must produce identical digests");

first.game.reset();
first.game.tick();
const reset = first.game.getSnapshot();
assert.equal(reset.raid.phase, "deploy");
assert.equal(reset.deployment.remaining, 8);
assert.equal(reset.entities.filter((entity) => entity.category === "troop").length, 0);
assert.equal(reset.coreHealth.current, reset.coreHealth.maximum);
assert.equal(reset.progression.xp, first.snapshot.progression.xp);

const leveled = createBattleClashGame({
  progression: { level: 3, xp: 12, xpToNext: 182 }
});
leveled.deployAt(-10.5, 0);
leveled.tick();
const leveledDelver = leveled
  .getSnapshot()
  .entities.find((entity) => entity.category === "troop");
assert.ok(leveledDelver.health.maximum > 115, "levels must scale delver power");

const defended = createBattleClashGame();
const coreEntity = defended.engine.world
  .query(Components.Identity, Components.Health)
  .find(
    (entity) =>
      defended.engine.world.getComponent(entity, Components.Identity).role ===
      "core"
  );
const coreHealth = defended.engine.world.getComponent(
  coreEntity,
  Components.Health
);
defended.engine.world.setComponent(coreEntity, Components.Health, {
  ...coreHealth,
  current: 260
});
defended.startRaid();
defended.tick();
defended.fortify();
defended.tick();
assert.ok(defended.getSnapshot().coreHealth.current > 260);
assert.equal(defended.getSnapshot().defense.wardCharges, 0);

const envelope = createPeerMessage(
  "command",
  { command: { kind: "deploy", x: 10.5, z: -2 } },
  { roomId: "room-0", senderId: "peer-a", sequence: 1 }
);
assert.deepEqual(parsePeerMessage(envelope), envelope);
assert.deepEqual(normalizePeerCommand(envelope.payload.command), {
  kind: "deploy",
  x: 10.5,
  z: -2
});

console.log(JSON.stringify({
  ok: true,
  seed: WORLD_SEED,
  fixedDelta: 1 / 30,
  installedBattleDomains: first.snapshot.domains.filter((path) => path.includes("battle-clash")),
  activeCellCount: first.snapshot.activeCellCount,
  result: first.snapshot.raid.phase,
  timeRemaining: first.snapshot.raid.timeRemaining,
  digest: first.digest,
  progression: first.snapshot.progression,
  leveledDelverHealth: leveledDelver.health.maximum,
  defenderWardRestored: defended.getSnapshot().coreHealth.current - 260,
  reset: {
    phase: reset.raid.phase,
    remaining: reset.deployment.remaining,
    coreHealth: reset.coreHealth
  }
}, null, 2));
