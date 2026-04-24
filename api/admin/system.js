/**
 * /api/admin/system — 合并：仪表盘 + 店铺设置
 * 
 * GET  ?action=dashboard  — 仪表盘统计
 * GET  ?action=settings   — 获取店铺设置
 * PATCH                   — 更新店铺设置
 */
const { supabaseAdmin } = require('../../lib/supabase');
const { verifyAdmin } = require('../../lib/auth');

module.exports = async (req, res) => {
  const authResult = verifyAdmin(req);
  if (!authResult.valid) {
    return res.status(401).json({ success: false, data: null, message: authResult.message });
  }

  const action = req.query.action || 'dashboard';

  // ===== 仪表盘统计 =====
  if (req.method === 'GET' && action === 'dashboard') {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: todayOrders } = await supabaseAdmin
        .from('orders').select('id, total_amount, status').gte('created_at', todayStart);

      const todayCount = (todayOrders || []).length;
      const todayRevenue = (todayOrders || [])
        .filter(o => o.status === 'paid' || o.status === 'done')
        .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
      const todayPending = (todayOrders || []).filter(o => o.status === 'pending' || o.status === 'paid').length;
      const todayDone = (todayOrders || []).filter(o => o.status === 'done').length;

      const { data: weekOrders } = await supabaseAdmin
        .from('orders').select('created_at, total_amount, status')
        .gte('created_at', sevenDaysAgo).order('created_at', { ascending: true });

      const dailyMap = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = `${d.getMonth() + 1}/${d.getDate()}`;
        dailyMap[key] = { date: key, orders: 0, revenue: 0 };
      }
      (weekOrders || []).forEach(o => {
        const d = new Date(o.created_at);
        const key = `${d.getMonth() + 1}/${d.getDate()}`;
        if (dailyMap[key]) {
          dailyMap[key].orders += 1;
          if (o.status === 'paid' || o.status === 'done') dailyMap[key].revenue += parseFloat(o.total_amount || 0);
        }
      });

      const { count: productCount } = await supabaseAdmin.from('products').select('id', { count: 'exact', head: true });
      const { count: tableCount } = await supabaseAdmin.from('tables').select('id', { count: 'exact', head: true });

      return res.json({
        success: true,
        data: {
          today: { orderCount: todayCount, revenue: todayRevenue.toFixed(2), pendingCount: todayPending, doneCount: todayDone },
          weekTrend: Object.values(dailyMap),
          productCount: productCount || 0,
          tableCount: tableCount || 0
        }
      });
    } catch (e) {
      return res.status(500).json({ success: false, data: null, message: '查询失败' });
    }
  }

  // ===== 获取店铺设置 =====
  if (req.method === 'GET' && action === 'settings') {
    const { data, error } = await supabaseAdmin.from('store_settings').select('*').limit(1).single();
    if (error) return res.status(500).json({ success: false, data: null, message: '查询失败' });
    return res.json({ success: true, data });
  }

  // ===== 更新店铺设置 =====
  if (req.method === 'PATCH') {
    const allowed = ['store_name', 'logo_url', 'address', 'phone', 'business_hours', 'announcement'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from('store_settings').update(updates).select().single();
    if (error) return res.status(500).json({ success: false, data: null, message: '更新失败' });
    return res.json({ success: true, data, message: '保存成功' });
  }

  return res.status(405).json({ success: false, message: '不支持的方法' });
};
