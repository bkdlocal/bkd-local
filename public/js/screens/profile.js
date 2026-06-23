const FAQ_GROUPS = [
  {
    label: 'About your bakes',
    icon: '🧁',
    items: [
      { key: 'specialties',  label: 'Specialties',   hint: "What are you known for? What flavors people come back for?" },
      { key: 'customOrders', label: 'Custom orders', hint: "Do you take custom requests? Anything you'd rather not do?" },
      { key: 'busySeasons',  label: 'Busy seasons',  hint: "When do you book up fastest? (holidays, wedding season, etc.)" }
    ]
  },
  {
    label: 'Pickup & timing',
    icon: '📍',
    items: [
      { key: 'locationPickup', label: 'Location & pickup', hint: "How does pickup work at your place? Any heads-up for customers?" },
      { key: 'delivery',       label: 'Delivery',          hint: "Do you deliver? Any radius, fees, minimums?" },
      { key: 'leadTime',       label: 'Lead time',         hint: "How far ahead should customers order? Rush options?" },
      { key: 'minimumOrder',   label: 'Minimum order',     hint: "Any minimums by item type (e.g., dozen on cookies)?" },
      { key: 'soldOut',        label: 'Sold out',          hint: "What should customers do if you're booked? Waitlist?" }
    ]
  },
  {
    label: 'Dietary & allergens',
    icon: '🌿',
    items: [
      { key: 'glutenFree',   label: 'Gluten-free',   hint: "Can you make GF items? Any cross-contamination notes?" },
      { key: 'otherDietary', label: 'Other dietary', hint: "Vegan, dairy-free, egg-free, nut-free — what can you do?" },
      { key: 'allergens',    label: 'Allergens',     hint: "What's in your kitchen? (almonds, wheat, nuts, etc.)" }
    ]
  },
  {
    label: 'Payment & cancellation',
    icon: '💳',
    items: [
      { key: 'paymentTiming',      label: 'Payment timing',      hint: "When do you collect payment? At booking, pickup, deposit?" },
      { key: 'paymentMethods',     label: 'Payment methods',     hint: "Card via Bkd Local, Venmo, cash — what works?" },
      { key: 'cancellationPolicy', label: 'Cancellation policy', hint: "Your refund / change policy in plain language." }
    ]
  },
  {
    label: 'Tastings & samples',
    icon: '🍰',
    items: [
      { key: 'samples',  label: 'Samples',  hint: "Do you offer samples? For big orders or weddings?" },
      { key: 'tastings', label: 'Tastings', hint: "How tastings work, fees, what's included." }
    ]
  },
  {
    label: 'Communication',
    icon: '💬',
    items: [
      { key: 'contactResponse', label: 'Contact & response', hint: "How customers should reach you and how fast you typically reply." },
      { key: 'anythingElse',    label: 'Anything else',      hint: "Anything else customers should know about working with you?" }
    ]
  }
];

const ALL_FAQ_ITEMS = FAQ_GROUPS.flatMap(g => g.items);

async function renderProfile() {
  const baker = await Api.getBaker();
  const state = Router.state.profile || {};
  const completion = computeCompletion(baker);
  const isLive = String(baker.profileStatus || '').toLowerCase() === 'live';
  const canGoLive = completion.faq === ALL_FAQ_ITEMS.length
    && hasValue(baker.businessName)
    && hasValue(baker.contactName)
    && hasValue(baker.pickupLocation)
    && hasValue(baker.bio);

  return `
    <div class="screen">
      ${renderStatusBar()}

      <div class="pmb-top-nav">
        <button class="pmb-back" type="button" data-screen="home" aria-label="Back">‹</button>
        <div class="pmb-top-text">
          <div class="greeting-sub">${isLive ? 'Live in the directory' : `${completion.faq} of ${ALL_FAQ_ITEMS.length} answered`}</div>
          <div class="greeting-name">My Profile</div>
        </div>
        <button class="profile-reset" type="button" data-action="profile:resetOnboarding" title="Clear all FAQ answers (mock only)">↻</button>
      </div>

      <div class="scroll-content profile-scroll">
        ${renderProfileHero(baker, isLive)}
        ${isLive ? '' : renderOnboardingBanner(baker, completion, canGoLive)}
        ${renderBasicSection(baker, state)}
        ${renderLocationSection(baker, state)}
        ${renderVoiceSection(baker, state)}
        ${renderFaqSections(baker, state)}
        ${renderProfileFooter(baker, isLive, canGoLive)}
      </div>

      ${renderBottomNav('profile')}
    </div>
  `;
}

