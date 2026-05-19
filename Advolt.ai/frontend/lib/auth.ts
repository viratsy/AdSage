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

export const isAuthenticated = () => !!getIdToken();
