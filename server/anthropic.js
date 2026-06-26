const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

const SMART_REPLY_SYSTEM = `You write the exact text of the reply a home baker will send to a customer, in her own warm, friendly voice.

CRITICAL: Your entire response is sent to the customer verbatim. Output ONLY the message itself. The first character of your response must be the first character of the message, and the last character must be the end of the message. Write nothing before it and nothing after it.

NEVER include any of the following:
- Preamble, framing, or sign-posting of any kind (for example "Here's a reply:", "Sure!", "I'll craft a warm reply", "Let me...", "I'll keep it natural").
- Reasoning, explanation, or narration of what you are doing, choosing, or deciding.
- Any reference to FAQs, "answers on file", available information, or whether such information exists or is missing. Do not mention FAQs at all, in any form.
- The customer described in the third person. You are writing AS the baker, not about her.
- Separators such as ---, markdown, headings, labels, or surrounding quotation marks.

When no FAQ answers are available, simply write a warm, natural, helpful reply based on the conversation. Do NOT narrate that anything is missing or unavailable. Just reply the way a friendly baker would.

VOICE AND BRAND RULES:
- Sound like a real person texting a customer. Never robotic or corporate.
- Do NOT use em dashes. Use commas, periods, or separate sentences.
- Do NOT use emojis.
- Never use the words "platform", "cottage baker", or "situation".
- Never refer to women as "girls".
- Do not sign off with the baker's name.
- Keep it to 1 to 3 short sentences.`;

const FAQ_LABELS = {
  specialties:        'What I bake',
  locationPickup:     'Where I am / where pickup happens',
  delivery:           'Delivery vs pickup',
  leadTime:           'How far ahead to order',
  minimumOrder:       'Minimum order',
  customOrders:       'Custom orders',
  busySeasons:        'Busy seasons',
  glutenFree:         'Gluten-free',
  otherDietary:       'Other dietary needs',
  allergens:          'Allergens in my kitchen',
  paymentTiming:      'When payment happens',
  paymentMethods:     'Payment methods',
  cancellationPolicy: 'Cancellation / change policy',
  soldOut:            'If I’m sold out',
  samples:            'Samples',
  tastings:           'Tastings / consults',
  contactResponse:    'How to reach me & response time',
  anythingElse:       'Anything else customers should know'
};

function buildSmartReplyUserMessage({ baker, recentTurns, customerMessage }) {
  const faqLines = [];
  for (const [key, label] of Object.entries(FAQ_LABELS)) {
    const answer = baker.faq?.[key];
    if (answer) faqLines.push(`- ${label}: ${answer}`);
  }
  const faqBlock = faqLines.length ? faqLines.join('\n') : '(no FAQ answers on file yet)';

  const historyLines = recentTurns.map(t => {
    const who = t.from === 'baker' ? `${baker.firstName} (baker)` : 'Customer';
    return `${who}: ${t.text}`;
  });

  return [
    `Baker: ${baker.firstName} (signs as "${baker.firstName}")`,
    `Business: ${baker.businessName || '(none)'}`,
    '',
    `FAQ answers in the baker's own voice:`,
    faqBlock,
    '',
    historyLines.length ? `Recent conversation:\n${historyLines.join('\n')}` : '',
    '',
    `Latest customer message to reply to:\n"${customerMessage}"`,
    '',
    `Write a short reply (1-3 sentences) in the baker's voice. Do not sign off with the baker's name. Do not include greetings like "Hi <name>!" unless it would feel natural mid-thread.`
  ].filter(Boolean).join('\n');
}

async function callAnthropic({ apiKey, model, system, userMessage }) {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 350,
      system,
      messages: [{ role: 'user', content: userMessage }]
    })
  });
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const block = (data.content || []).find(b => b.type === 'text');
  return block ? block.text.trim() : '';
}

