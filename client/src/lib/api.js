import axios from 'axios';

// If VITE_API_URL is configured (e.g. on Vercel), use it. Otherwise fallback to relative /api for local dev proxy
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ep_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
