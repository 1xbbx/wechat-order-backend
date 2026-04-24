/**
 * /api/admin/dashboard — 仪表盘统计数据
 * 
 * GET — 返回今日统计 + 最近7天趋势
 */
const { supabaseAdmin } = require('../../lib/supabase');
const { verifyAdmin } = require('../../lib/auth');

module.exports = async (req, res) => {
  const authResult = verifyAdmin(req);
  if (!authResult.valid) {
    return res.status(401).json({ success: false, data: null, message: authResult.message });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, data: null, message: '不支持的方法' });
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. 今日订单数 + 营业额
    const { data: todayOrders } = await supabaseAdmin
      .from('orders')
      .select('id, total_amount, status')
      .gte('created_at', todayStart);

    const todayCount = (todayOrders || []).length;
    const todayRevenue = (todayOrders || [])
      .filter(o => o.status === 'paid' || o.status === 'done')
      .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
    const todayPending = (todayOrders || []).filter(o => o.status === 'pending' || o.status === 'paid').length;
    const todayDone = (todayOrders || []).filter(o => o.status === 'done').length;

    // 2. 最近7天每天的订单数和营业额
    const { data: weekOrders } = await supabaseAdmin
      .from('orders')
      .select('created_at, total_amount, status')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: true });

    // 按天分组
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
        if (o.status === 'paid' || o.status === 'done') {
          dailyMap[key].revenue += parseFloat(o.total_amount || 0);
        }
      }
    });

    const dailyTrend = Object.values(dailyMap);

    // 3. 商品总数
    const { count: productCount } = await supabaseAdmin
      .from('products')
      .select('id', { count: 'exact', head: true });

    // 4. 桌台总数
    const { count: tableCount } = await supabaseAdmin
      .from('tables')
      .select('id', { count: 'exact', head: true });

    return res.json({
      success: true,
      data: {
        today: {
          orderCount: todayCount,
          revenue: todayRevenue.toFixed(2),
          pendingCount: todayPending,
          doneCount: todayDone
        },
        weekTrend: dailyTrend,
        productCount: productCount || 0,
        tableCount: tableCount || 0
      },
      message: '获取成功'
    });
  } catch (error) {
    console.error('仪表盘查询异常:', error);
    return res.status(500).json({ success: false, data: null, message: '查询失败' });
  }
};
