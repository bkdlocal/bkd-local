const NAV_ITEMS = [
  { id: 'home',         icon: 'ti-home',           label: 'Home' },
  { id: 'orders',       icon: 'ti-package',        label: 'Orders' },
  { id: 'availability', icon: 'ti-calendar',       label: 'Availability' },
  { id: 'menu',         icon: 'ti-clipboard-list', label: 'Menu' },
  { id: 'priceMyBakes', icon: 'ti-calculator',     label: '✦ Magic Pricing', magic: true }
];

// Logo bar shown at the top of every baker-app screen: "bkd" in Berry Rose,
// "local" in Deep Plum, then a Tabler map-pin in Berry Rose. Two bare Berry Rose
// icons sit flush right — messages (with a Deep Plum unread dot) and profile.
function renderLogoBar() {
  const unread = (typeof window !== 'undefined' && window.__unreadThreads) || 0;
  const msgDot = unread > 0 ? `<span class="app-logo-dot" aria-hidden="true"></span>` : '';
  return `
    <div class="app-logobar">
      <span class="app-logo-group">
        <span class="app-logo"><span class="app-logo-bkd">bkd</span><span class="app-logo-local">local</span></span>
        <i class="ti ti-map-pin app-logo-pin" aria-hidden="true"></i>
      </span>
      <div class="app-logo-actions">
        <button type="button" class="app-logo-icon" data-screen="messages" aria-label="Messages">
          <i class="ti ti-message-circle" aria-hidden="true"></i>
          ${msgDot}
        </button>
        <button type="button" class="app-logo-icon app-logo-profile" data-screen="profile" aria-label="Your profile">
          <i class="ti ti-user" aria-hidden="true"></i>
        </button>
      </div>
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
        // The Magic Pricing box gets a unique id (so its dark-ombre treatment
        // beats the shared .nav-box styles) plus decorative sparkles + FREE badge.
        const magicExtras = item.magic
          ? `<span class="nav-magic-spark nav-magic-spark-tr" aria-hidden="true">✦</span>
             <span class="nav-magic-spark nav-magic-spark-bl" aria-hidden="true">✦</span>
             <span class="nav-magic-free">FREE</span>`
          : '';
        return `
        <button class="nav-box${item.magic ? ' nav-box--magic' : ''}"${item.magic ? ' id="navMagicBox"' : ''} type="button" data-screen="${item.id}"${item.id === activeId ? ' aria-current="page"' : ''}>
          ${dot}
          ${magicExtras}
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

// Elapsed milliseconds -> HH:MM:SS (used by the Bake Timer).
function formatHMS(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = n => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// ── Bake Timer persistence (localStorage is the source of truth) ──
// Shape: { state: 'idle'|'running'|'paused', startTs: number|null,
//          accumMs: number, result: string|null }
// Elapsed is wall-clock based so it stays correct across screen lock/refresh.
const BAKE_TIMER_KEY = 'bkdBakeTimer';
function readBakeTimer() {
  try {
    const raw = localStorage.getItem(BAKE_TIMER_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      return {
        state: o.state === 'running' || o.state === 'paused' ? o.state : 'idle',
        startTs: Number(o.startTs) || null,
        accumMs: Number(o.accumMs) || 0,
        result: o.result || null
      };
    }
  } catch (_) {}
  return { state: 'idle', startTs: null, accumMs: 0, result: null };
}
function writeBakeTimer(t) {
  try { localStorage.setItem(BAKE_TIMER_KEY, JSON.stringify(t)); } catch (_) {}
}
function bakeElapsedMs(t) {
  let ms = Number(t.accumMs) || 0;
  if (t.state === 'running' && t.startTs) ms += Date.now() - t.startTs;
  return Math.max(0, ms);
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
