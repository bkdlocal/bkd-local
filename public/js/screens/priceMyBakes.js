// Price My Bakes — recipe + profitability calculator

const PMB_STORES = [
  { id: 'walmart', name: 'Walmart',    dot: '#C2557E' },
  { id: 'kroger',  name: 'Kroger',     dot: '#C2557E' },
  { id: 'aldi',    name: 'Aldi',       dot: '#C2557E' },
  { id: 'sams',    name: "Sam's Club", dot: '#C2557E' }
];

const PMB = {
  catalog: [],
  custom: [],
  catalogById: {},
  unitGroups: {},
  overrides: {},
  supplies: [],
  bakerCache: { feeRate: 0.05 },
  loaded: false
};

async function loadPmbData(force) {
  if (PMB.loaded && !force) return;
  const [ing, ovr, cust, sup] = await Promise.all([
    Api.getIngredients(),
    Api.getIngredientOverrides(),
    Api.getCustomIngredients(),
    Api.getSupplies()
  ]);
  PMB.catalog = ing.catalog || [];
  PMB.unitGroups = ing.unitGroups || {};
  PMB.custom = cust.items || [];
  PMB.overrides = ovr.overrides || {};
  PMB.supplies = sup.supplies || [];
  rebuildCatalogIndex();
  PMB.loaded = true;
}

function rebuildCatalogIndex() {
  PMB.catalogById = {};
  PMB.catalog.forEach(c => { PMB.catalogById[c.id] = c; });
  PMB.custom.forEach(c => { PMB.catalogById[c.id] = { ...c, isCustom: true }; });
}

function escapePmbHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmt(n, decimals = 2) {
  return `$${Number(n || 0).toFixed(decimals)}`;
}

function packagePrice(item, store) {
  if (!item || !item.prices) return 0;
  return item.prices[store] != null ? item.prices[store] : (item.prices.walmart || 0);
}

function effectivePackagePrice(item, store) {
  const override = PMB.overrides[item.id];
  return override != null ? Number(override) : packagePrice(item, store);
}

function ingredientCost(state, ingredient) {
  const item = PMB.catalogById[ingredient.catalogId];
  if (!item) return 0;
  if (item.isCustom) {
    return (Number(item.costPerUse) || 0) * (Number(ingredient.quantity) || 0);
  }
  const pkgPrice = effectivePackagePrice(item, state.store);
  if (!pkgPrice || !item.packageGrams) return 0;
  const ug = PMB.unitGroups[item.unitGroup];
  if (!ug) return 0;
  const factor = ug.toGrams[ingredient.unit];
  if (factor == null) return 0;
  const grams = (Number(ingredient.quantity) || 0) * factor;
  return pkgPrice * (grams / item.packageGrams);
}

function supplyCost(supply) {
  const s = PMB.supplies.find(x => x.id === supply.catalogId);
  if (!s) return 0;
  return (Number(s.pricePerUse) || 0) * (Number(supply.quantity) || 0);
}

function totalFoodCost(state) {
  return (state.ingredients || []).reduce((sum, i) => sum + ingredientCost(state, i), 0);
}

function totalSuppliesCost(state) {
  return (state.supplies || []).reduce((sum, s) => sum + supplyCost(s), 0);
}

