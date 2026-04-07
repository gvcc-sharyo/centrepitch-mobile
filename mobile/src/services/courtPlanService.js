// src/services/courtPlanService.js
import api from './api';

export const courtPlanService = {
  // ==========================================
  // ACADEMY ADMIN ENDPOINTS
  // ==========================================
  
  /**
   * Create new court subscription plan
   * @param {Object} data - Plan data
   */
  createPlan: (data) => api.post('/court-plans', data),
  
  /**
   * Get my court plans (academy admin)
   * @param {Object} params - Query params { status, isActive }
   */
  getMyPlans: (params) => api.get('/court-plans/my', { params }),
  
  /**
   * Get plan by ID
   * @param {string} id - Plan ID
   */
  getPlanById: (id) => api.get(`/court-plans/${id}`),
  
  /**
   * Update plan
   * @param {string} id - Plan ID
   * @param {Object} data - Updated plan data
   */
  updatePlan: (id, data) => api.put(`/court-plans/${id}`, data),
  
  /**
   * Delete plan
   * @param {string} id - Plan ID
   */
  deletePlan: (id) => api.delete(`/court-plans/${id}`),
  
  /**
   * Toggle plan status (DRAFT -> ACTIVE -> PAUSED)
   * @param {string} id - Plan ID
   */
  toggleStatus: (id) => api.put(`/court-plans/${id}/toggle-status`),
  
  /**
   * Duplicate a plan
   * @param {string} id - Plan ID to duplicate
   */
  duplicatePlan: (id) => api.post(`/court-plans/${id}/duplicate`),

  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================
  
  /**
   * Get active plans for an academy (public)
   * @param {string} academyId - Academy ID
   */
  getPublicAcademyPlans: (academyId) => api.get(`/court-plans/public/academy/${academyId}`),
  
  /**
   * Get public plan details
   * @param {string} id - Plan ID
   */
  getPublicPlanById: (id) => api.get(`/court-plans/public/${id}`)
};

export default courtPlanService;
