const Api = {
  _cache: new Map(),
  onUnauthorized: () => {},

  invalidate() { this._cache.clear(); },

  async _handleRes(r, path) {
    if (r.status === 401) {
      this.invalidate();
      this.onUnauthorized();
      throw new Error('Please log in.');
    }
    if (!r.ok) {
      let msg = `${path} → ${r.status}`;
      try { const body = await r.json(); if (body?.error) msg = body.error; } catch {}
      throw new Error(msg);
    }
    return r.json();
  },

  _get(path) {
    if (this._cache.has(path)) return this._cache.get(path);
    const p = fetch(path).then(r => this._handleRes(r, path));
    this._cache.set(path, p);
    return p;
  },

  async _post(path, body) {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await this._handleRes(r, path);
    this.invalidate();
    return data;
  },

  async _patch(path, body) {
    const r = await fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await this._handleRes(r, path);
    this.invalidate();
    return data;
  },

  async _delete(path) {
    const r = await fetch(path, { method: 'DELETE' });
    const data = await this._handleRes(r, path);
    this.invalidate();
    return data;
  },

  async uploadPhoto(file) {
    const fd = new FormData();
    fd.append('photo', file);
    const r = await fetch('/api/uploads/photo', { method: 'POST', body: fd });
    return this._handleRes(r, '/api/uploads/photo');
  },

  async uploadBakerProfilePhoto(file) {
    const fd = new FormData();
    fd.append('photo', file);
    const r = await fetch('/api/baker/profile/photo', { method: 'POST', body: fd });
    return this._handleRes(r, '/api/baker/profile/photo');
  },

  getMode()    { return this._get('/api/mode'); },
  getSession() { return this._get('/api/auth/me'); },
  login(email, password) { return this._post('/api/auth/login', { email, password }); },
  forgotPassword(email)  { return this._post('/api/auth/forgot-password', { email }); },
  logout()     { return this._post('/api/auth/logout'); },

  getBaker()   { return this._get('/api/baker'); },
  updateBaker(patch) { return this._patch('/api/baker', patch); },
  resetOnboarding()  { return this._post('/api/baker/reset-onboarding'); },
  getOrders()  { return this._get('/api/orders'); },
  getOrder(id) { return this._get(`/api/orders/${id}`); },

  acceptOrder(id)    { return this._post(`/api/orders/${id}/accept`); },
  declineOrder(id)   { return this._post(`/api/orders/${id}/decline`); },
  markOrderReady(id) { return this._post(`/api/orders/${id}/ready`); },

  getMenu()                  { return this._get('/api/menu'); },
  getMenuItem(id)            { return this._get(`/api/menu/${id}`); },
  createMenuItem(fields)     { return this._post('/api/menu', fields); },
  updateMenuItem(id, fields) { return this._patch(`/api/menu/${id}`, fields); },
  deleteMenuItem(id)         { return this._delete(`/api/menu/${id}`); },

  getMessages()              { return this._get('/api/messages'); },
  getConversation(id)        { return this._get(`/api/messages/${id}`); },
  sendReply(id, text)        { return this._post(`/api/messages/${id}/reply`, { text }); },
  markConversationRead(id)   { return this._post(`/api/messages/${id}/read`); },
  getSmartReply(id)          { return this._post(`/api/messages/${id}/smart-reply`); },

  getIngredients()                  { return this._get('/api/ingredients'); },
  getIngredientOverrides()          { return this._get('/api/baker/ingredient-overrides'); },
  setIngredientOverride(catalogId, price) {
    return this._post('/api/baker/ingredient-overrides', { catalogId, price });
  },
  getCustomIngredients()            { return this._get('/api/baker/custom-ingredients'); },
  addCustomIngredient(fields)       { return this._post('/api/baker/custom-ingredients', fields); },
  getSupplies()                     { return this._get('/api/baker/supplies'); },
  upsertSupply(fields)              { return this._post('/api/baker/supplies', fields); },
  removeSupply(id)                  { return this._delete(`/api/baker/supplies/${id}`); },
  getRecipe(menuItemId)             { return this._get(`/api/menu/${menuItemId}/recipe`); },
  async saveRecipe(menuItemId, payload) {
    const r = await fetch(`/api/menu/${menuItemId}/recipe`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await this._handleRes(r, `/api/menu/${menuItemId}/recipe`);
    this.invalidate();
    return data;
  },

  getReviews()       { return this._get('/api/reviews'); },

  getAvailability()  { return this._get('/api/availability'); },
  setAccepting(value) { return this._post('/api/availability/accepting', { acceptingOrders: value }); },
  addSlot(date, slotsAvailable) { return this._post('/api/availability/slots', { date, slotsAvailable }); },
  updateSlot(id, slotsAvailable) { return this._patch(`/api/availability/slots/${id}`, { slotsAvailable }); },
  removeSlot(id)     { return this._delete(`/api/availability/slots/${id}`); },

  async getAllOrders() { return this.getOrders(); },

  async getDashboardStats() {
    const [orders, reviewsRes] = await Promise.all([
      this.getOrders(),
      this.getReviews().catch(() => ({ reviews: [] }))
    ]);
    const reviews = reviewsRes.reviews || [];
    const avg = reviews.length
      ? reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length
      : null;
    return {
      newOrders: orders.filter(o => o.status === 'new').length,
      completed: orders.filter(o => o.status === 'complete').length,
      rating: avg != null ? Number(avg.toFixed(1)) : null,
      reviewCount: reviews.length
    };
  },

  async getMonthlyEarnings() {
    const orders = await this.getOrders();
    const gross = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
    const now = new Date();
    return { period: now.toLocaleString('en-US', { month: 'long' }), gross, count: orders.length };
  },

  async getRecentOrders() {
    const orders = await this.getOrders();
    const news = orders.filter(o => o.status === 'new').slice(0, 2);
    const done = orders.filter(o => o.status === 'complete').slice(0, 1);
    return [...news, ...done].map(o => ({
      id: o.id,
      customerName: o.customerName,
      item: o.item,
      pickupDate: o.status === 'complete'
        ? 'Picked up'
        : (formatDate(o.pickupDate, 'short') || ''),
      reviewRating: o.status === 'complete' && o.reviewRating ? o.reviewRating : null,
      amount: o.amount,
      status: o.status
    }));
  }
};
