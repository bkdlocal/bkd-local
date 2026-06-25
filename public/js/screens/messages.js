async function renderMessages() {
  let data;
  try {
    data = await Api.getMessages();
  } catch (e) {
    return renderMessagesError(e.message);
  }
  const conversations = data.conversations || [];
  const unreadTotal = conversations.reduce((s, c) => s + (c.unread || 0), 0);

  return `
    <div class="screen">
      ${renderLogoBar()}

      <div class="top-nav">
        <div>
          <div class="greeting-sub">${unreadTotal ? `${unreadTotal} unread` : 'All caught up'}</div>
          <div class="greeting-name">Messages</div>
        </div>
      </div>

      <div class="scroll-content">
        ${conversations.length === 0
          ? renderMessagesEmpty(data.note)
          : conversations.map(renderConversationRow).join('')}
      </div>

      ${renderBottomNav('messages')}
    </div>
  `;
}

function renderConversationRow(c) {
  const unread = c.unread > 0;
  const preview = c.lastFrom === 'baker' ? `You: ${c.lastMessage}` : c.lastMessage;
  return `
    <button
      type="button"
      class="conv-row ${unread ? 'conv-unread' : ''}"
      data-action="conversation:open"
      data-id="${c.id}"
    >
      <div class="conv-avatar" style="background: ${avatarGradient(c.customerName)};">
        ${initials(c.customerName)}
      </div>
      <div class="conv-body">
        <div class="conv-row-top">
          <div class="conv-name">${c.customerName}</div>
          <div class="conv-time">${formatRelative(c.lastMessageAt)}</div>
        </div>
        <div class="conv-preview">${truncate(preview, 80)}</div>
      </div>
      ${unread ? `<span class="conv-dot" aria-label="${c.unread} unread"></span>` : ''}
    </button>
  `;
}

function renderMessagesEmpty(note) {
  return `
    <div class="messages-empty">
      <div class="messages-empty-emoji"><i class="ti ti-message-circle" aria-hidden="true"></i></div>
      <div class="messages-empty-title">No messages yet</div>
      <div class="messages-empty-sub">
        ${note || "When a customer messages you, you'll see it here."}
      </div>
    </div>
  `;
}

function renderMessagesError(message) {
  return `
    <div class="screen">
      ${renderLogoBar()}
      <div class="top-nav">
        <div>
          <div class="greeting-sub">Something went wrong</div>
          <div class="greeting-name">Messages</div>
        </div>
      </div>
      <div class="scroll-content" style="display:flex;align-items:center;justify-content:center;text-align:center;padding:48px 16px;">
        <div style="color:var(--mauve);font-size:13px;line-height:1.6;">${message}</div>
      </div>
      ${renderBottomNav('messages')}
    </div>
  `;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function formatRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}
