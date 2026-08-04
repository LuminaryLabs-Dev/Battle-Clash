const DEFAULT_BACKEND_URL = "http://127.0.0.1:3000";

function backendUrl() {
  const env = import.meta.env ?? {};
  return String(env.VITE_BATTLE_CLASH_BACKEND_URL ?? DEFAULT_BACKEND_URL).replace(/\/$/, "");
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

export function createAccountSync({ auth, getSnapshot, onSync, storage = window.localStorage, fetchImpl = globalThis.fetch, backendBaseUrl = backendUrl(), idempotencyKeyFactory = idempotencyKey, retryAttempts = 3, retryDelayMs = 100 } = {}) {
  const queueKey = "battle-clash.sync-queue.v1";

  function readQueue() {
    try { return JSON.parse(storage.getItem(queueKey) ?? "[]"); } catch { return []; }
  }

  function writeQueue(queue) {
    const unique = [...new Map(queue.map((entry) => [entry.idempotencyKey, entry])).values()];
    storage.setItem(queueKey, JSON.stringify(unique.slice(-100)));
  }

  async function request(path, options = {}) {
    const token = auth?.getAccessToken?.();
    if (!token) throw new Error("account-not-authenticated");
    let attempt = 0;
    while (true) {
      try {
        const response = await fetchImpl(`${backendBaseUrl}${path}`, {
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
          if (response.status >= 500 && attempt < retryAttempts) throw error;
          throw error;
        }
        return body;
      } catch (error) {
        if (error.status !== undefined && error.status < 500) throw error;
        if (attempt >= retryAttempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (2 ** attempt)));
        attempt += 1;
      }
    }
  }

  async function pushReceipt(kind, payload) {
    const entry = { kind, payload, idempotencyKey: idempotencyKeyFactory(kind) };
    try {
      const result = await request("/api/v1/receipts", {
        method: "POST",
        headers: { "Idempotency-Key": entry.idempotencyKey },
        body: JSON.stringify({ kind, payload })
      });
      onSync?.({ status: "synced", result });
      return result;
    } catch (error) {
      if (error.status === 409) {
        onSync?.({ status: "conflict", error: error.message, body: error.body });
        return { queued: false, conflict: true, body: error.body };
      }
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

  async function exportProfile() {
    return request("/api/v1/profiles/current/export");
  }

  async function requestAccountDeletion() {
    return request("/api/v1/profiles/current", { method: "DELETE" });
  }

  return Object.freeze({ pushReceipt, pushSnapshot, pullProfile, exportProfile, requestAccountDeletion, flushQueue, pending: () => readQueue().length });
}
