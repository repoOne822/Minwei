// routes/admin.js — Admin authentication + dashboard stats
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { sql } = require('../db/client');
const router  = express.Router();

// ── POST /api/admin/login ─────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请输入账号和密码' });
  }

  const validUser = process.env.ADMIN_USERNAME || 'admin_fj01';
  const validHash = process.env.ADMIN_PASSWORD_HASH;

  if (username !== validUser) {
    return res.status(401).json({ error: '账号不存在' });
  }

  // If no hash set yet, allow ADMIN_PASSWORD plaintext (dev only)
  let ok = false;
  if (validHash) {
    ok = await bcrypt.compare(password, validHash);
  } else if (process.env.ADMIN_PASSWORD) {
    ok = password === process.env.ADMIN_PASSWORD;
  } else {
    return res.status(500).json({ error: '管理员密码未配置，请设置 ADMIN_PASSWORD_HASH' });
  }

  if (!ok) {
    return res.status(401).json({ error: '密码错误' });
  }

  const token = jwt.sign(
    { username, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    token,
    admin: { username, role: 'admin' },
    expires_in: '12h'
  });
});

// ── Middleware: verify admin JWT ──────────────────────────────
function adminAuth(req, res, next) {
  const header = req.headers.authorization;
  const key    = req.headers['x-admin-key'];

  // Support both JWT bearer and raw admin key
  if (key && key === process.env.ADMIN_SECRET) return next();

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '需要管理员登录' });
  }
  try {
    const decoded = jwt.verify(header.replace('Bearer ', ''), process.env.JWT_SECRET);
    if (decoded.role !== 'admin') throw new Error('Not admin');
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: '管理员 Token 已过期，请重新登录' });
  }
}

// ── GET /api/admin/stats ──────────────────────────────────────
router.get('/stats', adminAuth, async (req, res) => {
  const [orders]   = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='pending_processing') as pending, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24h') as today FROM minwei.orders`;
  const [revenue]  = await sql`SELECT COALESCE(SUM(total),0) as total_revenue, COALESCE(SUM(total) FILTER (WHERE created_at > NOW() - INTERVAL '30d'),0) as month_revenue FROM minwei.orders WHERE status NOT IN ('cancelled','pending_payment')`;
  const [lowStock] = await sql`SELECT COUNT(*) as count FROM minwei.products WHERE stock <= stock_alert AND is_active = true`;
  const [users]    = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7d') as new_this_week FROM minwei.users`;

  // Revenue trend last 7 days
  const trend = await sql`
    SELECT DATE_TRUNC('day', created_at)::date as day,
           COUNT(*) as order_count,
           COALESCE(SUM(total),0) as revenue
    FROM minwei.orders
    WHERE created_at > NOW() - INTERVAL '7d'
      AND status NOT IN ('cancelled','pending_payment')
    GROUP BY 1 ORDER BY 1
  `;

  // Top products
  const topProducts = await sql`
    SELECT p.name_zh, p.slug, SUM((item->>'qty')::int) as sold
    FROM minwei.orders o,
         jsonb_array_elements(o.items) AS item
    JOIN minwei.products p ON p.slug = item->>'slug'
    WHERE o.status NOT IN ('cancelled','pending_payment')
      AND o.created_at > NOW() - INTERVAL '30d'
    GROUP BY p.name_zh, p.slug
    ORDER BY sold DESC
    LIMIT 5
  `;

  res.json({
    orders: {
      total:   parseInt(orders.total),
      pending: parseInt(orders.pending),
      today:   parseInt(orders.today)
    },
    revenue: {
      total: parseFloat(revenue.total_revenue),
      month: parseFloat(revenue.month_revenue)
    },
    low_stock: parseInt(lowStock.count),
    users: {
      total:        parseInt(users.total),
      new_this_week: parseInt(users.new_this_week)
    },
    trend,
    top_products: topProducts
  });
});

