const NAV_ITEMS = [
  { id: 'home',         icon: '🏠', label: 'Home' },
  { id: 'orders',       icon: '📦', label: 'Orders' },
  { id: 'availability', icon: '📅', label: 'Availability' },
  { id: 'messages',     icon: '💬', label: 'Messages' },
  { id: 'profile',      icon: '👤', label: 'Profile' }
];

function renderStatusBar() {
  return `
    <div class="status-bar">
      <span class="status-time">9:41</span>
      <span class="status-icons">●●● WiFi 🔋</span>
    </div>
  `;
}

function renderBottomNav(activeId) {
  const unread = (typeof window !== 'undefined' && window.__unreadThreads) || 0;
  return `
    <nav class="bottom-nav">
      ${NAV_ITEMS.map(item => {
        const badge = (item.id === 'messages' && unread > 0)
          ? `<span class="nav-badge">${unread > 9 ? '9+' : unread}</span>`
          : '';
        return `
        <button class="nav-item" type="button" data-screen="${item.id}">
          <div class="nav-icon">${item.icon}${badge}</div>
          <div class="nav-label ${item.id === activeId ? 'nav-active' : ''}">${item.label}</div>
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
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
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
