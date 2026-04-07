import axios from "axios";
import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";
import { getStore } from "../store/storeRef";
import { getErrorMessage } from "../utils/helpers";
import { toast } from "../utils/toast";

const tryHost = (value) => {
  if (!value || typeof value !== "string") return null;
  const host = value.split(":")[0]?.trim();
  if (host && host !== "localhost" && host !== "127.0.0.1") return host;
  return null;
};

/** Port + path from EXPO_PUBLIC_API_URL (hostname may be stale — we replace it in dev). */
const getApiUrlPartsFromEnv = () => {
  const raw = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api";
  try {
    const u = new URL(raw);
    const port = u.port ? parseInt(u.port, 10) : u.protocol === "https:" ? 443 : 80;
    let path = u.pathname || "/api";
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    if (!path || path === "/") path = "/api";
    return { port: Number.isFinite(port) && port > 0 ? port : 8000, basePath: path, raw };
  } catch {
    return { port: 8000, basePath: "/api", raw };
  }
};

/**
 * Same PC as Metro (Expo Go). Do not trust a fixed LAN IP in .env — it drifts across networks.
 */
const getDevMachineHostname = () => {
  if (Platform.OS === "web") return null;

  const manual = process.env.EXPO_PUBLIC_DEV_API_HOST?.trim();
  if (manual) return manual.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];

  const fromExpoConfig = tryHost(Constants.expoConfig?.hostUri);
  if (fromExpoConfig) return fromExpoConfig;

  const fromManifest = tryHost(Constants.manifest?.debuggerHost);
  if (fromManifest) return fromManifest;

  const extraClient = Constants.manifest2?.extra?.expoClient;
  const fromManifest2 = tryHost(extraClient?.hostUri);
  if (fromManifest2) return fromManifest2;

  const expoGoExtra = Constants.manifest2?.extra?.expoGo;
  const fromExpoGoManifest = tryHost(
    expoGoExtra?.debuggerHost || expoGoExtra?.hostUri || expoGoExtra?.host,
  );
  if (fromExpoGoManifest) return fromExpoGoManifest;

  const eg = Constants.expoGoConfig;
  if (eg && typeof eg === "object") {
    for (const k of ["debuggerHost", "hostUri", "packagerOpts"]) {
      const v = eg[k];
      if (typeof v === "string") {
        const h = tryHost(v);
        if (h) return h;
      }
      if (v && typeof v === "object" && typeof v.host === "string") {
        const h = tryHost(v.host);
        if (h) return h;
      }
    }
  }

  try {
    const exp = Constants.experienceUrl;
    if (exp && typeof exp === "string") {
      const h = new URL(exp.replace(/^exp:/, "http:")).hostname;
      if (h && h !== "localhost" && h !== "127.0.0.1") return h;
    }
  } catch {
    // ignore
  }

  try {
    const sc = NativeModules.SourceCode;
    const scriptURL =
      typeof sc?.getConstants === "function" ? sc.getConstants().scriptURL : sc?.scriptURL;
    const m = scriptURL?.match(/^https?:\/\/([^/:]+)/);
    const host = m?.[1];
    if (host && host !== "localhost" && host !== "127.0.0.1") return host;
  } catch {
    // ignore
  }

  return null;
};

/**
 * In dev, native builds always use Metro host + port/path from env (avoids stale 192.168.x.x in .env).
 * Production / web: use EXPO_PUBLIC_API_URL as-is.
 */
const resolveApiBaseUrl = () => {
  const { port, basePath, raw } = getApiUrlPartsFromEnv();
  if (!__DEV__ || Platform.OS === "web") {
    return raw;
  }

  if (Platform.OS === "android") {
    const devHost = getDevMachineHostname();
    const host = devHost || "10.0.2.2";
    const url = `http://${host}:${port}${basePath}`;
    if (__DEV__) console.log("[api] baseURL", url);
    return url;
  }

  if (Platform.OS === "ios") {
    const devHost = getDevMachineHostname();
    if (devHost) {
      const url = `http://${devHost}:${port}${basePath}`;
      if (__DEV__) console.log("[api] baseURL", url);
      return url;
    }
    return `http://localhost:${port}${basePath}`;
  }

  return raw;
};

const API_URL = resolveApiBaseUrl();

/** Resolved API root (e.g. `http://host:8000/api`) — use for `fetch` uploads where axios multipart is unreliable on RN. */
export function getApiBaseUrl() {
  return API_URL;
}

const SUBSCRIPTION_PROMPT_COOLDOWN_MS = 3000;
let lastSubscriptionPromptAt = 0;
let analytics502DevLogged = false;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

/** Path segments relative to API base (e.g. ["coaches","public"]) */
const getApiPathSegments = (config) => {
  if (!config?.url) return [];
  let url = String(config.url).split("?")[0];
  if (url.startsWith("http")) {
    try {
      const { pathname } = new URL(url);
      url = pathname.replace(/^\/api(?=\/)/, "");
    } catch {
      return [];
    }
  }
  return url.replace(/^\/+/, "").split("/").filter(Boolean);
};

