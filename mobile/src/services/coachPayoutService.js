import api from "./api";

const coachPayoutService = {
  // Academy admin
  getAcademyPayouts: (params = {}) => api.get("/coach-payouts/academy", { params }),
  getAcademyMonthlySheet: (params = {}) => api.get("/coach-payouts/academy/monthly-sheet", { params }),
  payAcademyMonthlySheet: (data = {}) => api.put("/coach-payouts/academy/monthly-sheet/pay", data),
  approvePayout: (id, data = {}) => api.put(`/coach-payouts/${id}/approve`, data),
  payPayout: (id, data = {}) => api.put(`/coach-payouts/${id}/pay`, data),

  // Coach
  getMyPayouts: (params = {}) => api.get("/coach-payouts/coach/my", { params }),
};

export default coachPayoutService;
