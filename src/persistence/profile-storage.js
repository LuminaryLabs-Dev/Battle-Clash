const PROFILE_KEY = "battle-clash.profile.v1";
const WORLD_PROFILE_KEY = "battle-clash.world-profile.v1";
const CONTENT_PROFILE_KEY = "battle-clash.content-profile.v1";

export function loadProgressionProfile(storage = window.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(PROFILE_KEY) ?? "null");
    return value?.schema === "battle-clash.progression/1" ? value : {};
  } catch {
    return {};
  }
}

export function saveProgressionProfile(
  profile,
  storage = window.localStorage
) {
  if (profile?.schema !== "battle-clash.progression/1") return false;
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

export function loadWorldProfile(storage = window.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(WORLD_PROFILE_KEY) ?? "null");
    return value?.schema === "battle-clash.world/1" ? value : {};
  } catch {
    return {};
  }
}

export function saveWorldProfile(world, storage = window.localStorage) {
  if (world?.schema !== "battle-clash.world/1") return false;
  try {
    storage.setItem(WORLD_PROFILE_KEY, JSON.stringify(world));
    return true;
  } catch {
    return false;
  }
}

export function loadContentProfile(storage = window.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(CONTENT_PROFILE_KEY) ?? "null");
    return value?.schema === "battle-clash.content/1" ? value : {};
  } catch {
    return {};
  }
}

export function saveContentProfile(content, storage = window.localStorage) {
  if (content?.schema !== "battle-clash.content/1") return false;
  try {
    storage.setItem(CONTENT_PROFILE_KEY, JSON.stringify(content));
    return true;
  } catch {
    return false;
  }
}
