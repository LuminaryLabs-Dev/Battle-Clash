import assert from "node:assert/strict";
import {
  acceptMatchReceipt,
  createAuthenticatedHello,
  createMatchReceipt,
  validateAuthenticatedHello,
  validateCommandEnvelope
} from "../src/network/peer-room-contract.js";

const hello = createAuthenticatedHello({ roomId: "room-1", userId: "user-1", role: "attacker", profileRevision: 3, reconnectToken: "reconnect-1" });
assert.equal(validateAuthenticatedHello(hello, "room-1", { expectedUserId: "user-1", requireReconnectToken: true }).accepted, true);
assert.equal(validateAuthenticatedHello({ ...hello, roomId: "room-2" }, "room-1").accepted, false);
assert.equal(validateCommandEnvelope({ roomId: "room-1", senderId: "user-1", authorityId: "host-1", sequence: 1, command: { kind: "deploy" } }).accepted, true);
assert.equal(validateCommandEnvelope({ roomId: "room-1", senderId: "host-1", authorityId: "host-1", sequence: 1, command: { kind: "deploy" } }).accepted, false);
const receipt = createMatchReceipt({ roomId: "room-1", authorityId: "host-1", profileRevision: 3, sequenceStart: 1, sequenceEnd: 8, result: "victory", rewardIdempotencyKey: "reward-1" });
assert.equal(acceptMatchReceipt(receipt, { roomId: "room-1", authorityId: "host-1" }).accepted, true);
assert.equal(acceptMatchReceipt(receipt, { roomId: "room-1", authorityId: "host-1", lastAcceptedKey: "reward-1" }).accepted, false);
assert.throws(() => createMatchReceipt({ roomId: "room-1", authorityId: "host-1", sequenceStart: 0, sequenceEnd: 1, result: "victory", rewardIdempotencyKey: "reward-2" }));
console.log("Peer contract: PASS (authenticated hello, authority/sequence validation, reconnect token, one receipt)");
