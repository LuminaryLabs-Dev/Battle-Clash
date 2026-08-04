import { Peer } from "peerjs";
import { ROOM_DIRECTORY, ROOM_IDS } from "../data/network.js";
import {
  createPeerMessage,
  isPeerMessageFresh,
  normalizePeerCommand,
  parsePeerMessage
} from "./peer-protocol.js";
import {
  createAuthenticatedHello,
  validateCommandEnvelope,
  validateAuthenticatedHello
} from "./peer-room-contract.js";

const OPEN_TIMEOUT_MS = 6500;
const SNAPSHOT_CHUNK_SIZE = 3000;

function providerOptions() {
  const host = String(import.meta.env.VITE_PEER_HOST ?? "").trim();
  if (!host) return { debug: 0 };
  return {
    host,
    port: Number(import.meta.env.VITE_PEER_PORT ?? 443),
    path: String(import.meta.env.VITE_PEER_PATH ?? "/battle-clash"),
    key: String(import.meta.env.VITE_PEER_KEY ?? "battle-clash"),
    secure: String(import.meta.env.VITE_PEER_SECURE ?? "true") !== "false",
    debug: 0
  };
}

function waitForPeerOpen(id) {
  return new Promise((resolve, reject) => {
    const peer = id
      ? new Peer(id, providerOptions())
      : new Peer(providerOptions());
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      peer.destroy();
      reject(new Error("PeerJS signaling timed out"));
    }, OPEN_TIMEOUT_MS);

    peer.on("open", () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(peer);
    });
    peer.on("error", (error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      peer.destroy();
      reject(error);
    });
  });
}

function waitForConnectionOpen(connection) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      connection.close();
      reject(new Error("PeerJS room connection timed out"));
    }, OPEN_TIMEOUT_MS);

    connection.on("open", () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(connection);
    });
    connection.on("error", (error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      reject(error);
    });
    connection.on("close", () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      reject(new Error("PeerJS room closed before opening"));
    });
  });
}

function isUnavailableId(error) {
  return String(error?.type ?? error?.message ?? "").includes("unavailable-id");
}

