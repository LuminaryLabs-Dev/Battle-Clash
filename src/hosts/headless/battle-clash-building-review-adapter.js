import { createBattleClashGame } from "../../composition/create-battle-clash.js";
import { BUILDING_PLOTS } from "../../data/buildings.js";
import { generateProceduralBuilding } from "../../buildings/procedural-building-generator.js";
import { createProceduralBuildingView, disposeProceduralBuildingView } from "../shared/procedural-building-view.js";

export const id = "battle-clash-building-review-adapter";

const BUILD_SEQUENCE = Object.freeze([
  { frame: 24, kind: "place", blueprintId: "barracks", plotId: "plot-northwest" },
  { frame: 64, kind: "place", blueprintId: "foundry", plotId: "plot-northeast" },
  { frame: 104, kind: "place", blueprintId: "watchtower", plotId: "plot-southwest" },
  { frame: 144, kind: "upgrade", buildingId: "building-plot-northwest" },
  { frame: 184, kind: "place", blueprintId: "storehouse", plotId: "plot-southeast" },
  { frame: 224, kind: "upgrade", buildingId: "building-plot-southwest" },
  { frame: 264, kind: "upgrade", buildingId: "building-plot-northwest" }
]);

function baseMesh(THREE, width, height, depth, color, y = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.05 })
  );
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}

