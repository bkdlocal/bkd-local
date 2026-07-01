const { customCostPerUse } = require('./ingredients');

let baker = {
  id: 'mock-baker-1',
  email: 'claire@bakery.com',
  contactName: 'Claire Bennett',
  firstName: 'Claire',
  businessName: "Claire's Confections",
  avatarLetter: 'C',
  phone: '(555) 123-4567',
  city: 'Brooklyn, NY',
  tier: 'Charter',
  feeRate: 0.05,
  stripeAccountId: null,
  pickupLocation: '482 Greene Ave, Brooklyn, NY — front porch (please knock)',
  profileStatus: 'Active',
  badge: 'Verified',
  bio: 'French-style macarons and custom celebration cakes.',
  productTypes: 'Macarons, Cakes, Cookies',
  specialtyTags: 'Custom orders, French pastry',
  acceptingOrders: true,
  faq: {
    specialties: 'French macarons (24 rotating flavors), buttercream celebration cakes, sugar cookies, and seasonal cinnamon rolls. The macarons are what people come back for — lavender honey and salted caramel are favorites.',
    locationPickup: "Front porch of my place at 482 Greene Ave, Brooklyn. Please just text when you're 5 minutes out so I can have the box ready.",
    delivery: 'Pickup only for now — I want each box handed off in person so it gets to you perfect. Sorry, no delivery this year!',
    leadTime: '5 days is ideal so I can source what I need. Rush orders within 48 hours sometimes work if my schedule allows — message me and I’ll let you know.',
    minimumOrder: 'One dozen on cookies, half dozen on macarons. Cakes are by the cake.',
    customOrders: 'I LOVE custom orders — themed cookie sets, multi-tier birthday cakes, baby shower stuff. I’d rather not do wedding cakes over 3 tiers yet, just because timing gets dicey solo.',
    busySeasons: 'Mother’s Day weekend, Halloween, and December all book up two to three weeks out. Wedding season picks up May through September.',
    glutenFree: 'Not gluten-free — my kitchen has flour everywhere and I can’t promise cross-contamination is safe.',
    otherDietary: 'I can do egg-free buttercream and dairy-free buttercream on cakes. Vegan is harder — happy to talk through what would work.',
    allergens: 'Almonds (macarons), wheat, eggs, dairy, occasional pecans and walnuts. My kitchen is not a nut-free space.',
    paymentTiming: 'Full payment at booking through Bkd Local — that locks in your spot and lets me start shopping.',
    paymentMethods: 'Card through Bkd Local checkout. That’s the easiest way and you get the receipt right away.',
    cancellationPolicy: 'Full refund up to 72 hours before pickup. Within 72 hours I’ve usually already bought ingredients, so it’s a 50% refund unless I can re-sell the spot.',
    soldOut: 'If I’m sold out for a date, text me and I’ll put you on my list — I open new pickup days every Sunday for the week ahead.',
    samples: 'I don’t do walk-in samples (small kitchen), but for big orders like weddings I’ll set up a tasting box you can pick up.',
    tastings: 'Wedding and big-event tastings are $25 (credited back if you book), usually a Saturday afternoon at my place. We’ll do 4 flavors and talk design.',
    contactResponse: 'Text or DM through the app — I usually reply within a few hours during the day, longer on Sundays.',
    anythingElse: 'I’m a one-woman shop and I treat every order like it’s for my own family. If anything’s not right, tell me — I’ll make it right.'
  }
};

let availabilitySlots = [
  { id: 'av1', date: '2026-06-28', slotsAvailable: 4 },
  { id: 'av2', date: '2026-07-04', slotsAvailable: 6 },
  { id: 'av3', date: '2026-07-11', slotsAvailable: 3 }
];

