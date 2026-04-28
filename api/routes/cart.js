// routes/cart.js — Session-based cart (no login required)
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { sql } = require('../db/client');
const { optionalAuth } = require('../middleware/auth');
const router = express.Router();

// ── GET /api/cart/:sessionId ──────────────────────────────────
router.get('/:sessionId', async (req, res) => {
  const [cart] = await sql`
    SELECT * FROM minwei.carts WHERE session_id = ${req.params.sessionId}
  `;
  if (!cart) return res.json({ items: [], subtotal: 0, coupon_discount: 0 });
  
  const subtotal = (cart.items || []).reduce((sum, item) => 
    sum + (item.price * item.qty), 0);
  
  res.json({ 
    session_id: cart.session_id,
    items: cart.items || [],
    coupon_code: cart.coupon_code,
    coupon_discount: cart.coupon_discount || 0,
    subtotal: Math.round(subtotal * 100) / 100
  });
});

// ── POST /api/cart ────────────────────────────────────────────
// Body: { session_id?, items: [{product_id, slug, name_zh, price, qty, image_path}] }
router.post('/', optionalAuth, async (req, res) => {
  let { session_id, items } = req.body;
  if (!session_id) session_id = uuidv4();
  
  // Validate items against DB prices (prevent price tampering)
  const slugs = items.map(i => i.slug);
  const dbProducts = await sql`
    SELECT slug, price, stock FROM minwei.products
    WHERE slug = ANY(${slugs}) AND is_active = true
  `;
  const priceMap = Object.fromEntries(dbProducts.map(p => [p.slug, p]));
  
  const validatedItems = items.map(item => {
    const db = priceMap[item.slug];
    if (!db) return null;
    return { ...item, price: db.price }; // always use DB price
  }).filter(Boolean);
  
  const [cart] = await sql`
    INSERT INTO minwei.carts (session_id, user_id, items, updated_at)
    VALUES (
      ${session_id},
      ${req.user?.user_id || null},
      ${JSON.stringify(validatedItems)},
      NOW()
    )
    ON CONFLICT (session_id) DO UPDATE
    SET items = EXCLUDED.items,
        user_id = COALESCE(EXCLUDED.user_id, minwei.carts.user_id),
        updated_at = NOW()
    RETURNING *
  `;
  
  const subtotal = validatedItems.reduce((s, i) => s + i.price * i.qty, 0);
  res.json({ 
    session_id: cart.session_id, 
    items: cart.items,
    subtotal: Math.round(subtotal * 100) / 100
  });
});

module.exports = router;
