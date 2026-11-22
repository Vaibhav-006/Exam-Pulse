import axios from 'axios';

// If VITE_API_URL is configured (e.g. on Vercel), use it. Strip any trailing / or /api to prevent /api/api
let rawUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.trim().replace(/\/$/, '') : '';
if (rawUrl.endsWith('/api')) {
  rawUrl = rawUrl.slice(0, -4);
}
const baseURL = rawUrl ? `${rawUrl}/api` : '/api';

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ep_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
