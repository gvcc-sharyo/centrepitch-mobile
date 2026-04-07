import api from './api';

const adminService = {
  getDashboard: async (params = {}) => {
    const response = await api.get('/admin/dashboard', { params });
    return response.data;
  },

  getOrganizers: async (params = {}) => {
    const response = await api.get('/admin/organizers', { params });
    return response.data;
  },

  addOrganizer: async (organizerData) => {
    const response = await api.post('/admin/organizers', organizerData);
    return response.data;
  },

  updateOrganizerStatus: async (id, isActive) => {
    const response = await api.put(`/admin/organizers/${id}/status`, { isActive });
    return response.data;
  },

  deleteOrganizer: async (id) => {
    const response = await api.delete(`/admin/organizers/${id}`);
    return response.data;
  },

  getPlayers: async (params = {}) => {
    const response = await api.get('/admin/players', { params });
    return response.data;
  },

  getRegistrations: async (params = {}) => {
    const response = await api.get('/admin/registrations', { params });
    return response.data;
  },

  updatePlayerStatus: async (id, isActive) => {
    const response = await api.put(`/admin/players/${id}/status`, { isActive });
    return response.data;
  },

  getAllEvents: async (params = {}) => {
    const response = await api.get('/admin/events', { params });
    return response.data;
  },

  getRevenueAnalysis: async (params = {}) => {
    const response = await api.get('/admin/revenue', { params });
    return response.data;
  },

  getEventPublishPricing: async () => {
    const response = await api.get('/admin/event-publish-pricing');
    return response.data;
  },

  updateEventPublishPricing: async (payload) => {
    const response = await api.put('/admin/event-publish-pricing', payload);
    return response.data;
  },

  upsertSportEventPublishPricing: async (sportId, payload) => {
    const response = await api.put(`/admin/event-publish-pricing/sports/${sportId}`, payload);
    return response.data;
  },

  sendAnnouncement: async (announcementData) => {
    const response = await api.post('/admin/announcement', announcementData);
    return response.data;
  },

  getAdminNotifications: async (params = {}) => {
    const response = await api.get('/admin/notifications', { params });
    return response.data;
  },

  getQueries: async (params = {}) => {
    const response = await api.get('/admin/queries', { params });
    return response.data;
  },

  getQuery: async (id) => {
    const response = await api.get(`/admin/queries/${id}`);
    return response.data;
  },

  updateQueryStatus: async (id, status) => {
    const response = await api.put(`/admin/queries/${id}/status`, { status });
    return response.data;
  },

  respondToQuery: async (id, message, attachments = []) => {
    const response = await api.post(`/admin/queries/${id}/respond`, { message, attachments });
    return response.data;
  }
};

export default adminService;
