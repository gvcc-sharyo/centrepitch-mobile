// src/services/coachService.js
import api from './api';

export const coachService = {
  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================

  /** Get all approved coaches (public) */
  getPublicCoaches: (params) => api.get('/coaches/public', { params }),

  /** Get single coach details (public) */
  getPublicCoachById: (id) => api.get(`/coaches/public/${id}`),

  /** Get coach details for player view (includes player-specific stats) */
  getPublicCoachPlayerView: (id) => api.get(`/coaches/public/${id}/player-view`),

  /** Register new coach (public - supports FormData with files) */
  registerCoach: (data) => {
    const isFormData = data instanceof FormData;
    return api.post('/coaches/register', data, isFormData ? {
      headers: { 'Content-Type': 'multipart/form-data' }
    } : {});
  },

  // ==========================================
  // SUPER ADMIN ENDPOINTS
  // ==========================================

  /** Get all coaches (super admin, supports ?status= filter) */
  getAllCoaches: (params) => api.get('/coaches', { params }),

  /** Get pending coaches (super admin) */
  getPendingCoaches: (params) => api.get('/coaches/pending', { params }),

  /** Approve coach by super admin */
  approveCoach: (id, data = {}) => api.put(`/coaches/${id}/approve-admin`, data),

  /** Reject coach (super admin) */
  rejectCoach: (id, data) => api.put(`/coaches/${id}/reject`, data),

  /** Deactivate coach (super admin) */
  deactivateCoach: (id, data) => api.put(`/coaches/${id}/deactivate`, data),

  /** Reactivate coach (super admin) */
  reactivateCoach: (id) => api.put(`/coaches/${id}/reactivate`),

  /** Delete coach (super admin) */
  deleteCoach: (id) => api.delete(`/coaches/${id}`),

  // ==========================================
  // ACADEMY ADMIN ENDPOINTS
  // ==========================================

  /** Get coaches by academy (academy admin) — supports ?status, ?search, ?page, ?limit */
  getCoachesByAcademy: (academyId, params) => api.get(`/coaches/academy/${academyId}`, { params }),

  /** Approve coach by academy admin */
  approveCoachByAcademy: (id) => api.put(`/coaches/${id}/approve-academy`),

  /** Approve coach in academy (academy admin — for join requests / pending) */
  approveInAcademy: (id, data = {}) => api.put(`/coaches/${id}/approve-in-academy`, data),

  /** Reject coach in academy (academy admin — for join requests / pending) */
  rejectInAcademy: (id, data) => api.put(`/coaches/${id}/reject-in-academy`, data),

  /** Remove coach from academy (academy admin) */
  removeFromAcademy: (id) => api.put(`/coaches/${id}/remove-from-academy`),

  /** Reactivate coach in academy (academy admin) */
  reactivateInAcademy: (id) => api.put(`/coaches/${id}/reactivate-in-academy`),

  // ==========================================
  // COACH ENDPOINTS (self)
  // ==========================================

  /** Get my profile (coach) */
  getMyProfile: async () => {
    try {
      return await api.get('/coaches/my');
    } catch (error) {
      if (error?.response?.status !== 404) throw error;
      // Newly unlocked coach role can miss coach profile until role bootstrap runs once.
      try {
        await api.post('/auth/switch-role', { role: 'coach' });
      } catch {
        throw error;
      }
      return api.get('/coaches/my');
    }
  },

  /** Update coach profile */
  updateCoach: (id, data) => api.put(`/coaches/${id}`, data),

  /** Upload KYC documents */
  uploadKYC: (id, data) => {
    const isFormData = data instanceof FormData;
    return api.post(`/coaches/${id}/kyc`, data, isFormData ? {
      headers: { 'Content-Type': 'multipart/form-data' }
    } : {});
  },

  /** Get coach by ID (authenticated) */
  getCoachById: (id) => api.get(`/coaches/${id}`),

  // ==========================================
  // KYC VERIFICATION (super admin)
  // ==========================================

  /** Legacy alias: KYC verification is handled by approval endpoints */
  verifyKYC: (id, data = {}) => api.put(`/coaches/${id}/approve-admin`, data),

  /** Legacy alias: KYC verification is handled by approval endpoints */
  verifyKYCWithReview: (id, data = {}) => api.put(`/coaches/${id}/approve-admin`, data),
};

export default coachService;
