import api from './api';

export const academyService = {
  // Register academy (let browser set Content-Type with boundary for FormData)
  registerAcademy: (formData) => api.post('/academies/register', formData, {
    headers: { 'Content-Type': undefined }
  }),

  // Get public academies (supports ?status= filter)
  getPublicAcademies: (params) => api.get('/academies/public', { params }),

  // Get single academy by ID (any status — use for admin / authenticated flows)
  getAcademyById: (id) => api.get(`/academies/${id}`),
  // Public profile only (same visibility as GET /academies/public)
  getPublicAcademyById: (id) => api.get(`/academies/public/${id}`),

  // Get approved academies
  getApprovedAcademies: (params) => api.get('/academies/public', { params: { ...params, status: 'APPROVED' } }),

  // Get pending academies (super admin)
  getPendingAcademies: (params) => api.get('/academies/pending', { params }),

  // Get all academies (super admin; includes approved/pending/rejected/suspended)
  getAllAcademiesAdmin: (params) => api.get('/academies/admin/all', { params }),

  // Approve academy (super admin)
  approveAcademy: (id, data = {}) => api.put(`/academies/${id}/approve`, data),

  // Reject academy (super admin)
  rejectAcademy: (id, data) => api.put(`/academies/${id}/reject`, data),

  // Deactivate academy (super admin)
  deactivateAcademy: (id, data) => api.put(`/academies/${id}/deactivate`, data),

  // Reactivate academy (super admin)
  reactivateAcademy: (id) => api.put(`/academies/${id}/reactivate`),

  // Legacy alias: KYC verification is handled by approve endpoint
  verifyKYC: (id, data = {}) => api.put(`/academies/${id}/approve`, data),

  // Legacy alias: KYC verification is handled by approve endpoint
  verifyKYCWithReview: (id, data = {}) => api.put(`/academies/${id}/approve`, data),

  // Delete academy
  deleteAcademy: (id) => api.delete(`/academies/${id}`),

  // Get my academy
  getMyAcademy: () => api.get('/academies/my'),

  // Update academy
  updateAcademy: (id, data) => api.put(`/academies/${id}`, data),

  // Upload logo (let browser set Content-Type with boundary for FormData)
  uploadLogo: (id, formData) => api.put(`/academies/${id}/logo`, formData, {
    headers: { 'Content-Type': undefined }
  }),

  // Get my academy's sports (for court creation form)
  getMyAcademySports: () => api.get('/academies/my/sports'),

  // Update my academy's sports
  updateMyAcademySports: (sportsOffered) => api.put('/academies/my/sports', { sportsOffered }),

  // Academy hub contact verification
  sendAcademyEmailOtp: () => api.post('/academies/my/send-email-otp'),
  verifyAcademyEmailOtp: (otp) => api.post('/academies/my/verify-email-otp', { otp }),
  sendAcademyPhoneOtp: () => api.post('/academies/my/send-phone-otp'),
  verifyAcademyPhoneOtp: (otp) => api.post('/academies/my/verify-phone-otp', { otp }),

  // Academy KYC submission from academy hub
  submitAcademyKyc: (academyId, formData) => api.post(`/kyc/academy/${academyId}/submit`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

};

export default academyService;
