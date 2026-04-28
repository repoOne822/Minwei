// routes/auth.js — Phone OTP authentication
const express = require('express');
const jwt = require('jsonwebtoken');
const { sql } = require('../db/client');
const router = express.Router();

// Rate limiting state (in-memory, per process)
const sendLimits = new Map(); // phone -> last sent timestamp

// ── POST /api/auth/send-code ──────────────────────────────────
router.post('/send-code', async (req, res) => {
  const { phone, area_code = '+1' } = req.body;
  if (!phone) return res.status(400).json({ error: '请输入手机号' });

  const fullPhone = `${area_code}${phone.replace(/\D/g, '')}`;

  // 60s rate limit
  const lastSent = sendLimits.get(fullPhone);
  if (lastSent && Date.now() - lastSent < 60000) {
    const wait = Math.ceil((60000 - (Date.now() - lastSent)) / 1000);
    return res.status(429).json({ error: `请等待 ${wait} 秒后重试` });
  }

  // Generate 6-digit OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Store in DB (expire old ones first)
  await sql`
    UPDATE minwei.otp_codes SET used = true
    WHERE phone = ${fullPhone} AND used = false
  `;
  await sql`
    INSERT INTO minwei.otp_codes (phone, code, expires_at)
    VALUES (${fullPhone}, ${code}, ${expiresAt})
  `;

  sendLimits.set(fullPhone, Date.now());

  // Send SMS
  if (process.env.SMS_MODE === 'mock' || !process.env.TWILIO_ACCOUNT_SID) {
    // MOCK: log to console
    console.log(`\n📱 OTP for ${fullPhone}: ${code}\n`);
  } else {
    // REAL: Twilio
    try {
      const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await twilio.messages.create({
        body: `您的闽味到家验证码：${code}，10分钟内有效。`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: fullPhone,
      });
    } catch (err) {
      console.error('Twilio error:', err.message);
      return res.status(500).json({ error: '验证码发送失败，请重试' });
    }
  }

  res.json({ 
    success: true, 
    message: '验证码已发送',
    // Only expose code in development
    ...(process.env.NODE_ENV === 'development' && { _dev_code: code })
  });
});

// ── POST /api/auth/verify-code ────────────────────────────────
router.post('/verify-code', async (req, res) => {
  const { phone, area_code = '+1', code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: '参数缺失' });

  const fullPhone = `${area_code}${phone.replace(/\D/g, '')}`;

  // Find latest unused OTP
  const [otp] = await sql`
    SELECT * FROM minwei.otp_codes
    WHERE phone = ${fullPhone}
      AND used = false
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (!otp) {
    return res.status(400).json({ error: '验证码已过期，请重新获取' });
  }

  // Check attempts
  if (otp.attempts >= 5) {
    return res.status(400).json({ error: '验证失败次数过多，请重新获取验证码' });
  }

  if (otp.code !== code) {
    await sql`
      UPDATE minwei.otp_codes SET attempts = attempts + 1
      WHERE id = ${otp.id}
    `;
    return res.status(400).json({ error: `验证码错误，还可尝试 ${4 - otp.attempts} 次` });
  }

  // Mark used
  await sql`UPDATE minwei.otp_codes SET used = true WHERE id = ${otp.id}`;

  // Upsert user
  let [user] = await sql`SELECT * FROM minwei.users WHERE phone = ${fullPhone}`;
  if (!user) {
    const nickname = `用户${fullPhone.slice(-4)}`;
    [user] = await sql`
      INSERT INTO minwei.users (phone, area_code, nickname, last_login_at)
      VALUES (${fullPhone}, ${area_code}, ${nickname}, NOW())
      RETURNING *
    `;
  } else {
    await sql`UPDATE minwei.users SET last_login_at = NOW() WHERE id = ${user.id}`;
  }

  // Issue JWT
  const token = jwt.sign(
    { user_id: user.id, phone: user.phone, nickname: user.nickname },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({ 
    success: true, 
    token,
    user: { id: user.id, phone: user.phone, nickname: user.nickname }
  });
});

module.exports = router;
