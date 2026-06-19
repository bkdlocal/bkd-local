// Menu Item — add/edit form for a baker's product catalog entry

const PRODUCT_TYPES = [
  { id: 'sugarCookies', label: 'Decorated Sugar Cookies', emoji: '🍪' },
  { id: 'cakes',        label: 'Cakes',                   emoji: '🎂' },
  { id: 'cupcakes',     label: 'Cupcakes',                emoji: '🧁' },
  { id: 'macarons',     label: 'Macarons',                emoji: '🌸' },
  { id: 'dropCookies',  label: 'Drop Cookies / Bars / Brownies', emoji: '🍫' }
];

const OCCASION_TAGS = [
  { id: 'birthday',    label: 'Birthday' },
  { id: 'wedding',     label: 'Wedding' },
  { id: 'anniversary', label: 'Anniversary' },
  { id: 'babyShower',  label: 'Baby shower' },
  { id: 'holiday',     label: 'Holiday' },
  { id: 'graduation',  label: 'Graduation' },
  { id: 'other',       label: 'Other' }
];

const SOLD_BY_OPTIONS = [
  { id: 'dozen',      label: 'Dozen' },
  { id: 'halfDozen',  label: 'Half dozen' },
  { id: 'individual', label: 'Individual' }
];

const CAKE_SIZES = ['6"', '8"', '10"', '12"'];
const LAYERS_PER_TIER = [2, 3];
const TIER_COUNTS = [1, 2, 3, 4];

const SERVING_CHART = {
  sizes: [
    ['6"',  '8–12 servings'],
    ['8"',  '16–24 servings'],
    ['10"', '24–38 servings'],
    ['12"', '40–50 servings']
  ],
  tiers: [
    ['2-tier 6"+8"',      '~30'],
    ['2-tier 8"+10"',     '~50'],
    ['3-tier 6"+8"+10"',  '~65–75'],
    ['3-tier 8"+10"+12"', '~90–115']
  ]
};

function productTypeLabel(id) {
  const t = PRODUCT_TYPES.find(x => x.id === id);
  return t ? t.label : '';
}

function soldByLabel(id) {
  const o = SOLD_BY_OPTIONS.find(x => x.id === id);
  return o ? o.label : '';
}

async function renderMenuItem(state = {}) {
  const itemId = state.itemId || null;
  let existing = null;
  if (itemId) {
    try {
      existing = await Api.getMenuItem(itemId);
    } catch (e) {
      return renderMenuItemError(e.message);
    }
  }

  if (!state.initialized) {
    if (existing) {
      state.name = existing.name || '';
      state.emoji = existing.emoji || '🧁';
      state.price = existing.price ?? 0;
      state.productType = existing.productType || null;
      state.soldBy = existing.soldBy || null;
      state.occasionTags = Array.isArray(existing.occasionTags) ? [...existing.occasionTags] : [];
      state.addOns = Array.isArray(existing.addOns) ? existing.addOns.map(a => ({ ...a })) : [];
      state.typeFields = existing.typeFields && typeof existing.typeFields === 'object' ? { ...existing.typeFields } : {};
      state.batchSize = existing.batchSize ?? null;
      state.batchUnit = existing.batchUnit || null;
    } else {
      state.name = '';
      state.emoji = '🧁';
      state.price = 0;
      state.productType = null;
      state.soldBy = null;
      state.occasionTags = [];
      state.addOns = [];
      state.typeFields = {};
      state.batchSize = null;
      state.batchUnit = null;
    }
    state.initialized = true;
    Router.state.menuItem = state;
  }

  const isNew = !itemId;
  const title = isNew ? 'New Item' : 'Edit Item';
  const subtext = isNew ? 'Add to My Menu' : (state.name || 'Menu item');

  return `
    <div class="screen">
      ${renderStatusBar()}
      <div class="pmb-top-nav">
        <button type="button" class="pmb-back" data-action="menuItem:cancel" aria-label="Back">‹</button>
        <div class="pmb-top-text">
          <div class="greeting-sub">${escapeMiHtml(subtext)}</div>
          <div class="greeting-name">${title}</div>
        </div>
        <div class="pmb-top-spacer"></div>
      </div>
      <div class="scroll-content mi-scroll">
        ${renderMiBasicsSection(state)}
        ${renderMiTypePicker(state)}
        ${state.productType ? renderMiTypeDetails(state) : ''}
        ${renderMiFooter(state, isNew)}
      </div>
    </div>
  `;
}

