// Baker AI FAQ chat widget screen. Driven by data-action handlers in app.js
// (faq:send / faq:pill) since the SPA renders screens via innerHTML.
async function renderFaq() {
  const pills = ['When do I get paid?', 'How do I go live?', 'What is the platform fee?'];
  return `
    <div class="screen">
      ${renderLogoBar()}
      <div class="scroll-content">
        <section class="dash-hero">
          <div class="dash-eyebrow">Baker resources</div>
          <h1 class="dash-greeting">Ask us anything.</h1>
        </section>

        <div class="faq-widget faq-widget-app">
          <div class="faq-thread" id="faqThread">
            <div class="faq-suggestions" id="faqSuggestions">
              ${pills.map(q => `<button type="button" class="faq-pill" data-action="faq:pill" data-q="${escapeFaqAttr(q)}">${escapeFaqHtml(q)}</button>`).join('')}
            </div>
          </div>
          <form class="faq-inputbar" data-action="faq:send">
            <input name="question" id="faqInput" type="text" placeholder="Ask a question..." autocomplete="off" aria-label="Ask a question">
            <button type="submit" class="faq-send" aria-label="Send">Send</button>
          </form>
        </div>
      </div>
      ${renderBottomNav('faq')}
    </div>
  `;
}

function escapeFaqHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeFaqAttr(s) { return escapeFaqHtml(s).replace(/"/g, '&quot;'); }
