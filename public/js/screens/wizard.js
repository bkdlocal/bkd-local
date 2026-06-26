// Guided baker onboarding wizard. One required question per screen. Finishing
// every required step fills exactly the fields recomputeProfileStatus() checks,
// so the server flips the baker to Live on its own. The wizard NEVER writes
// Profile Status (the app server is the single source of truth for it).
//
// Resume is data-derived, not a stored cursor: on entry we read the baker's
// real data and drop them at the first incomplete required step, so it can
// never drift from the actual go-live truth.
(function () {
  const WIZARD_TOTAL = 7;
  const SHARE_BASE = 'https://bkd-local-production.up.railway.app';

  // Steps 5 and 6 show ONLY these 8 canonical types (allow-list). Airtable's
  // other Product Types options are left untouched; we just never render them.
  const WIZARD_TYPES = ['Cakes', 'Cookies', 'Cupcakes', 'Breads', 'Cinnamon Rolls', 'Pies', 'Macarons', 'Bars and Brownies'];

  // Menu Items use a separate Airtable field ("Product Type") whose options
  // differ from Baker Profiles. Map each chip to the menu app-id that
  // /api/menu (PRODUCT_TYPE_TO_AIRTABLE) expects. Cookies and Bars and Brownies
  // are temporary internal mappings (approved for launch; menu vocabulary will
  // be aligned to the canonical 8 post-launch).
  const WIZARD_TYPE_TO_MENU_ID = {
    'Cakes': 'cakes', 'Cookies': 'sugarCookies', 'Cupcakes': 'cupcakes',
    'Breads': 'breads', 'Cinnamon Rolls': 'cinnamonRolls', 'Pies': 'pies',
    'Macarons': 'macarons', 'Bars and Brownies': 'dropCookies'
  };
  const SOLD_PER = [
    { id: 'dozen', label: 'Dozen' },
    { id: 'halfDozen', label: 'Half dozen' },
    { id: 'individual', label: 'Individual' }
  ];
  // Pickup-day ids match the server's WEEKDAY_ABBR (Sun..Sat).
  const WEEKDAYS = [
    { id: 'Sun', label: 'Sun' }, { id: 'Mon', label: 'Mon' }, { id: 'Tue', label: 'Tue' },
    { id: 'Wed', label: 'Wed' }, { id: 'Thu', label: 'Thu' }, { id: 'Fri', label: 'Fri' },
    { id: 'Sat', label: 'Sat' }
  ];

  function wEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function typeList(v) {
    return Array.isArray(v) ? v : String(v || '').split(',').map(s => s.trim()).filter(Boolean);
  }
  function shareUrl(baker) {
    return SHARE_BASE + '/bakers/' + (baker && baker.id || '') +
      (baker && baker.email ? '?ref=' + encodeURIComponent(baker.email) : '');
  }

  // ── Resume: which required steps are already satisfied (mirrors go-live) ──
  function stepStatus(ctx) {
    const b = ctx.baker || {};
    const items = ctx.menu || [];
    const a = ctx.availability || {};
    return {
      1: !!String(b.businessName || '').trim(),
      2: !!b.photo,
      3: !!String(b.bio || '').trim(),
      4: !!String(b.city || '').trim() && !!String(b.zip || '').trim(),
      5: typeList(b.productTypes).length > 0,
      6: items.some(m => m.coverPhoto && Number(m.price) > 0),
      7: (Array.isArray(a.defaultPickupDays) && a.defaultPickupDays.length > 0) ||
         (Array.isArray(a.slots) && a.slots.length > 0)
    };
  }
  function firstIncomplete(ctx) {
    const f = stepStatus(ctx);
    for (let i = 1; i <= WIZARD_TOTAL; i++) if (!f[i]) return i;
    return 8; // everything required is done -> the "You're Live!" screen
  }

  // ── Shared chrome ──
  function progress(step) {
    const shown = Math.min(step, WIZARD_TOTAL);
    const pct = Math.round((shown / WIZARD_TOTAL) * 100);
    return `
      <div class="wiz-progress">
        <div class="wiz-step-label">Step ${shown} of ${WIZARD_TOTAL}</div>
        <div class="wiz-bar"><div class="wiz-bar-fill" style="width:${pct}%"></div></div>
      </div>`;
  }
  // The persistent bottom nav lets a baker leave the wizard at any point (they
  // just won't be Live until they finish). Guarded so render-tests work in Node.
  function bottomNav() {
    return (typeof renderBottomNav === 'function') ? renderBottomNav('wizard') : '';
  }
  function shell(step, inner) {
    return `<div class="screen wiz-screen">
      ${progress(step)}
      <div class="scroll-content wiz-content">${inner}</div>
      ${bottomNav()}
    </div>`;
  }
  function prompt(text) { return `<p class="wiz-prompt">${wEsc(text)}</p>`; }
  function fieldLabel(text) { return `<div class="wiz-field-label">${wEsc(text)}</div>`; }
  function actions(step, opts) {
    const o = opts || {};
    const nextLabel = o.nextLabel || 'Continue';
    const canBack = o.canBack !== false && step > 1;
    return `<div class="wiz-actions">
        ${canBack ? `<button type="button" class="btn btn-ghost wiz-back" data-action="wizard:back">Back</button>` : ''}
        <button type="button" class="btn btn-primary wiz-next" data-action="wizard:next" data-step="${step}">${wEsc(nextLabel)}</button>
      </div>
      <p class="wiz-err" id="wizErr" hidden></p>`;
  }
  function chip(label, value, action, on) {
    return `<button type="button" class="wiz-chip${on ? ' on' : ''}" data-action="${action}" data-value="${wEsc(value)}">${wEsc(label)}</button>`;
  }

  // ── Step 1: business name ──
  function step1(ctx) {
    const v = wEsc((ctx.baker && ctx.baker.businessName) || '');
    return shell(1, `
      ${prompt("First things first, what do we call this beautiful business of yours?")}
      <input type="text" class="wiz-input" id="wizBusinessName" value="${v}" placeholder="Your bakery name" autocomplete="organization" maxlength="80">
      ${actions(1, { canBack: false })}
    `);
  }

  // ── Step 2: profile photo (required) ──
  function step2(ctx) {
    const photo = ctx.baker && ctx.baker.photo;
    const drop = photo
      ? `<button type="button" class="wiz-photo has-photo" id="wizPhoto" data-action="wizard:pickPhoto" style="background-image:url('${wEsc(photo)}')"><span class="wiz-photo-edit">Change photo</span></button>`
      : `<button type="button" class="wiz-photo" id="wizPhoto" data-action="wizard:pickPhoto"><i class="ti ti-camera" aria-hidden="true"></i><span class="wiz-photo-hint">Tap to add your photo</span></button>`;
    return shell(2, `
      ${prompt("Okay this is the big one. This photo is the very first thing customers see when they find you, so let's make it count. Show me your best bake, or you behind the counter doing your thing. The one that makes people stop scrolling and go 'I need that.' You've got this.")}
      ${drop}
      <input type="file" id="wizPhotoInput" accept="image/*" hidden onchange="onWizProfilePhotoChange(event)">
      ${actions(2)}
    `);
  }

  // ── Step 3: bio (required) ──
  function step3(ctx) {
    const v = wEsc((ctx.baker && ctx.baker.bio) || '');
    return shell(3, `
      ${prompt("Tell people who you are! Not a resume, just the real you. What you love to make, what got you started, the heart behind your bakes. People order from people they feel like they know.")}
      <textarea class="wiz-input wiz-textarea" id="wizBio" rows="6" maxlength="1000" placeholder="Share your story">${v}</textarea>
      ${actions(3)}
    `);
  }

  // ── Step 4: city + zip (required). State shown as TN for a complete feel but not saved. ──
  function step4(ctx) {
    const city = wEsc((ctx.baker && ctx.baker.city) || '');
    const zip = wEsc((ctx.baker && ctx.baker.zip) || '');
    return shell(4, `
      ${prompt("Where are you baking from? This helps the right customers, the ones right around you, actually find you.")}
      <input type="text" class="wiz-input" id="wizCity" value="${city}" placeholder="City" autocomplete="address-level2" maxlength="60">
      <div class="wiz-row">
        <input type="text" class="wiz-input wiz-state" id="wizState" value="TN" readonly aria-label="State">
        <input type="text" class="wiz-input" id="wizZip" value="${zip}" inputmode="numeric" pattern="[0-9]*" maxlength="5" placeholder="ZIP code" autocomplete="postal-code">
      </div>
      ${actions(4)}
    `);
  }

  // ── Step 5: offerings / product types (required, multi-select, 8 allow-list) ──
  function step5(ctx, w) {
    const sel = new Set(w.types || []);
    const chips = WIZARD_TYPES.map(t => chip(t, t, 'wizard:toggleType', sel.has(t))).join('');
    return shell(5, `
      ${prompt("What do you make? Tap everything you offer. Don't be shy, this is how customers find exactly what they're craving.")}
      <div class="wiz-chips">${chips}</div>
      ${actions(5)}
    `);
  }

  // ── Step 6: first menu item (required: name + price + photo + type + sold per) ──
  function step6(ctx, w) {
    const d = w.step6 || {};
    const typeChips = WIZARD_TYPES.map(t => chip(t, t, 'wizard:miType', d.type === t)).join('');
    const soldChips = SOLD_PER.map(s => chip(s.label, s.id, 'wizard:miSold', d.soldPer === s.id)).join('');
    const photo = d.photoUrl
      ? `<button type="button" class="wiz-photo wiz-photo-sm has-photo" data-action="wizard:pickItemPhoto" style="background-image:url('${wEsc(d.photoUrl)}')"><span class="wiz-photo-edit">Change photo</span></button>`
      : `<button type="button" class="wiz-photo wiz-photo-sm" data-action="wizard:pickItemPhoto"><i class="ti ti-camera" aria-hidden="true"></i><span class="wiz-photo-hint">Add a photo</span></button>`;
    return shell(6, `
      ${prompt("Let's add your first item! Give it a name, a price, and a photo that shows it off. This is the good part, you're basically building your menu right now.")}
      <input type="text" class="wiz-input" id="wizItemName" value="${wEsc(d.name || '')}" placeholder="Item name" maxlength="80" oninput="onWizItemInput('name', this.value)">
      <input type="text" class="wiz-input" id="wizItemPrice" value="${wEsc(d.price || '')}" inputmode="decimal" placeholder="Price in dollars" oninput="onWizItemInput('price', this.value)">
      ${fieldLabel("What kind of treat is it?")}
      <div class="wiz-chips">${typeChips}</div>
      ${fieldLabel("How is it sold?")}
      <div class="wiz-chips">${soldChips}</div>
      ${fieldLabel("Show it off")}
      ${photo}
      <input type="file" id="wizItemPhotoInput" accept="image/*" hidden onchange="onWizItemPhotoChange(event)">
      ${actions(6)}
    `);
  }

  // ── Step 7: availability (required: at least one default pickup day) ──
  function step7(ctx, w) {
    const sel = new Set(w.days || []);
    const dayChips = WEEKDAYS.map(d => chip(d.label, d.id, 'wizard:toggleDay', sel.has(d.id))).join('');
    return shell(7, `
      ${prompt("When can customers pick up? Set the days that work for your life. You're in charge of your schedule here, always.")}
      <div class="wiz-chips wiz-days">${dayChips}</div>
      ${actions(7, { nextLabel: 'Finish and go live' })}
    `);
  }

  // ── Step 8: You're Live! (shareable ?ref= link) ──
  function step8(ctx) {
    const url = shareUrl(ctx.baker || {});
    return `<div class="screen wiz-screen">
      <div class="scroll-content wiz-content wiz-live">
        <div class="wiz-live-badge"><i class="ti ti-circle-check" aria-hidden="true"></i></div>
        ${prompt("You did it!! Your profile is officially live and customers can find you right now. Here's your personal link, share it everywhere, your Instagram, your stories, send it to every customer you've got. This is yours.")}
        <div class="wiz-link" id="wizLink">${wEsc(url)}</div>
        <div class="wiz-actions">
          <button type="button" class="btn btn-primary" data-action="home:shareProfile" data-value="${wEsc(url)}">Copy my link</button>
        </div>
        <button type="button" class="btn btn-ghost wiz-back wiz-done" data-action="wizard:done">Go to my dashboard</button>
      </div>
      ${bottomNav()}
    </div>`;
  }

  const STEP_RENDERERS = { 1: step1, 2: step2, 3: step3, 4: step4, 5: step5, 6: step6, 7: step7, 8: step8 };

  // Pure render for one step (used by the app and by render tests).
  function renderStep(step, ctx, w) {
    const r = STEP_RENDERERS[step];
    if (!r) return shell(step, prompt("This step is being built."));
    return r(ctx || {}, w || {});
  }

  // ── App entry: load real data (cached per entry), seed selections, render ──
  async function renderWizard() {
    const w = Router.state.wizard = Router.state.wizard || {};
    if (!w.ctx || w.dirty) {
      try {
        const [baker, menu, availability] = await Promise.all([
          Api.getBaker(),
          Api.getMenu().catch(() => []),
          Api.getAvailability().catch(() => ({}))
        ]);
        const items = Array.isArray(menu) ? menu : (menu && menu.items) || [];
        w.ctx = { baker, menu: items, availability };
        w.dirty = false;
      } catch (e) {
        return `<div class="screen wiz-screen"><div class="scroll-content wiz-content">
          <p class="wiz-err">We could not load your profile just now. Please try again.</p></div></div>`;
      }
    }
    const ctx = w.ctx;
    if (!w.step) w.step = firstIncomplete(ctx);
    // Seed selection state once from real data (preserved across re-renders).
    if (w.types === undefined) w.types = typeList(ctx.baker.productTypes).filter(t => WIZARD_TYPES.includes(t));
    if (w.days === undefined) w.days = Array.isArray(ctx.availability.defaultPickupDays) ? ctx.availability.defaultPickupDays.slice() : [];
    if (w.step6 === undefined) w.step6 = { name: '', price: '', type: '', soldPer: '', photoUrl: '' };
    return renderStep(w.step, ctx, w);
  }

  // ── Action + global handlers ──
  function curStep() { return (Router.state.wizard && Router.state.wizard.step) || 1; }
  function setWizErr(msg) {
    const e = document.getElementById('wizErr');
    if (e) { e.textContent = msg || ''; e.hidden = !msg; }
  }

  async function saveStep(step) {
    const w = Router.state.wizard, ctx = w.ctx;
    if (step === 1) {
      const name = (document.getElementById('wizBusinessName').value || '').trim();
      if (!name) throw new Error('Add your business name to keep going.');
      await Api.updateBaker({ businessName: name });
    } else if (step === 2) {
      if (!ctx.baker.photo) throw new Error('Add a photo to keep going. This is the first thing customers see.');
    } else if (step === 3) {
      const bio = (document.getElementById('wizBio').value || '').trim();
      if (!bio) throw new Error('Tell customers a little about you to keep going.');
      await Api.updateBaker({ bio });
    } else if (step === 4) {
      const city = (document.getElementById('wizCity').value || '').trim();
      const zip = (document.getElementById('wizZip').value || '').trim();
      if (!city) throw new Error('Add your city to keep going.');
      if (!/^\d{5}$/.test(zip)) throw new Error('Add a 5-digit ZIP code to keep going.');
      await Api.updateBaker({ city, zipCode: zip });
    } else if (step === 5) {
      const types = w.types || [];
      if (!types.length) throw new Error('Tap at least one thing you make.');
      await Api.updateBaker({ productTypes: types });
    } else if (step === 6) {
      const d = w.step6 || {};
      const name = (d.name || '').trim();
      const price = Number(d.price);
      if (!name) throw new Error('Give your item a name.');
      if (!(price > 0)) throw new Error('Add a price greater than zero.');
      if (!d.type) throw new Error('Pick what kind of treat this is.');
      if (!d.soldPer) throw new Error('Pick how it is sold.');
      if (!d.photoUrl) throw new Error('Add a photo of your item.');
      await Api.createMenuItem({
        name, price,
        productType: WIZARD_TYPE_TO_MENU_ID[d.type],
        soldBy: d.soldPer,
        photos: [d.photoUrl]
      });
    } else if (step === 7) {
      const days = w.days || [];
      if (!days.length) throw new Error('Pick at least one pickup day.');
      await Api.setDefaultDays(days);
    }
  }

  const wizardActions = {
    'wizard:next': async ({ el }) => {
      const step = Number(el && el.dataset.step) || curStep();
      setWizErr('');
      if (el) el.disabled = true;
      try {
        await saveStep(step);
        const w = Router.state.wizard;
        w.dirty = true;       // refetch fresh data for the next step / resume
        w.step = step + 1;    // step 7 -> 8 (You're Live!)
        await Router.navigate('wizard');
      } catch (e) {
        setWizErr(e.message || 'Something went wrong. Please try again.');
        if (el) el.disabled = false;
      }
    },
    'wizard:back': () => {
      const w = Router.state.wizard;
      w.step = Math.max(1, curStep() - 1);
      Router.navigate('wizard');
    },
    'wizard:pickPhoto': () => { const i = document.getElementById('wizPhotoInput'); if (i) i.click(); },
    'wizard:pickItemPhoto': () => { const i = document.getElementById('wizItemPhotoInput'); if (i) i.click(); },
    'wizard:toggleType': ({ value }) => {
      const w = Router.state.wizard; w.types = w.types || [];
      const i = w.types.indexOf(value);
      if (i >= 0) w.types.splice(i, 1); else w.types.push(value);
      Router.refresh({ keepScroll: true });
    },
    'wizard:miType': ({ value }) => {
      const w = Router.state.wizard; w.step6 = w.step6 || {};
      w.step6.type = (w.step6.type === value) ? '' : value;
      Router.refresh({ keepScroll: true });
    },
    'wizard:miSold': ({ value }) => {
      const w = Router.state.wizard; w.step6 = w.step6 || {};
      w.step6.soldPer = (w.step6.soldPer === value) ? '' : value;
      Router.refresh({ keepScroll: true });
    },
    'wizard:toggleDay': ({ value }) => {
      const w = Router.state.wizard; w.days = w.days || [];
      const i = w.days.indexOf(value);
      if (i >= 0) w.days.splice(i, 1); else w.days.push(value);
      Router.refresh({ keepScroll: true });
    },
    // Open the wizard fresh from the dashboard CTA (resume at first incomplete step).
    'wizard:open': () => { Router.state.wizard = {}; Router.navigate('wizard'); },
    'wizard:done': () => { Router.state.wizard = {}; Router.navigate('home'); }
  };

  if (typeof window !== 'undefined') {
    window.renderWizard = renderWizard;
    window.__wizardActions = wizardActions;

    window.onWizItemInput = function (field, value) {
      const w = Router.state.wizard; if (!w) return;
      w.step6 = w.step6 || {}; w.step6[field] = value;
    };
    window.onWizProfilePhotoChange = async function (event) {
      const file = event.target.files && event.target.files[0]; if (!file) return;
      setWizErr('');
      const el = document.getElementById('wizPhoto'); if (el) el.classList.add('uploading');
      try {
        const res = await Api.uploadBakerProfilePhoto(file);
        const w = Router.state.wizard;
        if (w && w.ctx && w.ctx.baker) w.ctx.baker.photo = res.url; // persisted server-side on upload
        Router.refresh({ keepScroll: true });
      } catch (e) {
        setWizErr(e.message || 'That photo would not upload. Please try another.');
        if (el) el.classList.remove('uploading');
      }
    };
    window.onWizItemPhotoChange = async function (event) {
      const file = event.target.files && event.target.files[0]; if (!file) return;
      setWizErr('');
      try {
        const res = await Api.uploadPhoto(file);
        const w = Router.state.wizard; w.step6 = w.step6 || {}; w.step6.photoUrl = res.url;
        Router.refresh({ keepScroll: true });
      } catch (e) {
        setWizErr(e.message || 'That photo would not upload. Please try another.');
      }
    };

    window.WizardScreen = {
      renderStep, firstIncomplete, stepStatus, shareUrl,
      WIZARD_TOTAL, WIZARD_TYPES, WIZARD_TYPE_TO_MENU_ID, SOLD_PER, WEEKDAYS
    };
  }
})();
