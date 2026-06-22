function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function instagramUrl(handle) {
  if (!handle) return null;
  const h = String(handle).trim();
  if (/^https?:\/\//i.test(h)) return h;
  return `https://instagram.com/${h.replace(/^@/, '')}`;
}

function ratingBadge(rating) {
  if (rating == null) return '';
  return `<span class="rating">★ ${esc(rating.toFixed(1))}</span>`;
}

function avatar(baker, cls) {
  if (baker.photo) {
    return `<img class="${cls} avatar-img" src="${esc(baker.photo)}" alt="${esc(baker.businessName)}" loading="lazy">`;
  }
  const initial = (baker.businessName || '?').trim().charAt(0).toUpperCase();
  return `<div class="${cls} avatar-letter">${esc(initial)}</div>`;
}

function locationLine(baker) {
  const parts = [baker.neighborhood, baker.city].filter(Boolean);
  return parts.join(' · ');
}

function chips(items, cls) {
  if (!items || !items.length) return '';
  return `<div class="chips">${items.map(t => `<span class="chip ${cls || ''}">${esc(t)}</span>`).join('')}</div>`;
}

function layout({ title, description, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#FDF6F9">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description || '')}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description || '')}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/public.css">
</head>
<body>
<header class="site-header">
  <a class="brand" href="/">Bkd<span>Local</span></a>
  <nav class="site-nav">
    <a href="/bakers">Find a baker</a>
    <a class="nav-cta" href="/app">Baker login</a>
  </nav>
</header>
<main>${body}</main>
<footer class="site-footer">
  <div>© Bkd Local — local bakers, baked to order</div>
  <div class="footer-links"><a href="/bakers">Browse bakers</a> · <a href="/app">For bakers</a></div>
</footer>
</body>
</html>`;
}

function bakerCard(baker) {
  return `<a class="baker-card" href="/bakers/${esc(baker.id)}">
    ${avatar(baker, 'card-avatar')}
    <div class="card-body">
      <div class="card-top">
        <h3>${esc(baker.businessName)}</h3>
        ${ratingBadge(baker.rating)}
      </div>
      ${locationLine(baker) ? `<div class="card-location">${esc(locationLine(baker))}</div>` : ''}
      ${baker.bio ? `<p class="card-bio">${esc(baker.bio)}</p>` : ''}
      ${chips(baker.productTypes.slice(0, 4))}
    </div>
  </a>`;
}

function renderHome({ bakers }) {
  const featured = bakers.slice(0, 6);
  const body = `
  <section class="hero">
    <div class="hero-inner">
      <h1>Find a local baker for your next celebration</h1>
      <p>Cakes, cookies, macarons and more — made to order by independent bakers in your area.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="/bakers">Browse bakers</a>
        <a class="btn btn-ghost" href="/app">I'm a baker</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>Featured bakers</h2>
      <a class="see-all" href="/bakers">See all →</a>
    </div>
    ${featured.length
      ? `<div class="baker-grid">${featured.map(bakerCard).join('')}</div>`
      : `<p class="empty">No bakers are live just yet — check back soon.</p>`}
  </section>

  <section class="section how">
    <h2>How it works</h2>
    <div class="how-grid">
      <div class="how-step"><span class="how-num">1</span><h4>Browse</h4><p>Explore local bakers and their menus.</p></div>
      <div class="how-step"><span class="how-num">2</span><h4>Request</h4><p>Tell a baker what you need for your occasion.</p></div>
      <div class="how-step"><span class="how-num">3</span><h4>Pick up</h4><p>Grab your order fresh on pickup day.</p></div>
    </div>
  </section>`;
  return layout({
    title: 'Bkd Local — Find a local baker',
    description: 'Discover independent local bakers for cakes, cookies, macarons and more. Made to order in your area.',
    body
  });
}

function renderDirectory({ bakers, cities, types, filters, total }) {
  const cityOptions = ['<option value="">All cities</option>']
    .concat(cities.map(c => `<option value="${esc(c)}"${filters.city === c ? ' selected' : ''}>${esc(c)}</option>`))
    .join('');
  const typeOptions = ['<option value="">All treats</option>']
    .concat(types.map(t => `<option value="${esc(t)}"${filters.type === t ? ' selected' : ''}>${esc(t)}</option>`))
    .join('');
  const active = !!(filters.city || filters.type);
  const body = `
  <section class="dir-head">
    <h1>Find a baker</h1>
    <form class="filters" method="get" action="/bakers">
      <select name="city" onchange="this.form.submit()">${cityOptions}</select>
      <select name="type" onchange="this.form.submit()">${typeOptions}</select>
      ${active ? `<a class="clear-filters" href="/bakers">Clear</a>` : ''}
    </form>
    <div class="result-count">${bakers.length} of ${total} baker${total === 1 ? '' : 's'}</div>
  </section>
  <section class="section">
    ${bakers.length
      ? `<div class="baker-grid">${bakers.map(bakerCard).join('')}</div>`
      : `<p class="empty">No bakers match those filters. <a href="/bakers">Clear filters</a></p>`}
  </section>`;
  return layout({
    title: 'Find a baker — Bkd Local',
    description: 'Browse local bakers by city and treat type.',
    body
  });
}

function stars(rating) {
  const r = Math.round(Number(rating) || 0);
  return '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r);
}

function menuSection(menu) {
  if (!menu || !menu.length) return '';
  const cards = menu.map(m => `
    <div class="menu-item">
      ${m.coverPhoto
        ? `<img class="menu-photo" src="${esc(m.coverPhoto)}" alt="${esc(m.name)}" loading="lazy">`
        : `<div class="menu-photo menu-photo-empty">${esc(m.emoji || '🧁')}</div>`}
      <div class="menu-info">
        <div class="menu-top">
          <h4>${esc(m.name)}</h4>
          ${m.price != null ? `<span class="menu-price">$${esc(Number(m.price).toFixed(0))}</span>` : ''}
        </div>
        ${m.description ? `<p>${esc(m.description)}</p>` : ''}
      </div>
    </div>`).join('');
  return `<section class="profile-section"><h2>Menu</h2><div class="menu-list">${cards}</div></section>`;
}

function reviewsSection(reviews) {
  if (!reviews || !reviews.length) return '';
  const items = reviews.map(r => `
    <div class="review">
      <div class="review-head">
        <span class="review-name">${esc(r.reviewerName)}</span>
        <span class="review-stars">${stars(r.rating)}</span>
      </div>
      ${r.text ? `<p>${esc(r.text)}</p>` : ''}
    </div>`).join('');
  return `<section class="profile-section"><h2>Reviews</h2><div class="reviews">${items}</div></section>`;
}

function gallerySection(gallery) {
  if (!gallery || !gallery.length) return '';
  return `<section class="profile-section"><div class="gallery">${
    gallery.map(url => `<img src="${esc(url)}" alt="" loading="lazy">`).join('')
  }</div></section>`;
}

function renderProfile({ baker, menu, reviews }) {
  const ig = instagramUrl(baker.instagram);
  const body = `
  <nav class="crumbs"><a href="/bakers">← All bakers</a></nav>
  <section class="profile-header">
    ${avatar(baker, 'profile-avatar')}
    <div class="profile-meta">
      <h1>${esc(baker.businessName)}</h1>
      ${locationLine(baker) ? `<div class="profile-location">${esc(locationLine(baker))}</div>` : ''}
      <div class="profile-rating">${baker.rating != null ? `${stars(baker.rating)} <span>${esc(baker.rating.toFixed(1))}</span>` : ''}</div>
      ${chips(baker.specialtyTags, 'chip-tag')}
      ${ig ? `<a class="btn btn-primary profile-cta" href="${esc(ig)}" target="_blank" rel="noopener">Contact on Instagram</a>` : ''}
    </div>
  </section>
  ${baker.bio ? `<section class="profile-section"><h2>About</h2><p class="profile-bio">${esc(baker.bio)}</p></section>` : ''}
  ${baker.productTypes.length ? `<section class="profile-section"><h2>What I bake</h2>${chips(baker.productTypes)}</section>` : ''}
  ${gallerySection(baker.gallery)}
  ${menuSection(menu)}
  ${baker.pickupWindows ? `<section class="profile-section"><h2>Pickup</h2><p>${esc(baker.pickupWindows)}</p></section>` : ''}
  ${reviewsSection(reviews)}`;
  const desc = baker.bio || `${baker.businessName} — local baker${baker.city ? ` in ${baker.city}` : ''} on Bkd Local.`;
  return layout({
    title: `${baker.businessName} — Bkd Local`,
    description: desc,
    body
  });
}

function renderNotFound() {
  return layout({
    title: 'Not found — Bkd Local',
    description: '',
    body: `<section class="notfound">
      <h1>Baker not found</h1>
      <p>This baker isn't available right now.</p>
      <a class="btn btn-primary" href="/bakers">Browse all bakers</a>
    </section>`
  });
}

module.exports = { renderHome, renderDirectory, renderProfile, renderNotFound };
