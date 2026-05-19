// Views
const viewLogin = document.getElementById('view-login');
const viewMain = document.getElementById('view-main');
const viewLoading = document.getElementById('view-loading');

const show = (view) => {
  [viewLogin, viewMain, viewLoading].forEach((v) => v.classList.add('hidden'));
  view.classList.remove('hidden');
};

// ─── Init ────────────────────────────────────────────────────────────────────
const init = async () => {
  show(viewLoading);

  const { isAuthenticated } = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' });

  if (isAuthenticated) {
    await loadMainView();
  } else {
    show(viewLogin);
  }
};

// ─── Main view ───────────────────────────────────────────────────────────────
const loadMainView = async () => {
  show(viewMain);

  // Load billing status
  try {
    const { token } = await chrome.runtime.sendMessage({ type: 'GET_TOKEN' });
    const API_BASE = 'https://YOUR_API_GATEWAY_URL';

    const statusRes = await fetch(`${API_BASE}/billing/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (statusRes.ok) {
      const { subscription_plan, ai_credits, ads_saved_count } = await statusRes.json();
      document.getElementById('ads-count').textContent = ads_saved_count ?? '—';
      document.getElementById('ai-credits').textContent = ai_credits ?? '—';
      document.getElementById('plan-badge').textContent =
        subscription_plan === 'pro' ? 'Pro ✨' : 'Free';
    }
  } catch {
    // Non-critical — stats just show dashes
  }

  // Load recent ads
  const { ads } = await chrome.runtime.sendMessage({ type: 'GET_RECENT_ADS' });
  const container = document.getElementById('recent-ads');

  if (ads?.length) {
    container.innerHTML = ads
      .map(
        (ad) => `
        <div class="ad-item">
          <div class="advertiser">${escapeHtml(ad.advertiser_name || 'Unknown')}</div>
          <div class="preview">${escapeHtml(ad.primary_text || ad.headline || '—')}</div>
        </div>`
      )
      .join('');
  }
};

// ─── Login form ──────────────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('login-btn');
  const errorEl = document.getElementById('login-error');

  btn.textContent = 'Logging in...';
  btn.disabled = true;
  errorEl.classList.add('hidden');

  const result = await chrome.runtime.sendMessage({
    type: 'LOGIN',
    payload: { email, password },
  });

  if (result.success) {
    await loadMainView();
  } else {
    errorEl.textContent = result.error || 'Login failed. Check your credentials.';
    errorEl.classList.remove('hidden');
    btn.textContent = 'Log In';
    btn.disabled = false;
  }
});

// ─── Logout ──────────────────────────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'LOGOUT' });
  show(viewLogin);
  document.getElementById('login-form').reset();
});

// ─── Utils ───────────────────────────────────────────────────────────────────
const escapeHtml = (str) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

init();
