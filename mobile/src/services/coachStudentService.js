import api from './api';

const coachStudentService = {
  // Player
  requestTraining: (data) => api.post('/coach-students/request', data),
  getMyCoachRelations: () => api.get('/coach-students/player/my'),
  acceptCoachInvite: (id) => api.put(`/coach-students/${id}/accept-invite`),
  rejectCoachInvite: (id, data = {}) => api.put(`/coach-students/${id}/reject-invite`, data),
  leaveCoach: (id) => api.put(`/coach-students/${id}/leave`),

  // Coach
  getMyStudents: (params = {}) => api.get('/coach-students/my', { params }),
  approveStudent: (id) => api.put(`/coach-students/${id}/approve`),
  rejectStudent: (id, data = {}) => api.put(`/coach-students/${id}/reject`, data),
  invitePlayer: (data) => api.post('/coach-students/invite', data),
  removeStudent: (id) => api.put(`/coach-students/${id}/remove`),
  searchPlayers: (params = {}) => api.get('/coach-students/search-players', { params }),
  getMyCourts: () => api.get('/coach-students/my-courts'),

  // Academy admin
  academyAssign: (data) => api.post('/coach-students/academy/assign', data),
  getAcademyRelations: (params = {}) => api.get('/coach-students/academy', { params }),
};

export default coachStudentService;
