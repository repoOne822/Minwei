// routes/orders.js
const express = require('express');
const { sql } = require('../db/client');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();

function genOrderNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0,10).replace(/-/g,'');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `MW${date}-${rand}`;
}

function calcDeliveryDate(orderDate = new Date()) {
  const day = orderDate.getDay(); // 0=Sun
  const h   = orderDate.getHours();
  const m   = orderDate.getMinutes();
  
  // Cut-off: Sun 23:59 → Tue; Wed 23:59 → Fri
  let deliveryDay;
  if (day === 0 || day === 1) {
    deliveryDay = 2; // Tuesday
  } else if (day === 2 || day === 3) {
    if (day === 3 && (h > 23 || (h === 23 && m === 59))) {
      deliveryDay = 9; // next Tuesday
    } else {
      deliveryDay = 5; // Friday
    }
  } else {
    // Thu/Fri/Sat → next Tuesday
    deliveryDay = 2 + 7;
  }
  
  const daysToAdd = (deliveryDay - day + 7) % 7 || 7;
  const d = new Date(orderDate);
  d.setDate(orderDate.getDate() + daysToAdd);
  return d.toISOString().slice(0,10);
}

// ── POST /api/orders ──────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    session_id, user_id,
    items, coupon_code,
    delivery_type = 'delivery',
    recipient_name, recipient_phone, address, zip_code, delivery_notes,
    utm_source
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: '购物车为空' });
  }

  // Re-validate prices from DB
  const slugs = items.map(i => i.slug);
  const dbProducts = await sql`
    SELECT slug, price, stock FROM minwei.products
    WHERE slug = ANY(${slugs}) AND is_active = true
  `;
  const priceMap = Object.fromEntries(dbProducts.map(p => [p.slug, p]));

  let subtotal = 0;
  const validatedItems = [];
  for (const item of items) {
    const db = priceMap[item.slug];
    if (!db) return res.status(400).json({ error: `商品 ${item.slug} 不存在或已下架` });
    if (db.stock < item.qty) {
      return res.status(400).json({ error: `${item.name_zh || item.slug} 库存不足` });
    }
    const price = parseFloat(db.price);
    subtotal += price * item.qty;
    validatedItems.push({ ...item, price });
  }
  subtotal = Math.round(subtotal * 100) / 100;

  // Apply coupon
  let couponDiscount = 0;
  if (coupon_code) {
    const [coupon] = await sql`
      SELECT * FROM minwei.coupons
      WHERE code = ${coupon_code.toUpperCase()} AND is_active = true
        AND (valid_until IS NULL OR valid_until > NOW())
        AND (max_uses IS NULL OR used_count < max_uses)
    `;
    if (coupon && subtotal >= coupon.min_order) {
      couponDiscount = coupon.type === 'percent'
        ? Math.round(subtotal * coupon.value / 100 * 100) / 100
        : parseFloat(coupon.value);
    }
  }

  const shippingFee = delivery_type === 'pickup' ? 0 : (subtotal >= 49 ? 0 : 5.00);
  const total = Math.round((subtotal + shippingFee - couponDiscount) * 100) / 100;
  const orderNumber = genOrderNumber();
  const estimatedDelivery = calcDeliveryDate();

  // Create order
  const [order] = await sql`
    INSERT INTO minwei.orders (
      order_number, user_id, status, items,
      subtotal, shipping_fee, coupon_discount, total,
      delivery_type, estimated_delivery,
      recipient_name, recipient_phone, address, zip_code, delivery_notes,
      utm_source
    ) VALUES (
      ${orderNumber}, ${user_id || null}, 'pending_payment',
      ${JSON.stringify(validatedItems)},
      ${subtotal}, ${shippingFee}, ${couponDiscount}, ${total},
      ${delivery_type}, ${estimatedDelivery},
      ${recipient_name || null}, ${recipient_phone || null},
      ${address || null}, ${zip_code || null}, ${delivery_notes || null},
      ${utm_source || null}
    )
    RETURNING *
  `;

  // Log creation
  await sql`
    INSERT INTO minwei.order_logs (order_id, to_status, operator)
    VALUES (${order.id}, 'pending_payment', 'system')
  `;

  // Decrement stock (soft lock)
  for (const item of validatedItems) {
    await sql`
      UPDATE minwei.products
      SET stock = GREATEST(0, stock - ${item.qty}), updated_at = NOW()
      WHERE slug = ${item.slug}
    `;
  }

  // Apply coupon usage
  if (coupon_code && couponDiscount > 0) {
    await sql`
      UPDATE minwei.coupons SET used_count = used_count + 1
      WHERE code = ${coupon_code.toUpperCase()}
    `;
  }

  res.json({ order_id: order.id, order_number: order.order_number, total, estimated_delivery: estimatedDelivery });
});

// ── GET /api/orders/:id ───────────────────────────────────────
router.get('/:id', async (req, res) => {
  const [order] = await sql`
    SELECT * FROM minwei.orders WHERE id = ${req.params.id}
  `;
  if (!order) return res.status(404).json({ error: '订单不存在' });
  res.json({ order });
});

// ── GET /api/orders (admin) ───────────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  const orders = status
    ? await sql`SELECT * FROM minwei.orders WHERE status = ${status} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
    : await sql`SELECT * FROM minwei.orders ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  res.json({ orders });
});

// ── PATCH /api/orders/:id/status (admin) ─────────────────────
router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status, tracking_company, tracking_number, note } = req.body;
  const VALID = ['pending_processing','confirmed','shipped','delivered','completed','cancelled'];
  if (!VALID.includes(status)) return res.status(400).json({ error: '无效状态' });

  const [current] = await sql`SELECT status FROM minwei.orders WHERE id = ${req.params.id}`;
  if (!current) return res.status(404).json({ error: '订单不存在' });

  const [updated] = await sql`
    UPDATE minwei.orders
    SET status = ${status},
        tracking_company = COALESCE(${tracking_company || null}, tracking_company),
        tracking_number  = COALESCE(${tracking_number || null},  tracking_number),
        shipped_at = CASE WHEN ${status} = 'shipped' AND shipped_at IS NULL THEN NOW() ELSE shipped_at END,
        updated_at = NOW()
    WHERE id = ${req.params.id}
    RETURNING *
  `;

  await sql`
    INSERT INTO minwei.order_logs (order_id, from_status, to_status, operator, note)
    VALUES (${req.params.id}, ${current.status}, ${status}, 'admin', ${note || null})
  `;

  res.json({ order: updated });
});

module.exports = router;
