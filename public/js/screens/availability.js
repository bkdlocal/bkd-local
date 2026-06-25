const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

function formatSlotDate(iso) {
  const { year, month, day } = parseISO(iso);
  const d = new Date(year, month, day);
  return {
    day: String(day),
    month: MONTH_NAMES[month].slice(0, 3).toUpperCase(),
    weekdayFull: WEEKDAY_FULL[d.getDay()]
  };
}

const DOW_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

async function renderAvailability(state = {}) {
  const today = todayISO();
  const { year: ty, month: tm } = parseISO(today);

  const viewYear = state.viewYear ?? ty;
  const viewMonth = state.viewMonth ?? tm;

  let availability;
  try {
    availability = await Api.getAvailability();
  } catch (e) {
    return renderAvailabilityError(e.message);
  }

  // Keep the working copy in Router state so toggles repaint instantly.
  if (!state.hydrated) {
    state.defaultDays = Array.isArray(availability.defaultPickupDays) ? [...availability.defaultPickupDays] : [];
    state.exceptions = new Set(Array.isArray(availability.exceptions) ? availability.exceptions : []);
    state.accepting = !!availability.acceptingOrders;
    state.exceptionsSupported = availability.exceptionsSupported !== false;
    state.hydrated = true;
    Router.state.availability = state;
  }

  const calendar = buildCalendar(viewYear, viewMonth, today, state.defaultDays, state.exceptions);

  return `
    <div class="screen">
      ${renderLogoBar()}

      <div class="top-nav">
        <div>
          <div class="greeting-sub">Manage your pickup days</div>
          <div class="greeting-name">Availability</div>
        </div>
      </div>

      <div class="scroll-content">
        ${renderAcceptingCard(state.accepting)}
        ${renderDayToggles(state.defaultDays)}
        <div class="avail-helper">These are your regular pickup days. Tap any highlighted date on the calendar to mark it as unavailable, for vacations, sick days, or anything that comes up.</div>
        ${renderCalendarCard(calendar, viewYear, viewMonth)}
        ${renderExceptionLegend()}
        ${state.exceptionsSupported ? '' : '<div class="avail-helper" style="color:var(--berry);">Days off can\'t be saved yet. Ask Cowork to add an "Is Exception" field to the Availability table.</div>'}
      </div>

      ${renderBottomNav('availability')}
    </div>
  `;
}

function renderDayToggles(selectedDays) {
  const set = new Set(selectedDays || []);
  return `
    <div class="avail-card">
      <div class="day-toggle-label">Default pickup days</div>
      <div class="day-toggle-row">
        ${DOW_ABBR.map(d => `
          <button type="button"
            class="day-toggle ${set.has(d) ? 'day-toggle-on' : ''}"
            data-action="availability:toggleDay" data-day="${d}"
            aria-pressed="${set.has(d)}">${d}</button>
        `).join('')}
      </div>
    </div>
  `;
}

function buildCalendar(year, month, today, defaultDays, exceptions) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayset = new Set(defaultDays || []);
  const cells = [];

  for (let i = 0; i < firstWeekday; i++) cells.push({ blank: true });

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = isoDate(year, month, day);
    const isDefaultDay = dayset.has(DOW_ABBR[new Date(year, month, day).getDay()]);
    cells.push({
      day,
      iso,
      isPast: iso < today,
      isToday: iso === today,
      isDefaultDay,
      isException: exceptions && exceptions.has(iso)
    });
  }
  return cells;
}

function renderAcceptingCard(accepting) {
  return `
    <div class="avail-card">
      <div class="toggle-row">
        <div class="toggle-text">
          <div class="toggle-title">Taking orders</div>
          <div class="toggle-sub">Turn off to pause all pickups temporarily.</div>
        </div>
        <button
          type="button"
          class="switch ${accepting ? 'switch-on' : 'switch-off'}"
          data-action="availability:toggleAccepting"
          data-value="${accepting ? 'off' : 'on'}"
          aria-pressed="${accepting}"
          aria-label="Taking orders"
        >
          <span class="switch-knob"></span>
        </button>
      </div>
    </div>
  `;
}

function renderCalendarCard(cells, year, month) {
  return `
    <div class="avail-card">
      <div class="cal-header">
        <button class="cal-nav" type="button" data-action="availability:prevMonth" aria-label="Previous month">‹</button>
        <div class="cal-month">${MONTH_NAMES[month]} ${year}</div>
        <button class="cal-nav" type="button" data-action="availability:nextMonth" aria-label="Next month">›</button>
      </div>

      <div class="cal-weekdays">
        ${WEEKDAY_LABELS.map(w => `<div class="cal-weekday">${w}</div>`).join('')}
      </div>

      <div class="cal-grid">
        ${cells.map(renderCalDay).join('')}
      </div>
    </div>
  `;
}

function renderCalDay(cell) {
  if (cell.blank) return `<div class="cal-day cal-blank"></div>`;
  const classes = ['cal-day'];
  if (cell.isPast) classes.push('cal-past');
  else if (cell.isException) classes.push('cal-exception');
  else if (cell.isDefaultDay) classes.push('cal-default');
  else classes.push('cal-plain');
  if (cell.isToday) classes.push('cal-today');

  // Only future default-day dates are tappable (to toggle an exception).
  const interactive = !cell.isPast && (cell.isDefaultDay || cell.isException);
  return `
    <button
      type="button"
      class="${classes.join(' ')}"
      ${interactive ? `data-action="availability:toggleException" data-date="${cell.iso}"` : 'disabled'}
    >${cell.day}</button>
  `;
}

function renderExceptionLegend() {
  return `
    <div class="cal-legend">
      <div class="legend-item"><span class="legend-dot legend-default"></span>Available</div>
      <div class="legend-item"><span class="legend-dot legend-exception"></span>Day off</div>
      <div class="legend-item"><span class="legend-dot legend-past"></span>Past</div>
    </div>
  `;
}

function renderAvailabilityError(message) {
  return `
    <div class="screen">
      ${renderLogoBar()}
      <div class="top-nav">
        <div>
          <div class="greeting-sub">Something went wrong</div>
          <div class="greeting-name">Availability</div>
        </div>
      </div>
      <div class="scroll-content" style="display:flex;align-items:center;justify-content:center;text-align:center;padding:48px 16px;">
        <div style="color:var(--mauve);font-size:13px;line-height:1.6;">${message}</div>
      </div>
      ${renderBottomNav('availability')}
    </div>
  `;
}
