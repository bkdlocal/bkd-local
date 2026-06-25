// Minimal .ics (iCalendar) builder for pickup events. All-day on the Pick Up
// Date (Orders has no structured pickup time), with the pickup window text in
// the description. Works in both Apple Calendar and Google Calendar.

function pad(n) { return String(n).padStart(2, '0'); }

// JS Date -> UTC timestamp YYYYMMDDTHHMMSSZ
function icsStamp(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

// 'YYYY-MM-DD' -> 'YYYYMMDD'
function dateValue(ymd) { return String(ymd || '').slice(0, 10).replace(/-/g, ''); }

// Day after 'YYYY-MM-DD' as 'YYYYMMDD' (all-day DTEND is exclusive).
function nextDateValue(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const nd = new Date(Date.UTC(y, m - 1, d + 1));
  return `${nd.getUTCFullYear()}${pad(nd.getUTCMonth() + 1)}${pad(nd.getUTCDate())}`;
}

function escText(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// date is 'YYYY-MM-DD'. stamp optional (defaults to now).
function buildPickupIcs({ uid, date, title, location, description, stamp }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bkd Local//Pickup//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escText(uid)}`,
    `DTSTAMP:${icsStamp(stamp || new Date())}`,
    `DTSTART;VALUE=DATE:${dateValue(date)}`,
    `DTEND;VALUE=DATE:${nextDateValue(date)}`,
    `SUMMARY:${escText(title)}`,
    location ? `LOCATION:${escText(location)}` : null,
    description ? `DESCRIPTION:${escText(description)}` : null,
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean);
  return lines.join('\r\n');
}

module.exports = { buildPickupIcs };
