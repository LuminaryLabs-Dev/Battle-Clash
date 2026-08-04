const DEFAULT_BACKEND_URL = "http://127.0.0.1:3000";

function backendUrl() {
  return String(import.meta.env.VITE_BATTLE_CLASH_BACKEND_URL ?? DEFAULT_BACKEND_URL).replace(/\/$/, "");
}

function idempotencyKey(kind) {
  return `battle-clash:${kind}:${crypto.randomUUID()}`;
}

// Durable sync contains profile state and receipts only. Render entities,
// particle instances, and per-frame combat interpolation never leave the
// browser; PeerJS remains the live-room transport for those transient values.
export function durableProfileSnapshot(snapshot = {}) {
  return {
    schema: "battle-clash.profile-snapshot/1",
    progression: snapshot.progression ?? null,
    world: snapshot.world ?? null,
    hero: snapshot.hero ?? null,
    army: snapshot.army ?? null,
    sanctum: snapshot.sanctum ?? null,
    economy: snapshot.economy ?? null,
    territory: snapshot.territory ?? null,
    landscape: snapshot.landscape ?? null,
    account: snapshot.account ?? null,
    loot: snapshot.loot ?? null,
    session: snapshot.session ? {
      schema: snapshot.session.schema,
      role: snapshot.session.role,
      roomId: snapshot.session.roomId
    } : null
  };
}

export function createAccountSync({ auth, getSnapshot, onSync, storage = window.localStorage } = {}) {
  const queueKey = "battle-clash.sync-queue.v1";

  function readQueue() {
    try { return JSON.parse(storage.getItem(queueKey) ?? "[]"); } catch { return []; }
  }

  function writeQueue(queue) {
    storage.setItem(queueKey, JSON.stringify(queue.slice(-100)));
  }

  async function request(path, options = {}) {
    const token = auth?.getAccessToken?.();
    if (!token) throw new Error("account-not-authenticated");
    const response = await fetch(`${backendUrl()}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {})
      }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error ?? `backend-${response.status}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  async function pushReceipt(kind, payload) {
    const entry = { kind, payload, idempotencyKey: idempotencyKey(kind) };
    try {
      const result = await request("/api/v1/receipts", {
        method: "POST",
        headers: { "Idempotency-Key": entry.idempotencyKey },
        body: JSON.stringify({ kind, payload })
      });
      onSync?.({ status: "synced", result });
      return result;
    } catch (error) {
      const queue = readQueue();
      writeQueue([...queue, entry]);
      onSync?.({ status: "queued", error: error.message });
      return { queued: true, idempotencyKey: entry.idempotencyKey };
    }
  }

  async function flushQueue() {
    const queue = readQueue();
    if (!queue.length || !auth?.getAccessToken?.()) return { flushed: 0 };
    const remaining = [];
    let flushed = 0;
    for (const entry of queue) {
      try {
        await request("/api/v1/receipts", {
          method: "POST",
          headers: { "Idempotency-Key": entry.idempotencyKey },
          body: JSON.stringify({ kind: entry.kind, payload: entry.payload })
        });
        flushed += 1;
      } catch {
        remaining.push(entry);
      }
    }
    writeQueue(remaining);
    return { flushed, remaining: remaining.length };
  }

  async function pushSnapshot() {
    const snapshot = getSnapshot?.();
    if (!snapshot) return { queued: false, skipped: true };
    return pushReceipt("profile.snapshot", {
      snapshot: durableProfileSnapshot(snapshot),
      clientRevision: snapshot.world?.revision ?? 0
    });
  }

  async function pullProfile() {
    const result = await request("/api/v1/profiles/current");
    onSync?.({ status: "pulled", result });
    return result;
  }

  return Object.freeze({ pushReceipt, pushSnapshot, pullProfile, flushQueue, pending: () => readQueue().length });
}
