/**
 * Supabase 客户端初始化
 * 
 * 提供两个客户端：
 * - supabase：使用 anon key，受 RLS 限制（适合前端直连场景）
 * - supabaseAdmin：使用 service key，绕过 RLS（后端 API 使用）
 */

const { createClient } = require('@supabase/supabase-js');

// 从环境变量读取配置
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// 校验必要的环境变量
if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ 缺少 Supabase 环境变量，请检查 .env 配置');
  console.error('需要: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY');
}

/**
 * 普通客户端（受 RLS 策略限制）
 * 适用于：需要遵守行级安全策略的操作
 */
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 管理员客户端（绕过 RLS，拥有完全权限）
 * 适用于：后端 API 的所有数据库操作
 */
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabase, supabaseAdmin };
