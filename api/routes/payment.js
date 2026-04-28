// routes/payment.js — Stripe card + WeChat Pay (both via Stripe API)
const express = require('express');
const { sql } = require('../db/client');
const router = express.Router();

let stripe;
function getStripe() {
  if (!stripe) stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

// ── POST /api/payment/create-intent ──────────────────────────
// Creates a Stripe PaymentIntent supporting card + WeChat Pay
router.post('/create-intent', async (req, res) => {
  const { order_id, payment_method } = req.body;
  // payment_method: 'card' | 'wechat_pay'

  const [order] = await sql`
    SELECT * FROM minwei.orders WHERE id = ${order_id}
  `;
  if (!order) return res.status(404).json({ error: '订单不存在' });
  if (order.payment_intent_id) {
    // Return existing intent if already created
    return res.json({ client_secret: null, payment_intent_id: order.payment_intent_id });
  }

  const amountCents = Math.round(order.total * 100);
  const methodTypes = payment_method === 'wechat_pay' 
    ? ['wechat_pay'] 
    : ['card'];

  try {
    const intent = await getStripe().paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      payment_method_types: methodTypes,
      metadata: { 
        order_id: order.id, 
        order_number: order.order_number 
      },
      ...(payment_method === 'wechat_pay' && {
        payment_method_options: {
          wechat_pay: { client: 'web' }
        }
      }),
    });

    // Save intent ID to order
    await sql`
      UPDATE minwei.orders 
      SET payment_intent_id = ${intent.id}, payment_method = ${payment_method}, updated_at = NOW()
      WHERE id = ${order_id}
    `;

    res.json({ 
      client_secret: intent.client_secret,
      payment_intent_id: intent.id,
      publishable_key: process.env.STRIPE_PUBLISHABLE_KEY
    });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: '支付初始化失败，请重试' });
  }
});

// ── POST /api/payment/webhook ─────────────────────────────────
// Stripe sends events here — mark orders paid
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = getStripe().webhooks.constructEvent(
      req.body, sig, process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const orderId = intent.metadata.order_id;
    if (orderId) {
      await sql`
        UPDATE minwei.orders
        SET status = 'pending_processing',
            paid_at = NOW(),
            updated_at = NOW()
        WHERE id = ${orderId} AND status = 'pending_payment'
      `;
      await sql`
        INSERT INTO minwei.order_logs (order_id, from_status, to_status, operator, note)
        VALUES (${orderId}, 'pending_payment', 'pending_processing', 'stripe_webhook', 
                ${`PaymentIntent: ${intent.id}`})
      `;
      console.log(`✓ Order ${orderId} marked as paid`);
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object;
    console.log(`✗ Payment failed for order ${intent.metadata.order_id}`);
  }

  res.json({ received: true });
});

module.exports = router;
