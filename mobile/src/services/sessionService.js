import api from './api';

const sessionService = {
  // Coach
  createSession: (data) => api.post('/coaching-sessions', data),
  getMySessions: (params = {}) => api.get('/coaching-sessions/my', { params }),
  getSessionById: (id) => api.get(`/coaching-sessions/${id}`),
  updateSession: (id, data) => api.put(`/coaching-sessions/${id}`, data),
  deleteSession: (id, data = {}) => api.delete(`/coaching-sessions/${id}`, { data }),
  markAttendance: (id, data) => api.put(`/coaching-sessions/${id}/attendance`, data),
  getCoachAttendanceSummary: (params = {}) => api.get('/coaching-sessions/coach/attendance-summary', { params }),
  getCoachSessionWiseAttendance: (params = {}) => api.get('/coaching-sessions/coach/attendance-by-session', { params }),
  getCoachPlayerWiseAttendance: (params = {}) => api.get('/coaching-sessions/coach/attendance-by-player', { params }),

  // Player
  getPlayerSessions: (params = {}) => api.get('/coaching-sessions/player/my', { params }),
  getPlayerAvailableSessions: (params = {}) => api.get('/coaching-sessions/player/available', { params }),
  requestPlayerCheckIn: (id, data = {}) => api.post(`/coaching-sessions/${id}/player-checkin`, data),

  // Academy admin
  getAcademySessions: (params = {}) => api.get('/coaching-sessions/academy', { params }),
  createAcademySession: (data) => api.post('/coaching-sessions/academy', data),

  // Coach check-in approvals
  approvePlayerCheckIn: (sessionId, playerId, data = {}) => api.put(`/coaching-sessions/${sessionId}/player-checkin/${playerId}/approve`, data),
  rejectPlayerCheckIn: (sessionId, playerId, data = {}) => api.put(`/coaching-sessions/${sessionId}/player-checkin/${playerId}/reject`, data),
};

export default sessionService;
