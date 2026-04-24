-- ============================================
-- 管理后台 - 数据库迁移 SQL
-- 在 Supabase SQL Editor 中运行
-- ============================================

-- 1. 店铺设置表（单行配置）
CREATE TABLE IF NOT EXISTS store_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_name TEXT DEFAULT '我的餐厅',
  logo_url TEXT DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  business_hours TEXT DEFAULT '09:00-22:00',
  announcement TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入默认配置（如果不存在）
INSERT INTO store_settings (store_name) 
SELECT '我的餐厅' 
WHERE NOT EXISTS (SELECT 1 FROM store_settings);

-- 2. 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  detail TEXT DEFAULT '',
  operator TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_created ON operation_logs(created_at DESC);
