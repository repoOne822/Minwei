// cart-utils.js — 闽味到家 shared cart state
// Include on every page: <script src="cart-utils.js"></script>

const Cart = (() => {
  const STORAGE_KEY = 'mw_cart_items';
  const SESSION_KEY = 'mw_cart';

  function getItems() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }

  function saveItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    localStorage.setItem(SESSION_KEY, items.reduce((s, i) => s + i.qty, 0));
    sessionStorage.setItem(SESSION_KEY, items.reduce((s, i) => s + i.qty, 0));
    updateAllBadges();
  }

  function add(product) {
    // product: { slug, name_zh, price, qty=1, image_path, unit }
    const items = getItems();
    const idx = items.findIndex(i => i.slug === product.slug);
    if (idx >= 0) {
      items[idx].qty += (product.qty || 1);
    } else {
      items.push({ ...product, qty: product.qty || 1 });
    }
    saveItems(items);
    return items;
  }

  function update(slug, qty) {
    const items = getItems();
    const idx = items.findIndex(i => i.slug === slug);
    if (idx < 0) return items;
    if (qty <= 0) { items.splice(idx, 1); }
    else { items[idx].qty = qty; }
    saveItems(items);
    return items;
  }

  function remove(slug) { return update(slug, 0); }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(SESSION_KEY, '0');
    sessionStorage.setItem(SESSION_KEY, '0');
    updateAllBadges();
  }

  function count() {
    return getItems().reduce((s, i) => s + i.qty, 0);
  }

  function subtotal() {
    return Math.round(getItems().reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100;
  }

  function updateAllBadges() {
    const n = count();
    document.querySelectorAll('#cartBadge, .cart-badge').forEach(el => {
      el.textContent = n > 99 ? '99+' : n;
      el.style.display = n === 0 ? 'none' : 'flex';
    });
  }

  // Run on page load
  document.addEventListener('DOMContentLoaded', updateAllBadges);

  return { getItems, add, update, remove, clear, count, subtotal, updateAllBadges };
})();

window.Cart = Cart;
