function round(value, digits = 3) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

export function normalizePlayerObservation(snapshot = {}, { viewport = "desktop", screenshot = null } = {}) {
  const entities = Array.isArray(snapshot.entities) ? snapshot.entities : [];
  const threats = entities
    .filter((entity) => entity.faction === "enemy" && Number(entity.health?.current ?? 0) > 0)
    .reduce((counts, entity) => {
      const key = String(entity.archetypeId ?? entity.role ?? "unknown");
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
  const actions = [];
  const scene = snapshot.scene?.current ?? "unknown";
  const phase = snapshot.raid?.phase ?? "idle";
  if (scene === "sanctum") actions.push("open_frontier");
  if (scene === "overworld") actions.push("discover_next");
  if (scene.startsWith("territory:")) actions.push("enter_territory");
  if (phase === "deploy" && Number(snapshot.deployment?.remaining ?? 0) > 0) actions.push("deploy_delver");
  if (phase === "deploy" && snapshot.defense?.fortifyAvailable) actions.push("fortify");
  if (phase === "deploy") actions.push("start_raid");
  if (snapshot.ability && Number(snapshot.ability.cooldownRemaining ?? 0) <= 0) actions.push("use_hero_ability");
  if (["won", "lost"].includes(phase)) actions.push("return_home");
  return {
    schema: "battle-clash.observation/1",
    scene,
    phase,
    territoryId: snapshot.world?.currentTerritoryId ?? null,
    frontDirection: snapshot.territory?.frontDirection ?? null,
    hero: { healthRatio: round((snapshot.hero?.health?.current ?? snapshot.hero?.health ?? 0) / Math.max(1, snapshot.hero?.health?.maximum ?? 1)), abilityReady: Number(snapshot.ability?.cooldownRemaining ?? 0) <= 0 },
    army: { deployed: Number(snapshot.deployment?.deployed ?? 0), reserve: Number(snapshot.deployment?.remaining ?? 0) },
    objective: snapshot.objective?.current ?? snapshot.objective?.kind ?? null,
    visibleThreats: Object.entries(threats).sort(([left], [right]) => left.localeCompare(right)).map(([family, count]) => ({ family, count })),
    availableActions: [...new Set(actions)],
    viewport,
    screenshot
  };
}

export function playerObservationKey(observation) {
  const stable = { scene: observation.scene, phase: observation.phase, territoryId: observation.territoryId, frontDirection: observation.frontDirection, hero: observation.hero, army: observation.army, objective: observation.objective, visibleThreats: observation.visibleThreats, availableActions: observation.availableActions };
  return JSON.stringify(stable);
}
