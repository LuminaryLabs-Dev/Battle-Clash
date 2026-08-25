import { createBattleClashGame } from "../../composition/create-battle-clash.js";
import { battleBuildingStyle, generateProceduralBuilding } from "../../buildings/procedural-building-generator.js";
import { createProceduralBuildingView } from "../shared/procedural-building-view.js";

export const id = "battle-clash-headless-three-adapter";

const DEPLOYMENT_PATTERN = Object.freeze([
  [-10.5, -6],
  [-10.5, -3],
  [-10.5, 0],
  [-10.5, 3],
  [-10.5, 6]
]);

function colorFor(entity) {
  return entity.renderable?.color
    ?? (entity.faction === "player" ? "#38bdf8" : "#f43f5e");
}

function sizeFor(entity) {
  const size = entity.renderable?.size;
  return Array.isArray(size) && size.length === 3 ? size : [1, 1, 1];
}

function makeEntityObject(THREE, entity) {
  const [width, height, depth] = sizeFor(entity);
  const group = new THREE.Group();
  group.name = entity.id;
  group.userData.entityId = entity.id;

  const buildingStyle = battleBuildingStyle(entity);
  if (buildingStyle) {
    const view = createProceduralBuildingView(THREE, generateProceduralBuilding({
      id: `${entity.id}:procedural`,
      style: buildingStyle,
      level: entity.role === "core" ? 3 : entity.role === "wall" ? 1 : 2,
      seed: entity.id
    }));
    view.position.y = 0;
    group.add(view);
    return group;
  }

  let geometry;
  if (entity.role === "core") geometry = new THREE.OctahedronGeometry(Math.max(width, depth) * 0.72, 1);
  else if (entity.role === "resource") geometry = new THREE.DodecahedronGeometry(Math.max(width, depth) * 0.55, 0);
  else if (entity.category === "troop") geometry = new THREE.CapsuleGeometry(width * 0.38, Math.max(0.2, height * 0.55), 5, 10);
  else geometry = new THREE.BoxGeometry(width, height, depth, 1, 1, 1);

  const material = new THREE.MeshStandardMaterial({
    color: colorFor(entity),
    emissive: entity.renderable?.emissive ?? "#111827",
    emissiveIntensity: entity.role === "core" ? 0.9 : 0.28,
    roughness: entity.category === "troop" ? 0.55 : 0.78,
    metalness: entity.role === "core" || entity.role === "resource" ? 0.32 : 0.08
  });
  const body = new THREE.Mesh(geometry, material);
  body.name = `${entity.id}:body`;
  body.castShadow = true;
  body.receiveShadow = true;
  body.position.y = entity.role === "core" || entity.role === "resource" ? height * 0.54 : height * 0.5;
  group.add(body);

  if (entity.health) {
    const bar = new THREE.Group();
    bar.name = `${entity.id}:health`;
    const background = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.65, width), 0.1, 0.08),
      new THREE.MeshBasicMaterial({ color: "#1f2937" })
    );
    const fill = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.65, width), 0.07, 0.1),
      new THREE.MeshBasicMaterial({ color: entity.faction === "player" ? "#22d3ee" : "#fb7185" })
    );
    fill.name = `${entity.id}:health-fill`;
    fill.position.z = 0.02;
    bar.position.y = height * 1.42;
    bar.add(background, fill);
    group.add(bar);
  }
  return group;
}

function createArena(THREE, scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 26, 1, 1),
    new THREE.MeshStandardMaterial({ color: "#17233a", roughness: 0.92, metalness: 0.02 })
  );
  floor.name = "obsidian-vault-floor";
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const inner = new THREE.Mesh(
    new THREE.PlaneGeometry(17, 17),
    new THREE.MeshStandardMaterial({ color: "#251d3d", roughness: 0.88, metalness: 0.08 })
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.015;
  inner.receiveShadow = true;
  scene.add(inner);

  const laneMaterial = new THREE.MeshBasicMaterial({ color: "#334b6f" });
  for (let index = -3; index <= 3; index += 1) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 24), laneMaterial);
    line.position.set(index * 4, 0.03, 0);
    scene.add(line);
  }
  for (let index = -3; index <= 3; index += 1) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(28, 0.02, 0.035), laneMaterial);
    line.position.set(0, 0.03, index * 4);
    scene.add(line);
  }

  const plinthMaterial = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.82, metalness: 0.25 });
  for (const [x, z] of [[-13, -11], [-13, 11], [13, -11], [13, 11]]) {
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.45, 2.4, 8), plinthMaterial);
    plinth.position.set(x, 1.2, z);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    scene.add(plinth);
  }
}

