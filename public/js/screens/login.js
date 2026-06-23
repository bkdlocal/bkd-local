async function renderLogin() {
  let demoEmail = null;
  try {
    const mode = await Api.getMode();
    if (mode.mode === 'mock') demoEmail = mode.demoEmail;
  } catch {}

  return `
    <div class="screen login-screen">
      ${renderStatusBar()}
      <div class="login-body">
        <div class="login-brand">
          <div class="login-logo">Bkd Local</div>
          <div class="login-tagline">for bakers</div>
        </div>

        <div class="login-card">
          <div class="login-hero">🧁</div>
          <div class="login-title">Welcome back</div>
          <div class="login-sub">Enter your baker email and password to continue.</div>

          <form class="login-form" data-action="auth:login" novalidate>
            <input
              type="email"
              class="login-input"
              name="email"
              placeholder="you@example.com"
              required
              autocomplete="email"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
            />
            <input
              type="password"
              class="login-input"
              name="password"
              placeholder="Password"
              autocomplete="current-password"
            />
            <button type="submit" class="login-submit">Continue</button>
          </form>

          <button type="button" class="login-forgot" data-action="auth:forgot">Set or reset your password</button>

          <div class="login-error" hidden></div>

          ${demoEmail ? `
            <div class="login-hint">Demo mode — try <strong>${demoEmail}</strong></div>
          ` : ''}
        </div>

        <div class="login-footer">
          New baker? <a href="https://bkdlocal.com/apply" target="_blank" rel="noopener">Apply to join</a>
        </div>
      </div>
    </div>
  `;
}
