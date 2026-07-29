import { Peer } from "peerjs";
import { ROOM_DIRECTORY, ROOM_IDS } from "../data/network.js";
import {
  createPeerMessage,
  normalizePeerCommand,
  parsePeerMessage
} from "./peer-protocol.js";

const OPEN_TIMEOUT_MS = 6500;

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

  function updateState(patch) {
    state = { ...state, ...patch };
    onSessionChange?.(structuredClone(state));
  }

  function send(kind, payload = {}) {
    if (!connection?.open) return false;
    sequence += 1;
    connection.send(
      createPeerMessage(kind, payload, {
        roomId: state.roomId,
        senderId: peer?.id,
        sequence
      })
    );
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
    connection.on("data", (raw) => {
      const message = parsePeerMessage(raw);
      if (!message) return;

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
        onRemoteProfile?.(message.payload.profile ?? {});
        send("snapshot", {
          snapshot: getAuthoritativeSnapshot()
        });
        return;
      }

      if (message.kind === "command" && role === "defender") {
        const command = normalizePeerCommand(message.payload.command);
        if (command) onCommand?.(command);
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
    connection.on("error", () => {
      if (destroyed || connection !== nextConnection) return;
      updateState({
        status: "degraded",
        message: "Peer path degraded — solo play remains active"
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
      message: "Matched — attack commands route to the defender host"
    });
    send("hello", {
      profile: structuredClone(getProfile?.() ?? {})
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
    start: () => discover(0),
    getState: () => structuredClone(state),
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
