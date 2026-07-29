export const PEER_MESSAGE_SCHEMA = "battle-clash.peer-message/1";

const MESSAGE_KINDS = new Set([
  "hello",
  "command",
  "snapshot",
  "room-full"
]);

export function createPeerMessage(kind, payload = {}, context = {}) {
  if (!MESSAGE_KINDS.has(kind)) {
    throw new TypeError(`Unsupported Battle Clash peer message: ${kind}`);
  }
  return {
    schema: PEER_MESSAGE_SCHEMA,
    kind,
    roomId: context.roomId ?? null,
    senderId: context.senderId ?? null,
    sequence: Math.max(0, Number(context.sequence) || 0),
    payload: structuredClone(payload)
  };
}

export function parsePeerMessage(value) {
  if (!value || value.schema !== PEER_MESSAGE_SCHEMA) return null;
  if (!MESSAGE_KINDS.has(value.kind)) return null;
  if (!value.payload || typeof value.payload !== "object") return null;
  return structuredClone(value);
}

export function normalizePeerCommand(value = {}) {
  switch (value.kind) {
    case "deploy":
      return {
        kind: "deploy",
        x: Math.max(-12, Math.min(12, Number(value.x) || 0)),
        z: Math.max(-12, Math.min(12, Number(value.z) || 0))
      };
    case "start":
    case "reset":
    case "fortify":
      return { kind: value.kind };
    default:
      return null;
  }
}
