import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { academyService, courtService } from "../../../services";
import coachService from "../../../services/coachService";
import eventService from "../../../services/eventService";
import sportService from "../../../services/sportService";
import {
  excludeOwnAcademyProfiles,
  excludeOwnCoachProfiles,
  shouldHideOwnProfilesInDiscovery,
} from "../../../utils/discoveryVisibility";

const STORAGE_CITY = "cp.landing.city";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function useLandingData({ isAuthenticated, authUser }) {
  const [city, setCity] = useState("");
  const [cityReady, setCityReady] = useState(false);

  const [activeSport, setActiveSport] = useState("all");
  const [sportsTabs, setSportsTabs] = useState([{ key: "all", label: "All Sports" }]);

  const [courts, setCourts] = useState([]);
  const [courtsLoading, setCourtsLoading] = useState(true);
  const [coaches, setCoaches] = useState([]);
  const [coachesLoading, setCoachesLoading] = useState(true);
  const [academies, setAcademies] = useState([]);
  const [academiesLoading, setAcademiesLoading] = useState(true);

  const [liveEvents, setLiveEvents] = useState([]);
  const [isLoadingLive, setIsLoadingLive] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_CITY);
        if (mounted && saved) setCity(saved);
      } finally {
        if (mounted) setCityReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!cityReady) return;
    AsyncStorage.setItem(STORAGE_CITY, String(city || "").trim()).catch(() => {});
  }, [city, cityReady]);

  useEffect(() => {
    let alive = true;
    sportService
      .getCoachingSportsList()
      .then((res) => {
        const raw = res?.data || res || [];
        const arr = safeArray(raw) || safeArray(raw?.data);
        const list = safeArray(arr).map((s) => ({
          key: s?._id || s?.id || s?.name || String(s),
          label: s?.name || String(s),
        }));
        if (!alive) return;
        setSportsTabs([{ key: "all", label: "All Sports" }, ...list.filter((x) => x.key && x.label)]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const fetchCourts = useCallback(async () => {
    try {
      setCourtsLoading(true);
      const params = { limit: 20 };
      if (activeSport !== "all") params.sportType = activeSport;
      if (city?.trim()) params.city = city.trim();
      const res = await courtService.getPublicCourts(params);
      const list = res?.data?.data || res?.data || [];
      setCourts(safeArray(list));
    } catch {
      setCourts([]);
    } finally {
      setCourtsLoading(false);
    }
  }, [activeSport, city]);

  useEffect(() => {
    fetchCourts();
  }, [fetchCourts]);

  const fetchCoaches = useCallback(async () => {
    try {
      setCoachesLoading(true);
      const res = await coachService.getPublicCoaches({ limit: 20 });
      const raw = res?.data?.data || res?.data?.coaches || res?.data || [];
      const arr = safeArray(raw);
      const filtered = shouldHideOwnProfilesInDiscovery(isAuthenticated, authUser)
        ? excludeOwnCoachProfiles(arr, authUser)
        : arr;
      setCoaches(filtered);
    } catch {
      setCoaches([]);
    } finally {
      setCoachesLoading(false);
    }
  }, [isAuthenticated, authUser]);

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

  const fetchAcademies = useCallback(async () => {
    try {
      setAcademiesLoading(true);
      const res = await academyService.getPublicAcademies({ limit: 20 });
      const raw = res?.data?.data || res?.data || [];
      const arr = safeArray(raw);
      const filtered = shouldHideOwnProfilesInDiscovery(isAuthenticated, authUser)
        ? excludeOwnAcademyProfiles(arr, authUser)
        : arr;
      setAcademies(filtered);
    } catch {
      setAcademies([]);
    } finally {
      setAcademiesLoading(false);
    }
  }, [isAuthenticated, authUser]);

  useEffect(() => {
    fetchAcademies();
  }, [fetchAcademies]);

  useEffect(() => {
    let alive = true;
    const fetchLive = async () => {
      try {
        const res = await eventService.getLiveEvents();
        const raw = res?.data || res || [];
        if (!alive) return;
        setLiveEvents(safeArray(raw));
      } catch {
        if (!alive) return;
        setLiveEvents([]);
      } finally {
        if (!alive) return;
        setIsLoadingLive(false);
      }
    };

    fetchLive();
    const interval = setInterval(fetchLive, 30 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const liveMatches = useMemo(() => {
    const arr = safeArray(liveEvents);
    const toTimeLabel = (value) => {
      if (!value) return "Live now";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Live now";
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    return arr.flatMap((event) =>
      safeArray(event?.liveMatches).map((match) => ({
        id: match?._id || `${event?._id}-${match?.round || "live"}`,
        eventId: event?._id,
        title: `${match?.team1Name || match?.player1Name || "Team 1"} vs ${
          match?.team2Name || match?.player2Name || "Team 2"
        }`,
        level: match?.round || "Live",
        fee: Number(event?.registrationFee) > 0 ? `₹${event.registrationFee} / slot` : "Free",
        timeLabel: toTimeLabel(match?.dateTime || event?.startDate),
        joined:
          event?.gameFormat === "team"
            ? `${event?.registeredTeams?.length || 0} teams joined`
            : `${event?.registeredPlayers?.length || 0} players joined`,
      }))
    );
  }, [liveEvents]);

  return {
    city,
    setCity,
    activeSport,
    setActiveSport,
    sportsTabs,

    courts,
    courtsLoading,
    fetchCourts,

    coaches,
    coachesLoading,

    academies,
    academiesLoading,

    liveEvents,
    isLoadingLive,
    liveMatches,
  };
}

