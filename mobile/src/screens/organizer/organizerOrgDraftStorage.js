import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "organizer_org_profile_draft_v1_";

export function orgDraftStorageKey(userId) {
  const id = String(userId || "").trim();
  return id ? `${PREFIX}${id}` : null;
}

export async function loadOrgDraft(userId) {
  const key = orgDraftStorageKey(userId);
  if (!key) return null;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveOrgDraft(userId, data) {
  const key = orgDraftStorageKey(userId);
  if (!key) return;
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export async function clearOrgDraft(userId) {
  const key = orgDraftStorageKey(userId);
  if (!key) return;
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
