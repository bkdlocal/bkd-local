async function renderHome() {
  const [baker, stats, earnings, orders, menuItems] = await Promise.all([
    Api.getBaker(),
    Api.getDashboardStats(),
    Api.getMonthlyEarnings(),
    Api.getRecentOrders(),
    Api.getMenu().catch(() => [])
  ]);

  const net = computeNet(earnings.gross, baker.feeRate);

  return `
    <div class="screen">
      ${renderStatusBar()}

      <div class="top-nav">
        <div>
          <div class="greeting-sub">${getGreeting()}</div>
          <div class="greeting-name">${baker.firstName} ✨</div>
        </div>
        <div class="avatar">${baker.avatarLetter}</div>
      </div>

      <div class="scroll-content">
        <div class="stats-row">
          <div class="stat-card accent">
            <div class="stat-value">${stats.newOrders}</div>
            <div class="stat-label">New Orders</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.completed}</div>
            <div class="stat-label">Completed</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.rating != null ? `${stats.rating} ⭐` : '—'}</div>
            <div class="stat-label">Rating</div>
          </div>
        </div>

        <div class="earnings-banner">
          <div class="earnings-emoji">💰</div>
          <div style="flex:1;">
            <div class="earnings-main">${earnings.period} earnings</div>
            <div class="earnings-row">
              <div>
                <div class="earnings-gross">${formatMoney(earnings.gross)}</div>
                <div class="earnings-sub-label">Total orders</div>
              </div>
              <div class="earnings-divider"></div>
              <div>
                <div class="earnings-net">${net != null ? formatMoney(net, { decimals: 2 }) : '—'}</div>
                <div class="earnings-sub-label">In your pocket</div>
              </div>
            </div>
          </div>
        </div>

        <div class="section-header" style="margin-top:4px;">
          <div class="section-title-sm">Your Bakery</div>
        </div>
        <div class="quick-grid">
          <button class="quick-card" type="button" data-screen="profile">
            <div class="quick-icon qi-pink">🧁</div>
            <div>
              <div class="quick-card-label">My Profile</div>
              <div class="quick-card-sub">Edit & preview</div>
            </div>
          </button>
          <button class="quick-card" type="button" data-screen="availability">
            <div class="quick-icon qi-lav">📅</div>
            <div>
              <div class="quick-card-label">Availability</div>
              <div class="quick-card-sub">Set pickup dates</div>
            </div>
          </button>
          <button class="quick-card" type="button" data-screen="menu">
            <div class="quick-icon qi-plum">🍽️</div>
            <div>
              <div class="quick-card-label">My Menu</div>
              <div class="quick-card-sub">${menuItems.length} item${menuItems.length === 1 ? '' : 's'}</div>
            </div>
          </button>
          <button class="quick-card" type="button" data-screen="reviews">
            <div class="quick-icon qi-rose">⭐</div>
            <div>
              <div class="quick-card-label">My Reviews</div>
              <div class="quick-card-sub">${stats.reviewCount} review${stats.reviewCount === 1 ? '' : 's'}</div>
            </div>
          </button>
        </div>

        <div class="section-header">
          <div class="section-title-sm">Recent Orders</div>
          <div class="section-link" data-screen="orders">See all</div>
        </div>
        ${orders.map(o => `
          <div class="order-card" data-screen="orders">
            <div class="order-dot ${o.status === 'new' ? 'dot-new' : 'dot-done'}"></div>
            <div class="order-info">
              <div class="order-name">${o.customerName}</div>
              <div class="order-detail">${o.item} · ${o.pickupDate}</div>
            </div>
            <div class="order-amount ${o.status === 'complete' ? 'done' : ''}">${formatMoney(o.amount)}</div>
          </div>
        `).join('')}
      </div>

      ${renderBottomNav('home')}
    </div>
  `;
}
