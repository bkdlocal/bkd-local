// Menu Item — add/edit form for a baker's product catalog entry

const PRODUCT_TYPES = [
  { id: 'sugarCookies', label: 'Decorated Sugar Cookies', icon: 'ti-cookie' },
  { id: 'cakes',        label: 'Cakes',                   icon: 'ti-cake' },
  { id: 'cupcakes',     label: 'Cupcakes',                icon: 'ti-cake' },
  { id: 'macarons',     label: 'Macarons',                icon: 'ti-cake' },
  { id: 'dropCookies',  label: 'Drop Cookies / Bars / Brownies', icon: 'ti-cookie' },
  { id: 'cinnamonRolls', label: 'Cinnamon Rolls',         icon: 'ti-cake' },
  { id: 'pies',          label: 'Pies',                   icon: 'ti-cake' },
  { id: 'breads',        label: 'Breads',                 icon: 'ti-bread' }
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
      state.emoji = existing.emoji || '';
      state.price = existing.price ?? 0;
      state.productType = existing.productType || null;
      state.soldBy = existing.soldBy || null;
      state.occasionTags = Array.isArray(existing.occasionTags) ? [...existing.occasionTags] : [];
      state.addOns = Array.isArray(existing.addOns) ? existing.addOns.map(a => ({ ...a })) : [];
      state.typeFields = existing.typeFields && typeof existing.typeFields === 'object' ? { ...existing.typeFields } : {};
      state.batchSize = existing.batchSize ?? null;
      state.batchUnit = existing.batchUnit || null;
      state.minimumQuantity = existing.minimumQuantity ?? null;
      state.photos = Array.isArray(existing.photos) ? [...existing.photos] : [];
    } else {
      state.name = '';
      state.emoji = '';
      state.price = 0;
      state.productType = null;
      state.soldBy = null;
      state.occasionTags = [];
      state.addOns = [];
      state.typeFields = {};
      state.batchSize = null;
      state.batchUnit = null;
      state.minimumQuantity = null;
      state.photos = [];
    }
    state.initialized = true;
    Router.state.menuItem = state;
  }

  const isNew = !itemId;
  const title = isNew ? 'New Item' : 'Edit Item';
  const subtext = isNew ? 'Add to My Menu' : (state.name || 'Menu item');

  return `
    <div class="screen">
      ${renderLogoBar()}
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
        ${renderMiPhotosSection(state)}
        ${renderMiFooter(state, isNew)}
      </div>
    </div>
  `;
}

function renderMiBasicsSection(state) {
  const unit = miPerUnitLabel(state.soldBy);
  return `
    <div class="pmb-section">
      <div class="pmb-section-label">Item name</div>
      <input type="text" class="pmb-input mi-name-input"
        value="${escapeMiAttr(state.name)}"
        oninput="onMiNameInput(event)"
        placeholder='e.g., "Custom Decorated Sugar Cookies"' />

      <div class="pmb-section-label" style="margin-top:16px;">Base price</div>
      <div class="mi-price-row" style="display:flex;align-items:center;gap:8px;">
        <span class="mi-price-dollar">$</span>
        <input type="number" step="0.01" min="0" class="pmb-input mi-narrow-input"
          value="${state.price ? escapeMiAttr(state.price) : ''}"
          oninput="onMiBasePriceInput(event)"
          placeholder="0.00" />
        <span class="mi-price-unit" style="color:var(--mauve);font-size:13px;">${unit ? 'per ' + escapeMiHtml(unit) : ''}</span>
      </div>

      <div class="pmb-section-label" style="margin-top:16px;">Minimum order</div>
      <input type="number" step="1" min="1" class="pmb-input mi-narrow-input"
        value="${state.minimumQuantity ? escapeMiAttr(state.minimumQuantity) : ''}"
        oninput="onMiMinQtyInput(event)"
        placeholder="No minimum" />
      <div class="mi-hint" style="margin-top:6px;">e.g. 2 if you require at least 2 dozen.</div>

      <button type="button" class="mi-price-magic-link" data-action="menuItem:priceCheck">
        <span class="mi-price-magic-spark" aria-hidden="true">✦</span>
        <span class="mi-price-magic-text">
          <span class="mi-price-magic-title">Are you actually making money on this?</span>
          <span class="mi-price-magic-sub">Enter your recipe in the Magic Pricing Calculator to find out</span>
        </span>
        <span class="mi-price-magic-arrow" aria-hidden="true">›</span>
      </button>
    </div>
  `;
}

function miPerUnitLabel(soldBy) {
  if (soldBy === 'dozen') return 'dozen';
  if (soldBy === 'halfDozen') return 'half dozen';
  if (soldBy === 'individual') return 'each';
  return '';
}

