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
        <div class="login-card">
          <div class="login-hero"><img src="/img/bkdlocal-logo.svg" alt="bkd local"></div>
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

          <button type="button" class="login-forgot" data-screen="forgotPassword">Forgot your password?</button>

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

// Simple dedicated reset page: baker enters their email and we fire the
// existing set-password email flow (POST /api/auth/forgot-password).
async function renderForgotPassword() {
  return `
    <div class="screen login-screen">
      ${renderStatusBar()}
      <div class="login-body">
        <div class="login-card" id="forgotCard">
          <div class="login-hero"><img src="/img/bkdlocal-logo.svg" alt="bkd local"></div>
          <div class="login-title">Forgot your password?</div>
          <div class="login-sub">Enter your baker email and we'll send you a secure link to set a new password.</div>

          <form class="login-form" data-action="auth:forgotSubmit" novalidate>
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
            <button type="submit" class="login-submit">Send reset link</button>
          </form>

          <button type="button" class="login-forgot" data-screen="login">← Back to login</button>

          <div class="login-error" hidden></div>
        </div>

        <div class="login-card" id="forgotDone" hidden>
          <div class="login-hero"><img src="/img/bkdlocal-logo.svg" alt="bkd local"></div>
          <div class="login-title">Check your email</div>
          <div class="login-sub">Check your email for a link to set your password.</div>
          <button type="button" class="login-submit" data-screen="login">Back to login</button>
        </div>
      </div>
    </div>
  `;
}
