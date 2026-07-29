import { PeerServer } from "peer";

const port = Number(process.env.PORT ?? 9000);
const peerPath = String(process.env.BATTLE_CLASH_PEER_PATH ?? "/battle-clash");
const peerKey = String(process.env.BATTLE_CLASH_PEER_KEY ?? "battle-clash");

const server = PeerServer({
  port,
  path: peerPath,
  key: peerKey,
  proxied: process.env.BATTLE_CLASH_PROXIED === "true",
  allow_discovery: true,
  alive_timeout: 60000
});

server.on("connection", (client) => {
  console.info(`[battle-clash-peer] connected ${client.getId()}`);
});

server.on("disconnect", (client) => {
  console.info(`[battle-clash-peer] disconnected ${client.getId()}`);
});

console.info(
  `[battle-clash-peer] signaling on :${port}${peerPath} with key ${peerKey}`
);
