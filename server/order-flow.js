const { esc, layout, minimumLabel } = require('./public-site');

// Embed JSON safely inside a <script> tag.
function jsonScript(id, data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<script id="${id}" type="application/json">${json}</script>`;
}

function addonRow(a, i) {
  if (a.unit === 'per_cookie') {
    return `<div class="addon-row" data-i="${i}" data-unit="per_cookie" data-price="${a.price}">
      <div class="addon-info"><span class="addon-name">${esc(a.name)}</span><span class="addon-meta">$${a.price.toFixed(2)} per cookie</span></div>
      <div class="stepper">
        <button type="button" class="step-btn" data-act="addon-dec" data-i="${i}" aria-label="Fewer">−</button>
        <span class="step-val addon-qty" data-i="${i}">0</span>
        <button type="button" class="step-btn" data-act="addon-inc" data-i="${i}" aria-label="More">+</button>
      </div>
    </div>`;
  }
  return `<div class="addon-row" data-i="${i}" data-unit="per_set" data-price="${a.price}">
    <div class="addon-info"><span class="addon-name">${esc(a.name)}</span><span class="addon-meta">$${a.price.toFixed(2)} per set</span></div>
    <label class="addon-check"><input type="checkbox" data-act="addon-toggle" data-i="${i}"><span class="addon-box"></span></label>
  </div>`;
}

function renderOrderFlow({ baker, item, availableDates, serviceFee, viewer }) {
  const soldPerLabel = item.soldPer ? `per ${esc(item.soldPer)}` : '';
  const qtyUnit = item.soldPer ? esc(item.soldPer) : 'order';
  const minQty = Number(item.minimumQuantity) > 0 ? Math.floor(item.minimumQuantity) : 1;
  const minLine = minimumLabel(item.minimumQuantity, item.soldPer);
  const datePills = availableDates.length
    ? availableDates.map(d => `<button type="button" class="date-pill" data-act="pick-date" data-date="${esc(d)}"></button>`).join('')
    : `<p class="muted">This baker has no open pickup dates right now. Please check back soon.</p>`;

  const addOnsMarkup = item.addOns.length
    ? item.addOns.map(addonRow).join('')
    : `<p class="muted">No add-ons available for this item.</p>`;

  const body = `
  <div class="order-flow">
    <nav class="crumbs"><a href="/bakers/${esc(baker.id)}">← Back to ${esc(baker.businessName)}</a></nav>
    <div class="order-progress">
      <span class="pdot active" data-dot="1"></span>
      <span class="pdot" data-dot="2"></span>
      <span class="pdot" data-dot="3"></span>
    </div>

    <section class="ostep active" data-step="1">
      ${item.coverPhoto ? `<div class="order-cover" style="background-image:url('${esc(item.coverPhoto)}')"></div>` : ''}
      <h1>${esc(item.name)}</h1>
      <div class="price-line">$${Number(item.price).toFixed(2)} ${soldPerLabel}</div>
      ${minLine ? `<div class="order-min">${esc(minLine)}</div>` : ''}
      <div class="field">
        <label>How many ${esc(qtyUnit)}${item.soldPer ? 's' : '(s)'}?</label>
        <div class="stepper big">
          <button type="button" class="step-btn" data-act="qty-dec" aria-label="Fewer">−</button>
          <span class="step-val" id="qtyVal">${minQty}</span>
          <button type="button" class="step-btn" data-act="qty-inc" aria-label="More">+</button>
        </div>
      </div>
      <div class="field">
        <label>When would you like to pick up?</label>
        <div class="date-pills">${datePills}</div>
      </div>
      <div class="step-actions">
        <button type="button" class="btn btn-primary btn-block" data-act="to-2" disabled id="next1">Continue</button>
      </div>
    </section>

    <section class="ostep" data-step="2">
      <h2>Add a little extra</h2>
      <p class="muted">Customize ${esc(item.name)} with optional add-ons.</p>
      <div class="addons">${addOnsMarkup}</div>
      <div class="running-total">Total so far <strong class="order-total-val">$0.00</strong></div>
      <div class="step-actions two">
        <button type="button" class="btn btn-outline" data-act="to-1">Back</button>
        <button type="button" class="btn btn-primary" data-act="to-3">Review</button>
      </div>
    </section>

    <section class="ostep" data-step="3">
      <h2>Review your request</h2>
      <div class="summary" id="summary"></div>
      <p class="tax-disclaimer">Bakers are independent sellers responsible for their own tax obligations. Bkd Local does not collect or remit sales tax.</p>
      <div class="field">
        <label for="orderNotes">Any details for your baker? (optional)</label>
        <textarea id="orderNotes" rows="3" placeholder="Colors, theme, flavors, allergies, pickup time..."></textarea>
      </div>
      <p class="pay-note">No payment is collected now. This sends your request; ${esc(baker.businessName)} will confirm and arrange payment with you.</p>
      <div class="step-actions two">
        <button type="button" class="btn btn-outline" data-act="to-2">Back</button>
        <button type="button" class="btn btn-primary" data-act="submit" id="sendBtn">Send request</button>
      </div>
      <p class="form-error" id="orderError" hidden></p>
    </section>

    <section class="ostep" data-step="done">
      <div class="done-card">
        <h2>Request sent!</h2>
        <p>Your request has gone to ${esc(baker.businessName)}. They will confirm and reach out with pickup and payment details.</p>
        <a class="btn btn-primary btn-block" href="/bakers">Browse more bakers</a>
      </div>
    </section>
  </div>
  ${jsonScript('order-data', { bakerId: baker.id, item, serviceFee })}
  <script src="/js/order.js"></script>`;

  return layout({
    title: `Request from ${baker.businessName} · Bkd Local`,
    description: `Send an order request to ${baker.businessName} on Bkd Local.`,
    body,
    viewer
  });
}

function renderAuth({ mode, redirect }) {
  const isSignup = mode === 'signup';
  const r = redirect || '';
  const signupFields = isSignup ? `
      <div class="field"><label for="firstName">First Name</label><input id="firstName" type="text" autocomplete="given-name"></div>
      <div class="field"><label for="lastName">Last Name</label><input id="lastName" type="text" autocomplete="family-name"></div>
      <div class="field"><label for="state">State</label><input id="state" type="text" autocomplete="address-level1" value="TN"></div>
      <div class="field"><label for="zipCode">ZIP Code</label><input id="zipCode" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="5" autocomplete="postal-code" placeholder="ZIP code" required></div>` : '';
  const body = `
  <div class="auth-wrap">
    <div class="auth-card">
      <h1>${isSignup ? 'Create your account' : 'Welcome back'}</h1>
      <p class="muted">${isSignup ? 'Create an account to start ordering from your local bakers.' : 'Log in to continue your order request.'}</p>
      <form id="authForm" data-mode="${isSignup ? 'signup' : 'login'}" data-redirect="${esc(r)}">
        ${signupFields}
        <div class="field"><label for="email">Email</label><input id="email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="password">Password</label><input id="password" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" required></div>
        <button type="submit" class="btn btn-primary btn-block" id="authSubmit">${isSignup ? 'Create account' : 'Log in'}</button>
        <p class="form-error" id="authError" hidden></p>
        <p class="form-note" id="authNote" hidden></p>
      </form>
      <p class="auth-switch">
        ${isSignup
          ? `Already have an account? <a href="/login${r ? `?redirect=${encodeURIComponent(r)}` : ''}">Log in</a>`
          : `New here? <a href="/signup${r ? `?redirect=${encodeURIComponent(r)}` : ''}">Create an account</a>`}
      </p>
    </div>
  </div>
  <script src="/js/auth.js"></script>`;
  return layout({
    title: `${isSignup ? 'Sign up' : 'Log in'} · Bkd Local`,
    description: '',
    body
  });
}

function renderBakerSetPassword({ token }) {
  const body = `
  <div class="auth-wrap">
    <div class="auth-card">
      <h1>Set your baker password</h1>
      <p class="muted">Choose a password to secure your Bkd Local baker account.</p>
      <form id="setPwForm" data-token="${esc(token || '')}">
        <div class="field"><label for="password">New password</label><input id="password" type="password" autocomplete="new-password" required></div>
        <div class="field"><label for="confirm">Confirm password</label><input id="confirm" type="password" autocomplete="new-password" required></div>
        <button type="submit" class="btn btn-primary btn-block" id="setPwSubmit">Set password</button>
        <p class="form-error" id="setPwError" hidden></p>
        <p class="form-note" id="setPwNote" hidden></p>
      </form>
    </div>
  </div>
  <script src="/js/baker-set-password.js"></script>`;
  return layout({ title: 'Set your password · Bkd Local', description: '', body });
}

module.exports = { renderOrderFlow, renderAuth, renderBakerSetPassword };
