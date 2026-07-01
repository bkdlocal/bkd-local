const { esc, layout, bakerCard } = require('./public-site');
const ratings = require('./ratings');

const OCCASION_CHOICES = ['Birthday', 'Wedding', 'Baby Shower', 'Holiday', 'Corporate', 'Graduation', 'Just Because', 'Other'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function fmtDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
function money(n) { return n == null ? '' : '$' + Number(n).toFixed(2); }
function starsRow(n) {
  const r = Math.round(Number(n) || 0);
  return '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r);
}

function custTabs(active) {
  const tab = (key, href, label) => `<a class="${active === key ? 'active' : ''}" href="${href}">${label}</a>`;
  return `<nav class="cust-tabs">${tab('profile', '/customer/profile', 'Profile')}${tab('orders', '/customer/orders', 'Orders')}${tab('messages', '/customer/messages', 'Messages')}</nav>`;
}

function jsonData(id, obj) {
  return `<script id="${id}" type="application/json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

// "New" and "Pending" are the same entry state until a Pending option is added
// to the Orders.Order Status field in Airtable.
function normalizeStatus(s) {
  const v = String(s || '').trim();
  if (v === 'New' || v === 'Pending' || v === '') return 'Pending';
  return v;
}

function statusInfo(rawStatus) {
  const s = normalizeStatus(rawStatus);
  switch (s) {
    case 'Confirmed': return { key: 'confirmed', label: 'Confirmed', message: 'Baker confirmed your order. Pickup details below.' };
    case 'Fulfilled': return { key: 'fulfilled', label: 'Fulfilled', message: 'Order complete. Rate your baker below.' };
    case 'Disputed': return { key: 'disputed', label: 'Disputed', message: 'You have an open dispute. We will review within 48 hours.' };
    case 'Cancelled': return { key: 'cancelled', label: 'Cancelled', message: 'This order was cancelled.' };
    default: return { key: 'pending', label: 'Pending', message: 'Your request was sent. Waiting for baker to confirm.' };
  }
}

// Pickup address stays private until the baker confirms.
function addressVisible(rawStatus) {
  const s = normalizeStatus(rawStatus);
  return s === 'Confirmed' || s === 'Fulfilled';
}

function statusBadge(rawStatus) {
  const info = statusInfo(rawStatus);
  return `<span class="status-badge status-${info.key}">${esc(info.label)}</span>`;
}

// ── 6.8 Customer Profile ─────────────────────────────────────────────────────

function avatarBlock(customer) {
  const inner = customer.profilePhotoUrl
    ? `<img src="${esc(customer.profilePhotoUrl)}" alt="Your photo">`
    : `<span class="avatar-placeholder"><i class="ti ti-user" aria-hidden="true"></i></span>`;
  return `<div class="cust-avatar" id="avatar">
      ${inner}
      <span class="avatar-edit">Edit</span>
      <input type="file" id="avatarInput" accept="image/*" hidden>
    </div>`;
}

function occasionChips(selected) {
  const set = new Set(selected || []);
  return OCCASION_CHOICES.map(c =>
    `<label class="tag-chip${set.has(c) ? ' on' : ''}"><input type="checkbox" name="occasion" value="${esc(c)}"${set.has(c) ? ' checked' : ''}>${esc(c)}</label>`
  ).join('');
}

function compactOrderCard(o) {
  return `<a class="mini-order" href="/customer/orders/${esc(o.id)}">
      <div class="mini-order-main">
        <div class="mini-order-name">${esc(o.bakerName)}</div>
        <div class="mini-order-sub">${esc(o.menuItem)}${o.pickupDate ? ' · ' + esc(fmtDate(o.pickupDate)) : ''}</div>
      </div>
      ${statusBadge(o.status)}
    </a>`;
}

function renderCustomerProfile({ customer, orders, favorites, viewer }) {
  const last3 = (orders || []).slice(0, 3);
  const count = Number(customer.ratingCount) || 0;
  const ratingBlock = count > 0
    ? `<div class="rating-display"><span class="rating-stars">${starsRow(customer.customerRating)}</span><span class="rating-num">${Number(customer.customerRating).toFixed(1)}</span><span class="rating-count">(${count})</span></div>`
    : `<div class="rating-empty">No ratings yet. After your first order, bakers can rate you.</div>`;

  const body = `
  <div class="cust-page">
    ${custTabs('profile')}

    <section class="profile-top">
      ${avatarBlock(customer)}
      <form id="profileForm" class="profile-fields">
        <div class="two-col">
          <div class="field"><label for="firstName">First name</label><input id="firstName" name="firstName" type="text" placeholder="First Name" value="${esc(customer.firstName || '')}"></div>
          <div class="field"><label for="lastName">Last name</label><input id="lastName" name="lastName" type="text" placeholder="Last Name" value="${esc(customer.lastName || '')}"></div>
        </div>
        <div class="field"><label for="city">City</label><input id="city" name="city" type="text" placeholder="City" value="${esc(customer.city || '')}"></div>
        <div class="two-col">
          <div class="field"><label for="state">State</label><input id="state" name="state" type="text" placeholder="State" value="${esc(customer.state || '')}"></div>
          <div class="field"><label for="zip">Zip code</label><input id="zip" name="zip" type="text" inputmode="numeric" placeholder="Zip code" value="${esc(customer.zipCode || '')}"></div>
        </div>
        <div class="field"><label>Email</label><div class="readonly">${esc(customer.email)}</div></div>
        <div class="field">
          <label>What I usually order for</label>
          <div class="tag-chips">${occasionChips(customer.occasionTags)}</div>
        </div>
        <button type="submit" class="btn btn-primary" id="saveProfile">Save changes</button>
        <span class="save-state" id="saveState" hidden>Saved</span>
      </form>
    </section>

    <section class="profile-section">
      <h2>Your baker rating</h2>
      ${ratingBlock}
      <p class="muted">Bakers can see this when they review your order requests. It is private and never shown on your public profile or the directory.</p>
    </section>

    <section class="profile-section" data-fav-list>
      <div class="section-head"><h2>Favorite bakers</h2></div>
      ${(favorites && favorites.length)
        ? `<div class="baker-grid">${favorites.map(b => bakerCard(b, viewer)).join('')}</div>`
        : '<p class="muted" data-fav-empty>You have not favorited any bakers yet. Tap the heart on any baker to save them here. <a href="/bakers">Browse bakers</a>.</p>'}
    </section>

    <section class="profile-section">
      <div class="section-head"><h2>Recent orders</h2>${(orders || []).length > 3 ? '<a class="see-all" href="/customer/orders">See all →</a>' : ''}</div>
      ${last3.length ? `<div class="mini-orders">${last3.map(compactOrderCard).join('')}</div>` : '<p class="muted">No orders yet. <a href="/bakers">Find a baker</a> to get started.</p>'}
    </section>
  </div>
  <script src="/js/customer-profile.js"></script>`;

  return layout({ title: 'Your profile · Bkd Local', description: '', body, viewer });
}

// ── 6.7 Past Orders ──────────────────────────────────────────────────────────

function orderRow(o) {
  const thumb = o.bakerPhoto
    ? `<span class="row-thumb" style="background-image:url('${esc(o.bakerPhoto)}')"></span>`
    : `<span class="row-thumb row-thumb-empty">🧁</span>`;
  const bakerHref = o.bakerId ? `/bakers/${esc(o.bakerId)}` : '#';
  return `<div class="order-row">
      <a class="order-main" href="${bakerHref}">
        ${thumb}
        <span class="order-info">
          <span class="order-baker">${esc(o.bakerName)}</span>
          <span class="order-item">${esc(o.menuItem)}</span>
          <span class="order-date">${o.pickupDate ? esc(fmtDate(o.pickupDate)) : ''}</span>
        </span>
      </a>
      <div class="order-side">
        ${statusBadge(o.status)}
        <span class="order-total">${money(o.orderTotal)}</span>
        <a class="order-details-link" href="/customer/orders/${esc(o.id)}">View order details</a>
      </div>
    </div>`;
}

function renderPastOrders({ orders, viewer }) {
  const body = `
  <div class="cust-page">
    ${custTabs('orders')}
    <h1>Your orders</h1>
    ${(orders || []).length
      ? `<div class="order-list">${orders.map(orderRow).join('')}</div>`
      : '<p class="muted">No orders yet. <a href="/bakers">Find a baker</a> to place your first request.</p>'}
  </div>`;
  return layout({ title: 'Your orders · Bkd Local', description: '', body, viewer });
}

// ── 6.6 Order Status ─────────────────────────────────────────────────────────

function timeline(rawStatus) {
  const s = normalizeStatus(rawStatus);
  if (s === 'Cancelled' || s === 'Disputed') return '';
  const order = ['Pending', 'Confirmed', 'Fulfilled'];
  const labels = { Pending: 'Request sent', Confirmed: 'Confirmed', Fulfilled: 'Complete' };
  const idx = order.indexOf(s);
  return `<div class="timeline">${order.map((step, i) =>
    `<div class="tl-step${i <= idx ? ' done' : ''}${i === idx ? ' current' : ''}">
       <span class="tl-dot"></span><span class="tl-label">${labels[step]}</span>
     </div>`).join('')}</div>`;
}

function receiptBlock(o) {
  const addOns = (o.addOns || []).filter(a => (a.qty || 0) > 0).map(a =>
    `<div class="sum-row"><span>${esc(a.name)}${a.unit === 'per_cookie' ? ' × ' + a.qty : ''}</span><span>${money(a.unit === 'per_cookie' ? a.qty * a.price : a.price)}</span></div>`
  ).join('');
  return `<div class="summary">
      <div class="sum-row"><span>${esc(o.menuItem)}</span><span>${money(o.itemSubtotal)}</span></div>
      ${addOns}
      <div class="sum-divider"></div>
      <div class="sum-row"><span>Subtotal</span><span>${money(o.itemSubtotal)}</span></div>
      <div class="sum-row"><span>Service fee</span><span>${money(o.serviceFee)}</span></div>
      <div class="sum-total"><div class="sum-row"><span>Total</span><span>${money(o.orderTotal)}</span></div></div>
    </div>`;
}

function ratingPrompt(o) {
  if (o.ratingLeftByCustomer) {
    return `<section class="profile-section"><h2>Your rating</h2>
      <div class="rating-display"><span class="rating-stars">${starsRow(o.customerRatingOfBaker)}</span></div>
      ${o.customerReviewText ? `<p class="review-own">${esc(o.customerReviewText)}</p>` : ''}
      <p class="muted">Thanks for rating. Ratings cannot be changed once submitted.</p></section>`;
  }
  if (!ratings.ratingWindowOpen(o.status, o.pickupDate)) {
    return `<section class="profile-section"><h2>Rate your baker</h2>
      <p class="muted">The rating window for this order has closed.</p></section>`;
  }
  return `<section class="profile-section" id="ratePrompt"><h2>Rate your baker</h2>
    <p class="muted">How was your order? You can only rate once, so make it count.</p>
    <div class="star-input" id="starInput" data-order="${esc(o.id)}">
      ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="star" data-val="${n}" aria-label="${n} stars">☆</button>`).join('')}
    </div>
    <textarea id="reviewText" rows="3" maxlength="2000" placeholder="Add a few words about your order (optional)"></textarea>
    <button type="button" class="btn btn-primary" id="submitRating" disabled>Submit rating</button>
    <p class="form-error" id="rateError" hidden></p>
  </section>`;
}

function renderOrderStatus({ order, baker, viewer }) {
  const info = statusInfo(order.status);
  const showAddress = addressVisible(order.status);
  const pickup = showAddress
    ? `<section class="profile-section"><h2>Pickup details</h2>
        ${order.pickupDate ? `<p><strong>Date:</strong> ${esc(fmtDate(order.pickupDate))}</p>` : ''}
        <p><strong>Address:</strong> ${esc((baker && baker.pickupAddress) || 'Ask your baker for the exact spot.')}</p></section>`
    : `<section class="profile-section"><h2>Pickup details</h2>
        <p class="muted">The pickup address will appear here once ${esc((baker && baker.businessName) || 'your baker')} confirms your order.</p></section>`;

  const body = `
  <div class="cust-page order-status-page">
    <nav class="crumbs"><a href="/customer/orders">← Your orders</a></nav>
    <h1>${esc(order.menuItem)}</h1>
    <div class="muted from-baker">from ${esc(order.bakerName)}</div>

    <div class="status-banner status-${info.key}">${esc(info.message)}</div>
    ${timeline(order.status)}

    ${pickup}

    <section class="profile-section"><h2>Order summary</h2>${receiptBlock(order)}</section>

    ${normalizeStatus(order.status) === 'Fulfilled' ? ratingPrompt(order) : ''}

    <div class="status-actions">
      <a class="btn btn-outline" href="/customer/orders">Back to orders</a>
      ${baker && baker.id ? `<a class="btn btn-primary" href="/bakers/${esc(baker.id)}">Order again</a>` : ''}
    </div>
  </div>
  <script src="/js/order-status.js"></script>`;

  return layout({ title: `${order.menuItem} · Bkd Local`, description: '', body, viewer });
}

// ── 6.5 Messaging ────────────────────────────────────────────────────────────

function threadThumb(name, photo) {
  return photo
    ? `<span class="thread-thumb" style="background-image:url('${esc(photo)}')"></span>`
    : `<span class="thread-thumb thread-thumb-empty">🧁</span>`;
}

function bubble(m) {
  return `<div class="bubble bubble-${m.sender === 'baker' ? 'baker' : 'customer'}"><div class="bubble-text">${esc(m.text)}</div><time class="bubble-time" data-sent="${esc(m.sentAt || '')}"></time></div>`;
}

function threadListItem(t, activeId) {
  const preview = (t.lastFrom === 'customer' ? 'You: ' : '') + (t.lastMessage || '');
  return `<a class="thread-item${t.threadId === activeId ? ' active' : ''}" href="/customer/messages?thread=${esc(t.threadId)}">
      ${threadThumb(t.bakerName, t.bakerPhoto)}
      <span class="thread-meta">
        <span class="thread-name">${esc(t.bakerName)}${t.isCustomQuote ? ' <span class="quote-tag">Quote</span>' : ''}</span>
        <span class="thread-preview">${esc(preview)}</span>
      </span>
      ${t.unread ? '<span class="unread-dot" title="New message"></span>' : ''}
    </a>`;
}

function renderCustomerMessages({ threads, active, customer, viewer }) {
  const list = threads.length
    ? threads.map(t => threadListItem(t, active && active.threadId)).join('')
    : '<p class="muted empty-threads">No conversations yet.</p>';

  let view;
  if (active) {
    const b = active.baker;
    const bubbles = active.messages.length
      ? active.messages.map(bubble).join('')
      : '<p class="muted bubbles-empty">Say hello to start the conversation.</p>';
    view = `
      <div class="thread-head">
        <a class="thread-baker" href="/bakers/${esc(b.id)}">
          ${threadThumb(b.businessName, b.photo)}
          <span class="thread-baker-name">${esc(b.businessName)}</span>
        </a>
      </div>
      ${active.isCustomQuote ? '<div class="quote-banner">This is a custom quote conversation.</div>' : ''}
      <div class="bubbles" id="bubbles">${bubbles}</div>
      <form class="composer" id="composer">
        <input type="text" id="msgInput" placeholder="Write a message" autocomplete="off" maxlength="2000">
        <button type="submit" class="btn btn-primary">Send</button>
      </form>`;
  } else {
    view = `<div class="thread-empty"><p class="muted">No messages yet. <a href="/bakers">Find a baker</a> to start a conversation.</p></div>`;
  }

  const body = `
  <div class="cust-page msg-page">
    ${custTabs('messages')}
    <h1>Messages</h1>
    <div class="msg-layout">
      <aside class="thread-list">${list}</aside>
      <section class="thread-view">${view}</section>
    </div>
  </div>
  ${active ? jsonData('msg-data', { threadId: active.threadId, bakerId: active.baker.id, bakerEmail: active.baker.email, isCustomQuote: !!active.isCustomQuote, customerEmail: customer.email }) : ''}
  <script src="/js/customer-messages.js"></script>`;

  return layout({ title: 'Messages · Bkd Local', description: '', body, viewer });
}

module.exports = {
  renderCustomerProfile,
  renderPastOrders,
  renderOrderStatus,
  renderCustomerMessages,
  // exported for tests
  statusInfo,
  addressVisible,
  normalizeStatus,
  OCCASION_CHOICES
};
