import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const output = path.resolve(process.env.RELEASE_AUDIT_PATH ?? "release-audit.json");
const audit = {
  schema: "battle-clash.release-audit/1",
  status: process.env.RELEASE_STATUS ?? "pending-live-verification",
  deploymentSha: process.env.GITHUB_SHA ?? "local",
  pagesUrl: process.env.RELEASE_PAGE_URL ?? "https://luminarylabs-dev.github.io/Battle-Clash/",
  generatedAt: new Date().toISOString(),
  artifacts: {
    pagesEntry: "docs/index.html",
    approvedAssetManifest: "src/assets/approved-manifest.json"
  },
  proof: {
    browserArtifact: process.env.BROWSER_PROOF_ARTIFACT ?? null,
    matchReceiptId: null,
    profileRevision: null,
    consoleErrors: null,
    backendErrors: null
  },
  redaction: {
    credentials: "excluded",
    accessTokens: "excluded",
    passwords: "excluded",
    privateProfilePayloads: "excluded"
  }
};

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, output, schema: audit.schema, status: audit.status }, null, 2));
