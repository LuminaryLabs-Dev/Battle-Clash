const PROFILE_KEY = "battle-clash.profile.v1";

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
