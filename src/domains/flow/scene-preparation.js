import { Resources } from "../shared/definitions.js";

export const SCENE_PREPARATION_SCHEMA = "battle-clash.scene-preparation/1";

const REQUIRED_KINDS = new Set(["ecs-data", "assets", "camera"]);

export function createScenePreparationManifest(scene = {}, { assets = [] } = {}) {
  const sceneId = String(scene.id ?? "").trim();
  if (!sceneId) throw new TypeError("Scene preparation requires a scene id.");
  const metadata = scene.metadata ?? {};
  const assetIds = [...new Set([...(metadata.assets ?? []), ...assets].map((value) => String(value).trim()).filter(Boolean))];
  return [
    { id: `${sceneId}:ecs-data`, kind: "ecs-data", label: "Scene data", weight: 2, required: true, status: "waiting", progress: 0 },
    { id: `${sceneId}:assets`, kind: "assets", label: "Scene assets", weight: 2, required: true, status: assetIds.length ? "waiting" : "ready", progress: assetIds.length ? 0 : 1, assetIds },
    { id: `${sceneId}:textures`, kind: "textures", label: "Textures", weight: 1, required: false, status: "ready", progress: 1 },
    { id: `${sceneId}:audio`, kind: "audio", label: "Ambient audio", weight: 1, required: false, status: "ready", progress: 1 },
    { id: `${sceneId}:effects`, kind: "effects", label: "Effects", weight: 1, required: false, status: "ready", progress: 1 },
    { id: `${sceneId}:camera`, kind: "camera", label: "Camera target", weight: 1, required: true, status: "waiting", progress: 0 }
  ];
}

export function validateScenePreparationManifest(manifest = []) {
  if (!Array.isArray(manifest) || manifest.length === 0) return { accepted: false, reason: "empty-manifest" };
  const ids = new Set();
  for (const preparation of manifest) {
    if (!preparation?.id || ids.has(preparation.id)) return { accepted: false, reason: "duplicate-preparation-id" };
    ids.add(preparation.id);
    if (!preparation.kind || !Number.isFinite(Number(preparation.weight))) return { accepted: false, reason: "invalid-preparation" };
    if (preparation.required !== false && !REQUIRED_KINDS.has(preparation.kind)) return { accepted: false, reason: "unknown-required-kind" };
  }
  return { accepted: true, count: manifest.length, required: manifest.filter((item) => item.required !== false).length };
}

export function installScenePreparationState(world) {
  if (!world.hasResource(Resources.ScenePreparationState)) {
    world.setResource(Resources.ScenePreparationState, {
      schema: SCENE_PREPARATION_SCHEMA,
      sceneId: null,
      manifest: [],
      sequence: 0,
      status: "idle"
    });
  }
}
