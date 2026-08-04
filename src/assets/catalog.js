import manifest from "./approved-manifest.json" with { type: "json" };

export const ASSET_CATALOG_SCHEMA = "battle-clash.asset-catalog/1";

export const APPROVED_ASSETS = Object.freeze(
  (manifest?.schema === ASSET_CATALOG_SCHEMA ? manifest.assets : [])
    .filter((asset) => asset?.status === "approved")
    .map((asset) => Object.freeze({ ...asset }))
);

export function assetById(id, catalog = APPROVED_ASSETS) {
  return catalog.find((asset) => asset.id === id && asset.status === "approved") ?? null;
}

export function resolveRenderableAsset(id, catalog = APPROVED_ASSETS) {
  const asset = assetById(id, catalog);
  return asset
    ? { kind: "gltf", assetId: asset.id, path: asset.path }
    : { kind: "cube-fallback", assetId: null, path: null };
}

export function validateAssetEntry(entry) {
  const required = ["id", "objaverseUid", "slug", "sourceUrl", "license", "sha256", "path"];
  const missing = required.filter((key) => !entry?.[key]);
  return {
    accepted: missing.length === 0 && entry.status === "approved",
    missing
  };
}
