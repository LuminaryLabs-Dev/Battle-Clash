export const PEER_MESSAGE_SCHEMA = "battle-clash.peer-message/1";

const MESSAGE_KINDS = new Set([
  "hello",
  "command",
  "snapshot",
  "snapshot-chunk",
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

export function isPeerMessageFresh(message, roomId, lastSequence = 0, expectedSenderId = null) {
  if (!message || message.roomId !== roomId) return false;
  if (expectedSenderId && message.senderId !== expectedSenderId) return false;
  const sequence = Math.max(0, Number(message.sequence) || 0);
  return sequence > Math.max(0, Number(lastSequence) || 0);
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
    case "hero-ability":
      return { kind: value.kind, abilityId: String(value.abilityId ?? "arc-burst") };
    case "heal-army":
    case "upgrade-sanctum":
      return { kind: value.kind };
    case "recruit-army":
      return { kind: value.kind, archetype: String(value.archetype ?? "delver") };
    case "select-archetype":
      return { kind: value.kind, archetype: String(value.archetype ?? "delver") };
    case "trade-resources":
      return {
        kind: value.kind,
        from: String(value.from ?? "iron"),
        to: String(value.to ?? "gold"),
        amount: Math.max(0, Math.floor(Number(value.amount) || 0)),
        routeId: value.routeId ? String(value.routeId) : null
      };
    case "scene":
      return {
        kind: "scene",
        sceneId: String(value.sceneId ?? "sanctum"),
        territoryId: value.territoryId ? String(value.territoryId) : null,
        frontDirection: value.frontDirection ? String(value.frontDirection) : null
      };
    case "discover":
    case "claim":
      return { kind: value.kind, territoryId: String(value.territoryId ?? "") };
    case "interact-landmark":
      return { kind: value.kind, landmarkId: String(value.landmarkId ?? "") };
    case "move-hero":
      return {
        kind: "move-hero",
        x: Math.max(0, Math.min(99, Math.round(Number(value.x) || 0))),
        z: Math.max(0, Math.min(99, Math.round(Number(value.z) || 0)))
      };
    default:
      return null;
  }
}
