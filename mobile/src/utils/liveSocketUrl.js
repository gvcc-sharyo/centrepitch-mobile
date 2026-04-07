import { getApiBaseUrl } from "../services/api";

/** Socket.IO origin (same host as API, without `/api`). Override with EXPO_PUBLIC_WS_URL. */
export function getLiveSocketUrl() {
  const override = process.env.EXPO_PUBLIC_WS_URL;
  if (override && String(override).trim()) {
    try {
      return new URL(String(override).trim()).origin;
    } catch {
      // fall through
    }
  }
  const raw = getApiBaseUrl();
  try {
    const normalized = raw.includes("://") ? raw : `http://${raw}`;
    const u = new URL(normalized);
    let path = u.pathname.replace(/\/$/, "");
    if (path.endsWith("/api")) path = path.slice(0, -4);
    u.pathname = path === "" ? "/" : path;
    return u.origin;
  } catch {
    return "";
  }
}
