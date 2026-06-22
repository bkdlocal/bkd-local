const REGION = 'West Tennessee';
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

function bakerCard(baker) {
  const taking = baker.acceptingOrders
    ? `<span class="taking"><span class="dot"></span>Taking orders</span>`
    : `<span class="taking taking-off">Currently paused</span>`;
  return `<a class="baker-card" href="/bakers/${esc(baker.id)}">
    ${cardPhoto(baker)}
    <div class="card-body">
      <h3>${esc(baker.businessName)}</h3>
      ${baker.bio ? `<p class="card-bio">${esc(baker.bio)}</p>` : ''}
      ${chips(baker.productTypes.slice(0, 3))}
      <div class="card-foot">
        ${taking}
        <span class="btn btn-primary btn-sm">View baker</span>
      </div>
    </div>
  </a>`;
}

function header() {
  return `<header class="site-header">
    <a class="brand" href="/">bkd<span>.local</span></a>
    <nav class="site-nav">
      <a href="/#how">How it works</a>
      <a href="/app">For bakers</a>
      <a class="nav-cta" href="/app">Are you a baker?</a>
    </nav>
  </header>`;
}

function footer() {
  return `<footer class="site-footer">
    <div>© Bkd Local · local bakers, baked to order</div>
    <div class="footer-links"><a href="/bakers">Browse bakers</a> · <a href="/app">For bakers</a></div>
  </footer>`;
}

// Date-first search. Date leads; the treat/name/occasion box is a secondary,
// combinable filter. Single vs range is a pure-CSS radio toggle (no JS).
function searchBlock(filters) {
  const f = filters || {};
  const isRange = f.mode === 'range';
  return `<form class="search-block" method="get" action="/bakers">
    <div class="search-prompt">When do you need your bakes?</div>
    <input class="mode-radio" type="radio" name="mode" id="mode-single" value="single"${isRange ? '' : ' checked'}>
    <input class="mode-radio" type="radio" name="mode" id="mode-range" value="range"${isRange ? ' checked' : ''}>
    <div class="mode-tabs">
      <label for="mode-single">Single date</label>
      <label for="mode-range">Date range</label>
    </div>
    <div class="date-fields">
      <div class="df-single">
        <input type="date" name="date" value="${esc(f.date || '')}" aria-label="Date you need your bakes">
      </div>
      <div class="df-range">
        <input type="date" name="from" value="${esc(f.from || '')}" aria-label="From date">
        <span class="to-sep">to</span>
        <input type="date" name="to" value="${esc(f.to || '')}" aria-label="To date">
      </div>
    </div>
    <div class="search-secondary">
      <span class="search-icon">${SEARCH_ICON}</span>
      <input type="search" name="q" value="${esc(f.q || '')}" placeholder="Filter by treat, baker name, or occasion (optional)" aria-label="Filter by treat, baker, or occasion">
      <button class="btn btn-primary" type="submit">Find bakers</button>
    </div>
  </form>`;
}

function hero(filters, { compact } = {}) {
  return `<section class="hero${compact ? ' hero-compact' : ''}">
    <div class="hero-inner">
      <div class="hero-eyebrow">${esc(REGION.toUpperCase())}</div>
      <h1>Find an artisan baker <span>near you</span></h1>
      <p class="hero-sub">Every baker is verified. Prices are upfront. Payment is protected.</p>
      ${searchBlock(filters)}
    </div>
  </section>`;
}

function layout({ title, description, body }) {
  return `<!DOCTYPE html>
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
<link rel="stylesheet" href="/css/public.css">
</head>
<body>
${header()}
<main>${body}</main>
${footer()}
</body>
</html>`;
}

