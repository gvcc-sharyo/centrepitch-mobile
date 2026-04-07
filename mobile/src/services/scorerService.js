import api from './api';

const scorerService = {
  getDashboard: async () => {
    const response = await api.get('/scorer/dashboard');
    return response.data;
  },

  getAssignedEvents: async (params = {}) => {
    const response = await api.get('/scorer/events', { params });
    return response.data;
  },

  getAssignedEvent: async (eventId) => {
    const response = await api.get(`/scorer/events/${eventId}`);
    return response.data;
  },

  // Match Scheduling (same as organizer)
  getEventSchedule: async (eventId) => {
    const response = await api.get(`/scorer/events/${eventId}/schedule`);
    return response.data;
  },

  getParticipantsForScheduling: async (eventId) => {
    const response = await api.get(`/scorer/events/${eventId}/scheduling-participants`);
    return response.data;
  },
  getEventStandings: async (eventId) => {
    const response = await api.get(`/scorer/events/${eventId}/standings`);
    return response.data;
  },

  createRound: async (eventId, roundName) => {
    const response = await api.post(`/scorer/events/${eventId}/schedule/rounds`, { roundName });
    return response.data;
  },

  deleteRound: async (eventId, roundName) => {
    const response = await api.delete(`/scorer/events/${eventId}/schedule/rounds/${roundName}`);
    return response.data;
  },

  createMatch: async (eventId, matchData) => {
    const response = await api.post(`/scorer/events/${eventId}/schedule/matches`, matchData);
    return response.data;
  },

  updateMatch: async (eventId, matchId, matchData) => {
    const response = await api.put(`/scorer/events/${eventId}/schedule/matches/${matchId}`, matchData);
    return response.data;
  },

  updateMatchResult: async (eventId, matchId, resultData) => {
    const response = await api.put(`/scorer/events/${eventId}/schedule/matches/${matchId}/result`, resultData);
    return response.data;
  },
  getMatchStats: async (eventId, matchId) => {
    const response = await api.get(`/scorer/events/${eventId}/schedule/matches/${matchId}/stats`);
    return response.data;
  },
  upsertMatchStats: async (eventId, matchId, statsData) => {
    const response = await api.put(`/scorer/events/${eventId}/schedule/matches/${matchId}/stats`, statsData);
    return response.data;
  },

  deleteMatch: async (eventId, matchId, roundName) => {
    const response = await api.delete(`/scorer/events/${eventId}/schedule/matches/${matchId}`, {
      params: { roundName }
    });
    return response.data;
  }
};

export default scorerService;

