/**
 * Advolt AI — Google Search Ads Content Script
 * Detects sponsored ads on Google Search results and injects Save buttons.
 */

const savedAdKeys = new Set();
const injectedAds = new WeakSet();

// ─── Extract ad data from a Google Search ad block ───────────────────────────
const extractGoogleAd = (adBlock) => {
  // Headlines: Google ads have multiple headline links
  const headlineEls = adBlock.querySelectorAll('a[data-rw] h3, a[ping] h3, div[role="heading"] span, h3');
  const headlines = [...headlineEls]
    .map(el => el.innerText?.trim())
    .filter(t => t && t.length > 2)
    .slice(0, 3);

  // Description: the text below headlines
  const descEls = adBlock.querySelectorAll('div[class*="VwiC3b"], div[class*="MUxGbd"], span[class*="r0bn4c"], div.IsZvec');
  let descriptions = [...descEls]
    .map(el => el.innerText?.trim())
    .filter(t => t && t.length > 15)
    .slice(0, 2);

  // Fallback: get longer text blocks
  if (descriptions.length === 0) {
    const allText = [...adBlock.querySelectorAll('div, span')]
      .filter(el => {
        const t = el.innerText?.trim();
        return t && t.length > 30 && t.length < 200 && el.children.length < 3;
      })
      .map(el => el.innerText.trim());
    descriptions = [...new Set(allText)].slice(0, 2);
  }

  // Advertiser name / display URL
  const displayUrlEl = adBlock.querySelector('span[class*="VuuXrf"], cite, span.x2VHCd');
  const advertiser_name = displayUrlEl?.innerText?.trim() || '';

  // Landing page URL
  const mainLink = adBlock.querySelector('a[data-rw], a[ping], a[href^="http"]');
  const landing_page = mainLink?.href || '';

  // Sitelinks (if present)
  const sitelinkEls = adBlock.querySelectorAll('a[class*="sitelink"], td a, div.bOeY0b a');
  const sitelinks = [...sitelinkEls]
    .map(el => ({ text: el.innerText?.trim(), url: el.href }))
    .filter(s => s.text && s.text.length > 2)
    .slice(0, 6);

  // Callout extensions
  const calloutEls = adBlock.querySelectorAll('div.MUxGbd span, div[class*="callout"]');
  const callouts = [...calloutEls]
    .map(el => el.innerText?.trim())
    .filter(t => t && t.length > 3 && t.length < 30 && !headlines.includes(t) && !descriptions.includes(t));

  return {
    advertiser_name: advertiser_name || (landing_page ? new URL(landing_page).hostname : 'Unknown'),
    primary_text: descriptions.join(' | '),
    headline: headlines.join(' | '),
    headlines,
    descriptions,
    sitelinks,
    callouts: [...new Set(callouts)].slice(0, 6),
    cta: '',
    landing_page,
    image_urls: [],
    video_urls: [],
    platform: 'google_search',
    source_url: window.location.href,
    search_query: new URLSearchParams(window.location.search).get('q') || '',
    timestamp: new Date().toISOString(),
  };
};

// ─── Inject save button on a Google ad block ─────────────────────────────────
const injectButton = (adBlock) => {
  if (injectedAds.has(adBlock)) return;
  injectedAds.add(adBlock);

  const adData = extractGoogleAd(adBlock);
  if (!adData.headline && !adData.primary_text) return; // Skip empty

  const adKey = `${adData.advertiser_name}__${adData.headline}`.slice(0, 100);

  const btn = document.createElement('button');
  btn.className = 'advolt-google-btn';
  btn.innerText = '⚡ Save Ad';
  btn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2147483647;
    background: #6366f1;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    font-family: system-ui, sans-serif;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    letter-spacing: 0.2px;
    transition: all 0.15s;
  `;

  btn.addEventListener('mouseenter', () => { btn.style.background = '#4f46e5'; });
  btn.addEventListener('mouseleave', () => { 
    if (!btn.disabled) btn.style.background = '#6366f1'; 
  });

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (savedAdKeys.has(adKey)) return;

    btn.innerText = '⏳ Saving...';
    btn.disabled = true;
    btn.style.background = '#4f46e5';

    let result;
    try {
      if (!chrome?.runtime?.sendMessage) throw new Error('Extension context invalid');
      result = await chrome.runtime.sendMessage({ type: 'SAVE_AD', payload: adData });
    } catch (err) {
      await new Promise((r) => setTimeout(r, 800));
      try {
        result = await chrome.runtime.sendMessage({ type: 'SAVE_AD', payload: adData });
      } catch (err2) {
        result = { success: false, error: err2.message || 'Extension error' };
      }
    }

    if (result?.success) {
      savedAdKeys.add(adKey);
      btn.innerText = '✓ Saved';
      btn.style.background = '#22c55e';
    } else if (result?.error === 'limit_reached') {
      btn.innerText = '🔒 Limit';
      btn.style.background = '#f59e0b';
    } else {
      btn.innerText = '✗ Failed';
      btn.style.background = '#ef4444';
      setTimeout(() => {
        btn.innerText = '⚡ Save Ad';
        btn.style.background = '#6366f1';
        btn.disabled = false;
      }, 2000);
    }
  });

  if (window.getComputedStyle(adBlock).position === 'static') {
    adBlock.style.position = 'relative';
  }
  adBlock.appendChild(btn);
};

// ─── Find Google Search ad blocks ────────────────────────────────────────────
const findAdBlocks = () => {
  const adBlocks = new Set();

  // Method 1: Look for "Sponsored" / "Ad" labels
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const t = node.textContent?.trim();
        return (t === 'Sponsored' || t === 'Ad' || t === 'Ads')
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    }
  );

  let node;
  while ((node = walker.nextNode())) {
    // Walk up to find the ad container
    let el = node.parentElement;
    for (let i = 0; i < 8; i++) {
      if (!el || el === document.body) break;
      // Google ad blocks are typically divs with data-text-ad or contain headline links
      if (
        el.querySelector('h3') &&
        el.offsetHeight > 60 &&
        el.offsetWidth > 200
      ) {
        adBlocks.add(el);
        break;
      }
      el = el.parentElement;
    }
  }

  // Method 2: Look for known Google ad container selectors
  document.querySelectorAll('div[data-text-ad], div[data-hveid] div.uEierd, div.mnr-c, div.commercial-unit-desktop-top').forEach(el => {
    if (el.querySelector('h3') && el.offsetHeight > 60) {
      adBlocks.add(el);
    }
  });

  // Method 3: Look for elements with "Ad" badge styling
  document.querySelectorAll('span.x2VHCd, span[class*="ad-badge"]').forEach(badge => {
    let el = badge.parentElement;
    for (let i = 0; i < 6; i++) {
      if (!el) break;
      if (el.querySelector('h3') && el.offsetHeight > 60) {
        adBlocks.add(el);
        break;
      }
      el = el.parentElement;
    }
  });

  return adBlocks;
};

// ─── Main scan ────────────────────────────────────────────────────────────────
const scan = () => {
  const adBlocks = findAdBlocks();
  adBlocks.forEach(injectButton);
};

// ─── MutationObserver ─────────────────────────────────────────────────────────
let timer = null;
new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(scan, 500);
}).observe(document.body, { childList: true, subtree: true });

// ─── Init ─────────────────────────────────────────────────────────────────────
scan();
