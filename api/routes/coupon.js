// routes/coupon.js
const express = require('express');
const { sql } = require('../db/client');
const router = express.Router();

// ── POST /api/coupon/validate ─────────────────────────────────
router.post('/validate', async (req, res) => {
  const { code, subtotal = 0 } = req.body;
  if (!code) return res.status(400).json({ error: '请输入优惠码' });

  const [coupon] = await sql`
    SELECT * FROM minwei.coupons
    WHERE code = ${code.toUpperCase().trim()}
      AND is_active = true
      AND (valid_until IS NULL OR valid_until > NOW())
      AND (max_uses IS NULL OR used_count < max_uses)
  `;

  if (!coupon) return res.status(400).json({ valid: false, error: '优惠码无效或已过期' });
  if (subtotal < coupon.min_order) {
    return res.status(400).json({ 
      valid: false, 
      error: `订单满 $${coupon.min_order} 才可使用此优惠码` 
    });
  }

  const discount = coupon.type === 'percent'
    ? Math.round(subtotal * coupon.value / 100 * 100) / 100
    : parseFloat(coupon.value);

  res.json({
    valid: true,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discount,
    message: coupon.type === 'percent' 
      ? `优惠码有效 — ${coupon.value}% 折扣` 
      : `优惠码有效 — 立减 $${discount.toFixed(2)}`
  });
});

module.exports = router;
