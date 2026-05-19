import { getTokens, setTokens, clearTokens, isTokenExpired } from '../lib/storage.js';
import { loginRequest, refreshRequest } from '../lib/auth.js';

const SELECTOR_CONFIG_URL = 'https://YOUR_CLOUDFRONT_URL/config/selectors.json';
let selectorConfig = null;

// ─── Fetch remote selector config on startup ───────────────────────────────
const loadSelectorConfig = async () => {
  try {
    const res = await fetch(SELECTOR_CONFIG_URL);
    if (res.ok) {
      selectorConfig = await res.json();
      await chrome.storage.local.set({ selectorConfig, selectorConfigFetchedAt: Date.now() });
      console.log('[Advolt.ai] Selector config loaded');
    }
  } catch (err) {
    // Fall back to cached config
    const cached = await chrome.storage.local.get('selectorConfig');
    if (cached.selectorConfig) {
      selectorConfig = cached.selectorConfig;
      console.log('[Advolt.ai] Using cached selector config');
    }
  }
};

loadSelectorConfig();

// ─── Token management ───────────────────────────────────────────────────────
const getValidToken = async () => {
  const { access_token, id_token, refresh_token, token_expiry } = await getTokens();

  if (!refresh_token) return null;

  if (isTokenExpired(token_expiry)) {
    try {
      const refreshed = await refreshRequest(refresh_token);
      await setTokens({ ...refreshed, refresh_token });
      return refreshed.id_token;
    } catch {
      await clearTokens();
      return null;
    }
  }

  return id_token;
};

// ─── Message handler ────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handle = async () => {
    switch (message.type) {

      case 'GET_TOKEN': {
        const token = await getValidToken();
        return { token };
      }

      case 'LOGIN': {
        const { email, password } = message.payload;
        const tokens = await loginRequest(email, password);
        await setTokens(tokens);
        return { success: true };
      }

      case 'LOGOUT': {
        await clearTokens();
        return { success: true };
      }

      case 'GET_AUTH_STATE': {
        const token = await getValidToken();
        return { isAuthenticated: !!token };
      }

      case 'GET_SELECTOR_CONFIG': {
        return { config: selectorConfig };
      }

      case 'SAVE_AD': {
        const token = await getValidToken();
        if (!token) return { success: false, error: 'Not authenticated' };

        const API_BASE = 'https://YOUR_API_GATEWAY_URL';
        const response = await fetch(`${API_BASE}/ads/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(message.payload),
        });

        if (response.status === 402) {
          return { success: false, error: 'limit_reached' };
        }

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          return { success: false, error: err.error || 'Save failed' };
        }

        const data = await response.json();
        return { success: true, ad_id: data.ad_id };
      }

      case 'GET_RECENT_ADS': {
        const token = await getValidToken();
        if (!token) return { ads: [] };

        const API_BASE = 'https://YOUR_API_GATEWAY_URL';
        const response = await fetch(`${API_BASE}/ads?limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) return { ads: [] };
        const data = await response.json();
        return { ads: data.ads || [] };
      }

      default:
        return { error: 'Unknown message type' };
    }
  };

  handle().then(sendResponse).catch((err) => {
    console.error('[Advolt.ai worker error]', err);
    sendResponse({ error: err.message });
  });

  return true; // keep channel open for async response
});
