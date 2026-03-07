import axios from 'axios'

const api = axios.create({
  baseURL: '/api'
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

export const generateContent = ({ subject, style, templateType }) =>
  api.post('/grok/generate', { subject, style, templateType })

export const createAndSchedulePost = (data) =>
  api.post('/posts/generate', data)

export const listPosts = (page = 1, limit = 10) =>
  api.get('/posts', { params: { page, limit } })

export const approvePost = (id) =>
  api.put(`/posts/${id}/approve`)

export const publishNow = (id) =>
  api.post(`/posts/${id}/publish`)

export const getProfile = () =>
  api.get('/auth/profile')

export default api