// Leading meta-commentary the model can emit before the real reply, e.g.
// "Since there are no FAQ answers on file to pull from, I'll craft a warm,
// natural reply:". These narrate the act of writing, or the (lack of) FAQ
// data, and must never reach a customer. Each pattern matches ONE leading
// sentence (up to its terminator . ! ? : or newline) and is intentionally
// specific so it can't strip a genuine reply that merely starts with "I'll".
const META_LEAD_PATTERNS = [
  /^[^.!?:\n]*\bfaqs?\b[^.!?:\n]*/i,                                                            // any lead sentence mentioning FAQ(s)
  /^[^.!?:\n]*\b(?:answers?|information|info|details?|notes?)\s+on file\b[^.!?:\n]*/i,          // "...answers on file..."
  /^(?:(?:okay|ok|sure|alright|got it|great|so)[\s,:;!.…-]+)?here(?:'s| is)\s+(?:a|an|the|my|your)\b[^.!?:\n]*\b(?:reply|response|message|version|draft|suggestion|note)\b[^.!?:\n]*/i,
  /^let me\b[^.!?:\n]*\b(?:craft|draft|compose|put together)\b[^.!?:\n]*/i,                     // "Let me craft..."
  /^i(?:'ll| will)\s+(?:craft|draft|compose|write up|put together|go with|keep it|create)\b[^.!?:\n]*/i,
  /^i(?:'m| am)\s+going to\s+(?:craft|draft|compose|write|put together|keep)\b[^.!?:\n]*/i,
  /^based on\s+(?:the|this|our|your)\b[^.!?:\n]*\b(?:conversation|context|message|exchange|thread|info|information)\b[^.!?:\n]*/i,
  /^the customer\b[^.!?:\n]*/i,                                                                // "The customer is asking about..."
];

function stripMetaPreamble(t) {
  // Strip leading meta sentences repeatedly (the model can stack a couple).
  for (let i = 0; i < 4; i++) {
    const s = t.replace(/^["'“”\s]+/, '');
    let matched = false;
    for (const re of META_LEAD_PATTERNS) {
      const m = s.match(re);
      if (m && m[0].trim()) {
        // Drop the matched lead plus its trailing terminator(s)/quotes/whitespace.
        t = s.slice(m[0].length)
          .replace(/^["'“”\s]*[.!?:,;…]+["'“”\s]*/, '')
          .replace(/^["'“”\s]+/, '');
        matched = true;
        break;
      }
    }
    if (!matched) { t = s; break; }
  }
  return t;
}

// Defense in depth: even with the strict system prompt, never let reasoning,
// preamble, separators, em dashes, or emojis reach the customer.
function sanitizeReply(text) {
  let t = String(text || '');
  // If the model emitted a "---" separator, keep only what follows the last one.
  const parts = t.split(/\n?\s*-{3,}\s*\n?/);
  if (parts.length > 1) t = parts[parts.length - 1];
  // Drop surrounding quotes the model sometimes adds.
  t = t.trim().replace(/^["'“”]+|["'“”]+$/g, '');
  // Strip any leading meta-commentary sentence(s) before the real reply.
  t = stripMetaPreamble(t.trim());
  // No em dashes or en dashes (brand voice). Replace with a comma where spaced.
  t = t.replace(/\s*[—–]\s*/g, ', ');
  // Strip emojis and variation selectors.
  t = t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/gu, '');
  // Tidy whitespace.
  t = t.replace(/[ \t]{2,}/g, ' ').replace(/ +([.,!?])/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
  return t;
}

function fallbackSuggestion(baker, customerMessage) {
  return `Thanks so much for reaching out! Let me check my schedule and a few details, and I will get right back to you with what works.`;
}

async function smartReply({ baker, recentTurns, customerMessage, apiKey, model }) {
  if (!apiKey) {
    return { suggestion: fallbackSuggestion(baker, customerMessage), source: 'fallback' };
  }
  try {
    const text = await callAnthropic({
      apiKey,
      model: model || 'claude-sonnet-4-6',
      system: SMART_REPLY_SYSTEM,
      userMessage: buildSmartReplyUserMessage({ baker, recentTurns, customerMessage })
    });
    const cleaned = sanitizeReply(text);
    return cleaned
      ? { suggestion: cleaned, source: 'anthropic' }
      : { suggestion: fallbackSuggestion(baker, customerMessage), source: 'fallback' };
  } catch (e) {
    console.error('[smartReply]', e.message);
    return { suggestion: fallbackSuggestion(baker, customerMessage), source: 'fallback', error: e.message };
  }
}

// ── FAQ chat widgets (customer + baker) ──────────────────────────────────────
const FAQ_SIGNOFF = 'Still have questions? Email us at hello@bkdlocal.com';

const CUSTOMER_FAQ_SYSTEM = `You are the helpful assistant for Bkd Local, a marketplace connecting customers with local artisan bakers in West Tennessee. Answer customer questions warmly and concisely based on the following information. Never use em dashes. Never use emojis. Keep answers to 2-4 sentences. If you do not know the answer, say so honestly and direct them to hello@bkdlocal.com.
KEY FACTS:
- Bkd Local connects customers with verified local artisan bakers searchable by date and treat type
- Customers search by pickup date and what they want, see available bakers, and place an order request
- Bakers confirm orders within 24 hours
- Payment is collected securely at order time via Stripe
- There is a flat $1.50 customer service fee per order, no other customer fees
- Pickup address is shared after order confirmation
- Customers receive reminder emails the day before and morning of pickup
- Customers have 2 hours from pickup time to dispute an order at hello@bkdlocal.com
- Valid dispute reasons: baker did not fulfill order, order significantly different from description, food safety concern
- Change of mind or flavor preference does not qualify for a refund
- After 2 hours all sales are final
- Every baker has completed Bkd Local verification including profile review
- Bakers prepare food in residential kitchens and may handle common allergens
- Customers can message bakers before ordering using the Message button on any baker profile
- Custom orders and quotes are available through the messaging feature
- Bkd Local currently serves West Tennessee only
- For help email hello@bkdlocal.com`;

const BAKER_FAQ_SYSTEM = `You are the helpful assistant for Bkd Local, a marketplace connecting artisan bakers with customers in West Tennessee. Answer baker questions warmly and concisely based on the following information. Never use em dashes. Never use emojis. Keep answers to 2-4 sentences. If you do not know the answer say so honestly and direct them to hello@bkdlocal.com.
KEY FACTS:
- Bkd Local is a two-sided marketplace where customers find bakers by date and treat type
- Beta bakers pay 0% fees for 90 days then 8% of order subtotal
- Charter bakers pay 5% of order subtotal for life
- There is no monthly subscription fee to be listed in the directory
- The $1.50 customer service fee goes to Bkd Local and is separate from the baker's subtotal
- Bakers get paid after order is marked Fulfilled and a 2-hour dispute window passes with no issues
- Payout = order subtotal minus platform fee percentage
- To go live a baker needs: bio, city, at least one menu item with cover photo and price, and at least one available pickup day
- Profile goes live automatically when all four requirements are met
- Bkd Verified means profile is complete and baker is active
- Default pickup days can be set by day of week in the Availability section, they repeat every week automatically
- Individual dates can be blocked on the calendar as exceptions
- Taking Orders toggle pauses all availability temporarily
- Minimum order quantity can be set per menu item
- Disputes are handled by Bkd Local, bakers do not deal with chargebacks directly
- Customers have 2 hours after pickup to file a dispute
- Magic Pricing Calculator is a free tool for Beta bakers to calculate profit and hourly rate
- Bake Timer tracks time per batch and calculates hourly earnings
- Smart Reply in Messages suggests responses based on baker FAQ answers
- Referral rewards: $25 per baker referred, $50 after first $500 in sales for Charter bakers
- For help email hello@bkdlocal.com or contact Raina directly`;

// Answer an FAQ question for either audience. Always returns an answer ending
// with the sign-off; degrades gracefully when the API key is missing or errors.
async function answerFaq({ audience, question, apiKey, model }) {
  const q = String(question || '').trim().slice(0, 600);
  if (!q) return { answer: '', error: 'empty_question' };
  const system = audience === 'baker' ? BAKER_FAQ_SYSTEM : CUSTOMER_FAQ_SYSTEM;
  // Guarantee every answer ends with the exact sign-off line.
  const withSignoff = (text) => {
    const t = String(text || '').trim();
    return t.endsWith(FAQ_SIGNOFF) ? t : `${t}\n\n${FAQ_SIGNOFF}`;
  };
  if (!apiKey) {
    return { answer: `Thanks for your question. Our assistant is being set up right now. ${FAQ_SIGNOFF}`, source: 'fallback' };
  }
  try {
    const text = await callAnthropic({ apiKey, model: model || 'claude-sonnet-4-6', system, userMessage: q });
    const cleaned = sanitizeReply(text);
    if (!cleaned) return { answer: `I'm not totally sure about that one. ${FAQ_SIGNOFF}`, source: 'fallback' };
    return { answer: withSignoff(cleaned), source: 'anthropic' };
  } catch (e) {
    console.error('[faq]', e.message);
    return { answer: `Sorry, I couldn't generate an answer just now. ${FAQ_SIGNOFF}`, source: 'fallback', error: e.message };
  }
}

module.exports = { smartReply, SMART_REPLY_SYSTEM, sanitizeReply, answerFaq };
