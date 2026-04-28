// admin/admin-auth.js — shared admin auth utility
// Include on every admin page FIRST: <script src="admin-auth.js"></script>

const AdminAuth = (() => {
  const TOKEN_KEY = 'mw_admin_token';
  const USER_KEY  = 'mw_admin_user';

  const BASE = (window.MINWEI_CONFIG && window.MINWEI_CONFIG.API_BASE)
    || 'https://minwei-api.replit.app';

  function getToken() { return sessionStorage.getItem(TOKEN_KEY); }
  function getUser()  {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  }

  function headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (getToken() || '')
    };
  }

  // Redirect to login if not authenticated (call on every protected page)
  function requireAuth() {
    const token = getToken();
    if (!token) {
      window.location.href = 'admin-login.html';
      return false;
    }
    // Check expiry (JWT exp claim)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        logout();
        return false;
      }
    } catch {}
    return true;
  }

  function login(token, user) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    window.location.href = 'admin-login.html';
  }

  // Authenticated fetch wrapper
  async function apiFetch(path, options = {}) {
    const url = BASE + (path.startsWith('/') ? path : '/' + path);
    const res = await fetch(url, {
      ...options,
      headers: { ...headers(), ...(options.headers || {}) }
    });
    if (res.status === 401) { logout(); return null; }
    return res.json();
  }

  // Populate sidebar admin name on every page
  function renderSidebarUser() {
    const user = getUser();
    if (!user) return;
    document.querySelectorAll('.admin-username').forEach(el => {
      el.textContent = '管理员: ' + (user.username || 'admin');
    });
  }

  return { requireAuth, login, logout, getToken, getUser, headers, apiFetch, renderSidebarUser, BASE };
})();

window.AdminAuth = AdminAuth;
