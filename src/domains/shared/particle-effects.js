export const PARTICLE_TYPES = Object.freeze([
  "deployment-rune",
  "movement-dust",
  "projectile-trail",
  "hero-ability-burst",
  "hit-spark",
  "damage-burst",
  "healing-pulse",
  "hazard-pulse",
  "boss-phase-shockwave",
  "victory-collapse",
  "sanctum-ambient"
]);

export function particleEffect(type, position, options = {}) {
  if (!PARTICLE_TYPES.includes(type)) throw new Error(`Unknown particle type: ${type}`);
  return {
    id: options.id ?? `${type}:${crypto.randomUUID()}`,
    type,
    position: { x: Number(position?.x ?? 0), y: Number(position?.y ?? 0), z: Number(position?.z ?? 0) },
    color: options.color ?? "#ffffff",
    intensity: Number(options.intensity ?? 1),
    duration: Number(options.duration ?? 0.8),
    seed: Number(options.seed ?? 0),
    gameplay: false
  };
}
