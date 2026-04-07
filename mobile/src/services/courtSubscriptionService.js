// src/services/courtSubscriptionService.js
import api from './api';

export const courtSubscriptionService = {
  /**
   * Get available subscription slots (only available, not booked)
   * @param {Object} params - { courtId, planId, startDate, endDate }
   */
  getAvailableSlots: (params) =>
    api.get('/court-subscriptions/available-slots', { params }),

  /**
   * Create court subscription
   * @param {Object} data - { planId, courtId, selectedSessions, paymentDetails? }
   */
  createSubscription: (data) => api.post('/court-subscriptions', data),

  /**
   * Get my court subscriptions
   */
  getMySubscriptions: () => api.get('/court-subscriptions/my'),

  /**
   * Get subscription by ID
   */
  getSubscriptionById: (id) => api.get(`/court-subscriptions/${id}`),
};

export default courtSubscriptionService;
