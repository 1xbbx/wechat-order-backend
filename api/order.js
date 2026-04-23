/**
 * /api/order
 * 
 * POST /api/order — 顾客提交订单
 * GET  /api/order?order_no=xxx — 根据订单号查询订单详情
 * 
 * 订单号生成规则：日期 + 4位随机数，如 20260423-3A7F
 */

const { supabaseAdmin } = require('../lib/supabase');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    return handleCreateOrder(req, res);
  } else if (req.method === 'GET') {
    return handleGetOrder(req, res);
  } else {
    return res.status(405).json({
      success: false,
      data: null,
      message: '仅支持 GET / POST 请求'
    });
  }
};

/**
 * 生成订单号：YYYYMMDD-XXXX（日期 + 4位随机十六进制）
 */
function generateOrderNo() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `${date}-${rand}`;
}

/**
 * POST /api/order — 提交订单
 * 
 * 请求体：
 * {
 *   table_number: "B1",
 *   items: [
 *     { product_id: "uuid", product_name: "宫保鸡丁", price: 38.00, quantity: 2 },
 *     ...
 *   ],
 *   remark: "不要辣"
 * }
 */
async function handleCreateOrder(req, res) {
  try {
    const { table_number, items, remark } = req.body;

    // 参数校验
    if (!table_number) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少桌号 table_number'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '订单菜品不能为空'
      });
    }

    // 计算每项小计及订单总金额
    const orderItems = items.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      price: Number(item.price),
      quantity: Number(item.quantity),
      subtotal: Number((item.price * item.quantity).toFixed(2))
    }));

    const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

    // 生成订单号
    const orderNo = generateOrderNo();

    // 1. 插入订单主表
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        order_no: orderNo,
        table_number,
        status: 'pending',
        total_amount: totalAmount,
        remark: remark || '',
        printed: false
      })
      .select()
      .single();

    if (orderError) {
      console.error('创建订单失败:', orderError);
      return res.status(500).json({
        success: false,
        data: null,
        message: '创建订单失败'
      });
    }

    // 2. 插入订单明细
    const itemsWithOrderId = orderItems.map(item => ({
      ...item,
      order_id: order.id
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(itemsWithOrderId);

    if (itemsError) {
      console.error('插入订单明细失败:', itemsError);
      // 回滚：删除已创建的订单
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      return res.status(500).json({
        success: false,
        data: null,
        message: '创建订单明细失败'
      });
    }

    // 3. 返回订单信息（提示顾客去前台付款）
    return res.status(200).json({
      success: true,
      data: {
        order_no: orderNo,
        table_number,
        total_amount: totalAmount,
        status: 'pending',
        items: orderItems
      },
      message: '下单成功，请到前台付款'
    });
  } catch (error) {
    console.error('提交订单异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
}

/**
 * GET /api/order?order_no=20260423-3A7F
 * 查询订单详情（含订单明细）
 */
async function handleGetOrder(req, res) {
  try {
    const { order_no } = req.query;

    if (!order_no) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少 order_no 参数'
      });
    }

    // 查询订单
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_no', order_no)
      .single();

    if (orderError || !order) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '未找到该订单'
      });
    }

    // 查询订单明细
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('id, product_id, product_name, price, quantity, subtotal')
      .eq('order_id', order.id);

    if (itemsError) {
      console.error('查询订单明细失败:', itemsError);
      return res.status(500).json({
        success: false,
        data: null,
        message: '查询订单明细失败'
      });
    }

    return res.status(200).json({
      success: true,
      data: { ...order, items },
      message: '查询订单成功'
    });
  } catch (error) {
    console.error('查询订单异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
}
