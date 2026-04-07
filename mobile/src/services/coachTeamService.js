import api from './api';

const coachTeamService = {
  createTeam: (data) => api.post('/coach-teams', data),
  getMyTeams: () => api.get('/coach-teams/my'),
  getTeamById: (id) => api.get(`/coach-teams/${id}`),
  updateTeam: (id, data) => api.put(`/coach-teams/${id}`, data),
  deleteTeam: (id) => api.delete(`/coach-teams/${id}`),
  addPlayer: (teamId, data) => api.put(`/coach-teams/${teamId}/add-player`, data),
  invitePlayer: (teamId, data) => api.put(`/coach-teams/${teamId}/add-player`, { ...data, inviteOnly: true }),
  removePlayer: (teamId, data) => api.put(`/coach-teams/${teamId}/remove-player`, data),
  updateMember: (teamId, data) => api.put(`/coach-teams/${teamId}/update-member`, data),
  getAvailablePlayers: (teamId) => api.get(`/coach-teams/${teamId}/available-players`),
  inviteByEmail: (teamId, data) => api.post(`/coach-teams/${teamId}/invite-email`, data),
  getPlayerInvites: () => api.get('/coach-teams/player/invites'),
  getMyCoachTeams: () => api.get('/coach-teams/player/my'),
  respondToInvite: (teamId, action) => api.put(`/coach-teams/${teamId}/respond`, { action }),
  leaveTeam: (teamId) => api.put(`/coach-teams/${teamId}/leave`),
};

export default coachTeamService;
