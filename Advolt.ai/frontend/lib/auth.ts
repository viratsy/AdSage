export const setTokens = (tokens: {
  access_token: string;
  id_token: string;
  refresh_token: string;
}) => {
  localStorage.setItem('access_token', tokens.access_token);
  localStorage.setItem('id_token', tokens.id_token);
  localStorage.setItem('refresh_token', tokens.refresh_token);
};

export const clearTokens = () => localStorage.clear();

export const getIdToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('id_token') : null;

export const isAuthenticated = () => {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('id_token');
  if (!token) return false;

  // Check JWT expiry
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.exp && Date.now() > payload.exp * 1000) {
        // Token expired — clear and return false
        localStorage.clear();
        return false;
      }
    }
  } catch { /* ignore decode errors */ }

  return true;
};
