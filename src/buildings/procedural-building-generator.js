import { BUILDING_BLUEPRINTS, BUILDING_MAX_LEVEL } from "../data/buildings.js";

const PALETTES = Object.freeze({
  sanctum: Object.freeze({ stone: "#24436a", stoneLight: "#5f86ad", roof: "#164e63", accent: "#67e8f9", glow: "#0ea5e9", wood: "#6b4935" }),
  barracks: Object.freeze({ stone: "#334a65", stoneLight: "#7593ad", roof: "#9f3f2d", accent: "#fed7aa", glow: "#f97316", wood: "#8a563b" }),
  foundry: Object.freeze({ stone: "#3f4656", stoneLight: "#8993a7", roof: "#7c2d12", accent: "#fdba74", glow: "#f97316", wood: "#5d4032" }),
  watchtower: Object.freeze({ stone: "#31465f", stoneLight: "#8ba4ba", roof: "#1e40af", accent: "#bfdbfe", glow: "#38bdf8", wood: "#72513a" }),
  storehouse: Object.freeze({ stone: "#3d4b5d", stoneLight: "#8c9bad", roof: "#854d0e", accent: "#fde68a", glow: "#f59e0b", wood: "#79563a" }),
  "dungeon-heart": Object.freeze({ stone: "#472b63", stoneLight: "#a78bba", roof: "#7e22ce", accent: "#f3e8ff", glow: "#c084fc", wood: "#4c315c" }),
  "defense-tower": Object.freeze({ stone: "#5e3443", stoneLight: "#c9858c", roof: "#9f1239", accent: "#fecdd3", glow: "#fb7185", wood: "#6f3d35" }),
  "resource-vault": Object.freeze({ stone: "#67451f", stoneLight: "#d7a450", roof: "#b45309", accent: "#fef3c7", glow: "#f59e0b", wood: "#68412a" }),
  "fortress-wall": Object.freeze({ stone: "#53657b", stoneLight: "#a9bfd2", roof: "#334155", accent: "#dbeafe", glow: "#60a5fa", wood: "#5b4638" })
});

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function seeded(seed) {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function part(kind, position, size, material, extra = {}) {
  return {
    kind,
    position: [...position],
    size: [...size],
    material: { roughness: 0.72, metalness: 0.08, ...material },
    castShadow: true,
    receiveShadow: true,
    ...extra
  };
}

function baseParts(palette, width, depth, level) {
  const height = 0.32 + level * 0.06;
  return [
    part("cylinder", [0, height * 0.45, 0], [Math.max(width, depth) * 0.68, height, 8], { color: palette.stone, roughness: 0.9 }),
    part("rounded-box", [0, height + 0.08, 0], [width, 0.22, depth], { color: palette.stoneLight, roughness: 0.82 })
  ];
}

function cornerButtresses(palette, width, depth, height) {
  const parts = [];
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      parts.push(part(
        "cylinder",
        [x * width * 0.43, height * 0.56, z * depth * 0.43],
        [Math.min(width, depth) * 0.16, height * 0.92, 6],
        { color: palette.stoneLight, roughness: 0.78 }
      ));
    }
  }
  return parts;
}

function barracksParts(palette, level) {
  const width = 2.45 + level * 0.18;
  const depth = 2.35 + level * 0.15;
  const height = 1.45 + level * 0.34;
  return [
    ...baseParts(palette, width, depth, level),
    part("rounded-box", [0, 0.58 + height * 0.5, 0], [width * 0.88, height, depth * 0.82], { color: palette.stone }),
    ...cornerButtresses(palette, width, depth, height),
    part("roof", [0, 1.02 + height, 0], [width * 1.05, 0.62, depth * 1.02], { color: palette.roof, roughness: 0.62 }),
    part("rounded-box", [0, 0.82, depth * 0.44], [0.62, 1.05, 0.16], { color: palette.wood, roughness: 0.88 }),
    part("banner", [0, 1.74 + height * 0.35, depth * 0.56], [0.72, 0.74, 0.06], { color: palette.accent, emissive: palette.glow, emissiveIntensity: 0.34 })
  ];
}

