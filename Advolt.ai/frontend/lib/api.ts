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

// On 401, clear tokens and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  signup: (data: { email: string; password: string; full_name: string }) =>
    api.post('/auth/signup', data),
  login: (data: { email: string; password: string }) =>
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
};

// ── Billing ───────────────────────────────────────────────────────────────────
export const billingApi = {
  status: () => api.get('/billing/status'),
  createOrder: (data: { purchase_type: string; pack_id?: string }) =>
    api.post('/billing/create-order', data),
};

export const profileApi = {
  updateBusiness: (business_profile: Record<string, string>) =>
    api.post('/auth/profile', { business_profile }),
};
