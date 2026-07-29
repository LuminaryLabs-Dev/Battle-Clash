export const ROOM_DIRECTORY = Object.freeze({
  schema: "battle-clash.room-directory/1",
  prefix: "battle-clash-dungeon-v1-room",
  capacity: 2,
  roomCount: 6,
  authority: "defender-host",
  discovery: "deterministic-room-id-election"
});

export const ROOM_IDS = Object.freeze(
  Array.from(
    { length: ROOM_DIRECTORY.roomCount },
    (_, index) => `${ROOM_DIRECTORY.prefix}-${index}`
  )
);
