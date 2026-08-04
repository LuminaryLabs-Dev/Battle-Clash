import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BATTLEFIELD } from "../../data/battlefield.js";
import { TERRITORIES, isTerritorySceneId } from "../../data/world.js";
import { assetById } from "../../assets/catalog.js";

const sharedBody = new RoundedBoxGeometry(1, 1, 1, 4, 0.08);
const sharedCap = new RoundedBoxGeometry(1, 1, 1, 3, 0.12);
const sharedEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
const sharedHealthBack = new RoundedBoxGeometry(1, 0.08, 0.13, 2, 0.03);
const sharedHealthFill = new RoundedBoxGeometry(1, 0.09, 0.15, 2, 0.03);
const sharedShadow = new THREE.CircleGeometry(0.72, 32);
const sharedCrest = new RoundedBoxGeometry(0.52, 0.06, 0.1, 2, 0.025);
const sharedProjectile = new THREE.SphereGeometry(0.13, 12, 12);
const sharedProjectileAura = new THREE.SphereGeometry(0.25, 12, 12);
const white = new THREE.Color(0xffffff);

function liftedColor(value, amount) {
  return new THREE.Color(value).lerp(white, amount);
}

function accentFor(entity) {
  if (entity.role === "core") return 0xe9d5ff;
  if (entity.role === "defense") return 0xfda4af;
  if (entity.role === "resource") return 0xfde68a;
  if (entity.role === "wall") return 0x94a3b8;
  return 0xbae6fd;
}

function createEntityView(entity) {
  const group = new THREE.Group();
  group.name = entity.id;

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: entity.renderable.color,
    emissive: entity.renderable.emissive,
    emissiveIntensity: entity.role === "core" ? 0.5 : 0.2,
    roughness: entity.role === "wall" ? 0.9 : 0.58,
    metalness: entity.role === "defense" ? 0.26 : 0.08
  });
  const body = new THREE.Mesh(sharedBody, bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  body.scale.fromArray(entity.renderable.size);
  group.add(body);

  const shadow = new THREE.Mesh(
    sharedShadow,
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: entity.role === "core" ? 0.4 : 0.28,
      depthWrite: false
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -entity.renderable.size[1] / 2 + 0.018;
  shadow.scale.set(
    entity.renderable.size[0] * 0.9,
    entity.renderable.size[2] * 0.9,
    1
  );
  group.add(shadow);

  const capMaterial = new THREE.MeshStandardMaterial({
    color: liftedColor(entity.renderable.color, entity.role === "wall" ? 0.12 : 0.26),
    emissive: entity.renderable.emissive,
    emissiveIntensity: entity.role === "core" ? 0.72 : 0.28,
    roughness: 0.42,
    metalness: 0.18
  });
  const cap = new THREE.Mesh(sharedCap, capMaterial);
  cap.position.y = entity.renderable.size[1] / 2 + 0.025;
  cap.scale.set(
    entity.renderable.size[0] * 0.86,
    entity.role === "wall" ? 0.075 : 0.11,
    entity.renderable.size[2] * 0.86
  );
  cap.castShadow = true;
  group.add(cap);

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: accentFor(entity),
    transparent: true,
    opacity: entity.faction === "player" ? 0.52 : 0.32
  });
  const edges = new THREE.LineSegments(sharedEdges, edgeMaterial);
  edges.scale.fromArray(entity.renderable.size.map((value) => value * 1.006));
  group.add(edges);

  let crest = null;
  if (entity.role !== "wall") {
    crest = new THREE.Mesh(
      sharedCrest,
      new THREE.MeshBasicMaterial({
        color: accentFor(entity),
        transparent: true,
        opacity: 0.92
      })
    );
    crest.position.y = entity.renderable.size[1] / 2 + 0.105;
    crest.scale.x = Math.max(0.7, entity.renderable.size[0] * 0.72);
    crest.rotation.y =
      entity.role === "defense"
        ? Math.PI / 4
        : entity.role === "resource"
          ? -Math.PI / 4
          : 0;
    group.add(crest);
  }

  let healthBack = null;
  let healthFill = null;
  if (entity.health) {
    const top = entity.renderable.size[1] / 2 + 0.34;
    healthBack = new THREE.Mesh(
      sharedHealthBack,
      new THREE.MeshBasicMaterial({
        color: 0x020617,
        transparent: true,
        opacity: 0.86,
        depthTest: false
      })
    );
    healthBack.position.set(0, top, 0);
    healthBack.scale.x = Math.max(0.82, entity.renderable.size[0] * 0.7);
    healthBack.renderOrder = 10;
    healthBack.visible = false;
    group.add(healthBack);

    healthFill = new THREE.Mesh(
      sharedHealthFill,
      new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        depthTest: false
      })
    );
    healthFill.position.set(0, top + 0.012, 0);
    healthFill.userData.fullWidth = healthBack.scale.x;
    healthFill.renderOrder = 11;
    healthFill.visible = false;
    group.add(healthFill);
  }

  const coreRings = [];
  if (entity.role === "core") {
    for (const [radius, tube, opacity] of [
      [2.28, 0.075, 0.54],
      [1.88, 0.045, 0.34]
    ]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, tube, 8, 64),
        new THREE.MeshBasicMaterial({
          color: 0xe9d5ff,
          transparent: true,
          opacity
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -entity.renderable.size[1] / 2 + 0.09;
      group.add(ring);
      coreRings.push(ring);
    }

    const inner = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.62, 0),
      new THREE.MeshStandardMaterial({
        color: 0xf3e8ff,
        emissive: 0xa855f7,
        emissiveIntensity: 2.4,
        roughness: 0.18,
        metalness: 0.22
      })
    );
    inner.position.y = 0.34;
    inner.castShadow = true;
    group.add(inner);
    group.userData.inner = inner;
  }

  group.userData = {
    ...group.userData,
    body,
    cap,
    crest,
    edges,
    shadow,
    healthBack,
    healthFill,
    coreRings,
    role: entity.role,
    category: entity.category,
    territoryMarker: Boolean(entity.territoryMarker),
    faction: entity.faction,
    movement: entity.movement?.state ?? null,
    assetId: entity.renderable?.assetId ?? null,
    fallbackParts: [body, cap, edges, crest].filter(Boolean),
    assetRoot: null,
    assetRequested: false,
    assetFailed: false,
    baseScale: [...entity.renderable.size],
    lastHealthRatio: entity.health ? 1 : null,
    damageFlashUntil: 0
  };
  return group;
}

