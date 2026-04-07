import api from './api';

const teamService = {
  getTeams: async (params = {}) => {
    const response = await api.get('/teams', { params });
    return response.data;
  },

  getTeamById: async (id) => {
    const response = await api.get(`/teams/${id}`);
    return response.data;
  },

  getTeamsByUser: async (userId) => {
    const response = await api.get(`/teams/user/${userId}`);
    return response.data;
  },

  getCoachTeamsByUser: async (userId) => {
    const response = await api.get(`/teams/user/${userId}/coach-teams`);
    return response.data;
  },

  getMyTeams: async () => {
    const response = await api.get('/teams/my');
    return response.data;
  },

  getAvailablePlayers: async (params = {}) => {
    const response = await api.get('/teams/available-players', { params });
    return response.data;
  },

  registerExistingTeamForEvent: async ({ eventId, teamId }) => {
    const response = await api.post('/teams/register-existing-for-event', { eventId, teamId });
    return response.data;
  },

  checkoutRegisterTeamForEvent: async ({ eventId, teamId }) => {
    const response = await api.post('/teams/checkout-register-for-event', { eventId, teamId });
    return response.data;
  },

  createTeam: async (teamData) => {
    const response = await api.post('/teams', teamData);
    return response.data;
  },

  updateTeam: async (id, teamData) => {
    const response = await api.put(`/teams/${id}`, teamData);
    return response.data;
  },

  deleteTeam: async (id) => {
    const response = await api.delete(`/teams/${id}`);
    return response.data;
  },

  addMember: async (teamId, memberData) => {
    const response = await api.post(`/teams/${teamId}/members`, memberData);
    return response.data;
  },

  removeMember: async (teamId, memberId) => {
    const response = await api.delete(`/teams/${teamId}/members/${memberId}`);
    return response.data;
  },

  updateMemberRole: async (teamId, memberId, roleData) => {
    const response = await api.put(`/teams/${teamId}/members/${memberId}`, roleData);
    return response.data;
  },

  addAchievement: async (teamId, achievementData) => {
    const response = await api.post(`/teams/${teamId}/achievements`, achievementData);
    return response.data;
  },

  invitePlayer: async (teamId, email) => {
    const response = await api.post(`/teams/${teamId}/invite`, { email });
    return response.data;
    },

  getPlayerInvites: async () => {
    const response = await api.get('/teams/player/invites');
    return response.data;
  },

  respondToPlayerInvite: async (teamId, action) => {
    const response = await api.put(`/teams/${teamId}/respond-invite`, { action });
    return response.data;
  },

  leaveTeam: async (teamId) => {
    const response = await api.put(`/teams/${teamId}/leave`);
    return response.data;
  },

  // Event Registration
  registerTeamForEvent: async (data) => {
    const response = await api.post('/teams/register-for-event', data);
    return response.data;
  },

  updateTeamRegistration: async (teamId, data) => {
    const response = await api.put(`/teams/${teamId}/event-registration`, data);
    return response.data;
  },

  getMyEventTeams: async () => {
    const response = await api.get('/teams/my-event-teams');
    return response.data;
  },

  getEventRequirements: async (eventId) => {
    const response = await api.get(`/teams/event-requirements/${eventId}`);
    return response.data;
  },

  // Academy Team Management
  getMyAcademyTeams: async () => {
    const response = await api.get('/teams/academy/my');
    return response.data;
  },

  createAcademyTeam: async (teamData) => {
    const response = await api.post('/teams/academy', teamData);
    return response.data;
  },

  updateAcademyTeam: async (id, teamData) => {
    const response = await api.put(`/teams/academy/${id}`, teamData);
    return response.data;
  },

  inviteAcademyPlayerByEmail: async (teamId, data) => {
    const response = await api.post(`/teams/academy/${teamId}/invite-email`, data);
    return response.data;
  },

  deleteAcademyTeam: async (id) => {
    const response = await api.delete(`/teams/academy/${id}`);
    return response.data;
  }
};

export default teamService;
