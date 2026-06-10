import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: false,
})

api.interceptors.request.use((config) => {
  const raw = localStorage.getItem('aos_tokens')
  if (raw) {
    try {
      const tokens = JSON.parse(raw) as { accessToken?: string }
      if (tokens.accessToken) {
        config.headers.Authorization = `Bearer ${tokens.accessToken}`
      }
    } catch {
      // ignore malformed storage
    }
  }
  return config
})
