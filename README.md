# 闽味到家 · Minwei Daojia

**Bay Area Fujian Specialty Food E-Commerce Platform**  
湾区福建特产冷链电商平台 — 静态原型 / Static Prototype

---

## 项目结构 / Project Structure

```
minwei-daojia/
├── index.html              # 首页 Homepage
├── products.html           # 商品列表 Product Listing
├── product-detail.html     # 商品详情 Product Detail
├── cart.html               # 购物车 Shopping Cart
├── checkout.html           # 结账 Checkout
├── success.html            # 支付成功 Order Success
└── admin/
    ├── index.html          # 管理台入口 (redirects to login)
    ├── admin-login.html    # 管理员登录 Admin Login
    ├── dashboard.html      # 控制台概览 Dashboard
    ├── admin-orders.html   # 订单管理 Order Management
    ├── admin-order-detail.html  # 订单详情 Order Detail
    ├── warehouse-management.html # 商品仓库 Warehouse
    └── add-product.html    # 添加商品 Add Product
```

---

## 快速开始 / Quick Start

No build step. Open any HTML file directly in a browser, or serve with any static host.

```bash
# Local dev (Python)
python3 -m http.server 8080
# Then open: http://localhost:8080

# Admin panel
# http://localhost:8080/admin/
# Login: admin_fj01 / any password
```

### GitHub Pages
1. Push this repo to GitHub
2. Settings → Pages → Source: `main` branch, `/ (root)`
3. Frontend: `https://<user>.github.io/<repo>/`
4. Admin: `https://<user>.github.io/<repo>/admin/`

---

## 技术栈 / Tech Stack

| Layer | Technology |
|---|---|
| Styling | Tailwind CSS (CDN Play) |
| Icons | Iconify — Solar + Fluent Emoji sets |
| Charts | Chart.js (dashboard only) |
| State | `sessionStorage` (cart count) |
| Payments | Stripe UI mockup (no live keys) |
| Images | Hosted on modao.cc CDN (prototype) |

---

## 页面功能 / Page Features

### 前台 Frontend
| Page | Working JS Features |
|---|---|
| `index.html` | Add-to-cart with badge sync, toast notifications |
| `products.html` | Category filter tabs, live search, add-to-cart |
| `product-detail.html` | Thumbnail gallery, qty selector, tab switching |
| `cart.html` | Live total recalc, item removal, coupon `NEWUSER` |
| `checkout.html` | OTP 60s countdown, card formatting, form submit |
| `success.html` | Delivery date calc, 5s countdown redirect |

### 后台 Admin
| Page | Working JS Features |
|---|---|
| `admin-login.html` | Credential validation, loading state |
| `dashboard.html` | Live clock, animated stats, clickable cards |
| `admin-orders.html` | Status filter tabs, live search, quick-confirm |
| `admin-order-detail.html` | Inline status updates, log append, toast |
| `warehouse-management.html` | Restock handlers, toggle switches |
| `add-product.html` | Image upload preview, form validation |

---

## 配送规则 / Delivery Logic

Orders cut off **Sunday 23:59** → delivered **Tuesday**  
Orders cut off **Wednesday 23:59** → delivered **Friday**  
Service area: Bay Area ZIP codes 94000–94999

---

## 开发说明 / Dev Notes

- All images are prototype images hosted externally. Replace `src` URLs with your own CDN for production.
- Coupon codes in prototype: `NEWUSER` or `SPRING10` (both give $10 off)
- Admin login accepts any non-empty password in prototype mode
- No backend / API — all state is client-side only

---

*Built for GoForgeAI client · 2026*
