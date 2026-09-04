import axios from 'axios';

const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach JWT token if present in localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('razoragent_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