function renderHome({ bakers }) {
  const featured = bakers.slice(0, 6);
  const body = `
  ${hero({})}
  <section class="section">
    <div class="section-head">
      <h2>Featured bakers</h2>
      <a class="see-all" href="/bakers">See all →</a>
    </div>
    ${featured.length
      ? `<div class="baker-grid">${featured.map(bakerCard).join('')}</div>`
      : `<p class="empty">No bakers are live just yet. Check back soon.</p>`}
  </section>
  <section class="section how" id="how">
    <h2>How it works</h2>
    <div class="how-grid">
      <div class="how-step"><span class="how-num">1</span><h4>Pick your date</h4><p>Tell us when you need your bakes.</p></div>
      <div class="how-step"><span class="how-num">2</span><h4>Browse who is free</h4><p>See verified bakers available then.</p></div>
      <div class="how-step"><span class="how-num">3</span><h4>Request and pick up</h4><p>Reserve your order and grab it fresh.</p></div>
    </div>
  </section>`;
  return layout({
    title: 'Find an artisan baker near you · Bkd Local',
    description: `Discover verified local bakers in ${REGION} available on your date. Cakes, cookies, macarons and more, made to order.`,
    body
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

function renderDirectory({ bakers, cities, types, filters, total }) {
  // Carry the active date + text query through every filter pill.
  const carry = { q: filters.q, mode: filters.mode, date: filters.date, from: filters.from, to: filters.to };
  const typePills = [pill('All treats', `/bakers${buildQuery({ ...carry })}`, !filters.type && !filters.city)]
    .concat(types.map(t => pill(t, `/bakers${buildQuery({ ...carry, type: t })}`, filters.type === t)))
    .concat(cities.map(c => pill(shortCity(c), `/bakers${buildQuery({ ...carry, city: c })}`, filters.city === c)))
    .join('');

  const dl = dateLabel(filters);
  const countSuffix = dl ? `available ${esc(dl)}` : `in ${esc(REGION)}`;

  let emptyMsg;
  if (dl) {
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
      ? `<div class="baker-grid">${bakers.map(bakerCard).join('')}</div>`
      : `<p class="empty">${emptyMsg}</p>`}
  </section>`;
  return layout({
    title: 'Find a baker · Bkd Local',
    description: `Browse verified local bakers in ${REGION} by date, treat and city.`,
    body
  });
}

function menuSection(menu, bakerId) {
  if (!menu || !menu.length) return '';
  const rows = menu.map(m => `
    <div class="menu-row">
      <div class="menu-text">
        <div class="menu-name">${esc(m.name)}</div>
        ${m.description ? `<div class="menu-sub">${esc(m.description)}</div>` : ''}
      </div>
      <div class="menu-right">
        ${m.price != null ? `<div class="menu-price">$${esc(Number(m.price).toFixed(0))}</div>` : ''}
        ${m.id ? `<a class="menu-request" href="/order/new?baker=${esc(bakerId)}&amp;item=${esc(m.id)}">Request</a>` : ''}
      </div>
    </div>`).join('');
  return `<section class="profile-section"><div class="section-label">Menu</div><div class="menu-rows">${rows}</div></section>`;
}

function portfolioSection(gallery) {
  const tiles = [];
  for (let i = 0; i < 4; i++) {
    const url = gallery && gallery[i];
    tiles.push(url
      ? `<div class="portfolio-tile" style="background-image:url('${esc(url)}')"></div>`
      : `<div class="portfolio-tile portfolio-empty"></div>`);
  }
  return `<section class="profile-section"><div class="section-label">Portfolio</div><div class="portfolio">${tiles.join('')}</div></section>`;
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

function renderProfile({ baker, menu, reviews }) {
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
    <div class="profile-banner${baker.photo ? '' : ' profile-banner-empty'}"${bannerStyle}>${baker.photo ? '' : '<span class="banner-emoji">🍪</span>'}</div>
    <div class="profile-head">
      <div class="profile-headline">
        <h1>${esc(baker.businessName)}</h1>
        <div class="profile-badges">${badges(baker)}</div>
      </div>
      <div class="profile-location">📍 ${esc(loc)}</div>
      ${baker.bio ? `<p class="profile-bio">${esc(baker.bio)}</p>` : ''}
      ${menuSection(menu, baker.id)}
      ${portfolioSection(baker.gallery)}
      ${reviewsSection(reviews)}
      <div class="profile-actions">
        <a class="btn btn-primary btn-block" href="${requestHref}"${requestExternal ? ' target="_blank" rel="noopener"' : ''}>Request an order</a>
        <a class="btn btn-outline" href="/customer/messages?baker=${esc(baker.id)}">Message</a>
      </div>
      <div class="custom-quote">Want something more intricate? <a href="/customer/messages?baker=${esc(baker.id)}&amp;quote=1">Message this baker for a custom quote.</a></div>
    </div>
  </article>`;
  const desc = baker.bio || `${baker.businessName}, a verified local baker${baker.city ? ` in ${shortCity(baker.city)}` : ''} on Bkd Local.`;
  return layout({ title: `${baker.businessName} · Bkd Local`, description: desc, body });
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

module.exports = { renderHome, renderDirectory, renderProfile, renderNotFound, esc, layout };
