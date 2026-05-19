/**
 * Auth helpers used by the background worker.
 */

const API_BASE = 'https://YOUR_API_GATEWAY_URL'; // replaced post-deploy

export const loginRequest = async (email, password) => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Login failed');
  }

  return response.json(); // { access_token, id_token, refresh_token, expires_in }
};

export const refreshRequest = async (refresh_token) => {
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  });

  if (!response.ok) throw new Error('Token refresh failed');

  return response.json(); // { access_token, id_token, expires_in }
};
