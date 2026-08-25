function geometryFor(THREE, part, roundedBoxFactory) {
  const [x, y, z] = part.size;
  if (part.kind === "roof") {
    const geometry = new THREE.CylinderGeometry(0, 0.5, y, 4, 1, false);
    geometry.scale(x * 1.05, 1, z * 1.05);
    geometry.rotateY(Math.PI / 4);
    return geometry;
  }
  if (part.kind === "rounded-box" || part.kind === "banner") {
    return roundedBoxFactory
      ? roundedBoxFactory(x, y, z, 0.08)
      : new THREE.BoxGeometry(x, y, z);
  }
  if (part.kind === "cylinder") return new THREE.CylinderGeometry(x, x * 1.08, y, Math.max(6, Math.floor(z || 8)));
  if (part.kind === "cone") return new THREE.ConeGeometry(x, y, Math.max(6, Math.floor(z || 8)));
  if (part.kind === "torus") return new THREE.TorusGeometry(x, y, 8, Math.max(12, Math.floor(z || 24)));
  if (part.kind === "octahedron") return new THREE.OctahedronGeometry(x, 1);
  if (part.kind === "dodecahedron") return new THREE.DodecahedronGeometry(x, 0);
  return new THREE.BoxGeometry(x, y, z);
}

export function createProceduralBuildingView(THREE, descriptor, options = {}) {
  const group = new THREE.Group();
  group.name = descriptor.id;
  group.userData.proceduralBuilding = descriptor;
  for (const entry of descriptor.parts) {
    const material = new THREE.MeshStandardMaterial({
      color: entry.material.color,
      emissive: entry.material.emissive ?? "#000000",
      emissiveIntensity: Number(entry.material.emissiveIntensity ?? 0),
      roughness: Number(entry.material.roughness ?? 0.72),
      metalness: Number(entry.material.metalness ?? 0.08),
      transparent: Number(entry.material.opacity ?? 1) < 1,
      opacity: Number(entry.material.opacity ?? 1)
    });
    const mesh = new THREE.Mesh(geometryFor(THREE, entry, options.roundedBoxFactory), material);
    mesh.name = entry.id;
    mesh.position.fromArray(entry.position);
    mesh.rotation.fromArray(entry.rotation ?? [0, 0, 0]);
    mesh.castShadow = entry.castShadow !== false;
    mesh.receiveShadow = entry.receiveShadow !== false;
    group.add(mesh);
  }
  return group;
}

export function disposeProceduralBuildingView(group) {
  group?.traverse?.((node) => {
    if (!node.isMesh) return;
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose?.());
    else node.material?.dispose?.();
  });
}