let orders = [
  {
    id: 'o1',
    customerName: 'Sarah Mendoza',
    customerEmail: 'sarah.m@example.com',
    customerPhone: '(555) 201-3344',
    customerCity: 'Brooklyn, NY',
    item: '2 dozen French Macarons',
    notes: 'Assorted flavors — surprise me with the lineup',
    specialInstructions: 'Could you tie a pink ribbon around the box?',
    allergens: 'Contains almonds and dairy.',
    pickupDate: '2026-06-28',
    requestedDate: '2026-06-19',
    completedDate: null,
    readyAt: null,
    paymentStatus: 'pending',
    amount: 84,
    status: 'new',
    review: null,
    reviewRating: null,
    reviewRequestedAt: null
  },
  {
    id: 'o2',
    customerName: 'Jessica Tan',
    customerEmail: 'jess.tan@example.com',
    customerPhone: '(555) 808-1219',
    customerCity: 'Queens, NY',
    item: 'Custom Birthday Cake',
    notes: 'Strawberry filling, 2 tiers, "Happy 30th" piped on top',
    specialInstructions: 'No fondant please — buttercream only.',
    allergens: 'Contains gluten, eggs, dairy.',
    pickupDate: '2026-07-04',
    requestedDate: '2026-06-18',
    completedDate: null,
    readyAt: null,
    paymentStatus: 'pending',
    amount: 120,
    status: 'new',
    review: null,
    reviewRating: null,
    reviewRequestedAt: null
  },
  {
    id: 'o3',
    customerName: 'Priya Krishnan',
    customerEmail: 'priya.k@example.com',
    customerPhone: '(555) 612-7780',
    customerCity: 'Brooklyn, NY',
    item: 'Dozen Cinnamon Rolls',
    notes: 'Extra glaze on top',
    specialInstructions: null,
    allergens: 'Contains gluten, dairy.',
    pickupDate: '2026-06-24',
    requestedDate: '2026-06-17',
    completedDate: null,
    readyAt: null,
    paymentStatus: 'pending',
    amount: 36,
    status: 'new',
    review: null,
    reviewRating: null,
    reviewRequestedAt: null
  },
  {
    id: 'o4',
    customerName: 'Maya Chen',
    customerEmail: 'maya.c@example.com',
    customerPhone: '(555) 445-9921',
    customerCity: 'Brooklyn, NY',
    item: 'Sugar Cookie Set (24)',
    notes: 'Mix of stars and hearts, pastel colors',
    specialInstructions: null,
    allergens: 'Contains gluten, eggs.',
    pickupDate: '2026-06-22',
    requestedDate: '2026-06-12',
    completedDate: null,
    readyAt: null,
    paymentStatus: 'paid',
    amount: 96,
    status: 'in_progress',
    review: null,
    reviewRating: null,
    reviewRequestedAt: null
  },
  {
    id: 'o5',
    customerName: 'Bree Okafor',
    customerEmail: 'bree.o@example.com',
    customerPhone: '(555) 717-2208',
    customerCity: 'Manhattan, NY',
    item: 'Lemon Tart',
    notes: '9-inch, fresh raspberries on top',
    specialInstructions: null,
    allergens: 'Contains gluten, eggs, dairy.',
    pickupDate: '2026-06-23',
    requestedDate: '2026-06-13',
    completedDate: null,
    readyAt: null,
    paymentStatus: 'paid',
    amount: 38,
    status: 'in_progress',
    review: null,
    reviewRating: null,
    reviewRequestedAt: null
  },
  {
    id: 'o6',
    customerName: 'Amanda Reyes',
    customerEmail: 'amanda.r@example.com',
    customerPhone: '(555) 339-1144',
    customerCity: 'Brooklyn, NY',
    item: 'Decorated Cookie Set (12)',
    notes: 'Birthday theme, "Maya is 7" on the centerpiece',
    specialInstructions: null,
    allergens: 'Contains gluten, eggs.',
    pickupDate: '2026-06-14',
    requestedDate: '2026-06-05',
    completedDate: '2026-06-14',
    readyAt: '2026-06-14T09:00:00Z',
    paymentStatus: 'paid',
    amount: 65,
    status: 'complete',
    review: 'These were absolutely incredible. My whole family was asking where I got them. Every cookie was perfect.',
    reviewRating: 5,
    reviewRequestedAt: '2026-06-15'
  },
  {
    id: 'o7',
    customerName: 'Michelle Kim',
    customerEmail: 'michelle.k@example.com',
    customerPhone: '(555) 822-6643',
    customerCity: 'Queens, NY',
    item: '1 doz French Macarons',
    notes: 'For a bridal shower',
    specialInstructions: null,
    allergens: 'Contains almonds, dairy.',
    pickupDate: '2026-06-10',
    requestedDate: '2026-06-02',
    completedDate: '2026-06-10',
    readyAt: '2026-06-10T08:30:00Z',
    paymentStatus: 'paid',
    amount: 42,
    status: 'complete',
    review: 'Everyone at the bridal shower was asking where I found these. Ordering again for my daughter\'s birthday.',
    reviewRating: 5,
    reviewRequestedAt: '2026-06-11'
  },
  {
    id: 'o8',
    customerName: 'Lina Park',
    customerEmail: 'lina.p@example.com',
    customerPhone: '(555) 558-0093',
    customerCity: 'Brooklyn, NY',
    item: 'Banana Bread (2 loaves)',
    notes: null,
    specialInstructions: null,
    allergens: 'Contains gluten, eggs, dairy.',
    pickupDate: '2026-06-06',
    requestedDate: '2026-06-01',
    completedDate: '2026-06-06',
    readyAt: '2026-06-06T10:00:00Z',
    paymentStatus: 'paid',
    amount: 28,
    status: 'complete',
    review: null,
    reviewRating: null,
    reviewRequestedAt: '2026-06-07'
  }
];

