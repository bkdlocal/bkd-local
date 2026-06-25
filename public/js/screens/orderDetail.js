async function renderOrderDetail(state = {}) {
  const orderId = state.orderId;
  if (!orderId) return renderDetailError('No order selected.');

  let order, baker;
  try {
    [order, baker] = await Promise.all([Api.getOrder(orderId), Api.getBaker()]);
  } catch (e) {
    return renderDetailError(e.message);
  }

  const net = computeNet(order.amount, baker.feeRate);
  const feePct = baker.feeRate != null
    ? `${(baker.feeRate * 100).toFixed(1).replace(/\.0$/, '')}%`
    : null;
  const firstName = order.customerName.split(' ')[0];

  return `
    <div class="screen">
      ${renderLogoBar()}

      <div class="detail-header">
        <button class="detail-back" type="button" data-action="nav:back" aria-label="Back">‹</button>
        <div class="detail-title-block">
          <div class="detail-title-sub">${statusLabel(order.status)}</div>
          <div class="detail-title">Order Detail</div>
        </div>
      </div>

      <div class="scroll-content">
        <div class="detail-hero">
          <div class="detail-hero-top">
            <div class="detail-hero-avatar" style="background: ${avatarGradient(order.customerName)};">${initials(order.customerName)}</div>
            <div style="flex:1; min-width:0;">
              <div class="detail-hero-name">${order.customerName}</div>
              ${order.customerCity ? `<div class="detail-hero-city">${order.customerCity}</div>` : ''}
            </div>
            ${renderPaymentChip(order)}
          </div>
          <div class="detail-money-row">
            <div class="detail-money-block">
              <div class="detail-money-label">Order total</div>
              <div class="detail-money-value">${formatMoney(order.amount)}</div>
            </div>
            <div class="detail-money-block">
              <div class="detail-money-label">${feePct ? `In your pocket (after ${feePct} fee)` : 'In your pocket'}</div>
              <div class="detail-money-value net">${net != null ? formatMoney(net, { decimals: 2 }) : '—'}</div>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">What was ordered</div>
          ${detailField('Item', order.item)}
          ${detailField('Customization', order.notes)}
          ${detailField('Special instructions', order.specialInstructions)}
          ${detailField('Allergens', order.allergens)}
          ${detailField(
            order.status === 'complete' ? 'Picked up' : 'Requested pickup',
            formatDate(order.status === 'complete' ? (order.completedDate || order.pickupDate) : order.pickupDate, 'long')
          )}
          ${order.status === 'new' ? detailField('Requested on', formatDate(order.requestedDate, 'long')) : ''}
        </div>

        ${order.customerEmail || order.customerPhone ? `
          <div class="detail-section">
            <div class="detail-section-title">Customer contact</div>
            ${detailField('Phone', order.customerPhone)}
            ${detailField('Email', order.customerEmail)}
          </div>
        ` : ''}

        ${order.status === 'in_progress' ? `
          <div class="detail-section">
            <div class="detail-section-title">Your pickup location</div>
            <div class="detail-field-value ${baker.pickupLocation ? '' : 'muted'}">
              ${baker.pickupLocation || 'Set your pickup location in your profile.'}
            </div>
            ${order.readyAt ? `
              <div style="margin-top:10px;">
                <span class="status-chip ready">Ready for pickup</span>
              </div>
            ` : ''}
          </div>
        ` : ''}

        ${order.status === 'complete' ? renderReviewSection(order) : ''}
      </div>

      ${renderDetailActions(order, firstName)}
    </div>
  `;
}

function detailField(label, value) {
  if (value == null || value === '') return '';
  return `
    <div class="detail-field">
      <div class="detail-field-label">${label}</div>
      <div class="detail-field-value">${value}</div>
    </div>
  `;
}

function statusLabel(status) {
  return ({
    new: 'New · Needs Response',
    in_progress: 'Accepted',
    complete: 'Completed'
  })[status] || 'Order';
}

function renderPaymentChip(order) {
  if (order.status === 'new') {
    return `<span class="status-chip pending">Awaiting payment</span>`;
  }
  if (order.paymentStatus === 'paid') {
    return `<span class="status-chip paid">Payment confirmed</span>`;
  }
  return `<span class="status-chip pending">Payment pending</span>`;
}

function renderReviewSection(order) {
  if (order.review && order.reviewRating) {
    return `
      <div class="detail-section">
        <div class="detail-section-title">Review</div>
        <div class="review-stars-inline">${'★'.repeat(order.reviewRating)}</div>
        <div class="review-text-inline">"${order.review}"</div>
      </div>
    `;
  }
  return `
    <div class="detail-section">
      <div class="detail-section-title">Review</div>
      <div class="detail-field-value muted">
        ${order.reviewRequestedAt
          ? `Review requested ${formatDate(order.reviewRequestedAt, 'long')}. Waiting on customer.`
          : 'Review will be requested 24 hours after pickup.'}
      </div>
    </div>
  `;
}

function renderDetailActions(order, firstName) {
  if (order.status === 'new') {
    return `
      <div class="detail-actions">
        <button class="btn-decline-lg" type="button" data-action="order:decline" data-id="${order.id}">Decline</button>
        <button class="btn-accept-lg"  type="button" data-action="order:accept"  data-id="${order.id}">Accept Order</button>
      </div>
    `;
  }
  if (order.status === 'in_progress') {
    return `
      <div class="detail-actions">
        <button class="btn-secondary" type="button" data-action="messages:open" data-id="${order.id}">Message ${firstName}</button>
        <button class="btn-primary" type="button" data-action="order:markReady" data-id="${order.id}">
          ${order.readyAt ? 'Ready ✓' : 'Mark Ready'}
        </button>
      </div>
    `;
  }
  if (order.status === 'complete') {
    return `
      <div class="detail-actions">
        <button class="btn-primary" type="button" data-action="messages:open" data-id="${order.id}">Message ${firstName}</button>
      </div>
    `;
  }
  return '';
}

function renderDetailError(message) {
  return `
    <div class="screen">
      ${renderLogoBar()}
      <div class="detail-header">
        <button class="detail-back" type="button" data-action="nav:back" aria-label="Back">‹</button>
        <div class="detail-title-block">
          <div class="detail-title-sub">Error</div>
          <div class="detail-title">Order not available</div>
        </div>
      </div>
      <div class="scroll-content" style="display:flex;align-items:center;justify-content:center;text-align:center;padding:0 24px;">
        <div style="color:var(--mauve);font-size:13px;line-height:1.6;">${message}</div>
      </div>
    </div>
  `;
}
