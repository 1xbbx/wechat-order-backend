/**
 * /api/order/create — 创建订单
 * 
 * POST /api/order/create
 * 
 * 请求体：
 * {
 *   table_number: "A1",
 *   openid: "用户微信openid",
 *   remark: "少辣",
 *   items: [
 *     { product_id: "uuid", quantity: 2 },
 *     { product_id: "uuid", quantity: 1 }
 *   ]
 * }
 * 
 * 返回：{ order_id, order_no, total_amount }
 */

const { supabaseAdmin } = require('../../lib/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      data: null,
      message: '请使用 POST 方法提交订单'
    });
  }

  try {
    const { table_number, openid, remark, items } = req.body;

    // ========== 参数校验 ==========
    if (!table_number) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少桌号 table_number'
      });
    }

    if (!openid) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少用户 openid'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '购物车不能为空'
      });
    }

    // ========== 查询商品信息，计算价格 ==========
    const productIds = items.map(item => item.product_id);

    const { data: products, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, name, price, available')
      .in('id', productIds);

    if (productError) {
      console.error('查询商品失败:', productError);
      return res.status(500).json({
        success: false,
        data: null,
        message: '查询商品信息失败'
      });
    }

    // 构建商品映射
    const productMap = {};
    products.forEach(p => { productMap[p.id] = p; });

    // 验证商品并计算明细
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const product = productMap[item.product_id];

      if (!product) {
        return res.status(400).json({
          success: false,
          data: null,
          message: `商品不存在: ${item.product_id}`
        });
      }

      if (!product.available) {
        return res.status(400).json({
          success: false,
          data: null,
          message: `商品已下架: ${product.name}`
        });
      }

      const quantity = parseInt(item.quantity) || 1;
      const subtotal = parseFloat((product.price * quantity).toFixed(2));

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        quantity,
        subtotal
      });

      totalAmount += subtotal;
    }

    totalAmount = parseFloat(totalAmount.toFixed(2));

    // ========== 生成订单号 ==========
    // 格式：ORD + 年月日时分秒 + 4位随机字母数字
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNo = `ORD${dateStr}${randomStr}`;

    // ========== 写入 orders 表 ==========
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        order_no: orderNo,
        table_number,
        openid,
        status: 'pending',         // 待支付
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

    // ========== 写入 order_items 表 ==========
    const itemsToInsert = orderItems.map(item => ({
      order_id: order.id,
      ...item
    }));

    const { error: itemsInsertError } = await supabaseAdmin
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsInsertError) {
      console.error('写入订单明细失败:', itemsInsertError);
      // 回滚：删除已创建的订单
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      return res.status(500).json({
        success: false,
        data: null,
        message: '写入订单明细失败'
      });
    }

    // ========== 返回结果 ==========
    return res.status(200).json({
      success: true,
      data: {
        order_id: order.id,
        order_no: orderNo,
        total_amount: totalAmount
      },
      message: '订单创建成功，请发起支付'
    });
  } catch (error) {
    console.error('创建订单异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
};
