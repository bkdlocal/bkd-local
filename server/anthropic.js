const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

const SMART_REPLY_SYSTEM = `You write the exact reply a home baker will send to a customer, in her own warm, friendly voice.

OUTPUT RULES (critical):
- Return ONLY the message text to send, exactly as the baker would send it. Nothing else.
- No preamble, no reasoning, no explanation, no meta-commentary, no notes about the FAQ.
- Never say things like "since there are no FAQ answers" or describe what you are doing.
- No separators such as ---, no markdown, no headings, no labels.
- Do not wrap the message in quotation marks.
- Keep it to 1 to 3 short sentences.

VOICE AND BRAND RULES:
- Sound like a real person texting a customer. Never robotic or corporate.
- Do NOT use em dashes. Use commas, periods, or separate sentences.
- Do NOT use emojis.
- Never use the words "platform", "cottage baker", or "situation".
- Never refer to women as "girls".
- Do not sign off with the baker's name.
- If FAQ answers are missing, just write a warm, helpful reply from the conversation. Never mention that any information is missing.`;

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

// Defense in depth: even with the strict system prompt, never let reasoning,
// separators, em dashes, or emojis reach the customer.
function sanitizeReply(text) {
  let t = String(text || '');
  // If the model emitted a "---" separator, keep only what follows the last one.
  const parts = t.split(/\n?\s*-{3,}\s*\n?/);
  if (parts.length > 1) t = parts[parts.length - 1];
  // Drop surrounding quotes the model sometimes adds.
  t = t.trim().replace(/^["'“”]+|["'“”]+$/g, '');
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

module.exports = { smartReply, SMART_REPLY_SYSTEM, sanitizeReply };
