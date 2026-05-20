/**
 * Advolt.ai Content Script
 * Injects Save Ad buttons on Facebook Ad Library.
 */

const savedAdKeys = new Set();
const injectedCards = new WeakSet();

// ─── Extract ad data from a card element ─────────────────────────────────────
const extractAdData = (card) => {
  // Get all text nodes, pick the longest as primary text
  const textNodes = [...card.querySelectorAll('div, span, p')]
    .filter((el) => !el.children.length && (el.innerText?.trim().length ?? 0) > 20)
    .sort((a, b) => b.innerText.length - a.innerText.length);

  const primary_text = textNodes[0]?.innerText?.trim() || '';

  // Advertiser name — find a link near the top of the card
  const links = [...card.querySelectorAll('a[href*="facebook.com"]')];
  const advertiser_name = links[0]?.innerText?.trim() || 'Unknown';

  // Images
  const image_urls = [...card.querySelectorAll('img')]
    .filter((img) => img.src && !img.src.includes('data:') && img.naturalWidth > 50)
    .map((img) => img.src)
    .slice(0, 3);

  return {
    advertiser_name,
    primary_text,
    headline: '',
    cta: '',
    landing_page: '',
    image_urls,
    video_urls: [],
    platform: 'facebook',
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

    btn.innerText = '⏳ Saving...';
    btn.disabled = true;
    btn.style.background = '#4f46e5';

    const result = await chrome.runtime.sendMessage({ type: 'SAVE_AD', payload: adData });

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
  // Find all "Sponsored" text nodes on the page
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

  const cards = new Set();
  let node;
  while ((node = walker.nextNode())) {
    const card = findCardFromSponsored(node.parentElement);
    if (card) cards.add(card);
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
