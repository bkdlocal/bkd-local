const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

const SMART_REPLY_SYSTEM = `You are helping a home baker respond to a customer message. Use the baker's FAQ answers to craft a warm, personal reply that sounds exactly like the baker wrote it herself. Never sound robotic or corporate. Keep it conversational and friendly.`;

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
    `Baker: ${baker.firstName} — signs as "${baker.firstName}"`,
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

function fallbackSuggestion(baker, customerMessage) {
  const first = baker.firstName || 'I';
  return `Thanks for reaching out! Let me check my schedule and confirm a few details, then I'll get back to you with what's possible. — ${first}`;
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
    return { suggestion: text || fallbackSuggestion(baker, customerMessage), source: text ? 'anthropic' : 'fallback' };
  } catch (e) {
    console.error('[smartReply]', e.message);
    return { suggestion: fallbackSuggestion(baker, customerMessage), source: 'fallback', error: e.message };
  }
}

module.exports = { smartReply, SMART_REPLY_SYSTEM };
