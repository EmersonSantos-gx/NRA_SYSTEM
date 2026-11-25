import axios from 'axios';

const api = axios.create({
    
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 8000
});

// Envia o token JWT automaticamente em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('regulasus_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Se o token expirar (401), limpa a sessão local
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('regulasus_token')) {
      localStorage.removeItem('regulasus_token');
      window.dispatchEvent(new Event('regulasus:logout'));
    }
    return Promise.reject(error);
  }
);

export default api;