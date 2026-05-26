import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// Attach token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('id_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401/403, clear tokens and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      // Check if it's an auth error (not a permission error on a specific resource)
      const msg = err.response?.data?.error || err.response?.data?.message || '';
      if (msg === 'Unauthorized' || msg === 'Forbidden' || err.response?.status === 401) {
        localStorage.clear();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  signup: (data: { email: string; password: string; full_name: string }) =>
    api.post('/auth/signup', data),
  login: (data: Record<string, string>) =>
    api.post('/auth/login', data),
  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),
};

// ── Ads ───────────────────────────────────────────────────────────────────────
export const adsApi = {
  list: (params?: { advertiser?: string; limit?: number; lastKey?: string }) =>
    api.get('/ads', { params }),
  get: (id: string) => api.get(`/ads/${id}`),
  update: (id: string, data: { tags?: string[]; favorite?: boolean; notes?: string }) =>
    api.patch(`/ads/${id}`, data),
  delete: (id: string) => api.delete(`/ads/${id}`),
};

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiApi = {
  trigger: (ad_id: string, operations: string[] = ['full_analysis']) =>
    api.post(`/ai/analyze/${ad_id}`, { operations }),
  getResult: (ad_id: string) => api.get(`/ai/result/${ad_id}`),
  estimate: (operations: string[] = ['full_analysis']) =>
    api.post('/ai/estimate', { operations }),
  generate: (ad_id: string, operation: string, instruction?: string, count?: number) =>
    api.post('/ai/generate', { ad_id, operation, instruction, count }),
  transcribe: (ad_id: string, video_url?: string, audio_base64?: string) =>
    api.post('/ai/transcribe', { ad_id, video_url: video_url || undefined, audio_base64: audio_base64 || undefined, format: 'webm' }),
  studio: (tool: string, input: Record<string, string | number>) =>
    api.post('/ai/studio', { tool, input }),
};

// ── Billing ───────────────────────────────────────────────────────────────────
export const billingApi = {
  status: () => api.get('/billing/status'),
  createOrder: (data: { purchase_type: string; pack_id?: string; gateway?: string }) =>
    api.post('/billing/create-order', data),
};

export const profileApi = {
  updateBusiness: (business_profile: Record<string, string>) =>
    api.post('/auth/profile', { business_profile }),
  generatePersona: (answers: Record<string, string>) =>
    api.post('/auth/persona', { answers }),
  savePersona: (answers: Record<string, string>, persona: Record<string, unknown>) =>
    api.post('/auth/persona', { answers, persona, save_final: true }),
};

// ── Projects ──────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: () => api.get('/projects'),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (data: {
    project_name: string;
    business_name: string;
    business_niche: string;
    product_name: string;
    product_description?: string;
    key_features?: string;
    key_benefits?: string;
    usp?: string;
  }) => api.post('/projects', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  generate: (id: string, tool: string, input?: Record<string, string>) =>
    api.post(`/projects/${id}/generate`, { tool, input }),
  saveIntelligence: (id: string, tool: string, value: unknown) =>
    api.post(`/projects/${id}/intelligence`, { tool, value }),
};
