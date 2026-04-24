/**
 * /api/payment/notify — 微信支付异步回调
 * 
 * POST /api/payment/notify
 * 
 * 微信服务器在用户支付成功后，将结果以 XML 格式 POST 到此接口。
 * 
 * 处理流程：
 * 1. 解析 XML 请求体
 * 2. 验证签名（防伪造）
 * 3. 根据 out_trade_no 查找并更新订单状态 → paid
 * 4.（可选）触发芯烨云打印
 * 5. 返回成功 XML 给微信
 * 
 * 注意：
 * - 微信可能多次发送同一通知，需做幂等处理
 * - 必须在 5 秒内返回，否则微信会重试
 */

const { supabaseAdmin } = require('../../lib/supabase');
const { parseXml, toXml, verifySign } = require('../../lib/wechat-pay');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // ========== 第一步：获取并解析 XML 请求体 ==========
    let rawBody = '';

    // Vercel 环境下 req.body 可能已经是字符串
    if (typeof req.body === 'string') {
      rawBody = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8');
    } else {
      // 需要手动读取 stream
      rawBody = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => (data += chunk));
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });
    }

    console.log('收到微信支付回调:', rawBody);

    // 解析 XML 为对象
    const notifyData = parseXml(rawBody);

    // ========== 第二步：基本校验 ==========
    if (notifyData.return_code !== 'SUCCESS') {
      console.error('微信通知 return_code 非 SUCCESS:', notifyData.return_msg);
      return sendWxResponse(res, 'FAIL', '通信失败');
    }

    if (notifyData.result_code !== 'SUCCESS') {
      console.error('微信通知 result_code 非 SUCCESS:', notifyData.err_code_des);
      return sendWxResponse(res, 'FAIL', '业务失败');
    }

    // ========== 第三步：验证签名 ==========
    const apiKey = process.env.WECHAT_API_KEY;
    if (!verifySign(notifyData, apiKey)) {
      console.error('微信回调签名验证失败');
      return sendWxResponse(res, 'FAIL', '签名验证失败');
    }

    // ========== 第四步：处理业务逻辑 ==========
    const orderNo = notifyData.out_trade_no;         // 商户订单号
    const transactionId = notifyData.transaction_id; // 微信支付订单号
    const totalFee = parseInt(notifyData.total_fee);  // 实际支付金额（分）

    // 查询订单
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_no', orderNo)
      .single();

    if (orderError || !order) {
      console.error('回调订单不存在:', orderNo);
      return sendWxResponse(res, 'FAIL', '订单不存在');
    }

    // 幂等处理：如果订单已支付，直接返回成功
    if (order.status === 'paid' || order.status === 'done') {
      console.log('订单已处理，跳过:', orderNo);
      return sendWxResponse(res, 'SUCCESS', 'OK');
    }

    // 验证金额（防篡改）
    const expectedFee = Math.round(order.total_amount * 100);
    if (totalFee !== expectedFee) {
      console.error(`金额不匹配: 期望 ${expectedFee} 分, 实际 ${totalFee} 分`);
      return sendWxResponse(res, 'FAIL', '金额不匹配');
    }

    // 更新订单状态为已支付
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'paid',
        transaction_id: transactionId,
        paid_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('更新订单状态失败:', updateError);
      return sendWxResponse(res, 'FAIL', '更新订单失败');
    }

    console.log(`✅ 订单支付成功: ${orderNo}, 微信订单号: ${transactionId}`);

    // ========== 第五步（可选）：触发云打印 ==========
    try {
      // 如果已配置芯烨云打印，自动打印小票
      if (process.env.PRINTER_SN) {
        const { printOrder } = require('../../lib/printer');
        // 查询订单明细
        const { data: items } = await supabaseAdmin
          .from('order_items')
          .select('*')
          .eq('order_id', order.id);

        await printOrder({ ...order, status: 'paid' }, items || []);
        console.log('🖨️ 小票打印成功:', orderNo);

        // 标记已打印
        await supabaseAdmin
          .from('orders')
          .update({ printed: true })
          .eq('id', order.id);
      }
    } catch (printError) {
      // 打印失败不影响支付流程
      console.error('打印小票失败（不影响支付）:', printError.message);
    }

    // ========== 返回成功 XML ==========
    return sendWxResponse(res, 'SUCCESS', 'OK');
  } catch (error) {
    console.error('处理支付回调异常:', error);
    return sendWxResponse(res, 'FAIL', '系统异常');
  }
};

/**
 * 返回微信要求的 XML 格式响应
 * @param {Object} res  Express response
 * @param {string} code 'SUCCESS' 或 'FAIL'
 * @param {string} msg  消息
 */
function sendWxResponse(res, code, msg) {
  const xml = toXml({
    return_code: code,
    return_msg: msg
  });
  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(xml);
}
