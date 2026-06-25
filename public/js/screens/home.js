async function renderHome() {
  const [baker, stats, earnings, orders, menuItems] = await Promise.all([
    Api.getBaker(),
    Api.getDashboardStats(),
    Api.getMonthlyEarnings(),
    Api.getRecentOrders(),
    Api.getMenu().catch(() => [])
  ]);

  const net = computeNet(earnings.gross, baker.feeRate);
  // Canonical public profile link bakers paste into their Instagram bio or send
  // to customers — always the production URL. The ?ref param (baker email,
  // encoded) lets us attribute customer signups back to this baker.
  const shareUrl = 'https://bkd-local-production.up.railway.app/bakers/' + baker.id +
    (baker.email ? '?ref=' + encodeURIComponent(baker.email) : '');

  return `
    <div class="screen">
      ${renderLogoBar()}

      <div class="scroll-content home-scroll">
        <section class="dash-hero">
          <div class="dash-eyebrow">Your bakery dashboard</div>
          <h1 class="dash-greeting">${getGreeting()}, <span class="dash-name">${baker.firstName}</span>.</h1>
          <p class="dash-subtitle">Here's how your bakery is doing this month.</p>

          <div class="dash-stats">
            <div class="dash-stat">
              <div class="dash-stat-value">${formatMoney(earnings.gross)}</div>
              <div class="dash-stat-label">${earnings.period} earnings</div>
            </div>
            <div class="dash-stat">
              <div class="dash-stat-value">${net != null ? formatMoney(net, { decimals: 2 }) : '—'}</div>
              <div class="dash-stat-label">In your pocket</div>
            </div>
            <div class="dash-stat">
              <div class="dash-stat-value">${earnings.count}</div>
              <div class="dash-stat-label">Orders placed</div>
            </div>
          </div>
        </section>

        <button type="button" class="share-profile-btn" data-action="home:shareProfile" data-value="${shareUrl}">
          <i class="ti ti-link" aria-hidden="true"></i> Share my profile
        </button>

        <div class="dash-grid">
          <button class="dash-card" type="button" data-screen="orders">
            <div class="dash-card-icon"><i class="ti ti-package" aria-hidden="true"></i></div>
            <div class="dash-card-title">Orders</div>
            <div class="dash-card-sub">${stats.newOrders} new</div>
          </button>
          <button class="dash-card" type="button" data-screen="availability">
            <div class="dash-card-icon"><i class="ti ti-calendar" aria-hidden="true"></i></div>
            <div class="dash-card-title">Availability</div>
            <div class="dash-card-sub">Set pickup dates</div>
          </button>
          <button class="dash-card" type="button" data-screen="menu">
            <div class="dash-card-icon"><i class="ti ti-clipboard-list" aria-hidden="true"></i></div>
            <div class="dash-card-title">My menu</div>
            <div class="dash-card-sub">${menuItems.length} item${menuItems.length === 1 ? '' : 's'}</div>
          </button>
          <button class="dash-card" type="button" data-screen="reviews">
            <div class="dash-card-icon"><i class="ti ti-star" aria-hidden="true"></i></div>
            <div class="dash-card-title">My reviews</div>
            <div class="dash-card-sub">${stats.reviewCount} review${stats.reviewCount === 1 ? '' : 's'}</div>
          </button>
        </div>

        <button type="button" class="dash-magic" data-screen="priceMyBakes">
          <span class="dash-magic-spark dash-magic-spark-1" aria-hidden="true">✦</span>
          <span class="dash-magic-spark dash-magic-spark-2" aria-hidden="true">✦</span>
          <span class="dash-magic-free">FREE</span>
          <span class="dash-magic-icon"><i class="ti ti-calculator" aria-hidden="true"></i></span>
          <span class="dash-magic-text">
            <span class="dash-magic-title">Magic Pricing Calculator</span>
            <span class="dash-magic-sub">Find out what you're really making</span>
          </span>
        </button>

        <button type="button" class="dash-faq-link" data-screen="faq">
          <i class="ti ti-help-circle" aria-hidden="true"></i> Baker FAQ
        </button>

        <div class="section-header">
          <div class="section-title-sm">Recent orders</div>
          <div class="section-link" data-screen="orders">See all</div>
        </div>
        ${orders.map(o => `
          <div class="order-card" data-screen="orders">
            <div class="order-dot ${o.status === 'new' ? 'dot-new' : 'dot-done'}"></div>
            <div class="order-info">
              <div class="order-name">${o.customerName}</div>
              <div class="order-detail">${o.item} · ${o.pickupDate}${o.reviewRating ? ` · ${o.reviewRating}<i class="ti ti-star order-detail-star" aria-hidden="true"></i>` : ''}</div>
            </div>
            <div class="order-amount ${o.status === 'complete' ? 'done' : ''}">${formatMoney(o.amount)}</div>
          </div>
        `).join('')}
      </div>

      ${renderBottomNav('home')}
    </div>
  `;
}
