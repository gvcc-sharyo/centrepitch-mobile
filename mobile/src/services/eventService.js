import api from './api';

const eventService = {
  getEvents: async (params = {}) => {
    const response = await api.get('/events', { params });
    return response.data;
  },

  getEventById: async (id) => {
    const response = await api.get(`/events/${id}`);
    return response.data;
  },

  getUpcomingEvents: async (limit = 10) => {
    const response = await api.get('/events/upcoming', { params: { limit } });
    return response.data;
  },

  getFeaturedEvents: async () => {
    const response = await api.get('/events/featured');
    return response.data;
  },

  getLiveEvents: async () => {
    const response = await api.get('/events/live');
    return response.data;
  },

  /** Public: live match detail (score + MatchStat snapshot) */
  getLiveMatchDetail: async (eventId, matchId) => {
    const response = await api.get(`/events/live/match/${eventId}/${matchId}/detail`);
    return response.data;
  },

  getEventParticipantIds: async (eventId) => {
    const response = await api.get(`/events/${eventId}/participant-ids`);
    return response.data;
  },

  getPublishPricing: async (params = {}) => {
    const response = await api.get('/events/publish-pricing', { params });
    return response.data;
  },

  getEventsByOrganizer: async (organizerId, params = {}) => {
    const response = await api.get(`/events/organizer/${organizerId}`, { params });
    return response.data;
  },

  createEvent: async (eventData) => {
    const response = await api.post('/events', eventData);
    return response.data;
  },

  updateEvent: async (id, eventData) => {
    const response = await api.put(`/events/${id}`, eventData);
    return response.data;
  },

  deleteEvent: async (id) => {
    const response = await api.delete(`/events/${id}`);
    return response.data;
  },

  registerForEvent: async (eventId, payload) => {
    const response = await api.post(`/events/${eventId}/register`, payload ?? {});
    return response.data;
  },

  requestPairInvite: async (eventId, partnerId) => {
    const response = await api.post(`/events/${eventId}/pair-invites`, { partnerId });
    return response.data;
  },

  respondPairInvite: async (eventId, notificationId, action) => {
    const response = await api.put(`/events/${eventId}/pair-invites/${notificationId}/respond`, { action });
    return response.data;
  },

  withdrawFromEvent: async (eventId) => {
    const response = await api.put(`/events/${eventId}/withdraw`);
    return response.data;
  },

  getRegisteredPlayers: async (eventId) => {
    const response = await api.get(`/events/${eventId}/players`);
    return response.data;
  },

  updatePlayerStatus: async (eventId, playerId, status) => {
    const response = await api.put(`/events/${eventId}/players/${playerId}`, { status });
    return response.data;
  },

  addStaffToEvent: async (eventId, staffData) => {
    const response = await api.post(`/events/${eventId}/staff`, staffData);
    return response.data;
  },

  rescheduleEvent: async (eventId, data) => {
    const response = await api.put(`/events/${eventId}/reschedule`, data);
    return response.data;
  },

  submitTeamPaymentReference: async (eventId, payload) => {
    const response = await api.post(`/events/${eventId}/team-registrations/submit-payment-reference`, payload);
    return response.data;
  },

  confirmOfflineTeamPayment: async (eventId, teamId, payload = {}) => {
    const response = await api.post(
      `/events/${eventId}/team-registrations/${teamId}/confirm-offline-payment`,
      payload
    );
    return response.data;
  },
};

export default eventService;
