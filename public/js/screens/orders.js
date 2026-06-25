async function renderOrders(state = {}) {
  const filter = state.filter || 'all';
  const orders = await Api.getOrders();

  const counts = {
    all: orders.length,
    new: orders.filter(o => o.status === 'new').length,
    in_progress: orders.filter(o => o.status === 'in_progress').length,
    complete: orders.filter(o => o.status === 'complete').length
  };

  const visible = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const groups = {
    new:         visible.filter(o => o.status === 'new'),
    in_progress: visible.filter(o => o.status === 'in_progress'),
    complete:    visible.filter(o => o.status === 'complete')
  };

  const pills = [
    { value: 'all',         label: `All (${counts.all})` },
    { value: 'new',         label: `New (${counts.new})` },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'complete',    label: 'Completed' }
  ];

  return `
    <div class="screen">
      ${renderLogoBar()}

      <div class="top-nav">
        <div>
          <div class="greeting-sub">${counts.new} need attention</div>
          <div class="greeting-name">Orders</div>
        </div>
      </div>

      <div class="scroll-content">
        <div class="filter-pills">
          ${pills.map(p => `
            <button
              type="button"
              class="pill ${p.value === filter ? 'pill-active' : 'pill-inactive'}"
              data-action="orders:filter"
              data-value="${p.value}"
            >${p.label}</button>
          `).join('')}
        </div>

        ${groups.new.length ? `
          <div class="sub-label">New · Needs Response</div>
          ${groups.new.map(renderNewOrderCard).join('')}
        ` : ''}

        ${groups.in_progress.length ? `
          <div class="sub-label">In Progress</div>
          ${groups.in_progress.map(renderProgressRow).join('')}
        ` : ''}

        ${groups.complete.length ? `
          <div class="sub-label">Completed</div>
          ${groups.complete.map(renderCompleteRow).join('')}
        ` : ''}

        ${visible.length === 0 ? renderEmpty(filter) : ''}
      </div>

      ${renderBottomNav('orders')}
    </div>
  `;
}

function renderNewOrderCard(o) {
  return `
    <div class="order-card-full" data-action="order:open" data-id="${o.id}">
      <div class="order-full-top">
        <div class="mini-avatar" style="background: ${avatarGradient(o.customerName)};">${initials(o.customerName)}</div>
        <div style="flex:1; min-width: 0;">
          <div class="order-name">${o.customerName}</div>
          <div class="order-detail">Requested ${formatDate(o.requestedDate, 'short') || ''}</div>
        </div>
        <div class="order-amount">${formatMoney(o.amount)}</div>
      </div>
      <div class="order-detail-box">
        <div class="order-detail-title">${o.item}</div>
        <div class="order-detail-sub">Pickup: ${formatDate(o.pickupDate, 'long') || ''}${o.notes ? ` · ${o.notes}` : ''}</div>
      </div>
      <div class="action-row">
        <button class="btn-decline" type="button" data-action="order:decline" data-id="${o.id}">Decline</button>
        <button class="btn-accept"  type="button" data-action="order:accept"  data-id="${o.id}">Accept Order</button>
      </div>
    </div>
  `;
}

function renderProgressRow(o) {
  return `
    <div class="order-card" data-action="order:open" data-id="${o.id}">
      <div class="order-dot dot-progress"></div>
      <div class="order-info">
        <div class="order-name">${o.customerName}</div>
        <div class="order-detail">${o.item} · Pickup ${formatDate(o.pickupDate, 'short') || ''}</div>
      </div>
      <div class="order-amount">${formatMoney(o.amount)}</div>
    </div>
  `;
}

function renderCompleteRow(o) {
  return `
    <div class="order-card" data-action="order:open" data-id="${o.id}">
      <div class="order-dot dot-done"></div>
      <div class="order-info">
        <div class="order-name">${o.customerName}</div>
        <div class="order-detail">${o.item} · ${formatDate(o.completedDate, 'short') || ''} · Picked up</div>
      </div>
      <div class="order-amount done">${formatMoney(o.amount)}</div>
    </div>
  `;
}

function renderEmpty(filter) {
  const label = filter === 'all' ? 'orders' : filter.replace('_', ' ') + ' orders';
  return `
    <div style="text-align:center;padding:48px 16px;color:var(--mauve);font-size:13px;">
      No ${label} yet.
    </div>
  `;
}
