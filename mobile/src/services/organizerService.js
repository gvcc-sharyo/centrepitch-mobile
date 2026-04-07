import api from './api';

const organizerService = {
  getDashboard: async (params = {}) => {
    try {
      const response = await api.get('/organizer/dashboard', { params });
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404) {
        const fallbackResponse = await api.get('/organizers/dashboard', { params });
        return fallbackResponse.data;
      }
      throw error;
    }
  },

  getAvailablePlayers: async (params = {}) => {
    const response = await api.get('/organizer/available-players', { params });
    return response.data;
  },

  getTeams: async (params = {}) => {
    const response = await api.get('/organizer/teams', { params });
    return response.data;
  },

  getCoachTeams: async (params = {}) => {
    const response = await api.get('/organizer/coach-teams', { params });
    return response.data;
  },

  getMyEvents: async (params = {}) => {
    const response = await api.get('/organizer/events', { params });
    return response.data;
  },

  addTeamToEvent: async (eventId, teamId) => {
    const response = await api.post(`/organizer/events/${eventId}/teams`, { teamId });
    return response.data;
  },

  getEventParticipants: async (eventId) => {
    const response = await api.get(`/organizer/events/${eventId}/participants`);
    return response.data;
  },

  updateParticipantStatus: async (eventId, participantId, status, type) => {
    const response = await api.put(`/organizer/events/${eventId}/participants/${participantId}`, { status, type });
    return response.data;
  },

  getEventRevenue: async (eventId) => {
    const response = await api.get(`/organizer/events/${eventId}/revenue`);
    return response.data;
  },

  contactSuperAdmin: async (queryData) => {
    const response = await api.post('/organizer/contact-admin', queryData);
    return response.data;
  },

  getRevenueAnalytics: async (params = {}) => {
    const response = await api.get('/organizer/revenue-analytics', { params });
    return response.data;
  },

  // Match Scheduling
  getEventSchedule: async (eventId) => {
    const response = await api.get(`/organizer/events/${eventId}/schedule`);
    return response.data;
  },

  getParticipantsForScheduling: async (eventId) => {
    const response = await api.get(`/organizer/events/${eventId}/scheduling-participants`);
    return response.data;
  },
  getEventStandings: async (eventId) => {
    const response = await api.get(`/organizer/events/${eventId}/standings`);
    return response.data;
  },

  createRound: async (eventId, roundName) => {
    const response = await api.post(`/organizer/events/${eventId}/schedule/rounds`, { roundName });
    return response.data;
  },

  deleteRound: async (eventId, roundName) => {
    const response = await api.delete(`/organizer/events/${eventId}/schedule/rounds/${roundName}`);
    return response.data;
  },

  createMatch: async (eventId, matchData) => {
    const response = await api.post(`/organizer/events/${eventId}/schedule/matches`, matchData);
    return response.data;
  },

  updateMatch: async (eventId, matchId, matchData) => {
    const response = await api.put(`/organizer/events/${eventId}/schedule/matches/${matchId}`, matchData);
    return response.data;
  },

  updateMatchResult: async (eventId, matchId, resultData) => {
    const response = await api.put(`/organizer/events/${eventId}/schedule/matches/${matchId}/result`, resultData);
    return response.data;
  },
  getMatchStats: async (eventId, matchId) => {
    const response = await api.get(`/organizer/events/${eventId}/schedule/matches/${matchId}/stats`);
    return response.data;
  },
  upsertMatchStats: async (eventId, matchId, statsData) => {
    const response = await api.put(`/organizer/events/${eventId}/schedule/matches/${matchId}/stats`, statsData);
    return response.data;
  },

  deleteMatch: async (eventId, matchId, roundName) => {
    const response = await api.delete(`/organizer/events/${eventId}/schedule/matches/${matchId}`, {
      params: { roundName }
    });
    return response.data;
  },

  // Query Management
  getMyQueries: async (params = {}) => {
    const response = await api.get('/organizer/queries', { params });
    return response.data;
  },

  getMyQuery: async (id) => {
    const response = await api.get(`/organizer/queries/${id}`);
    return response.data;
  },

  // Scorer Management
  createScorer: async (scorerData) => {
    const response = await api.post('/organizer/scorers', scorerData);
    return response.data;
  },

  getScorers: async (params = {}) => {
    const response = await api.get('/organizer/scorers', { params });
    return response.data;
  },

  assignScorerToEvent: async (eventId, scorerId) => {
    const response = await api.post(`/organizer/events/${eventId}/assign-scorer`, { scorerId });
    return response.data;
  },

  removeScorerFromEvent: async (eventId, scorerId) => {
    const response = await api.delete(`/organizer/events/${eventId}/scorers/${scorerId}`);
    return response.data;
  },

  sendEventAnnouncement: async (eventId, payload) => {
    const response = await api.post(`/organizer/events/${eventId}/announcement`, payload);
    return response.data;
  }
};

export default organizerService;
