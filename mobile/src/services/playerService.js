import api from './api';

const playerService = {
  // Self-service player profile
  getMyProfile: () => api.get('/player/me'),
  updateMyProfile: (data) => api.put('/player/me', data),

  // Player dashboard & matches
  getDashboard: () => Promise.resolve({ data: { stats: { eventsParticipated: 0, wins: 0, losses: 0, draws: 0, rating: 0 }, upcomingMatches: [], recentResults: [], teams: [] } }),
  getMyMatches: async (params = {}) => {
    try {
      const res = await api.get('/player/my-matches', { params });
      return res.data;
    } catch (error) {
      if (error?.response?.status === 404 || error?.response?.status === 501) {
        return { data: [], pagination: { current: 1, pages: 1, total: 0 } };
      }
      throw error;
    }
  },
  getAttendedMatches: async (params = {}) => {
    try {
      const response = await api.get('/player/my-matches', {
        params: { ...params, status: 'completed' },
      });
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404 || error?.response?.status === 501) {
        return { data: [], pagination: { current: 1, pages: 1, total: 0 } };
      }
      throw error;
    }
  },

  // Get all players in academy pool (players who joined this academy)
  getAcademyPlayers: (params = {}) => api.get('/player/academy', { params }),

  // Get single player
  getPlayerById: (id) => api.get(`/player/${id}`),

  // Update player
  updatePlayer: (id, data) => api.put(`/player/${id}`, data),

  // Remove player from academy
  deletePlayer: (id) => api.delete(`/player/${id}`),

  // Player's registered events (my events list + event tracker)
  getMyEvents: (params = {}) =>
    api.get('/events/my-registrations', { params }).then((res) => res.data),
  getEventTracker: (params = {}) =>
    api.get('/events/my-registrations', { params: { limit: 100, track: '1', ...params } }).then((res) => res.data),
};

export default playerService;
