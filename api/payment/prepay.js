/**
 * /api/payment/prepay — 发起微信预支付
 * 
 * POST /api/payment/prepay
 * 
 * 请求体：
 * {
 *   order_id: "订单UUID",
 *   openid: "用户微信openid"
 * }
 * 
 * 返回前端调 wx.requestPayment() 需要的全部参数：
 * { timeStamp, nonceStr, package, signType, paySign }
 */

const { supabaseAdmin } = require('../../lib/supabase');
const { unifiedOrder, getPaymentParams } = require('../../lib/wechat-pay');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      data: null,
      message: '请使用 POST 方法'
    });
  }

  try {
    const { order_id, openid } = req.body;

    // ========== 参数校验 ==========
    if (!order_id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少 order_id'
      });
    }

    if (!openid) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少 openid'
      });
    }

    // ========== 查询订单 ==========
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '订单不存在'
      });
    }

    // 检查订单状态（只有 pending 状态才能发起支付）
    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        data: null,
        message: `订单状态为 ${order.status}，不能重复支付`
      });
    }

    // ========== 调用微信统一下单 ==========
    // total_fee 单位是分，需要将元转为分
    const totalFee = Math.round(order.total_amount * 100);

    const wxResult = await unifiedOrder({
      out_trade_no: order.order_no,
      total_fee: totalFee,
      openid: openid,
      body: `点单-${order.order_no}`,
      spbill_create_ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '127.0.0.1'
    });

    // ========== 保存 prepay_id 到订单表 ==========
    const prepayId = wxResult.prepay_id;

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ prepay_id: prepayId })
      .eq('id', order_id);

    if (updateError) {
      console.error('保存 prepay_id 失败:', updateError);
      // 不阻断流程，继续返回支付参数
    }

    // ========== 生成前端支付参数 ==========
    const paymentParams = getPaymentParams(prepayId);

    return res.status(200).json({
      success: true,
      data: {
        order_no: order.order_no,
        total_amount: order.total_amount,
        ...paymentParams
      },
      message: '预支付成功，请调用 wx.requestPayment'
    });
  } catch (error) {
    console.error('预支付异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: `支付失败: ${error.message}`
    });
  }
};
