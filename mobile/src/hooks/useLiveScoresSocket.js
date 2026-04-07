import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

import { getLiveSocketUrl } from "../utils/liveSocketUrl";

/**
 * Subscribes to backend `live_scores_refresh` and calls onRefresh (e.g. refetch GET /events/live).
 */
export function useLiveScoresSocket(onRefresh) {
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;

  useEffect(() => {
    const origin = getLiveSocketUrl();
    if (!origin) return undefined;

    const socket = io(origin, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    const handler = () => {
      try {
        cbRef.current?.();
      } catch (e) {
        if (__DEV__) console.warn("live_scores_refresh handler failed", e);
      }
    };

    socket.on("live_scores_refresh", handler);
    return () => {
      socket.off("live_scores_refresh", handler);
      socket.disconnect();
    };
  }, []);
}
