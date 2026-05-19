/**
 * API client — all calls go through the background worker
 * to ensure token refresh happens in one place.
 */

const API_BASE = 'https://YOUR_API_GATEWAY_URL'; // replaced post-deploy

export const apiCall = async (path, options = {}) => {
  // Ask background worker for a valid token
  const { token } = await chrome.runtime.sendMessage({ type: 'GET_TOKEN' });

  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${response.status}`);
  }

  return response.json();
};

export const saveAd = (adData) =>
  apiCall('/ads/save', { method: 'POST', body: JSON.stringify(adData) });

export const getAds = () => apiCall('/ads');

export const triggerAnalysis = (ad_id) =>
  apiCall(`/ai/analyze/${ad_id}`, { method: 'POST' });
