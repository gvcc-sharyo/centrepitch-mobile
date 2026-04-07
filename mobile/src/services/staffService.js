import api from './api';

const staffService = {
  createStaff: async (staffData) => {
    const response = await api.post('/staff', staffData);
    return response.data;
  },

  getStaffMembers: async (params = {}) => {
    const response = await api.get('/staff', { params });
    return response.data;
  },

  getStaffById: async (id) => {
    const response = await api.get(`/staff/${id}`);
    return response.data;
  },

  updateStaff: async (id, staffData) => {
    const response = await api.put(`/staff/${id}`, staffData);
    return response.data;
  },

  deleteStaff: async (id) => {
    const response = await api.delete(`/staff/${id}`);
    return response.data;
  },

  assignToEvent: async (staffId, eventId, role) => {
    const response = await api.post(`/staff/${staffId}/assign`, { eventId, role });
    return response.data;
  },

  removeFromEvent: async (staffId, eventId) => {
    const response = await api.delete(`/staff/${staffId}/events/${eventId}`);
    return response.data;
  },

  getAvailableStaff: async (eventId) => {
    const response = await api.get(`/staff/available/${eventId}`);
    return response.data;
  }
};

export default staffService;