async function renderPriceMyBakes(state = {}) {
  await loadPmbData();

  const itemId = state.itemId || null;
  let menuItem = null;
  let savedRecipe = null;

  try {
    if (itemId) {
      menuItem = await Api.getMenuItem(itemId);
      const r = await Api.getRecipe(itemId);
      savedRecipe = r.recipe;
    }
  } catch {}

  const baker = await Api.getBaker();
  PMB.bakerCache = baker;

  if (!state.initialized) {
    if (savedRecipe) {
      state.store = savedRecipe.store || 'walmart';
      state.ingredients = (savedRecipe.ingredients || []).map(i => ({ ...i }));
      state.supplies = (savedRecipe.supplies || []).map(s => ({ ...s }));
      state.listedPrice = savedRecipe.listedPrice ?? (menuItem ? menuItem.price : (state.prefillPrice || 0));
      state.batchSize = savedRecipe.batchSize ?? (menuItem && menuItem.batchSize != null ? menuItem.batchSize : 1);
      state.batchUnit = savedRecipe.batchUnit || (menuItem && (menuItem.batchUnit || menuItem.soldBy)) || 'individual';
    } else {
      state.store = 'walmart';
      state.ingredients = [];
      state.supplies = [];
      state.listedPrice = menuItem ? menuItem.price : (state.prefillPrice || 0);
      state.batchSize = menuItem && menuItem.batchSize != null ? menuItem.batchSize : 1;
      state.batchUnit = (menuItem && (menuItem.batchUnit || menuItem.soldBy)) || 'individual';
    }
    state.initialized = true;
    Router.state.priceMyBakes = state;
  }

  const typeLabel = menuItem && menuItem.productType ? productTypeLabel(menuItem.productType) : '';
  const subtext = menuItem
    ? (typeLabel ? `${menuItem.name} · ${typeLabel}` : `${menuItem.name}`)
    : (state.prefillName ? state.prefillName : 'Recipe & profit');

  return `
    <div class="screen">
      ${renderLogoBar()}
      <div class="pmb-magic-header">
        <span class="pmb-spark pmb-spark-1" aria-hidden="true">✦</span>
        <span class="pmb-spark pmb-spark-2" aria-hidden="true">✦</span>
        <span class="pmb-spark pmb-spark-3" aria-hidden="true">✦</span>
        <div class="pmb-magic-row">
          <button type="button" class="pmb-back" data-action="nav:back" aria-label="Back">‹</button>
          <div class="pmb-magic-headtext">
            <div class="pmb-eyebrow">${escapePmbHtml(subtext)}</div>
            <div class="pmb-title">Magic Pricing Calculator</div>
          </div>
        </div>
        <div class="pmb-free-badge">✦ Free for Beta bakers — for a limited time</div>
      </div>
      <div class="scroll-content pmb-scroll">
        ${renderPmbTimerCard(state)}
        ${menuItem ? renderPmbBatchSection(state) : ''}
        ${renderPmbStoreSection(state)}
        ${renderPmbIngredientsSection(state)}
        ${renderPmbSuppliesSection(state)}
        ${renderPmbSummaryCard(state, baker, menuItem)}
        ${menuItem ? renderPmbPerUnitCard(state, baker) : ''}
      </div>
    </div>
  `;
}

// Bake Timer: idle / running / paused, persisted in localStorage with wall-clock
// elapsed (survives screen lock + refresh). Display, button label, and the
// hourly-rate result are all derived from the persisted timer so a re-render
// always shows the correct state.
function renderPmbTimerCard(state) {
  const t = readBakeTimer();
  const label = t.state === 'running' ? 'Pause' : (t.state === 'paused' ? 'Resume' : 'Start Timer');
  const result = t.result || '';
  return `
    <div class="pmb-timer-card" style="margin-bottom:24px;">
      <span class="pmb-spark pmb-spark-1" aria-hidden="true">✦</span>
      <span class="pmb-spark pmb-spark-2" aria-hidden="true">✦</span>
      <span class="pmb-spark pmb-spark-3" aria-hidden="true">✦</span>
      <div class="pmb-timer-label">✦ Bake Timer</div>
      <div class="pmb-timer-sub">Time this batch to find out what you make per hour</div>
      <div class="pmb-timer-display" id="bakeTimerDisplay">${formatHMS(bakeElapsedMs(t))}</div>
      <div class="pmb-timer-actions">
        <button type="button" class="pmb-timer-start" id="bakeTimerToggle" data-action="pmb:timerToggle">${label}</button>
        <button type="button" class="pmb-timer-reset" data-action="pmb:timerReset">Reset</button>
      </div>
      <div class="pmb-timer-result" id="bakeTimerResult"${result ? '' : ' hidden'}>${escapePmbHtml(result)}</div>
    </div>
  `;
}

