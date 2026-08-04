export const ASSET_CATALOG_SCHEMA = "battle-clash.asset-catalog/1";

export const APPROVED_ASSETS = Object.freeze([]);

export function assetById(id, catalog = APPROVED_ASSETS) {
  return catalog.find((asset) => asset.id === id && asset.status === "approved") ?? null;
}

export function validateAssetEntry(entry) {
  const required = ["id", "objaverseUid", "slug", "sourceUrl", "license", "sha256", "path"];
  const missing = required.filter((key) => !entry?.[key]);
  return {
    accepted: missing.length === 0 && entry.status === "approved",
    missing
  };
}
