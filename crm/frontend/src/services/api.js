import axios from 'axios';

// VITE_API_URL é definida em .env (ou .env.production, etc.) e injetada
// em build-time pelo Vite. O fallback garante funcionamento sem .env em dev.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Interceptor: injeta x-session-id em TODAS as requisições ──────────────────
api.interceptors.request.use((config) => {
  const sessionId = window.__ROUTFLEX_SESSION_ID__ || localStorage.getItem('routflex_active_session_id');
  if (sessionId) {
    config.headers['x-session-id'] = sessionId;
  }
  return config;
});

const unwrap = (response) => {
  const payload = response.data;
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data;
  return payload;
};

// ── Sessions ──────────────────────────────────────────────────────────────────
export const sessionsApi = {
  list: () => api.get('/sessions').then(unwrap),
  get: (id) => api.get(`/sessions/${id}`).then(unwrap),
  create: (data) => api.post('/sessions', data).then(unwrap),
  update: (id, data) => api.put(`/sessions/${id}`, data).then(unwrap),
  remove: (id) => api.delete(`/sessions/${id}`).then(unwrap),
  stats: (id) => api.get(`/sessions/${id}/stats`).then(unwrap),
};

// ── Customers ─────────────────────────────────────────────────────────────────
export const customersApi = {
  list: (params = {}) => api.get('/customers', { params }).then(unwrap),
  get: (id) => api.get(`/customers/${id}`).then(unwrap),
  create: (data) => api.post('/customers', data).then(unwrap),
  update: (id, data) => api.put(`/customers/${id}`, data).then(unwrap),
  remove: (id) => api.delete(`/customers/${id}`).then(unwrap),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: () => api.get('/stats').then(unwrap),
  dddDistribution: () => api.get('/distribution/ddd').then(unwrap),
  statusDistribution: () => api.get('/distribution/status').then(unwrap),
  loadScenario: () => api.post('/scenario/load').then(unwrap),
  insights: () => api.get('/insights').then(unwrap),
};

// ── Roteirização ──────────────────────────────────────────────────────────────
export const roteirizacaoApi = {
  sendClients: (clientIds) => api.post('/roteirizacao/clientes', { client_ids: clientIds }).then(r => r.data),
  status: () => api.get('/roteirizacao/status').then(r => r.data),
};

// ── Helper: define sessão ativa (chamado pelo SessionContext) ─────────────────
export function setActiveSessionId(sessionId) {
  if (sessionId) {
    window.__ROUTFLEX_SESSION_ID__ = sessionId;
    localStorage.setItem('routflex_active_session_id', sessionId);
  } else {
    delete window.__ROUTFLEX_SESSION_ID__;
    localStorage.removeItem('routflex_active_session_id');
  }
}

export function getStoredSessionId() {
  return localStorage.getItem('routflex_active_session_id') || null;
}

export default api;