export async function setup(input = {}) {
  const THREE = input.THREE ?? await import("three");
  const options = input.options ?? {};
  const game = createBattleClashGame({
    world: { economy: { resources: { gold: 2000, food: 2000, iron: 2000, arcane: 500 } } }
  });
  const scene = new THREE.Scene();
  scene.name = "Battle Clash — Dawnwatch Building Review";
  scene.background = new THREE.Color("#06101f");
  scene.fog = new THREE.Fog("#06101f", 30, 58);

  const camera = new THREE.OrthographicCamera(-15, 15, 8.5, -8.5, 0.1, 120);
  camera.position.set(18.5, 23.5, 18.5);
  camera.lookAt(0, 1.1, 0);
  camera.zoom = Math.min(1.25, Number(options.width ?? 960) / Number(options.height ?? 540) / 1.7);
  camera.updateProjectionMatrix();

  scene.add(new THREE.HemisphereLight("#d8efff", "#150d28", 2.35));
  const sun = new THREE.DirectionalLight("#fff0d4", 3.8);
  sun.position.set(-13, 25, 10);
  sun.castShadow = true;
  scene.add(sun);
  const rim = new THREE.DirectionalLight("#60a5fa", 1.4);
  rim.position.set(16, 12, -18);
  scene.add(rim);
  const coreLight = new THREE.PointLight("#a855f7", 15, 24, 2);
  coreLight.position.set(0, 5.5, 0);
  scene.add(coreLight);

  const platform = baseMesh(THREE, 27, 0.8, 27, "#10192b", -0.42);
  scene.add(platform);
  const ground = baseMesh(THREE, 21, 0.3, 21, "#1b2d4d", -0.05);
  scene.add(ground);
  const grid = new THREE.GridHelper(20, 20, "#7766a6", "#334967");
  grid.position.y = 0.12;
  scene.add(grid);

  const keepDescriptor = generateProceduralBuilding({ id: "dawnwatch-keep", style: "dungeon-heart", level: 3, seed: "dawnwatch-keep" });
  const keep = createProceduralBuildingView(THREE, keepDescriptor);
  keep.position.y = 0.1;
  scene.add(keep);
  const heartPart = keepDescriptor.parts.findIndex((part) => part.kind === "octahedron");
  const heart = keep.children[heartPart];

  const plotViews = new Map();
  for (const plot of BUILDING_PLOTS) {
    const marker = baseMesh(THREE, plot.size[0], 0.08, plot.size[1], "#194d70", 0.15);
    marker.name = plot.id;
    marker.position.x = plot.position.x;
    marker.position.z = plot.position.z;
    marker.material.transparent = true;
    marker.material.opacity = 0.5;
    marker.userData.stableId = plot.id;
    scene.add(marker);
    plotViews.set(plot.id, marker);
  }

  const buildingViews = new Map();
  const eventLog = [];
  let sequenceIndex = 0;

  function sync() {
    const state = game.getSnapshot().buildings;
    for (const [id, entry] of buildingViews) {
      const structure = state.structures[id];
      if (structure && entry.level === structure.level) continue;
      scene.remove(entry.view);
      disposeProceduralBuildingView(entry.view);
      buildingViews.delete(id);
    }
    for (const structure of Object.values(state.structures)) {
      if (buildingViews.has(structure.id)) continue;
      const view = createProceduralBuildingView(THREE, generateProceduralBuilding({
        id: structure.id,
        blueprintId: structure.blueprintId,
        level: structure.level,
        seed: structure.seed
      }));
      view.position.set(structure.position.x, 0.12, structure.position.z);
      scene.add(view);
      buildingViews.set(structure.id, { view, level: structure.level });
    }
    for (const plot of state.plots) {
      const marker = plotViews.get(plot.id);
      marker.material.color.set(plot.buildingId ? "#854d0e" : state.selectedPlotId === plot.id ? "#22d3ee" : "#194d70");
      marker.material.opacity = plot.buildingId ? 0.24 : state.selectedPlotId === plot.id ? 0.75 : 0.42;
    }
    return state;
  }

  function applyAction(action) {
    let result;
    if (action.kind === "place") result = game.placeBuilding(action);
    else if (action.kind === "upgrade") result = game.upgradeBuilding(action.buildingId);
    else result = { accepted: false, reason: "unknown-review-action" };
    eventLog.push({ ...action, accepted: result.accepted, reason: result.reason ?? null, receipt: result.receipt ?? null });
    sync();
  }

  function snapshot() {
    const current = game.getSnapshot();
    return {
      revision: current.buildings.revision,
      structureCount: Object.keys(current.buildings.structures).length,
      structures: structuredClone(current.buildings.structures),
      bonuses: structuredClone(current.buildings.bonuses),
      resources: structuredClone(current.economy.resources),
      digest: game.getDigest()
    };
  }

  sync();
  return {
    THREE,
    scene,
    camera,
    targets: [...plotViews.values()],
    idFor: (object) => object.userData.stableId ?? object.name,
    scenePacket: () => ({ schema: "battle-clash.headless-building-scene/1", id: "dawnwatch-sanctum", plotCount: BUILDING_PLOTS.length }),
    snapshot,
    events: () => eventLog,
    async act(targetId) {
      const action = BUILD_SEQUENCE.find((candidate) => candidate.plotId === targetId);
      if (!action) return { ok: false, reason: "unknown-target" };
      applyAction(action);
      return { ok: true, action };
    },
    async step(delta, time, frame) {
      while (sequenceIndex < BUILD_SEQUENCE.length && frame >= BUILD_SEQUENCE[sequenceIndex].frame) {
        applyAction(BUILD_SEQUENCE[sequenceIndex]);
        sequenceIndex += 1;
      }
      if (heart) {
        heart.rotation.y = time * 0.9;
        heart.rotation.x = time * 0.25;
        heart.position.y = keepDescriptor.parts[heartPart].position[1] + Math.sin(time * 2.5) * 0.12;
      }
      coreLight.intensity = 13 + Math.sin(time * 2.2) * 2;
      camera.position.x = 18.5 + Math.sin(time * 0.24) * 1.2;
      camera.lookAt(0, 1.1, 0);
      sync();
    },
    review: {
      source: "Battle Clash authoritative NexusEngine building domain and shared procedural building renderer",
      action: "Place four buildings and upgrade the Delver Hall and Frontier Watch through real game APIs",
      boundary: "Authoritative state, collision/cost rules, procedural Three presentation, and fixed-step animation; browser DOM delivery is separate"
    }
  };
}
