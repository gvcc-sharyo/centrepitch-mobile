import api from './api';

const authService = {
  login: async (credentials) => {
    const { adminOnly, ...payload } = credentials || {};
    const endpoint = adminOnly ? '/auth/admin-login' : '/auth/login';
    const response = await api.post(endpoint, payload);
    return response.data;
  },

  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  googleAuth: async (googleData) => {
    const response = await api.post('/auth/google', {
      ...googleData,
      client: 'mobile',
    });
    return response.data;
  },

  requestMobileEmailOtp: async (email) => {
    const response = await api.post('/auth/mobile/request-email-otp', { email });
    return response.data;
  },

  verifyMobileEmailOtp: async ({ email, otp }) => {
    const response = await api.post('/auth/mobile/verify-email-otp', { email, otp });
    return response.data;
  },

  completeMobileOnboarding: async (body) => {
    const response = await api.post('/auth/mobile/complete-onboarding', body);
    return response.data;
  },

  forgotPassword: async (email) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token, password) => {
    const response = await api.post(`/auth/reset-password/${token}`, { password });
    return response.data;
  },

  sendOTP: async (email) => {
    const response = await api.post('/auth/send-otp', { email });
    return response.data;
  },

  verifyOTP: async (email, otp) => {
    const response = await api.post('/auth/verify-otp', { email, otp });
    return response.data;
  },

  sendPhoneOTP: async ({ email, phone }) => {
    const response = await api.post('/auth/send-phone-otp', { email, phone });
    return response.data;
  },

  verifyPhoneOTP: async ({ email, phone, otp }) => {
    const response = await api.post('/auth/verify-phone-otp', { email, phone, otp });
    return response.data;
  },

  checkContactAvailability: async ({ email, phone }) => {
    const response = await api.post('/auth/check-contact', { email, phone });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  getRoles: async () => {
    const response = await api.get('/auth/roles');
    return response.data;
  },
  switchRole: async (payload) => {
    const response = await api.post('/auth/switch-role', payload);
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  updatePassword: async (passwordData) => {
    const response = await api.put('/auth/update-password', passwordData);
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await api.put('/users/profile', profileData);
    return response.data;
  }
};

export default authService;
