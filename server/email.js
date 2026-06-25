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

async function send({ to, subject, html, text, attachments }) {
  if (!isConfigured()) {
    console.log(`[email:stub] ${subject} -> ${to}\n[email:stub]   ${text || ''}`);
    return { stubbed: true };
  }
  const payload = { from: fromAddress(), to: [to], subject, html, text };
  if (Array.isArray(attachments) && attachments.length) payload.attachments = attachments;
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend send failed: ${res.status} ${body}`);
  }
  return res.json();
}

const BRAND = { blush: '#FDF6F9', berry: '#C2557E', plum: '#2C1A24', mauve: '#7A5068' };

function publicBase() {
  return (process.env.PUBLIC_BASE_URL || 'https://bkd-local-production.up.railway.app').replace(/\/$/, '');
}

function escEmail(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// On-brand HTML shell: Blush White page, Berry Rose header bar with the white
// "bkdlocal" wordmark, Deep Plum body text, Poppins (with safe fallbacks),
// Berry Rose pill CTA. Inline styles for email-client compatibility.
function brandedEmail({ heading, paragraphs = [], ctaText, ctaUrl, highlightHtml }) {
  const body = paragraphs.map(p =>
    `<p style="margin:0 0 12px;color:${BRAND.plum};font-size:15px;line-height:1.6;">${p}</p>`
  ).join('');
  const highlight = highlightHtml
    ? `<div style="background:#ffffff;border:1px solid #F0E8EE;border-radius:14px;padding:16px 18px;margin:8px 0 18px;color:${BRAND.plum};font-size:15px;line-height:1.7;">${highlightHtml}</div>`
    : '';
  const cta = (ctaText && ctaUrl)
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 4px;"><tr>
        <td style="background:${BRAND.berry};border-radius:999px;">
          <a href="${escEmail(ctaUrl)}" style="display:inline-block;padding:13px 28px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:500;font-family:'Poppins',Arial,Helvetica,sans-serif;">${escEmail(ctaText)}</a>
        </td></tr></table>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500&display=swap');</style></head>
<body style="margin:0;padding:0;background:${BRAND.blush};">
  <div style="background:${BRAND.blush};padding:24px 12px;font-family:'Poppins',Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:${BRAND.blush};border-radius:18px;overflow:hidden;border:1px solid #F0E8EE;">
      <div style="background:${BRAND.berry};padding:18px 24px;text-align:center;">
        <span style="color:#ffffff;font-size:22px;font-weight:600;letter-spacing:-0.02em;font-family:'Poppins',Arial,Helvetica,sans-serif;">bkdlocal</span>
      </div>
      <div style="padding:28px 24px;">
        <h1 style="margin:0 0 14px;color:${BRAND.plum};font-size:20px;font-weight:500;font-family:'Poppins',Arial,Helvetica,sans-serif;">${escEmail(heading)}</h1>
        ${body}
        ${highlight}
        ${cta}
      </div>
      <div style="padding:16px 24px 22px;text-align:center;color:${BRAND.mauve};font-size:12px;">Bkd Local, local bakers baked to order</div>
    </div>
  </div>
</body></html>`;
}

// ── Reminder email design system ──────────────────────────────────────────
// Inline-styled, 600px centered, ombre header with the bkdlocal wordmark + pin,
// order detail card, optional pickup-address box, full-width Berry CTA. (Inline
// SVG pin renders in Apple Mail and many clients; Gmail strips SVG and just
// shows the wordmark, which is acceptable graceful degradation.)
const PIN_SVG = `<span style="display:inline-block;vertical-align:middle;margin-left:2px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2557E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"></path><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"></path></svg></span>`;

