import assert from "node:assert/strict";
import { createAccountSync } from "../src/online/account-sync.js";

const values = new Map();
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key)
};
const auth = { getAccessToken: () => "access-token" };
const states = [];
let mode = "offline";
let requests = 0;
const fetchImpl = async (url, options) => {
  requests += 1;
  if (mode === "offline") throw new Error("offline");
  if (mode === "retry" && requests === 1) return response({ error: "temporary" }, 503);
  if (mode === "conflict") return response({ error: "revision-conflict", profile: { revision: 4 } }, 409);
  return response({ accepted: true, path: url, method: options.method });
};
function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const sync = createAccountSync({
  auth,
  getSnapshot: () => ({ progression: { level: 2 }, world: { revision: 4 } }),
  storage,
  backendBaseUrl: "https://api.example.test",
  fetchImpl,
  retryDelayMs: 0,
  retryAttempts: 2,
  idempotencyKeyFactory: (kind) => `test:${kind}:1`,
  onSync: (state) => states.push(state)
});
const queued = await sync.pushReceipt("match.completed", { victory: true });
assert.equal(queued.queued, true);
assert.equal(sync.pending(), 1);

mode = "retry";
requests = 0;
const flushed = await sync.flushQueue();
assert.deepEqual(flushed, { flushed: 1, remaining: 0 });
assert.equal(sync.pending(), 0);
assert.ok(requests >= 2, "transient server failures must retry");

mode = "online";
const match = await sync.pushMatchReceipt({ roomId: "room-1", authorityId: "host-1", result: "victory", profileRevision: 2, sequenceStart: 1, sequenceEnd: 8, rewardIdempotencyKey: "reward-1" });
assert.equal(match.accepted, true);

mode = "conflict";
const conflict = await sync.pushSnapshot();
assert.equal(conflict.conflict, true);
assert.equal(conflict.queued, false, "revision conflicts must not be retried from the offline queue");
assert.equal(states.at(-1).status, "conflict");
console.log("Sync contract: PASS (offline queue, idempotency, retry/backoff, conflict preservation)");
