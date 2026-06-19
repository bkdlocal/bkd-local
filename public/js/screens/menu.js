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
          <div class="greeting-sub">Your product catalog</div>
          <div class="greeting-name">My Menu</div>
        </div>
        <button type="button" class="menu-add-btn" data-action="menu:add" aria-label="Add item">+</button>
      </div>

      <div class="scroll-content menu-scroll">
        ${items.length === 0 ? renderMenuEmpty() : items.map(renderMenuCard).join('')}

        ${items.length > 0 ? `
          <button type="button" class="menu-add-card" data-action="menu:add">
            <div class="menu-add-plus">+</div>
            <div class="menu-add-label">Add new item</div>
          </button>
        ` : ''}
      </div>

      ${renderBottomNav('menu')}
    </div>
  `;
}

function renderMenuCard(item) {
  const typeLabel = item.productType
    ? productTypeLabel(item.productType)
    : (item.category || 'Uncategorized');
  const priceLabel = Number(item.price) > 0
    ? `$${Number(item.price).toFixed(0)}`
    : '—';

  return `
    <div class="menu-card ${item.available ? '' : 'menu-card-unavailable'}">
      <button type="button" class="menu-card-main"
        data-action="menu:edit" data-id="${item.id}">
        <div class="menu-emoji">${item.emoji || '🧁'}</div>
        <div class="menu-card-body">
          <div class="menu-card-top">
            <div class="menu-name">${escapeMenuHtml(item.name)}</div>
            ${item.available ? '' : '<span class="menu-unavailable-chip">Hidden</span>'}
          </div>
          <div class="menu-type">${escapeMenuHtml(typeLabel)}</div>
          <div class="menu-price">${priceLabel}</div>
        </div>
      </button>
      <button type="button" class="menu-price-btn"
        data-action="menu:priceItem" data-id="${item.id}">
        Price this item
      </button>
    </div>
  `;
}

function renderMenuEmpty() {
  return `
    <div class="menu-empty">
      <div class="menu-empty-emoji">🍰</div>
      <div class="menu-empty-title">Build your menu</div>
      <div class="menu-empty-sub">Add the products you offer — sugar cookies, cakes, cupcakes, macarons, or drop cookies. Customers see what's on your menu when they browse.</div>
      <button type="button" class="menu-empty-cta" data-action="menu:add">+ Add your first item</button>
    </div>
  `;
}

function renderMenuError(message) {
  return `
    <div class="screen">
      ${renderStatusBar()}
      <div class="top-nav">
        <div>
          <div class="greeting-sub">Something went wrong</div>
          <div class="greeting-name">My Menu</div>
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
