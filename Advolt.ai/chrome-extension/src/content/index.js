/**
 * Advolt.ai Content Script
 * Detects Meta ads in Facebook Ad Library, injects one Save button per ad.
 */

let SELECTORS = {
  primaryText: "div[data-ad-preview='message']",
  advertiserName: "strong a, h2 a",
  images: "img[class*='x1ey2m1c'], img[class*='xz74otr'], img[class*='x168nmei']",
};

const savedAdIds = new Set();

// ─── Load remote selector config ─────────────────────────────────────────────
const loadSelectors = async () => {
  try {
    const { config } = await chrome.runtime.sendMessage({ type: 'GET_SELECTOR_CONFIG' });
    if (config?.selectors) SELECTORS = { ...SELECTORS, ...config.selectors };
  } catch (_) {}
};

// ─── Extract ad data from a card ─────────────────────────────────────────────
const extractAdData = (card) => {
  const text = (sel) => {
    for (const s of sel.split(',')) {
      const t = card.querySelector(s.trim())?.innerText?.trim();
      if (t) return t;
    }
    return '';
  };

  const images = [];
  card.querySelectorAll('img').forEach((img) => {
    if (img.src && !img.src.includes('data:') && img.width > 50) images.push(img.src);
  });

  // Advertiser name — look for the page name link near the top of the card
  const advertiserEl =
    card.querySelector('a[href*="facebook.com/"] span') ||
    card.querySelector('strong a') ||
    card.querySelector('h2 a') ||
    card.querySelector('a[role="link"]');
  const advertiser_name = advertiserEl?.innerText?.trim() || 'Unknown';

  // Primary text — largest text block
  const allText = [...card.querySelectorAll('div, span, p')]
    .filter((el) => el.children.length === 0 && el.innerText?.trim().length > 30)
    .sort((a, b) => b.innerText.length - a.innerText.length);
  const primary_text = allText[0]?.innerText?.trim() || '';

  return {
    advertiser_name,
    primary_text,
    headline: text(SELECTORS.primaryText),
    cta: '',
    landing_page: '',
    image_urls: images.slice(0, 3),
    video_urls: [],
    platform: 'facebook',
    source_url: window.location.href,
    timestamp: new Date().toISOString(),
  };
};

// ─── Inject one Save button per ad card ──────────────────────────────────────
const injectButton = (card) => {
  if (card.querySelector('.advolt-btn')) return; // already has button

  const adData = extractAdData(card);
  const adKey = `${adData.advertiser_name}__${adData.primary_text}`.slice(0, 100);

  const btn = document.createElement('button');
  btn.className = 'advolt-btn';
  btn.dataset.adKey = adKey;
  btn.innerText = savedAdIds.has(adKey) ? '✓ Saved' : '⚡ Save Ad';
  btn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2147483647;
    background: ${savedAdIds.has(adKey) ? '#22c55e' : '#6366f1'};
    color: white;
    border: none;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: system-ui, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    pointer-events: all;
  `;

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (savedAdIds.has(adKey)) return;

    btn.innerText = '⏳ Saving...';
    btn.disabled = true;

    const result = await chrome.runtime.sendMessage({ type: 'SAVE_AD', payload: adData });

    if (result?.success) {
      savedAdIds.add(adKey);
      btn.innerText = '✓ Saved';
      btn.style.background = '#22c55e';
    } else if (result?.error === 'limit_reached') {
      btn.innerText = '🔒 Limit reached';
      btn.style.background = '#f59e0b';
      btn.disabled = false;
    } else {
      console.error('[Advolt] Save failed:', result?.error);
      btn.innerText = '✗ Failed';
      btn.style.background = '#ef4444';
      btn.disabled = false;
      setTimeout(() => {
        btn.innerText = '⚡ Save Ad';
        btn.style.background = '#6366f1';
      }, 2000);
    }
  });

  if (window.getComputedStyle(card).position === 'static') {
    card.style.position = 'relative';
  }
  card.appendChild(btn);
};

// ─── Find ad cards on the Ad Library page ────────────────────────────────────
const findAdCards = () => {
  const cards = [];

  // Strategy: find all divs that contain "Sponsored" text AND an image
  // and are not nested inside another such div
  const candidates = document.querySelectorAll('div[role="article"], div[data-testid]');

  if (candidates.length > 0) {
    candidates.forEach((el) => {
      if (el.querySelector('img') && !el.closest('[data-testid]')?.isSameNode(el)) {
        cards.push(el);
      }
    });
  }

  // Fallback for Ad Library grid cards
  if (cards.length === 0) {
    // Each ad card in the library is a sibling div at the same level
    // Find the grid container and get its direct children
    const sponsored = [...document.querySelectorAll('*')].filter(
      (el) => el.children.length === 0 && el.innerText?.trim() === 'Sponsored'
    );

    sponsored.forEach((sponsoredEl) => {
      // Walk up to find the card container (has image + text)
      let el = sponsoredEl.parentElement;
      for (let i = 0; i < 8; i++) {
        if (!el) break;
        if (el.querySelector('img') && el.offsetHeight > 100 && el.offsetWidth > 150) {
          if (!cards.includes(el)) cards.push(el);
          break;
        }
        el = el.parentElement;
      }
    });
  }

  return cards;
};

// ─── Scan ─────────────────────────────────────────────────────────────────────
const scanForAds = () => {
  const cards = findAdCards();
  cards.forEach(injectButton);
};

// ─── MutationObserver ─────────────────────────────────────────────────────────
let scanTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(scanForAds, 800);
});

// ─── Init ─────────────────────────────────────────────────────────────────────
const init = async () => {
  await loadSelectors();
  scanForAds();
  observer.observe(document.body, { childList: true, subtree: true });
};

init();
