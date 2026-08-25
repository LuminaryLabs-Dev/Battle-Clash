import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { BUILDING_BLUEPRINT_ORDER } from "../src/data/buildings.js";
import { generateProceduralBuilding } from "../src/buildings/procedural-building-generator.js";

const blueprintId = String(process.argv[2] ?? "watchtower");
if (!BUILDING_BLUEPRINT_ORDER.includes(blueprintId)) {
  throw new TypeError(`Unknown blueprint ${blueprintId}. Choose: ${BUILDING_BLUEPRINT_ORDER.join(", ")}`);
}
const level = Math.max(1, Math.min(3, Math.floor(Number(process.argv[3]) || 1)));
const output = resolve(process.argv[4] ?? `artifacts/buildings/${blueprintId}-level-${level}.json`);
const descriptor = generateProceduralBuilding({
  id: `${blueprintId}-preview`,
  blueprintId,
  level,
  seed: `battle-clash:${blueprintId}:preview`
});
await import("node:fs/promises").then(({ mkdir }) => mkdir(dirname(output), { recursive: true }));
await writeFile(output, `${JSON.stringify(descriptor, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, output, blueprintId, level, partCount: descriptor.parts.length, collision: descriptor.collision }, null, 2));