function renderPmbBatchSection(state) {
  return `
    <div class="pmb-section pmb-batch-section">
      <div class="pmb-section-label">Batch size</div>
      <div class="pmb-batch-row">
        <span class="pmb-batch-text">This recipe makes</span>
        <input type="number" step="0.5" min="0.5" class="pmb-batch-input"
          value="${state.batchSize}"
          oninput="onPmbBatchSizeInput(event)"
          aria-label="Batch quantity" />
        <select class="pmb-batch-unit" onchange="onPmbBatchUnitChange(event)" aria-label="Batch unit">
          <option value="dozen" ${state.batchUnit === 'dozen' ? 'selected' : ''}>dozen</option>
          <option value="halfDozen" ${state.batchUnit === 'halfDozen' ? 'selected' : ''}>half dozen</option>
          <option value="individual" ${state.batchUnit === 'individual' ? 'selected' : ''}>individual</option>
        </select>
      </div>
    </div>
  `;
}

function piecesPerSellingUnit(unit) {
  if (unit === 'dozen') return 12;
  if (unit === 'halfDozen') return 6;
  return 1;
}

function pmbPerUnitNumbers(state, baker) {
  const totalCost = totalFoodCost(state) + totalSuppliesCost(state);
  const batchSize = Number(state.batchSize) || 1;
  const piecesPerBatch = batchSize * piecesPerSellingUnit(state.batchUnit);
  const costPerPiece = piecesPerBatch > 0 ? totalCost / piecesPerBatch : 0;
  const costPerSellingUnit = batchSize > 0 ? totalCost / batchSize : 0;
  const feeRate = baker && baker.feeRate != null ? baker.feeRate : 0.05;
  const targetMargin = 0.6;
  const divisor = 1 - feeRate - targetMargin;
  const suggested = divisor > 0 ? costPerSellingUnit / divisor : 0;
  const price = Number(state.listedPrice) || 0;
  const profit = price * (1 - feeRate) - costPerSellingUnit;
  const margin = price > 0 ? (profit / price) * 100 : 0;
  return { costPerPiece, costPerSellingUnit, suggested, profit, margin };
}

function pmbUnitLabel(unit) {
  if (unit === 'dozen') return 'dozen';
  if (unit === 'halfDozen') return 'half dozen';
  return 'piece';
}

function renderPmbPerUnitCard(state, baker) {
  const n = pmbPerUnitNumbers(state, baker);
  const unitLabel = pmbUnitLabel(state.batchUnit);
  const showPiece = state.batchUnit !== 'individual';
  return `
    <div class="pmb-perunit-card">
      <div class="pmb-perunit-title">Per-unit breakdown</div>
      ${showPiece ? `
        <div class="pmb-summary-line">
          <span>Cost per piece</span>
          <span id="pmb-cost-per-piece">${fmt(n.costPerPiece)}</span>
        </div>
      ` : ''}
      <div class="pmb-summary-line">
        <span>Cost per ${unitLabel}</span>
        <span id="pmb-cost-per-unit">${fmt(n.costPerSellingUnit)}</span>
      </div>
      <div class="pmb-summary-line pmb-suggested-line">
        <span>Suggested price <span class="pmb-suggested-note">at 60% margin</span></span>
        <span id="pmb-suggested-price">${fmt(n.suggested)}</span>
      </div>
      <div class="pmb-summary-line">
        <span>Profit per ${unitLabel}</span>
        <span id="pmb-profit-per-unit">${fmt(n.profit)}</span>
      </div>
      <div class="pmb-summary-line">
        <span>Margin</span>
        <span id="pmb-margin-per-unit">${Math.round(n.margin)}%</span>
      </div>
    </div>
  `;
}

function renderPmbStoreSection(state) {
  return `
    <div class="pmb-section">
      <div class="pmb-section-label">Where do you shop?</div>
      <div class="pmb-store-grid">
        ${PMB_STORES.map(s => `
          <button type="button"
            class="pmb-store-card ${state.store === s.id ? 'pmb-store-selected' : ''}"
            data-action="pmb:selectStore" data-value="${s.id}">
            <span class="pmb-store-dot" style="background:${s.dot}"></span>
            <span class="pmb-store-name">${s.name}</span>
          </button>
        `).join('')}
      </div>
      <div class="pmb-hint">Prices are store averages updated periodically. Tap any price to adjust.</div>
    </div>
  `;
}

