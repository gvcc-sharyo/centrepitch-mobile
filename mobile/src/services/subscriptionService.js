import api from './api';

const subscriptionService = {
  getPlans: (params = {}) => api.get('/subscriptions/plans', { params }),
  getPlanBySlug: (slug) => api.get(`/subscriptions/plans/${slug}`),
  getRoles: () => api.get('/subscriptions/roles'),
  getAdminRoles: () => api.get('/subscriptions/roles/admin'),
  getAdminSlugs: (params = {}) => api.get('/subscriptions/slugs/admin', { params }),
  createAdminSlug: (payload) => api.post('/subscriptions/slugs/admin', payload),
  deactivateAdminSlug: (slug) => api.patch(`/subscriptions/slugs/admin/${encodeURIComponent(slug)}/deactivate`),
  getAdminPlans: (params = {}) => api.get('/subscriptions/plans/admin', { params }),
  getAdminSubscriptionUsers: (params = {}) => api.get('/subscriptions/history/admin/users/options', { params }),
  getAdminUserHistory: (userId, params = {}) =>
    api.get(`/subscriptions/history/admin/users/${encodeURIComponent(userId)}`, { params }),
  createPlan: (payload) => api.post('/subscriptions/plans', payload),
  updatePlan: (id, payload) => api.put(`/subscriptions/plans/${id}`, payload),
  togglePlanStatus: (id, isActive) => api.patch(`/subscriptions/plans/${id}/status`, { isActive }),
  seedPlans: () => api.post('/subscriptions/seed'),
  createPaymentIntent: (payload) => api.post('/subscriptions/payment-intent', payload),
  confirmPayment: (paymentId, payload) => api.post(`/subscriptions/payment-confirm/${paymentId}`, payload),
  activateSubscription: (payload) => api.post('/subscriptions/activate', payload),
};

export default subscriptionService;