function getOrders() { return orders.map(o => ({ ...o })); }
function getOrder(id) { const o = orders.find(x => x.id === id); return o ? { ...o } : null; }
function acceptOrder(id) {
  const o = orders.find(x => x.id === id);
  if (o) { o.status = 'in_progress'; o.paymentStatus = 'paid'; }
}
function declineOrder(id) { orders = orders.filter(x => x.id !== id); }
function markReady(id) {
  const o = orders.find(x => x.id === id);
  if (o) o.readyAt = new Date().toISOString();
}

function setAcceptingOrders(value) {
  baker.acceptingOrders = !!value;
}

const BAKER_BASIC_FIELDS = [
  'contactName', 'businessName', 'phone', 'city',
  'pickupLocation', 'bio', 'productTypes', 'specialtyTags'
];
const FAQ_KEYS = [
  'specialties', 'locationPickup', 'delivery', 'leadTime', 'minimumOrder',
  'customOrders', 'busySeasons', 'glutenFree', 'otherDietary', 'allergens',
  'paymentTiming', 'paymentMethods', 'cancellationPolicy', 'soldOut',
  'samples', 'tastings', 'contactResponse', 'anythingElse'
];

function updateBaker(patch) {
  if (!patch || typeof patch !== 'object') return baker;
  for (const key of BAKER_BASIC_FIELDS) {
    if (patch[key] !== undefined) {
      const v = patch[key];
      baker[key] = (v == null || v === '') ? null : String(v);
    }
  }
  if (patch.contactName !== undefined && baker.contactName) {
    baker.firstName = baker.contactName.split(' ')[0] || 'Baker';
    baker.avatarLetter = baker.contactName[0].toUpperCase();
  }
  if (patch.profileStatus !== undefined) baker.profileStatus = String(patch.profileStatus);
  if (patch.faq && typeof patch.faq === 'object') {
    baker.faq = baker.faq || {};
    for (const key of FAQ_KEYS) {
      if (patch.faq[key] !== undefined) {
        const v = patch.faq[key];
        baker.faq[key] = (v == null || v === '') ? null : String(v);
      }
    }
  }
  return baker;
}

function clearFaq() {
  baker.faq = baker.faq || {};
  for (const key of FAQ_KEYS) baker.faq[key] = null;
  baker.profileStatus = 'Setup';
  return baker;
}

function getSlots() {
  return availabilitySlots.map(s => ({ ...s }));
}

function addSlot(date, slotsAvailable) {
  const slot = { id: 'av' + Date.now(), date, slotsAvailable: Number(slotsAvailable) || 1 };
  availabilitySlots.push(slot);
  return { ...slot };
}

function updateSlot(id, slotsAvailable) {
  const s = availabilitySlots.find(x => x.id === id);
  if (s) s.slotsAvailable = Number(slotsAvailable) || 1;
  return s ? { ...s } : null;
}

function removeSlot(id) {
  availabilitySlots = availabilitySlots.filter(x => x.id !== id);
}

