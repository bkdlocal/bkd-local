// Email sending is stubbed for now (Step 2). The full flow — token
// generation, verify endpoint, verified flag — is real; only the actual
// delivery is deferred. Wire a provider (Resend/SendGrid) here later and
// flip isConfigured(); callers already handle both paths.

function isConfigured() {
  return false;
}

async function sendVerificationEmail({ to, link }) {
  console.log(`[email:stub] Verification email for ${to}\n[email:stub]   link: ${link}`);
  return { stubbed: true };
}

module.exports = { isConfigured, sendVerificationEmail };
