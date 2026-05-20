/**
 * Advolt.ai Background Service Worker
 * Self-contained — no ES module imports (MV3 compatibility)
 */

const API_BASE = 'https://flm6m6u5yc.execute-api.ap-south-1.amazonaws.com/dev';
const SELECTOR_CONFIG_URL = 'https://d37anhmjei4vts.cloudfront.net/config/selectors.json';

// ─── Storage helpers ──────────────────────────────────────────────────────────
const getTokens = () => chrome.storage.local.get(['access_token', 'id_token', 'refresh_token', 'token_expiry']);
const setTokens = (t) => chrome.storage.local.set({
  access_token: t.access_token,
  id_token: t.id_token,
  refresh_token: t.refresh_token || undefined,
  token_expiry: t.expires_in ? Date.now() + t.expires_in * 1000 : undefined,
});const clearTokens = () => chrome.storage.local.remove(['id_token', 'refresh_token', 'token_expiry']);

// ─── Token refresh ────────────────────────────────────────────────────────────
const getValidToken = async () => {
  const { access_token, id_token, refresh_token, token_expiry } = await getTokens();
  if (!id_token && !refresh_token) return null;

  const needsRefresh = !token_expiry || Date.now() > token_expiry - 120_000;
  if (needsRefresh && refresh_token) {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token }),
      });
      if (res.ok) {
        const data = await res.json();
        await setTokens({ ...data, refresh_token });
        return data.id_token; // API Gateway Cognito authorizer requires id_token
      }
    } catch (e) {
      console.error('[Advolt] Token refresh failed', e.message);
    }
    await clearTokens();
    return null;
  }

  return id_token || null;
};

// ─── Load selector config on startup ─────────────────────────────────────────
const loadSelectorConfig = async () => {
  try {
    const res = await fetch(SELECTOR_CONFIG_URL);
    if (res.ok) {
      const config = await res.json();
      await chrome.storage.local.set({ selectorConfig: config });
    }
  } catch (_) {
    // use cached
  }
};
loadSelectorConfig();

// ─── Message handler ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Advolt worker] received:', message.type);

  const handle = async () => {
    switch (message.type) {

      case 'GET_TOKEN': {
        const token = await getValidToken();
        return { token };
      }

      case 'LOGIN': {
        const { email, password } = message.payload;
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { success: false, error: err.error || 'Login failed' };
        }
        const tokens = await res.json();
        await setTokens(tokens); // stores access_token, id_token, refresh_token
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
        const { selectorConfig } = await chrome.storage.local.get('selectorConfig');
        return { config: selectorConfig || null };
      }

      case 'SAVE_AD': {
        const token = await getValidToken();
        if (!token) {
          console.error('[Advolt] SAVE_AD: not authenticated');
          return { success: false, error: 'Not authenticated' };
        }

        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            const exp = payload.exp * 1000;
            console.log('[Advolt] id_token valid:', exp > Date.now(), 'sub:', payload.sub, 'token_use:', payload.token_use, 'aud:', payload.aud, 'iss:', payload.iss);
          }
        } catch (e) {
          console.warn('[Advolt] Could not decode token:', e.message);
        }

        console.log('[Advolt] SAVE_AD: calling API for', message.payload?.advertiser_name);
        const res = await fetch(`${API_BASE}/ads/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(message.payload),
        });

        console.log('[Advolt] SAVE_AD: status', res.status);

        if (res.status === 402) return { success: false, error: 'limit_reached' };
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error('[Advolt] SAVE_AD: error', err);
          return { success: false, error: err.error || 'Save failed' };
        }

        const data = await res.json();
        return { success: true, ad_id: data.ad_id };
      }

      case 'GET_RECENT_ADS': {
        const token = await getValidToken();
        if (!token) return { ads: [] };
        const res = await fetch(`${API_BASE}/ads?limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { ads: [] };
        const data = await res.json();
        return { ads: data.ads || [] };
      }

      default:
        return { error: 'Unknown message type' };
    }
  };

  handle()
    .then((result) => { console.log('[Advolt worker] responding:', result); sendResponse(result); })
    .catch((err) => { console.error('[Advolt worker] error:', err); sendResponse({ error: err.message }); });

  return true;
});