let conversations = [
  {
    id: 'c1',
    customerName: 'Sarah Mendoza',
    customerCity: 'Brooklyn, NY',
    customerEmail: 'sarah.m@example.com',
    customerPhone: '(555) 201-3344',
    relatedOrderId: 'o1',
    unread: 2,
    messages: [
      { id: 'm1', from: 'customer', text: "Hi Claire! I just placed an order for 2 dozen macarons for the 28th. Can you do an assorted box? My niece loves lavender if you have it.", sentAt: '2026-06-19T09:14:00Z' },
      { id: 'm2', from: 'customer', text: "Also — is it okay to pick up around 11am? Driving in from the city.", sentAt: '2026-06-19T09:16:00Z' }
    ]
  },
  {
    id: 'c2',
    customerName: 'Jessica Tan',
    customerCity: 'Queens, NY',
    customerEmail: 'jess.tan@example.com',
    customerPhone: '(555) 808-1219',
    relatedOrderId: 'o2',
    unread: 1,
    messages: [
      { id: 'm3', from: 'customer', text: "Hi! Quick question on the birthday cake — does the buttercream hold up if I need to refrigerate overnight?", sentAt: '2026-06-18T16:42:00Z' }
    ]
  },
  {
    id: 'c3',
    customerName: 'Maya Chen',
    customerCity: 'Brooklyn, NY',
    customerEmail: 'maya.c@example.com',
    customerPhone: '(555) 445-9921',
    relatedOrderId: 'o4',
    unread: 0,
    messages: [
      { id: 'm4', from: 'customer', text: "Thank you so much for accepting! The kids are going to lose it 🎉", sentAt: '2026-06-13T10:02:00Z' },
      { id: 'm5', from: 'baker',    text: "Can't wait to make them! I'll have them ready Saturday morning. Any color preferences I should know about?", sentAt: '2026-06-13T10:24:00Z' },
      { id: 'm6', from: 'customer', text: "Soft pastels would be perfect. You're the best!", sentAt: '2026-06-13T11:08:00Z' }
    ]
  },
  {
    id: 'c4',
    customerName: 'Lina Park',
    customerCity: 'Brooklyn, NY',
    customerEmail: 'lina.p@example.com',
    customerPhone: '(555) 558-0093',
    relatedOrderId: 'o8',
    unread: 0,
    messages: [
      { id: 'm7', from: 'customer', text: "Picked up — your banana bread is unreal. Already ate a quarter loaf in the car.", sentAt: '2026-06-06T11:30:00Z' },
      { id: 'm8', from: 'baker',    text: "Ha! That's the highest compliment 🥰 thank you Lina.", sentAt: '2026-06-06T12:11:00Z' }
    ]
  }
];

function getConversations() {
  return conversations.map(c => {
    const last = c.messages[c.messages.length - 1] || null;
    return {
      id: c.id,
      customerName: c.customerName,
      customerCity: c.customerCity,
      customerEmail: c.customerEmail,
      customerPhone: c.customerPhone,
      relatedOrderId: c.relatedOrderId,
      unread: c.unread,
      lastMessage: last ? last.text : '',
      lastFrom: last ? last.from : null,
      lastMessageAt: last ? last.sentAt : null
    };
  });
}

function getConversation(id) {
  const c = conversations.find(x => x.id === id);
  if (!c) return null;
  return { ...c, messages: c.messages.map(m => ({ ...m })) };
}

function appendMessage(id, text) {
  const c = conversations.find(x => x.id === id);
  if (!c) return null;
  const m = { id: 'm' + Date.now(), from: 'baker', text, sentAt: new Date().toISOString() };
  c.messages.push(m);
  return { ...m };
}

function markRead(id) {
  const c = conversations.find(x => x.id === id);
  if (c) c.unread = 0;
}

