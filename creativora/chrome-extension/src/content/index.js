/**
 * Advolt.ai Content Script
 * Detects Meta ads, extracts data, injects Save buttons.
 */

// Default selectors — overridden by remote config
let SELECTORS = {
  // Facebook feed sponsored posts
  feedAd: '[data-testid="story-subtitle"] span',
  feedAdContainer: 'div[data-pagelet^="FeedUnit"]',
  // Ad Library
  adLibraryCard: 'div[class*="x1dr75xp"]',
  adLibrarySponsored: 'span[class*="x193iq5w"]',
  // Ad content fields
  primaryText: 'div[data-ad-preview="message"]',
  headline: 'div[class*="xdj266r"]',
  cta: 'div[class*="x1i10hfl"] a',
  advertiserName: 'strong a, h2 a',
  advertiserAvatar: 'image[preserveAspectRatio]',
  images: 'img[class*="x1ey2m1c"], img[class*="xz74otr"]',
};

let savedAdIds = new Set();

// ─── Load remote selector config ────────────────────────────────────────────
const loadSelectors = async () => {
  const { config } = await chrome.runtime.sendMessage({ type: 'GET_SELECTOR_CONFIG' });
  if (config?.selectors) {
    SELECTORS = { ...SELECTORS, ...config.selectors };
  }
};

// ─── Extract ad data from a container element ────────────────────────────────
const extractAdData = (container) => {
  const getText = (sel) => container.querySelector(sel)?.innerText?.trim() || '';
  const getAttr = (sel, attr) => container.querySelector(sel)?.getAttribute(attr) || '';
  const getImages = (sel) =>
    [...container.querySelectorAll(sel)]
      .map((img) => img.src)
      .filter((src) => src && !src.includes('data:'));

  return {
    advertiser_name: getText(SELECTORS.advertiserName),
    primary_text: getText(SELECTORS.primaryText),
    headline: getText(SELECTORS.headline),
    cta: getText(SELECTORS.cta),
    landing_page: getAttr(SELECTORS.cta, 'href') || '',
    image_urls: getImages(SELECTORS.images),
    video_urls: [],
    platform: window.location.hostname.includes('instagram') ? 'instagram' : 'facebook',
    source_url: window.location.href,
    timestamp: new Date().toISOString(),
  };
};

// ─── Inject Save Ad button into a container ──────────────────────────────────
const injectButton = (container) => {
  if (container.querySelector('.Advolt.ai-btn')) return; // already injected

  const adData = extractAdData(container);
  const adKey = `${adData.advertiser_name}__${adData.primary_text}`.slice(0, 80);

  const wrapper = document.createElement('div');
  wrapper.className = 'Advolt.ai-btn-wrapper';
  wrapper.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 9999;
  `;

  const btn = document.createElement('button');
  btn.className = 'Advolt.ai-btn';
  btn.dataset.adKey = adKey;
  btn.innerText = savedAdIds.has(adKey) ? '✓ Saved' : '⚡ Save Ad';
  btn.style.cssText = `
    background: ${savedAdIds.has(adKey) ? '#22c55e' : '#6366f1'};
    color: white;
    border: none;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: system-ui, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: background 0.2s;
  `;

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (savedAdIds.has(adKey)) return;

    btn.innerText = '⏳ Saving...';
    btn.disabled = true;

    const result = await chrome.runtime.sendMessage({
      type: 'SAVE_AD',
      payload: adData,
    });

    if (result.success) {
      savedAdIds.add(adKey);
      btn.innerText = '✓ Saved';
      btn.style.background = '#22c55e';
    } else if (result.error === 'limit_reached') {
      btn.innerText = '🔒 Limit reached';
      btn.style.background = '#f59e0b';
      btn.disabled = false;
    } else {
      btn.innerText = '✗ Failed';
      btn.style.background = '#ef4444';
      btn.disabled = false;
      setTimeout(() => {
        btn.innerText = '⚡ Save Ad';
        btn.style.background = '#6366f1';
      }, 2000);
    }
  });

  wrapper.appendChild(btn);

  // Make container relative so button positions correctly
  const currentPosition = window.getComputedStyle(container).position;
  if (currentPosition === 'static') container.style.position = 'relative';

  container.appendChild(wrapper);
};

// ─── Scan DOM for ad containers ──────────────────────────────────────────────
const scanForAds = () => {
  // Facebook Ad Library
  const adLibraryCards = document.querySelectorAll(SELECTORS.adLibraryCard);
  adLibraryCards.forEach((card) => {
    const isAd = card.querySelector(SELECTORS.adLibrarySponsored);
    if (isAd) injectButton(card);
  });

  // Facebook feed sponsored posts
  const feedUnits = document.querySelectorAll(SELECTORS.feedAdContainer);
  feedUnits.forEach((unit) => {
    const isSponsored = unit.querySelector(SELECTORS.feedAd);
    if (isSponsored?.innerText?.toLowerCase().includes('sponsored')) {
      injectButton(unit);
    }
  });
};

// ─── MutationObserver — watch for new ads loaded dynamically ─────────────────
const observer = new MutationObserver(() => {
  scanForAds();
});

// ─── Init ────────────────────────────────────────────────────────────────────
const init = async () => {
  await loadSelectors();
  scanForAds();

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
};

init();
