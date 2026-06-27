// Bkd Local — Ingredient Catalog
// Per-store package prices and unit conversions for the Price My Bakes calculator.
// All ingredients normalize to grams (or ml ≈ g for liquids) so cost-per-unit math is uniform.

const UNIT_GROUPS = {
  flour:         { units: ['cups', 'grams', 'oz', 'lbs'],          default: 'cups',   toGrams: { cups: 120,  grams: 1, oz: 28.35, lbs: 453.59 } },
  sugar:         { units: ['cups', 'grams', 'oz', 'lbs'],          default: 'cups',   toGrams: { cups: 200,  grams: 1, oz: 28.35, lbs: 453.59 } },
  brownSugar:    { units: ['cups', 'grams', 'oz', 'lbs'],          default: 'cups',   toGrams: { cups: 213,  grams: 1, oz: 28.35, lbs: 453.59 } },
  powderedSugar: { units: ['cups', 'grams', 'oz', 'lbs'],          default: 'cups',   toGrams: { cups: 120,  grams: 1, oz: 28.35, lbs: 453.59 } },
  butter:        { units: ['tbsp', 'grams', 'sticks', 'cups'],     default: 'sticks', toGrams: { tbsp: 14.2, grams: 1, sticks: 113, cups: 226 } },
  eggs:          { units: ['count', 'grams'],                      default: 'count',  toGrams: { count: 50,  grams: 1 } },
  liquid:        { units: ['cups', 'tbsp', 'ml', 'oz'],            default: 'cups',   toGrams: { cups: 240,  tbsp: 15, ml: 1, oz: 29.57 } },
  oil:           { units: ['cups', 'tbsp', 'ml', 'oz'],            default: 'cups',   toGrams: { cups: 218,  tbsp: 13.6, ml: 0.91, oz: 26.9 } },
  syrup:         { units: ['cups', 'tbsp', 'ml', 'oz'],            default: 'cups',   toGrams: { cups: 322,  tbsp: 20, ml: 1.34, oz: 39.6 } },
  extract:       { units: ['tsp', 'tbsp', 'ml'],                   default: 'tsp',    toGrams: { tsp: 4.2,   tbsp: 12.6, ml: 0.85 } },
  leavening:     { units: ['tsp', 'tbsp', 'grams'],                default: 'tsp',    toGrams: { tsp: 4,     tbsp: 12, grams: 1 } },
  thickener:     { units: ['tsp', 'tbsp', 'grams', 'oz'],          default: 'tbsp',   toGrams: { tsp: 3,     tbsp: 9, grams: 1, oz: 28.35 } },
  spice:         { units: ['tsp', 'tbsp', 'grams'],                default: 'tsp',    toGrams: { tsp: 2.5,   tbsp: 7.5, grams: 1 } },
  salt:          { units: ['tsp', 'tbsp', 'grams'],                default: 'tsp',    toGrams: { tsp: 6,     tbsp: 18, grams: 1 } },
  herbs:         { units: ['tsp', 'tbsp', 'grams', 'oz'],          default: 'tbsp',   toGrams: { tsp: 1,     tbsp: 3, grams: 1, oz: 28.35 } },
  fruit:         { units: ['oz', 'grams', 'cups', 'count'],        default: 'cups',   toGrams: { oz: 28.35,  grams: 1, cups: 150, count: 100 } },
  driedFruit:    { units: ['oz', 'grams', 'cups'],                 default: 'cups',   toGrams: { oz: 28.35,  grams: 1, cups: 150 } },
  chocolate:     { units: ['oz', 'grams', 'cups'],                 default: 'cups',   toGrams: { oz: 28.35,  grams: 1, cups: 170 } },
  cocoa:         { units: ['cups', 'tbsp', 'grams', 'oz'],         default: 'tbsp',   toGrams: { cups: 85,   tbsp: 5.3, grams: 1, oz: 28.35 } },
  nuts:          { units: ['oz', 'grams', 'cups'],                 default: 'cups',   toGrams: { oz: 28.35,  grams: 1, cups: 120 } },
  seeds:         { units: ['tsp', 'tbsp', 'grams', 'oz', 'cups'],  default: 'tbsp',   toGrams: { tsp: 3,     tbsp: 9, grams: 1, oz: 28.35, cups: 145 } },
  decoration:    { units: ['oz', 'grams', 'tbsp', 'tsp'],          default: 'tbsp',   toGrams: { oz: 28.35,  grams: 1, tbsp: 8, tsp: 2.5 } },
  coloring:      { units: ['drops', 'tsp', 'oz'],                  default: 'drops',  toGrams: { drops: 0.05, tsp: 5, oz: 28.35 } },
  specialty:     { units: ['oz', 'grams', 'tbsp', 'cups'],         default: 'tbsp',   toGrams: { oz: 28.35,  grams: 1, tbsp: 15, cups: 240 } },
  cookie:        { units: ['count', 'grams', 'oz', 'cups'],        default: 'cups',   toGrams: { count: 10,  grams: 1, oz: 28.35, cups: 100 } },
  oats:          { units: ['cups', 'grams', 'oz', 'lbs'],          default: 'cups',   toGrams: { cups: 90,   grams: 1, oz: 28.35, lbs: 453.59 } },
  cheese:        { units: ['oz', 'grams', 'cups', 'tbsp'],         default: 'oz',     toGrams: { oz: 28.35,  grams: 1, cups: 113, tbsp: 7 } },
  freshHerb:     { units: ['tsp', 'tbsp', 'grams', 'sprigs'],      default: 'tbsp',   toGrams: { tsp: 1,     tbsp: 3, grams: 1, sprigs: 2 } },
  freshAromatic: { units: ['cloves', 'tsp', 'tbsp', 'grams'],      default: 'cloves', toGrams: { cloves: 4,  tsp: 3, tbsp: 9, grams: 1 } },
  vinegar:       { units: ['tsp', 'tbsp', 'cups', 'ml', 'oz'],     default: 'tbsp',   toGrams: { tsp: 5,     tbsp: 15, cups: 240, ml: 1, oz: 29.57 } },
  tea:           { units: ['tsp', 'tbsp', 'grams', 'bags'],        default: 'tsp',    toGrams: { tsp: 2,     tbsp: 6, grams: 1, bags: 2 } }
};

const ING = (id, name, emoji, category, unitGroup, defaultUnit, prices, packageLabel, packageGrams) => ({
  id, name, emoji, category, unitGroup, defaultUnit,
  prices: { walmart: prices[0], kroger: prices[1], aldi: prices[2], sams: prices[3] },
  packageLabel, packageGrams
});