function foundryParts(palette, level) {
  const width = 2.3 + level * 0.2;
  const depth = 2.25 + level * 0.18;
  const height = 1.2 + level * 0.28;
  const parts = [
    ...baseParts(palette, width, depth, level),
    part("rounded-box", [0, 0.54 + height * 0.5, 0], [width * 0.94, height, depth * 0.9], { color: palette.stone, metalness: 0.18 }),
    part("roof", [0, 0.9 + height, 0], [width * 1.04, 0.5, depth], { color: palette.roof, metalness: 0.12 }),
    part("cylinder", [-width * 0.3, 1.2 + height, -depth * 0.18], [0.28, 1.75 + level * 0.2, 10], { color: palette.stoneLight, metalness: 0.24 }),
    part("cylinder", [width * 0.3, 0.62, depth * 0.48], [0.42, 0.34, 12], { color: palette.glow, emissive: palette.glow, emissiveIntensity: 1.4, roughness: 0.28 }, { rotation: [Math.PI / 2, 0, 0] })
  ];
  if (level >= 2) parts.push(part("torus", [0, 1.05, depth * 0.54], [0.44, 0.08, 18], { color: palette.accent, emissive: palette.glow, emissiveIntensity: 0.9 }, { rotation: [Math.PI / 2, 0, 0] }));
  return parts;
}

function watchtowerParts(palette, level) {
  const height = 2.25 + level * 0.48;
  const width = 1.75 + level * 0.12;
  return [
    ...baseParts(palette, width, width, level),
    part("cylinder", [0, 0.45 + height * 0.5, 0], [width * 0.43, height, 8], { color: palette.stone }),
    ...cornerButtresses(palette, width, width, height * 0.82),
    part("cylinder", [0, 0.62 + height, 0], [width * 0.62, 0.34, 8], { color: palette.stoneLight, metalness: 0.12 }),
    part("cone", [0, 1.16 + height, 0], [width * 0.76, 1.08, 8], { color: palette.roof, roughness: 0.58 }),
    part("banner", [0, 1.65 + height, width * 0.2], [0.56, 0.7, 0.05], { color: palette.accent, emissive: palette.glow, emissiveIntensity: 0.28 })
  ];
}

function storehouseParts(palette, level) {
  const width = 2.45 + level * 0.18;
  const depth = 2.45 + level * 0.18;
  const height = 1.25 + level * 0.25;
  const parts = [
    ...baseParts(palette, width, depth, level),
    part("rounded-box", [0, 0.5 + height * 0.5, 0], [width, height, depth], { color: palette.stone, metalness: 0.12 }),
    part("roof", [0, 0.94 + height, 0], [width * 1.06, 0.54, depth * 1.02], { color: palette.roof }),
    part("rounded-box", [0, 0.82, depth * 0.51], [1.06, 0.92, 0.13], { color: palette.wood, metalness: 0.2 }),
    part("torus", [0, 0.83, depth * 0.6], [0.28, 0.06, 16], { color: palette.accent, emissive: palette.glow, emissiveIntensity: 0.5 }, { rotation: [Math.PI / 2, 0, 0] })
  ];
  for (let index = 0; index < level; index += 1) {
    parts.push(part("rounded-box", [-0.62 + index * 0.62, 0.46, -depth * 0.57], [0.5, 0.46, 0.5], { color: palette.stoneLight }));
  }
  return parts;
}

function dungeonHeartParts(palette, level) {
  const tier = Math.max(1, level);
  return [
    ...baseParts(palette, 3.5, 3.5, tier),
    part("cylinder", [0, 0.74, 0], [1.62, 0.9, 8], { color: palette.stone, metalness: 0.18 }),
    ...cornerButtresses(palette, 3.1, 3.1, 1.35),
    part("cylinder", [0, 1.34, 0], [1.24, 0.38, 8], { color: palette.stoneLight, metalness: 0.24 }),
    part("octahedron", [0, 2.5, 0], [1.18 + tier * 0.06, 1.18 + tier * 0.06, 1.18 + tier * 0.06], { color: palette.accent, emissive: palette.glow, emissiveIntensity: 2.2, roughness: 0.2, metalness: 0.28 }),
    part("torus", [0, 1.88, 0], [1.5, 0.075, 32], { color: palette.accent, emissive: palette.glow, emissiveIntensity: 1.2 }, { rotation: [Math.PI / 2, 0, 0] })
  ];
}

function defenseTowerParts(palette, level) {
  const height = 1.8 + level * 0.34;
  return [
    ...baseParts(palette, 2.05, 2.05, level),
    part("cylinder", [0, 0.5 + height * 0.5, 0], [0.78, height, 8], { color: palette.stone, metalness: 0.14 }),
    ...cornerButtresses(palette, 1.82, 1.82, height * 0.9),
    part("cylinder", [0, 0.68 + height, 0], [1.08, 0.42, 8], { color: palette.stoneLight, metalness: 0.22 }),
    part("cone", [0, 1.28 + height, 0], [1.08, 1.05, 8], { color: palette.roof, roughness: 0.54 }),
    part("torus", [0, 0.82 + height, 0], [0.72, 0.055, 18], { color: palette.accent, emissive: palette.glow, emissiveIntensity: 0.72 }, { rotation: [Math.PI / 2, 0, 0] })
  ];
}

