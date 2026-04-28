// routes/products.js
const express = require('express');
const { sql } = require('../db/client');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

// ── GET /api/products ─────────────────────────────────────────
router.get('/', async (req, res) => {
  const { category, search, limit = 50 } = req.query;
  
  let products;
  if (category && search) {
    products = await sql`
      SELECT * FROM minwei.products
      WHERE is_active = true
        AND category = ${category}
        AND (name_zh ILIKE ${'%'+search+'%'} OR name_en ILIKE ${'%'+search+'%'})
      ORDER BY sort_order ASC, created_at DESC
      LIMIT ${parseInt(limit)}
    `;
  } else if (category) {
    products = await sql`
      SELECT * FROM minwei.products
      WHERE is_active = true AND category = ${category}
      ORDER BY sort_order ASC
      LIMIT ${parseInt(limit)}
    `;
  } else if (search) {
    products = await sql`
      SELECT * FROM minwei.products
      WHERE is_active = true
        AND (name_zh ILIKE ${'%'+search+'%'} OR name_en ILIKE ${'%'+search+'%'})
      ORDER BY sort_order ASC
      LIMIT ${parseInt(limit)}
    `;
  } else {
    products = await sql`
      SELECT * FROM minwei.products
      WHERE is_active = true
      ORDER BY sort_order ASC
      LIMIT ${parseInt(limit)}
    `;
  }
  
  res.json({ products });
});

// ── GET /api/products/:slug ───────────────────────────────────
router.get('/:slug', async (req, res) => {
  const [product] = await sql`
    SELECT * FROM minwei.products
    WHERE slug = ${req.params.slug} AND is_active = true
  `;
  if (!product) return res.status(404).json({ error: '商品不存在' });
  res.json({ product });
});

// ── PATCH /api/products/:slug/stock (admin) ───────────────────
router.patch('/:slug/stock', requireAdmin, async (req, res) => {
  const { stock, delta } = req.body;
  let updated;
  if (delta !== undefined) {
    [updated] = await sql`
      UPDATE minwei.products
      SET stock = GREATEST(0, stock + ${delta}), updated_at = NOW()
      WHERE slug = ${req.params.slug}
      RETURNING *
    `;
  } else if (stock !== undefined) {
    [updated] = await sql`
      UPDATE minwei.products
      SET stock = ${stock}, updated_at = NOW()
      WHERE slug = ${req.params.slug}
      RETURNING *
    `;
  }
  res.json({ product: updated });
});

module.exports = router;