const CATALOG = [
  // ── Flours ────────────────────────────────────────────────────────────────
  ING('ap-flour',         'AP flour',            '🌾', 'Flours', 'flour',  'cups', [3.49, 3.69, 3.29, 2.98], '5 lb bag',    2268),
  ING('cake-flour',        'Cake flour',          '🌾', 'Flours', 'flour',  'cups', [3.98, 4.29, 3.79, 3.49], '2 lb box',    907),
  ING('bread-flour',       'Bread flour',         '🌾', 'Flours', 'flour',  'cups', [4.19, 4.49, 3.89, 3.69], '5 lb bag',    2268),
  ING('almond-flour',      'Almond flour',        '🌰', 'Flours', 'flour',  'cups', [8.98, 9.49, 7.99, 14.98], '16 oz bag',  454),
  ING('coconut-flour',     'Coconut flour',       '🥥', 'Flours', 'flour',  'cups', [5.49, 5.79, 4.99, 9.98], '16 oz bag',   454),
  ING('oat-flour',         'Oat flour',           '🌾', 'Flours', 'flour',  'cups', [4.49, 4.79, 4.29, 7.98], '20 oz bag',   567),
  ING('whole-wheat-flour', 'Whole wheat flour',   '🌾', 'Flours', 'flour',  'cups', [3.79, 3.99, 3.49, 3.29], '5 lb bag',    2268),
  ING('self-rising-flour', 'Self-rising flour',   '🌾', 'Flours', 'flour',  'cups', [3.49, 3.69, 3.29, 2.98], '5 lb bag',    2268),
  ING('rye-flour',         'Rye flour',           '🌾', 'Flours', 'flour',  'cups', [4.79, 5.19, 4.49, 4.29], '2 lb bag',    907),
  ING('rice-flour',        'Rice flour',          '🍚', 'Flours', 'flour',  'cups', [3.98, 4.29, 3.69, 6.98], '16 oz bag',   454),
  ING('semolina',          'Semolina flour',      '🌾', 'Flours', 'flour',  'cups', [3.79, 3.99, 3.49, 3.29], '24 oz bag',   680),
  ING('buckwheat-flour',   'Buckwheat flour',     '🌾', 'Flours', 'flour',  'cups', [5.49, 5.79, 4.99, 8.98], '16 oz bag',   454),
  ING('spelt-flour',       'Spelt flour',         '🌾', 'Flours', 'flour',  'cups', [5.79, 6.19, 5.29, 9.49], '20 oz bag',   567),
  ING('masa-harina',       'Masa harina',         '🌽', 'Flours', 'flour',  'cups', [3.49, 3.79, 3.19, 5.98], '4 lb bag',    1814),

  // ── Sugars & Sweeteners ───────────────────────────────────────────────────
  ING('granulated-sugar',  'Granulated sugar',    '🍬', 'Sugars', 'sugar',          'cups', [3.49, 3.79, 3.19, 11.98], '4 lb bag',   1814),
  ING('powdered-sugar',    'Powdered sugar',      '🍬', 'Sugars', 'powderedSugar',  'cups', [2.79, 2.99, 2.49, 6.98],  '2 lb bag',   907),
  ING('light-brown-sugar', 'Light brown sugar',   '🟫', 'Sugars', 'brownSugar',     'cups', [3.29, 3.49, 2.99, 7.48],  '2 lb bag',   907),
  ING('dark-brown-sugar',  'Dark brown sugar',    '🟫', 'Sugars', 'brownSugar',     'cups', [3.49, 3.69, 3.19, 7.98],  '2 lb bag',   907),
  ING('raw-sugar',         'Raw sugar',           '🟤', 'Sugars', 'sugar',          'cups', [4.49, 4.79, 3.99, 8.98],  '2 lb bag',   907),
  ING('turbinado',         'Turbinado sugar',     '🟤', 'Sugars', 'sugar',          'cups', [4.79, 4.99, 4.29, 9.49],  '2 lb bag',   907),
  ING('demerara',          'Demerara sugar',      '🟤', 'Sugars', 'sugar',          'cups', [4.98, 5.29, 4.49, 9.98],  '2 lb bag',   907),
  ING('muscovado',         'Muscovado sugar',     '🟤', 'Sugars', 'brownSugar',     'cups', [6.49, 6.99, 5.98, 11.98], '16 oz box',  454),
  ING('coconut-sugar',     'Coconut sugar',       '🥥', 'Sugars', 'sugar',          'cups', [5.49, 5.79, 4.99, 9.98],  '16 oz bag',  454),
  ING('confectioners',     'Confectioners sugar', '❄️', 'Sugars', 'powderedSugar',  'cups', [2.79, 2.99, 2.49, 6.98],  '2 lb bag',   907),
  ING('maple-syrup',       'Maple syrup',         '🍁', 'Sugars', 'syrup',          'tbsp', [12.98, 13.99, 9.98, 22.98], '32 oz btl', 1030),
  ING('honey',             'Honey',               '🍯', 'Sugars', 'syrup',          'tbsp', [8.49, 8.99, 6.98, 15.98], '24 oz btl', 680),
  ING('corn-syrup',        'Corn syrup',          '🍯', 'Sugars', 'syrup',          'tbsp', [3.79, 3.99, 3.49, 7.49],  '16 oz btl', 454),
  ING('agave',             'Agave nectar',        '🍯', 'Sugars', 'syrup',          'tbsp', [6.49, 6.99, 5.79, 11.98], '23 oz btl', 660),
  ING('molasses',          'Molasses',            '🥃', 'Sugars', 'syrup',          'tbsp', [3.79, 3.99, 3.49, 7.98],  '12 oz btl', 340),
  ING('golden-syrup',      'Golden syrup',        '🍯', 'Sugars', 'syrup',          'tbsp', [5.49, 5.99, 4.98, 9.98],  '16 oz btl', 454),
  ING('date-syrup',        'Date syrup',          '🍯', 'Sugars', 'syrup',          'tbsp', [7.98, 8.49, 7.49, 13.98], '12 oz btl', 340),

  // ── Fats ──────────────────────────────────────────────────────────────────
  ING('unsalted-butter',   'Unsalted butter',     '🧈', 'Fats',   'butter', 'sticks', [4.49, 4.79, 3.98, 12.48], '1 lb (4 sticks)', 454),
  ING('salted-butter',     'Salted butter',       '🧈', 'Fats',   'butter', 'sticks', [4.29, 4.59, 3.78, 11.98], '1 lb (4 sticks)', 454),
  ING('european-butter',   'European-style butter','🧈', 'Fats',  'butter', 'sticks', [6.98, 7.49, 5.98, 14.98], '8 oz block',      227),
  ING('vegetable-oil',     'Vegetable oil',       '🛢️', 'Fats',   'oil',    'cups',   [4.49, 4.79, 3.98, 10.98], '48 oz btl',       1308),
  ING('coconut-oil',       'Coconut oil',         '🥥', 'Fats',   'oil',    'tbsp',   [6.98, 7.49, 5.98, 13.98], '14 oz jar',       397),
  ING('shortening',        'Shortening',          '🥄', 'Fats',   'butter', 'cups',   [6.49, 6.99, 5.98, 11.98], '1 lb 8 oz',       680),
  ING('canola-oil',        'Canola oil',          '🛢️', 'Fats',   'oil',    'cups',   [4.79, 4.99, 4.29, 11.49], '48 oz btl',       1308),

  // ── Dairy ─────────────────────────────────────────────────────────────────
  ING('cream-cheese',      'Cream cheese',        '🧀', 'Dairy',  'cheese', 'oz',   [2.49, 2.79, 1.98, 5.98],  '8 oz block',  227),
  ING('heavy-cream',       'Heavy cream',         '🥛', 'Dairy',  'liquid', 'cups', [4.49, 4.79, 3.98, 8.98],  '1 pint',      473),
  ING('whole-milk',        'Whole milk',          '🥛', 'Dairy',  'liquid', 'cups', [3.79, 3.99, 3.49, 6.98],  '1 gallon',    3785),
  ING('buttermilk',        'Buttermilk',          '🥛', 'Dairy',  'liquid', 'cups', [2.49, 2.79, 1.98, 5.98],  '1 qt',        946),
  ING('sour-cream',        'Sour cream',          '🥛', 'Dairy',  'liquid', 'cups', [2.79, 2.99, 2.29, 5.98],  '16 oz tub',   454),
  ING('half-and-half',     'Half and half',       '🥛', 'Dairy',  'liquid', 'cups', [2.79, 2.99, 2.49, 5.98],  '1 qt',        946),
  ING('evaporated-milk',   'Evaporated milk',     '🥫', 'Dairy',  'liquid', 'cups', [2.29, 2.49, 1.79, 4.98],  '12 oz can',   354),
  ING('condensed-milk',    'Sweetened condensed milk','🥫','Dairy','liquid','cups', [2.79, 2.99, 2.29, 5.98],  '14 oz can',   396),
  ING('ricotta',           'Ricotta',             '🧀', 'Dairy',  'cheese', 'cups', [4.49, 4.79, 3.98, 8.49],  '15 oz tub',   425),
  ING('mascarpone',        'Mascarpone',          '🧀', 'Dairy',  'cheese', 'cups', [6.98, 7.49, 5.98, 11.98], '8 oz tub',    227),
  ING('greek-yogurt',      'Greek yogurt',        '🥣', 'Dairy',  'liquid', 'cups', [5.49, 5.79, 4.49, 9.98],  '32 oz tub',   907),
  ING('plain-yogurt',      'Plain yogurt',        '🥣', 'Dairy',  'liquid', 'cups', [3.79, 3.99, 3.29, 7.49],  '32 oz tub',   907),
  ING('cottage-cheese',    'Cottage cheese',      '🧀', 'Dairy',  'cheese', 'cups', [3.49, 3.79, 2.98, 6.98],  '16 oz tub',   454),
  ING('coconut-milk',      'Coconut milk',        '🥥', 'Dairy',  'liquid', 'cups', [2.49, 2.79, 1.98, 4.98],  '13.5 oz can', 383),
  ING('cream-of-coconut',  'Cream of coconut',    '🥥', 'Dairy',  'liquid', 'cups', [3.98, 4.49, 3.49, 7.98],  '15 oz can',   425),
  ING('almond-milk',       'Almond milk',         '🥛', 'Dairy',  'liquid', 'cups', [3.49, 3.79, 2.79, 6.98],  '64 oz carton',1893),
  ING('oat-milk',          'Oat milk',            '🥛', 'Dairy',  'liquid', 'cups', [4.49, 4.79, 3.79, 8.98],  '64 oz carton',1893),

  // ── Eggs ──────────────────────────────────────────────────────────────────
  ING('large-eggs',        'Large eggs',          '🥚', 'Eggs',   'eggs',   'count', [4.49, 4.79, 3.98, 11.98], '1 dozen',     600),
  ING('egg-whites',        'Egg whites (carton)', '🥚', 'Eggs',   'liquid', 'tbsp',  [4.49, 4.79, 3.98, 8.98],  '16 oz carton',454),
  ING('egg-yolks',         'Egg yolks (count)',   '🥚', 'Eggs',   'eggs',   'count', [4.49, 4.79, 3.98, 11.98], '1 dozen eggs',600),

  // ── Leavening & Thickeners ───────────────────────────────────────────────
  ING('baking-soda',       'Baking soda',         '🧂', 'Leavening','leavening','tsp',[1.29, 1.49, 0.98, 2.98], '16 oz box',   454),
  ING('baking-powder',     'Baking powder',       '🧂', 'Leavening','leavening','tsp',[2.79, 2.99, 2.49, 5.98], '10 oz can',   283),
  ING('active-dry-yeast',  'Active dry yeast',    '🧪', 'Leavening','leavening','tsp',[6.98, 7.49, 5.98, 4.98], '4 oz jar',    113),
  ING('instant-yeast',     'Instant yeast',       '🧪', 'Leavening','leavening','tsp',[7.49, 7.98, 6.49, 5.49], '4 oz jar',    113),
  ING('cream-of-tartar',   'Cream of tartar',     '🧪', 'Leavening','thickener','tsp',[3.98, 4.29, 3.49, 7.98], '3.4 oz jar',  96),
  ING('cornstarch',        'Cornstarch',          '🌽', 'Thickeners','thickener','tbsp',[2.49, 2.79, 1.98, 4.98],'16 oz box',  454),
  ING('gelatin',           'Gelatin (unflavored)','🧪', 'Thickeners','thickener','tsp',[5.98, 6.49, 5.29, 9.98], '1 oz box',    28),
  ING('arrowroot',         'Arrowroot powder',    '🌿', 'Thickeners','thickener','tbsp',[4.98, 5.49, 4.49, 8.98],'8 oz bag',   227),
  ING('xanthan-gum',       'Xanthan gum',         '🧪', 'Thickeners','thickener','tsp',[8.98, 9.49, 7.98, 14.98],'8 oz bag',   227),
  ING('psyllium-husk',     'Psyllium husk',       '🌿', 'Thickeners','thickener','tbsp',[7.98, 8.49, 6.98, 12.98],'12 oz bag', 340),
  ING('guar-gum',          'Guar gum',            '🧪', 'Thickeners','thickener','tsp',[9.98, 10.49, 8.98, 16.98],'8 oz bag',  227),
  ING('agar-agar',         'Agar agar',           '🧪', 'Thickeners','thickener','tsp',[7.98, 8.49, 6.98, 12.98],'2 oz bag',    57),
  ING('pectin',            'Pectin',              '🧪', 'Thickeners','thickener','tbsp',[4.98, 5.49, 4.29, 8.98],'1.75 oz box', 50),

  // ── Extracts & Flavorings ────────────────────────────────────────────────
  ING('vanilla-extract',   'Vanilla extract',     '🌿', 'Extracts','extract','tsp',  [8.98, 9.98, 7.49, 14.98],  '4 oz btl',  118),
  ING('vanilla-paste',     'Vanilla bean paste',  '🌿', 'Extracts','extract','tsp',  [14.98, 15.98, 11.98, 24.98],'4 oz jar', 118),
  ING('almond-extract',    'Almond extract',      '🌰', 'Extracts','extract','tsp',  [4.98, 5.49, 3.98, 8.98],   '2 oz btl',   59),
  ING('lemon-extract',     'Lemon extract',       '🍋', 'Extracts','extract','tsp',  [3.98, 4.29, 3.29, 6.98],   '2 oz btl',   59),
  ING('orange-extract',    'Orange extract',      '🍊', 'Extracts','extract','tsp',  [3.98, 4.29, 3.29, 6.98],   '2 oz btl',   59),
  ING('peppermint-extract','Peppermint extract',  '🌿', 'Extracts','extract','tsp',  [4.49, 4.79, 3.79, 7.98],   '2 oz btl',   59),
  ING('coconut-extract',   'Coconut extract',     '🥥', 'Extracts','extract','tsp',  [4.49, 4.79, 3.79, 7.98],   '2 oz btl',   59),
  ING('rose-water',        'Rose water',          '🌹', 'Extracts','liquid', 'tbsp', [5.49, 5.98, 4.79, 9.98],   '10 oz btl', 295),
  ING('espresso-powder',   'Espresso powder',     '☕', 'Extracts','spice',  'tsp',  [11.98, 12.98, 10.49, 17.98],'2 oz jar',   57),
  ING('instant-coffee',    'Instant coffee',      '☕', 'Extracts','spice',  'tsp',  [6.98, 7.49, 5.98, 11.98],  '8 oz jar',  227),
  ING('maple-flavor',      'Maple flavor',        '🍁', 'Extracts','extract','tsp',  [3.98, 4.29, 3.29, 6.98],   '1 oz btl',   30),
  ING('butter-flavor',     'Butter flavor',       '🧈', 'Extracts','extract','tsp',  [3.98, 4.29, 3.29, 6.98],   '1 oz btl',   30),
  ING('hazelnut-extract',  'Hazelnut extract',    '🌰', 'Extracts','extract','tsp',  [5.49, 5.98, 4.79, 9.98],   '2 oz btl',   59),
  ING('anise-extract',     'Anise extract',       '🌿', 'Extracts','extract','tsp',  [4.49, 4.79, 3.79, 7.98],   '2 oz btl',   59),
  ING('rum-extract',       'Rum extract',         '🥃', 'Extracts','extract','tsp',  [3.98, 4.29, 3.29, 6.98],   '1 oz btl',   30),
  ING('lavender-extract',  'Lavender extract',    '💜', 'Extracts','extract','tsp',  [6.98, 7.49, 5.98, 11.98],  '2 oz btl',   59),
  ING('orange-blossom',    'Orange blossom water','🌸', 'Extracts','liquid', 'tbsp', [7.98, 8.49, 6.98, 12.98],  '10 oz btl', 295),

  // ── Chocolate ────────────────────────────────────────────────────────────
  ING('cocoa-natural',     'Cocoa powder (natural)','🍫','Chocolate','cocoa', 'tbsp',[3.98, 4.29, 3.29, 6.98],  '8 oz can',    227),
  ING('cocoa-dutch',       'Cocoa powder (Dutch)', '🍫','Chocolate','cocoa', 'tbsp',[5.98, 6.49, 5.29, 9.98],  '8 oz bag',    227),
  ING('dark-chocolate',    'Dark chocolate (bar)', '🍫','Chocolate','chocolate','oz',[4.98, 5.49, 4.29, 8.98], '8 oz bar',    227),
  ING('milk-chocolate',    'Milk chocolate (bar)', '🍫','Chocolate','chocolate','oz',[4.49, 4.98, 3.98, 7.98], '8 oz bar',    227),
  ING('white-chocolate',   'White chocolate (bar)','🍫','Chocolate','chocolate','oz',[4.79, 5.29, 4.29, 8.49], '8 oz bar',    227),
  ING('semisweet-chips',   'Semisweet chocolate chips','🍫','Chocolate','chocolate','cups',[3.79, 3.99, 3.29, 8.98],'12 oz bag',340),
  ING('dark-chips',        'Dark chocolate chips', '🍫','Chocolate','chocolate','cups',[4.49, 4.79, 3.98, 9.98],'10 oz bag', 283),
  ING('milk-chips',        'Milk chocolate chips', '🍫','Chocolate','chocolate','cups',[3.79, 3.99, 3.29, 8.98],'11 oz bag', 312),
  ING('white-chips',       'White chocolate chips','🍫','Chocolate','chocolate','cups',[3.79, 3.99, 3.29, 8.98],'11 oz bag', 312),
  ING('cocoa-butter',      'Cocoa butter',         '🍫','Chocolate','chocolate','oz', [12.98, 13.98, 11.49, 19.98],'8 oz bag',227),
  ING('bittersweet-choc',  'Bittersweet chocolate','🍫','Chocolate','chocolate','oz', [5.98, 6.49, 5.29, 9.98],  '8 oz bar', 227),

  // ── Spices ───────────────────────────────────────────────────────────────
  ING('cinnamon',          'Cinnamon (ground)',   '🌰','Spices', 'spice','tsp',[3.49, 3.79, 2.98, 5.98], '2.37 oz jar', 67),
  ING('nutmeg',            'Nutmeg (ground)',     '🌰','Spices', 'spice','tsp',[5.98, 6.49, 5.29, 9.98], '2.2 oz jar',  62),
  ING('cardamom',          'Cardamom (ground)',   '🌿','Spices', 'spice','tsp',[8.98, 9.49, 7.98, 14.98],'1.8 oz jar',  51),
  ING('ginger',            'Ginger (ground)',     '🌰','Spices', 'spice','tsp',[3.79, 3.99, 3.29, 6.98], '1.74 oz jar', 49),
  ING('cloves',            'Cloves (ground)',     '🌰','Spices', 'spice','tsp',[5.98, 6.49, 5.29, 9.98], '1.62 oz jar', 46),
  ING('table-salt',        'Salt (table)',        '🧂','Spices', 'salt', 'tsp',[1.49, 1.69, 1.29, 2.98], '26 oz can',   737),
  ING('kosher-salt',       'Kosher salt',         '🧂','Spices', 'salt', 'tsp',[3.49, 3.79, 2.98, 5.98], '3 lb box',    1361),
  ING('fleur-de-sel',      'Fleur de sel',        '🧂','Spices', 'salt', 'tsp',[12.98, 13.98, 11.49, 19.98],'4 oz jar', 113),
  ING('sea-salt-flakes',   'Sea salt flakes',     '🧂','Spices', 'salt', 'tsp',[9.98, 10.98, 8.98, 14.98],'8.5 oz tin', 241),
  ING('allspice',          'Allspice (ground)',   '🌰','Spices', 'spice','tsp',[5.49, 5.98, 4.79, 8.98], '2.4 oz jar',  68),
  ING('mace',              'Mace (ground)',       '🌰','Spices', 'spice','tsp',[6.98, 7.49, 5.98, 11.98],'1.74 oz jar', 49),
  ING('star-anise',        'Star anise',          '🌟','Spices', 'spice','tsp',[5.49, 5.98, 4.79, 8.98], '1.5 oz jar',  43),
  ING('fennel-seed',       'Fennel seed',         '🌿','Spices', 'spice','tsp',[3.98, 4.29, 3.29, 6.98], '1.6 oz jar',  45),
  ING('black-pepper',      'Black pepper',        '⚫','Spices', 'spice','tsp',[4.98, 5.49, 4.29, 7.98], '3 oz jar',    85),
  ING('cayenne',           'Cayenne pepper',      '🌶️','Spices', 'spice','tsp',[3.49, 3.79, 2.98, 5.98], '2.5 oz jar',  71),
  ING('paprika',           'Paprika',             '🌶️','Spices', 'spice','tsp',[3.49, 3.79, 2.98, 5.98], '2.6 oz jar',  74),
  ING('pumpkin-spice',     'Pumpkin pie spice',   '🎃','Spices', 'spice','tsp',[4.98, 5.49, 4.29, 7.98], '1.7 oz jar',  48),

  // ── Fresh Fruit ──────────────────────────────────────────────────────────
  ING('strawberries',      'Fresh strawberries',  '🍓','Fruit',  'fruit','cups',[4.98, 5.49, 3.98, 7.98], '1 lb pkg',    454),
  ING('blueberries',       'Fresh blueberries',   '🫐','Fruit',  'fruit','cups',[4.49, 4.79, 3.79, 8.98], '1 pint',      340),
  ING('raspberries',       'Fresh raspberries',   '🍓','Fruit',  'fruit','cups',[4.98, 5.49, 3.98, 8.98], '6 oz clamshell',170),
  ING('blackberries',      'Fresh blackberries',  '🫐','Fruit',  'fruit','cups',[4.98, 5.49, 3.98, 8.98], '6 oz clamshell',170),
  ING('lemon',             'Fresh lemon',         '🍋','Fruit',  'fruit','count',[0.69, 0.79, 0.49, 0.59],'each',         100),
  ING('lime',              'Fresh lime',          '🟢','Fruit',  'fruit','count',[0.49, 0.59, 0.39, 0.45],'each',          67),
  ING('orange',            'Fresh orange',        '🍊','Fruit',  'fruit','count',[0.98, 1.09, 0.79, 0.89],'each',         184),
  ING('apple',             'Fresh apple',         '🍎','Fruit',  'fruit','count',[0.98, 1.09, 0.79, 0.85],'each',         182),
  ING('banana',            'Fresh banana',        '🍌','Fruit',  'fruit','count',[0.27, 0.29, 0.21, 0.25],'each',         118),
  ING('pear',              'Fresh pear',          '🍐','Fruit',  'fruit','count',[1.29, 1.49, 0.98, 1.19],'each',         178),
  ING('peach',             'Fresh peach',         '🍑','Fruit',  'fruit','count',[1.49, 1.69, 0.98, 1.39],'each',         150),
  ING('mango',             'Fresh mango',         '🥭','Fruit',  'fruit','count',[1.49, 1.79, 0.98, 1.49],'each',         200),
  ING('pineapple',         'Fresh pineapple',     '🍍','Fruit',  'fruit','count',[3.98, 4.49, 2.98, 3.98],'each',         900),
  ING('kiwi',              'Fresh kiwi',          '🥝','Fruit',  'fruit','count',[0.79, 0.89, 0.59, 0.69],'each',          76),
  ING('cherries',          'Fresh cherries',      '🍒','Fruit',  'fruit','cups',[6.98, 7.49, 5.98, 9.98], '1 lb',         454),
  ING('plums',             'Fresh plums',         '🟣','Fruit',  'fruit','count',[1.29, 1.49, 0.98, 1.19],'each',          80),
  ING('coconut-flakes-sw', 'Coconut flakes (sweetened)','🥥','Fruit','driedFruit','cups',[3.49, 3.79, 2.98, 6.98],'14 oz bag',397),
  ING('coconut-flakes-un', 'Coconut flakes (unsweetened)','🥥','Fruit','driedFruit','cups',[4.49, 4.79, 3.98, 7.98],'8 oz bag',227),

  // ── Dried Fruit & Preserves ─────────────────────────────────────────────
  ING('dried-cranberries', 'Dried cranberries',   '🔴','Fruit',  'driedFruit','cups',[3.79, 3.99, 3.29, 7.98],'12 oz bag', 340),
  ING('raisins',           'Raisins',             '🟣','Fruit',  'driedFruit','cups',[3.49, 3.79, 2.98, 6.98],'15 oz box', 425),
  ING('maraschino',        'Maraschino cherries', '🍒','Fruit',  'fruit','cups',[3.79, 3.99, 3.29, 7.98],'10 oz jar',  283),
  ING('dates',             'Dates (Medjool)',     '🟫','Fruit',  'driedFruit','cups',[7.98, 8.49, 6.98, 12.98],'16 oz tub',454),
  ING('figs-dried',        'Dried figs',          '🟣','Fruit',  'driedFruit','cups',[5.98, 6.49, 5.29, 9.98],'8 oz bag', 227),
  ING('prunes',            'Prunes',              '🟫','Fruit',  'driedFruit','cups',[4.98, 5.49, 4.29, 8.98],'12 oz bag',340),
  ING('apricots-dried',    'Dried apricots',      '🟠','Fruit',  'driedFruit','cups',[5.49, 5.98, 4.79, 9.98],'8 oz bag', 227),
  ING('strawberry-jam',    'Strawberry jam',      '🍓','Fruit',  'liquid','tbsp',[3.98, 4.29, 3.29, 7.98], '18 oz jar', 510),
  ING('raspberry-jam',     'Raspberry jam',       '🍓','Fruit',  'liquid','tbsp',[4.49, 4.79, 3.79, 8.49], '18 oz jar', 510),
  ING('apricot-jam',       'Apricot jam',         '🟠','Fruit',  'liquid','tbsp',[4.49, 4.79, 3.79, 8.49], '18 oz jar', 510),
  ING('blueberry-jam',     'Blueberry jam',       '🫐','Fruit',  'liquid','tbsp',[4.49, 4.79, 3.79, 8.49], '18 oz jar', 510),
  ING('fruit-puree',       'Fruit puree',         '🍓','Fruit',  'liquid','cups',[5.98, 6.49, 5.29, 11.98],'30 oz tub', 850),
  ING('apple-sauce',       'Apple sauce',         '🍎','Fruit',  'liquid','cups',[2.79, 2.99, 2.29, 5.98], '23 oz jar', 652),
  ING('pumpkin-puree',     'Pumpkin puree',       '🎃','Fruit',  'liquid','cups',[2.49, 2.79, 1.98, 4.98], '15 oz can', 425),
  ING('sweet-potato-puree','Sweet potato puree',  '🍠','Fruit',  'liquid','cups',[2.49, 2.79, 1.98, 4.98], '15 oz can', 425),

  // ── Nuts & Seeds ─────────────────────────────────────────────────────────
  ING('walnuts',           'Walnuts',             '🌰','Nuts',   'nuts', 'cups',[7.98, 8.49, 6.98, 12.98],'10 oz bag', 283),
  ING('pecans',            'Pecans',              '🌰','Nuts',   'nuts', 'cups',[8.98, 9.49, 7.98, 13.98],'10 oz bag', 283),
  ING('almonds',           'Almonds',             '🌰','Nuts',   'nuts', 'cups',[6.98, 7.49, 5.98, 13.98],'12 oz bag', 340),
  ING('hazelnuts',         'Hazelnuts',           '🌰','Nuts',   'nuts', 'cups',[8.98, 9.49, 7.98, 13.98],'10 oz bag', 283),
  ING('pistachios',        'Pistachios (shelled)','🌰','Nuts',   'nuts', 'cups',[10.98, 11.98, 9.98, 17.98],'8 oz bag', 227),
  ING('macadamia',         'Macadamia nuts',      '🌰','Nuts',   'nuts', 'cups',[13.98, 14.98, 11.98, 21.98],'8 oz bag',227),
  ING('peanuts',           'Peanuts',             '🥜','Nuts',   'nuts', 'cups',[4.98, 5.49, 4.29, 7.98], '16 oz bag', 454),
  ING('cashews',           'Cashews',             '🌰','Nuts',   'nuts', 'cups',[8.98, 9.49, 7.98, 13.98],'10 oz bag', 283),
  ING('pine-nuts',         'Pine nuts',           '🌰','Nuts',   'nuts', 'cups',[14.98, 15.98, 12.98, 23.98],'6 oz bag', 170),
  ING('brazil-nuts',       'Brazil nuts',         '🌰','Nuts',   'nuts', 'cups',[9.98, 10.98, 8.98, 15.98],'10 oz bag', 283),
  ING('sesame-seeds',      'Sesame seeds',        '🌾','Seeds',  'seeds','tbsp',[3.49, 3.79, 2.98, 6.98], '3.7 oz jar',105),
  ING('poppy-seeds',       'Poppy seeds',         '⚫','Seeds',  'seeds','tbsp',[4.98, 5.49, 4.29, 8.98], '2.3 oz jar', 65),
  ING('sunflower-seeds',   'Sunflower seeds',     '🌻','Seeds',  'seeds','cups',[3.49, 3.79, 2.98, 6.98], '16 oz bag', 454),
  ING('chia-seeds',        'Chia seeds',          '⚫','Seeds',  'seeds','tbsp',[5.98, 6.49, 5.29, 9.98], '12 oz bag', 340),
  ING('flax-seeds',        'Flax seeds (ground)', '🌾','Seeds',  'seeds','tbsp',[4.98, 5.49, 4.29, 7.98], '16 oz bag', 454),
  ING('pumpkin-seeds',     'Pumpkin seeds (pepitas)','🎃','Seeds','seeds','cups',[5.98, 6.49, 5.29, 9.98],'10 oz bag', 283),

  // ── Decorating ───────────────────────────────────────────────────────────
  ING('meringue-powder',   'Meringue powder',     '☁️','Decorating','decoration','tbsp',[14.98, 15.98, 12.98, 22.98],'10 oz tub',283),
  ING('gel-food-color',    'Gel food coloring',   '🎨','Decorating','coloring',  'drops',[3.98, 4.29, 3.29, 6.98],'0.75 oz tube',21),
  ING('royal-icing-sugar', 'Royal icing sugar',   '❄️','Decorating','powderedSugar','cups',[5.98, 6.49, 5.29, 9.98],'16 oz bag', 454),
  ING('fondant-white',     'Fondant (white)',     '⚪','Decorating','decoration','oz', [8.98, 9.98, 7.98, 14.98],'24 oz tub', 680),
  ING('gum-paste',         'Gum paste',           '⚪','Decorating','decoration','oz', [9.98, 10.98, 8.98, 16.98],'24 oz tub', 680),
  ING('edible-glitter',    'Edible glitter',      '✨','Decorating','decoration','tsp',[6.98, 7.49, 5.98, 11.98],'0.25 oz jar',7),
  ING('sprinkles',         'Standard sprinkles',  '🌈','Decorating','decoration','tbsp',[3.49, 3.79, 2.98, 6.98],'7 oz jar',  198),
  ING('nonpareils',        'Nonpareils',          '🟡','Decorating','decoration','tbsp',[3.79, 3.99, 3.29, 6.98],'4 oz jar',  113),
  ING('sanding-sugar',     'Sanding sugar',       '✨','Decorating','decoration','tbsp',[4.49, 4.79, 3.79, 7.98],'5 oz jar',  142),
  ING('disco-dust',        'Disco dust',          '✨','Decorating','decoration','tsp',[8.98, 9.49, 7.98, 14.98],'0.18 oz jar',5),
  ING('gold-leaf',         'Edible gold leaf',    '🟡','Decorating','decoration','tsp',[24.98, 27.98, 22.98, 39.98],'25 sheets',1),
  ING('luster-dust',       'Luster dust',         '✨','Decorating','decoration','tsp',[7.98, 8.49, 6.98, 12.98],'4g jar',     4),
  ING('candy-melts',       'Candy melts',         '🟣','Decorating','decoration','oz', [4.98, 5.49, 4.29, 8.98], '10 oz bag', 283),
  ING('edible-pearls',     'Edible pearls',       '⚪','Decorating','decoration','tbsp',[5.98, 6.49, 5.29, 9.98],'4 oz jar',  113),
  ING('dragees',           'Silver dragees',      '⚪','Decorating','decoration','tbsp',[6.98, 7.49, 5.98, 11.98],'2.4 oz jar',68),
  ING('piping-gel',        'Piping gel',          '💧','Decorating','specialty', 'tbsp',[5.49, 5.98, 4.79, 9.98], '10 oz tub', 283),
  ING('chocolate-transfer','Chocolate transfer sheets','✨','Decorating','decoration','oz',[12.98, 14.98, 10.98, 19.98],'10 sheets',10),
  ING('isomalt',           'Isomalt',             '🍬','Decorating','sugar',     'cups',[12.98, 13.98, 10.98, 19.98],'16 oz bag',454),

  // ── Specialty ────────────────────────────────────────────────────────────
  ING('marshmallow-cream', 'Marshmallow cream',   '☁️','Specialty','specialty','cups',[2.79, 2.99, 2.29, 5.98], '13 oz tub', 369),
  ING('nutella',           'Nutella',             '🟫','Specialty','specialty','tbsp',[6.98, 7.49, 5.98, 12.98],'13 oz jar', 369),
  ING('peanut-butter',     'Peanut butter',       '🥜','Specialty','specialty','tbsp',[5.98, 6.49, 4.98, 9.98], '28 oz jar', 794),
  ING('tahini',            'Tahini',              '🌾','Specialty','specialty','tbsp',[7.98, 8.49, 6.98, 12.98],'16 oz jar', 454),
  ING('miso-paste',        'Miso paste',          '🟫','Specialty','specialty','tbsp',[6.98, 7.49, 5.98, 11.98],'17.5 oz tub',496),
  ING('matcha',            'Matcha powder',       '🍵','Specialty','spice',    'tsp', [14.98, 15.98, 12.98, 24.98],'2 oz tin',57),
  ING('fd-strawberry',     'Freeze-dried strawberry powder','🍓','Specialty','spice','tsp',[12.98, 13.98, 10.98, 19.98],'1.2 oz bag',34),
  ING('butterfly-pea',     'Butterfly pea powder','💙','Specialty','spice',    'tsp', [14.98, 15.98, 12.98, 22.98],'1 oz jar',  28),
  ING('black-sesame',      'Black sesame paste',  '⚫','Specialty','specialty','tbsp',[12.98, 13.98, 10.98, 19.98],'7 oz jar',  198),
  ING('cookie-butter',     'Cookie butter',       '🟫','Specialty','specialty','tbsp',[4.98, 5.49, 4.29, 8.98], '14 oz jar', 397),
  ING('dulce-de-leche',    'Dulce de leche',      '🟫','Specialty','specialty','tbsp',[5.49, 5.98, 4.79, 9.98], '13.4 oz can',380),
  ING('lemon-curd',        'Lemon curd',          '🍋','Specialty','specialty','tbsp',[5.98, 6.49, 5.29, 11.98],'10 oz jar', 283),
  ING('caramel-sauce',     'Caramel sauce',       '🟫','Specialty','specialty','tbsp',[4.98, 5.49, 4.29, 8.98], '16 oz jar', 454),
  ING('marzipan',          'Marzipan',            '🟡','Specialty','specialty','oz', [7.98, 8.49, 6.98, 12.98],'7 oz tube',  198),
  ING('almond-paste',      'Almond paste',        '🟡','Specialty','specialty','oz', [8.98, 9.49, 7.98, 13.98],'7 oz tube',  198),
  ING('candied-citrus',    'Candied citrus peel', '🍊','Specialty','driedFruit','cups',[8.98, 9.49, 7.98, 13.98],'8 oz tub',  227),
  ING('candied-ginger',    'Candied ginger',      '🟫','Specialty','driedFruit','cups',[7.98, 8.49, 6.98, 12.98],'8 oz tub',  227),
  ING('chestnut-puree',    'Chestnut puree',      '🌰','Specialty','specialty','cups',[12.98, 13.98, 10.98, 19.98],'15 oz tin',425),
  ING('ube-halaya',        'Ube halaya',          '🟣','Specialty','specialty','tbsp',[7.98, 8.49, 6.98, 12.98],'12 oz jar', 340),
  ING('pandan-extract',    'Pandan extract',      '🟢','Specialty','extract',  'tsp', [5.98, 6.49, 5.29, 9.98], '2 oz btl',  59),
  ING('hot-fudge',         'Hot fudge',           '🍫','Specialty','specialty','tbsp',[4.98, 5.49, 4.29, 8.98], '11.5 oz jar',326),
  ING('crystallized-rose', 'Crystallized rose petals','🌹','Specialty','decoration','tsp',[14.98, 15.98, 12.98, 19.98],'0.5 oz jar',14),

  // ── Bread & Savory ───────────────────────────────────────────────────────
  ING('olive-oil',         'Olive oil',           '🫒','Savory', 'oil',    'tbsp',[8.98, 9.98, 7.49, 16.98],  '25 oz btl', 681),
  ING('extra-virgin-oil',  'Extra virgin olive oil','🫒','Savory','oil',   'tbsp',[12.98, 13.98, 9.98, 19.98], '25 oz btl', 681),
  ING('black-olives',      'Black olives',        '⚫','Savory', 'savory','oz',  [2.49, 2.79, 1.98, 4.98],   '6 oz can',  170),
  ING('green-olives',      'Green olives',        '🟢','Savory', 'savory','oz',  [3.49, 3.79, 2.98, 5.98],   '7 oz jar',  198),
  ING('fresh-garlic',      'Fresh garlic',        '🧄','Savory', 'freshAromatic','cloves',[0.69, 0.79, 0.49, 0.59],'each bulb',45),
  ING('fresh-rosemary',    'Fresh rosemary',      '🌿','Savory', 'freshHerb','tbsp',[2.98, 3.29, 2.49, 4.98],'0.75 oz pkg',21),
  ING('fresh-thyme',       'Fresh thyme',         '🌿','Savory', 'freshHerb','tbsp',[2.98, 3.29, 2.49, 4.98],'0.75 oz pkg',21),
  ING('fresh-basil',       'Fresh basil',         '🌿','Savory', 'freshHerb','tbsp',[2.98, 3.29, 2.49, 4.98],'0.75 oz pkg',21),
  ING('fresh-mint',        'Fresh mint',          '🌿','Savory', 'freshHerb','tbsp',[2.98, 3.29, 2.49, 4.98],'0.75 oz pkg',21),
  ING('sun-dried-tomato',  'Sun-dried tomatoes',  '🍅','Savory', 'savory','oz',  [4.98, 5.49, 4.29, 7.98],   '8.5 oz jar',241),
  ING('parmesan',          'Parmesan cheese',     '🧀','Savory', 'cheese','oz',  [5.98, 6.49, 4.98, 9.98],   '5 oz wedge',142),
  ING('feta',              'Feta cheese',         '🧀','Savory', 'cheese','oz',  [4.49, 4.79, 3.79, 7.98],   '6 oz pkg',  170),
  ING('mozzarella',        'Fresh mozzarella',    '🧀','Savory', 'cheese','oz',  [4.49, 4.79, 3.79, 7.98],   '8 oz ball', 227),
  ING('goat-cheese',       'Goat cheese',         '🧀','Savory', 'cheese','oz',  [5.98, 6.49, 5.29, 9.98],   '4 oz log',  113),
  ING('cheddar',           'Cheddar cheese',      '🧀','Savory', 'cheese','oz',  [4.98, 5.49, 3.98, 8.98],   '8 oz block',227),
  ING('capers',            'Capers',              '🟢','Savory', 'savory','tbsp',[3.98, 4.29, 3.29, 6.98],  '3.5 oz jar', 99),
  ING('red-pepper-flakes', 'Red pepper flakes',   '🌶️','Savory', 'spice','tsp',  [3.49, 3.79, 2.98, 5.98], '1.5 oz jar', 43),
  ING('italian-seasoning', 'Italian seasoning',   '🌿','Savory', 'spice','tsp',  [3.98, 4.29, 3.29, 6.98], '1.62 oz jar',46),
  ING('herbes-de-provence','Herbes de Provence',  '🌿','Savory', 'spice','tsp',  [5.98, 6.49, 5.29, 9.98], '0.7 oz jar', 20),

  // ── Vinegars ─────────────────────────────────────────────────────────────
  ING('apple-cider-vinegar','Apple cider vinegar','🍎','Vinegars','vinegar','tbsp',[2.79, 2.99, 2.29, 5.98],'32 oz btl', 946),
  ING('balsamic-vinegar',  'Balsamic vinegar',    '🟫','Vinegars','vinegar','tbsp',[4.98, 5.49, 4.29, 8.98],'17 oz btl', 502),
  ING('white-vinegar',     'White vinegar',       '⚪','Vinegars','vinegar','tbsp',[2.49, 2.79, 1.98, 4.98],'32 oz btl', 946),
  ING('rice-vinegar',      'Rice vinegar',        '🍚','Vinegars','vinegar','tbsp',[3.49, 3.79, 2.98, 6.98],'12 oz btl', 354),

  // ── Oats & Grains ────────────────────────────────────────────────────────
  ING('rolled-oats',       'Rolled oats',         '🌾','Oats',   'oats', 'cups',[3.79, 3.99, 3.29, 7.98], '42 oz canister',1190),
  ING('quick-oats',        'Quick oats',          '🌾','Oats',   'oats', 'cups',[3.49, 3.79, 2.98, 6.98], '42 oz canister',1190),
  ING('steel-cut-oats',    'Steel-cut oats',      '🌾','Oats',   'oats', 'cups',[5.98, 6.49, 5.29, 9.98], '24 oz can',     680),
  ING('granola',           'Granola',             '🥣','Oats',   'oats', 'cups',[5.49, 5.98, 4.79, 9.98], '12 oz bag',     340),

  // ── Tea & Coffee ─────────────────────────────────────────────────────────
  ING('earl-grey',         'Earl Grey tea',       '🍵','Tea',    'tea','tsp',[5.98, 6.49, 5.29, 8.98], '100 bags',     200),
  ING('jasmine-tea',       'Jasmine tea',         '🍵','Tea',    'tea','tsp',[7.98, 8.49, 6.98, 11.98],'3.5 oz tin',   99),
  ING('chai-tea',          'Chai tea (loose)',    '🍵','Tea',    'tea','tsp',[6.98, 7.49, 5.98, 10.98],'4 oz bag',     113),
  ING('hibiscus',          'Hibiscus tea',        '🌺','Tea',    'tea','tsp',[6.98, 7.49, 5.98, 10.98],'4 oz bag',     113),

  // ── Misc & Cookies for crusts ────────────────────────────────────────────
  ING('graham-crackers',   'Graham crackers',     '🍪','Specialty','cookie','cups',[4.49, 4.79, 3.79, 7.98],'14.4 oz box',408),
  ING('oreos',             'Oreo cookies',        '🍪','Specialty','cookie','count',[4.49, 4.79, 3.79, 9.98],'14 oz pkg', 397),
  ING('biscoff',           'Biscoff cookies',     '🍪','Specialty','cookie','count',[4.49, 4.79, 3.79, 7.98],'8.8 oz pkg',250),
  ING('nilla-wafers',      'Vanilla wafers',      '🍪','Specialty','cookie','count',[4.49, 4.79, 3.79, 7.98],'11 oz box', 312),

  // ── Sourdough Starter (low-cost) ─────────────────────────────────────────
  ING('sourdough-starter', 'Sourdough starter',   '🫙','Sourdough','flour','grams',[0, 0, 0, 0], 'home-cultured (free)', 100)
];

