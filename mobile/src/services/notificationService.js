import api from './api';

const notificationService = {
  getNotifications: async (params = {}) => {
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (id) => {
    const response = await api.put(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.put('/notifications/read-all');
    return response.data;
  },

  deleteNotification: async (id) => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },

  deleteAllNotifications: async () => {
    const response = await api.delete('/notifications');
    return response.data;
  },

  createNotification: async (notificationData) => {
    const response = await api.post('/notifications', notificationData);
    return response.data;
  },

  sendBulkNotifications: async (data) => {
    const response = await api.post('/notifications/bulk', data);
    return response.data;
  }
};

export default notificationService;
