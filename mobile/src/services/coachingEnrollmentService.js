import api from "./api";

const coachingEnrollmentService = {
  createEnrollment: (data) => api.post("/coaching-enrollments", data),
  getMyEnrollments: (params = {}) => api.get("/coaching-enrollments/my", { params }),
  updatePayment: (id, data) => api.put(`/coaching-enrollments/${id}/payment`, data),
  markTeamSessionPaymentByAcademy: (sessionId, data = {}) =>
    api.put(`/coaching-enrollments/academy/session/${sessionId}/team-payment`, data),
  approveRequest: (id) => api.put(`/coaching-enrollments/${id}/approve`),
  rejectRequest: (id, data = {}) => api.put(`/coaching-enrollments/${id}/reject`, data),
};

export default coachingEnrollmentService;
