/** Socket.IO instance set from server.js; emits public live score refresh events. */

let ioRef = null;

export const setLiveScoreIo = (io) => {
  ioRef = io;
};

/**
 * Notify all connected clients to refresh live match data (landing / home).
 * Payload is optional metadata for future targeted updates.
 */
export const emitLiveScoresRefresh = (meta = {}) => {
  if (!ioRef) return;
  try {
    ioRef.emit("live_scores_refresh", {
      ts: Date.now(),
      ...meta,
    });
  } catch (e) {
    console.warn("emitLiveScoresRefresh failed:", e?.message || e);
  }
};
