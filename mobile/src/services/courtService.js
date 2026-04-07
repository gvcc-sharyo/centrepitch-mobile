// src/services/courtService.js
import api from './api';

export const courtService = {
  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================
  
  /**
   * Get all approved courts (public)
   * @param {Object} params - Query parameters (sportType, courtType, city, academy, page, limit)
   */
  getPublicCourts: (params) => api.get('/courts/public', { params }),
  
  /**
   * Get single court details (public)
   * @param {string} id - Court ID
   */
  getPublicCourtById: (id) => api.get(`/courts/public/${id}`),

  // ==========================================
  // SUPER ADMIN ENDPOINTS
  // ==========================================
  
  /**
   * Get all courts (super admin)
   * @param {Object} params - Query parameters (status, page, limit)
   */
  getAllCourts: (params) => api.get('/courts', { params }),
  
  /**
   * Delete court (super admin or academy admin)
   * @param {string} id - Court ID
   */
  deleteCourt: (id) => api.delete(`/courts/${id}`),

  // ==========================================
  // ACADEMY ADMIN ENDPOINTS
  // ==========================================
  
  /**
   * Create new court (academy admin)
   * @param {Object} data - Court data
   */
  createCourt: (data) => api.post('/courts', data),

  /**
   * Bulk create courts with images (academy admin)
   * @param {FormData} data - FormData with courts JSON, sportType, images and imageMapping
   */
  bulkCreateCourts: (data) => api.post('/courts/bulk', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  
  /**
   * Get my courts (academy admin)
   */
  getMyCourts: () => api.get('/courts/my'),
  
  /**
   * Get courts by academy (academy admin or super admin)
   * @param {string} academyId - Academy ID
   */
  getCourtsByAcademy: (academyId) => api.get(`/courts/academy/${academyId}`),
  
  /**
   * Update court (academy admin)
   * @param {string} id - Court ID
   * @param {Object} data - Updated court data
   */
  updateCourt: (id, data) => api.put(`/courts/${id}`, data),

  /**
   * Publish draft court (academy admin, subscription validated)
   * @param {string} id - Court ID
   */
  submitForApproval: (id) => api.put(`/courts/${id}/submit`),
  
  /**
   * Set court to maintenance mode (academy admin)
   * @param {string} id - Court ID
   * @param {Object} data - { reason: string }
   */
  setMaintenance: (id, data) => api.put(`/courts/${id}/maintenance`, data),

  /**
   * Set court back to live (academy admin)
   * @param {string} id - Court ID
   */
  setLive: (id) => api.put(`/courts/${id}/go-live`),

  /**
   * Toggle court publish status (DRAFT ↔ APPROVED)
   * @param {string} id - Court ID
   */
  togglePublish: (id) => api.put(`/courts/${id}/toggle-publish`),

  /**
   * Upload KYC documents (academy admin)
   * @param {string} id - Court ID
   * @param {Object} data - KYC documents data
   */
  uploadKYC: (id, data) => api.post(`/courts/${id}/kyc`, data),

  // ==========================================
  // SHARED ENDPOINTS
  // ==========================================
  
  /**
   * Get court by ID (authenticated)
   * @param {string} id - Court ID
   */
  getCourtById: (id) => api.get(`/courts/${id}`),

  /**
   * Audit / change history for a court (ApprovalLog)
   * @param {string} id - Court ID
   */
  getCourtAuditHistory: (id) => api.get(`/courts/${id}/audit-history`),
};

export default courtService;