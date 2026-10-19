import axios from 'axios'

const rawBaseUrl = import.meta.env.VITE_API_URL
  ? (import.meta.env.VITE_API_URL.endsWith('/') ? import.meta.env.VITE_API_URL.slice(0, -1) : import.meta.env.VITE_API_URL) + '/api'
  : '/api'

const api = axios.create({ baseURL: rawBaseUrl })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.clear()
    window.location.href = '/login'
  }
  return Promise.reject(err)
})

export default api
