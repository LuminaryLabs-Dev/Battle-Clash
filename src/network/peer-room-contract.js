export const ROOM_CONTRACT_SCHEMA = "battle-clash.room-contract/1";

export function createAuthenticatedHello({ roomId, userId, role, profileRevision = 0, reconnectToken = null } = {}) {
  if (!roomId || !userId || !["attacker", "defender"].includes(role)) throw new TypeError("room hello requires room, user, and role");
  return Object.freeze({ schema: ROOM_CONTRACT_SCHEMA, roomId, userId, role, profileRevision: Math.max(0, Number(profileRevision) || 0), reconnectToken: reconnectToken ? String(reconnectToken) : null });
}

export function validateAuthenticatedHello(hello, expectedRoomId, options = {}) {
  const accepted = hello?.schema === ROOM_CONTRACT_SCHEMA
    && hello.roomId === expectedRoomId
    && Boolean(hello.userId)
    && ["attacker", "defender"].includes(hello.role)
    && (!options.expectedUserId || hello.userId === options.expectedUserId)
    && (!options.requireReconnectToken || Boolean(hello.reconnectToken));
  return { accepted, reason: accepted ? null : "invalid-room-hello" };
}

export function validateCommandEnvelope({ roomId, senderId, authorityId, sequence, command } = {}) {
  const accepted = Boolean(roomId && senderId && authorityId && senderId !== authorityId && Number.isInteger(sequence) && sequence > 0 && command?.kind);
  return { accepted, reason: accepted ? null : "invalid-command-envelope" };
}

export function createMatchReceipt({ roomId, authorityId, profileRevision = 0, sequenceStart, sequenceEnd, result, rewardIdempotencyKey } = {}) {
  if (!roomId || !authorityId || !result || !rewardIdempotencyKey || !Number.isInteger(sequenceStart) || sequenceStart < 1 || !Number.isInteger(sequenceEnd) || sequenceEnd < sequenceStart) throw new TypeError("invalid match receipt");
  return Object.freeze({ schema: "battle-clash.match-receipt/1", roomId, authorityId, profileRevision: Math.max(0, Number(profileRevision) || 0), sequenceStart, sequenceEnd, result, rewardIdempotencyKey });
}

export function acceptMatchReceipt(receipt, { roomId, authorityId, lastAcceptedKey = null } = {}) {
  const accepted = receipt?.schema === "battle-clash.match-receipt/1" && receipt.roomId === roomId && receipt.authorityId === authorityId && receipt.rewardIdempotencyKey !== lastAcceptedKey && Number.isInteger(receipt.sequenceStart) && receipt.sequenceStart > 0 && Number.isInteger(receipt.sequenceEnd) && receipt.sequenceEnd >= receipt.sequenceStart;
  return { accepted, reason: accepted ? null : "rejected-match-receipt" };
}