let menuItems = [
  {
    id: 'mi1', name: 'French Macaron Box', emoji: '🌸', price: 42, recipeCost: 11.50,
    category: 'Cookies', available: true,
    productType: 'macarons', soldBy: 'dozen',
    occasionTags: ['birthday', 'wedding'],
    addOns: [],
    typeFields: { flavors: 'Vanilla bean, raspberry, pistachio, salted caramel' },
    batchSize: 12, batchUnit: 'dozen'
  },
  {
    id: 'mi2', name: 'Custom Birthday Cake', emoji: '🎂', price: 85, recipeCost: null,
    category: 'Cakes', available: true,
    productType: 'cakes', soldBy: null,
    occasionTags: ['birthday'],
    addOns: [
      { name: 'Fondant details', price: 15, priceUnit: 'per_set' },
      { name: 'Edible image', price: 8, priceUnit: 'per_set' }
    ],
    typeFields: { sizes: ['8"'], layersPerTier: 2, tiers: 1, finish: 'Buttercream' },
    batchSize: 1, batchUnit: 'individual'
  },
  {
    id: 'mi3', name: 'Decorated Sugar Cookies', emoji: '🍪', price: 48, recipeCost: 14.00,
    category: 'Cookies', available: true,
    productType: 'sugarCookies', soldBy: 'dozen',
    occasionTags: ['birthday', 'holiday', 'baby shower'],
    addOns: [
      { name: 'Printed image', price: 4, priceUnit: 'per_cookie' },
      { name: 'Gold paint accent', price: 3, priceUnit: 'per_cookie' },
      { name: 'Piped name', price: 2, priceUnit: 'per_set' }
    ],
    typeFields: { maxColors: 5 },
    batchSize: 12, batchUnit: 'dozen'
  },
  { id: 'mi4', name: 'Cinnamon Rolls', emoji: '🥐', price: 24, recipeCost: 6.25, category: 'Pastry', available: true },
  { id: 'mi5', name: 'Lemon Tart', emoji: '🍋', price: 38, recipeCost: null, category: 'Pastry', available: false },
  { id: 'mi6', name: 'Banana Bread', emoji: '🍞', price: 14, recipeCost: 3.75, category: 'Pastry', available: true }
];

function getMenuItems() {
  return menuItems.map(m => ({ ...m }));
}

function getMenuItem(id) {
  const m = menuItems.find(x => x.id === id);
  return m ? { ...m } : null;
}

function addMenuItem(fields) {
  const item = {
    id: 'mi' + Date.now(),
    name: fields.name,
    emoji: fields.emoji || '🧁',
    price: Number(fields.price) || 0,
    recipeCost: fields.recipeCost != null ? Number(fields.recipeCost) : null,
    category: fields.category || 'Other',
    available: fields.available !== false,
    productType: fields.productType || null,
    soldBy: fields.soldBy || null,
    occasionTags: Array.isArray(fields.occasionTags) ? fields.occasionTags : [],
    addOns: Array.isArray(fields.addOns) ? fields.addOns : [],
    typeFields: fields.typeFields && typeof fields.typeFields === 'object' ? fields.typeFields : {},
    batchSize: fields.batchSize != null && fields.batchSize !== '' ? Number(fields.batchSize) : null,
    batchUnit: fields.batchUnit || null,
    minimumQuantity: Number(fields.minimumQuantity) > 0 ? Number(fields.minimumQuantity) : null
  };
  menuItems.push(item);
  return { ...item };
}

function updateMenuItem(id, fields) {
  const m = menuItems.find(x => x.id === id);
  if (!m) return null;
  if (fields.name != null) m.name = fields.name;
  if (fields.emoji != null) m.emoji = fields.emoji;
  if (fields.price != null) m.price = Number(fields.price) || 0;
  if (fields.recipeCost !== undefined) m.recipeCost = fields.recipeCost == null ? null : Number(fields.recipeCost);
  if (fields.category != null) m.category = fields.category;
  if (fields.available != null) m.available = !!fields.available;
  if (fields.productType !== undefined) m.productType = fields.productType || null;
  if (fields.soldBy !== undefined) m.soldBy = fields.soldBy || null;
  if (fields.occasionTags !== undefined) m.occasionTags = Array.isArray(fields.occasionTags) ? fields.occasionTags : [];
  if (fields.addOns !== undefined) m.addOns = Array.isArray(fields.addOns) ? fields.addOns : [];
  if (fields.typeFields !== undefined) m.typeFields = fields.typeFields && typeof fields.typeFields === 'object' ? fields.typeFields : {};
  if (fields.batchSize !== undefined) m.batchSize = fields.batchSize == null || fields.batchSize === '' ? null : Number(fields.batchSize);
  if (fields.batchUnit !== undefined) m.batchUnit = fields.batchUnit || null;
  if (fields.minimumQuantity !== undefined) m.minimumQuantity = Number(fields.minimumQuantity) > 0 ? Number(fields.minimumQuantity) : null;
  return { ...m };
}