function getCatalog() { return CATALOG; }
function getCatalogItem(id) { return CATALOG.find(i => i.id === id) || null; }

function packagePriceAtStore(item, store) {
  if (!item || !item.prices) return 0;
  return item.prices[store] != null ? item.prices[store] : item.prices.walmart;
}

function toGrams(unitGroup, unit, quantity) {
  const g = UNIT_GROUPS[unitGroup];
  if (!g) return 0;
  const factor = g.toGrams[unit];
  if (factor == null) return 0;
  return Number(quantity) * factor;
}

function computeIngredientCost({ item, store, override, quantity, unit }) {
  if (!item || !item.packageGrams) return 0;
  const pkgPrice = override != null ? Number(override) : packagePriceAtStore(item, store);
  if (!pkgPrice) return 0;
  const grams = toGrams(item.unitGroup, unit, quantity);
  if (!grams) return 0;
  return pkgPrice * (grams / item.packageGrams);
}

// Generic unit conversion for custom ingredients (free-text units, so no
// per-ingredient unit group). Each unit maps to a base amount within its
// dimension: weight -> grams, volume -> ml, count -> count.
const CUSTOM_UNIT_TO_BASE = {
  g:     { dim: 'weight', factor: 1 },
  oz:    { dim: 'weight', factor: 28.3495 },
  lbs:   { dim: 'weight', factor: 453.592 },
  ml:    { dim: 'volume', factor: 1 },
  tsp:   { dim: 'volume', factor: 4.92892 },
  tbsp:  { dim: 'volume', factor: 14.7868 },
  cups:  { dim: 'volume', factor: 236.588 },
  count: { dim: 'count',  factor: 1 }
};