export async function setup(input = {}) {
  const THREE = input.THREE ?? await import("three");
  const options = input.options ?? {};
  const game = createBattleClashGame();
  const scene = new THREE.Scene();
  scene.name = "Battle Clash — Obsidian Vault";
  scene.background = new THREE.Color("#07101f");
  scene.fog = new THREE.Fog("#07101f", 30, 54);
  createArena(THREE, scene);

  const camera = new THREE.PerspectiveCamera(42, Number(options.width ?? 960) / Number(options.height ?? 540), 0.1, 120);
  camera.position.set(22, 24, 25);
  camera.lookAt(0, 1.5, 0);

  const hemisphere = new THREE.HemisphereLight("#c9e7ff", "#151022", 1.8);
  scene.add(hemisphere);
  const key = new THREE.DirectionalLight("#fff1d6", 3.1);
  key.position.set(-10, 22, 14);
  key.castShadow = true;
  scene.add(key);
  const enemyGlow = new THREE.PointLight("#a855f7", 28, 24, 1.7);
  enemyGlow.position.set(0, 7, 0);
  scene.add(enemyGlow);
  const playerGlow = new THREE.PointLight("#22d3ee", 19, 18, 1.7);
  playerGlow.position.set(-10, 4, 0);
  scene.add(playerGlow);

  const deploySlot = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.35, 0.12, 32),
    new THREE.MeshStandardMaterial({ color: "#0891b2", emissive: "#22d3ee", emissiveIntensity: 0.75, transparent: true, opacity: 0.72 })
  );
  deploySlot.name = "deploy-slot";
  deploySlot.userData.stableId = "deploy-slot";
  deploySlot.position.set(-10.5, 0.1, 0);
  scene.add(deploySlot);

  const entityObjects = new Map();
  const eventLog = [];
  let raidStarted = false;
  let videoFrame = 0;

  function sync() {
    const snapshot = game.getSnapshot();
    const live = new Set();
    for (const entity of snapshot.entities) {
      live.add(entity.id);
      let object = entityObjects.get(entity.id);
      if (!object) {
        object = makeEntityObject(THREE, entity);
        entityObjects.set(entity.id, object);
        scene.add(object);
      }
      object.position.set(entity.position.x, entity.position.y, entity.position.z);
      const fill = object.getObjectByName(`${entity.id}:health-fill`);
      if (fill && entity.health) {
        const ratio = Math.max(0.001, entity.health.current / entity.health.maximum);
        fill.scale.x = ratio;
        fill.position.x = -(1 - ratio) * sizeFor(entity)[0] * 0.5;
      }
    }
    for (const [entityId, object] of entityObjects) {
      if (live.has(entityId)) continue;
      scene.remove(object);
      entityObjects.delete(entityId);
    }
    const phase = snapshot.raid.phase;
    deploySlot.material.color.set(phase === "deploy" ? "#0891b2" : "#475569");
    deploySlot.material.emissive.set(phase === "deploy" ? "#22d3ee" : "#1e293b");
    return snapshot;
  }

  function compactSnapshot() {
    const snapshot = game.getSnapshot();
    return {
      frame: snapshot.frame,
      raidPhase: snapshot.raid.phase,
      raidTimer: snapshot.raid.timer,
      deploymentRemaining: snapshot.deployment.remaining,
      playerUnits: snapshot.entities.filter((entity) => entity.faction === "player").length,
      enemyStructures: snapshot.entities.filter((entity) => entity.faction === "enemy" && entity.health?.current > 0).length,
      coreHealth: snapshot.coreHealth,
      digest: game.getDigest()
    };
  }

  async function deployAndRaid() {
    if (raidStarted) return { ok: true, duplicate: true };
    for (const [x, z] of DEPLOYMENT_PATTERN) {
      if (!game.canDeployAt(x, z)) continue;
      game.deployAt(x, z);
      game.tick();
      eventLog.push({ type: "deploy", x, z, frame: game.getSnapshot().frame });
    }
    game.startRaid();
    game.tick();
    raidStarted = true;
    eventLog.push({ type: "raid-started", frame: game.getSnapshot().frame });
    sync();
    return { ok: true, raidPhase: game.getSnapshot().raid.phase, deployed: DEPLOYMENT_PATTERN.length };
  }

  sync();
  return {
    THREE,
    scene,
    camera,
    assets: ["game-owned procedural headless presentation"],
    targets: [deploySlot],
    idFor: (object) => object.userData.stableId ?? object.name,
    scenePacket: () => ({
      schema: "battle-clash.headless-scene/1",
      id: "obsidian-vault",
      camera: { fov: camera.fov, position: camera.position.toArray() },
      entityCount: game.getSnapshot().entities.length,
      targetIds: ["deploy-slot"]
    }),
    snapshot: compactSnapshot,
    sync,
    async act(targetId) {
      if (targetId !== "deploy-slot") return { ok: false, reason: "unknown-target" };
      return deployAndRaid();
    },
    async step(delta, time, frame) {
      videoFrame = frame ?? videoFrame + 1;
      if (options.seconds && !raidStarted && videoFrame === Math.max(4, Math.round(Number(options.fps ?? 24) * 0.7))) {
        await deployAndRaid();
      }
      if (raidStarted) game.tick();
      const pulse = 1 + Math.sin((time ?? videoFrame * delta) * 5) * 0.08;
      deploySlot.scale.set(pulse, 1, pulse);
      enemyGlow.intensity = 25 + Math.sin((time ?? 0) * 2.5) * 5;
      camera.position.x = 22 + Math.sin((time ?? 0) * 0.28) * 1.4;
      camera.lookAt(0, 1.4, 0);
      sync();
    },
    events: () => eventLog,
    review: {
      source: "Battle Clash authoritative NexusEngine simulation through its game-owned Three.js headless host adapter",
      action: "Raycast the deploy slot, deploy five units, start the raid, and advance fixed simulation steps",
      boundary: "Projection, raycast, and service-level interaction are covered; browser DOM event delivery is intentionally out of scope"
    }
  };
}
