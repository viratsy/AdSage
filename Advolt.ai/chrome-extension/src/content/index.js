/**
 * Advolt.ai Content Script
 * Injects Save Ad buttons on Facebook Ad Library.
 */

const savedAdKeys = new Set();
const injectedCards = new WeakSet();

// ─── Extract ad data from a card element ─────────────────────────────────────
const extractAdData = (card) => {
  // ─── Full ad copy: get ALL text content from the ad card ───────────────────
  // Find the "Sponsored" label and get everything below it as ad copy
  const allTextEls = [...card.querySelectorAll('div, span, p')]
    .filter((el) => {
      if (el.children.length > 3) return false; // skip containers
      const text = el.innerText?.trim();
      if (!text || text.length < 10) return false;
      // Skip metadata like "Library ID", "Started running", "Platforms"
      if (/^(Library ID|Started running|Platforms|Active|See (ad|summary))/i.test(text)) return false;
      return true;
    })
    .sort((a, b) => b.innerText.length - a.innerText.length);

  // Primary text = longest text block (the full ad copy)
  const primary_text = allTextEls[0]?.innerText?.trim() || '';
  // Headline = second longest or a shorter distinct block
  const headline = allTextEls[1]?.innerText?.trim() || '';

  // ─── Advertiser name ───────────────────────────────────────────────────────
  // Look for the page name — usually a bold link near "Sponsored"
  let advertiser_name = 'Unknown';
  const sponsoredEl = [...card.querySelectorAll('*')].find(
    (el) => el.children.length === 0 && el.innerText?.trim() === 'Sponsored'
  );
  if (sponsoredEl) {
    // Walk up and look for a sibling/parent with a name link
    let parent = sponsoredEl.parentElement;
    for (let i = 0; i < 5; i++) {
      if (!parent) break;
      const nameEl = parent.querySelector('a[href*="facebook.com"] span, strong, a[role="link"]');
      if (nameEl?.innerText?.trim() && nameEl.innerText.trim() !== 'Sponsored') {
        advertiser_name = nameEl.innerText.trim();
        break;
      }
      parent = parent.parentElement;
    }
  }
  if (advertiser_name === 'Unknown') {
    const links = [...card.querySelectorAll('a[href*="facebook.com"]')];
    const nameLink = links.find((a) => a.innerText?.trim().length > 2 && a.innerText.trim() !== 'Sponsored');
    if (nameLink) advertiser_name = nameLink.innerText.trim();
  }

  // ─── CTA button ───────────────────────────────────────────────────────────
  const ctaEls = [...card.querySelectorAll('a[role="button"], div[role="button"], button, a[class*="x1i10hfl"]')];
  const cta = ctaEls
    .map((el) => el.innerText?.trim())
    .filter((t) => t && t.length > 2 && t.length < 40 && !/^(Like|Comment|Share|Save)$/i.test(t))
    [0] || '';

  // ─── Landing page URL ─────────────────────────────────────────────────────
  const externalLinks = [...card.querySelectorAll('a[href]')]
    .filter((a) => {
      const href = a.href || '';
      return href.startsWith('http') && !href.includes('facebook.com') && !href.includes('instagram.com');
    });
  const landing_page = externalLinks[0]?.href || '';

  // Also check for URLs in the text itself
  const urlInText = primary_text.match(/https?:\/\/[^\s]+/)?.[0] || '';

  // ─── Images ────────────────────────────────────────────────────────────────
  const image_urls = [...card.querySelectorAll('img')]
    .filter((img) => img.src && !img.src.includes('data:') && img.naturalWidth > 80)
    .map((img) => img.src)
    .slice(0, 5);

  // ─── Videos ────────────────────────────────────────────────────────────────
  const video_urls = [];
  // Direct video elements with src
  card.querySelectorAll('video').forEach((vid) => {
    if (vid.src && vid.src.startsWith('http')) video_urls.push(vid.src);
    vid.querySelectorAll('source').forEach((src) => {
      if (src.src && src.src.startsWith('http')) video_urls.push(src.src);
    });
  });
  // Facebook ad video container
  card.querySelectorAll('[data-testid="ad content body video container"] video, div[class*="video"] video').forEach((vid) => {
    if (vid.src && vid.src.startsWith('http')) video_urls.push(vid.src);
  });
  // Also check for blob URLs (won't work for download but indicates video ad)
  if (video_urls.length === 0) {
    card.querySelectorAll('video').forEach((vid) => {
      if (vid.src && vid.src.startsWith('blob:')) {
        // Try poster as fallback indicator
        if (vid.poster && vid.poster.startsWith('http')) video_urls.push(`poster:${vid.poster}`);
      }
    });
  }

  return {
    advertiser_name,
    primary_text,
    headline,
    cta,
    landing_page: landing_page || urlInText,
    image_urls,
    video_urls: [],
    platform: window.location.hostname.includes('instagram') ? 'instagram' : 'facebook',
    source_url: window.location.href,
    timestamp: new Date().toISOString(),
  };
};

