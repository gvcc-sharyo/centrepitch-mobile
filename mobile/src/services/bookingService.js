// src/services/bookingService.js
import api from './api';

export const bookingService = {
  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================
  
  /**
   * Get available slots for a court (public)
   * @param {string} courtId - Court ID
   * @param {Object} params - Query parameters (date)
   */
  getAvailableSlots: (courtId, params) => 
    api.get(`/bookings/available-slots/${courtId}`, { params }),

  // ==========================================
  // PLAYER ENDPOINTS
  // ==========================================
  
  /**
   * Create new booking (player)
   * @param {Object} data - Booking data
   */
  createBooking: (data) => api.post('/bookings', data),
  
  /**
   * Get my bookings (player)
   * @param {Object} params - Query parameters (status, upcoming)
   */
  getMyBookings: (params) => api.get('/bookings/my', { params }),
  
  /**
   * Cancel booking (player)
   * @param {string} id - Booking ID
   * @param {Object} data - { reason: string }
   */
  cancelBooking: (id, data) => api.put(`/bookings/${id}/cancel`, data),

  /**
   * Cancel a specific slot within multi-slot booking
   * @param {string} id - Booking ID
   * @param {Object} data - { startTime, endTime }
   */
  cancelSlot: (id, data) => api.put(`/bookings/${id}/cancel-slot`, data),
  
  /**
   * Update payment status (player)
   * @param {string} id - Booking ID
   * @param {Object} data - Payment details
   */
  updatePayment: (id, data) => api.put(`/bookings/${id}/payment`, data),
  
  /**
   * Add review (player)
   * @param {string} id - Booking ID
   * @param {Object} data - { rating: number, comment: string }
   */
  addReview: (id, data) => api.put(`/bookings/${id}/review`, data),

  // ==========================================
  // ACADEMY ADMIN ENDPOINTS
  // ==========================================
  
  /**
   * Get academy bookings (academy admin)
   * @param {Object} params - Query parameters (status, date, courtId)
   */
  getAcademyBookings: (params) => api.get('/bookings/academy/my', { params }),
  
  /**
   * Check-in booking (academy admin)
   * @param {string} id - Booking ID
   */
  checkIn: (id) => api.put(`/bookings/${id}/checkin`),
  
  /**
   * Check-out booking (academy admin)
   * @param {string} id - Booking ID
   */
  checkOut: (id) => api.put(`/bookings/${id}/checkout`),
  
  /**
   * Cancel booking by academy (academy admin)
   * @param {string} id - Booking ID
   * @param {Object} data - { reason: string }
   */
  cancelByAcademy: (id, data) => api.put(`/bookings/${id}/cancel-academy`, data),
  
  /**
   * Get booking statistics (academy admin)
   * @param {Object} params - Query parameters (startDate, endDate)
   */
  getBookingStats: (params) => api.get('/bookings/academy/stats', { params }),

  // ==========================================
  // SUPER ADMIN ENDPOINTS
  // ==========================================
  
  /**
   * Get all bookings (super admin)
   * @param {Object} params - Query parameters (status, page, limit)
   */
  getAllBookings: (params) => api.get('/bookings', { params }),

  // ==========================================
  // SHARED ENDPOINTS
  // ==========================================
  
  /**
   * Get booking by ID (authenticated)
   * @param {string} id - Booking ID
   */
  getBookingById: (id) => api.get(`/bookings/${id}`)
};

export default bookingService;