// ── GET /api/admin/orders ─────────────────────────────────────
router.get('/orders', adminAuth, async (req, res) => {
  const { status, limit = 50, offset = 0, search } = req.query;
  let orders;

  if (search) {
    orders = await sql`
      SELECT o.*, u.phone FROM minwei.orders o
      LEFT JOIN minwei.users u ON u.id = o.user_id
      WHERE (o.order_number ILIKE ${'%'+search+'%'}
          OR o.recipient_name ILIKE ${'%'+search+'%'}
          OR o.recipient_phone ILIKE ${'%'+search+'%'})
      ORDER BY o.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
  } else if (status) {
    orders = await sql`
      SELECT o.*, u.phone FROM minwei.orders o
      LEFT JOIN minwei.users u ON u.id = o.user_id
      WHERE o.status = ${status}
      ORDER BY o.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
  } else {
    orders = await sql`
      SELECT o.*, u.phone FROM minwei.orders o
      LEFT JOIN minwei.users u ON u.id = o.user_id
      ORDER BY o.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
  }

  const [countRes] = await sql`SELECT COUNT(*) as total FROM minwei.orders ${status ? sql`WHERE status = ${status}` : sql``}`;
  res.json({ orders, total: parseInt(countRes.total) });
});

// ── GET /api/admin/orders/:id ─────────────────────────────────
router.get('/orders/:id', adminAuth, async (req, res) => {
  const [order] = await sql`
    SELECT o.*, u.phone, u.nickname
    FROM minwei.orders o
    LEFT JOIN minwei.users u ON u.id = o.user_id
    WHERE o.id = ${req.params.id}
  `;
  if (!order) return res.status(404).json({ error: '订单不存在' });

  const logs = await sql`
    SELECT * FROM minwei.order_logs
    WHERE order_id = ${req.params.id}
    ORDER BY created_at ASC
  `;

  res.json({ order, logs });
});

// ── PATCH /api/admin/orders/:id ───────────────────────────────
router.patch('/orders/:id', adminAuth, async (req, res) => {
  const { status, tracking_company, tracking_number, note } = req.body;
  const VALID = ['pending_processing','confirmed','shipped','delivered','completed','cancelled'];
  if (!VALID.includes(status)) return res.status(400).json({ error: '无效状态' });

  const [current] = await sql`SELECT status FROM minwei.orders WHERE id = ${req.params.id}`;
  if (!current) return res.status(404).json({ error: '订单不存在' });

  const [updated] = await sql`
    UPDATE minwei.orders SET
      status = ${status},
      tracking_company = COALESCE(${tracking_company||null}, tracking_company),
      tracking_number  = COALESCE(${tracking_number||null},  tracking_number),
      shipped_at = CASE WHEN ${status}='shipped' AND shipped_at IS NULL THEN NOW() ELSE shipped_at END,
      updated_at = NOW()
    WHERE id = ${req.params.id}
    RETURNING *
  `;

  await sql`
    INSERT INTO minwei.order_logs (order_id, from_status, to_status, operator, note)
    VALUES (${req.params.id}, ${current.status}, ${status},
            ${req.admin?.username || 'admin'}, ${note||null})
  `;

  res.json({ order: updated });
});

// ── GET /api/admin/products ───────────────────────────────────
router.get('/products', adminAuth, async (req, res) => {
  const products = await sql`
    SELECT * FROM minwei.products ORDER BY sort_order ASC, created_at DESC
  `;
  res.json({ products });
});

// ── POST /api/admin/products ──────────────────────────────────
router.post('/products', adminAuth, async (req, res) => {
  const { slug, name_zh, name_en, category, description, price, original_price,
          unit, image_path, stock, badge, sort_order, is_active } = req.body;

  if (!slug || !name_zh || !category || !price) {
    return res.status(400).json({ error: '缺少必填字段: slug, name_zh, category, price' });
  }

  const [product] = await sql`
    INSERT INTO minwei.products
      (slug, name_zh, name_en, category, description, price, original_price,
       unit, image_path, stock, badge, sort_order, is_active)
    VALUES
      (${slug}, ${name_zh}, ${name_en||null}, ${category}, ${description||null},
       ${price}, ${original_price||null}, ${unit||null}, ${image_path||null},
       ${stock||0}, ${badge||null}, ${sort_order||0}, ${is_active!==false})
    RETURNING *
  `;
  res.status(201).json({ product });
});

// ── PATCH /api/admin/products/:slug ──────────────────────────
router.patch('/products/:slug', adminAuth, async (req, res) => {
  const fields = req.body;
  const allowed = ['name_zh','name_en','description','price','original_price',
                   'unit','image_path','stock','badge','sort_order','is_active','category'];
  const updates = Object.fromEntries(Object.entries(fields).filter(([k])=>allowed.includes(k)));
  if (!Object.keys(updates).length) return res.status(400).json({ error: '无有效字段' });

  // Safe field-by-field update using allowed fields
  const slug = req.params.slug;
  let updated;
  // Handle common update patterns
  if ('stock' in updates) {
    [updated] = await sql`UPDATE minwei.products SET stock=${updates.stock}, updated_at=NOW() WHERE slug=${slug} RETURNING *`;
  }
  if ('is_active' in updates) {
    [updated] = await sql`UPDATE minwei.products SET is_active=${updates.is_active}, updated_at=NOW() WHERE slug=${slug} RETURNING *`;
  }
  if ('price' in updates) {
    [updated] = await sql`UPDATE minwei.products SET price=${updates.price}, updated_at=NOW() WHERE slug=${slug} RETURNING *`;
  }
  if (!updated) {
    [updated] = await sql`SELECT * FROM minwei.products WHERE slug=${slug}`;
  }
  res.json({ product: updated });
});

module.exports = router;
module.exports.adminAuth = adminAuth;
