const { withAssetVersion } = require('./build');
const REGION = 'Tennessee';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// "Minimum: 2 dozen" using the item's Sold Per unit. Returns '' when there is
// no minimum (blank / 0). Shared by the profile menu and the order flow, and
// mirrored client-side in order.js.
function minimumLabel(min, soldPer) {
  const n = Number(min);
  if (!Number.isFinite(n) || n <= 0) return '';
  const sp = String(soldPer || '').toLowerCase();
  let unit;
  if (sp === 'dozen') unit = 'dozen';
  else if (sp === 'half dozen' || sp === 'halfdozen') unit = 'half dozen';
  else if (sp === 'individual') unit = n === 1 ? 'item' : 'items';
  else if (sp) unit = sp;
  else unit = n === 1 ? 'order' : 'orders';
  return `Minimum: ${n} ${unit}`;
}

// Format a 'YYYY-MM-DD' string without constructing a Date (no timezone shift).
function formatDateLabel(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function instagramUrl(handle) {
  if (!handle) return null;
  const h = String(handle).trim();
  if (/^https?:\/\//i.test(h)) return h;
  return `https://instagram.com/${h.replace(/^@/, '')}`;
}

function shortCity(city) {
  if (!city) return '';
  return String(city).split(',')[0].trim();
}

const SEARCH_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;

function badges(baker) {
  let out = '';
  if (baker.verified) out += `<span class="badge badge-verified">✓ Verified</span>`;
  if (baker.foundingBaker) out += `<span class="badge badge-founding">Founding Baker</span>`;
  return out;
}

function cardPhoto(baker) {
  const inner = baker.verified ? `<span class="card-badge badge-verified">✓ Verified</span>` : '';
  const loc = shortCity(baker.city);
  const locTag = loc ? `<span class="card-loc">${esc(loc)}</span>` : '';
  if (baker.photo) {
    return `<div class="card-photo" style="background-image:url('${esc(baker.photo)}')">${inner}${locTag}</div>`;
  }
  return `<div class="card-photo card-photo-empty">${inner}${locTag}<span class="card-photo-emoji">🧁</span></div>`;
}

function chips(items, cls) {
  if (!items || !items.length) return '';
  return `<div class="chips">${items.map(t => `<span class="chip ${cls || ''}">${esc(t)}</span>`).join('')}</div>`;
}

// Public baker rating: "X.X stars (N reviews)". Hidden until there is at least one rating.
function ratingLine(baker) {
  if (baker.rating == null || !baker.ratingCount) return '';
  const n = baker.ratingCount;
  return `<div class="rating-line">★ ${esc(Number(baker.rating).toFixed(1))} <span class="rating-count">(${n} review${n === 1 ? '' : 's'})</span></div>`;
}

// Heart toggle for logged-in customers. Filled when this baker is already in
// the customer's Favorite Bakers. Rendered as a span (valid inside the card's
// anchor) with role=button. Hidden for guests, since favoriting needs an account.
function favoriteButton(bakerId, viewer, opts = {}) {
  if (!viewer || !viewer.customer) return '';
  const isFav = Array.isArray(viewer.favoriteIds) && viewer.favoriteIds.includes(bakerId);
  const label = isFav ? 'Remove from favorites' : 'Save to favorites';
  const cls = opts.inline ? 'fav-btn fav-btn-inline' : 'fav-btn';
  return `<span class="${cls}" role="button" tabindex="0" data-fav-toggle data-baker-id="${esc(bakerId)}" aria-pressed="${isFav ? 'true' : 'false'}" aria-label="${label}" title="${label}">
    <svg class="fav-heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.7 3.9 12.6a4.9 4.9 0 0 1 0-6.9 4.9 4.9 0 0 1 6.9 0l1.2 1.2 1.2-1.2a4.9 4.9 0 0 1 6.9 0 4.9 4.9 0 0 1 0 6.9z"/></svg>
  </span>`;
}

function bakerCard(baker, viewer) {
  const taking = baker.acceptingOrders
    ? `<span class="taking"><span class="dot"></span>Taking orders</span>`
    : `<span class="taking taking-off">Currently paused</span>`;
  return `<a class="baker-card" href="/bakers/${esc(baker.id)}">
    ${favoriteButton(baker.id, viewer)}
    ${cardPhoto(baker)}
    <div class="card-body">
      <h3>${esc(baker.businessName)}</h3>
      ${ratingLine(baker)}
      ${baker.bio ? `<p class="card-bio">${esc(baker.bio)}</p>` : ''}
      ${chips(baker.productTypes.slice(0, 3))}
      <div class="card-foot">
        ${taking}
        <span class="btn btn-primary btn-sm">View baker</span>
      </div>
    </div>
  </a>`;
}

function header(viewer) {
  const v = viewer || {};
  let nav;
  if (v.customer) {
    const n = Number(v.unread) || 0;
    const dot = `<span class="hdr-dot" data-nav-unread${n > 0 ? '' : ' hidden'}></span>`;
    nav = `<nav class="site-nav site-nav--icons">
      <a class="hdr-icon" href="/customer/messages" aria-label="Messages"><i class="ti ti-message-circle" aria-hidden="true"></i>${dot}</a>
      <a class="hdr-icon" href="/customer/profile" aria-label="Profile"><i class="ti ti-user" aria-hidden="true"></i></a>
    </nav>`;
  } else {
    nav = `<nav class="site-nav">
      <a href="/#how">How it works</a>
      <a href="/faq">FAQ</a>
      <a href="/app">For bakers</a>
      <a class="nav-cta" href="/app">Are you a baker?</a>
    </nav>`;
  }
  return `<header class="site-header">
    <a class="brand" href="/"><img src="/img/bkdlocal-logo.svg" alt="bkd local"></a>
    ${nav}
  </header>`;
}

function footer() {
  return `<footer class="site-footer">
    <div>© Bkd Local · local bakers, baked to order</div>
    <div class="footer-links"><a href="/bakers">Browse bakers</a> · <a href="/faq">FAQ</a> · <a href="/app">For bakers</a></div>
    <a class="footer-baker-cta" href="/join">Are you a baker? Join Bkd Local</a>
  </footer>`;
}

// App-style bottom nav, logged-in customers only. Hidden entirely when signed out.
function custBottomNav(viewer) {
  const v = viewer || {};
  if (!v.customer) return '';
  const n = Number(v.unread) || 0;
  const dot = `<span class="cust-nav-dot" data-nav-unread${n > 0 ? '' : ' hidden'}></span>`;
  return `<nav class="cust-bottom-nav">
    <div class="cust-nav-inner">
      <a class="cust-nav-box" href="/bakers">
        <i class="ti ti-search cust-nav-icon" aria-hidden="true"></i>
        <span class="cust-nav-label">Browse</span>
      </a>
      <a class="cust-nav-box" href="/customer/orders">
        <i class="ti ti-package cust-nav-icon" aria-hidden="true"></i>
        <span class="cust-nav-label">My Orders</span>
      </a>
      <a class="cust-nav-box" href="/customer/messages">
        <i class="ti ti-message-circle cust-nav-icon" aria-hidden="true"></i>${dot}
        <span class="cust-nav-label">Messages</span>
      </a>
      <a class="cust-nav-box" href="/customer/profile">
        <i class="ti ti-user cust-nav-icon" aria-hidden="true"></i>
        <span class="cust-nav-label">Profile</span>
      </a>
    </div>
  </nav>`;
}

// Date-first search. Date leads; the treat/name/occasion box is a secondary,
// combinable filter. Single vs range is a pure-CSS radio toggle (no JS).
function searchBlock(filters) {
  const f = filters || {};
  const isRange = f.mode === 'range';
  const radii = [5, 10, 25, 50];
  const selRadius = radii.includes(Number(f.radius)) ? Number(f.radius) : 25;
  const radiusOptions = radii
    .map(r => `<option value="${r}"${r === selRadius ? ' selected' : ''}>${r} mi</option>`)
    .join('');
  return `<form class="search-block" method="get" action="/bakers">
    <div class="search-prompt">When's the celebration?</div>
    <input class="mode-radio" type="radio" name="mode" id="mode-single" value="single"${isRange ? '' : ' checked'}>
    <input class="mode-radio" type="radio" name="mode" id="mode-range" value="range"${isRange ? ' checked' : ''}>
    <div class="mode-tabs">
      <label for="mode-single">Single date</label>
      <label for="mode-range">Date range</label>
    </div>
    <div class="date-fields">
      <div class="df-single">
        <input type="${f.date ? 'date' : 'text'}" name="date" value="${esc(f.date || '')}" placeholder="When do you need your order?" onfocus="this.type='date'; try { this.showPicker && this.showPicker(); } catch (e) {}" onblur="if (!this.value) this.type='text';" aria-label="When do you need your order?">
      </div>
      <div class="df-range">
        <input type="date" name="from" value="${esc(f.from || '')}" aria-label="From date">
        <span class="to-sep">to</span>
        <input type="date" name="to" value="${esc(f.to || '')}" aria-label="To date">
      </div>
    </div>
    <div class="search-geo">
      <input type="text" name="zip" value="${esc(f.zip || f.zipPrefill || '')}" inputmode="numeric" pattern="[0-9]*" maxlength="5" placeholder="ZIP code" aria-label="ZIP code">
      <select name="radius" aria-label="Search radius">${radiusOptions}</select>
    </div>
    <div class="search-secondary">
      <span class="search-icon">${SEARCH_ICON}</span>
      <input type="search" name="q" value="${esc(f.q || '')}" placeholder="Search by treat, baker, or occasion" aria-label="Search by treat, baker, or occasion">
      <button class="btn btn-primary" type="submit">Find bakers</button>
    </div>
  </form>`;
}

function hero(filters, { compact } = {}) {
  return `<section class="hero${compact ? ' hero-compact' : ''}">
    <div class="hero-inner">
      <div class="hero-eyebrow">${esc(REGION.toUpperCase())}</div>
      <h1>Something beautiful for <span>the moments that matter</span></h1>
      <p class="hero-sub">Custom cookies, cakes, and treats from the artisan bakers right in your neighborhood.</p>
      ${searchBlock(filters)}
    </div>
  </section>`;
}

function layout({ title, description, body, viewer }) {
  return withAssetVersion(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#F3C9DD">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description || '')}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description || '')}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.31.0/dist/tabler-icons.min.css">
<link rel="stylesheet" href="/css/public.css">
<link rel="apple-touch-icon" href="/icon-180.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="manifest" href="/manifest.json">
</head>
<body class="${viewer && viewer.customer ? 'has-cust-nav' : ''}">
${header(viewer)}
<main>${body}</main>
${footer()}
${custBottomNav(viewer)}
<script src="/js/nav-badge.js"></script>
<script src="/js/a2hs-banner.js"></script>
${viewer && viewer.customer ? '<script src="/js/favorites.js"></script>' : ''}
</body>
</html>`);
}

function renderHome({ bakers, viewer }) {
  const featured = bakers.slice(0, 6);
  const body = `
  ${hero({})}
  <p class="hero-reassure">Every baker is verified. Pricing is upfront. Payment is protected.</p>
  <section class="section">
    <div class="section-head">
      <h2>Featured bakers</h2>
      <a class="see-all" href="/bakers">See all →</a>
    </div>
    ${featured.length
      ? `<div class="baker-grid">${featured.map(b => bakerCard(b, viewer)).join('')}</div>`
      : `<p class="empty">Our bakers are getting set up. Check back very soon.</p>`}
  </section>
  <section class="section how" id="how">
    <h2>How it works</h2>
    <div class="how-grid">
      <div class="how-step"><span class="how-num">1</span><h4>Pick your date</h4><p>Tell us when your celebration is.</p></div>
      <div class="how-step"><span class="how-num">2</span><h4>See who's available</h4><p>Browse verified bakers free on your date.</p></div>
      <div class="how-step"><span class="how-num">3</span><h4>Request and pick up</h4><p>Send your request and pick up something beautiful.</p></div>
    </div>
  </section>`;
  return layout({
    title: 'Custom cakes, cookies & macarons from local bakers · Bkd Local',
    description: `Find the perfect custom cakes, cookies, and treats for your celebration, made to order by verified local bakers in ${REGION}.`,
    body, viewer
  });
}

function pill(label, href, active) {
  return `<a class="pill${active ? ' pill-active' : ''}" href="${esc(href)}">${esc(label)}</a>`;
}

function buildQuery(params) {
  const parts = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

function dateLabel(filters) {
  if (filters.mode === 'range' && filters.from && filters.to) {
    return `${formatDateLabel(filters.from)} to ${formatDateLabel(filters.to)}`;
  }
  if (filters.date) return formatDateLabel(filters.date);
  return '';
}

function renderDirectory({ bakers, cities, types, filters, total, viewer }) {
  // Carry the active date + text query + zip/radius through every filter pill.
  const carry = { q: filters.q, mode: filters.mode, date: filters.date, from: filters.from, to: filters.to,
    zip: filters.zip, radius: filters.zip ? filters.radius : '' };
  const typePills = [pill('All treats', `/bakers${buildQuery({ ...carry })}`, !filters.type && !filters.city)]
    .concat(types.map(t => pill(t, `/bakers${buildQuery({ ...carry, type: t })}`, filters.type === t)))
    .concat(cities.map(c => pill(shortCity(c), `/bakers${buildQuery({ ...carry, city: c })}`, filters.city === c)))
    .join('');

  const dl = dateLabel(filters);
  const zipLabel = filters.zip ? `within ${esc(filters.radius)} mi of ${esc(filters.zip)}` : '';
  const countSuffix = [zipLabel, dl ? `available ${esc(dl)}` : '']
    .filter(Boolean).join(' · ') || `in ${esc(REGION)}`;

  let emptyMsg;
  if (filters.zip) {
    emptyMsg = `No bakers found within ${esc(filters.radius)} mi of ${esc(filters.zip)}${dl ? ` for ${esc(dl)}` : ''}. Try a wider radius or <a href="/bakers">clear your search</a>.`;
  } else if (dl) {
    emptyMsg = `No bakers are available ${esc(dl)}. Try another date or <a href="/bakers">clear your search</a>.`;
  } else {
    emptyMsg = `No bakers match your search. <a href="/bakers">Clear filters</a>.`;
  }

  const body = `
  ${hero(filters, { compact: true })}
  <section class="dir-controls">
    <div class="pills">${typePills}</div>
    <div class="result-count"><strong>${bakers.length} artisan baker${bakers.length === 1 ? '' : 's'}</strong> ${countSuffix}</div>
  </section>
  <section class="section">
    ${bakers.length
      ? `<div class="baker-grid">${bakers.map(b => bakerCard(b, viewer)).join('')}</div>`
      : `<p class="empty">${emptyMsg}</p>`}
  </section>`;
  return layout({
    title: 'Find a baker · Bkd Local',
    description: `Browse beautiful custom bakes from verified local bakers in ${REGION}, by date, treat, and city.`,
    body, viewer
  });
}

function menuSection(menu, bakerId) {
  if (!menu || !menu.length) return '';
  const rows = menu.map(m => `
    <div class="menu-row">
      ${m.coverPhoto ? `<div class="menu-row-cover" style="background-image:url('${esc(m.coverPhoto)}');background-size:cover;background-position:center;width:56px;height:56px;border-radius:10px;flex:0 0 auto;margin-right:12px;"></div>` : ''}
      <div class="menu-text">
        <div class="menu-name">${esc(m.name)}</div>
        ${m.description ? `<div class="menu-sub">${esc(m.description)}</div>` : ''}
      </div>
      <div class="menu-right">
        <div class="menu-price-col">
          ${m.price != null ? `<div class="menu-price">$${esc(Number(m.price).toFixed(0))}</div>` : ''}
          ${minimumLabel(m.minimumQuantity, m.soldPer) ? `<div class="menu-min">${esc(minimumLabel(m.minimumQuantity, m.soldPer))}</div>` : ''}
        </div>
        ${m.id ? `<a class="menu-request" href="/order/new?baker=${esc(bakerId)}&amp;item=${esc(m.id)}">Request</a>` : ''}
      </div>
    </div>`).join('');
  return `<section class="profile-section"><div class="section-label">Menu</div><div class="menu-rows">${rows}</div></section>`;
}

// Portfolio strip: 6 tiles max, divided evenly across the baker's menu items;
// when 6 does not divide evenly, the first item gets the remainder. For each
// item, photos are taken in order Cover Photo URL then Portfolio Photo URL 1..6
// (already assembled, empties removed, in m.photos). Only show photos that
// exist, never empty or broken tiles. Items beyond the 6th are not shown.
//   base = floor(6 / itemCount), remainder = 6 % itemCount
//   first item slots = base + remainder, every other item = base
function portfolioPhotosFromMenu(menu) {
  const items = (menu || []).slice(0, 6);
  const n = items.length;
  if (!n) return [];
  const base = Math.floor(6 / n);
  const remainder = 6 % n;
  const out = [];
  items.forEach((m, i) => {
    const slots = base + (i === 0 ? remainder : 0);
    if (slots <= 0) return;
    const available = (m.photos || []).filter(Boolean);
    for (let k = 0; k < slots && k < available.length; k++) out.push(available[k]);
  });
  return out.slice(0, 6);
}

function portfolioSection(photos) {
  const list = (photos || []).filter(Boolean);
  const inner = list.length
    ? `<div class="portfolio">${list.map(url => `<div class="portfolio-tile" style="background-image:url('${esc(url)}')"></div>`).join('')}</div>`
    : `<p class="portfolio-soon">Photos coming soon</p>`;
  return `<section class="profile-section"><div class="section-label">Portfolio</div>${inner}</section>`;
}

function reviewsSection(reviews) {
  if (!reviews || !reviews.length) return '';
  const stars = r => '★★★★★'.slice(0, Math.round(Number(r) || 0)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(Number(r) || 0));
  const items = reviews.map(r => `
    <div class="review">
      <div class="review-head">
        <span class="review-name">${esc(r.reviewerName)}</span>
        <span class="review-stars">${stars(r.rating)}</span>
      </div>
      ${r.text ? `<p>${esc(r.text)}</p>` : ''}
    </div>`).join('');
  return `<section class="profile-section"><div class="section-label">Reviews</div><div class="reviews">${items}</div></section>`;
}

// On-brand signup modal shown to logged-out visitors who tap "Request an order".
function bakerSignupModal(baker) {
  return `
  <div class="bsm-overlay" id="bakerSignupModal" data-baker-id="${esc(baker.id)}" hidden>
    <div class="bsm-card" role="dialog" aria-modal="true" aria-label="Create your account">
      <div class="bsm-header">
        <span class="bsm-logo">bkdlocal</span>
        <button type="button" class="bsm-close" data-bsm-close aria-label="Close">&times;</button>
      </div>
      <div class="bsm-body">
        <h2 class="bsm-title">Create your free account to place your order</h2>
        <p class="bsm-sub">It only takes a minute, and your order will be waiting when you're done.</p>
        <form id="bsmForm" class="bsm-form" novalidate>
          <div class="bsm-two">
            <input name="firstName" type="text" placeholder="First name" autocomplete="given-name" required>
            <input name="lastName" type="text" placeholder="Last name" autocomplete="family-name">
          </div>
          <input name="email" type="email" placeholder="Email" autocomplete="email" required>
          <input name="password" type="password" placeholder="Password" autocomplete="new-password" required>
          <div class="bsm-two">
            <input name="state" type="text" placeholder="State" autocomplete="address-level1" value="TN">
            <input name="zipCode" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="5" placeholder="ZIP code" autocomplete="postal-code" required>
          </div>
          <button type="submit" class="bsm-submit">Create account and continue</button>
          <p class="bsm-error" id="bsmError" hidden></p>
        </form>
        <p class="bsm-signin">Already have an account? <a href="#" data-bsm-signin>Sign in</a></p>
      </div>
    </div>
  </div>
  <script src="/js/baker-signup-modal.js"></script>`;
}

function renderProfile({ baker, menu, reviews, viewer }) {
  const ig = instagramUrl(baker.instagram);
  const bannerStyle = baker.photo ? ` style="background-image:url('${esc(baker.photo)}')"` : '';
  const loc = [shortCity(baker.city) ? `${esc(baker.city)}` : '', 'Pickup available'].filter(Boolean).join(' · ');
  const firstItem = (menu && menu[0]) ? menu[0].id : null;
  const requestHref = firstItem
    ? `/order/new?baker=${esc(baker.id)}&amp;item=${esc(firstItem)}`
    : (ig || '#');
  const requestExternal = !firstItem && ig;
  const body = `
  <nav class="crumbs"><a href="/bakers">← All bakers</a></nav>
  <article class="profile-card">
    <div class="profile-banner${baker.photo ? '' : ' profile-banner-empty'}"${bannerStyle}></div>
    <div class="profile-head">
      <div class="profile-headline">
        <div class="profile-title-row">
          <h1>${esc(baker.businessName)}</h1>
          ${favoriteButton(baker.id, viewer, { inline: true })}
        </div>
        <div class="profile-badges">${badges(baker)}</div>
      </div>
      <div class="profile-location">${esc(loc)}</div>
      ${ratingLine(baker)}
      ${baker.bio ? `<p class="profile-bio">${esc(baker.bio)}</p>` : ''}
      ${menuSection(menu, baker.id)}
      ${portfolioSection(portfolioPhotosFromMenu(menu))}
      ${reviewsSection(reviews)}
      <div class="profile-actions">
        <a class="btn btn-primary btn-block" href="${requestHref}"${requestExternal ? ' target="_blank" rel="noopener"' : ''}>Request an order</a>
        <a class="btn btn-outline" href="/customer/messages?baker=${esc(baker.id)}">Message</a>
      </div>
      <div class="custom-quote">Want something you don't see? <a href="/customer/messages?baker=${esc(baker.id)}&amp;quote=1">Message this baker for a custom quote.</a></div>
    </div>
  </article>
  ${(viewer && viewer.customer) ? '' : bakerSignupModal(baker)}`;
  const desc = baker.bio || `${baker.businessName}, a verified local baker${baker.city ? ` in ${shortCity(baker.city)}` : ''} on Bkd Local.`;
  return layout({ title: `${baker.businessName} · Bkd Local`, description: desc, body, viewer });
}

// Shared AI FAQ chat widget markup. endpoint is the POST URL; pills are starter questions.
function faqWidget(endpoint, pills) {
  return `<div class="faq-widget" data-endpoint="${esc(endpoint)}">
    <div class="faq-thread" id="faqThread">
      <div class="faq-suggestions" id="faqSuggestions">
        ${pills.map(q => `<button type="button" class="faq-pill" data-q="${esc(q)}">${esc(q)}</button>`).join('')}
      </div>
    </div>
    <form class="faq-inputbar" id="faqForm">
      <input id="faqInput" type="text" placeholder="Ask a question..." autocomplete="off" aria-label="Ask a question">
      <button type="submit" class="faq-send" aria-label="Send">Send</button>
    </form>
  </div>`;
}

function renderFaqPage({ viewer }) {
  const body = `
  <section class="faq-page">
    <h1 class="faq-title">Ask us anything.</h1>
    <p class="faq-subtitle">Get instant answers about ordering from local bakers.</p>
    ${faqWidget('/api/faq/customer', ['How does ordering work?', 'When do I pick up my order?', 'What if something is wrong?'])}
  </section>
  <script src="/js/faq.js"></script>`;
  return layout({
    title: 'Ask us anything · Bkd Local',
    description: 'Get instant answers about ordering from local bakers on Bkd Local.',
    body, viewer
  });
}

function renderNotFound() {
  return layout({
    title: 'Not found · Bkd Local',
    description: '',
    body: `<section class="notfound">
      <h1>Baker not found</h1>
      <p>This baker isn't available right now.</p>
      <a class="btn btn-primary" href="/bakers">Browse all bakers</a>
    </section>`
  });
}

module.exports = { renderHome, renderDirectory, renderProfile, renderFaqPage, renderNotFound, esc, layout, minimumLabel, bakerCard };