function hasValue(v) { return v != null && String(v).trim() !== ''; }

function onProfileAvatarClick() {
  const el = document.getElementById('profileAvatarInput');
  if (el) el.click();
}

async function onProfileAvatarChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    await Api.uploadBakerProfilePhoto(file);
    Router.refresh({ keepScroll: true });
  } catch (err) { alert(err.message); }
}

function computeCompletion(baker) {
  const faq = baker.faq || {};
  const faqDone = ALL_FAQ_ITEMS.filter(it => hasValue(faq[it.key])).length;
  const basicFields = ['businessName', 'contactName', 'phone', 'city', 'pickupLocation', 'bio'];
  const basicDone = basicFields.filter(k => hasValue(baker[k])).length;
  return {
    faq: faqDone,
    basic: basicDone,
    basicTotal: basicFields.length,
    total: faqDone + basicDone,
    grandTotal: ALL_FAQ_ITEMS.length + basicFields.length
  };
}

function renderProfileHero(baker, isLive) {
  const tierBadge = baker.tier
    ? `<span class="profile-tier ${baker.tier.toLowerCase()}">${baker.tier === 'Charter' ? '⭐ ' : ''}${baker.tier}</span>`
    : '';
  const statusPill = isLive
    ? '<span class="profile-status live">● Live</span>'
    : `<span class="profile-status setup">● ${baker.profileStatus || 'Setup'}</span>`;
  const initial = (baker.contactName || baker.businessName || '?').trim()[0].toUpperCase();
  const avatarInner = baker.photo
    ? `<img src="${escapeHtml(baker.photo)}" alt="Your profile photo">`
    : escapeHtml(initial);
  const avatarStyle = baker.photo ? '' : ` style="background: ${avatarGradient(baker.contactName || baker.businessName || 'B')};"`;
  return `
    <div class="profile-hero">
      <div class="profile-avatar-xl${baker.photo ? ' has-photo' : ''}"${avatarStyle} onclick="onProfileAvatarClick()" title="Upload profile photo">
        ${avatarInner}
        <span class="profile-avatar-edit">Edit</span>
      </div>
      <input type="file" id="profileAvatarInput" accept="image/*" hidden onchange="onProfileAvatarChange(event)">
      <div class="profile-hero-info">
        <div class="profile-business">${escapeHtml(baker.businessName || 'Your bakery')}</div>
        <div class="profile-contact">${escapeHtml(baker.contactName || baker.firstName || 'Add your name')}</div>
        <div class="profile-hero-meta">
          ${tierBadge}
          ${statusPill}
        </div>
      </div>
    </div>
  `;
}

function renderOnboardingBanner(baker, completion, canGoLive) {
  const pct = Math.round((completion.total / completion.grandTotal) * 100);
  const message = canGoLive
    ? "You're ready! Tap Go Live below to show up in the directory."
    : completion.faq === 0
      ? "Welcome to Bkd Local! Answer the questions below so customers know how to work with you."
      : `Nice — keep going. ${ALL_FAQ_ITEMS.length - completion.faq} FAQ${ALL_FAQ_ITEMS.length - completion.faq === 1 ? '' : 's'} to go.`;
  return `
    <div class="profile-banner">
      <div class="profile-banner-top">
        <div class="profile-banner-pct">${pct}%</div>
        <div class="profile-banner-text">
          <div class="profile-banner-title">${canGoLive ? "Profile complete ✨" : "Let's get you live"}</div>
          <div class="profile-banner-sub">${message}</div>
        </div>
      </div>
      <div class="profile-banner-track">
        <div class="profile-banner-fill" style="width: ${pct}%;"></div>
      </div>
    </div>
  `;
}

