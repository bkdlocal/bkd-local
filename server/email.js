// Transactional email via Resend (https://resend.com), sent over the HTTP API
// with the built-in fetch (same direct-HTTP style as server/cloudinary.js, no
// SDK dependency). Configured by environment:
//   RESEND_API_KEY  required to actually send
//   RESEND_FROM     verified sender, e.g. "Bkd Local <noreply@bkdlocal.com>"
// When RESEND_API_KEY is absent (local dev), it falls back to logging the link
// so the flow still works without delivering mail. Callers handle both paths.

const RESEND_API = 'https://api.resend.com/emails';

function fromAddress() {
  // Default uses the verified mail.bkdlocal.com sending domain. RESEND_FROM
  // overrides it when set (must also be an address at a verified domain).
  return process.env.RESEND_FROM || 'Bkd Local <noreply@mail.bkdlocal.com>';
}

function isConfigured() {
  return !!process.env.RESEND_API_KEY;
}

async function send({ to, subject, html, text }) {
  if (!isConfigured()) {
    console.log(`[email:stub] ${subject} -> ${to}\n[email:stub]   ${text}`);
    return { stubbed: true };
  }
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: fromAddress(), to: [to], subject, html, text })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend send failed: ${res.status} ${body}`);
  }
  return res.json();
}

async function sendVerificationEmail({ to, link }) {
  return send({
    to,
    subject: 'Verify your email for Bkd Local',
    text: `Confirm your email to finish creating your Bkd Local account: ${link}`,
    html: `<p>Confirm your email to finish creating your Bkd Local account.</p>
<p><a href="${link}">Verify my email</a></p>
<p>If the button does not work, paste this link into your browser:<br>${link}</p>`
  });
}

async function sendSetPasswordEmail({ to, link }) {
  return send({
    to,
    subject: 'Set your Bkd Local baker password',
    text: `Set the password for your Bkd Local baker account. This link is valid for 72 hours: ${link}`,
    html: `<p>Set the password for your Bkd Local baker account. This link is valid for 72 hours.</p>
<p><a href="${link}">Set my password</a></p>
<p>If the button does not work, paste this link into your browser:<br>${link}</p>`
  });
}

module.exports = { isConfigured, sendVerificationEmail, sendSetPasswordEmail };
