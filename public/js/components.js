const NAV_ITEMS = [
  { id: 'home',         icon: 'ti-home',           label: 'Home' },
  { id: 'orders',       icon: 'ti-package',        label: 'Orders' },
  { id: 'availability', icon: 'ti-calendar',       label: 'Availability' },
  { id: 'messages',     icon: 'ti-message-circle', label: 'Messages' },
  { id: 'profile',      icon: 'ti-user',           label: 'Profile' }
];

// Logo bar shown at the top of every baker-app screen: "bkd" in Berry Rose,
// "local" in Deep Plum, then a Tabler map-pin in Berry Rose. Matches the
// customer-facing wordmark.
function renderLogoBar() {
  return `
    <div class="app-logobar">
      <span class="app-logo"><span class="app-logo-bkd">bkd</span><span class="app-logo-local">local</span></span>
      <i class="ti ti-map-pin app-logo-pin" aria-hidden="true"></i>
    </div>
  `;
}

function renderBottomNav(activeId) {
  const unread = (typeof window !== 'undefined' && window.__unreadThreads) || 0;
  return `
    <nav class="bottom-nav">
      ${NAV_ITEMS.map(item => {
        const dot = (item.id === 'messages' && unread > 0)
          ? `<span class="nav-dot" aria-label="Unread messages"></span>`
          : '';
        return `
        <button class="nav-box" type="button" data-screen="${item.id}"${item.id === activeId ? ' aria-current="page"' : ''}>
          ${dot}
          <i class="ti ${item.icon} nav-icon" aria-hidden="true"></i>
          <span class="nav-label">${item.label}</span>
        </button>
      `;
      }).join('')}
    </nav>
  `;
}

function computeNet(gross, feeRate) {
  if (feeRate == null) return null;
  return gross * (1 - feeRate);
}

function formatMoney(amount, { decimals = 0 } = {}) {
  return `$${Number(amount).toFixed(decimals)}`;
}

function formatDate(value, style = 'long') {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const opts = style === 'long'
    ? { month: 'long', day: 'numeric' }
    : { month: 'short', day: 'numeric' };
  return d.toLocaleDateString('en-US', opts);
}

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';   // before noon
  if (hour < 17) return 'Good afternoon';  // noon–5pm
  return 'Good evening';                    // after 5pm
}

const AVATAR_PALETTES = [
  'linear-gradient(135deg, #F2C4D8, #C2557E)',
  'linear-gradient(135deg, #D4C8E0, #7A5068)',
  'linear-gradient(135deg, #D4C8E0, #3DB87A)',
  'linear-gradient(135deg, #F2C4D8, #D4C8E0)'
];

function avatarGradient(seed = '') {
  const code = (seed.charCodeAt(0) || 0) + (seed.charCodeAt(1) || 0);
  return AVATAR_PALETTES[code % AVATAR_PALETTES.length];
}

function initials(name = '') {
  return (name.trim()[0] || '?').toUpperCase();
}