export function createPeerJsRoomAdapter({
  getProfile,
  getIdentity,
  getAuthoritativeSnapshot,
  onCommand,
  onRemoteProfile,
  onRemoteSnapshot,
  onSessionChange
}) {
  let peer = null;
  let connection = null;
  let state = {
    status: "offline",
    mode: "solo",
    role: "solo",
    roomId: null,
    peerId: null,
    connectedPeerId: null,
    authority: "local",
    transport: "peerjs",
    message: "Solo dungeon run ready"
  };
  let sequence = 0;
  let destroyed = false;
  let discovering = false;
  let roomIndex = 0;

  function reconnectToken() {
    const key = "battle-clash-reconnect-token";
    try {
      const existing = window.sessionStorage.getItem(key);
      if (existing) return existing;
      const next = globalThis.crypto?.randomUUID?.() ?? `reconnect-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      window.sessionStorage.setItem(key, next);
      return next;
    } catch {
      return null;
    }
  }

  function roomHello(roomId, role) {
    const identity = getIdentity?.() ?? {};
    if (!identity.userId) return null;
    return createAuthenticatedHello({
      roomId,
      userId: identity.userId,
      role,
      profileRevision: identity.profileRevision ?? 0,
      reconnectToken: reconnectToken()
    });
  }

  function soloAuditRequested() {
    return String(import.meta.env.VITE_BATTLE_CLASH_SOLO ?? "") === "true"
      || new URLSearchParams(window.location.search).get("solo") === "1";
  }

  function enterSoloAudit() {
    updateState({
      status: "degraded",
      mode: "solo",
      role: "solo",
      roomId: null,
      peerId: null,
      connectedPeerId: null,
      authority: "local",
      message: "Solo audit mode — PeerJS disabled for deterministic player validation"
    });
  }

  function updateState(patch) {
    state = { ...state, ...patch };
    onSessionChange?.(structuredClone(state));
  }

  function send(kind, payload = {}) {
    if (!connection?.open) return false;
    if (kind !== "snapshot") {
      sequence += 1;
      const nextPayload = kind === "command"
        ? {
            ...payload,
            envelope: {
              roomId: state.roomId,
              senderId: peer?.id,
              authorityId: state.role === "defender" ? peer?.id : state.connectedPeerId,
              sequence
            }
          }
        : payload;
      connection.send(
        createPeerMessage(kind, nextPayload, {
          roomId: state.roomId,
          senderId: peer?.id,
          sequence
        })
      );
      return true;
    }
    const serialized = JSON.stringify(payload.snapshot ?? {});
    const total = Math.max(1, Math.ceil(serialized.length / SNAPSHOT_CHUNK_SIZE));
    const snapshotId = `${state.roomId}:${sequence + 1}`;
    for (let index = 0; index < total; index += 1) {
      sequence += 1;
      connection.send(
        createPeerMessage("snapshot-chunk", {
          snapshotId,
          index,
          total,
          data: serialized.slice(index * SNAPSHOT_CHUNK_SIZE, (index + 1) * SNAPSHOT_CHUNK_SIZE)
        }, {
          roomId: state.roomId,
          senderId: peer?.id,
          sequence
        })
      );
    }
    return true;
  }

  function releaseTransport() {
    connection?.close();
    connection = null;
    peer?.destroy();
    peer = null;
  }

  function scheduleRediscovery(nextRoomIndex = 0) {
    if (destroyed) return;
    releaseTransport();
    window.setTimeout(() => {
      discover(nextRoomIndex);
    }, 700);
  }

  function bindConnection(nextConnection, role) {
    connection = nextConnection;
    let lastIncomingSequence = 0;
    let incomingSenderId = null;
    const pendingSnapshots = new Map();
    connection.on("data", (raw) => {
      let message = parsePeerMessage(raw);
      if (!message) return;
      if (!isPeerMessageFresh(message, state.roomId, lastIncomingSequence, incomingSenderId)) return;
      incomingSenderId ??= message.senderId ?? null;
      const sequenceNumber = Math.max(0, Number(message.sequence) || 0);
      lastIncomingSequence = sequenceNumber;

      if (message.kind === "snapshot-chunk") {
        const chunk = message.payload;
        if (
          typeof chunk.snapshotId !== "string" ||
          !Number.isInteger(chunk.index) ||
          !Number.isInteger(chunk.total) ||
          chunk.index < 0 ||
          chunk.index >= chunk.total ||
          typeof chunk.data !== "string"
        ) return;
        const entry = pendingSnapshots.get(chunk.snapshotId) ?? {
          total: chunk.total,
          chunks: new Array(chunk.total)
        };
        if (entry.total !== chunk.total) return;
        entry.chunks[chunk.index] = chunk.data;
        pendingSnapshots.set(chunk.snapshotId, entry);
        if (entry.chunks.filter((part) => typeof part === "string").length !== entry.total) return;
        pendingSnapshots.delete(chunk.snapshotId);
        try {
          message = { ...message, kind: "snapshot", payload: { snapshot: JSON.parse(entry.chunks.join("")) } };
        } catch {
          return;
        }
      }

      if (message.kind === "room-full" && role === "attacker") {
        const nextIndex = (roomIndex + 1) % ROOM_IDS.length;
        updateState({
          status: "searching",
          mode: "solo",
          role: "solo",
          connectedPeerId: null,
          authority: "local",
          message: "Room filled — discovering another dungeon"
        });
        scheduleRediscovery(nextIndex);
        return;
      }

      if (message.kind === "hello" && role === "defender") {
        const authenticatedHello = message.payload?.roomHello;
        if (authenticatedHello) {
          const validation = validateAuthenticatedHello(authenticatedHello, state.roomId, { expectedRole: "attacker", requireReconnectToken: true });
          if (!validation.accepted) {
            send("room-full", { reason: validation.reason });
            connection.close();
            return;
          }
          updateState({ authenticated: true, remoteUserId: authenticatedHello.userId, reconnectToken: authenticatedHello.reconnectToken });
          send("hello", {
            profile: structuredClone(getProfile?.() ?? {}),
            roomHello: roomHello(state.roomId, "defender")
          });
        } else {
          updateState({ authenticated: false });
        }
        onRemoteProfile?.(message.payload.profile ?? {});
        send("snapshot", {
          snapshot: getAuthoritativeSnapshot()
        });
        return;
      }

      if (message.kind === "command" && role === "defender") {
        const envelope = message.payload?.envelope;
        const validation = validateCommandEnvelope({
          roomId: envelope?.roomId,
          senderId: envelope?.senderId,
          authorityId: envelope?.authorityId,
          sequence: envelope?.sequence,
          command: message.payload?.command
        });
        if (!validation.accepted || envelope.senderId !== message.senderId || envelope.authorityId !== peer?.id || envelope.sequence !== message.sequence) return;
        const command = normalizePeerCommand(message.payload.command);
        if (command) onCommand?.(command);
        return;
      }

      if (message.kind === "hello" && role === "attacker") {
        const authenticatedHello = message.payload?.roomHello;
        if (authenticatedHello) {
          const validation = validateAuthenticatedHello(authenticatedHello, state.roomId, { expectedRole: "defender", requireReconnectToken: true });
          if (!validation.accepted) {
            connection.close();
            return;
          }
          updateState({ authenticated: true, remoteUserId: authenticatedHello.userId, reconnectToken: authenticatedHello.reconnectToken });
        }
        return;
      }

      if (message.kind === "snapshot" && role === "attacker") {
        const snapshot = message.payload.snapshot;
        if (snapshot?.schema === "battle-clash.snapshot/1") {
          onRemoteSnapshot?.(structuredClone(snapshot));
        }
      }
    });

    connection.on("close", () => {
      if (destroyed || connection !== nextConnection) return;
      updateState({
        status: "disconnected",
        mode: "solo",
        role: "solo",
        connectedPeerId: null,
        authority: "local",
        message: "Peer left — returning to auto-matchmaking"
      });
      scheduleRediscovery(roomIndex);
    });
    connection.on("error", (error) => {
      if (destroyed || connection !== nextConnection) return;
      updateState({
        status: "degraded",
        message: `Peer path degraded — solo play remains active (${error?.type ?? "connection-error"})`
      });
    });
  }

  function becomeDefender(nextPeer, nextRoomId, nextRoomIndex) {
    peer = nextPeer;
    roomIndex = nextRoomIndex;
    updateState({
      status: "searching",
      mode: "solo",
      role: "solo",
      roomId: nextRoomId,
      peerId: peer.id,
      connectedPeerId: null,
      authority: "local",
      message: "Dungeon room open — solo play active while finding an attacker"
    });

    peer.on("connection", (incoming) => {
      if (connection?.open) {
        incoming.on("open", () => {
          incoming.send(
            createPeerMessage("room-full", {}, {
              roomId: nextRoomId,
              senderId: peer.id,
              sequence: ++sequence
            })
          );
          incoming.close();
        });
        return;
      }
      bindConnection(incoming, "defender");
      incoming.on("open", () => {
        updateState({
          status: "connected",
          mode: "peer",
          role: "defender",
          connectedPeerId: incoming.peer,
          authority: "local",
          message: "Defending the dungeon against a matched delver"
        });
      });
    });
  }

  function becomeAttacker(nextPeer, nextConnection, nextRoomId, nextRoomIndex) {
    peer = nextPeer;
    roomIndex = nextRoomIndex;
    bindConnection(nextConnection, "attacker");
    updateState({
      status: "connected",
      mode: "peer",
      role: "attacker",
      roomId: nextRoomId,
      peerId: peer.id,
      connectedPeerId: nextConnection.peer,
      authority: "remote",
      message: "Matched — attack commands route to the defender host",
      authenticated: false
    });
    const hello = roomHello(nextRoomId, "attacker");
    send("hello", {
      profile: structuredClone(getProfile?.() ?? {}),
      roomHello: hello
    });
  }

  async function discover(startIndex = 0) {
    if (destroyed || discovering) return;
    discovering = true;
    updateState({
      status: "searching",
      message: "Auto-discovering an attack / defend room"
    });

    try {
      for (let offset = 0; offset < ROOM_IDS.length; offset += 1) {
        const nextRoomIndex = (startIndex + offset) % ROOM_IDS.length;
        const nextRoomId = ROOM_IDS[nextRoomIndex];
        try {
          const hostPeer = await waitForPeerOpen(nextRoomId);
          if (destroyed) {
            hostPeer.destroy();
            return;
          }
          becomeDefender(hostPeer, nextRoomId, nextRoomIndex);
          return;
        } catch (error) {
          if (!isUnavailableId(error)) throw error;
        }

        const guestPeer = await waitForPeerOpen();
        try {
          const guestConnection = guestPeer.connect(nextRoomId, {
            reliable: true,
            serialization: "json",
            metadata: {
              game: "battle-clash",
              roomSchema: ROOM_DIRECTORY.schema
            }
          });
          await waitForConnectionOpen(guestConnection);
          if (destroyed) {
            guestConnection.close();
            guestPeer.destroy();
            return;
          }
          becomeAttacker(
            guestPeer,
            guestConnection,
            nextRoomId,
            nextRoomIndex
          );
          return;
        } catch {
          guestPeer.destroy();
        }
      }
      updateState({
        status: "degraded",
        mode: "solo",
        role: "solo",
        roomId: null,
        peerId: null,
        connectedPeerId: null,
        authority: "local",
        message: "Rooms unavailable — solo dungeon run is fully playable"
      });
    } catch (error) {
      updateState({
        status: "degraded",
        mode: "solo",
        role: "solo",
        roomId: null,
        peerId: null,
        connectedPeerId: null,
        authority: "local",
        message: `Matchmaking unavailable — solo mode (${error?.type ?? "network"})`
      });
    } finally {
      discovering = false;
    }
  }

  return {
    start: () => (soloAuditRequested() ? enterSoloAudit() : discover(0)),
    getState: () => structuredClone(state),
    getReceiptContext() {
      const identity = getIdentity?.() ?? {};
      const authorityId = state.role === "defender"
        ? identity.userId ?? state.peerId ?? "local"
        : state.role === "attacker"
          ? state.remoteUserId ?? state.connectedPeerId ?? "remote"
          : identity.userId ?? "local";
      return {
        roomId: state.roomId ?? "solo",
        authorityId,
        sequenceEnd: Math.max(1, sequence),
        authenticated: state.role === "solo" || state.authenticated === true
      };
    },
    isRemoteAuthority: () =>
      state.status === "connected" && state.role === "attacker",
    sendCommand(command) {
      if (!normalizePeerCommand(command)) return false;
      return send("command", { command });
    },
    publishSnapshot(snapshot) {
      if (state.status !== "connected" || state.role !== "defender") {
        return false;
      }
      return send("snapshot", { snapshot });
    },
    destroy() {
      destroyed = true;
      releaseTransport();
    }
  };
}
