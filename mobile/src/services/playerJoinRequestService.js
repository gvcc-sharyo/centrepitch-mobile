import api from './api';

const playerJoinRequestService = {
  createJoinRequest: (data) => api.post('/player-join-requests', data),
  getMyRequests: () => api.get('/player-join-requests/my'),
  getAcademyRequests: (params = {}) => api.get('/player-join-requests/academy', { params }),
  approve: (id) => api.put(`/player-join-requests/${id}/approve`),
  reject: (id, data = {}) => api.put(`/player-join-requests/${id}/reject`, data),
  removePlayer: (data) => api.put('/player-join-requests/remove', data),
  leaveAcademy: (data) => api.put('/player-join-requests/leave', data),
};

export default playerJoinRequestService;
