/**
 * Advolt.ai Content Script
 * Detects Meta ads, extracts data, injects Save buttons.
 */

let SELECTORS = {
  adLibraryCard: "div[class*='_8nqq'], div[class*='x1dr75xp']",
  feedAdContainer: "div[data-pagelet^='FeedUnit'], div[role='article']",
  feedAd: "[data-testid='story-subtitle'] span",
  primaryText: "div[data-ad-preview='message'], div[class*='xdj266r']",
  headline: "div[class*='xdj266r']",
  cta: "div[class*='x1i10hfl'] a, a[role='button']",
  advertiserName: "strong a, h2 a, a[class*='x1i10hfl'] span",
  images: "img[class*='x1ey2m1c'], img[class*='xz74otr'], img[class*='x168nmei']",
};

let savedAdIds = new Set();

// ─── Load remote selector config ────────────────────────────────────────────
const loadSelectors = async () => {
  try {
    const { config } = await chrome.runtime.sendMessage({ type: 'GET_SELECTOR_CONFIG' });
    if (config?.selectors) {
      SELECTORS = { ...SELECTORS, ...config.selectors };
    }
  } catch (e) {
    // use defaults
  }
};

// ─── Extract ad data from a container element ────────────────────────────────
const extractAdData = (container) => {
  const getText = (sel) => {
    for (const s of sel.split(',')) {
      const el = container.querySelector(s.trim());
      if (el?.innerText?.trim()) return el.innerText.trim();
    }
    return '';
  };

  const getAttr = (sel, attr) => {
    for (const s of sel.split(',')) {
      const el = container.querySelector(s.trim());
      if (el?.getAttribute(attr)) return el.getAttribute(attr);
    }
    return '';
  };

  const getImages = (sel) => {
    const imgs = [];
    for (const s of sel.split(',')) {
      container.querySelectorAll(s.trim()).forEach((img) => {
        if (img.src && !img.src.includes('data:') && !imgs.includes(img.src)) {
          imgs.push(img.src);
        }
      });
    }
    return imgs;
  };

  // Try to get advertiser name from multiple places
  const advertiserName =
    getText(SELECTORS.advertiserName) ||
    container.querySelector('a[href*="facebook.com"]')?.innerText?.trim() ||
    'Unknown Advertiser';

  return {
    advertiser_name: advertiserName,
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

// ─── Create Save button ──────────────────────────────────────────────────────
const createSaveButton = (adData, adKey) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'advolt-btn-wrapper';
  wrapper.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2147483647;
  `;

  const btn = document.createElement('button');
  btn.className = 'advolt-save-btn';
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
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    white-space: nowrap;
    line-height: 1;
  `;

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (savedAdIds.has(adKey)) return;

    btn.innerText = '⏳ Saving...';
    btn.disabled = true;
    btn.style.background = '#4f46e5';

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
  return wrapper;
};

// ─── Inject Save button into a container ─────────────────────────────────────
const injectButton = (container) => {
  if (container.querySelector('.advolt-btn-wrapper')) return;

  const adData = extractAdData(container);
  const adKey = `${adData.advertiser_name}__${adData.primary_text}`.slice(0, 80);

  const btn = createSaveButton(adData, adKey);

  const currentPosition = window.getComputedStyle(container).position;
  if (currentPosition === 'static') container.style.position = 'relative';

  container.appendChild(btn);
};

// ─── Detect if element is an ad container ────────────────────────────────────
const isAdContainer = (el) => {
  // Ad Library page
  if (window.location.href.includes('facebook.com/ads/library')) {
    // Each ad card in the library is a direct child div with substantial content
    return (
      el.tagName === 'DIV' &&
      el.offsetHeight > 100 &&
      el.querySelector('img') &&
      (el.innerText?.length > 20)
    );
  }

  // Feed — look for "Sponsored" text
  const text = el.innerText || '';
  return text.includes('Sponsored') || text.includes('Sponsorisé') || text.includes('Patrocinado');
};

// ─── Scan DOM for ad containers ──────────────────────────────────────────────
const scanForAds = () => {
  if (window.location.href.includes('facebook.com/ads/library')) {
    // Ad Library — target the result cards
    const candidates = document.querySelectorAll(
      'div[class*="_8nqq"], div[class*="x1dr75xp"], div[class*="xh8yej3"], ' +
      'div[data-testid="ad-archive-renderer"], div[class*="x78zum5"]'
    );

    candidates.forEach((el) => {
      if (el.offsetHeight > 80 && el.querySelector('img')) {
        injectButton(el);
      }
    });

    // Fallback: scan all large divs on the library page
    if (document.querySelectorAll('.advolt-btn-wrapper').length === 0) {
      const allDivs = document.querySelectorAll('div');
      allDivs.forEach((div) => {
        if (
          div.offsetHeight > 150 &&
          div.offsetWidth > 200 &&
          div.querySelector('img') &&
          div.innerText?.length > 50 &&
          !div.querySelector('.advolt-btn-wrapper') &&
          !div.closest('.advolt-btn-wrapper')
        ) {
          const parent = div.parentElement;
          if (parent && !parent.querySelector('.advolt-btn-wrapper')) {
            injectButton(div);
          }
        }
      });
    }
  } else {
    // Facebook feed
    const feedUnits = document.querySelectorAll(
      'div[data-pagelet^="FeedUnit"], div[role="article"]'
    );
    feedUnits.forEach((unit) => {
      if (isAdContainer(unit)) injectButton(unit);
    });
  }
};

// ─── MutationObserver ────────────────────────────────────────────────────────
let scanTimeout = null;
const observer = new MutationObserver(() => {
  clearTimeout(scanTimeout);
  scanTimeout = setTimeout(scanForAds, 500);
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