function createDeploymentMarkers() {
  const group = new THREE.Group();
  group.name = "deployment-runes";
  const geometry = new RoundedBoxGeometry(0.72, 0.055, 0.72, 2, 0.1);
  const material = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.2,
    depthWrite: false
  });
  const points = [];
  for (let offset = -10; offset <= 10; offset += 2) {
    points.push([offset, -10.5], [offset, 10.5]);
    if (Math.abs(offset) < 9.5) {
      points.push([-10.5, offset], [10.5, offset]);
    }
  }
  for (const [x, z] of points) {
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(x, 0.075, z);
    marker.rotation.y = Math.PI / 4;
    group.add(marker);
  }
  group.userData.material = material;
  return group;
}

function createVoidStars() {
  let state = 0x4f1bbcdc;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  const positions = [];
  for (let index = 0; index < 180; index += 1) {
    const radius = 18 + random() * 35;
    const angle = random() * Math.PI * 2;
    positions.push(
      Math.cos(angle) * radius,
      -0.58 + random() * 0.12,
      Math.sin(angle) * radius
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0x4675a4,
      size: 0.12,
      transparent: true,
      opacity: 0.52,
      depthWrite: false
    })
  );
}

function createTerritoryMap() {
  const group = new THREE.Group();
  group.name = "frontier-map";
  const positions = new Map();
  const scale = 2.2;
  for (const territory of TERRITORIES) {
    const x = (territory.coordinates.x - 1) * scale;
    const z = (territory.coordinates.z - 0.5) * scale;
    positions.set(territory.id, { x, z });
  }
  const routeMaterial = new THREE.LineBasicMaterial({
    color: 0x64748b,
    transparent: true,
    opacity: 0.58
  });
  const routes = new THREE.Group();
  const routeLines = [];
  for (const territory of TERRITORIES) {
    const from = positions.get(territory.id);
    for (const neighborId of Object.values(territory.neighbors)) {
      const to = positions.get(neighborId);
      if (!to || territory.id > neighborId) continue;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(from.x, 0.14, from.z),
        new THREE.Vector3(to.x, 0.14, to.z)
      ]);
      const line = new THREE.Line(geometry, routeMaterial.clone());
      line.userData.routeKey = `${territory.id}:${neighborId}`;
      routeLines.push(line);
      routes.add(line);
    }
  }
  group.add(routes);
  for (const territory of TERRITORIES) {
    const node = new THREE.Group();
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(1.45, 0.78, 1.45, 4, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.72, metalness: 0.18 })
    );
    body.castShadow = true;
    body.receiveShadow = true;
    const crown = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 0),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, emissive: 0x0f172a, emissiveIntensity: 0.5 })
    );
    crown.position.y = 0.66;
    crown.castShadow = true;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1.05, 6),
      new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.56, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    node.add(body, crown, ring);
    node.position.set(positions.get(territory.id).x, 0, positions.get(territory.id).z);
    node.userData = { territoryId: territory.id, body, crown, ring };
    group.add(node);
  }
  group.userData.positions = positions;
  group.userData.routeLines = routeLines;
  return group;
}

function createSanctumView() {
  const group = new THREE.Group();
  group.name = "dawnwatch-sanctum";
  const base = new THREE.Mesh(
    new RoundedBoxGeometry(8, 0.72, 8, 6, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x172554, emissive: 0x172554, emissiveIntensity: 0.32, roughness: 0.72 })
  );
  base.position.y = -0.12;
  base.receiveShadow = true;
  const heart = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1, 0),
    new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x0ea5e9, emissiveIntensity: 1.8, roughness: 0.24, metalness: 0.18 })
  );
  heart.position.y = 1.35;
  heart.castShadow = true;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.15, 0.075, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.68 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  group.add(base, heart, ring);
  group.userData = { heart, ring };
  return group;
}

