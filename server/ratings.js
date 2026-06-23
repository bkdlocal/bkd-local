const RATING_WINDOW_DAYS = 7;

// Rating window: from Fulfilled until 7 days after. We use Pick Up Date as the
// fulfillment reference (the Orders table has no Fulfilled-At timestamp, and
// status is set manually). If pickup date is missing, the window is left open.
function ratingWindowOpen(status, pickupDate, now = Date.now()) {
  if (status !== 'Fulfilled') return false;
  if (!pickupDate) return true;
  const end = Date.parse(String(pickupDate).slice(0, 10) + 'T23:59:59Z');
  if (Number.isNaN(end)) return true;
  return now <= end + RATING_WINDOW_DAYS * 86400000;
}

function validStars(n) {
  const v = Number(n);
  return Number.isInteger(v) && v >= 1 && v <= 5;
}

function average(nums) {
  if (!nums.length) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round((sum / nums.length) * 10) / 10;
}

module.exports = { RATING_WINDOW_DAYS, ratingWindowOpen, validStars, average };
