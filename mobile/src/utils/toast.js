const listeners = new Set();

export function subscribeToToasts(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(type, message) {
  for (const l of listeners) {
    try {
      l({ type, message });
    } catch {
      // ignore listener errors
    }
  }
}

const normalize = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (typeof value.message === "string") return value.message;
    if (typeof value.error === "string") return value.error;
  }
  return String(value);
};

export const toast = {
  success: (message) => emit("success", normalize(message)),
  error: (message) => emit("error", normalize(message)),
  loading: (message) => emit("loading", normalize(message)),
  info: (message) => emit("info", normalize(message)),
  dismiss: () => emit("dismiss", ""),
};

