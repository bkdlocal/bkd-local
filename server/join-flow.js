const { esc, layout } = require('./public-site');

// All 50 states + DC, [code, name]. Stored combined as "City, ST" in Airtable.
const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],
  ['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],
  ['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],
  ['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],
  ['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],
  ['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],
  ['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],
  ['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],
  ['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],
  ['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']
];

function stateOptions(selected) {
  return US_STATES.map(([code, name]) =>
    `<option value="${code}"${code === selected ? ' selected' : ''}>${esc(name)}</option>`
  ).join('');
}

// Join-specific CSS. Uses the live brand tokens from public.css (--berry
// #C2557E, --pink, --card, --ink, --mauve, --line, --radius, --shadow) so it
// stays consistent with the rest of the app rather than re-declaring hex values.
function joinStyles() {
  return `<style>
  .join-wrap { max-width: 760px; margin: 40px auto; padding: 0 18px; }
  .join-head { text-align: center; margin-bottom: 28px; }
  .join-head h1 { font-size: 28px; margin: 0 0 8px; }
  .join-banner { background: #fff3f7; border: 1px solid var(--berry); color: var(--berry-deep);
    border-radius: 14px; padding: 12px 16px; font-size: 14px; margin-bottom: 22px; text-align: center; }
  .join-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .join-card { position: relative; background: var(--card); border: 1px solid var(--line);
    border-radius: 22px; padding: 26px 24px; box-shadow: var(--shadow); display: flex; flex-direction: column; }
  .join-card--featured { border: 2px solid var(--berry); }
  .join-card h2 { font-size: 20px; margin: 0 0 10px; }
  .join-badge { position: absolute; top: -12px; left: 24px; background: var(--berry); color: #fff;
    font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 999px; }
  .join-price { font-size: 30px; font-weight: 500; color: var(--ink); }
  .join-price span { font-size: 15px; font-weight: 400; color: var(--mauve); }
  .join-subprice { font-size: 14px; color: var(--mauve); margin-bottom: 16px; }
  .join-feats { list-style: none; padding: 0; margin: 0 0 22px; flex: 1; }
  .join-feats li { padding: 7px 0 7px 26px; position: relative; font-size: 15px; }
  .join-feats li::before { content: ""; position: absolute; left: 0; top: 9px; width: 14px; height: 14px;
    border-radius: 50%; background: var(--pink); box-shadow: inset 0 0 0 4px var(--berry); }
  .join-small { font-size: 12px; margin-top: 10px; text-align: center; }
  .join-foot { text-align: center; margin-top: 22px; }
  .join-finish .auth-card { margin-bottom: 16px; }
  .join-finish-head { margin-bottom: 8px; }
  .join-tier-pill { display: inline-block; background: var(--pink); color: var(--berry-deep);
    font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 999px; margin-bottom: 12px; }
  .join-tier-pill.is-charter { background: var(--berry); color: #fff; }
  .confetti-piece { position: fixed; top: -14px; border-radius: 2px; z-index: 60;
    pointer-events: none; opacity: 0; will-change: transform, opacity;
    animation: confetti-fall linear forwards; }
  @keyframes confetti-fall {
    0% { transform: translate3d(0, -10px, 0) rotate(0deg); opacity: 1; }
    100% { transform: translate3d(var(--dx, 0), 88vh, 0) rotate(var(--rot, 360deg)); opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) { .confetti-piece { display: none; } }
  @media (max-width: 600px) { .join-cards { grid-template-columns: 1fr; } }
  </style>`;
}

// Step 1: the two-card chooser at /join.
function renderJoin({ stripeReady, error }) {
  const errBanner = error === 'payment'
    ? `<div class="join-banner">Your payment didn't go through, so no account was created. You can try again below.</div>`
    : '';

  const charterCta = stripeReady
    ? `<button type="button" class="btn btn-primary btn-block" id="chooseCharter">Choose Charter</button>`
    : `<button type="button" class="btn btn-primary btn-block" disabled>Card setup pending</button>
       <p class="muted join-small">Charter checkout is being switched on. You can start with the free Beta now.</p>`;

  const body = `
  <div class="join-wrap">
    <div class="join-head">
      <h1>Join Bkd Local</h1>
      <p class="muted">Get your bakery in front of local customers ready to order. Choose how you'd like to start.</p>
    </div>
    ${errBanner}
    <div class="join-cards">
      <section class="join-card join-card--featured">
        <span class="join-badge">Recommended</span>
        <h2>Charter</h2>
        <div class="join-price">$97 <span>one-time</span></div>
        <div class="join-subprice">+ $19/month</div>
        <ul class="join-feats">
          <li>Lifetime 5% fee rate (Standard is 8%)</li>
          <li>Founding Baker badge on your profile</li>
          <li>Priority placement in the directory</li>
          <li>Quarterly strategy calls with Raina</li>
          <li>Founding Council membership</li>
          <li>First-customer guarantee</li>
          <li>Referral rewards</li>
        </ul>
        ${charterCta}
      </section>
      <section class="join-card">
        <h2>Beta</h2>
        <div class="join-price">Free <span>for 90 days</span></div>
        <div class="join-subprice">then 8% fee rate</div>
        <ul class="join-feats">
          <li>Full baker profile and dashboard</li>
          <li>Listed in the directory</li>
          <li>Upgrade to Charter anytime</li>
        </ul>
        <button type="button" class="btn btn-outline btn-block" id="chooseBeta">Start free Beta</button>
      </section>
    </div>
    <p class="join-foot muted">Already a baker? <a href="/login">Log in</a>.</p>
  </div>
  ${joinStyles()}
  <script src="/js/join.js"></script>`;

  return layout({
    title: 'Join Bkd Local · For bakers',
    description: 'Become a verified baker on Bkd Local. Charter or free Beta membership.',
    body
  });
}

// Step 2: the finish-signup form. Charter reaches this only via /join/complete
// after payment is verified; Beta reaches it directly.
function renderFinish({ tier, sessionId, email }) {
  const isCharter = tier === 'charter';
  const body = `
  <div class="auth-wrap join-finish">
    <div class="auth-card" id="joinCard">
      <div class="join-finish-head">
        <span class="join-tier-pill ${isCharter ? 'is-charter' : ''}">${isCharter ? 'Charter' : 'Free Beta'}</span>
        <h1>Finish your signup</h1>
        <p class="muted">${isCharter ? 'Payment received. Just a few details and you are in.' : 'Just a few details and you are in.'}</p>
      </div>
      <form id="joinForm" data-tier="${esc(tier)}" data-session="${esc(sessionId || '')}">
        <div class="two-col">
          <div class="field"><label for="firstName">First name</label><input id="firstName" type="text" autocomplete="given-name" required></div>
          <div class="field"><label for="lastName">Last name</label><input id="lastName" type="text" autocomplete="family-name" required></div>
        </div>
        <div class="field"><label for="bakeryName">Bakery name</label><input id="bakeryName" type="text" autocomplete="organization" required></div>
        <div class="field"><label for="email">Email</label><input id="email" type="email" autocomplete="email" value="${esc(email || '')}" required></div>
        <div class="field"><label for="phone">Phone</label><input id="phone" type="tel" autocomplete="tel"></div>
        <div class="two-col">
          <div class="field">
            <label for="city">City</label>
            <input id="city" type="text" placeholder="Jackson" autocomplete="address-level2">
          </div>
          <div class="field">
            <label for="state">State</label>
            <select id="state" autocomplete="address-level1">${stateOptions('TN')}</select>
          </div>
        </div>
        <div class="field"><label for="zip">Zip code</label><input id="zip" type="text" inputmode="numeric" autocomplete="postal-code"></div>
        <button type="submit" class="btn btn-primary btn-block" id="joinSubmit">Create my account</button>
        <p class="form-error" id="joinError" hidden></p>
      </form>
    </div>
    <div class="auth-card join-done" id="joinDone" hidden>
      <h1>Welcome to Bkd Local!</h1>
      <p class="muted">You're officially part of something special. We just sent you a link to set your password and get into your dashboard. Check your email to get started, and get ready to make more money with a whole lot less hustle.</p>
      <p class="form-note" id="joinDoneNote" hidden></p>
      <a class="btn btn-outline btn-block" href="/login">Go to login</a>
    </div>
  </div>
  ${joinStyles()}
  <script src="/js/join.js"></script>`;

  return layout({ title: 'Finish your signup · Bkd Local', description: '', body });
}

module.exports = { renderJoin, renderFinish };
