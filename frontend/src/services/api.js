import axios from 'axios';

/**
 * Normaliza a URL base removendo barras finais para evitar rotas duplicadas como //auth/login.
 */
function normalizarBaseUrl(url) {
  if (!url || typeof url !== 'string') return '/api';
  const limpa = url.trim().replace(/\/+$/, '');
  return limpa || '/api';
}

/**
 * Detecta se a aplicação está rodando em ambiente local.
 */
function detectarLocalhost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

const isLocalhost = detectarLocalhost();

const urlConfigurada =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : '/api';

export const API_BASE_URL = isLocalhost
  ? 'http://localhost:3001/api'
  : normalizarBaseUrl(urlConfigurada);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000
});

// Anexa o token JWT em todas as requisições autenticadas
api.interceptors.request.use(
  (config) => {
    try {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('regulasus_token');
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch {
      // Ignora bloqueio de storage do navegador
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Padroniza mensagens de falha de rede e trata token inválido/expirado (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      const destino = `${API_BASE_URL}${error.config?.url || ''}`;
      error.mensagemAmigavel = isLocalhost
        ? `Não foi possível conectar ao servidor local (${destino}). Confirme se o back-end está rodando na porta 3001.`
        : `Falha de conexão com o servidor (${destino}). Verifique a API e as variáveis DATABASE_URL / JWT_SECRET na Vercel.`;
    } else if (error.response.status === 401) {
      try {
        if (typeof window !== 'undefined' && localStorage.getItem('regulasus_token')) {
          localStorage.removeItem('regulasus_token');
          window.dispatchEvent(new Event('regulasus:logout'));
        }
      } catch {
        // Ignora bloqueio de storage do navegador
      }
    }

    return Promise.reject(error);
  }
);

export default api;