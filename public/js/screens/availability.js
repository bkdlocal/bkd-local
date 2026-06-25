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

async function renderAvailability(state = {}) {
  const today = todayISO();
  const { year: ty, month: tm } = parseISO(today);

  const viewYear = state.viewYear ?? ty;
  const viewMonth = state.viewMonth ?? tm;
  const selectedDate = state.selectedDate || null;

  let availability;
  try {
    availability = await Api.getAvailability();
  } catch (e) {
    return renderAvailabilityError(e.message);
  }

  const slotsByDate = new Map();
  availability.slots.forEach(s => slotsByDate.set(s.date, s));

  const calendar = buildCalendar(viewYear, viewMonth, today, slotsByDate, selectedDate);
  const selectedSlot = selectedDate ? slotsByDate.get(selectedDate) : null;

  const upcoming = availability.slots
    .filter(s => s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

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
        ${renderAcceptingCard(availability.acceptingOrders)}
        ${renderCalendarCard(calendar, viewYear, viewMonth)}
        ${renderLegend()}
        ${renderActionCard(selectedDate, selectedSlot, today)}
        ${renderUpcoming(upcoming)}
      </div>

      ${renderBottomNav('availability')}
    </div>
  `;
}

function buildCalendar(year, month, today, slotsByDate, selectedDate) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstWeekday; i++) cells.push({ blank: true });

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = isoDate(year, month, day);
    cells.push({
      day,
      iso,
      isPast: iso < today,
      isToday: iso === today,
      isSelected: iso === selectedDate,
      hasSlot: slotsByDate.has(iso)
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
          <div class="toggle-sub">${accepting
            ? 'You appear in the customer directory.'
            : 'Your profile is hidden from customers.'}</div>
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
  else if (cell.isSelected) classes.push('cal-selected');
  else if (cell.hasSlot) classes.push('cal-slot');
  else classes.push('cal-available');
  if (cell.isToday) classes.push('cal-today');

  const interactive = !cell.isPast;
  return `
    <button
      type="button"
      class="${classes.join(' ')}"
      ${interactive ? `data-action="availability:selectDate" data-date="${cell.iso}"` : 'disabled'}
    >${cell.day}</button>
  `;
}

function renderLegend() {
  return `
    <div class="cal-legend">
      <div class="legend-item"><span class="legend-dot legend-selected"></span>Selected</div>
      <div class="legend-item"><span class="legend-dot legend-available"></span>Available</div>
      <div class="legend-item"><span class="legend-dot legend-past"></span>Past</div>
    </div>
  `;
}

function renderActionCard(selectedDate, selectedSlot, today) {
  if (!selectedDate) {
    return `
      <button type="button" class="btn-add-pickup" disabled>+ Add Pickup Date</button>
      <div class="action-hint">Tap a future date on the calendar to begin.</div>
    `;
  }
  const { weekdayFull } = formatSlotDate(selectedDate);
  const { month, day } = parseISO(selectedDate);
  const dateLabel = `${MONTH_NAMES[month]} ${day}`;

  if (selectedSlot) {
    return `
      <div class="avail-card slot-edit-card">
        <div class="slot-edit-title">${weekdayFull}, ${dateLabel}</div>
        <div class="slot-edit-sub">Editing pickup slots</div>
        <div class="slot-stepper">
          <button type="button" class="step-btn" data-action="availability:editSlot" data-id="${selectedSlot.id}" data-delta="-1">−</button>
          <div class="step-value">${selectedSlot.slotsAvailable}</div>
          <button type="button" class="step-btn" data-action="availability:editSlot" data-id="${selectedSlot.id}" data-delta="+1">+</button>
          <div class="step-label">slot${selectedSlot.slotsAvailable === 1 ? '' : 's'}</div>
        </div>
        <button type="button" class="btn-remove-slot" data-action="availability:removeSlot" data-id="${selectedSlot.id}">Remove this pickup date</button>
      </div>
    `;
  }
  return `
    <button type="button" class="btn-add-pickup" data-action="availability:addSlot" data-date="${selectedDate}">
      + Add Pickup Date
    </button>
    <div class="action-hint">${weekdayFull}, ${dateLabel}</div>
  `;
}

function renderUpcoming(slots) {
  if (slots.length === 0) {
    return `
      <div class="upcoming-section">
        <div class="sub-label">Upcoming Pickups</div>
        <div class="upcoming-empty">No upcoming pickup dates yet. Tap a date above to add one.</div>
      </div>
    `;
  }
  return `
    <div class="upcoming-section">
      <div class="sub-label">Upcoming Pickups</div>
      ${slots.map(renderUpcomingRow).join('')}
    </div>
  `;
}

function renderUpcomingRow(slot) {
  const { day, month, weekdayFull } = formatSlotDate(slot.date);
  const isFull = slot.slotsFilled >= slot.slotsAvailable;
  const badgeClass = isFull ? 'badge-full' : 'badge-open';
  const badgeText = isFull ? 'Full' : 'Open';
  return `
    <button
      type="button"
      class="upcoming-row"
      data-action="availability:selectDate"
      data-date="${slot.date}"
    >
      <div class="upcoming-date">
        <div class="upcoming-day">${day}</div>
        <div class="upcoming-month">${month}</div>
      </div>
      <div class="upcoming-info">
        <div class="upcoming-title">${weekdayFull} pickup</div>
        <div class="upcoming-sub">${slot.slotsFilled} of ${slot.slotsAvailable} confirmed</div>
      </div>
      <span class="slot-badge ${badgeClass}">${badgeText}</span>
    </button>
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
