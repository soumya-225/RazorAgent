import axios from 'axios';

const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach the right JWT token:
// - If a merchant token exists and the request is NOT a customer-auth-only call, use merchant token
// - If a customer token exists and no merchant token, use customer token
// This prevents customer tokens from being sent to merchant-protected endpoints and vice-versa.
api.interceptors.request.use((config) => {
  const merchantToken = localStorage.getItem('razoragent_token');
  const customerToken = localStorage.getItem('razoragent_customer_token');

  if (merchantToken) {
    config.headers.Authorization = `Bearer ${merchantToken}`;
  } else if (customerToken) {
    config.headers.Authorization = `Bearer ${customerToken}`;
  }
  return config;
});

export default api;