function projectedFrameSize(camera) {
  camera.updateMatrixWorld(true);
  const half = BATTLEFIELD.halfSize + 2.2;
  const points = [];
  for (const x of [-half, half]) {
    for (const y of [-0.5, 5.2]) {
      for (const z of [-half, half]) {
        points.push(
          new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse)
        );
      }
    }
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    width: Math.max(...xs) - Math.min(...xs) + 2.4,
    height: Math.max(...ys) - Math.min(...ys) + 2.4
  };
}

export function createThreeHost({
  canvas,
  onDeploy,
  onHeroMove,
  onTerritorySelect,
  onFrontSelect,
  onLandmarkSelect,
  canDeployAt
}) {
  const scene = new THREE.Scene();
  const baseBackground = new THREE.Color(0x02040b);
  scene.background = baseBackground.clone();
  scene.fog = new THREE.Fog(0x02040b, 32, 62);

  const camera = new THREE.OrthographicCamera(-16, 16, 12, -12, 0.1, 120);
  camera.position.set(18.5, 23.5, 18.5);
  camera.lookAt(0, 0.25, 0);
  camera.updateMatrixWorld(true);
  const cameraTarget = new THREE.Vector3(0, 0.25, 0);
  const cameraIntentPosition = new THREE.Vector3(18.5, 23.5, 18.5);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  scene.add(new THREE.HemisphereLight(0xc7ecff, 0x120b26, 2.35));
  scene.add(new THREE.AmbientLight(0x6987ad, 0.22));

  const sun = new THREE.DirectionalLight(0xffefd0, 3.65);
  sun.position.set(-13, 25, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -19;
  sun.shadow.camera.right = 19;
  sun.shadow.camera.top = 19;
  sun.shadow.camera.bottom = -19;
  sun.shadow.bias = -0.00022;
  scene.add(sun);

  const coolRim = new THREE.DirectionalLight(0x60a5fa, 1.45);
  coolRim.position.set(16, 12, -18);
  scene.add(coolRim);

  const coreLight = new THREE.PointLight(0xa855f7, 14, 24, 2);
  coreLight.position.set(0, 5.5, 0);
  scene.add(coreLight);

  const platform = new THREE.Mesh(
    new RoundedBoxGeometry(29, 0.78, 29, 6, 0.36),
    new THREE.MeshStandardMaterial({
      color: 0x111a2b,
      roughness: 0.86,
      metalness: 0.08
    })
  );
  platform.position.y = -0.4;
  platform.receiveShadow = true;
  scene.add(platform);

  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x202c42,
    emissive: 0x071124,
    emissiveIntensity: 0.18,
    roughness: 0.88,
    metalness: 0.05
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = "battlefield-ground";
  scene.add(ground);

  const grid = new THREE.GridHelper(24, 24, 0x8b7ab8, 0x3a4c69);
  grid.position.y = 0.022;
  grid.material.transparent = true;
  grid.material.opacity = 0.42;
  scene.add(grid);

  const innerBoundary = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(20, 0.08, 20)),
    new THREE.LineBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.24
    })
  );
  innerBoundary.position.y = 0.04;
  scene.add(innerBoundary);
  scene.add(createVoidStars());

  const deploymentMarkers = createDeploymentMarkers();
  scene.add(deploymentMarkers);

  const frontierMap = createTerritoryMap();
  frontierMap.visible = false;
  scene.add(frontierMap);
  const sanctumView = createSanctumView();
  sanctumView.visible = false;
  scene.add(sanctumView);
  const landscapeGroup = new THREE.Group();
  landscapeGroup.name = "territory-landscape";
  landscapeGroup.visible = false;
  scene.add(landscapeGroup);
  const hazardGroup = new THREE.Group();
  hazardGroup.name = "territory-hazards";
  hazardGroup.visible = false;
  scene.add(hazardGroup);
  const heroMarker = new THREE.Group();
  const heroBody = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.52, 0),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 1.2, roughness: 0.28, metalness: 0.16 })
  );
  const heroRing = new THREE.Mesh(
    new THREE.RingGeometry(0.68, 0.78, 6),
    new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false })
  );
  heroRing.rotation.x = -Math.PI / 2;
  heroRing.position.y = -0.38;
  heroMarker.add(heroBody, heroRing);
  heroMarker.visible = false;
  scene.add(heroMarker);

  const resultAura = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 2.86, 72),
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  resultAura.rotation.x = -Math.PI / 2;
  resultAura.position.y = 0.11;
  resultAura.visible = false;
  scene.add(resultAura);

  const hover = new THREE.Group();
  const hoverTile = new THREE.Mesh(
    new RoundedBoxGeometry(0.98, 0.075, 0.98, 3, 0.12),
    new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.72
    })
  );
  const hoverRing = new THREE.Mesh(
    new THREE.RingGeometry(0.58, 0.7, 4),
    new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.84,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  hoverRing.rotation.x = -Math.PI / 2;
  hoverRing.rotation.z = Math.PI / 4;
  hoverRing.position.y = 0.055;
  hover.add(hoverTile, hoverRing);
  hover.visible = false;
  hover.position.y = 0.09;
  scene.add(hover);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();
  const entityViews = new Map();
  const effectViews = new Map();
  const assetLoader = new GLTFLoader();
  const assetTemplates = new Map();
  const assetLoads = new Map();
  const assetBaseUrl = import.meta.env.BASE_URL ?? "/";

  function assetUrl(asset) {
    return `${assetBaseUrl}${String(asset.path).replace(/^\/+/, "")}`;
  }

  function loadAssetTemplate(asset) {
    if (assetTemplates.has(asset.id)) return Promise.resolve(assetTemplates.get(asset.id));
    if (assetLoads.has(asset.id)) return assetLoads.get(asset.id);
    const load = assetLoader.loadAsync(assetUrl(asset)).then((gltf) => {
      assetTemplates.set(asset.id, gltf.scene);
      assetLoads.delete(asset.id);
      return gltf.scene;
    }).catch((error) => {
      assetLoads.delete(asset.id);
      throw error;
    });
    assetLoads.set(asset.id, load);
    return load;
  }

  function projectApprovedAsset(entity, view) {
    const assetId = entity.renderable?.assetId;
    const asset = assetId ? assetById(assetId) : null;
    if (!asset || view.userData.assetRequested || view.userData.assetFailed) return;
    view.userData.assetRequested = true;
    loadAssetTemplate(asset).then((template) => {
      if (!entityViews.has(entity.id)) return;
      const root = template.clone(true);
      root.name = `${entity.id}:asset:${asset.id}`;
      root.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;
      });
      const bounds = new THREE.Box3().setFromObject(root);
      const size = bounds.getSize(new THREE.Vector3());
      const targetHeight = Math.max(0.1, Number(entity.renderable.size?.[1] ?? 1));
      const scale = targetHeight / Math.max(0.001, size.y);
      root.scale.setScalar(scale);
      const scaledBounds = new THREE.Box3().setFromObject(root);
      const scaledCenter = scaledBounds.getCenter(new THREE.Vector3());
      root.position.x -= scaledCenter.x;
      root.position.z -= scaledCenter.z;
      root.position.y -= scaledBounds.min.y;
      view.add(root);
      view.userData.assetRoot = root;
      view.userData.fallbackParts.forEach((part) => { part.visible = false; });
    }).catch(() => {
      // The entity remains on its renderer-neutral cube fallback.
      view.userData.assetFailed = true;
    });
  }
  let deployMode = true;
  let latestSnapshot = null;
  let latestPhase = null;
  let phaseChangedAt = 0;

  function syncLandscape(snapshot, timeSeconds = 0) {
    const landscape = snapshot.landscape ?? {};
    const desired = new Set(landscape.blockedCells ?? []);
    for (const child of [...landscapeGroup.children]) {
      if (!desired.has(child.userData.cellKey)) {
        landscapeGroup.remove(child);
        child.geometry.dispose();
        child.material.dispose();
      }
    }
    for (const key of desired) {
      if (landscapeGroup.children.some((child) => child.userData.cellKey === key)) continue;
      const [cellX, cellZ] = key.split(",").map(Number);
      const size = 0.22;
      const obstacle = new THREE.Mesh(
        new RoundedBoxGeometry(size, 0.42, size, 3, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x7c3aed, emissive: 0x312e81, emissiveIntensity: 0.72, roughness: 0.7 })
      );
      obstacle.position.set((cellX - 50) * size, 0.22, (cellZ - 50) * size);
      obstacle.castShadow = true;
      obstacle.userData.cellKey = key;
      landscapeGroup.add(obstacle);
    }
    const hazards = landscape.hazards ?? [];
    const hazardIds = new Set(hazards.map((hazard) => hazard.id));
    for (const child of [...hazardGroup.children]) {
      if (hazardIds.has(child.userData.hazardId)) continue;
      hazardGroup.remove(child);
      child.geometry.dispose();
      child.material.dispose();
    }
    for (const hazard of hazards) {
      let marker = hazardGroup.children.find((child) => child.userData.hazardId === hazard.id);
      if (!marker) {
        marker = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.34, 0.12, 6),
          new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0x7c2d12, emissiveIntensity: 1.2, roughness: 0.58 })
        );
        marker.userData.hazardId = hazard.id;
        marker.castShadow = true;
        hazardGroup.add(marker);
      }
      marker.position.set((Number(hazard.x ?? 50) - 50) * 0.22, 0.14, (Number(hazard.z ?? 50) - 50) * 0.22);
      const pulse = 1 + Math.sin(timeSeconds * 3.2 + String(hazard.id).length) * 0.16;
      marker.scale.set(pulse, 1, pulse);
      marker.material.emissiveIntensity = 0.95 + pulse * 0.4;
    }
  }

  function syncWorldPresentation(snapshot, timeSeconds) {
    const sceneId = snapshot.scene?.current ?? "encounter";
    const territoryScene = isTerritorySceneId(sceneId);
    const cameraIntent = sceneId === "overworld"
      ? { position: [0, 31, 0.01], target: [0, 0, 0], zoom: 0.86 }
      : sceneId === "sanctum"
        ? { position: [15, 22, 15], target: [0, 0.2, 0], zoom: 1.02 }
        : { position: [18.5, 23.5, 18.5], target: [0, 0.25, 0], zoom: 1 };
    cameraIntentPosition.lerp(new THREE.Vector3(...cameraIntent.position), 0.1);
    cameraTarget.lerp(new THREE.Vector3(...cameraIntent.target), 0.1);
    camera.position.copy(cameraIntentPosition);
    camera.zoom += (cameraIntent.zoom - camera.zoom) * 0.1;
    camera.lookAt(cameraTarget);
    camera.updateProjectionMatrix();
    const worldScene = sceneId !== "encounter";
    frontierMap.visible = sceneId === "overworld";
    sanctumView.visible = sceneId === "sanctum";
    landscapeGroup.visible = territoryScene;
    hazardGroup.visible = territoryScene;
    heroMarker.visible = sceneId === "overworld";
    deploymentMarkers.visible = false;
    for (const view of entityViews.values()) {
      view.visible = sceneId === "encounter"
        ? true
        : territoryScene
          ? Boolean(view.userData.territoryMarker || view.userData.hero)
          : false;
    }
    for (const effect of effectViews.values()) effect.visible = !worldScene;
    if (territoryScene) syncLandscape(snapshot, timeSeconds);
    if (sceneId === "overworld") {
      const world = snapshot.world ?? {};
      const discovered = new Set(world.discoveredTerritoryIds ?? []);
      const controlled = new Set(world.controlledTerritoryIds ?? []);
      const activeRegion = new Set(world.activeRegionIds ?? []);
      const current = world.currentTerritoryId;
      const routeByTerritory = new Map((world.supplyRoutes ?? []).map((route) => [route.territoryId, route]));
      for (const line of frontierMap.userData.routeLines ?? []) {
        const [fromId, toId] = String(line.userData.routeKey ?? "").split(":");
        const fromRoute = routeByTerritory.get(fromId);
        const toRoute = routeByTerritory.get(toId);
        const status = fromRoute?.status === "contested" || toRoute?.status === "contested"
          ? "contested"
          : fromRoute?.status === "isolated" || toRoute?.status === "isolated"
            ? "isolated"
            : fromRoute?.status === "supplied" || toRoute?.status === "supplied"
              ? "supplied"
              : "unresolved";
        line.material.color.set(status === "contested" ? 0xfb7185 : status === "supplied" ? 0x38bdf8 : status === "isolated" ? 0x475569 : 0x64748b);
        line.material.opacity = status === "contested" ? 0.92 : status === "supplied" ? 0.76 : status === "isolated" ? 0.3 : 0.5;
      }
      for (const node of frontierMap.children) {
        if (!node.userData?.territoryId) continue;
        const territoryId = node.userData.territoryId;
        const known = discovered.has(territoryId);
        const owned = controlled.has(territoryId);
        const active = territoryId === current;
        const inActiveRegion = activeRegion.has(territoryId);
        const territoryState = world.territories?.[territoryId];
        const distance = territoryState
          ? Math.hypot(territoryState.coordinates.x - (world.territories?.[current]?.coordinates.x ?? 0), territoryState.coordinates.z - (world.territories?.[current]?.coordinates.z ?? 0))
          : Infinity;
        node.visible = known || active || inActiveRegion || distance <= 2.1;
        node.userData.activeRegion = inActiveRegion;
        node.userData.body.material.color.set(active ? 0xfbbf24 : owned ? 0x2563eb : known ? 0x64748b : 0x1e293b);
        node.userData.crown.material.color.set(active ? 0xfef3c7 : owned ? 0x7dd3fc : known ? 0xcbd5e1 : 0x475569);
        node.userData.ring.material.color.set(active ? 0xfbbf24 : owned ? 0x38bdf8 : known ? 0x94a3b8 : 0x334155);
        node.userData.ring.material.opacity = active
          ? 0.95 + Math.sin(timeSeconds * 3) * 0.04
          : inActiveRegion
            ? 0.74
            : known
              ? 0.62
              : 0.24;
        node.scale.setScalar(active ? 1.08 + Math.sin(timeSeconds * 2.4) * 0.025 : 1);
      }
      const heroPosition = frontierMap.userData.positions.get(world.currentTerritoryId);
      if (heroPosition) heroMarker.position.set(heroPosition.x, 0.9, heroPosition.z);
    }
    if (isTerritorySceneId(sceneId)) {
      const hero = snapshot.hero ?? { position: { x: 50, z: 50 } };
      heroMarker.position.set((hero.position.x - 50) * 0.22, 0.88, (hero.position.z - 50) * 0.22);
    }
    if (sceneId === "sanctum") {
      sanctumView.userData.heart.rotation.y = timeSeconds * 0.55;
      sanctumView.userData.ring.rotation.z = timeSeconds * 0.24;
    }
  }

  function groundPoint(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    return raycaster.ray.intersectPlane(groundPlane, hitPoint)
      ? { x: hitPoint.x, z: hitPoint.z }
      : null;
  }

  function updateHover(event) {
    if (isTerritorySceneId(latestSnapshot?.scene?.current)) {
      hover.visible = false;
      canvas.style.cursor = "pointer";
      return;
    }
    if (latestSnapshot?.scene?.current !== "encounter") {
      hover.visible = false;
      canvas.style.cursor = "default";
      return;
    }
    const point = groundPoint(event);
    if (!point || !deployMode) {
      hover.visible = false;
      canvas.style.cursor = "default";
      return;
    }
    const x = Math.round(point.x * 2) / 2;
    const z = Math.round(point.z * 2) / 2;
    const valid = canDeployAt(x, z);
    const color = valid ? 0x22c55e : 0xef4444;
    hover.visible = true;
    hover.position.set(x, 0.09, z);
    hoverTile.material.color.set(color);
    hoverRing.material.color.set(valid ? 0xbae6fd : 0xfca5a5);
    canvas.style.cursor = valid ? "crosshair" : "not-allowed";
  }

  canvas.addEventListener("pointermove", updateHover);
  canvas.addEventListener("pointerleave", () => {
    hover.visible = false;
    canvas.style.cursor = "default";
  });
  canvas.addEventListener("pointerdown", (event) => {
    const sceneId = latestSnapshot?.scene?.current ?? "encounter";
    if (sceneId === "overworld") {
      if (typeof onTerritorySelect !== "function") return;
      pointer.x = ((event.clientX - canvas.getBoundingClientRect().left) / canvas.clientWidth) * 2 - 1;
      pointer.y = -((event.clientY - canvas.getBoundingClientRect().top) / canvas.clientHeight) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(frontierMap.children, true).find((entry) => {
        let node = entry.object;
        while (node && !node.userData?.territoryId) node = node.parent;
        return Boolean(node?.userData?.territoryId);
      });
      if (!hit) return;
      let node = hit.object;
      while (node && !node.userData?.territoryId) node = node.parent;
      if (node?.visible !== false) onTerritorySelect(node.userData.territoryId);
      return;
    }
    if (isTerritorySceneId(sceneId)) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(scene.children, true).find((entry) => {
        let node = entry.object;
        while (node && !node.userData?.frontMarker && !node.userData?.landmarkId) node = node.parent;
        return Boolean(node?.userData?.frontMarker || node?.userData?.landmarkId);
      });
      if (hit) {
        let node = hit.object;
        while (node && !node.userData?.frontMarker && !node.userData?.landmarkId) node = node.parent;
        if (node?.userData?.landmarkId && typeof onLandmarkSelect === "function") {
          onLandmarkSelect(node.userData.landmarkId);
          return;
        }
        const direction = node?.userData?.territoryMarkerData?.direction ?? null;
        if (direction && typeof onFrontSelect === "function") {
          onFrontSelect(direction);
          return;
        }
      }
      const point = groundPoint(event);
      if (!point || typeof onHeroMove !== "function") return;
      const x = Math.max(0, Math.min(99, Math.round(((point.x + 11) / 22) * 100)));
      const z = Math.max(0, Math.min(99, Math.round(((point.z + 11) / 22) * 100)));
      onHeroMove({ x, z });
      return;
    }
    if (sceneId !== "encounter") return;
    if (!deployMode) return;
    const point = groundPoint(event);
    if (!point) return;
    const x = Math.round(point.x * 2) / 2;
    const z = Math.round(point.z * 2) / 2;
    if (canDeployAt(x, z)) onDeploy(x, z);
  });

  function removeEntityView(view) {
    scene.remove(view);
    view.userData.assetRoot?.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry?.dispose?.();
      if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose?.());
      else node.material?.dispose?.();
    });
    for (const key of [
      "body",
      "cap",
      "crest",
      "edges",
      "shadow",
      "healthBack",
      "healthFill",
      "inner"
    ]) {
      view.userData[key]?.material?.dispose();
    }
    for (const ring of view.userData.coreRings ?? []) {
      ring.material.dispose();
      ring.geometry.dispose();
    }
  }

  function syncEntities(snapshot, timeSeconds) {
    const nextIds = new Set(snapshot.entities.map((entity) => entity.id));
    for (const [id, view] of entityViews) {
      if (!nextIds.has(id)) {
        removeEntityView(view);
        entityViews.delete(id);
      }
    }

    for (const entity of snapshot.entities) {
      let view = entityViews.get(entity.id);
      if (!view) {
        view = createEntityView(entity);
        entityViews.set(entity.id, view);
        scene.add(view);
      }
      const marker = entity.territoryMarker?.gridPosition;
      const hero = entity.hero;
      const gridPosition = marker ?? (hero ? { x: entity.position.x, z: entity.position.z } : null);
      view.position.set(
        gridPosition ? (gridPosition.x - 50) * 0.22 : entity.position.x,
        gridPosition ? entity.renderable.size[1] / 2 : entity.position.y,
        gridPosition ? (gridPosition.z - 50) * 0.22 : entity.position.z
      );
      view.userData.movement = entity.movement?.state ?? null;
      view.userData.territoryMarker = Boolean(entity.territoryMarker);
      view.userData.territoryMarkerData = entity.territoryMarker ?? null;
      view.userData.landmarkId = entity.category === "landmark" ? entity.id : null;
      view.userData.hero = Boolean(entity.hero);
      view.userData.frontMarker = Boolean(entity.frontMarker);
      projectApprovedAsset(entity, view);
      if (entity.frontMarker) {
        const paletteColor = entity.renderable?.color ?? "#94a3b8";
        const paletteEmissive = entity.renderable?.emissive ?? "#334155";
        view.userData.body?.material?.color?.set(paletteColor);
        view.userData.body?.material?.emissive?.set(paletteEmissive);
        view.userData.cap?.material?.color?.set(paletteColor);
      }
      if (entity.territoryMarker || entity.hero) {
        const pressurePulse = entity.frontMarker
          ? 0.03 + Number(entity.territoryMarker?.pressure ?? 0) * 0.06
          : 0.045;
        const pulse = 1 + Math.sin(timeSeconds * 2.2 + entity.id.length) * pressurePulse;
        view.scale.setScalar(pulse);
      } else {
        view.scale.setScalar(1);
      }

      const { healthBack, healthFill, body, cap } = view.userData;
      if (healthFill && healthBack && entity.health) {
        const ratio = Math.max(0, entity.health.current / entity.health.maximum);
        const fullWidth = healthFill.userData.fullWidth;
        if (
          view.userData.lastHealthRatio !== null &&
          ratio < view.userData.lastHealthRatio
        ) {
          view.userData.damageFlashUntil = timeSeconds + 0.16;
        }
        view.userData.lastHealthRatio = ratio;
        healthFill.scale.x = Math.max(0.001, fullWidth * ratio);
        healthFill.position.x = -(fullWidth - healthFill.scale.x) / 2;
        healthFill.material.color.set(
          ratio > 0.55 ? 0x4ade80 : ratio > 0.25 ? 0xfacc15 : 0xfb7185
        );
        const revealHealth = ratio < 0.995 && ratio > 0;
        healthBack.visible = revealHealth;
        healthFill.visible = revealHealth;
        const flashing = timeSeconds < view.userData.damageFlashUntil;
        body.material.emissiveIntensity = flashing
          ? 1.8
          : view.userData.role === "core"
            ? 0.5
            : 0.2;
        cap.material.emissiveIntensity = flashing
          ? 1.4
          : view.userData.role === "core"
            ? 0.72
            : 0.28;
      }
    }
  }

  function createEffectView(item) {
    const group = new THREE.Group();
    const colors = {
      "hero-ability-burst": 0xc084fc,
      "boss-phase-shockwave": 0xfb7185,
      "healing-pulse": 0x4ade80,
      "hazard-pulse": 0xf97316
    };
    const color = colors[item.type] ?? (item.faction === "player" ? 0x93c5fd : 0xfbbf24);
    const orb = new THREE.Mesh(
      sharedProjectile,
      new THREE.MeshBasicMaterial({ color })
    );
    const aura = new THREE.Mesh(
      sharedProjectileAura,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.22,
        depthWrite: false
      })
    );
    const trailGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(item.from.x, item.from.y + 0.35, item.from.z),
      new THREE.Vector3(item.to.x, item.to.y + 0.35, item.to.z)
    ]);
    const trail = new THREE.Line(
      trailGeometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.2
      })
    );
    scene.add(trail);
    group.add(orb, aura);
    group.userData = { orb, aura, trail, type: item.type };
    return group;
  }

  function removeEffectView(effect) {
    scene.remove(effect);
    scene.remove(effect.userData.trail);
    effect.userData.orb.material.dispose();
    effect.userData.aura.material.dispose();
    effect.userData.trail.material.dispose();
    effect.userData.trail.geometry.dispose();
  }

  function syncEffects(snapshot) {
    const nextIds = new Set(snapshot.effects.items.map((item) => item.id));
    for (const [id, effect] of effectViews) {
      if (!nextIds.has(id)) {
        removeEffectView(effect);
        effectViews.delete(id);
      }
    }

    for (const item of snapshot.effects.items) {
      let effect = effectViews.get(item.id);
      if (!effect) {
        effect = createEffectView(item);
        effectViews.set(item.id, effect);
        scene.add(effect);
      }
      const progress = THREE.MathUtils.clamp(
        1 - item.remaining / item.duration,
        0,
        1
      );
      const arc = Math.sin(progress * Math.PI) * 0.55;
      effect.position.set(
        THREE.MathUtils.lerp(item.from.x, item.to.x, progress),
        THREE.MathUtils.lerp(item.from.y + 0.35, item.to.y + 0.35, progress) + arc,
        THREE.MathUtils.lerp(item.from.z, item.to.z, progress)
      );
      const scaleMultiplier = item.type === "hero-ability-burst" ? 1.35 : item.type === "boss-phase-shockwave" ? 1.8 : 1;
      const impactScale = (0.9 + progress * 0.75) * scaleMultiplier;
      effect.userData.aura.scale.setScalar(impactScale);
      effect.userData.aura.material.opacity = 0.28 * (1 - progress * 0.6);
      effect.userData.trail.material.opacity = 0.22 * (1 - progress);
    }
  }

  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const aspect = width / height;
    const frame = projectedFrameSize(camera);
    const viewHeight = Math.max(frame.height, frame.width / aspect);
    camera.left = (-viewHeight * aspect) / 2;
    camera.right = (viewHeight * aspect) / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  function animateWorld(snapshot, timeSeconds) {
    const sceneId = snapshot.scene?.current ?? "encounter";
    if (sceneId !== "encounter") {
      deploymentMarkers.visible = false;
      coreLight.intensity = sceneId === "sanctum" ? 3.8 + Math.sin(timeSeconds * 1.8) * 0.5 : 0.8;
      groundMaterial.emissiveIntensity = isTerritorySceneId(sceneId) ? 0.26 : 0.2;
      scene.background.lerp(sceneId === "sanctum" ? new THREE.Color(0x06152a) : new THREE.Color(0x07111f), 0.035);
      return;
    }
    const terminal = ["won", "lost"].includes(snapshot.raid.phase);
    if (snapshot.raid.phase !== latestPhase) {
      latestPhase = snapshot.raid.phase;
      phaseChangedAt = timeSeconds;
    }

    deploymentMarkers.visible =
      !terminal &&
      snapshot.session.role !== "defender" &&
      snapshot.deployment.remaining > 0 &&
      ["deploy", "active"].includes(snapshot.raid.phase);
    deploymentMarkers.userData.material.opacity =
      0.14 + Math.sin(timeSeconds * 2.4) * 0.07;

    const coreRatio = snapshot.coreHealth.maximum
      ? snapshot.coreHealth.current / snapshot.coreHealth.maximum
      : 0;
    coreLight.intensity =
      snapshot.raid.phase === "won"
        ? 0
        : 8 + coreRatio * 8 + Math.sin(timeSeconds * 2.2) * 1.4;
    groundMaterial.emissiveIntensity =
      snapshot.raid.phase === "active" && snapshot.raid.timeRemaining < 10
        ? 0.28 + Math.sin(timeSeconds * 4) * 0.08
        : 0.18;

    for (const view of entityViews.values()) {
      const {
        body,
        cap,
        crest,
        coreRings,
        inner,
        role,
        movement,
        baseScale
      } = view.userData;
      let pulse = 1;
      if (role === "core") pulse = 1 + Math.sin(timeSeconds * 2.4) * 0.018;
      if (role === "delver" && movement === "moving") {
        pulse = 1 + Math.sin(timeSeconds * 10 + view.position.x) * 0.035;
        view.rotation.y = Math.sin(timeSeconds * 3 + view.position.z) * 0.05;
      }
      body.scale.set(
        baseScale[0] * pulse,
        baseScale[1] / pulse,
        baseScale[2] * pulse
      );
      cap.rotation.y += role === "core" ? 0.004 : 0;
      if (crest && role === "defense") crest.rotation.y += 0.012;
      if (inner) {
        inner.rotation.y = timeSeconds * 0.9;
        inner.rotation.x = timeSeconds * 0.34;
        inner.position.y = 0.34 + Math.sin(timeSeconds * 2.5) * 0.1;
      }
      for (const [index, ring] of coreRings.entries()) {
        ring.rotation.z =
          timeSeconds * (index === 0 ? 0.32 : -0.24) + index * 0.7;
        ring.material.opacity =
          (index === 0 ? 0.48 : 0.29) + Math.sin(timeSeconds * 2.2 + index) * 0.1;
      }
    }

    const age = Math.max(0, timeSeconds - phaseChangedAt);
    resultAura.visible = terminal && age < 8;
    if (resultAura.visible) {
      const won = snapshot.raid.phase === "won";
      resultAura.material.color.set(won ? 0xfbbf24 : 0xfb7185);
      resultAura.scale.setScalar(1 + age * 0.72);
      resultAura.material.opacity = Math.max(0, 0.66 - age * 0.08);
    }

    const backgroundTarget =
      snapshot.raid.phase === "lost"
        ? new THREE.Color(0x09040b)
        : snapshot.raid.phase === "won"
          ? new THREE.Color(0x06101a)
          : baseBackground;
    scene.background.lerp(backgroundTarget, 0.035);
  }

  function render(snapshot, timeSeconds = 0) {
    latestSnapshot = snapshot;
    syncEntities(snapshot, timeSeconds);
    syncEffects(snapshot);
    syncWorldPresentation(snapshot, timeSeconds);
    animateWorld(snapshot, timeSeconds);
    renderer.render(scene, camera);
  }

  return {
    render,
    setDeployMode(value) {
      deployMode = Boolean(value);
      if (!deployMode) {
        hover.visible = false;
        canvas.style.cursor = "default";
      }
    },
    getDeployMode: () => deployMode,
    getSnapshot: () => latestSnapshot,
    dispose() {
      observer.disconnect();
      renderer.dispose();
    }
  };
}