function resourceVaultParts(palette, level) {
  return [
    ...baseParts(palette, 2.45, 2.45, level),
    part("cylinder", [0, 1.05, 0], [1.05, 1.55 + level * 0.2, 10], { color: palette.stone, metalness: 0.18 }),
    part("dodecahedron", [0, 2.15 + level * 0.1, 0], [0.72, 0.72, 0.72], { color: palette.accent, emissive: palette.glow, emissiveIntensity: 1.25, roughness: 0.3, metalness: 0.25 }),
    part("torus", [0, 1.35, 0], [1.16, 0.07, 24], { color: palette.accent, emissive: palette.glow, emissiveIntensity: 0.68 }, { rotation: [Math.PI / 2, 0, 0] })
  ];
}

function wallParts(palette, level) {
  return [
    part("rounded-box", [0, 0.46, 0], [1.28, 0.92, 1.18], { color: palette.stone, roughness: 0.9 }),
    part("rounded-box", [0, 1.02, 0], [1.36, 0.26, 1.24], { color: palette.stoneLight, roughness: 0.82 }),
    part("rounded-box", [-0.42, 1.24, 0], [0.22, 0.34, 1.14], { color: palette.stoneLight }),
    part("rounded-box", [0.42, 1.24, 0], [0.22, 0.34, 1.14], { color: palette.stoneLight })
  ];
}

function partsFor(style, palette, level) {
  if (style === "sanctum" || style === "barracks") return barracksParts(palette, level);
  if (style === "foundry") return foundryParts(palette, level);
  if (style === "watchtower") return watchtowerParts(palette, level);
  if (style === "storehouse") return storehouseParts(palette, level);
  if (style === "dungeon-heart") return dungeonHeartParts(palette, level);
  if (style === "defense-tower") return defenseTowerParts(palette, level);
  if (style === "resource-vault") return resourceVaultParts(palette, level);
  if (style === "fortress-wall") return wallParts(palette, level);
  return barracksParts(palette, level);
}

export function generateProceduralBuilding({ id, blueprintId, style, level = 1, seed = id } = {}) {
  const blueprint = BUILDING_BLUEPRINTS[String(blueprintId ?? "")];
  const resolvedStyle = String(style ?? blueprint?.style ?? blueprintId ?? "barracks");
  const resolvedLevel = Math.max(1, Math.min(BUILDING_MAX_LEVEL, Math.floor(Number(level) || 1)));
  const random = seeded(`${seed}:${resolvedStyle}:${resolvedLevel}`);
  const palette = PALETTES[resolvedStyle] ?? PALETTES.barracks;
  const parts = partsFor(resolvedStyle, palette, resolvedLevel).map((entry, index) => ({
    ...entry,
    id: `${id ?? resolvedStyle}:part-${index}`,
    rotation: entry.rotation ?? [0, (random() - 0.5) * 0.012, 0]
  }));
  const footprint = blueprint?.footprint
    ?? (resolvedStyle === "dungeon-heart" ? [3.8, 3.8] : resolvedStyle === "fortress-wall" ? [1.35, 1.25] : [2.5, 2.5]);
  const height = parts.reduce((maximum, entry) => Math.max(maximum, entry.position[1] + Math.max(...entry.size.slice(0, 2))), 0);
  return {
    schema: "battle-clash.procedural-building/1",
    id: String(id ?? `${resolvedStyle}-${hashSeed(seed)}`),
    blueprintId: blueprint?.id ?? null,
    style: resolvedStyle,
    level: resolvedLevel,
    seed: String(seed ?? id ?? resolvedStyle),
    footprint: [...footprint],
    collision: {
      shape: "aabb",
      halfExtents: { x: footprint[0] / 2, y: Math.max(0.5, height / 2), z: footprint[1] / 2 },
      offset: { x: 0, y: Math.max(0.5, height / 2), z: 0 }
    },
    parts
  };
}

export function battleBuildingStyle(entity = {}) {
  if (entity.role === "core" || entity.archetypeId === "heart") return "dungeon-heart";
  if (entity.role === "resource" || entity.archetypeId === "relic") return "resource-vault";
  if (entity.role === "wall" || entity.archetypeId === "wall") return "fortress-wall";
  if (entity.category === "building" || entity.role === "defense") return "defense-tower";
  return null;
}
