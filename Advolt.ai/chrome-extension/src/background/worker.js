/**
 * Advolt.ai Background Service Worker
 * Self-contained — no ES module imports (MV3 compatibility)
 */

const API_BASE = 'https://flm6m6u5yc.execute-api.ap-south-1.amazonaws.com/dev';
const SELECTOR_CONFIG_URL = 'https://d37anhmjei4vts.cloudfront.net/config/selectors.json';

// ─── Audio Recording State ────────────────────────────────────────────────────
let mediaRecorder = null;
let audioChunks = [];
let recordingAdData = null;

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
  const { id_token, refresh_token } = await getTokens();
  console.log('[Advolt] getValidToken: id_token present:', !!id_token, 'refresh_token present:', !!refresh_token);
  if (!id_token && !refresh_token) return null;

  // Always check actual JWT expiry — don't trust stored token_expiry
  let tokenExpired = true;
  if (id_token) {
    try {
      const parts = id_token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        tokenExpired = Date.now() > (payload.exp * 1000) - 120_000;
      }
    } catch (_) { tokenExpired = true; }
  }

  if (!tokenExpired) return id_token;

  // Token expired — try refresh
  if (refresh_token) {
    try {
      console.log('[Advolt] Token expired, refreshing...');
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token }),
      });
      if (res.ok) {
        const data = await res.json();
        await setTokens({ ...data, refresh_token });
        console.log('[Advolt] Token refreshed');
        return data.id_token;
      }
    } catch (e) {
      console.error('[Advolt] Token refresh failed', e.message);
    }
  }

  await clearTokens();
  return null;
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
            const now = Date.now();
            console.log('[Advolt] id_token valid:', exp > now, 
              'expires in:', Math.round((exp - now) / 60000), 'min',
              'sub:', payload.sub, 'token_use:', payload.token_use, 
              'aud:', payload.aud, 'iss:', payload.iss);
          }
        } catch (e) {
          console.warn('[Advolt] Could not decode token:', e.message);
        }

        console.log('[Advolt] SAVE_AD: calling API for', message.payload?.advertiser_name);
        console.log('[Advolt] Auth header:', `Bearer ${token.substring(0,20)}...${token.slice(-10)}`);
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

      case 'START_RECORDING': {
        // Start recording tab audio
        recordingAdData = message.payload;
        audioChunks = [];
        try {
          const stream = await new Promise((resolve, reject) => {
            chrome.tabCapture.capture({ audio: true, video: false }, (s) => {
              if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
              else resolve(s);
            });
          });
          // Use opus codec for smallest file size (~50KB/min)
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm';
          mediaRecorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 });
          mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
          mediaRecorder.start(1000);

          // Auto-stop after 60 seconds
          setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
              console.log('[Advolt] Auto-stopping recording at 60s');
              chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
            }
          }, 60000);

          console.log('[Advolt] Recording started (auto-stop in 60s, opus codec)');
          return { success: true, recording: true };
        } catch (err) {
          console.error('[Advolt] Recording failed to start:', err.message);
          return { success: false, error: err.message };
        }
      }

      case 'STOP_RECORDING': {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
          return { success: false, error: 'Not recording' };
        }
        return new Promise((resolve) => {
          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            console.log('[Advolt] Recording stopped, size:', audioBlob.size);

            // Save the ad first
            const token = await getValidToken();
            if (!token) { resolve({ success: false, error: 'Not authenticated' }); return; }

            const saveRes = await fetch(`${API_BASE}/ads/save`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(recordingAdData),
            });

            if (!saveRes.ok) {
              const err = await saveRes.json().catch(() => ({}));
              resolve({ success: false, error: err.error || 'Save failed' });
              return;
            }

            const saveData = await saveRes.json();
            const ad_id = saveData.ad_id;

            // Upload audio to the transcribe endpoint
            // Convert blob to base64 for JSON transport
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64Audio = reader.result.split(',')[1];
              try {
                const transcribeRes = await fetch(`${API_BASE}/ai/transcribe`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ ad_id, audio_base64: base64Audio, format: 'webm' }),
                });
                const transcribeData = await transcribeRes.json();
                console.log('[Advolt] Transcription result:', transcribeData);
                resolve({ success: true, ad_id, transcript: transcribeData.transcript });
              } catch (err) {
                // Ad saved but transcription failed — still success for the save
                resolve({ success: true, ad_id, transcript_error: err.message });
              }
            };
            reader.readAsDataURL(audioBlob);
          };
          mediaRecorder.stop();
          // Stop all tracks
          mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        });
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
