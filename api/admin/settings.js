/**
 * /api/admin/settings — 店铺设置管理
 * 
 * GET    — 获取店铺设置
 * PATCH  — 更新店铺设置
 */
const { supabaseAdmin } = require('../../lib/supabase');
const { verifyAdmin } = require('../../lib/auth');

module.exports = async (req, res) => {
  const authResult = verifyAdmin(req);
  if (!authResult.valid) {
    return res.status(401).json({ success: false, data: null, message: authResult.message });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('store_settings').select('*').limit(1).single();
    if (error) return res.status(500).json({ success: false, data: null, message: '查询失败' });
    return res.json({ success: true, data, message: '获取成功' });
  }

  if (req.method === 'PATCH') {
    const allowed = ['store_name', 'logo_url', 'address', 'phone', 'business_hours', 'announcement'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin.from('store_settings').update(updates).select().single();
    if (error) return res.status(500).json({ success: false, data: null, message: '更新失败' });
    return res.json({ success: true, data, message: '保存成功' });
  }

  return res.status(405).json({ success: false, data: null, message: '不支持的方法' });
};
