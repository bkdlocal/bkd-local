async function renderMenu() {
  let items;
  try {
    items = await Api.getMenu();
  } catch (e) {
    return renderMenuError(e.message);
  }

  return `
    <div class="screen">
      ${renderStatusBar()}

      <div class="menu-header">
        <div>
          <div class="greeting-sub">What you offer</div>
          <div class="greeting-name">Menu &amp; Pricing</div>
        </div>
        <button type="button" class="menu-add-btn" data-action="menu:add" aria-label="Add new item">+</button>
      </div>

      <div class="scroll-content">
        <div class="info-banner">
          <span class="info-banner-icon">💡</span>
          <span class="info-banner-text">Add your recipe to each item and we'll calculate your real profit per order automatically.</span>
        </div>

        ${items.map(renderMenuCard).join('')}

        <button type="button" class="menu-add-card" data-action="menu:add">
          <div class="menu-add-plus">+</div>
          <div class="menu-add-label">Add new item</div>
        </button>
      </div>

      ${renderBottomNav('menu')}
    </div>
  `;
}

function renderMenuCard(item) {
  const profit = item.recipeCost != null ? item.price - item.recipeCost : null;
  const margin = (profit != null && item.price > 0) ? Math.round((profit / item.price) * 100) : null;

  const secondaryLine = profit != null
    ? `<div class="menu-profit">$${profit.toFixed(2)} profit · ${margin}% margin</div>`
    : `<div class="menu-recipe-needed">Recipe needed — tap to add</div>`;

  return `
    <button
      type="button"
      class="menu-card ${item.available ? '' : 'menu-card-unavailable'}"
      data-action="menu:open"
      data-id="${item.id}"
    >
      <div class="menu-emoji">${item.emoji || '🧁'}</div>
      <div class="menu-card-body">
        <div class="menu-card-top">
          <div class="menu-name">${escapeMenuHtml(item.name)}</div>
          ${item.available ? '' : '<span class="menu-unavailable-chip">Hidden</span>'}
        </div>
        <div class="menu-price">$${Number(item.price).toFixed(0)} per order</div>
        ${secondaryLine}
      </div>
    </button>
  `;
}

function renderMenuError(message) {
  return `
    <div class="screen">
      ${renderStatusBar()}
      <div class="top-nav">
        <div>
          <div class="greeting-sub">Something went wrong</div>
          <div class="greeting-name">Menu &amp; Pricing</div>
        </div>
      </div>
      <div class="scroll-content" style="display:flex;align-items:center;justify-content:center;text-align:center;padding:48px 16px;">
        <div style="color:var(--mauve);font-size:13px;line-height:1.6;">${escapeMenuHtml(message)}</div>
      </div>
      ${renderBottomNav('menu')}
    </div>
  `;
}

function escapeMenuHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