function renderPmbIngredientsSection(state) {
  return `
    <div class="pmb-section">
      <div class="pmb-section-label">Ingredients</div>
      <div class="pmb-search-wrap">
        <span class="pmb-search-icon"><i class="ti ti-search" aria-hidden="true"></i></span>
        <input type="text" class="pmb-search" id="pmb-search"
          placeholder="Search ingredients..."
          oninput="onPmbSearchInput(event)"
          autocomplete="off" />
      </div>
      <div class="pmb-search-results" id="pmb-search-results"></div>
      <button type="button" class="pmb-custom-link" data-action="pmb:openCustomForm">
        Don&rsquo;t see your ingredient? Add it
      </button>
      ${state.showCustomForm ? renderPmbCustomForm() : ''}
      <div class="pmb-ingredient-list" id="pmb-ingredient-list">
        ${state.ingredients.length
          ? state.ingredients.map((ing, idx) => renderPmbIngredientRow(state, ing, idx)).join('')
          : '<div class="pmb-empty">No ingredients yet. Search above to start.</div>'}
      </div>
    </div>
  `;
}

function renderPmbIngredientRow(state, ingredient, idx) {
  const item = PMB.catalogById[ingredient.catalogId];
  if (!item) return '';
  const cost = ingredientCost(state, ingredient);
  const isCustom = !!item.isCustom;
  const ug = isCustom ? null : PMB.unitGroups[item.unitGroup];
  const pkgLabel = isCustom
    ? `${fmt(item.costPerUse)} per use`
    : `${fmt(effectivePackagePrice(item, state.store))} / ${item.packageLabel}`;
  const overridden = !isCustom && PMB.overrides[item.id] != null;

  return `
    <div class="pmb-ing-row">
      <div class="pmb-ing-emoji"><i class="ti ti-cake" aria-hidden="true"></i>${isCustom ? '<span class="pmb-star-badge"><i class="ti ti-star" aria-hidden="true"></i></span>' : ''}</div>
      <div class="pmb-ing-body">
        <div class="pmb-ing-top">
          <div class="pmb-ing-name">${escapePmbHtml(item.name)}</div>
          <button type="button" class="pmb-ing-remove"
            data-action="pmb:removeIngredient" data-id="${idx}" aria-label="Remove">×</button>
        </div>
        <button type="button"
          class="pmb-ing-price ${overridden ? 'pmb-ing-price-override' : ''} ${isCustom ? 'pmb-ing-price-custom' : ''}"
          ${isCustom ? '' : `data-action="pmb:overridePrice" data-id="${item.id}"`}>
          ${pkgLabel}${overridden ? ' · your price' : ''}
        </button>
        <div class="pmb-ing-controls">
          <input type="number" step="0.1" min="0"
            class="pmb-qty" value="${ingredient.quantity}"
            oninput="onPmbQuantityInput(event, ${idx})"
            aria-label="Quantity" />
          ${ug ? `
            <div class="pmb-unit-pills">
              ${ug.units.map(u => `
                <button type="button"
                  class="pmb-unit-pill ${ingredient.unit === u ? 'pmb-unit-active' : ''}"
                  data-action="pmb:setUnit" data-id="${idx}" data-value="${u}">${u}</button>
              `).join('')}
            </div>
          ` : `<div class="pmb-unit-fixed">use${ingredient.quantity > 1 ? 's' : ''}</div>`}
          <div class="pmb-ing-cost" id="pmb-cost-${idx}">${fmt(cost)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderPmbCustomForm() {
  const unitOptions = ['oz', 'lbs', 'g', 'ml', 'cups', 'tbsp', 'tsp', 'count']
    .map(u => `<option value="${u}">${u}</option>`).join('');
  return `
    <form class="pmb-custom-form" data-action="pmb:submitCustomForm">
      <div class="pmb-custom-form-title">Add a custom ingredient</div>
      <input type="text" name="name" placeholder="Ingredient name" class="pmb-input" required />
      <div class="pmb-form-row">
        <input type="number" step="0.01" min="0" name="packageSize" placeholder="Package size" class="pmb-input pmb-input-half" required />
        <select name="packageUnit" class="pmb-input pmb-input-half">${unitOptions}</select>
      </div>
      <input type="number" step="0.01" min="0" name="packagePrice" placeholder="Package price ($)" class="pmb-input" required />
      <div class="pmb-form-row">
        <input type="number" step="0.01" min="0" name="amountUsedPerRecipe" placeholder="Amount used per recipe" class="pmb-input pmb-input-half" required />
        <select name="amountUnit" class="pmb-input pmb-input-half">${unitOptions}</select>
      </div>
      <div class="pmb-form-actions">
        <button type="button" class="pmb-form-cancel" data-action="pmb:closeCustomForm">Cancel</button>
        <button type="submit" class="pmb-form-submit">Save ingredient</button>
      </div>
    </form>
  `;
}

function renderPmbSuppliesSection(state) {
  return `
    <div class="pmb-section">
      <div class="pmb-section-label">Supplies &amp; Packaging</div>
      <div class="pmb-supply-list" id="pmb-supply-list">
        ${state.supplies.length
          ? state.supplies.map((sup, idx) => renderPmbSupplyRow(state, sup, idx)).join('')
          : '<div class="pmb-empty">No supplies added yet.</div>'}
      </div>
      <details class="pmb-supply-picker" ${state.showSupplyPicker ? 'open' : ''}>
        <summary>+ Add supply</summary>
        <div class="pmb-supply-options">
          ${PMB.supplies.map(s => `
            <button type="button" class="pmb-supply-option"
              data-action="pmb:addSupply" data-id="${s.id}">
              <span class="pmb-supply-option-name">${escapePmbHtml(s.name)}</span>
              <span class="pmb-supply-option-price">${fmt(s.pricePerUse)}/use</span>
            </button>
          `).join('')}
          <button type="button" class="pmb-supply-option pmb-supply-add-custom" data-action="pmb:openSupplyForm">
            + Add custom supply
          </button>
        </div>
      </details>
      ${state.showSupplyForm ? renderPmbSupplyForm() : ''}
    </div>
  `;
}

function renderPmbSupplyRow(state, supply, idx) {
  const s = PMB.supplies.find(x => x.id === supply.catalogId);
  if (!s) return '';
  const cost = (s.pricePerUse || 0) * (supply.quantity || 0);
  return `
    <div class="pmb-supply-row">
      <div class="pmb-supply-name">${escapePmbHtml(s.name)}</div>
      <button type="button" class="pmb-supply-price"
        data-action="pmb:overrideSupply" data-id="${s.id}">${fmt(s.pricePerUse)}/use</button>
      <input type="number" step="1" min="1"
        class="pmb-supply-qty" value="${supply.quantity}"
        oninput="onPmbSupplyQtyInput(event, ${idx})"
        aria-label="Quantity" />
      <div class="pmb-supply-cost" id="pmb-supply-cost-${idx}">${fmt(cost)}</div>
      <button type="button" class="pmb-supply-remove"
        data-action="pmb:removeSupply" data-id="${idx}" aria-label="Remove">×</button>
    </div>
  `;
}

function renderPmbSupplyForm() {
  return `
    <form class="pmb-custom-form" data-action="pmb:submitSupplyForm">
      <div class="pmb-custom-form-title">Add a custom supply</div>
      <input type="text" name="name" placeholder='Supply name (e.g., 6" cake box)' class="pmb-input" required />
      <input type="number" step="0.01" min="0" name="pricePerUse" placeholder="Price per use ($)" class="pmb-input" required />
      <div class="pmb-form-actions">
        <button type="button" class="pmb-form-cancel" data-action="pmb:closeSupplyForm">Cancel</button>
        <button type="submit" class="pmb-form-submit">Save supply</button>
      </div>
    </form>
  `;
}

function renderPmbSummaryCard(state, baker, menuItem) {
  const food = totalFoodCost(state);
  const supplies = totalSuppliesCost(state);
  const totalCost = food + supplies;
  const price = Number(state.listedPrice) || 0;
  const feeRate = baker.feeRate != null ? baker.feeRate : 0.05;
  const fee = price * feeRate;
  const takeHome = (price - fee) - totalCost;
  const margin = price > 0 ? (takeHome / price) * 100 : 0;
  const feePct = Math.round(feeRate * 100);

  return `
    <div class="pmb-summary-card">
      <div class="pmb-summary-title">Profit Summary</div>
      <div class="pmb-summary-line">
        <span>Food ingredient cost</span>
        <span id="pmb-summary-food">${fmt(food)}</span>
      </div>
      <div class="pmb-summary-line">
        <span>Supplies &amp; packaging</span>
        <span id="pmb-summary-supplies">${fmt(supplies)}</span>
      </div>
      <div class="pmb-summary-line pmb-summary-total">
        <span>Total cost</span>
        <span id="pmb-summary-total">${fmt(totalCost)}</span>
      </div>
      <div class="pmb-summary-divider"></div>
      <label class="pmb-summary-price-row">
        <span>Your listed price</span>
        <span class="pmb-summary-price-input-wrap">
          <span class="pmb-summary-currency">$</span>
          <input type="number" step="0.01" min="0" id="pmb-listed-price"
            class="pmb-summary-price-input" value="${price}"
            oninput="onPmbListedPriceInput(event)" />
        </span>
      </label>
      <div class="pmb-summary-line">
        <span>Bkd Local fee (${feePct}%)</span>
        <span id="pmb-summary-fee">−${fmt(fee)}</span>
      </div>
      <div class="pmb-summary-divider"></div>
      <div class="pmb-summary-takehome">
        <div class="pmb-takehome-label">YOU TAKE HOME</div>
        <div class="pmb-takehome-amount" id="pmb-summary-takehome">${fmt(takeHome)}</div>
        <div class="pmb-takehome-margin" id="pmb-summary-margin">Profit margin: ${Math.round(margin)}%</div>
      </div>
      <button type="button" class="pmb-save-btn" data-action="pmb:saveRecipe">
        Save Recipe &amp; Pricing
      </button>
      ${menuItem ? '' : '<div class="pmb-save-note">Open this from a menu item to link the recipe.</div>'}
    </div>
  `;
}

// ─── Live search and live-input handlers (called from inline oninput) ─────

function onPmbSearchInput(e) {
  const q = String(e.target.value || '').trim().toLowerCase();
  const target = document.getElementById('pmb-search-results');
  if (!target) return;
  if (!q) { target.innerHTML = ''; return; }

  const state = Router.state.priceMyBakes || {};
  const results = [];
  PMB.custom.forEach(c => {
    if (c.name.toLowerCase().includes(q)) results.push({ item: c, isCustom: true });
  });
  PMB.catalog.forEach(c => {
    if (c.name.toLowerCase().includes(q) || (c.category || '').toLowerCase().includes(q)) {
      results.push({ item: c, isCustom: false });
    }
  });

  const top = results.slice(0, 20);
  if (!top.length) {
    target.innerHTML = `<div class="pmb-search-empty">No matches. Use "Add it" below to create a custom ingredient.</div>`;
    return;
  }

  target.innerHTML = top.map(r => {
    const item = r.item;
    const priceLabel = r.isCustom
      ? `${fmt(item.costPerUse)}/use`
      : `${fmt(effectivePackagePrice(item, state.store))} / ${item.packageLabel}`;
    return `
      <button type="button" class="pmb-search-result" data-pmb-add="${escapePmbHtml(item.id)}">
        <span class="pmb-search-emoji"><i class="ti ti-cake" aria-hidden="true"></i></span>
        <span class="pmb-search-info">
          <span class="pmb-search-name">${escapePmbHtml(item.name)}${r.isCustom ? ' <i class="ti ti-star" aria-hidden="true"></i>' : ''}</span>
          <span class="pmb-search-meta">${escapePmbHtml(r.isCustom ? 'Your custom ingredient' : item.category)}</span>
        </span>
        <span class="pmb-search-price">${priceLabel}</span>
      </button>
    `;
  }).join('');

  target.querySelectorAll('[data-pmb-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      Actions['pmb:addIngredient']({ id: btn.dataset.pmbAdd });
    });
  });
}

function onPmbQuantityInput(e, idx) {
  const state = Router.state.priceMyBakes || {};
  if (!state.ingredients || !state.ingredients[idx]) return;
  state.ingredients[idx].quantity = parseFloat(e.target.value) || 0;
  pmbRecomputeIngredientCost(idx);
  pmbRecomputeSummary();
}

function onPmbSupplyQtyInput(e, idx) {
  const state = Router.state.priceMyBakes || {};
  if (!state.supplies || !state.supplies[idx]) return;
  state.supplies[idx].quantity = parseInt(e.target.value, 10) || 0;
  pmbRecomputeSupplyCost(idx);
  pmbRecomputeSummary();
}

function onPmbListedPriceInput(e) {
  const state = Router.state.priceMyBakes || {};
  state.listedPrice = parseFloat(e.target.value) || 0;
  pmbRecomputeSummary();
}

function onPmbBatchSizeInput(e) {
  const state = Router.state.priceMyBakes || {};
  state.batchSize = parseFloat(e.target.value) || 0;
  pmbRecomputeSummary();
}

function onPmbBatchUnitChange(e) {
  const state = Router.state.priceMyBakes || {};
  state.batchUnit = e.target.value;
  Router.refresh({ keepScroll: true });
}

function pmbRecomputeIngredientCost(idx) {
  const state = Router.state.priceMyBakes || {};
  const ing = state.ingredients && state.ingredients[idx];
  if (!ing) return;
  const el = document.getElementById(`pmb-cost-${idx}`);
  if (el) el.textContent = fmt(ingredientCost(state, ing));
}

function pmbRecomputeSupplyCost(idx) {
  const state = Router.state.priceMyBakes || {};
  const sup = state.supplies && state.supplies[idx];
  if (!sup) return;
  const el = document.getElementById(`pmb-supply-cost-${idx}`);
  if (el) el.textContent = fmt(supplyCost(sup));
}

function pmbRecomputeSummary() {
  const state = Router.state.priceMyBakes || {};
  const baker = PMB.bakerCache || { feeRate: 0.05 };
  const food = totalFoodCost(state);
  const supplies = totalSuppliesCost(state);
  const totalCost = food + supplies;
  const price = Number(state.listedPrice) || 0;
  const feeRate = baker.feeRate != null ? baker.feeRate : 0.05;
  const fee = price * feeRate;
  const takeHome = (price - fee) - totalCost;
  const margin = price > 0 ? (takeHome / price) * 100 : 0;

  setPmbText('pmb-summary-food', fmt(food));
  setPmbText('pmb-summary-supplies', fmt(supplies));
  setPmbText('pmb-summary-total', fmt(totalCost));
  setPmbText('pmb-summary-fee', `−${fmt(fee)}`);
  setPmbText('pmb-summary-takehome', fmt(takeHome));
  setPmbText('pmb-summary-margin', `Profit margin: ${Math.round(margin)}%`);

  if (document.getElementById('pmb-cost-per-unit')) {
    const n = pmbPerUnitNumbers(state, baker);
    setPmbText('pmb-cost-per-piece', fmt(n.costPerPiece));
    setPmbText('pmb-cost-per-unit', fmt(n.costPerSellingUnit));
    setPmbText('pmb-suggested-price', fmt(n.suggested));
    setPmbText('pmb-profit-per-unit', fmt(n.profit));
    setPmbText('pmb-margin-per-unit', `${Math.round(n.margin)}%`);
  }
}

function setPmbText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
