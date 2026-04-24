-- ============================================
-- 微信支付功能 - 数据库迁移 SQL
-- 在 Supabase SQL Editor 中运行
-- ============================================

-- 1. orders 表新增支付相关字段
ALTER TABLE orders ADD COLUMN IF NOT EXISTS openid TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prepay_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 2. 为微信支付订单号建索引（回调时按此字段查询）
CREATE INDEX IF NOT EXISTS idx_orders_transaction_id ON orders(transaction_id);

-- 3. 为 openid 建索引（查询用户历史订单）
CREATE INDEX IF NOT EXISTS idx_orders_openid ON orders(openid);

-- 4. 更新 status 的注释说明
-- status 现在有三个值：
--   pending = 待支付
--   paid    = 已支付，等待处理
--   done    = 完成
COMMENT ON COLUMN orders.status IS 'pending=待支付, paid=已支付, done=完成';