const MONGO_OBJECT_ID = /^[a-fA-F0-9]{24}$/;

/**
 * Guest-facing catalog/detail GETs must work even if storage has a stale JWT.
 * Omit Authorization and skip global 401 logout for these URLs.
 */
const isPublicAnonymousCatalogGet = (config) => {
  if (!config) return false;
  const method = String(config.method || "get").toLowerCase();
  if (method !== "get") return false;

  const parts = getApiPathSegments(config);
  if (parts.length < 2) return false;

  if (parts[0] === "coaches" && parts[1] === "public") {
    if (parts.length === 2) return true;
    if (parts.length === 3 && MONGO_OBJECT_ID.test(parts[2])) return true;
    return false;
  }

  if (parts[0] === "academies" && parts[1] === "public") {
    if (parts.length === 2) return true;
    if (parts.length === 3 && MONGO_OBJECT_ID.test(parts[2])) return true;
    return false;
  }

  if (parts[0] === "academies" && parts.length === 2) {
    const seg = parts[1];
    const reserved = new Set(["public", "my", "pending", "admin", "register"]);
    if (reserved.has(seg)) return false;
    return MONGO_OBJECT_ID.test(seg);
  }

  if (parts[0] === "courts" && parts[1] === "public") {
    if (parts.length === 2) return true;
    if (parts.length === 3 && MONGO_OBJECT_ID.test(parts[2])) return true;
    return false;
  }

  if (parts[0] === "court-plans" && parts[1] === "public") {
    return true;
  }

  return false;
};

/** Hermes / RN FormData sometimes fails `instanceof FormData`; still must drop JSON Content-Type for multipart. */
function isLikelyReactNativeFormData(body) {
  if (!body || typeof body !== "object") return false;
  if (body instanceof URLSearchParams) return false;
  if (typeof FormData !== "undefined" && body instanceof FormData) return true;
  if (typeof body.append !== "function") return false;
  if (Object.prototype.toString.call(body) === "[object FormData]") return true;
  if (Array.isArray(body._parts)) return true;
  return false;
}

api.interceptors.request.use(
  (config) => {
    const reduxStore = getStore();
    const token = reduxStore?.getState()?.auth?.token;

    if (token && !isPublicAnonymousCatalogGet(config)) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Default instance header is application/json; multipart must omit Content-Type so the
    // native client sets multipart boundary (otherwise Android often fails with "Network Error").
    const body = config.data;
    const isMultipart = isLikelyReactNativeFormData(body);
    if (isMultipart && config.headers) {
      const h = config.headers;
      if (typeof h.delete === "function") {
        h.delete("Content-Type");
        h.delete("content-type");
      } else {
        delete h["Content-Type"];
        delete h["content-type"];
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";
    const code = error.response?.data?.code;
    const message = error.response?.data?.message;

    const isAuthRoute =
      url.includes("/login") ||
      url.includes("/admin-login") ||
      url.includes("/register") ||
      url.includes("/forgot-password") ||
      url.includes("/reset-password") ||
      url.includes("/bootstrap-superadmin") ||
      url.includes("/pending/");

    if (code === "SUBSCRIPTION_REQUIRED" || status === 402) {
      const now = Date.now();
      const shouldPrompt = now - lastSubscriptionPromptAt > SUBSCRIPTION_PROMPT_COOLDOWN_MS;
      if (shouldPrompt) {
        lastSubscriptionPromptAt = now;
        toast.error(message || "Active subscription required for this action");
        // Mobile: navigate to subscription screen or show paywall when you wire it (no window events).
      }
    }

    if (status === 401 && !isAuthRoute) {
      if (isPublicAnonymousCatalogGet(error.config)) {
        return Promise.reject(error);
      }
      getStore()?.dispatch({ type: "auth/logout" });
      // Mobile: AppNavigator reacts to auth state; optional deep link to Login if needed.
    }

    const userFriendlyMessage = getErrorMessage(error);
    error.userMessage = userFriendlyMessage;

    const analyticsOptional =
      status === 502 && typeof url === "string" && url.includes("/analytics/");

    if (__DEV__ && !(status === 402 && code === "SUBSCRIPTION_REQUIRED")) {
      if (analyticsOptional) {
        if (!analytics502DevLogged) {
          analytics502DevLogged = true;
          console.warn(
            "[api] Analytics API returned 502 (CA-1 unreachable or ANALYTICS_API_URL misconfigured on the server). Further 502s on /analytics/ suppressed in dev."
          );
        }
      } else {
        console.error(`API Error [${status || "NETWORK"}] ${url}:`, {
          message: userFriendlyMessage,
          originalError: error.message,
          response: error.response?.data,
        });
      }
    }

    return Promise.reject(error);
  },
);

export default api;
