-- ============================================
-- 微信小程序点单系统 - 数据库建表 SQL
-- 在 Supabase SQL Editor 中运行
-- ============================================

-- 1. 分类表
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) NOT NULL,           -- 分类名称，如：热菜、凉菜、饮品
  icon VARCHAR(255),                   -- 分类图标 URL
  sort_order INT DEFAULT 0,            -- 排序权重，数值越小越靠前
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 商品/菜品表
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,          -- 菜品名称
  description TEXT,                    -- 菜品描述
  price DECIMAL(10,2) NOT NULL,        -- 价格（元）
  image_url VARCHAR(500),              -- 菜品图片 URL
  available BOOLEAN DEFAULT TRUE,      -- 是否上架
  sort_order INT DEFAULT 0,            -- 排序权重
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 桌台表（通过小程序码 scene_id 识别桌号）
CREATE TABLE tables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_number VARCHAR(20) NOT NULL UNIQUE,  -- 桌号，如：A1, B2
  table_name VARCHAR(50),                     -- 桌台名称，如：大厅1号桌
  scene_id VARCHAR(50) UNIQUE,               -- 小程序码 scene 参数，用于扫码识别
  is_active BOOLEAN DEFAULT TRUE,            -- 是否启用
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 订单表
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_no VARCHAR(50) NOT NULL UNIQUE,      -- 订单号（如：20260423-001）
  table_number VARCHAR(20) NOT NULL,          -- 桌号
  status VARCHAR(20) DEFAULT 'pending'        -- 订单状态
    CHECK (status IN ('pending', 'done')),    -- pending=等待处理, done=完成
  total_amount DECIMAL(10,2) NOT NULL,        -- 订单总金额
  remark TEXT,                                -- 顾客备注
  printed BOOLEAN DEFAULT FALSE,              -- 是否已打印小票
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 订单明细表
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(100) NOT NULL,         -- 冗余存储菜品名（防止菜品被删后丢失）
  price DECIMAL(10,2) NOT NULL,               -- 下单时的单价（快照）
  quantity INT NOT NULL CHECK (quantity > 0),  -- 数量
  subtotal DECIMAL(10,2) NOT NULL             -- 小计 = price × quantity
);

-- ============================================
-- 索引（提升查询性能）
-- ============================================

-- 按分类查菜品
CREATE INDEX idx_products_category ON products(category_id);
-- 按上架状态过滤
CREATE INDEX idx_products_available ON products(available);
-- 按 scene_id 查桌台（扫码时使用）
CREATE INDEX idx_tables_scene ON tables(scene_id);
-- 按状态查订单（前台处理时使用）
CREATE INDEX idx_orders_status ON orders(status);
-- 按创建时间排序订单
CREATE INDEX idx_orders_created ON orders(created_at DESC);
-- 按订单查明细
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================
-- RLS 策略（Row Level Security）
-- 根据实际需求启用，这里先关闭以便后端 service_key 全权操作
-- ============================================

-- 如需开启 RLS，取消下方注释：
-- ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 示例数据（可选，方便测试）
-- ============================================

-- 插入分类
INSERT INTO categories (name, icon, sort_order) VALUES
  ('热菜', '🔥', 1),
  ('凉菜', '🥗', 2),
  ('主食', '🍚', 3),
  ('饮品', '🥤', 4);

-- 插入桌台
INSERT INTO tables (table_number, table_name, scene_id) VALUES
  ('A1', '大厅1号桌', '1001'),
  ('A2', '大厅2号桌', '1002'),
  ('B1', '包间1号桌', '1003'),
  ('B2', '包间2号桌', '1004');
