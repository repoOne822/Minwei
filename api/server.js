// server.js — 闽味到家 API Server
// Port 3463 on Mac Mini M4 Pro
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000; // Replit uses process.env.PORT

// ── Security ──────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
// Always allow Replit dev previews and GitHub Pages
const alwaysAllow = ['replit.app','replit.dev','repl.co','github.io'];
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return cb(null, true);
    if (alwaysAllow.some(function(d){return origin.includes(d);})) return cb(null, true);
    if (corsOrigins.length === 0 || corsOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ── Stripe webhook needs raw body — must be before json() ─────
const paymentRouter = require('./routes/payment');
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }), 
  paymentRouter.webhookHandler || ((req, res, next) => next())
);

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  message: { error: '请求太频繁，请稍后再试' }
});
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 5,
  message: { error: '验证码请求频繁，请等待1分钟' }
});
app.use('/api/', apiLimiter);
app.use('/api/auth/send-code', authLimiter);

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart',     require('./routes/cart'));
app.use('/api/coupon',   require('./routes/coupon'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/payment',  paymentRouter);
app.use('/api/admin',    require('./routes/admin'));

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: '闽味到家 API',
    version: '1.0.0',
    port: PORT,
    stripe_pk: process.env.STRIPE_PUBLISHABLE_KEY || null,
    time: new Date().toISOString()
  });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '服务器错误，请稍后再试' });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n闽味到家 API running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Ping:   http://localhost:${PORT}/ping (use for UptimeRobot keep-alive)`);
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`SMS: ${process.env.SMS_MODE || 'mock'}`);
  console.log(`Stripe: ${process.env.STRIPE_SECRET_KEY ? '✓ configured' : '✗ not set'}\n`);
});
