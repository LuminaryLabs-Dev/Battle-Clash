import { CONTENT_TERRITORIES, ROOM_TYPES } from "../../data/production-content.js";

const ROOM_SCHEMA = "battle-clash.room-state/1";

function clone(value) {
  return structuredClone(value);
}

export function roomChainForTerritory(territoryId) {
  const territory = CONTENT_TERRITORIES.find((entry) => entry.id === territoryId);
  return (territory?.rooms ?? [])
    .map((id) => ({ id, ...(ROOM_TYPES[id] ?? {}) }))
    .filter((room) => room.kind && room.objective);
}

export function createRoomState(territoryId = null, roomId = null, completedRoomIds = []) {
  const chain = roomChainForTerritory(territoryId);
  const completed = [...new Set((Array.isArray(completedRoomIds) ? completedRoomIds : []).map(String))]
    .filter((id) => chain.some((room) => room.id === id));
  const requestedIndex = roomId ? chain.findIndex((room) => room.id === roomId) : -1;
  const nextUnclearedIndex = chain.findIndex((room) => !completed.includes(room.id));
  const index = requestedIndex >= 0
    ? requestedIndex
    : nextUnclearedIndex >= 0
      ? nextUnclearedIndex
      : Math.max(0, chain.length - 1);
  const current = chain[index] ?? null;
  return {
    schema: ROOM_SCHEMA,
    status: current ? "active" : "idle",
    territoryId: territoryId ?? null,
    roomId: current?.id ?? null,
    kind: current?.kind ?? null,
    objective: current?.objective ?? null,
    exits: clone(current?.exits ?? []),
    index: current ? index : -1,
    total: chain.length,
    completedRoomIds: completed,
    hasNext: Boolean(current && index < chain.length - 1),
    chain: chain.map(({ id, kind, objective, exits }) => ({ id, kind, objective, exits: clone(exits ?? []) }))
  };
}

export function advanceRoomState(state = {}) {
  if (!state.hasNext || !state.territoryId) {
    return { accepted: false, reason: "room-chain-complete", state: clone(state) };
  }
  const next = state.chain?.[Number(state.index) + 1];
  if (!next) return { accepted: false, reason: "room-not-found", state: clone(state) };
  return {
    accepted: true,
    completedRoomId: state.roomId,
    state: createRoomState(
      state.territoryId,
      next.id,
      [...(state.completedRoomIds ?? []), state.roomId]
    )
  };
}
