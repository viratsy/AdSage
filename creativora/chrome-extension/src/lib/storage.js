/**
 * Wrapper around chrome.storage.local
 * All auth tokens are stored device-local (not synced).
 */

export const storage = {
  get: (keys) => chrome.storage.local.get(keys),
  set: (items) => chrome.storage.local.set(items),
  remove: (keys) => chrome.storage.local.remove(keys),
  clear: () => chrome.storage.local.clear(),
};

export const getTokens = async () => {
  const data = await storage.get(['access_token', 'id_token', 'refresh_token', 'token_expiry']);
  return data;
};

export const setTokens = async ({ access_token, id_token, refresh_token, expires_in }) => {
  const token_expiry = Date.now() + expires_in * 1000;
  await storage.set({ access_token, id_token, refresh_token, token_expiry });
};

export const clearTokens = async () => {
  await storage.remove(['access_token', 'id_token', 'refresh_token', 'token_expiry']);
};

export const isTokenExpired = (token_expiry) => {
  // Refresh 2 minutes before actual expiry
  return !token_expiry || Date.now() > token_expiry - 120_000;
};