function renderMiBasicsSection(state) {
  return `
    <div class="pmb-section">
      <div class="pmb-section-label">Item name</div>
      <input type="text" class="pmb-input mi-name-input"
        value="${escapeMiAttr(state.name)}"
        oninput="onMiNameInput(event)"
        placeholder='e.g., "Custom Decorated Sugar Cookies"' />
    </div>
  `;
}

function renderMiTypePicker(state) {
  return `
    <div class="pmb-section">
      <div class="pmb-section-label">Product type</div>
      <div class="mi-type-grid">
        ${PRODUCT_TYPES.map(t => `
          <button type="button"
            class="mi-type-card ${state.productType === t.id ? 'mi-type-selected' : ''}"
            data-action="menuItem:setType" data-value="${t.id}">
            <div class="mi-type-emoji">${t.emoji}</div>
            <div class="mi-type-label">${t.label}</div>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderMiTypeDetails(state) {
  switch (state.productType) {
    case 'sugarCookies': return renderMiSugarCookies(state);
    case 'cakes':        return renderMiCakes(state);
    case 'cupcakes':     return renderMiCupcakes(state);
    case 'macarons':     return renderMiMacarons(state);
    case 'dropCookies':  return renderMiDropCookies(state);
    default: return '';
  }
}

function renderSoldByPills(state, options = SOLD_BY_OPTIONS) {
  return `
    <div class="pmb-section-label">Sold by</div>
    <div class="mi-pill-row">
      ${options.map(o => `
        <button type="button"
          class="pill ${state.soldBy === o.id ? 'pill-active' : 'pill-inactive'}"
          data-action="menuItem:setSoldBy" data-value="${o.id}">${o.label}</button>
      `).join('')}
    </div>
  `;
}

function renderOccasionTags(state) {
  return `
    <div class="pmb-section-label">Occasions</div>
    <div class="mi-tag-row">
      ${OCCASION_TAGS.map(t => `
        <button type="button"
          class="pill ${state.occasionTags.includes(t.id) ? 'pill-active' : 'pill-inactive'}"
          data-action="menuItem:toggleTag" data-value="${t.id}">${t.label}</button>
      `).join('')}
    </div>
  `;
}

function renderAddOnsList(state) {
  return `
    <div class="pmb-section-label">Add-ons</div>
    <div class="mi-addon-list">
      ${state.addOns.length === 0
        ? '<div class="pmb-empty">No add-ons yet.</div>'
        : state.addOns.map((a, idx) => `
            <div class="mi-addon-row">
              <input type="text" class="pmb-input mi-addon-name"
                value="${escapeMiAttr(a.name || '')}"
                oninput="onMiAddonNameInput(event, ${idx})"
                placeholder="e.g., Printed image" />
              <span class="mi-addon-dollar">$</span>
              <input type="number" step="0.01" min="0" class="pmb-input mi-addon-price"
                value="${a.price ?? ''}"
                oninput="onMiAddonPriceInput(event, ${idx})"
                placeholder="0.00" />
              <button type="button" class="mi-addon-remove"
                data-action="menuItem:removeAddon" data-id="${idx}" aria-label="Remove">×</button>
            </div>
          `).join('')}
    </div>
    <button type="button" class="pmb-custom-link" data-action="menuItem:addAddon">+ Add an add-on</button>
  `;
}

function renderMiSugarCookies(state) {
  return `
    <div class="pmb-section">
      ${renderSoldByPills(state)}
      <div class="pmb-section-label">Max colors per set</div>
      <input type="number" step="1" min="1" class="pmb-input mi-narrow-input"
        value="${state.typeFields.maxColors ?? ''}"
        oninput="onMiMaxColorsInput(event)"
        placeholder="e.g., 5" />
      ${renderAddOnsList(state)}
      ${renderOccasionTags(state)}
    </div>
  `;
}

function renderMiCakes(state) {
  const tf = state.typeFields;
  const sizes = Array.isArray(tf.sizes) ? tf.sizes : [];
  return `
    <div class="pmb-section">
      <div class="pmb-section-label">Sizes offered</div>
      <div class="mi-pill-row">
        ${CAKE_SIZES.map(s => `
          <button type="button"
            class="pill ${sizes.includes(s) ? 'pill-active' : 'pill-inactive'}"
            data-action="menuItem:toggleSize" data-value="${escapeMiAttr(s)}">${s}</button>
        `).join('')}
      </div>
      <div class="pmb-section-label">Layers per tier <span class="mi-hint">rounds stacked inside one tier</span></div>
      <div class="mi-pill-row">
        ${LAYERS_PER_TIER.map(n => `
          <button type="button"
            class="pill ${tf.layersPerTier === n ? 'pill-active' : 'pill-inactive'}"
            data-action="menuItem:setLayersPerTier" data-value="${n}">${n}</button>
        `).join('')}
      </div>
      <div class="pmb-section-label">Number of tiers <span class="mi-hint">separate stacked sections</span></div>
      <div class="mi-pill-row">
        ${TIER_COUNTS.map(n => `
          <button type="button"
            class="pill ${tf.tiers === n ? 'pill-active' : 'pill-inactive'}"
            data-action="menuItem:setTiers" data-value="${n}">${n}</button>
        `).join('')}
      </div>
      <div class="pmb-section-label">Finish</div>
      <textarea class="pmb-input mi-textarea" rows="2"
        oninput="onMiFinishInput(event)"
        placeholder="e.g., Buttercream, fondant, hand-painted...">${escapeMiHtml(tf.finish || '')}</textarea>
      ${renderAddOnsList(state)}
      ${renderOccasionTags(state)}
      ${renderServingChart()}
    </div>
  `;
}

function renderServingChart() {
  return `
    <div class="mi-chart">
      <div class="mi-chart-title">Serving size reference</div>
      <div class="mi-chart-section">
        <div class="mi-chart-section-title">Single tier</div>
        ${SERVING_CHART.sizes.map(([s, n]) => `
          <div class="mi-chart-row"><span>${s}</span><span>${n}</span></div>
        `).join('')}
      </div>
      <div class="mi-chart-section">
        <div class="mi-chart-section-title">Tiered</div>
        ${SERVING_CHART.tiers.map(([s, n]) => `
          <div class="mi-chart-row"><span>${s}</span><span>${n}</span></div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderMiCupcakes(state) {
  const tf = state.typeFields;
  const cupcakeSoldBy = SOLD_BY_OPTIONS.filter(o => o.id !== 'individual');
  return `
    <div class="pmb-section">
      ${renderSoldByPills(state, cupcakeSoldBy)}
      <div class="pmb-section-label">Finish</div>
      <textarea class="pmb-input mi-textarea" rows="2"
        oninput="onMiFinishInput(event)"
        placeholder="e.g., Vanilla buttercream swirl, chocolate ganache, salted caramel drizzle">${escapeMiHtml(tf.finish || '')}</textarea>
      ${renderOccasionTags(state)}
    </div>
  `;
}

function renderMiMacarons(state) {
  const tf = state.typeFields;
  return `
    <div class="pmb-section">
      ${renderSoldByPills(state)}
      <div class="pmb-section-label">Flavors</div>
      <textarea class="pmb-input mi-textarea" rows="3"
        oninput="onMiFlavorsInput(event)"
        placeholder="e.g., Vanilla bean, raspberry, pistachio, salted caramel">${escapeMiHtml(tf.flavors || '')}</textarea>
      ${renderOccasionTags(state)}
    </div>
  `;
}

function renderMiDropCookies(state) {
  const tf = state.typeFields;
  return `
    <div class="pmb-section">
      ${renderSoldByPills(state)}
      <div class="pmb-section-label">Flavors</div>
      <textarea class="pmb-input mi-textarea" rows="3"
        oninput="onMiFlavorsInput(event)"
        placeholder="e.g., Chocolate chip, oatmeal raisin, brown butter blondie">${escapeMiHtml(tf.flavors || '')}</textarea>
      ${renderOccasionTags(state)}
    </div>
  `;
}

function renderMiFooter(state, isNew) {
  const saveDisabled = !state.name.trim() || !state.productType;
  return `
    <div class="mi-footer">
      <button type="button"
        class="mi-save-btn ${saveDisabled ? 'mi-save-disabled' : ''}"
        ${saveDisabled ? 'disabled' : ''}
        data-action="menuItem:save">${isNew ? 'Add to My Menu' : 'Save changes'}</button>
      <button type="button" class="mi-cancel-btn" data-action="menuItem:cancel">Cancel</button>
      ${isNew ? '' : '<button type="button" class="mi-delete-btn" data-action="menuItem:delete">Delete item</button>'}
    </div>
  `;
}

function renderMenuItemError(message) {
  return `
    <div class="screen">
      ${renderStatusBar()}
      <div class="pmb-top-nav">
        <button type="button" class="pmb-back" data-action="menuItem:cancel" aria-label="Back">‹</button>
        <div class="pmb-top-text">
          <div class="greeting-sub">Couldn't load item</div>
          <div class="greeting-name">Edit Item</div>
        </div>
        <div class="pmb-top-spacer"></div>
      </div>
      <div class="scroll-content" style="text-align:center;padding:48px 16px;">
        <div style="color:var(--mauve);font-size:13px;">${escapeMiHtml(message)}</div>
      </div>
    </div>
  `;
}

// ─── Live input handlers (no re-render so focus is preserved) ────────────

function onMiNameInput(e) {
  const s = Router.state.menuItem;
  if (!s) return;
  s.name = e.target.value;
  miUpdateSaveButton();
}

function onMiMaxColorsInput(e) {
  const s = Router.state.menuItem;
  if (!s) return;
  const v = parseInt(e.target.value, 10);
  s.typeFields.maxColors = Number.isFinite(v) ? v : null;
}

function onMiFinishInput(e) {
  const s = Router.state.menuItem;
  if (!s) return;
  s.typeFields.finish = e.target.value;
}

function onMiFlavorsInput(e) {
  const s = Router.state.menuItem;
  if (!s) return;
  s.typeFields.flavors = e.target.value;
}

function onMiAddonNameInput(e, idx) {
  const s = Router.state.menuItem;
  if (!s || !s.addOns[idx]) return;
  s.addOns[idx].name = e.target.value;
}

function onMiAddonPriceInput(e, idx) {
  const s = Router.state.menuItem;
  if (!s || !s.addOns[idx]) return;
  s.addOns[idx].price = parseFloat(e.target.value) || 0;
}

function miUpdateSaveButton() {
  const s = Router.state.menuItem;
  if (!s) return;
  const btn = document.querySelector('.mi-save-btn');
  if (!btn) return;
  const disabled = !s.name.trim() || !s.productType;
  btn.disabled = disabled;
  btn.classList.toggle('mi-save-disabled', disabled);
}

function escapeMiHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeMiAttr(s) { return escapeMiHtml(s); }