// Cost of the amount used in one recipe, accounting for a unit mismatch between
// the package unit and the amount unit (e.g. a 48 oz bag, 444 g used).
//   costPerUse = packagePrice * (amountUsed / packageSize), with both sides
//   converted to a common base unit when they share a dimension.
// If either unit is unknown or they span different dimensions (which would need
// a density we don't store), fall back to the raw ratio so the save still works.
function customCostPerUse({ packagePrice, packageSize, packageUnit, amount, amountUnit }) {
  const price = Number(packagePrice) || 0;
  const size = Number(packageSize) || 0;
  const amt = Number(amount) || 0;
  if (price <= 0 || size <= 0 || amt <= 0) return 0;
  const pu = CUSTOM_UNIT_TO_BASE[String(packageUnit || '').trim().toLowerCase()];
  const au = CUSTOM_UNIT_TO_BASE[String(amountUnit || '').trim().toLowerCase()];
  const fractionOfPackage = (pu && au && pu.dim === au.dim)
    ? (amt * au.factor) / (size * pu.factor)
    : amt / size;
  return price * fractionOfPackage;
}

module.exports = {
  UNIT_GROUPS,
  CATALOG,
  getCatalog,
  getCatalogItem,
  packagePriceAtStore,
  toGrams,
  computeIngredientCost,
  CUSTOM_UNIT_TO_BASE,
  customCostPerUse
};