function renderBasicSection(baker, state) {
  const editing = state.editingZone === 'basic';
  if (editing) {
    return `
      <form class="profile-section" data-action="profile:saveZone" data-zone="basic">
        <div class="profile-section-head">
          <div class="profile-section-title">Business basics</div>
          <button type="button" class="profile-link" data-action="profile:cancelZone">Cancel</button>
        </div>
        ${renderInput('businessName', 'Business Name', baker.businessName)}
        ${renderInput('contactName', 'Your Name', baker.contactName)}
        ${renderInput('phone', 'Phone', baker.phone, 'tel')}
        <button class="profile-save-btn" type="submit">Save</button>
      </form>
    `;
  }
  return `
    <div class="profile-section">
      <div class="profile-section-head">
        <div class="profile-section-title">Business basics</div>
        <button type="button" class="profile-link" data-action="profile:editZone" data-zone="basic">Edit</button>
      </div>
      ${renderReadField('Business Name', baker.businessName)}
      ${renderReadField('Your Name', baker.contactName)}
      ${renderReadField('Phone', baker.phone)}
      ${renderReadField('Email', baker.email, true)}
    </div>
  `;
}

function renderLocationSection(baker, state) {
  const editing = state.editingZone === 'location';
  if (editing) {
    return `
      <form class="profile-section" data-action="profile:saveZone" data-zone="location">
        <div class="profile-section-head">
          <div class="profile-section-title">Pickup & location</div>
          <button type="button" class="profile-link" data-action="profile:cancelZone">Cancel</button>
        </div>
        ${renderInput('city', 'City', baker.city)}
        ${renderTextarea('pickupLocation', 'Pickup address & notes', baker.pickupLocation, "e.g., 482 Greene Ave — front porch, please text when 5 min out", 2)}
        <button class="profile-save-btn" type="submit">Save</button>
      </form>
    `;
  }
  return `
    <div class="profile-section">
      <div class="profile-section-head">
        <div class="profile-section-title">Pickup & location</div>
        <button type="button" class="profile-link" data-action="profile:editZone" data-zone="location">Edit</button>
      </div>
      ${renderReadField('City', baker.city)}
      ${renderReadField('Pickup', baker.pickupLocation)}
    </div>
  `;
}

function renderVoiceSection(baker, state) {
  const editing = state.editingZone === 'voice';
  if (editing) {
    return `
      <form class="profile-section" data-action="profile:saveZone" data-zone="voice">
        <div class="profile-section-head">
          <div class="profile-section-title">Your voice</div>
          <button type="button" class="profile-link" data-action="profile:cancelZone">Cancel</button>
        </div>
        ${renderTextarea('bio', 'Short bio', baker.bio, "One sentence that captures what you do", 2)}
        ${renderInput('productTypes', 'Product types (comma-separated)', baker.productTypes)}
        ${renderInput('specialtyTags', 'Specialty tags (comma-separated)', baker.specialtyTags)}
        <button class="profile-save-btn" type="submit">Save</button>
      </form>
    `;
  }
  return `
    <div class="profile-section">
      <div class="profile-section-head">
        <div class="profile-section-title">Your voice</div>
        <button type="button" class="profile-link" data-action="profile:editZone" data-zone="voice">Edit</button>
      </div>
      ${renderReadField('Bio', baker.bio)}
      ${renderReadField('Product types', baker.productTypes)}
      ${renderReadField('Specialty tags', baker.specialtyTags)}
    </div>
  `;
}

