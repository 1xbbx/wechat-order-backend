/**
 * /api/admin/orders
 * 
 * GET    /api/admin/orders           — 获取订单列表（支持 status 筛选）
 * GET    /api/admin/orders?status=pending — 只看待处理订单
 * PATCH  /api/admin/orders           — 更新订单状态 / 标记已打印
 * 
 * 所有管理接口需要 header: Authorization: Bearer <token>
 */

const { supabaseAdmin } = require('../../lib/supabase');
const { verifyAdmin } = require('../../lib/auth');

module.exports = async (req, res) => {
  // 验证管理员身份
  const authResult = verifyAdmin(req);
  if (!authResult.valid) {
    return res.status(401).json({
      success: false,
      data: null,
      message: authResult.message
    });
  }

  if (req.method === 'GET') {
    return handleGetOrders(req, res);
  } else if (req.method === 'PATCH') {
    return handleUpdateOrder(req, res);
  } else {
    return res.status(405).json({
      success: false,
      data: null,
      message: '仅支持 GET / PATCH 请求'
    });
  }
};

/**
 * GET /api/admin/orders
 * 查询参数：
 *   status  — 可选，筛选订单状态（pending / done）
 *   page    — 页码，默认 1
 *   limit   — 每页条数，默认 20
 */
async function handleGetOrders(req, res) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * pageSize;

    // 构建查询
    let query = supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    // 按状态筛选
    if (status && ['pending', 'done'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: orders, error, count } = await query;

    if (error) {
      console.error('查询订单列表失败:', error);
      return res.status(500).json({
        success: false,
        data: null,
        message: '查询订单列表失败'
      });
    }

    // 批量查询所有订单的明细
    if (orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      const { data: allItems } = await supabaseAdmin
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      // 将明细分组挂到对应订单上
      orders.forEach(order => {
        order.items = (allItems || []).filter(item => item.order_id === order.id);
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          page: pageNum,
          limit: pageSize,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / pageSize)
        }
      },
      message: '获取订单列表成功'
    });
  } catch (error) {
    console.error('查询订单列表异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
}

/**
 * PATCH /api/admin/orders
 * 更新订单状态或打印状态
 * 
 * 请求体：
 * {
 *   order_id: "uuid",
 *   status: "done",     // 可选，更新状态
 *   printed: true       // 可选，标记已打印
 * }
 */
async function handleUpdateOrder(req, res) {
  try {
    const { order_id, status, printed } = req.body;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少 order_id'
      });
    }

    // 构建更新字段
    const updates = {};
    if (status && ['pending', 'done'].includes(status)) {
      updates.status = status;
    }
    if (typeof printed === 'boolean') {
      updates.printed = printed;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '没有需要更新的字段（可更新：status, printed）'
      });
    }

    // 执行更新
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .update(updates)
      .eq('id', order_id)
      .select()
      .single();

    if (error) {
      console.error('更新订单失败:', error);
      return res.status(500).json({
        success: false,
        data: null,
        message: '更新订单失败'
      });
    }

    return res.status(200).json({
      success: true,
      data: order,
      message: '订单更新成功'
    });
  } catch (error) {
    console.error('更新订单异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
}