function orderCard(rows) {
  const cells = rows.filter(r => r && r.value != null && r.value !== '').map((r, i) => {
    const top = i > 0 ? 'border-top:0.5px solid #F2C4D8;' : '';
    return `<tr>
      <td style="padding:11px 16px;${top}"><span style="color:#7A5068;font-size:12px;font-family:'Poppins',Arial,Helvetica,sans-serif;">${escEmail(r.label)}</span></td>
      <td style="padding:11px 16px;${top}text-align:right;"><span style="color:#2C1A24;font-size:12px;font-weight:500;font-family:'Poppins',Arial,Helvetica,sans-serif;">${escEmail(r.value)}</span></td>
    </tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F9;border:1.5px solid #F2C4D8;border-radius:12px;margin:6px 0 18px;">${cells}</table>`;
}

function addressBox(address) {
  if (!address) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr>
    <td style="background:#FDF6F9;border-left:3px solid #C2557E;border-radius:0 12px 12px 0;padding:12px 16px;">
      <div style="color:#C2557E;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;font-family:'Poppins',Arial,Helvetica,sans-serif;">Pickup address</div>
      <div style="color:#2C1A24;font-size:14px;font-weight:500;margin-top:3px;font-family:'Poppins',Arial,Helvetica,sans-serif;">${escEmail(address)}</div>
    </td></tr></table>`;
}

// Full reminder email. headlineHtml is trusted (built below with accent spans).
function reminderEmail({ celebration, eyebrow, headlineHtml, bodyText, rows = [], address, ctaText, ctaUrl, afterNote }) {
  const ff = "font-family:'Poppins',Arial,Helvetica,sans-serif;";
  const celebrationBar = celebration
    ? `<tr><td style="background:#C2557E;background:linear-gradient(135deg,#C2557E 0%,#7A5068 100%);padding:16px 24px;text-align:center;">
        <div style="color:#ffffff;font-size:16px;font-weight:500;${ff}">${escEmail(celebration.title)}</div>
        <div style="color:rgba(255,255,255,0.8);font-size:12px;margin-top:2px;${ff}">${escEmail(celebration.subtitle)}</div>
      </td></tr>`
    : '';
  const cta = (ctaText && ctaUrl)
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 2px;"><tr>
        <td style="background:#C2557E;border-radius:50px;text-align:center;">
          <a href="${escEmail(ctaUrl)}" style="display:block;padding:16px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:500;${ff}">${escEmail(ctaText)}</a>
        </td></tr></table>`
    : '';
  const note = afterNote
    ? `<div style="border-top:0.5px solid #F2C4D8;margin:22px 0 0;padding-top:18px;"></div>
       <p style="margin:0;color:#7A5068;font-size:14px;line-height:1.7;${ff}">${escEmail(afterNote)}</p>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500&display=swap" rel="stylesheet">
<style>@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500&display=swap');</style></head>
<body style="margin:0;padding:0;background:#FDF6F9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDF6F9;${ff}"><tr><td align="center" style="padding:0;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
      ${celebrationBar}
      <tr><td style="background:#F2C4D8;background:linear-gradient(160deg,#D4C8E0 0%,#F2C4D8 55%,#FDF6F9 100%);padding:30px 24px 26px;text-align:center;">
        <div style="font-size:26px;font-weight:600;letter-spacing:-0.02em;line-height:1;${ff}"><span style="color:#C2557E;">bkd</span><span style="color:#2C1A24;">local</span>${PIN_SVG}</div>
        <div style="margin-top:8px;color:#7A5068;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;${ff}">local bakers, baked to order</div>
      </td></tr>
      <tr><td style="background:#ffffff;padding:40px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:#7A5068;${ff}">${escEmail(eyebrow)}</div>
        <h1 style="margin:8px 0 16px;font-size:22px;font-weight:500;color:#2C1A24;line-height:1.3;${ff}">${headlineHtml}</h1>
        <p style="margin:0 0 18px;color:#7A5068;font-size:14px;line-height:1.7;${ff}">${escEmail(bodyText)}</p>
        ${orderCard(rows)}
        ${addressBox(address)}
        ${cta}
        ${note}
      </td></tr>
      <tr><td style="background:#ffffff;padding:0 40px 34px;">
        <div style="border-top:0.5px solid #F2C4D8;padding-top:18px;text-align:center;color:#7A5068;font-size:11px;line-height:1.7;${ff}">Bkd Local, local bakers baked to order<br><a href="${escEmail(publicBase())}" style="color:#C2557E;text-decoration:none;">bkdlocal.com</a></div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

// Email 1 — baker, 24h before pickup.
async function sendBakerReminder({ to, bakerFirstName, customerLabel, itemName, quantity, pickupDate, pickupTime, payout }) {
  return send({
    to,
    subject: 'You have an order pickup tomorrow',
    html: reminderEmail({
      eyebrow: 'Order reminder',
      headlineHtml: `You have an order pickup <span style="color:#C2557E;">tomorrow</span>.`,
      bodyText: `Hey ${bakerFirstName}! Just a heads up, ${customerLabel} has an order scheduled for tomorrow. Here's everything you need to know.`,
      rows: [
        { label: 'Customer', value: customerLabel },
        { label: 'Item', value: itemName },
        { label: 'Quantity', value: quantity },
        { label: 'Pickup date', value: pickupDate },
        { label: 'Pickup time', value: pickupTime },
        { label: 'Your payout', value: payout }
      ],
      ctaText: 'View order in your dashboard',
      ctaUrl: `${publicBase()}/app`
    }),
    text: `Hey ${bakerFirstName}! ${customerLabel} has an order pickup tomorrow (${pickupDate}${pickupTime ? ', ' + pickupTime : ''}): ${itemName}${payout ? '. Your payout: ' + payout : ''}. View it in your dashboard: ${publicBase()}/app`
  });
}

