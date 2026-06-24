// Minimal Stripe REST client (no SDK), mirroring the hand-rolled Airtable
// client in this codebase. Only the two calls the Charter signup needs:
// create a one-time Checkout Session and retrieve one to verify payment.
// Stripe expects form-encoded bodies with bracketed nesting.
const STRIPE_API_BASE = 'https://api.stripe.com/v1';

class StripeError extends Error {
  constructor(status, body) {
    super(`Stripe ${status}: ${body}`);
    this.status = status;
  }
}

function secretKey() {
  const k = process.env.STRIPE_SECRET_KEY;
  return k && k.trim() ? k.trim() : null;
}

// True only when STRIPE_SECRET_KEY is actually set (non-empty). The Charter
// path is gated on this at runtime so it fails cleanly instead of guessing.
function configured() {
  return !!secretKey();
}

// Flatten nested params into Stripe's bracket form-encoding, e.g.
// line_items[0][price_data][currency]=usd. Skips null/undefined.
function encodeForm(obj, prefix, out) {
  out = out || new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item != null && typeof item === 'object') encodeForm(item, `${key}[${i}]`, out);
        else if (item != null) out.append(`${key}[${i}]`, String(item));
      });
    } else if (typeof v === 'object') {
      encodeForm(v, key, out);
    } else {
      out.append(key, String(v));
    }
  }
  return out;
}

async function request(method, pathname, params) {
  const key = secretKey();
  if (!key) throw new StripeError(0, 'STRIPE_SECRET_KEY is not set.');
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };
  if (params) opts.body = encodeForm(params).toString();
  const res = await fetch(`${STRIPE_API_BASE}${pathname}`, opts);
  if (!res.ok) throw new StripeError(res.status, await res.text());
  return res.json();
}

// One-time payment Checkout Session. amount is in cents. The success_url should
// contain the literal {CHECKOUT_SESSION_ID} template; Stripe fills it in.
async function createCheckoutSession({ amount, productName, successUrl, cancelUrl, customerEmail, metadata }) {
  return request('POST', '/checkout/sessions', {
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: customerEmail || undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: amount,
        product_data: { name: productName }
      }
    }],
    metadata: metadata || undefined
  });
}

async function retrieveCheckoutSession(id) {
  return request('GET', `/checkout/sessions/${encodeURIComponent(id)}`);
}

module.exports = { configured, createCheckoutSession, retrieveCheckoutSession, StripeError };
