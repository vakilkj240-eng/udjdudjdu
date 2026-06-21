import axios from 'axios'

const api = axios.create({
  baseURL: '/admin/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

export const adminApi = {
  login: (email: string, password: string) =>
    api.post('/login', { email, password }),

  getDashboard: () => api.get('/dashboard'),

  getDocuments: (params?: Record<string, unknown>) => api.get('/documents', { params }),
  getDocument: (id: string) => api.get(`/documents/${id}`),
  uploadDocument: (formData: FormData) =>
    api.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateDocument: (id: string, data: Record<string, unknown>) => api.put(`/documents/${id}`, data),
  deleteDocument: (id: string) => api.delete(`/documents/${id}`),
  importDocumentsCsv: (formData: FormData) =>
    api.post('/documents/import-csv', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  getChunks: (params?: Record<string, unknown>) => api.get('/chunks', { params }),
  getChunk: (id: string) => api.get(`/chunks/${id}`),
  updateChunk: (id: string, data: Record<string, unknown>) => api.put(`/chunks/${id}`, data),
  deleteChunk: (id: string) => api.delete(`/chunks/${id}`),
  searchChunks: (query: string) => api.get('/chunks/search', { params: { q: query } }),

  getSources: (params?: Record<string, unknown>) => api.get('/sources', { params }),
  createSource: (data: Record<string, unknown>) => api.post('/sources', data),
  updateSource: (id: string, data: Record<string, unknown>) => api.put(`/sources/${id}`, data),
  deleteSource: (id: string) => api.delete(`/sources/${id}`),
  importSourcesCsv: (formData: FormData) =>
    api.post('/sources/import-csv', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  getCases: (params?: Record<string, unknown>) => api.get('/cases', { params }),
  getCase: (id: string) => api.get(`/cases/${id}`),
  createCase: (data: Record<string, unknown>) => api.post('/cases', data),
  updateCase: (id: string, data: Record<string, unknown>) => api.put(`/cases/${id}`, data),
  deleteCase: (id: string) => api.delete(`/cases/${id}`),
  importCasesCsv: (formData: FormData) =>
    api.post('/cases/import-csv', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  getActs: (params?: Record<string, unknown>) => api.get('/acts', { params }),
  getAct: (id: string) => api.get(`/acts/${id}`),
  createAct: (data: Record<string, unknown>) => api.post('/acts', data),
  updateAct: (id: string, data: Record<string, unknown>) => api.put(`/acts/${id}`, data),
  deleteAct: (id: string) => api.delete(`/acts/${id}`),
  importActsCsv: (formData: FormData) =>
    api.post('/acts/import-csv', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  getUsers: (params?: Record<string, unknown>) => api.get('/users', { params }),
  updateUser: (id: string, data: Record<string, unknown>) => api.put(`/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/users/${id}`),

  getSettings: () => api.get('/settings'),
  updateSettings: (data: Record<string, unknown>) => api.put('/settings', data),
  runMigration: () => api.post('/settings/migrate'),
}
