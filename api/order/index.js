/**
 * /api/order/index — 查询订单
 * 
 * GET /api/order?order_no=ORD20260423120001ABCD
 * 返回订单详情 + 订单明细
 */

const { supabaseAdmin } = require('../../lib/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      data: null,
      message: '请使用 GET 方法查询订单'
    });
  }

  try {
    const { order_no } = req.query;

    if (!order_no) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少订单号 order_no'
      });
    }

    // 查询订单主表
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_no', order_no)
      .single();

    if (orderError || !order) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '订单不存在'
      });
    }

    // 查询订单明细
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    if (itemsError) {
      console.error('查询订单明细失败:', itemsError);
    }

    return res.status(200).json({
      success: true,
      data: {
        ...order,
        items: items || []
      },
      message: '获取订单详情成功'
    });
  } catch (error) {
    console.error('查询订单异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
};
