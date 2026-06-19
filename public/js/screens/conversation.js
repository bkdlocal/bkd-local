async function renderConversation(state = {}) {
  const id = state.conversationId;
  if (!id) return renderConversationError('No conversation selected.');

  let conv;
  try {
    conv = await Api.getConversation(id);
  } catch (e) {
    return renderConversationError(e.message);
  }

  if (conv.unread > 0) {
    Api.markConversationRead(id).catch(() => {});
  }

  const grouped = groupByDay(conv.messages);
  const lastFromCustomer = lastIsCustomer(conv.messages);
  const suggestion = state.suggestion || null;
  const suggestionLoading = !!state.suggestionLoading;
  const draft = state.draft != null ? state.draft : '';

  return `
    <div class="screen">
      ${renderStatusBar()}

      <div class="conv-header">
        <button class="detail-back" type="button" data-action="nav:back" aria-label="Back">‹</button>
        <div class="conv-header-avatar" style="background: ${avatarGradient(conv.customerName)};">
          ${initials(conv.customerName)}
        </div>
        <div class="conv-header-info">
          <div class="conv-header-name">${conv.customerName}</div>
          <div class="conv-header-status"><span class="presence-dot"></span>Active recently</div>
        </div>
      </div>

      <div class="scroll-content conv-thread">
        ${grouped.map(renderDayGroup).join('')}
      </div>

      <div class="conv-composer">
        ${renderSmartReplyCard(suggestion, suggestionLoading, lastFromCustomer, id)}

        <form class="composer-row" data-action="conversation:send" data-id="${id}">
          <textarea
            name="text"
            class="composer-input"
            placeholder="Write a message…"
            rows="1"
          >${escapeAttr(draft)}</textarea>
          <button type="submit" class="composer-send" aria-label="Send">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </form>
      </div>
    </div>
  `;
}

function groupByDay(messages) {
  const groups = [];
  let currentKey = null;
  for (const m of messages) {
    const d = new Date(m.sentAt);
    const key = d.toDateString();
    if (key !== currentKey) {
      groups.push({ label: formatDayLabel(d), messages: [] });
      currentKey = key;
    }
    groups[groups.length - 1].messages.push(m);
  }
  return groups;
}

function formatDayLabel(d) {
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return 'Today';
  const yesterday = new Date(now.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-US', sameYear
    ? { weekday: 'long', month: 'long', day: 'numeric' }
    : { month: 'long', day: 'numeric', year: 'numeric' });
}

function renderDayGroup(group) {
  return `
    <div class="day-divider">${group.label}</div>
    ${group.messages.map(renderBubble).join('')}
  `;
}

function renderBubble(m) {
  const isBaker = m.from === 'baker';
  return `
    <div class="bubble-row ${isBaker ? 'bubble-row-baker' : 'bubble-row-customer'}">
      <div class="bubble ${isBaker ? 'bubble-baker' : 'bubble-customer'}">
        <div class="bubble-text">${escapeHtml(m.text)}</div>
        <div class="bubble-time">${formatBubbleTime(m.sentAt)}</div>
      </div>
    </div>
  `;
}

function renderSmartReplyCard(suggestion, loading, lastFromCustomer, id) {
  if (!lastFromCustomer) {
    return ''; // baker already replied last — nothing to suggest
  }
  if (loading) {
    return `
      <div class="smart-reply-card">
        <div class="smart-reply-label">✨ Smart Reply — from your FAQ answers</div>
        <div class="smart-reply-bubble smart-reply-loading">Thinking…</div>
      </div>
    `;
  }
  if (suggestion) {
    return `
      <div class="smart-reply-card">
        <div class="smart-reply-label">✨ Smart Reply — from your FAQ answers</div>
        <button type="button" class="smart-reply-bubble" data-action="conversation:useSuggestion">
          ${escapeHtml(suggestion)}
        </button>
        <div class="smart-reply-hint">Tap to use · edit before sending</div>
      </div>
    `;
  }
  return `
    <div class="smart-reply-card">
      <div class="smart-reply-label">✨ Smart Reply — from your FAQ answers</div>
      <button type="button" class="smart-reply-fetch" data-action="conversation:fetchSuggestion" data-id="${id}">
        Suggest a reply
      </button>
    </div>
  `;
}

function lastIsCustomer(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].from === 'baker') return false;
    if (messages[i].from === 'customer') return true;
  }
  return false;
}

function formatBubbleTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function renderConversationError(message) {
  return `
    <div class="screen">
      ${renderStatusBar()}
      <div class="conv-header">
        <button class="detail-back" type="button" data-action="nav:back" aria-label="Back">‹</button>
        <div class="conv-header-info">
          <div class="conv-header-name">Conversation</div>
          <div class="conv-header-status">${escapeHtml(message)}</div>
        </div>
      </div>
      <div class="scroll-content"></div>
    </div>
  `;
}