function removeMenuItem(id) {
  menuItems = menuItems.filter(x => x.id !== id);
}

// Pricing tools state — per-baker price overrides, custom ingredients, supplies, recipes.

let bakerIngredientOverrides = {
  // demo: baker pays less for AP flour than the catalog average because she buys 25-lb sacks
  'ap-flour': 2.49
};

function getIngredientOverrides() { return { ...bakerIngredientOverrides }; }
function setIngredientOverride(catalogId, price) {
  if (price == null || price === '') {
    delete bakerIngredientOverrides[catalogId];
  } else {
    bakerIngredientOverrides[catalogId] = Number(price);
  }
  return { ...bakerIngredientOverrides };
}

let customIngredients = [
  {
    id: 'ci-rose-syrup',
    name: 'Rose syrup (specialty)',
    emoji: '🌹',
    packageSize: 16,
    packageUnit: 'oz',
    packagePrice: 14.98,
    amountUsedPerRecipe: 2,
    amountUnit: 'tbsp',
    costPerUse: 14.98 * (30 / 473) // 2 tbsp ≈ 30ml, package ≈ 473ml
  }
];

function getCustomIngredients() { return customIngredients.map(c => ({ ...c })); }

function customIngredientShape(fields, id) {
  const packagePrice = Number(fields.packagePrice) || 0;
  const packageSize = Number(fields.packageSize) || 1;
  const packageUnit = String(fields.packageUnit || 'oz');
  const amount = Number(fields.amountUsedPerRecipe) || 0;
  const amountUnit = String(fields.amountUnit || fields.packageUnit || 'oz');
  return {
    id,
    name: String(fields.name || '').trim() || 'Custom ingredient',
    emoji: fields.emoji || '⭐',
    packageSize,
    packageUnit,
    packagePrice,
    amountUsedPerRecipe: amount,
    amountUnit,
    costPerUse: customCostPerUse({ packagePrice, packageSize, packageUnit, amount, amountUnit })
  };
}

function addCustomIngredient(fields) {
  const item = customIngredientShape(fields, 'ci' + Date.now());
  customIngredients.push(item);
  return { ...item };
}

function updateCustomIngredient(id, fields) {
  const idx = customIngredients.findIndex(c => c.id === id);
  if (idx === -1) return null;
  const item = customIngredientShape(fields, id);
  customIngredients[idx] = item;
  return { ...item };
}

let supplies = [
  { id: 'sp-cake-box-8',     name: '8" cake box',         pricePerUse: 1.25 },
  { id: 'sp-cupcake-box-12', name: 'Cupcake box (12-ct)', pricePerUse: 1.50 },
  { id: 'sp-cake-board-10',  name: '10" cake board',      pricePerUse: 0.80 },
  { id: 'sp-treat-bag',      name: 'Treat bag',           pricePerUse: 0.08 },
  { id: 'sp-ribbon',         name: 'Ribbon (per yard)',   pricePerUse: 0.10 },
  { id: 'sp-sticker',        name: 'Custom sticker',      pricePerUse: 0.15 },
  { id: 'sp-parchment',      name: 'Parchment sheet',     pricePerUse: 0.06 }
];

function getSupplies() { return supplies.map(s => ({ ...s })); }
function upsertSupply(fields) {
  const name = String(fields.name || '').trim();
  if (!name) return null;
  if (fields.id) {
    const s = supplies.find(x => x.id === fields.id);
    if (!s) return null;
    if (fields.name != null) s.name = name;
    if (fields.pricePerUse != null) s.pricePerUse = Number(fields.pricePerUse) || 0;
    return { ...s };
  }
  const item = { id: 'sp' + Date.now(), name, pricePerUse: Number(fields.pricePerUse) || 0 };
  supplies.push(item);
  return { ...item };
}
function removeSupply(id) {
  supplies = supplies.filter(x => x.id !== id);
}

