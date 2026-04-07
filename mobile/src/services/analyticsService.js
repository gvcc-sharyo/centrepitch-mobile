import api from "./api";

/**
 * CentrePitch analytics API (proxies to CA-1). Mirrors frontend/src/services/analyticsService.js.
 */
const analyticsService = {
  getScopePlayers: () => api.get("/analytics/scope-players").then((r) => r.data),

  verifyPlayerAccess: (playerId) =>
    api.get(`/analytics/verify-player/${encodeURIComponent(playerId)}`).then((r) => r.data),

  listPlayers: (params = {}) => api.get("/analytics/players", { params }).then((r) => r.data),

  getPlayerProfile: (playerId) =>
    api.get(`/analytics/players/${playerId}/profile`).then((r) => r.data),

  getPlayerMatches: (playerId, params = {}) =>
    api.get(`/analytics/players/${playerId}/matches`, { params }).then((r) => r.data),

  getPlayerTrends: (playerId) =>
    api.get(`/analytics/players/${playerId}/trends`).then((r) => r.data),

  getPlayerLast10Trends: (playerId, params = {}) =>
    api.get(`/analytics/players/${playerId}/last10-trends`, { params }).then((r) => r.data),

  getPlayerH2H: (playerId) =>
    api.get(`/analytics/players/${playerId}/h2h`).then((r) => r.data),

  getPlayerPressureRating: (playerId, params = {}) =>
    api.get(`/analytics/players/${playerId}/pressure-rating`, { params }).then((r) => r.data),

  listMatches: (params = {}) => api.get("/analytics/matches", { params }).then((r) => r.data),

  getMatchSummary: (matchId) =>
    api.get(`/analytics/matches/${encodeURIComponent(matchId)}/summary`).then((r) => r.data),

  getFullAnalytics: (matchId) =>
    api.get(`/analytics/matches/${encodeURIComponent(matchId)}/full-analytics`).then((r) => r.data),

  getScoreProgression: (matchId) =>
    api.get(`/analytics/matches/${encodeURIComponent(matchId)}/score-progression`).then((r) => r.data),

  getWinProbability: (matchId) =>
    api.get(`/analytics/matches/${encodeURIComponent(matchId)}/win-probability`).then((r) => r.data),

  getMomentum: (matchId) =>
    api.get(`/analytics/matches/${encodeURIComponent(matchId)}/momentum`).then((r) => r.data),

  getTurningPoints: (matchId) =>
    api.get(`/analytics/matches/${encodeURIComponent(matchId)}/turning-points`).then((r) => r.data),

  getRallyAnalysis: (matchId) =>
    api.get(`/analytics/matches/${encodeURIComponent(matchId)}/rally-analysis`).then((r) => r.data),

  getEndingTypes: (matchId) =>
    api.get(`/analytics/matches/${encodeURIComponent(matchId)}/ending-types`).then((r) => r.data),

  getPressureAnalysis: (matchId) =>
    api.get(`/analytics/matches/${encodeURIComponent(matchId)}/pressure-analysis`).then((r) => r.data),

  getShotStats: (matchId, playerId) =>
    api
      .get(`/analytics/matches/${encodeURIComponent(matchId)}/shot-stats`, {
        params: playerId ? { player_id: playerId } : {},
      })
      .then((r) => r.data),

  getCoachingBrief: (matchId) =>
    api.post(`/analytics/matches/${encodeURIComponent(matchId)}/coaching-brief`).then((r) => r.data),

  getSetAnalytics: (matchId, setNumber) =>
    api
      .get(`/analytics/matches/${encodeURIComponent(matchId)}/sets/${setNumber}/analytics`)
      .then((r) => r.data),

  listPermissions: () => api.get("/analytics/permissions").then((r) => r.data),

  listModules: () => api.get("/analytics/modules").then((r) => r.data),
};

export default analyticsService;