function renderMiPhotosSection(state) {
  const photos = Array.isArray(state.photos) ? state.photos : [];
  const tiles = photos.map((url, i) => `
    <div class="mi-photo-tile${i === 0 ? ' mi-photo-cover' : ''}" style="position:relative;width:84px;height:84px;border-radius:10px;overflow:hidden;background:#f3e9ef;">
      <img src="${escapeMiAttr(url)}" alt="Photo ${i + 1}" style="width:100%;height:100%;object-fit:cover;" />
      ${i === 0
        ? '<span class="mi-photo-badge" style="position:absolute;left:4px;bottom:4px;background:rgba(0,0,0,.6);color:#fff;font-size:10px;padding:1px 5px;border-radius:6px;">Cover</span>'
        : `<button type="button" class="mi-photo-cover-btn" data-action="menuItem:makeCover" data-id="${i}" style="position:absolute;left:4px;bottom:4px;background:rgba(0,0,0,.55);color:#fff;font-size:10px;padding:1px 5px;border-radius:6px;border:0;">Make cover</button>`}
      <button type="button" class="mi-photo-remove" data-action="menuItem:removePhoto" data-id="${i}" aria-label="Remove photo"
        style="position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:999px;border:0;background:rgba(0,0,0,.6);color:#fff;line-height:1;">×</button>
    </div>
  `).join('');
  const canAdd = photos.length < 7;
  return `
    <div class="pmb-section">
      <div class="pmb-section-label">Photos <span class="mi-hint">${photos.length}/7 · first photo is the cover</span></div>
      <div class="mi-photo-grid" style="display:flex;flex-wrap:wrap;gap:10px;">
        ${tiles}
        ${canAdd ? `
          <label class="mi-photo-add" style="width:84px;height:84px;border:1.5px dashed var(--mauve-soft);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--mauve);cursor:pointer;">
            <input type="file" accept="image/*" multiple hidden onchange="onMiPhotoFilesChange(event)" />
            <span style="font-size:22px;line-height:1;">+</span>
            <span style="font-size:11px;">Add photo</span>
          </label>
        ` : ''}
      </div>
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
            <div class="mi-type-emoji"><i class="ti ${t.icon}" aria-hidden="true"></i></div>
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
    case 'cinnamonRolls':
    case 'pies':
    case 'breads':       return renderMiSimpleType(state);
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
        : state.addOns.map((a, idx) => {
            const unit = a.priceUnit === 'per_set' ? 'per_set' : 'per_cookie';
            return `
            <div class="mi-addon-row">
              <input type="text" class="pmb-input mi-addon-name"
                value="${escapeMiAttr(a.name || '')}"
                oninput="onMiAddonNameInput(event, ${idx})"
                placeholder="e.g., Printed image" />
              <button type="button" class="mi-addon-remove"
                data-action="menuItem:removeAddon" data-id="${idx}" aria-label="Remove">×</button>
              <div class="mi-addon-price-block">
                <div class="mi-addon-price-label">Price is per:</div>
                <div class="mi-addon-unit-row">
                  <button type="button"
                    class="pill ${unit === 'per_cookie' ? 'pill-active' : 'pill-inactive'}"
                    data-action="menuItem:setAddonUnit" data-id="${idx}" data-value="per_cookie">per cookie</button>
                  <button type="button"
                    class="pill ${unit === 'per_set' ? 'pill-active' : 'pill-inactive'}"
                    data-action="menuItem:setAddonUnit" data-id="${idx}" data-value="per_set">per set/order</button>
                </div>
                <div class="mi-addon-price-input-row">
                  <span class="mi-addon-dollar">$</span>
                  <input type="number" step="0.01" min="0" class="pmb-input mi-addon-price"
                    value="${a.price ?? ''}"
                    oninput="onMiAddonPriceInput(event, ${idx})"
                    placeholder="0.00" />
                </div>
              </div>
            </div>
          `;
          }).join('')}
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

// Cinnamon Rolls / Pies / Breads: sold-by selector + flavors + occasions.
function renderMiSimpleType(state) {
  const tf = state.typeFields;
  return `
    <div class="pmb-section">
      ${renderSoldByPills(state)}
      <div class="pmb-section-label">Flavors</div>
      <textarea class="pmb-input mi-textarea" rows="3"
        oninput="onMiFlavorsInput(event)"
        placeholder="e.g., Classic, seasonal, gluten free">${escapeMiHtml(tf.flavors || '')}</textarea>
      ${renderOccasionTags(state)}
    </div>
  `;
}

function renderMiFooter(state, isNew) {
  const saveDisabled = !miIsValid(state);
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
      ${renderLogoBar()}
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

function miIsValid(s) {
  if (!s) return false;
  const photos = Array.isArray(s.photos) ? s.photos.filter(Boolean) : [];
  return !!(s.name && s.name.trim() && s.productType && s.soldBy && Number(s.price) > 0 && photos.length >= 1);
}

function onMiNameInput(e) {
  const s = Router.state.menuItem;
  if (!s) return;
  s.name = e.target.value;
  miUpdateSaveButton();
}

function onMiBasePriceInput(e) {
  const s = Router.state.menuItem;
  if (!s) return;
  s.price = parseFloat(e.target.value) || 0;
  miUpdateSaveButton();
}

async function onMiPhotoFilesChange(e) {
  const s = Router.state.menuItem;
  if (!s) return;
  s.photos = Array.isArray(s.photos) ? s.photos : [];
  const files = Array.from(e.target.files || []);
  const room = 7 - s.photos.length;
  if (files.length > room) alert('You can add up to 7 photos per item.');
  for (const f of files.slice(0, Math.max(0, room))) {
    try {
      const r = await Api.uploadPhoto(f);
      if (r && r.url) s.photos.push(r.url);
    } catch (err) { alert(err.message); }
  }
  Router.refresh({ keepScroll: true });
}

function onMiMinQtyInput(e) {
  const s = Router.state.menuItem;
  if (!s) return;
  const v = parseInt(e.target.value, 10);
  s.minimumQuantity = Number.isFinite(v) && v > 0 ? v : null;
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
  const disabled = !miIsValid(s);
  btn.disabled = disabled;
  btn.classList.toggle('mi-save-disabled', disabled);
}

function escapeMiHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeMiAttr(s) { return escapeMiHtml(s); }
