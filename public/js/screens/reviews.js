async function renderReviews() {
  let data;
  try {
    data = await Api.getReviews();
  } catch (e) {
    return renderReviewsError(e.message);
  }
  const reviews = data.reviews || [];
  const stats = aggregateReviewStats(reviews);

  return `
    <div class="screen">
      ${renderStatusBar()}

      <div class="pmb-top-nav">
        <button class="pmb-back" type="button" data-action="nav:back" aria-label="Back">‹</button>
        <div class="pmb-top-text">
          <div class="greeting-sub">${stats.count ? `${stats.count} review${stats.count === 1 ? '' : 's'}` : 'No reviews yet'}</div>
          <div class="greeting-name">My Reviews</div>
        </div>
        <div class="pmb-top-spacer"></div>
      </div>

      <div class="scroll-content pmb-scroll">
        ${reviews.length === 0 ? renderReviewsEmpty() : `
          ${renderReviewsSummary(stats)}
          ${reviews.map(renderReviewCard).join('')}
        `}
      </div>

      ${renderBottomNav('home')}
    </div>
  `;
}

function aggregateReviewStats(reviews) {
  if (!reviews.length) {
    return { count: 0, average: 0, breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
  }
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;
  reviews.forEach(r => {
    const rating = Math.max(1, Math.min(5, Math.round(r.rating)));
    breakdown[rating] = (breakdown[rating] || 0) + 1;
    sum += r.rating;
  });
  return {
    count: reviews.length,
    average: sum / reviews.length,
    breakdown
  };
}

function renderReviewsSummary(stats) {
  const avgText = stats.average.toFixed(1);
  return `
    <div class="reviews-summary-card">
      <div class="reviews-summary-top">
        <div>
          <div class="reviews-summary-avg">${avgText}</div>
          <div class="reviews-summary-stars">${renderStarRow(stats.average, 'lg')}</div>
          <div class="reviews-summary-count">Based on ${stats.count} review${stats.count === 1 ? '' : 's'}</div>
        </div>
      </div>
      <div class="reviews-bars">
        ${[5, 4, 3, 2, 1].map(n => renderReviewBar(n, stats.breakdown[n], stats.count)).join('')}
      </div>
    </div>
  `;
}

function renderReviewBar(stars, count, total) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return `
    <div class="reviews-bar-row">
      <div class="reviews-bar-label">${stars} ★</div>
      <div class="reviews-bar-track">
        <div class="reviews-bar-fill" style="width: ${pct}%;"></div>
      </div>
      <div class="reviews-bar-count">${count}</div>
    </div>
  `;
}

function renderStarRow(rating, size = 'md') {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= full) stars += '★';
    else if (i === full + 1 && half) stars += '★';
    else stars += '☆';
  }
  return `<span class="star-row star-${size}">${stars}</span>`;
}

function renderReviewCard(r) {
  const city = r.reviewerCity ? ` · ${r.reviewerCity}` : '';
  return `
    <div class="review-card">
      <div class="review-card-top">
        <div class="review-avatar" style="background: ${avatarGradient(r.reviewerName)};">
          ${initials(r.reviewerName)}
        </div>
        <div class="review-meta">
          <div class="review-name">${r.reviewerName}${city}</div>
          <div class="review-sub">${renderStarRow(r.rating, 'sm')} <span class="review-dot">·</span> ${formatReviewDate(r.date)}</div>
        </div>
      </div>
      <div class="review-item-row">Ordered: <span>${r.item}</span></div>
      <div class="review-text">${escapeHtml(r.text)}</div>
    </div>
  `;
}

function renderReviewsEmpty() {
  return `
    <div class="reviews-empty">
      <div class="reviews-empty-emoji">⭐</div>
      <div class="reviews-empty-title">No reviews yet</div>
      <div class="reviews-empty-sub">
        After a customer picks up, Bkd Local sends them a review request 24 hours later. Their reviews will show up here.
      </div>
    </div>
  `;
}

function renderReviewsError(message) {
  return `
    <div class="screen">
      ${renderStatusBar()}
      <div class="pmb-top-nav">
        <button class="pmb-back" type="button" data-action="nav:back" aria-label="Back">‹</button>
        <div class="pmb-top-text">
          <div class="greeting-sub">Something went wrong</div>
          <div class="greeting-name">My Reviews</div>
        </div>
        <div class="pmb-top-spacer"></div>
      </div>
      <div class="scroll-content" style="display:flex;align-items:center;justify-content:center;text-align:center;padding:48px 16px;">
        <div style="color:var(--mauve);font-size:13px;line-height:1.6;">${message}</div>
      </div>
      ${renderBottomNav('home')}
    </div>
  `;
}

function formatReviewDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-US', sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