// ─── Inject button into a card ────────────────────────────────────────────────
const injectButton = (card) => {
  if (injectedCards.has(card)) return;
  injectedCards.add(card);

  const adData = extractAdData(card);
  const adKey = `${adData.advertiser_name}__${adData.primary_text}`.slice(0, 100);

  const btn = document.createElement('button');
  btn.className = 'advolt-btn';
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
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    font-family: system-ui, sans-serif;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    letter-spacing: 0.2px;
  `;

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (savedAdKeys.has(adKey)) return;

    // Check if this is a video ad — save normally, transcription available on dashboard
    // Regular save flow
    btn.innerText = '⏳ Saving...';
    btn.disabled = true;
    btn.style.background = '#4f46e5';

    let result;
    try {
      if (!chrome?.runtime?.sendMessage) throw new Error('Extension context invalid');
      result = await chrome.runtime.sendMessage({ type: 'SAVE_AD', payload: adData });
    } catch (err) {
      // Worker may have been inactive — wait and retry once
      await new Promise((r) => setTimeout(r, 800));
      try {
        if (!chrome?.runtime?.sendMessage) throw new Error('Extension context invalid — reload the page');
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
      btn.disabled = false;
    } else {
      btn.innerText = '✗ Failed';
      btn.style.background = '#ef4444';
      btn.disabled = false;
      setTimeout(() => {
        btn.innerText = '⚡ Save Ad';
        btn.style.background = '#6366f1';
        btn.disabled = false;
      }, 2000);
    }
  });

  if (window.getComputedStyle(card).position === 'static') {
    card.style.position = 'relative';
  }
  card.appendChild(btn);
};

// ─── Find the ad card ancestor of a "Sponsored" element ──────────────────────
const findCardFromSponsored = (sponsoredEl) => {
  let el = sponsoredEl.parentElement;
  for (let i = 0; i < 10; i++) {
    if (!el || el === document.body) break;
    // A card has an image, reasonable size, and is not too deep
    if (
      el.querySelector('img') &&
      el.offsetHeight > 100 &&
      el.offsetWidth > 150
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
};

// ─── Main scan ────────────────────────────────────────────────────────────────
const scan = () => {
  const cards = new Set();

  // Method 1: Find "Sponsored" text nodes (works on feed ads and ad library previews)
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const t = node.textContent?.trim();
        return (t === 'Sponsored' || t === 'Sponsorisé' || t === 'Patrocinado')
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    }
  );

  let node;
  while ((node = walker.nextNode())) {
    const card = findCardFromSponsored(node.parentElement);
    if (card) cards.add(card);
  }

  // Method 2: Ad Library grid cards — look for "Library ID" text to find card boundaries
  const adLibWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (n) => {
        const t = n.textContent?.trim();
        return (t && t.startsWith('Library ID'))
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    }
  );

  while ((node = adLibWalker.nextNode())) {
    let el = node.parentElement;
    for (let i = 0; i < 12; i++) {
      if (!el || el === document.body) break;
      if (el.offsetHeight > 250 && el.offsetWidth > 200 && el.querySelector('img')) {
        cards.add(el);
        break;
      }
      el = el.parentElement;
    }
  }

  cards.forEach(injectButton);
};

// ─── MutationObserver ─────────────────────────────────────────────────────────
let timer = null;
new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(scan, 600);
}).observe(document.body, { childList: true, subtree: true });

// ─── Init ─────────────────────────────────────────────────────────────────────
scan();
