-- ══════════════════════════════════════════════════════════════
-- 闽味到家 (Minwei Daojia) — Database Schema
-- Run once: node db/migrate.js
-- Schema: minwei (isolated from other GoForgeAI ventures)
-- ══════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS minwei;

-- ── Products ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS minwei.products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(100) UNIQUE NOT NULL,         -- e.g. "yu-wan"
  name_zh       VARCHAR(200) NOT NULL,                -- 连江鱼丸
  name_en       VARCHAR(200),                         -- Lianjiang Fish Balls
  category      VARCHAR(50) NOT NULL                  -- fresh / dry / pastry
                CHECK (category IN ('fresh','dry','pastry','combo')),
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL,
  original_price NUMERIC(10,2),                       -- for strikethrough display
  unit          VARCHAR(50),                          -- e.g. "500g", "2.5kg"
  image_path    VARCHAR(300),                         -- images/products/yu-wan.jpg
  stock         INTEGER NOT NULL DEFAULT 0,
  stock_alert   INTEGER DEFAULT 10,
  is_active     BOOLEAN DEFAULT true,
  badge         VARCHAR(50),                          -- "热销" "新品" "推荐"
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Users (phone-based, Bay Area) ─────────────────────────────
CREATE TABLE IF NOT EXISTS minwei.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         VARCHAR(20) UNIQUE NOT NULL,           -- +16501234567
  nickname      VARCHAR(100),
  area_code     VARCHAR(5) DEFAULT '+1',
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── OTP Codes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS minwei.otp_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         VARCHAR(20) NOT NULL,
  code          VARCHAR(6) NOT NULL,
  attempts      INTEGER DEFAULT 0,
  used          BOOLEAN DEFAULT false,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON minwei.otp_codes(phone);

-- ── Carts (session-based, no auth required) ───────────────────
CREATE TABLE IF NOT EXISTS minwei.carts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    VARCHAR(100) UNIQUE NOT NULL,
  user_id       UUID REFERENCES minwei.users(id) ON DELETE SET NULL,
  items         JSONB NOT NULL DEFAULT '[]',
  -- items: [{product_id, slug, name_zh, price, qty, image_path}]
  coupon_code   VARCHAR(50),
  coupon_discount NUMERIC(10,2) DEFAULT 0,
  expires_at    TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Coupons ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS minwei.coupons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(50) UNIQUE NOT NULL,
  type          VARCHAR(20) DEFAULT 'fixed'              -- fixed / percent
                CHECK (type IN ('fixed','percent')),
  value         NUMERIC(10,2) NOT NULL,                  -- $10 off or 10% off
  min_order     NUMERIC(10,2) DEFAULT 0,                 -- minimum order amount
  max_uses      INTEGER,
  used_count    INTEGER DEFAULT 0,
  valid_from    TIMESTAMPTZ DEFAULT NOW(),
  valid_until   TIMESTAMPTZ,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Orders ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS minwei.orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    VARCHAR(30) UNIQUE NOT NULL,          -- MW20260407-0001
  user_id         UUID REFERENCES minwei.users(id),
  status          VARCHAR(30) DEFAULT 'pending_payment'
                  CHECK (status IN (
                    'pending_payment','pending_processing',
                    'confirmed','shipped','delivered',
                    'completed','cancelled','refunded'
                  )),
  -- Items snapshot (denormalized for order history stability)
  items           JSONB NOT NULL,
  -- Pricing
  subtotal        NUMERIC(10,2) NOT NULL,
  shipping_fee    NUMERIC(10,2) DEFAULT 5.00,
  coupon_discount NUMERIC(10,2) DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL,
  -- Delivery
  delivery_type   VARCHAR(20) DEFAULT 'delivery'
                  CHECK (delivery_type IN ('delivery','pickup')),
  estimated_delivery DATE,
  -- Recipient info
  recipient_name  VARCHAR(100),
  recipient_phone VARCHAR(20),
  address         TEXT,
  zip_code        VARCHAR(10),
  delivery_notes  TEXT,
  -- Payment
  payment_method  VARCHAR(30),                           -- stripe_card / wechat_pay
  payment_intent_id VARCHAR(200),                        -- Stripe PaymentIntent ID
  paid_at         TIMESTAMPTZ,
  -- Shipping
  tracking_company VARCHAR(100),
  tracking_number  VARCHAR(100),
  shipped_at      TIMESTAMPTZ,
  -- Metadata
  utm_source      VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user    ON minwei.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON minwei.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number  ON minwei.orders(order_number);

