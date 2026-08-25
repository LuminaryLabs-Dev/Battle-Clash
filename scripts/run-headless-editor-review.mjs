import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const editorEntry = process.env.NEXUS_ENGINE_EDITOR_PATH
  ? pathToFileURL(resolve(process.env.NEXUS_ENGINE_EDITOR_PATH)).href
  : "@luminarylabs/nexusengine-editor/headless";
const { createHeadlessEditor } = await import(editorEntry);
const workspace = resolve(process.argv[2] ?? "artifacts/headless-editor-review");
const adapter = resolve("src/hosts/headless/battle-clash-headless-adapter.js");
await mkdir(workspace, { recursive: true });

const editor = await createHeadlessEditor({
  project: adapter,
  workspace,
  rendering: { provider: "auto", fallback: "lavapipe" },
  width: 960,
  height: 540
});

try {
  const result = await editor.run({
    goal: "Deploy a Battle Clash squad through the visible deployment target and begin the raid.",
    target: "deploy-slot",
    action: { type: "deploy-and-raid" },
    observeSteps: 90
  });
  await writeFile(resolve(workspace, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} finally {
  await editor.shutdown();
}

