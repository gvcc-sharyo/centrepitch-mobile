import api from './api';

const sportService = {
  // Get all sports with pagination and filters
  getSports: async (params = {}) => {
    const response = await api.get('/sports', { params });
    return response.data;
  },

  // Get simplified sports list for dropdowns
  getSportsList: async (params = {}) => {
    const response = await api.get('/sports/list', { params });
    return response.data;
  },

  // Get single sport by ID or slug
  getSportById: async (identifier) => {
    const response = await api.get(`/sports/${identifier}`);
    return response.data;
  },

  // Create a new sport (Super Admin only - full details)
  createSport: async (sportData) => {
    const response = await api.post('/sports', sportData);
    return response.data;
  },

  // Update sport (Super Admin only)
  updateSport: async (id, sportData) => {
    const response = await api.put(`/sports/${id}`, sportData);
    return response.data;
  },

  // Delete sport (Super Admin only)
  deleteSport: async (id) => {
    const response = await api.delete(`/sports/${id}`);
    return response.data;
  },

  // Toggle sport active status (Super Admin only)
  toggleStatus: async (id) => {
    const response = await api.patch(`/sports/${id}/toggle-status`);
    return response.data;
  },

  // Toggle sport featured status (Super Admin only)
  toggleFeatured: async (id) => {
    const response = await api.patch(`/sports/${id}/toggle-featured`);
    return response.data;
  },

  // Get sports statistics (Super Admin only)
  getStats: async () => {
    const response = await api.get('/sports/admin/stats');
    return response.data;
  },

  // Organizer/User-owned full sport configuration
  createPublicSport: async (sportData) => {
    const response = await api.post('/sports/public', sportData);
    return response.data;
  },

  updateOwnPublicSport: async (id, sportData) => {
    const response = await api.put(`/sports/public/${id}`, sportData);
    return response.data;
  },

  deleteOwnPublicSport: async (id) => {
    const response = await api.delete(`/sports/public/${id}`);
    return response.data;
  },

  // ===== Coaching Sports (separate table for coach registration) =====

  // Get coaching sports list for coach registration dropdown
  getCoachingSportsList: async (params = {}) => {
    const response = await api.get('/coaching-sports/list', { params });
    return response.data;
  },

  // Create a coaching sport (Public - during coach registration)
  createPublicCoachingSport: async (name) => {
    const response = await api.post('/coaching-sports/public', { name });
    return response.data;
  },

  // Update own public coaching sport (user-owned)
  updateOwnPublicCoachingSport: async (id, name) => {
    const response = await api.put(`/coaching-sports/public/${id}`, { name });
    return response.data;
  },

  // Soft delete own public coaching sport (user-owned)
  deleteOwnPublicCoachingSport: async (id) => {
    const response = await api.delete(`/coaching-sports/public/${id}`);
    return response.data;
  },
};

export default sportService;