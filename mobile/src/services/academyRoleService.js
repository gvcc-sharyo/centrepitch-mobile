import api from './api';

const academyRoleService = {
  getRoles: async () => {
    const response = await api.get('/academy-roles');
    return response.data;
  },

  createRole: async (roleData) => {
    const response = await api.post('/academy-roles', roleData);
    return response.data;
  },

  updateRole: async (id, roleData) => {
    const response = await api.put(`/academy-roles/${id}`, roleData);
    return response.data;
  },

  deleteRole: async (id) => {
    const response = await api.delete(`/academy-roles/${id}`);
    return response.data;
  },
};

export default academyRoleService;
