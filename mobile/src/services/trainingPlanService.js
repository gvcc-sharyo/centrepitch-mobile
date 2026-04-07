import api from "./api";

const trainingPlanService = {
  createPlan: (data) => api.post("/training-plans", data),
  getMyPlans: (params = {}) => api.get("/training-plans/my", { params }),
  updatePlan: (id, data) => api.put(`/training-plans/${id}`, data),
  generateOccurrences: (id, data) => api.post(`/training-plans/${id}/generate-occurrences`, data),
};

export default trainingPlanService;
