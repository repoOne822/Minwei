// frontend-api.js
// Drop this in your repo root and include in all pages that need API calls
// <script src="api.js"></script>

const API_BASE = (window.MINWEI_CONFIG && window.MINWEI_CONFIG.API_BASE) || 'https://minwei-api.replit.app';

const MinweiAPI = {
  // ── Auth ──────────────────────────────────────────────────
  async sendCode(phone, areaCode = '+1') {
    const r = await fetch(`${API_BASE}/api/auth/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, area_code: areaCode })
    });
    return r.json();
  },

  async verifyCode(phone, areaCode = '+1', code) {
    const r = await fetch(`${API_BASE}/api/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, area_code: areaCode, code })
    });
    return r.json();
  },

  // ── Products ──────────────────────────────────────────────
  async getProducts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const r = await fetch(`${API_BASE}/api/products?${qs}`);
    return r.json();
  },

  async getProduct(slug) {
    const r = await fetch(`${API_BASE}/api/products/${slug}`);
    return r.json();
  },

  // ── Cart ──────────────────────────────────────────────────
  async saveCart(items) {
    let sessionId = localStorage.getItem('mw_session');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('mw_session', sessionId);
    }
    const r = await fetch(`${API_BASE}/api/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...MinweiAPI._authHeader() },
      body: JSON.stringify({ session_id: sessionId, items })
    });
    return r.json();
  },

  async getCart() {
    const sessionId = localStorage.getItem('mw_session');
    if (!sessionId) return { items: [], subtotal: 0 };
    const r = await fetch(`${API_BASE}/api/cart/${sessionId}`);
    return r.json();
  },

  // ── Coupon ────────────────────────────────────────────────
  async validateCoupon(code, subtotal) {
    const r = await fetch(`${API_BASE}/api/coupon/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal })
    });
    return r.json();
  },

  // ── Orders ────────────────────────────────────────────────
  async createOrder(orderData) {
    const r = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...MinweiAPI._authHeader() },
      body: JSON.stringify({ 
        session_id: localStorage.getItem('mw_session'),
        ...orderData 
      })
    });
    return r.json();
  },

  // ── Payment ───────────────────────────────────────────────
  async createPaymentIntent(orderId, paymentMethod = 'card') {
    const r = await fetch(`${API_BASE}/api/payment/create-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, payment_method: paymentMethod })
    });
    return r.json();
  },

  // ── Helpers ───────────────────────────────────────────────
  _authHeader() {
    const token = localStorage.getItem('mw_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  },

  setToken(token) {
    localStorage.setItem('mw_token', token);
  },

  getUser() {
    const token = localStorage.getItem('mw_token');
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch { return null; }
  },

  logout() {
    localStorage.removeItem('mw_token');
    localStorage.removeItem('mw_session');
    sessionStorage.removeItem('mw_cart');
  }
};

MinweiAPI.BASE = API_BASE;
window.MinweiAPI = MinweiAPI;
