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

function detailRow(label, value) {
  return `<div><strong style="font-weight:500;">${escEmail(label)}:</strong> ${escEmail(value)}</div>`;
}

// 24h-before reminder to the baker.
async function sendBakerReminder({ to, bakerFirstName, customerFirstName, itemName, quantity, pickupDate, pickupTime }) {
  const highlight = [
    detailRow('Customer', customerFirstName),
    detailRow('Order', `${quantity ? quantity + ' x ' : ''}${itemName}`),
    detailRow('Pickup date', pickupDate),
    pickupTime ? detailRow('Pickup time', pickupTime) : ''
  ].filter(Boolean).join('');
  return send({
    to,
    subject: "You have an order tomorrow, here's what you need to know",
    html: brandedEmail({
      heading: `Hi ${bakerFirstName}, you have a pickup tomorrow`,
      paragraphs: [`Just a friendly heads up that ${escEmail(customerFirstName)} is picking up their order tomorrow. Here are the details so you can plan your bake.`],
      highlightHtml: highlight,
      ctaText: 'Open your dashboard',
      ctaUrl: `${publicBase()}/app`
    }),
    text: `Hi ${bakerFirstName}, ${customerFirstName} has a pickup tomorrow (${pickupDate}${pickupTime ? ', ' + pickupTime : ''}): ${quantity ? quantity + ' x ' : ''}${itemName}. Open your dashboard: ${publicBase()}/app`
  });
}

// 24h-before reminder to the customer.
async function sendCustomerReminder24h({ to, customerFirstName, bakerName, itemName, quantity, pickupDate, pickupTime, pickupAddress, orderUrl }) {
  const highlight = [
    detailRow('Baker', bakerName),
    detailRow('Order', `${quantity ? quantity + ' x ' : ''}${itemName}`),
    detailRow('Pickup date', pickupDate),
    pickupTime ? detailRow('Pickup time', pickupTime) : '',
    pickupAddress ? detailRow('Pickup address', pickupAddress) : ''
  ].filter(Boolean).join('');
  return send({
    to,
    subject: 'Your order is almost ready, pickup is tomorrow',
    html: brandedEmail({
      heading: `Hi ${customerFirstName}, your order is almost ready`,
      paragraphs: [`Your order from ${escEmail(bakerName)} is being made and pickup is tomorrow. Here is everything you need.`],
      highlightHtml: highlight,
      ctaText: 'View your order',
      ctaUrl: orderUrl
    }),
    text: `Hi ${customerFirstName}, your order from ${bakerName} (${quantity ? quantity + ' x ' : ''}${itemName}) is ready for pickup tomorrow, ${pickupDate}${pickupTime ? ', ' + pickupTime : ''}${pickupAddress ? ', at ' + pickupAddress : ''}. View your order: ${orderUrl}`
  });
}

// Morning-of reminder to the customer (warmer tone).
async function sendCustomerReminderDayOf({ to, customerFirstName, bakerName, itemName, quantity, pickupDate, pickupTime, pickupAddress, orderUrl }) {
  const highlight = [
    pickupTime ? detailRow('Pickup time', pickupTime) : detailRow('Pickup', 'today'),
    pickupAddress ? detailRow('Pickup address', pickupAddress) : '',
    detailRow('Order', `${quantity ? quantity + ' x ' : ''}${itemName}`),
    detailRow('Baker', bakerName)
  ].filter(Boolean).join('');
  return send({
    to,
    subject: "Today's the day, your order is ready for pickup",
    html: brandedEmail({
      heading: `It's pickup day, ${customerFirstName}`,
      paragraphs: [`Today is the day. ${escEmail(bakerName)} has your order ready, and we cannot wait for you to see it. Here is where and when to grab it.`],
      highlightHtml: highlight,
      ctaText: 'View your order',
      ctaUrl: orderUrl
    }),
    text: `Today's the day, ${customerFirstName}. Your order from ${bakerName} (${quantity ? quantity + ' x ' : ''}${itemName}) is ready${pickupTime ? ' at ' + pickupTime : ''}${pickupAddress ? ', ' + pickupAddress : ''}. View your order: ${orderUrl}`
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
