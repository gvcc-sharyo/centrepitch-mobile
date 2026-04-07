import api from './api';

const paymentService = {
  createRegistrationIntent: async (eventId, teamId = null, paymentMethod = 'upi') => {
    const response = await api.post('/payments/create-registration-intent', {
      eventId,
      teamId,
      paymentMethod
    });
    return response.data;
  },

  confirmPayment: async (paymentId) => {
    const response = await api.post(`/payments/${paymentId}/confirm`);
    return response.data;
  },

  getMyPayments: async (params = {}) => {
    const response = await api.get('/payments/my', { params });
    return response.data;
  }
};

export default paymentService;