-- ── Order Status Log ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS minwei.order_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES minwei.orders(id),
  from_status   VARCHAR(30),
  to_status     VARCHAR(30) NOT NULL,
  note          TEXT,
  operator      VARCHAR(100) DEFAULT 'system',          -- admin_fj01 / system / user
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Seed: Products ────────────────────────────────────────────
INSERT INTO minwei.products (slug, name_zh, name_en, category, description, price, original_price, unit, image_path, stock, badge, sort_order)
VALUES
  ('yu-wan',          '连江鱼丸',         'Lianjiang Fish Balls',    'fresh',  '福建连江正宗鱼丸，皮薄弹牙，冷冻直送', 18.99, 22.00, '5lb/80oz', 'images/products/yu-wan.jpg',        50, '热销', 1),
  ('man-yu-wan',      '鳗鱼丸',           'Eel Fish Balls',          'fresh',  '鲜鳗鱼浆手工制作，Q弹爆汁，闽味正宗', 14.99, NULL,  NULL,       'images/products/man-yu-wan.jpg',    40, NULL,  2),
  ('yu-pi-jiao',      '鱼皮饺',           'Fish Skin Dumplings',     'fresh',  '薄如蝉翼鱼皮裹鲜肉馅，汤底绝配',       12.00, NULL,  NULL,       'images/products/yu-pi-jiao.jpg',    35, NULL,  3),
  ('xiao-long-bao',   '手工小笼包',       'Handmade Soup Dumplings', 'fresh',  '皮薄汁多，现包速冻，蒸出来鲜味十足',   23.00, NULL,  NULL,       'images/products/xiao-long-bao.jpg', 30, '推荐', 4),
  ('man-yu-gu',       '鳗鱼骨',           'Eel Bones',               'fresh',  '炸制酥脆，也可熬出鲜甜浓汤底',         12.00, NULL,  NULL,       'images/products/man-yu-gu.jpg',     25, NULL,  5),
  ('cheng-rou',       '連江老蟶肉',       'Lianjiang Razor Clam',    'fresh',  '连江老蟶，鲜甜入味，汤粥两宜',          12.00, NULL,  NULL,       'images/products/cheng-rou.jpg',     20, NULL,  6),
  ('xin-wei-mifen',   '新味米粉',         'Fuzhou Rice Noodles',     'fresh',  '细滑爽口，炒汤皆宜，家常必备',          16.00, NULL,  NULL,       'images/products/xin-wei-mifen.jpg', 45, NULL,  7),
  ('shou-la-xian-mian','福州手拉线面',    'Fuzhou Hand-pulled Noodles','dry',  '手工拉制，细如发丝，久煮不断',          22.00, NULL,  '2.5kg',    'images/products/shou-la-xian-mian.jpg',40, NULL, 8),
  ('min-fen-yan',     '闽粉燕干面',       'Min Dry Noodles',         'dry',    '水磨日晒，手工原态，口感细腻顺滑',      6.50,  NULL,  '750g',     'images/products/min-fen-yan.jpg',   60, NULL,  9),
  ('chang-le-fensi',  '长乐粉丝',         'Changle Glass Noodles',   'dry',    '透明顺滑，吸汤入味，炒拌皆宜',          7.00,  NULL,  NULL,       'images/products/chang-le-fensi.jpg',55, NULL, 10),
  ('yang-du-jun',     '羊肚菌',           'Morel Mushrooms',         'dry',    '形如羊肚，菌香浓郁，炖汤滋补佳品',      45.00, NULL,  NULL,       'images/products/yang-du-jun.jpg',   15, NULL, 11),
  ('hei-song-lu',     '黑松露',           'Black Truffle',           'dry',    '浓郁土壤香气，搭配意面炒蛋均绝',        38.00, NULL,  NULL,       'images/products/hei-song-lu.jpg',   10, NULL, 12),
  ('zhui-rong',       '椎茸（干香菇）',   'Shiitake Mushrooms',      'dry',    '厚实饱满，泡发后香味四溢，炖汤必备',    18.00, NULL,  NULL,       'images/products/zhui-rong.jpg',     30, NULL, 13),
  ('gan-xiang-gu',    '干香菇',           'Dried Shiitake',          'dry',    '自然晒制，香气醇厚，用途广泛',           12.00, NULL,  NULL,       'images/products/gan-xiang-gu.jpg',  35, NULL, 14),
  ('yun-er',          '云耳（干木耳）',   'Cloud Ear Fungus',        'dry',    '朵形完整，脆嫩爽口，凉拌炒菜均佳',      9.50,  NULL,  NULL,       'images/products/yun-er.jpg',        40, NULL, 15),
  ('chong-cao-hua',   '干虫草花',         'Dried Cordyceps Flowers', 'dry',    '花开金黄，炖汤滋补，营养丰富',           16.00, NULL,  NULL,       'images/products/chong-cao-hua.jpg', 20, NULL, 16),
  ('gan-hai-shen',    '干海参',           'Dried Sea Cucumber',      'dry',    '泡发丰满，胶质丰富，滋补珍品',           68.00, NULL,  NULL,       'images/products/gan-hai-shen.jpg',  8,  NULL, 17),
  ('sun-gan',         '笋干',             'Dried Bamboo Shoots',     'dry',    '鲜笋自然风干，脆嫩入味，红烧首选',       11.00, NULL,  NULL,       'images/products/sun-gan.jpg',       30, NULL, 18),
  ('gong-cai',        '贡菜',             'Tribute Vegetables',      'dry',    '鲜嫩爽脆，凉拌或炒食，清爽可口',         8.00,  NULL,  NULL,       'images/products/gong-cai.jpg',      25, NULL, 19),
  ('fu-zhu',          '腐竹',             'Bean Curd Sticks',        'dry',    '豆香浓郁，韧嫩可口，红烧凉拌皆宜',       7.50,  NULL,  NULL,       'images/products/fu-zhu.jpg',        30, NULL, 20),
  ('tao-jiao',        '桃胶',             'Peach Resin',             'dry',    '天然桃树分泌物，养颜润肤，甜汤必备',     14.00, NULL,  NULL,       'images/products/tao-jiao.jpg',      20, NULL, 21),
  ('qi-lin-guo',      '麒麟果（燕窝果）', 'Pitaya (Dragon Fruit)',   'dry',    '外皮独特，果肉香甜，营养价值极高',       19.00, NULL,  NULL,       'images/products/qi-lin-guo.jpg',    15, NULL, 22),
  ('yu-ni-gao',       '芋泥糕',           'Taro Cake',               'pastry', '槟榔芋制作，细腻香甜，闽南家乡味',       6.00,  NULL,  NULL,       'images/products/yu-ni-gao.jpg',     25, NULL, 23),
  ('yu-ni-babao',     '芋泥黑米八宝饭',   'Taro Eight-treasure Rice','pastry', '芋泥搭配黑米八宝，软糯香甜，节日必备',  9.00,  NULL,  NULL,       'images/products/yu-ni-babao.jpg',   20, NULL, 24),
  ('wu-mei-gan',      '宝莎乌梅干',       'Preserved Plum',          'pastry', '酸甜适口，生津解渴，零食佳品',           8.50,  NULL,  NULL,       'images/products/wu-mei-gan.jpg',    35, NULL, 25),
  ('gan-gan-lan',     '干橄榄',           'Dried Olive',             'pastry', '回甘绵长，嚼劲十足，越嚼越香',           7.00,  NULL,  NULL,       'images/products/gan-gan-lan.jpg',   30, NULL, 26),
  ('cui-mi-jinju',    '脆蜜金桔',         'Candied Kumquat',         'pastry', '金桔蜜渍，香甜酥脆，老少皆宜',           9.00,  NULL,  NULL,       'images/products/cui-mi-jinju.jpg',  25, NULL, 27)
ON CONFLICT (slug) DO NOTHING;

-- ── Seed: Coupons ─────────────────────────────────────────────
INSERT INTO minwei.coupons (code, type, value, min_order, max_uses)
VALUES
  ('NEWUSER',   'fixed',   10.00, 0,    1000),
  ('SPRING10',  'fixed',   10.00, 30,   500),
  ('SUMMER15',  'percent', 15.00, 50,   200),
  ('WELCOME',   'fixed',   5.00,  0,    9999)
ON CONFLICT (code) DO NOTHING;