// recipes are keyed by menu item id
let recipes = {
  mi1: {
    menuItemId: 'mi1',
    store: 'walmart',
    listedPrice: 42,
    totalCost: 11.50,
    ingredients: [
      { catalogId: 'almond-flour',   custom: false, quantity: 1.5,  unit: 'cups' },
      { catalogId: 'powdered-sugar', custom: false, quantity: 1.5,  unit: 'cups' },
      { catalogId: 'egg-whites',     custom: false, quantity: 6,    unit: 'tbsp' },
      { catalogId: 'granulated-sugar', custom: false, quantity: 0.75, unit: 'cups' },
      { catalogId: 'unsalted-butter',  custom: false, quantity: 1,    unit: 'sticks' },
      { catalogId: 'vanilla-extract',  custom: false, quantity: 1,    unit: 'tsp' }
    ],
    supplies: [
      { catalogId: 'sp-cake-box-8',  quantity: 1 },
      { catalogId: 'sp-sticker',     quantity: 1 },
      { catalogId: 'sp-ribbon',      quantity: 1 }
    ]
  }
};

function shortenName(full) {
  const parts = String(full || '').trim().split(/\s+/);
  if (!parts.length) return 'Customer';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function getReviews() {
  return orders
    .filter(o => o.status === 'complete' && o.review && o.reviewRating)
    .map(o => ({
      id: 'rv-' + o.id,
      orderId: o.id,
      item: o.item,
      reviewerName: shortenName(o.customerName),
      reviewerCity: o.customerCity || '',
      rating: Number(o.reviewRating) || 5,
      text: o.review,
      date: o.reviewRequestedAt || o.completedDate || o.pickupDate,
      pickupDate: o.pickupDate
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function getRecipe(menuItemId) {
  const r = recipes[menuItemId];
  if (!r) return null;
  return {
    ...r,
    ingredients: r.ingredients.map(i => ({ ...i })),
    supplies: r.supplies.map(s => ({ ...s }))
  };
}

function saveRecipe(menuItemId, payload) {
  const recipe = {
    menuItemId,
    store: String(payload.store || 'walmart'),
    listedPrice: Number(payload.listedPrice) || 0,
    totalCost: Number(payload.totalCost) || 0,
    batchSize: payload.batchSize != null && payload.batchSize !== '' ? Number(payload.batchSize) : null,
    batchUnit: payload.batchUnit || null,
    ingredients: Array.isArray(payload.ingredients) ? payload.ingredients.map(i => ({
      catalogId: String(i.catalogId),
      custom: !!i.custom,
      quantity: Number(i.quantity) || 0,
      unit: String(i.unit || '')
    })) : [],
    supplies: Array.isArray(payload.supplies) ? payload.supplies.map(s => ({
      catalogId: String(s.catalogId),
      quantity: Number(s.quantity) || 0
    })) : []
  };
  recipes[menuItemId] = recipe;
  const item = menuItems.find(x => x.id === menuItemId);
  if (item) {
    item.recipeCost = recipe.totalCost;
    // Only overwrite the base price when the baker confirmed it (applyPrice).
    if (payload.applyPrice === true && recipe.listedPrice > 0) item.price = recipe.listedPrice;
    if (recipe.batchSize != null) item.batchSize = recipe.batchSize;
    if (recipe.batchUnit) item.batchUnit = recipe.batchUnit;
  }
  return { ...recipe };
}

module.exports = {
  baker,
  getOrders,
  getOrder,
  acceptOrder,
  declineOrder,
  markReady,
  setAcceptingOrders,
  getSlots,
  addSlot,
  updateSlot,
  removeSlot,
  getConversations,
  getConversation,
  appendMessage,
  markRead,
  getMenuItems,
  getMenuItem,
  addMenuItem,
  updateMenuItem,
  removeMenuItem,
  getIngredientOverrides,
  setIngredientOverride,
  getCustomIngredients,
  addCustomIngredient,
  updateCustomIngredient,
  getSupplies,
  upsertSupply,
  removeSupply,
  getRecipe,
  saveRecipe,
  getReviews,
  updateBaker,
  clearFaq,
  FAQ_KEYS
};
