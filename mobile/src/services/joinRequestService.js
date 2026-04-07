import api from './api';

const joinRequestService = {
  create: (data) => api.post('/join-requests', data),
  getMyRequests: () => api.get('/join-requests/my'),
  getAcademyRequests: (params) => api.get('/join-requests/academy', { params }),
  approve: (id) => api.put(`/join-requests/${id}/approve`),
  reject: (id, data) => api.put(`/join-requests/${id}/reject`, data),
};

export default joinRequestService;
