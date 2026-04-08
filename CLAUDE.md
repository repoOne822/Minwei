# 闽味到家 (Minwei Daojia) — Project Context for Claude Code

## Project Overview
Bay Area Fujian specialty food e-commerce platform. Cold-chain delivery to Bay Area ZIP codes 94000–94999. Built for a GoForgeAI client. Pure static HTML/CSS/JS — no build step, no framework.

**Repo:** https://github.com/repoOne822/Minwei  
**Live URL:** https://repoOne822.github.io/Minwei/  
**Admin:** https://repoOne822.github.io/Minwei/admin/  
**Brand:** 闽味到家 · Minwei Daojia · "Bay Area Fuzhou Flavor"

---

## Tech Stack
| Layer | Choice |
|---|---|
| CSS | Tailwind CSS via CDN (`https://cdn.tailwindcss.com`) |
| Icons | Iconify (`https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js`) |
| Charts | Chart.js via CDN (dashboard only) |
| State | `sessionStorage` for cart count (`mw_cart` key) |
| Fonts | System fonts; admin uses PingFang SC / Microsoft YaHei stack |
| Images | Hosted on `modao.cc/agent-py/media/` (prototype CDN — replace for production) |
| Backend | None — fully static prototype |

**Critical:** Never revert CDN links back to `modao.cc/agent-py/static/`. Always use the CDNs above.

---

## File Structure
```
Minwei/
├── index.html              # Homepage — hero, hot products, combo section
├── products.html           # Product listing — filter tabs + live search
├── product-detail.html     # Single product — gallery, qty, tabs, add-to-cart
├── cart.html               # Cart — live totals, coupon, shipping toggle
├── checkout.html           # Checkout — OTP flow, card formatting, submit
├── success.html            # Order success — delivery date calc, countdown
├── admin/
│   ├── index.html          # Redirect → admin-login.html
│   ├── admin-login.html    # Login — validation, loading state
│   ├── dashboard.html      # Dashboard — Chart.js trend, animated stats, live clock
│   ├── admin-orders.html   # Orders — filter tabs, live search, quick-confirm
│   ├── admin-order-detail.html  # Order detail — inline status update, log append
│   ├── warehouse-management.html # Warehouse — restock handlers, toggle switches
│   └── add-product.html    # Add product — image preview, form validation
├── brand-kit/
│   └── minwei-daojia-brand-kit.pdf  # 5-page brand identity PDF
├── .github/workflows/      # GitHub Pages deploy workflow (needs workflow scope PAT)
├── CLAUDE.md               # This file
├── README.md               # Project docs
└── .gitignore
```

---

## Brand Identity

### Colors
| Name | Hex | Usage |
|---|---|---|
| 福建红 Fujian Red | `#B72126` | Primary — buttons, logo, nav active, prices |
| 深墨 Deep Ink | `#1E293B` | Body text, footer, dark backgrounds |
| 米香白 Cream | `#FFFBF0` | Page background |
| 暖橙 Warm Orange | `#F97316` | Badges, promotions, highlights |
| 烟灰 Slate | `#475569` | Secondary text, icons |

### Logo
- Circle emblem with `闽` character in Noto Serif CJK SC Bold
- Wordmark: `闽味到家` + `MINWEI DAOJIA` beneath
- Tagline: `湾区正宗福建特产 · 冷链直达` / `跨越重洋的家乡烟火气`

### Typography
- **Display/Headlines:** Noto Serif CJK SC Bold
- **Body/UI:** Noto Sans CJK SC Regular / Light
- **Latin/Prices:** Liberation Sans Bold / Regular

---

## Frontend — Key JS Behaviors

### Cart (`sessionStorage` key: `mw_cart`)
- Cart count persists across pages via `sessionStorage.getItem('mw_cart')`
- Badge hidden when count = 0, shows as flex when > 0
- `success.html` clears cart: `sessionStorage.setItem('mw_cart', '0')`

### Coupon Codes
Valid codes: `NEWUSER` or `SPRING10` → both give $10 off  
Applied in `cart.html` and `checkout.html`

### Delivery Date Logic (`success.html`)
- Orders by **Sunday 23:59** → delivered **Tuesday**
- Orders by **Wednesday 23:59** → delivered **Friday**
- Otherwise → next available Tuesday or Friday
- Display format: `预计周X (M月D日) 14:00 - 18:00`

### OTP Flow (`checkout.html`)
- 60-second countdown after "获取验证码" click
- Accepts any input (prototype — no real SMS)
- Card number auto-formats to groups of 4
- On submit: 1.8s loading state → redirect to `success.html`

---

## Admin Panel — Key JS Behaviors

### Login (`admin-login.html`)
- Demo credentials: `admin_fj01` / any password
- 900ms loading state then redirects to `dashboard.html`

### Order Status Flow (`admin-order-detail.html`)
States: `待处理` → `已确认` → `已发货` → `已完成`  
- `updateStatus('shipped')` → updates badge, appends timestamped log entry, shows blue toast
- `updateStatus('done')` → green toast, disables both buttons
- `updateStatus('pickup')` → purple toast for self-pickup orders

### Orders Filter (`admin-orders.html`)
- Filter tabs use `.filter-tab` class + `data-status` attribute
- Values: `all` / `pending` / `shipped` / `done`
- Live search via `#orderSearch` input — searches all row text content
- Quick-confirm button auto-added to all `待处理` rows on page load

### Dashboard (`dashboard.html`)
- Chart.js line chart on `#orderTrendChart` canvas
- Stat cards (`.stat-card`) are clickable → navigate to `admin-orders.html`
- Numbers animate from 0 on load
- Live clock updates every 10s in sidebar

### Warehouse (`warehouse-management.html`)
- `quickRestock(pid, amount)` — increments `.stock-count` DOM element
- `.stock-toggle` switches toggle on/off badge visibility
- All `alert()` replaced with `showWToast()` toast notifications

---

## Delivery & Business Rules
- Service area: Bay Area ZIP 94000–94999
- Free shipping threshold: $49
- Delivery fee: $5 (waived at threshold)
- Cold-chain pickup option: San Jose store
- Admin login: `admin_fj01` (demo, any password)

---

## GoForgeAI Context
- Built by GoForgeAI as a client deliverable
- Client: Bay Area Fujian food business
- Design direction: warm orange/red palette, Chinese-American audience
- All pages are bilingual EN/ZH throughout
- Admin system brand name: **闽韵优选** (separate from the storefront)

---

## What's NOT Yet Built (backlog)
- Product detail page for combo/套餐 (currently reuses `product-detail.html`)
- Revenue analytics page (`admin/revenue.html`)
- Member management page (`admin/members.html`)
- Real payment integration (Stripe)
- Real SMS OTP (Twilio)
- Backend API (currently all static)
- Replace `modao.cc` product images with real CDN

---

## Common Tasks

**Add a new product to products.html:**
Copy an existing `.product-card` div, update `data-cat` attribute to one of: `fresh` / `dry` / `combo` / `pastry`, update image src, name, price, and `onclick` name parameter.

**Change brand color:**
Find-replace `#B72126` — it appears in Tailwind classes as `[#B72126]` and in JS/CSS as `#B72126` or `#b91c1c` (admin uses `#b91c1c`).

**Add a new admin page:**
Copy the sidebar nav from any existing admin page. The `.sidebar-active` class applies: `background: #b91c1c; color: white; box-shadow: 0 4px 12px rgba(185,28,28,0.2)`.

**Push changes:**
```bash
git add -A
git commit -m "your message"
git push origin main
```