// Email 2 — customer, 24h before pickup.
async function sendCustomerReminder24h({ to, customerFirstName, bakerName, itemName, pickupDate, pickupTime, pickupAddress, orderUrl }) {
  return send({
    to,
    subject: 'Your order is almost ready, pickup is tomorrow',
    html: reminderEmail({
      eyebrow: 'Pickup reminder',
      headlineHtml: `Your order is almost ready, pickup is <span style="color:#C2557E;">tomorrow</span>.`,
      bodyText: `Hey ${customerFirstName}! Just a reminder that your order from ${bakerName} is ready for pickup tomorrow. Here are your details.`,
      rows: [
        { label: 'Baker', value: bakerName },
        { label: 'Item', value: itemName },
        { label: 'Pickup date', value: pickupDate },
        { label: 'Pickup time', value: pickupTime }
      ],
      address: pickupAddress,
      ctaText: 'View your order',
      ctaUrl: orderUrl
    }),
    text: `Hey ${customerFirstName}! Your order from ${bakerName} (${itemName}) is ready for pickup tomorrow, ${pickupDate}${pickupTime ? ', ' + pickupTime : ''}${pickupAddress ? ', at ' + pickupAddress : ''}. View your order: ${orderUrl}`
  });
}

// Email 3 — customer, morning of pickup.
async function sendCustomerReminderDayOf({ to, customerFirstName, bakerName, itemName, pickupTime, pickupAddress, orderUrl }) {
  return send({
    to,
    subject: "Today's the day, your order is ready for pickup",
    html: reminderEmail({
      celebration: { title: "Today's the day!", subtitle: 'Your order is ready for pickup' },
      eyebrow: 'Pickup today',
      headlineHtml: `Something <span style="color:#C2557E;">beautiful</span> is waiting for you.`,
      bodyText: `Hey ${customerFirstName}! Your order from ${bakerName} is ready. Here's everything you need for a smooth pickup today.`,
      rows: [
        { label: 'Baker', value: bakerName },
        { label: 'Item', value: itemName },
        { label: 'Pickup time', value: pickupTime }
      ],
      address: pickupAddress,
      ctaText: 'View your order',
      ctaUrl: orderUrl,
      afterNote: `After your pickup, you'll be able to leave a review for ${bakerName} in the app. Your feedback helps other customers find great bakers.`
    }),
    text: `Today's the day, ${customerFirstName}! Your order from ${bakerName} (${itemName}) is ready${pickupTime ? ' at ' + pickupTime : ''}${pickupAddress ? ', ' + pickupAddress : ''}. View your order: ${orderUrl}`
  });
}

// Order-confirmed calendar invite with an .ics attachment (Apple + Google).
async function sendCalendarInvite({ to, recipientName, itemName, ics }) {
  return send({
    to,
    subject: `${itemName} pickup, Bkd Local`,
    html: brandedEmail({
      heading: `Your pickup is on the calendar${recipientName ? ', ' + recipientName : ''}`,
      paragraphs: [`We have attached a calendar invite for the ${escEmail(itemName)} pickup. Open the attachment to add it to Apple Calendar or Google Calendar.`]
    }),
    text: `Calendar invite attached for the ${itemName} pickup. Add it to Apple or Google Calendar.`,
    attachments: [{
      filename: 'bkd-local-pickup.ics',
      content: Buffer.from(ics, 'utf8').toString('base64'),
      contentType: 'text/calendar'
    }]
  });
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

module.exports = {
  isConfigured, sendVerificationEmail, sendSetPasswordEmail,
  sendBakerReminder, sendCustomerReminder24h, sendCustomerReminderDayOf, sendCalendarInvite,
  publicBase
};
