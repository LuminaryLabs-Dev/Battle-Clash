import * as THREE from "three";
import { BATTLEFIELD } from "../../data/battlefield.js";

const sharedBox = new THREE.BoxGeometry(1, 1, 1);
const sharedHealthBack = new THREE.BoxGeometry(1, 0.08, 0.13);
const sharedHealthFill = new THREE.BoxGeometry(1, 0.09, 0.15);

function createEntityView(entity) {
  const group = new THREE.Group();
  group.name = entity.id;

  const material = new THREE.MeshStandardMaterial({
    color: entity.renderable.color,
    emissive: entity.renderable.emissive,
    emissiveIntensity: entity.role === "core" ? 0.42 : 0.18,
    roughness: 0.68,
    metalness: entity.role === "defense" ? 0.22 : 0.05
  });
  const body = new THREE.Mesh(sharedBox, material);
  body.castShadow = true;
  body.receiveShadow = true;
  body.scale.fromArray(entity.renderable.size);
  group.add(body);

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: entity.faction === "player" ? 0.34 : 0.2
  });
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(sharedBox),
    edgeMaterial
  );
  edges.scale.fromArray(entity.renderable.size.map((value) => value * 1.005));
  group.add(edges);

  let healthFill = null;
  if (entity.health) {
    const top = entity.renderable.size[1] / 2 + 0.27;
    const healthBack = new THREE.Mesh(
      sharedHealthBack,
      new THREE.MeshBasicMaterial({ color: 0x0f172a })
    );
    healthBack.position.set(0, top, 0);
    healthBack.scale.x = Math.max(0.9, entity.renderable.size[0] * 0.72);
    group.add(healthBack);

    healthFill = new THREE.Mesh(
      sharedHealthFill,
      new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    healthFill.position.set(0, top + 0.01, 0);
    healthFill.userData.fullWidth = healthBack.scale.x;
    group.add(healthFill);
  }

  if (entity.role === "core") {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.35, 0.09, 8, 48),
      new THREE.MeshBasicMaterial({
        color: 0xd8b4fe,
        transparent: true,
        opacity: 0.72
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -entity.renderable.size[1] / 2 + 0.08;
    ring.name = "core-ring";
    group.add(ring);
  }

  group.userData = { body, edges, healthFill };
  return group;
}

export function createThreeHost({
  canvas,
  onDeploy,
  canDeployAt
}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060a16);
  scene.fog = new THREE.Fog(0x060a16, 30, 52);

  const camera = new THREE.OrthographicCamera(-16, 16, 12, -12, 0.1, 100);
  camera.position.set(18, 23, 18);
  camera.lookAt(0, 0, 0);

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
  renderer.toneMappingExposure = 1.04;

  scene.add(new THREE.HemisphereLight(0xb9e6ff, 0x17112b, 2.15));
  const sun = new THREE.DirectionalLight(0xfff1d2, 3.2);
  sun.position.set(-12, 24, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.MeshStandardMaterial({
      color: 0x20283a,
      roughness: 0.96,
      metalness: 0
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = "battlefield-ground";
  scene.add(ground);

  const grid = new THREE.GridHelper(24, 24, 0x7c6fa6, 0x3a4058);
  grid.position.y = 0.015;
  grid.material.transparent = true;
  grid.material.opacity = 0.38;
  scene.add(grid);

  const zoneMaterial = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.16,
    depthWrite: false
  });
  const zoneRects = [
    [0, -10.5, 24, 3],
    [0, 10.5, 24, 3],
    [-10.5, 0, 3, 18],
    [10.5, 0, 3, 18]
  ];
  for (const [x, z, width, depth] of zoneRects) {
    const zone = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      zoneMaterial
    );
    zone.rotation.x = -Math.PI / 2;
    zone.position.set(x, 0.025, z);
    scene.add(zone);
  }

  const hover = new THREE.Mesh(
    new THREE.BoxGeometry(0.98, 0.08, 0.98),
    new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.72
    })
  );
  hover.visible = false;
  hover.position.y = 0.08;
  scene.add(hover);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();
  const entityViews = new Map();
  const effectViews = new Map();
  let deployMode = true;
  let latestSnapshot = null;

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
    const point = groundPoint(event);
    if (!point || !deployMode) {
      hover.visible = false;
      return;
    }
    const x = Math.round(point.x * 2) / 2;
    const z = Math.round(point.z * 2) / 2;
    const valid = canDeployAt(x, z);
    hover.visible = true;
    hover.position.set(x, 0.08, z);
    hover.material.color.set(valid ? 0x22c55e : 0xef4444);
    canvas.style.cursor = valid ? "crosshair" : "not-allowed";
  }

  canvas.addEventListener("pointermove", updateHover);
  canvas.addEventListener("pointerleave", () => {
    hover.visible = false;
    canvas.style.cursor = "default";
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (!deployMode) return;
    const point = groundPoint(event);
    if (!point) return;
    const x = Math.round(point.x * 2) / 2;
    const z = Math.round(point.z * 2) / 2;
    if (canDeployAt(x, z)) onDeploy(x, z);
  });

  function syncEntities(snapshot) {
    const nextIds = new Set(snapshot.entities.map((entity) => entity.id));
    for (const [id, view] of entityViews) {
      if (!nextIds.has(id)) {
        scene.remove(view);
        view.userData.body.material.dispose();
        view.userData.edges.material.dispose();
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
      view.position.set(
        entity.position.x,
        entity.position.y,
        entity.position.z
      );

      const healthFill = view.userData.healthFill;
      if (healthFill && entity.health) {
        const ratio = Math.max(0, entity.health.current / entity.health.maximum);
        const fullWidth = healthFill.userData.fullWidth;
        healthFill.scale.x = Math.max(0.001, fullWidth * ratio);
        healthFill.position.x = -(fullWidth - healthFill.scale.x) / 2;
        healthFill.material.color.set(
          ratio > 0.55 ? 0x22c55e : ratio > 0.25 ? 0xfacc15 : 0xef4444
        );
      }
    }
  }

  function syncEffects(snapshot) {
    const nextIds = new Set(snapshot.effects.items.map((item) => item.id));
    for (const [id, effect] of effectViews) {
      if (!nextIds.has(id)) {
        scene.remove(effect);
        effect.material.dispose();
        effectViews.delete(id);
      }
    }

    for (const item of snapshot.effects.items) {
      let effect = effectViews.get(item.id);
      if (!effect) {
        effect = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 8, 8),
          new THREE.MeshBasicMaterial({
            color: item.faction === "player" ? 0x93c5fd : 0xfbbf24
          })
        );
        effectViews.set(item.id, effect);
        scene.add(effect);
      }
      const progress = 1 - item.remaining / item.duration;
      effect.position.set(
        THREE.MathUtils.lerp(item.from.x, item.to.x, progress),
        THREE.MathUtils.lerp(item.from.y + 0.35, item.to.y + 0.35, progress),
        THREE.MathUtils.lerp(item.from.z, item.to.z, progress)
      );
    }
  }

  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const aspect = width / height;
    const viewHeight = width < 700 ? 32 : 27;
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

  function render(snapshot, timeSeconds = 0) {
    latestSnapshot = snapshot;
    syncEntities(snapshot);
    syncEffects(snapshot);
    const core = entityViews.get("dungeon-heart");
    const coreRing = core?.getObjectByName("core-ring");
    if (coreRing) {
      coreRing.rotation.z = timeSeconds * 0.35;
      coreRing.material.opacity = 0.54 + Math.sin(timeSeconds * 2.2) * 0.16;
    }
    renderer.render(scene, camera);
  }

  return {
    render,
    setDeployMode(value) {
      deployMode = Boolean(value);
      if (!deployMode) hover.visible = false;
    },
    getDeployMode: () => deployMode,
    getSnapshot: () => latestSnapshot,
    dispose() {
      observer.disconnect();
      renderer.dispose();
    }
  };
}