function renderFaqSections(baker, state) {
  return FAQ_GROUPS.map(group => `
    <div class="profile-section faq-section">
      <div class="profile-section-head">
        <div class="profile-section-title">
          <span class="faq-group-icon">${group.icon}</span>
          ${group.label}
        </div>
        <div class="faq-group-count">${group.items.filter(it => hasValue(baker.faq?.[it.key])).length}/${group.items.length}</div>
      </div>
      ${group.items.map(item => renderFaqRow(baker, state, item)).join('')}
    </div>
  `).join('');
}

function renderFaqRow(baker, state, item) {
  const value = baker.faq?.[item.key];
  const editing = state.editingFaq === item.key;
  if (editing) {
    return `
      <form class="faq-row faq-editing" data-action="profile:saveFaq" data-key="${item.key}">
        <div class="faq-row-label">${item.label}</div>
        <div class="faq-row-hint">${escapeHtml(item.hint)}</div>
        <textarea
          name="value"
          class="faq-textarea"
          rows="4"
          placeholder="${escapeHtml(item.hint)}"
        >${escapeHtml(value || '')}</textarea>
        <div class="faq-actions">
          <button type="button" class="profile-link" data-action="profile:cancelFaq">Cancel</button>
          <button type="submit" class="faq-save-btn">Save</button>
        </div>
      </form>
    `;
  }
  if (hasValue(value)) {
    return `
      <button
        type="button"
        class="faq-row faq-filled"
        data-action="profile:editFaq"
        data-key="${item.key}"
      >
        <div class="faq-row-head">
          <span class="faq-check">✓</span>
          <span class="faq-row-label">${item.label}</span>
        </div>
        <div class="faq-row-value">${escapeHtml(truncateProfile(value, 140))}</div>
      </button>
    `;
  }
  return `
    <button
      type="button"
      class="faq-row faq-empty"
      data-action="profile:editFaq"
      data-key="${item.key}"
    >
      <div class="faq-row-head">
        <span class="faq-add">+</span>
        <span class="faq-row-label">${item.label}</span>
      </div>
      <div class="faq-row-hint">${escapeHtml(item.hint)}</div>
    </button>
  `;
}

function renderProfileFooter(baker, isLive, canGoLive) {
  return `
    <div class="profile-footer">
      ${!isLive && canGoLive ? `
        <button class="profile-go-live" type="button" data-action="profile:goLive">
          🎉 Go Live
        </button>
        <div class="profile-footer-hint">Your profile will show up in the directory.</div>
      ` : ''}
      ${isLive ? `
        <div class="profile-live-note">Your profile is live in the directory.</div>
      ` : ''}
      <button class="btn-logout" type="button" data-action="auth:logout">Log Out</button>
    </div>
  `;
}

function renderInput(name, label, value, type = 'text') {
  return `
    <label class="profile-field">
      <div class="profile-field-label">${label}</div>
      <input
        class="profile-input"
        type="${type}"
        name="${name}"
        value="${escapeHtml(value || '')}"
      />
    </label>
  `;
}

function renderTextarea(name, label, value, placeholder, rows = 3) {
  return `
    <label class="profile-field">
      <div class="profile-field-label">${label}</div>
      <textarea
        class="profile-textarea"
        name="${name}"
        rows="${rows}"
        placeholder="${escapeHtml(placeholder || '')}"
      >${escapeHtml(value || '')}</textarea>
    </label>
  `;
}

function renderReadField(label, value, muted = false) {
  const empty = !hasValue(value);
  return `
    <div class="profile-read-row">
      <div class="profile-field-label">${label}</div>
      <div class="profile-read-value ${empty ? 'empty' : ''} ${muted ? 'muted' : ''}">
        ${empty ? 'Not set' : escapeHtml(value)}
      </div>
    </div>
  `;
}

function truncateProfile(s, n) {
  if (!s) return '';
  const flat = String(s).replace(/\s+/g, ' ');
  return flat.length > n ? flat.slice(0, n - 1) + '…' : flat;
}
